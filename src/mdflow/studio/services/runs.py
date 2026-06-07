from __future__ import annotations

from pathlib import Path
from typing import Any

from mdflow.errors import CliUsageError
from mdflow.resolver import extract_file_references, extract_references
from mdflow.runtime import rerun_workflow, run_workflow
from mdflow.trace import read_json

from .common import build_graph, latest_attempt_files, list_run_dirs, load_workflow_bundle_by_id, read_run_bundle, resolve_safe_child


def list_runs(config, workflow_id: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for run_dir in list_run_dirs(config, workflow_id):
        meta = read_json(run_dir / "meta.json")
        state = read_json(run_dir / "state.json")
        items.append(
            {
                "run_id": meta["run_id"],
                "status": state["status"],
                "current_node": state["current_node"],
                "started_at": meta["started_at"],
                "finished_at": meta.get("finished_at"),
                "source_run_id": meta.get("source_run_id"),
                "rerun_from_node": meta.get("rerun_from_node"),
            }
        )
    return items


def create_run(config, workflow_id: str, *, input_mode: str, input_text: str | None, input_file: str | None, run_name: str | None, note: str | None) -> dict[str, Any]:
    run_dir, state = run_workflow(
        config=config,
        workflow_arg=workflow_id,
        input_mode=input_mode,
        input_text=input_text,
        input_file_arg=input_file,
        run_id=run_name,
        note=note,
    )
    return {"run_id": run_dir.name, "status": state.status, "run_dir": run_dir.relative_to(config.project_root).as_posix()}


def rerun(config, workflow_id: str, run_id: str, *, from_node: str, run_name: str | None, note: str | None) -> dict[str, Any]:
    run_dir, state = rerun_workflow(
        config=config,
        old_run_arg=f"{config.runs_dir}/{workflow_id}/{run_id}",
        from_node=from_node,
        run_id=run_name,
        note=note,
    )
    return {"run_id": run_dir.name, "status": state.status, "run_dir": run_dir.relative_to(config.project_root).as_posix()}


def get_run_detail(config, workflow_id: str, run_id: str) -> dict[str, Any]:
    run_dir, meta, state, bundle, node_catalog, workflow_source_dir = read_run_bundle(config, workflow_id, run_id)
    outputs = [
        {
            "name": name,
            "path": value,
            "previewable": _is_previewable_output(run_dir / value),
            "size": (run_dir / value).stat().st_size if (run_dir / value).exists() else 0,
        }
        for name, value in state.get("outputs", {}).items()
    ]
    return {
        "meta": meta,
        "state": state,
        "graph": build_graph(bundle, state=state),
        "outputs": outputs,
        "workflow_source_dir": workflow_source_dir.relative_to(config.project_root).as_posix(),
        "snapshot_dir": (run_dir / "workflow_snapshot").relative_to(config.project_root).as_posix()
        if (run_dir / "workflow_snapshot").is_dir()
        else None,
    }


def get_run_node_detail(config, workflow_id: str, run_id: str, node_id: str) -> dict[str, Any]:
    run_dir, _meta, state, bundle, node_catalog, _workflow_source_dir = read_run_bundle(config, workflow_id, run_id)
    node = bundle.nodes_by_id.get(node_id)
    if node is None:
        raise CliUsageError(f"node not found: {node_id}")
    latest_files = latest_attempt_files(run_dir, node_catalog, node_id)
    trace = {
        "attempt": state.get("node_attempts", {}).get(node_id, 0),
        "input": build_node_input_preview(run_dir, node),
        "prompt": _read_text(latest_files.get("prompt")),
        "stdout": _read_text(latest_files.get("stdout")),
        "stderr": _read_text(latest_files.get("stderr")),
        "output": build_node_output_preview(run_dir, state, node, latest_files),
        "route_selected": build_router_selection(run_dir, node_id) if node.type == "router" else None,
    }
    return {
        "node": {
            "id": node.id,
            "type": node.type,
            "name": node.name,
            "produces": node.produces,
            "next": node.next,
        },
        "source": {
            "path": node.path.relative_to(config.project_root).as_posix(),
            "content": node.path.read_text(encoding="utf-8"),
        },
        "trace": trace,
    }


def build_node_input_preview(run_dir: Path, node) -> str | None:
    if node.type == "llm":
        chunks: list[str] = []
        for name, stream in extract_references(node.body):
            chunks.append(f"## {name}.{stream}\n{_read_ref_trace(run_dir, name, stream)}")
        for file_ref in extract_file_references(node.body):
            chunks.append(f"## file:{file_ref}\n{resolve_safe_child(run_dir, file_ref).read_text(encoding='utf-8', errors='replace')}")
        return "\n\n".join(chunks) if chunks else None
    if node.type == "script" and node.exec is not None:
        return " ".join(node.exec.args)
    return None


def build_node_output_preview(run_dir: Path, state: dict[str, Any], node, latest_files: dict[str, Path]) -> str | None:
    if node.produces and node.produces in state.get("outputs", {}):
        output_path = run_dir / state["outputs"][node.produces]
        if output_path.exists() and _is_previewable_output(output_path):
            return output_path.read_text(encoding="utf-8", errors="replace")
    if node.type == "llm":
        return _read_text(latest_files.get("stdout"))
    if node.type == "script":
        return _read_text(latest_files.get("stdout"))
    return None


def build_router_selection(run_dir: Path, node_id: str) -> dict[str, Any] | None:
    trace = read_json(run_dir / "trace" / "trace.json")
    matches = [event for event in trace.get("events", []) if event.get("type") == "router_selected" and event.get("node_id") == node_id]
    if not matches:
        return None
    event = matches[-1]
    return {
        "selected_next": event.get("selected_next"),
        "route_source": event.get("route_source"),
        "route_operator": event.get("route_operator"),
    }


def _read_ref_trace(run_dir: Path, name: str, stream: str) -> str:
    if name == "initial" and stream == "stdout":
        path = run_dir / "trace" / "00_initial.stdout.txt"
        return _read_text(path) or ""
    trace_dir = run_dir / "trace"
    matches = sorted(trace_dir.glob(f"*_{name}.attempt-*.{stream}.txt"))
    if matches:
        return _read_text(matches[-1]) or ""
    legacy = sorted(trace_dir.glob(f"*_{name}.{stream}.txt"))
    return _read_text(legacy[-1]) if legacy else ""


def _read_text(path: Path | None) -> str | None:
    if path is None or not path.exists():
        return None
    return path.read_text(encoding="utf-8", errors="replace")


def _is_previewable_output(path: Path) -> bool:
    return path.suffix.lower() in {".md", ".txt", ".cpp", ".py", ".json", ".yaml", ".yml"}
