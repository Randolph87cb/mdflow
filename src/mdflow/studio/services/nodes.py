from __future__ import annotations

from mdflow.errors import CliUsageError
from mdflow.parser import parse_markdown_file

from .common import find_node_path, load_workflow_bundle_by_id, node_to_summary, validate_node_markdown_update


def list_nodes(config, workflow_id: str) -> list[dict]:
    bundle, _node_catalog, _workflow_dir = load_workflow_bundle_by_id(config, workflow_id)
    return [node_to_summary(node) for node in bundle.nodes]


def get_node(config, workflow_id: str, node_id: str) -> dict:
    bundle, _node_catalog, workflow_dir = load_workflow_bundle_by_id(config, workflow_id)
    node = bundle.nodes_by_id.get(node_id)
    if node is None:
        raise CliUsageError(f"node not found: {node_id}")
    content = node.path.read_text(encoding="utf-8")
    return {
        "node": node_to_summary(node),
        "workflow_id": workflow_id,
        "content": content,
        "path": node.path.relative_to(config.project_root).as_posix(),
        "graph": None,
    }


def update_node(config, workflow_id: str, node_id: str, content: str) -> dict:
    bundle, _node_catalog, workflow_dir = load_workflow_bundle_by_id(config, workflow_id)
    if node_id not in bundle.nodes_by_id:
        raise CliUsageError(f"node not found: {node_id}")
    validate_node_markdown_update(config, workflow_dir, node_id, content)
    node_path = find_node_path(workflow_dir, node_id)
    node_path.write_text(content, encoding="utf-8")
    updated_bundle, _updated_catalog, _ = load_workflow_bundle_by_id(config, workflow_id)
    updated_node = updated_bundle.nodes_by_id[node_id]
    return {
        "node": node_to_summary(updated_node),
        "content": updated_node.path.read_text(encoding="utf-8"),
        "path": updated_node.path.relative_to(config.project_root).as_posix(),
    }
