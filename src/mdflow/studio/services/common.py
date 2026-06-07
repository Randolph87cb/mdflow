from __future__ import annotations

import io
import shutil
import tempfile
from pathlib import Path
from typing import Any

import yaml

from mdflow.config import load_project_config
from mdflow.errors import CliUsageError, ValidationError
from mdflow.models import NodeSpec, ProjectConfig, WorkflowBundle
from mdflow.parser import load_workflow_bundle, parse_markdown_file
from mdflow.resolver import ensure_relative_output_path, list_node_targets, make_trace_prefix_map, resolve_run_dir
from mdflow.trace import read_json
from mdflow.validator import load_and_validate_workflow

TEXT_EXTENSIONS = {".md", ".txt", ".cpp", ".py", ".json", ".yaml", ".yml"}


def load_config(project_root: Path) -> ProjectConfig:
    return load_project_config(project_root)


def load_workflow_bundle_by_id(config: ProjectConfig, workflow_id: str) -> tuple[WorkflowBundle, list[NodeSpec], Path]:
    workflow_dir = (config.project_root / config.workflows_dir / workflow_id).resolve()
    if not workflow_dir.is_dir():
        raise CliUsageError(f"workflow not found: {workflow_id}")
    bundle, node_catalog = load_and_validate_workflow(config, workflow_dir)
    return bundle, node_catalog, workflow_dir


def list_workflow_dirs(config: ProjectConfig) -> list[Path]:
    workflows_root = (config.project_root / config.workflows_dir).resolve()
    if not workflows_root.is_dir():
        return []
    return sorted(
        path
        for path in workflows_root.iterdir()
        if path.is_dir() and (path / "workflow.md").is_file()
    )


def list_run_dirs(config: ProjectConfig, workflow_id: str) -> list[Path]:
    runs_root = (config.project_root / config.runs_dir / workflow_id).resolve()
    if not runs_root.is_dir():
        return []
    run_dirs = [path for path in runs_root.iterdir() if path.is_dir()]
    return sorted(run_dirs, key=lambda path: _run_sort_key(path), reverse=True)


def read_run_bundle(config: ProjectConfig, workflow_id: str, run_id: str) -> tuple[Path, dict[str, Any], dict[str, Any], WorkflowBundle, list[NodeSpec], Path]:
    run_dir = resolve_run_dir(config.project_root, f"{config.runs_dir}/{workflow_id}/{run_id}")
    meta = read_json(run_dir / "meta.json")
    state = read_json(run_dir / "state.json")
    workflow_source_dir = (config.project_root / str(meta["workflow_dir"])).resolve()
    snapshot_dir = run_dir / "workflow_snapshot"
    workflow_dir = snapshot_dir if snapshot_dir.is_dir() else workflow_source_dir
    bundle, node_catalog = load_and_validate_workflow(config, workflow_dir)
    return run_dir, meta, state, bundle, node_catalog, workflow_source_dir


def build_graph(bundle: WorkflowBundle, *, state: dict[str, Any] | None = None) -> dict[str, Any]:
    attempts = dict(state.get("node_attempts", {})) if state else {}
    completed = set(state.get("completed_nodes", [])) if state else set()
    current_node = state.get("current_node") if state else None
    last_failure = state.get("last_failure") if state else None
    failed_node = last_failure.get("node_id") if isinstance(last_failure, dict) else None
    nodes: list[dict[str, Any]] = []
    for node in bundle.nodes:
        status = "idle"
        if node.id in completed:
            status = "success"
        elif failed_node == node.id:
            status = "failed"
        elif current_node == node.id:
            status = "running"
        nodes.append(
            {
                "id": node.id,
                "name": node.name or node.id,
                "type": node.type,
                "produces": node.produces,
                "status": status,
                "attempts": attempts.get(node.id, 0),
            }
        )
    edges: list[dict[str, Any]] = []
    for node in bundle.nodes:
        if node.type == "router":
            for route in node.routes:
                edges.append(
                    {
                        "from": node.id,
                        "to": route.next,
                        "kind": "route",
                        "label": f"{route.source} {route.operator} {route.value}",
                    }
                )
            if node.default_next:
                edges.append({"from": node.id, "to": node.default_next, "kind": "default", "label": "default"})
        elif node.next:
            edges.append({"from": node.id, "to": node.next, "kind": "next", "label": None})
    return {"nodes": nodes, "edges": edges}


def node_to_summary(node: NodeSpec) -> dict[str, Any]:
    return {
        "id": node.id,
        "name": node.name,
        "type": node.type,
        "produces": node.produces,
        "next": node.next,
        "retry": {"max_attempts": node.retry.max_attempts} if node.retry else None,
        "default_next": node.default_next,
        "routes": [
            {
                "source": route.source,
                "operator": route.operator,
                "value": route.value,
                "next": route.next,
            }
            for route in node.routes
        ],
        "path": node.path.as_posix(),
    }


def latest_attempt_files(run_dir: Path, node_catalog: list[NodeSpec], node_id: str) -> dict[str, Path]:
    prefix = make_trace_prefix_map(node_catalog)[node_id]
    trace_dir = run_dir / "trace"
    result: dict[str, Path] = {}
    for stream in ["prompt", "stdout", "stderr", "input", "output"]:
        matches = sorted(trace_dir.glob(f"{prefix}.attempt-*.{stream}.txt"))
        if matches:
            result[stream] = matches[-1]
            continue
        legacy = trace_dir / f"{prefix}.{stream}.txt"
        if legacy.exists():
            result[stream] = legacy
    return result


def is_previewable_text(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTENSIONS


def resolve_safe_child(base_dir: Path, relative_path: str) -> Path:
    try:
        ensure_relative_output_path(relative_path, label="path")
    except ValueError as exc:
        raise CliUsageError(str(exc)) from exc
    target = (base_dir / relative_path).resolve()
    try:
        target.relative_to(base_dir.resolve())
    except ValueError as exc:
        raise CliUsageError(f"path escapes base directory: {relative_path}") from exc
    return target


def write_markdown_document(path: Path, front_matter: dict[str, Any], body: str) -> None:
    yaml_text = yaml.safe_dump(front_matter, allow_unicode=True, sort_keys=False).strip()
    content = f"---\n{yaml_text}\n---\n\n{body.lstrip()}"
    path.write_text(content, encoding="utf-8")


def validate_node_markdown_update(config: ProjectConfig, workflow_dir: Path, node_id: str, content: str) -> tuple[dict[str, Any], str]:
    with tempfile.TemporaryDirectory(prefix="mdflow-node-edit-") as tmp_dir:
        temp_workflow_dir = Path(tmp_dir) / workflow_dir.name
        shutil.copytree(workflow_dir, temp_workflow_dir)
        node_path = find_node_path(temp_workflow_dir, node_id)
        node_path.write_text(content, encoding="utf-8")
        front_matter, body = parse_markdown_file(node_path)
        if str(front_matter.get("id", "")) != node_id:
            raise ValidationError([f"node update must preserve id '{node_id}'"])
        if not str(front_matter.get("type", "")):
            raise ValidationError(["node update missing required field 'type'"])
        load_and_validate_workflow(config, temp_workflow_dir)
        return front_matter, body


def find_node_path(workflow_dir: Path, node_id: str) -> Path:
    bundle = load_workflow_bundle(workflow_dir)
    node = bundle.nodes_by_id.get(node_id)
    if node is None:
        raise CliUsageError(f"node not found: {node_id}")
    return node.path


def _run_sort_key(run_dir: Path) -> tuple[str, str]:
    meta_path = run_dir / "meta.json"
    if not meta_path.is_file():
        return ("", run_dir.name)
    payload = read_json(meta_path)
    return (str(payload.get("started_at", "")), run_dir.name)
