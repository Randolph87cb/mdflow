from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from mdflow.errors import CliUsageError
from mdflow.parser import parse_markdown_file
from mdflow.trace import read_json

from .common import build_graph, list_run_dirs, list_workflow_dirs, load_workflow_bundle_by_id, write_markdown_document


def list_workflows(config) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for workflow_dir in list_workflow_dirs(config):
        bundle, node_catalog, _ = load_workflow_bundle_by_id(config, workflow_dir.name)
        latest_run = None
        run_dirs = list_run_dirs(config, bundle.workflow.id)
        if run_dirs:
            meta = read_json(run_dirs[0] / "meta.json")
            state = read_json(run_dirs[0] / "state.json")
            latest_run = {
                "run_id": meta["run_id"],
                "status": state["status"],
                "started_at": meta["started_at"],
            }
        items.append(
            {
                "workflow_id": bundle.workflow.id,
                "name": bundle.workflow.name,
                "node_count": len(node_catalog),
                "latest_run": latest_run,
            }
        )
    return items


def get_workflow_detail(config, workflow_id: str) -> dict[str, Any]:
    bundle, node_catalog, workflow_dir = load_workflow_bundle_by_id(config, workflow_id)
    return {
        "workflow_id": bundle.workflow.id,
        "name": bundle.workflow.name,
        "entry": bundle.workflow.entry,
        "model": bundle.workflow.model,
        "final_outputs": bundle.workflow.final_outputs,
        "workflow_path": workflow_dir.relative_to(config.project_root).as_posix(),
        "body": bundle.workflow.body,
        "node_count": len(node_catalog),
    }


def get_workflow_graph(config, workflow_id: str) -> dict[str, Any]:
    bundle, _node_catalog, _workflow_dir = load_workflow_bundle_by_id(config, workflow_id)
    return build_graph(bundle)


def copy_workflow(config, workflow_id: str, *, new_workflow_id: str, new_name: str | None, copy_scripts: bool, copy_inputs: bool) -> dict[str, Any]:
    if not new_workflow_id or not all(ch.isalnum() or ch in {"_", "-"} for ch in new_workflow_id):
        raise CliUsageError("new_workflow_id must contain only letters, numbers, underscores, and hyphens")
    bundle, _node_catalog, workflow_dir = load_workflow_bundle_by_id(config, workflow_id)
    target_dir = (config.project_root / config.workflows_dir / new_workflow_id).resolve()
    if target_dir.exists():
        raise CliUsageError(f"workflow already exists: {new_workflow_id}")

    target_dir.mkdir(parents=True)
    shutil.copytree(workflow_dir / "nodes", target_dir / "nodes")
    if copy_scripts and (workflow_dir / "scripts").is_dir():
        shutil.copytree(workflow_dir / "scripts", target_dir / "scripts")
    if copy_inputs and (workflow_dir / "inputs").is_dir():
        shutil.copytree(workflow_dir / "inputs", target_dir / "inputs")

    workflow_front_matter, workflow_body = parse_markdown_file(workflow_dir / "workflow.md")
    workflow_front_matter["id"] = new_workflow_id
    workflow_front_matter["name"] = new_name or workflow_front_matter.get("name") or new_workflow_id
    write_markdown_document(target_dir / "workflow.md", workflow_front_matter, workflow_body)
    return {"workflow_id": new_workflow_id, "name": workflow_front_matter["name"]}
