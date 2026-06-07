from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from time import perf_counter

from mdflow.errors import RunFailure, ValidationError
from mdflow.executors.llm import run_llm_node
from mdflow.executors.script import run_script_node
from mdflow.models import ProjectConfig, RunMeta, RunState, TraceEvent, WorkflowBundle
from mdflow.resolver import (
    make_trace_lookup,
    make_trace_prefix_map,
    merge_model_config,
    render_prompt,
    resolve_cwd,
    resolve_output_target,
    resolve_script_args,
)
from mdflow.trace import append_trace_event, write_meta, write_state
from mdflow.validator import validate_project_config, validate_workflow_bundle


def execute_run(
    *,
    config: ProjectConfig,
    bundle: WorkflowBundle,
    ordered_nodes,
    input_path: Path,
    input_rel: Path,
    run_id: str,
) -> tuple[Path, RunState]:
    validate_project_config(config)
    validate_workflow_bundle(config, bundle)

    run_dir = (config.project_root / config.runs_dir / bundle.workflow.id / run_id).resolve()
    if run_dir.exists():
        raise ValidationError([f"run directory already exists: {run_dir}"])
    trace_dir = run_dir / "trace"
    outputs_dir = run_dir / "outputs"
    trace_dir.mkdir(parents=True)
    outputs_dir.mkdir(parents=True)

    now = timestamp_now()
    meta = RunMeta(
        run_id=run_id,
        workflow_id=bundle.workflow.id,
        workflow_dir=bundle.workflow.workflow_dir.relative_to(config.project_root).as_posix(),
        input_file=input_rel.as_posix(),
        entry_node=bundle.workflow.entry,
        started_at=now,
        finished_at=None,
        status="running",
    )
    state = RunState(
        run_id=run_id,
        workflow_id=bundle.workflow.id,
        status="running",
        current_node=bundle.workflow.entry,
        completed_nodes=[],
        outputs={},
    )
    write_meta(run_dir / "meta.json", meta)
    write_state(run_dir / "state.json", state)
    (trace_dir / "00_initial.stdout.txt").write_text(input_path.read_text(encoding="utf-8"), encoding="utf-8")

    trace_json = trace_dir / "trace.json"
    seq = 1
    append_trace_event(
        trace_json,
        TraceEvent(seq=seq, type="run_started", timestamp=timestamp_now(), payload={"run_id": run_id, "workflow_id": bundle.workflow.id}),
    )
    seq += 1

    trace_lookup = make_trace_lookup(run_dir, ordered_nodes)
    prefix_map = make_trace_prefix_map(ordered_nodes)
    last_node_id = ordered_nodes[-1].id if ordered_nodes else None

    try:
        for node in ordered_nodes:
            state.current_node = node.id
            write_state(run_dir / "state.json", state)
            append_trace_event(
                trace_json,
                TraceEvent(
                    seq=seq,
                    type="node_started",
                    timestamp=timestamp_now(),
                    payload={"node_id": node.id, "node_type": node.type},
                ),
            )
            seq += 1
            started = perf_counter()
            prefix = prefix_map[node.id]
            stdout_path = trace_dir / f"{prefix}.stdout.txt"
            stderr_path = trace_dir / f"{prefix}.stderr.txt"
            prompt_path = trace_dir / f"{prefix}.prompt.txt"
            stdout_text = ""
            stderr_text = ""

            try:
                if node.type == "llm":
                    prompt_text = render_prompt(node.body, trace_lookup)
                    prompt_path.write_text(prompt_text, encoding="utf-8")
                    resolved_model = merge_model_config(config.model, bundle.workflow.model, node.model)
                    provider_name = str(resolved_model.get("provider", ""))
                    provider_config = config.providers.get(provider_name, {})
                    stdout_text, stderr_text = run_llm_node(node, prompt_text, resolved_model, provider_config)
                else:
                    assert node.exec is not None
                    cwd = resolve_cwd(run_dir, node.exec.cwd)
                    resolved_args = resolve_script_args(
                        node.exec.program,
                        node.exec.args,
                        bundle.workflow.workflow_dir,
                        run_dir,
                        trace_lookup,
                    )
                    stdout_text, stderr_text = run_script_node(
                        program=node.exec.program,
                        args=resolved_args,
                        cwd=str(cwd),
                        timeout_sec=node.exec.timeout_sec,
                    )
            except RunFailure as exc:
                failure_stdout = stdout_text or exc.stdout
                failure_stderr = stderr_text or exc.stderr
                stdout_path.write_text(failure_stdout, encoding="utf-8")
                stderr_message = failure_stderr
                if exc.message:
                    if stderr_message and not stderr_message.endswith("\n"):
                        stderr_message += "\n"
                    stderr_message += exc.message
                stderr_path.write_text(stderr_message.strip(), encoding="utf-8")
                duration_ms = elapsed_ms(started)
                state.status = "failed"
                state.current_node = node.id
                write_state(run_dir / "state.json", state)
                append_trace_event(
                    trace_json,
                    TraceEvent(
                        seq=seq,
                        type="node_failed",
                        timestamp=timestamp_now(),
                        payload=_failure_payload(node.id, node.type, duration_ms, exc),
                    ),
                )
                seq += 1
                append_trace_event(
                    trace_json,
                    TraceEvent(
                        seq=seq,
                        type="run_failed",
                        timestamp=timestamp_now(),
                        payload={"run_id": run_id, "workflow_id": bundle.workflow.id, "failed_node": node.id},
                    ),
                )
                meta.finished_at = timestamp_now()
                meta.status = "failed"
                write_meta(run_dir / "meta.json", meta)
                return run_dir, state

            stdout_path.write_text(stdout_text, encoding="utf-8")
            stderr_path.write_text(stderr_text, encoding="utf-8")

            if node.produces:
                _register_node_output(run_dir, node.type, node.produces, stdout_path, state)

            state.completed_nodes.append(node.id)
            state.current_node = node.next
            write_state(run_dir / "state.json", state)
            append_trace_event(
                trace_json,
                TraceEvent(
                    seq=seq,
                    type="node_succeeded",
                    timestamp=timestamp_now(),
                    payload=_success_payload(node.id, node.type, elapsed_ms(started), node.produces),
                ),
            )
            seq += 1

        missing_outputs = [name for name in bundle.workflow.final_outputs if name not in state.outputs]
        if missing_outputs and last_node_id is not None:
            raise RunFailure(
                last_node_id,
                f"Missing final outputs: {', '.join(missing_outputs)}",
                error_type="missing_output",
            )
    except RunFailure as exc:
        if exc.error_type == "missing_output":
            append_trace_event(
                trace_json,
                TraceEvent(
                    seq=seq,
                    type="node_failed",
                    timestamp=timestamp_now(),
                    payload=_failure_payload(exc.node_id, bundle.nodes_by_id[exc.node_id].type, 0, exc),
                ),
            )
            seq += 1
            append_trace_event(
                trace_json,
                TraceEvent(
                    seq=seq,
                    type="run_failed",
                    timestamp=timestamp_now(),
                    payload={"run_id": run_id, "workflow_id": bundle.workflow.id, "failed_node": exc.node_id},
                ),
            )
            state.status = "failed"
            state.current_node = exc.node_id
            meta.finished_at = timestamp_now()
            meta.status = "failed"
            write_state(run_dir / "state.json", state)
            write_meta(run_dir / "meta.json", meta)
        return run_dir, state

    state.status = "success"
    state.current_node = None
    write_state(run_dir / "state.json", state)
    append_trace_event(
        trace_json,
        TraceEvent(
            seq=seq,
            type="run_succeeded",
            timestamp=timestamp_now(),
            payload={
                "run_id": run_id,
                "workflow_id": bundle.workflow.id,
                "duration_ms": 0,
            },
        ),
    )
    meta.finished_at = timestamp_now()
    meta.status = "success"
    write_meta(run_dir / "meta.json", meta)
    return run_dir, state


def timestamp_now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def make_run_id() -> str:
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def elapsed_ms(started: float) -> int:
    return int((perf_counter() - started) * 1000)


def _success_payload(node_id: str, node_type: str, duration_ms: int, produces: str | None) -> dict[str, object]:
    payload: dict[str, object] = {
        "node_id": node_id,
        "node_type": node_type,
        "duration_ms": duration_ms,
    }
    if produces:
        payload["produces"] = produces
    return payload


def _failure_payload(node_id: str, node_type: str, duration_ms: int, exc: RunFailure) -> dict[str, object]:
    payload: dict[str, object] = {
        "node_id": node_id,
        "node_type": node_type,
        "duration_ms": duration_ms,
        "error_type": exc.error_type,
        "message": exc.message,
    }
    if exc.returncode is not None:
        payload["returncode"] = exc.returncode
    if exc.timeout_sec is not None:
        payload["timeout_sec"] = exc.timeout_sec
    return payload


def _register_node_output(
    run_dir: Path,
    node_type: str,
    produces: str,
    stdout_path: Path,
    state: RunState,
) -> None:
    run_root = run_dir.resolve()
    output_target = resolve_output_target(run_root, produces)
    if node_type == "script" and output_target.exists():
        state.outputs[produces] = output_target.relative_to(run_root).as_posix()
        return
    output_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(stdout_path, output_target)
    state.outputs[produces] = output_target.relative_to(run_root).as_posix()
