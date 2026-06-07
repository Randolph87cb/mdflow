from __future__ import annotations

import re
import shutil
from pathlib import Path

from mdflow.errors import CliUsageError, ValidationError
from mdflow.models import ProjectConfig, RunState
from mdflow.resolver import resolve_input_file, resolve_run_dir, resolve_workflow_dir
from mdflow.runner import execute_run, make_run_id
from mdflow.trace import read_json
from mdflow.validator import load_and_validate_workflow

RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def run_workflow(
    *,
    config: ProjectConfig,
    workflow_arg: str | None,
    input_mode: str,
    input_text: str | None = None,
    input_file_arg: str | None = None,
    run_id: str | None = None,
    note: str | None = None,
) -> tuple[Path, RunState]:
    workflow_id, workflow_dir, workflow_rel = resolve_workflow_dir(config, workflow_arg)
    bundle, node_catalog = load_and_validate_workflow(config, workflow_dir)
    final_run_id = validate_or_generate_run_id(run_id)
    run_dir = prepare_run_dir(config, bundle.workflow.id, final_run_id)
    trace_dir = run_dir / "trace"
    outputs_dir = run_dir / "outputs"
    trace_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    input_path, input_source = prepare_run_input(
        config=config,
        run_dir=run_dir,
        input_mode=input_mode,
        input_text=input_text,
        input_file_arg=input_file_arg,
    )
    snapshot_dir = create_workflow_snapshot(workflow_dir, run_dir)
    snapshot_bundle, snapshot_catalog = load_and_validate_workflow(config, snapshot_dir)
    input_rel = input_path.relative_to(config.project_root)

    return execute_run(
        config=config,
        bundle=snapshot_bundle,
        node_catalog=snapshot_catalog,
        input_path=input_path,
        input_rel=input_rel,
        input_source=input_source,
        run_id=final_run_id,
        prepared_run_dir=run_dir,
        workflow_source_rel=workflow_rel,
        note=note,
    )


def rerun_workflow(
    *,
    config: ProjectConfig,
    old_run_arg: str,
    from_node: str,
    run_id: str | None = None,
    note: str | None = None,
) -> tuple[Path, RunState]:
    old_run_dir = resolve_run_dir(config.project_root, old_run_arg)
    old_meta = read_json(old_run_dir / "meta.json")
    old_state = read_json(old_run_dir / "state.json")
    workflow_dir = (config.project_root / str(old_meta["workflow_dir"])).resolve()
    bundle, node_catalog = load_and_validate_workflow(config, workflow_dir)
    if from_node not in bundle.nodes_by_id:
        raise CliUsageError(f"rerun start node not found: {from_node}")

    final_run_id = validate_or_generate_run_id(run_id)
    run_dir = prepare_run_dir(config, bundle.workflow.id, final_run_id)
    trace_dir = run_dir / "trace"
    outputs_dir = run_dir / "outputs"
    trace_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    shutil.copytree(old_run_dir / "outputs", outputs_dir, dirs_exist_ok=True)
    input_path = run_dir / "input.md"
    old_input_path = old_run_dir / "input.md"
    if old_input_path.is_file():
        shutil.copyfile(old_input_path, input_path)
    else:
        legacy_initial = old_run_dir / "trace" / "00_initial.stdout.txt"
        if not legacy_initial.is_file():
            raise CliUsageError("source run does not contain input.md or trace/00_initial.stdout.txt")
        shutil.copyfile(legacy_initial, input_path)
    input_source = dict(old_meta.get("input_source", {"mode": "rerun"}))
    snapshot_dir = create_workflow_snapshot(workflow_dir, run_dir)
    snapshot_bundle, snapshot_catalog = load_and_validate_workflow(config, snapshot_dir)

    node_order = {node.id: index for index, node in enumerate(snapshot_catalog)}
    start_index = node_order[from_node]
    initial_completed_nodes = [
        node_id
        for node_id in old_state.get("completed_nodes", [])
        if node_id in node_order and node_order[node_id] < start_index
    ]

    return execute_run(
        config=config,
        bundle=snapshot_bundle,
        node_catalog=snapshot_catalog,
        input_path=input_path,
        input_rel=input_path.relative_to(config.project_root),
        input_source=input_source,
        run_id=final_run_id,
        start_node_id=from_node,
        source_run_dir=old_run_dir,
        initial_outputs_dir=old_run_dir / "outputs",
        initial_completed_nodes=initial_completed_nodes,
        prepared_run_dir=run_dir,
        workflow_source_rel=workflow_dir.relative_to(config.project_root),
        note=note,
    )


def prepare_run_dir(config: ProjectConfig, workflow_id: str, run_id: str) -> Path:
    run_dir = (config.project_root / config.runs_dir / workflow_id / run_id).resolve()
    if run_dir.exists():
        raise ValidationError([f"run directory already exists: {run_dir}"])
    return run_dir


def prepare_run_input(
    *,
    config: ProjectConfig,
    run_dir: Path,
    input_mode: str,
    input_text: str | None,
    input_file_arg: str | None,
) -> tuple[Path, dict[str, object]]:
    input_path = run_dir / "input.md"
    if input_mode == "text":
        input_path.write_text(input_text or "", encoding="utf-8")
        return input_path, {"mode": "text"}
    if input_mode == "file":
        if not input_file_arg:
            raise CliUsageError("input file is required when input_mode=file")
        source_path, source_rel = resolve_input_file(config.project_root, input_file_arg)
        shutil.copyfile(source_path, input_path)
        return input_path, {"mode": "file", "path": source_rel.as_posix()}
    raise CliUsageError(f"unsupported input mode: {input_mode}")


def create_workflow_snapshot(workflow_dir: Path, run_dir: Path) -> Path:
    snapshot_dir = run_dir / "workflow_snapshot"
    shutil.copytree(workflow_dir, snapshot_dir)
    return snapshot_dir


def validate_or_generate_run_id(run_id: str | None) -> str:
    final_run_id = run_id or make_run_id()
    if not RUN_ID_PATTERN.fullmatch(final_run_id):
        raise CliUsageError("run id must contain only letters, numbers, underscores, and hyphens")
    return final_run_id
