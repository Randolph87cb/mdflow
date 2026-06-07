from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from mdflow.models import ExecConfig, NodeSpec, WorkflowBundle, WorkflowSpec


def load_workflow_bundle(workflow_dir: Path) -> WorkflowBundle:
    workflow_path = workflow_dir / "workflow.md"
    workflow_front_matter, workflow_body = parse_markdown_file(workflow_path)
    workflow = WorkflowSpec(
        id=str(workflow_front_matter.get("id", "")),
        name=_optional_string(workflow_front_matter.get("name")),
        entry=_string_or_empty(workflow_front_matter.get("entry")),
        model=_as_dict(workflow_front_matter.get("model")),
        final_outputs=_string_list(workflow_front_matter.get("final_outputs")),
        path=workflow_path,
        workflow_dir=workflow_dir,
        body=workflow_body,
    )

    nodes_dir = workflow_dir / "nodes"
    nodes: list[NodeSpec] = []
    for node_path in sorted(nodes_dir.glob("*.md")):
        front_matter, body = parse_markdown_file(node_path)
        exec_config = None
        exec_data = front_matter.get("exec")
        if isinstance(exec_data, dict):
            exec_config = ExecConfig(
                program=_string_or_empty(exec_data.get("program")),
                args=_string_list(exec_data.get("args")),
                cwd=_string_or_empty(exec_data.get("cwd")),
                timeout_sec=_int_or_zero(exec_data.get("timeout_sec")),
            )
        nodes.append(
            NodeSpec(
                id=_string_or_empty(front_matter.get("id")),
                type=_string_or_empty(front_matter.get("type")),
                next=_optional_string(front_matter.get("next")),
                name=_optional_string(front_matter.get("name")),
                produces=_optional_string(front_matter.get("produces")),
                model=_as_dict(front_matter.get("model")),
                exec=exec_config,
                body=body,
                path=node_path,
            )
        )
    return WorkflowBundle(workflow=workflow, nodes=nodes, nodes_by_id={node.id: node for node in nodes if node.id})


def parse_markdown_file(path: Path) -> tuple[dict[str, Any], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise ValueError(f"{path} missing front matter")
    lines = text.splitlines()
    if len(lines) < 3:
        raise ValueError(f"{path} missing closing front matter delimiter")
    try:
        closing_index = lines[1:].index("---") + 1
    except ValueError as exc:
        raise ValueError(f"{path} missing closing front matter delimiter") from exc
    front_matter_text = "\n".join(lines[1:closing_index])
    body = "\n".join(lines[closing_index + 1 :]).lstrip("\n")
    parsed = yaml.safe_load(front_matter_text) or {}
    if not isinstance(parsed, dict):
        raise ValueError(f"{path} front matter must be a YAML object")
    return parsed, body


def _string_or_empty(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    return value if isinstance(value, str) else None


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _int_or_zero(value: Any) -> int:
    return value if isinstance(value, int) else 0
