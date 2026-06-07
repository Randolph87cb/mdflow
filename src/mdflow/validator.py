from __future__ import annotations

from pathlib import Path

from mdflow.errors import ValidationError
from mdflow.models import NodeSpec, ProjectConfig, WorkflowBundle
from mdflow.parser import load_workflow_bundle
from mdflow.resolver import (
    build_execution_chain,
    ensure_relative_output_path,
    extract_references,
    is_workflow_script_arg,
)


def load_and_validate_workflow(config: ProjectConfig, workflow_dir: Path) -> tuple[WorkflowBundle, list[NodeSpec]]:
    bundle = load_workflow_bundle(workflow_dir)
    ordered_nodes = validate_workflow_bundle(config, bundle)
    return bundle, ordered_nodes


def validate_project_config(config: ProjectConfig) -> None:
    errors: list[str] = []
    if not config.name:
        errors.append("mdflow.yaml: missing required field 'name'")
    if not config.workflows_dir:
        errors.append("mdflow.yaml: missing required field 'workflows_dir'")
    if not config.runs_dir:
        errors.append("mdflow.yaml: missing required field 'runs_dir'")
    if not config.default_workflow:
        errors.append("mdflow.yaml: missing required field 'default_workflow'")
    if not config.model.get("provider"):
        errors.append("mdflow.yaml: missing required field 'model.provider'")
    if not config.model.get("model"):
        errors.append("mdflow.yaml: missing required field 'model.model'")
    if not config.providers:
        errors.append("mdflow.yaml: missing required field 'providers'")
    for provider_name, provider in config.providers.items():
        provider_type = provider.get("type")
        if provider_type not in {"mock", "openai_compatible"}:
            errors.append(f"mdflow.yaml: provider '{provider_name}' has unsupported type '{provider_type}'")
        if provider_type == "openai_compatible":
            if not provider.get("base_url_env"):
                errors.append(f"mdflow.yaml: provider '{provider_name}' missing 'base_url_env'")
            if not provider.get("api_key_env"):
                errors.append(f"mdflow.yaml: provider '{provider_name}' missing 'api_key_env'")
    model_provider = str(config.model.get("provider", ""))
    if model_provider and model_provider not in config.providers:
        errors.append(f"mdflow.yaml: model.provider '{model_provider}' not found in providers")
    if errors:
        raise ValidationError(errors)


def validate_workflow_bundle(config: ProjectConfig, bundle: WorkflowBundle) -> list[NodeSpec]:
    errors: list[str] = []
    workflow = bundle.workflow
    nodes = bundle.nodes
    nodes_by_id = bundle.nodes_by_id

    if not workflow.id:
        errors.append("workflow.md: missing required field 'id'")
    elif not _valid_identifier(workflow.id):
        errors.append(f"workflow.md: invalid workflow id '{workflow.id}'")
    if workflow.id and workflow.id != workflow.workflow_dir.name:
        errors.append(f"workflow.md: id '{workflow.id}' must match directory name '{workflow.workflow_dir.name}'")
    if not workflow.entry:
        errors.append("workflow.md: missing required field 'entry'")
    if not workflow.final_outputs:
        errors.append("workflow.md: missing required field 'final_outputs'")
    else:
        seen_outputs: set[str] = set()
        for output_name in workflow.final_outputs:
            try:
                ensure_relative_output_path(output_name, label="final_outputs")
            except ValueError as exc:
                errors.append(f"workflow.md: {exc}")
            if output_name in seen_outputs:
                errors.append(f"workflow.md: final_outputs contains duplicate '{output_name}'")
            seen_outputs.add(output_name)
    _validate_model_object("workflow.md", workflow.model, config, errors)

    if not nodes:
        errors.append("nodes/: expected at least one node file")
    seen_ids: set[str] = set()
    produces_seen: dict[str, str] = {}
    for node in nodes:
        _validate_node(config, workflow, node, nodes_by_id, errors, seen_ids, produces_seen)

    if workflow.entry and workflow.entry not in nodes_by_id:
        errors.append(f"workflow.md: entry node '{workflow.entry}' not found")

    ordered_nodes: list[NodeSpec] = []
    if not errors and workflow.entry:
        try:
            ordered_nodes = build_execution_chain(workflow.entry, nodes_by_id)
        except ValueError as exc:
            errors.append(f"workflow.md: {exc}")

    if ordered_nodes:
        order_map = {node.id: index for index, node in enumerate(ordered_nodes)}
        for node in ordered_nodes:
            _validate_node_references(node, order_map, errors)

    if workflow.final_outputs:
        declared_outputs = {node.produces for node in nodes if node.produces}
        for output_name in workflow.final_outputs:
            if output_name not in declared_outputs:
                errors.append(f"workflow.md: final_output '{output_name}' is not covered by any node produces")

    if errors:
        raise ValidationError(errors)
    return ordered_nodes


def _validate_node(
    config: ProjectConfig,
    workflow,
    node: NodeSpec,
    nodes_by_id: dict[str, NodeSpec],
    errors: list[str],
    seen_ids: set[str],
    produces_seen: dict[str, str],
) -> None:
    location = node.path.relative_to(workflow.workflow_dir.parent.parent)
    if not node.id:
        errors.append(f"{location}: missing required field 'id'")
    elif not _valid_identifier(node.id):
        errors.append(f"{location}: invalid node id '{node.id}'")
    elif node.id in seen_ids:
        errors.append(f"{location}: duplicate node id '{node.id}'")
    else:
        seen_ids.add(node.id)

    if node.type not in {"llm", "script"}:
        errors.append(f"{location}: unsupported node type '{node.type}'")
    if node.next is None and "next:" not in node.path.read_text(encoding="utf-8"):
        errors.append(f"{location}: missing required field 'next'")
    if node.next == node.id:
        errors.append(f"{location}: next must not point to itself")
    if node.next and node.next not in nodes_by_id:
        errors.append(f"{location}: next node '{node.next}' not found")
    if node.produces:
        try:
            ensure_relative_output_path(node.produces, label="produces")
        except ValueError as exc:
            errors.append(f"{location}: {exc}")
        if node.produces in produces_seen:
            errors.append(f"{location}: produces '{node.produces}' duplicated by node '{produces_seen[node.produces]}'")
        else:
            produces_seen[node.produces] = node.id
    if node.type == "llm":
        if not node.body.strip():
            errors.append(f"{location}: llm node body must not be empty")
        _validate_model_object(str(location), node.model, config, errors)
    if node.type == "script":
        if node.exec is None:
            errors.append(f"{location}: script node missing exec")
        else:
            if not node.exec.program:
                errors.append(f"{location}: script node missing exec.program")
            if not node.exec.args:
                errors.append(f"{location}: script node missing exec.args")
            if not node.exec.cwd:
                errors.append(f"{location}: script node missing exec.cwd")
            if node.exec.timeout_sec <= 0:
                errors.append(f"{location}: script node missing exec.timeout_sec")
            if Path(node.exec.cwd).is_absolute() or ".." in Path(node.exec.cwd).parts:
                errors.append(f"{location}: exec.cwd must stay within run_dir")
            if node.exec.args:
                arg0 = node.exec.args[0]
                if is_workflow_script_arg(node.exec.program, arg0):
                    script_path = workflow.workflow_dir / arg0
                    if not script_path.is_file():
                        errors.append(f"{location}: workflow script not found '{arg0}'")
                for arg in node.exec.args:
                    if arg.startswith("outputs/") or arg.startswith("trace/"):
                        if Path(arg).is_absolute() or ".." in Path(arg).parts:
                            errors.append(f"{location}: invalid run-relative path '{arg}'")


def _validate_model_object(location: str, model: dict[str, object], config: ProjectConfig, errors: list[str]) -> None:
    allowed = {"provider", "model", "temperature", "max_tokens"}
    for key in model:
        if key not in allowed:
            errors.append(f"{location}: unsupported model field '{key}'")
    provider_name = model.get("provider")
    if provider_name and str(provider_name) not in config.providers:
        errors.append(f"{location}: model.provider '{provider_name}' not found in providers")
    temperature = model.get("temperature")
    if temperature is not None and not isinstance(temperature, (int, float)):
        errors.append(f"{location}: model.temperature must be a number")
    max_tokens = model.get("max_tokens")
    if max_tokens is not None and (not isinstance(max_tokens, int) or max_tokens <= 0):
        errors.append(f"{location}: model.max_tokens must be a positive integer")


def _validate_node_references(node: NodeSpec, order_map: dict[str, int], errors: list[str]) -> None:
    location = str(node.path.relative_to(node.path.parents[3]))
    texts = [node.body] if node.type == "llm" else []
    if node.type == "script" and node.exec is not None:
        texts.extend(node.exec.args)
    for text in texts:
        try:
            refs = extract_references(text)
        except ValueError as exc:
            errors.append(f"{location}: {exc}")
            continue
        for name, _stream in refs:
            if name == "initial":
                continue
            if name not in order_map:
                errors.append(f"{location}: invalid reference to unknown node '{name}'")
                continue
            if order_map[name] >= order_map[node.id]:
                errors.append(f"{location}: invalid reference '{{{{{name}.stdout}}}}' to non-previous node")


def _valid_identifier(value: str) -> bool:
    return bool(value) and all(ch.isalnum() or ch in {"_", "-"} for ch in value)
