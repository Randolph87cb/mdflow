from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Any

from mdflow.errors import RunFailure, ValidationError
from mdflow.executors.llm import run_llm_node
from mdflow.executors.script import run_script_node
from mdflow.models import NodeSpec, ProjectConfig, RunMeta, RunState, RouteSpec, TraceEvent, WorkflowBundle
from mdflow.resolver import (
    make_trace_prefix_map,
    merge_model_config,
    parse_route_source,
    render_prompt,
    resolve_cwd,
    resolve_output_target,
    resolve_script_args,
)
from mdflow.trace import append_trace_event, list_output_index, write_meta, write_state
from mdflow.validator import validate_project_config, validate_workflow_bundle


def execute_run(
    *,
    config: ProjectConfig,
    bundle: WorkflowBundle,
    node_catalog,
    input_path: Path,
    input_rel: Path,
    run_id: str,
    start_node_id: str | None = None,
    source_run_dir: Path | None = None,
    initial_outputs_dir: Path | None = None,
    initial_completed_nodes: list[str] | None = None,
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

    if initial_outputs_dir is not None and initial_outputs_dir.exists():
        _copy_directory_contents(initial_outputs_dir, outputs_dir)

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
        source_run_id=source_run_dir.name if source_run_dir is not None else None,
        source_run_dir=source_run_dir.relative_to(config.project_root).as_posix() if source_run_dir is not None else None,
        rerun_from_node=start_node_id if source_run_dir is not None else None,
    )
    state = RunState(
        run_id=run_id,
        workflow_id=bundle.workflow.id,
        status="running",
        current_node=start_node_id or bundle.workflow.entry,
        completed_nodes=list(initial_completed_nodes or []),
        outputs=list_output_index(outputs_dir, run_dir),
        node_attempts={},
        last_failure=None,
    )
    write_meta(run_dir / "meta.json", meta)
    write_state(run_dir / "state.json", state)

    initial_trace_path = trace_dir / "00_initial.stdout.txt"
    if input_path.resolve() != initial_trace_path.resolve():
        shutil.copyfile(input_path, initial_trace_path)
    else:
        initial_trace_path.write_text(input_path.read_text(encoding="utf-8"), encoding="utf-8")

    trace_json = trace_dir / "trace.json"
    seq = 1
    append_trace_event(
        trace_json,
        TraceEvent(seq=seq, type="run_started", timestamp=timestamp_now(), payload={"run_id": run_id, "workflow_id": bundle.workflow.id}),
    )
    seq += 1
    if source_run_dir is not None:
        append_trace_event(
            trace_json,
            TraceEvent(
                seq=seq,
                type="run_rerun_started",
                timestamp=timestamp_now(),
                payload={
                    "run_id": run_id,
                    "workflow_id": bundle.workflow.id,
                    "source_run_id": source_run_dir.name,
                    "rerun_from_node": start_node_id,
                },
            ),
        )
        seq += 1

    nodes_by_id = bundle.nodes_by_id
    prefix_map = make_trace_prefix_map(node_catalog)
    trace_lookup: dict[tuple[str, str], Path] = {("initial", "stdout"): initial_trace_path}
    runtime_results: dict[str, dict[str, Any]] = {}
    _seed_completed_nodes_from_outputs(
        run_dir=run_dir,
        trace_dir=trace_dir,
        source_run_dir=source_run_dir,
        completed_nodes=state.completed_nodes,
        nodes_by_id=nodes_by_id,
        prefix_map=prefix_map,
        state=state,
        trace_lookup=trace_lookup,
        runtime_results=runtime_results,
    )

    current_node_id = start_node_id or bundle.workflow.entry
    last_node_id = current_node_id
    while current_node_id is not None:
        node = nodes_by_id[current_node_id]
        last_node_id = node.id
        if node.type == "router":
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
            selected_next, route = _evaluate_router(node, runtime_results)
            if selected_next is None:
                return _fail_run(
                    run_dir=run_dir,
                    trace_json=trace_json,
                    meta=meta,
                    state=state,
                    seq=seq,
                    node=node,
                    exc=RunFailure(node.id, "router did not match any route", error_type="router_no_match"),
                    duration_ms=0,
                )
            append_trace_event(
                trace_json,
                TraceEvent(
                    seq=seq,
                    type="router_selected",
                    timestamp=timestamp_now(),
                    payload={
                        "node_id": node.id,
                        "selected_next": selected_next,
                        "route_source": route.source if route is not None else None,
                        "route_operator": route.operator if route is not None else None,
                    },
                ),
            )
            seq += 1
            _mark_node_completed(state, node.id)
            runtime_results[node.id] = {
                "status": "success",
                "returncode": None,
                "stdout_path": None,
                "stderr_path": None,
                "attempts": state.node_attempts.get(node.id, 0),
            }
            state.current_node = selected_next
            write_state(run_dir / "state.json", state)
            append_trace_event(
                trace_json,
                TraceEvent(
                    seq=seq,
                    type="node_succeeded",
                    timestamp=timestamp_now(),
                    payload=_success_payload(node.id, node.type, 0, None, None),
                ),
            )
            seq += 1
            current_node_id = selected_next
            continue

        max_attempts = node.retry.max_attempts if node.retry is not None else 1
        visit_attempt = 0
        while True:
            visit_attempt += 1
            attempt = state.node_attempts.get(node.id, 0) + 1
            state.node_attempts[node.id] = attempt
            state.current_node = node.id
            write_state(run_dir / "state.json", state)
            append_trace_event(
                trace_json,
                TraceEvent(
                    seq=seq,
                    type="node_started",
                    timestamp=timestamp_now(),
                    payload={"node_id": node.id, "node_type": node.type, "attempt": attempt},
                ),
            )
            seq += 1

            started = perf_counter()
            prefix = prefix_map[node.id]
            attempt_label = f"attempt-{attempt:02d}"
            stdout_path = trace_dir / f"{prefix}.{attempt_label}.stdout.txt"
            stderr_path = trace_dir / f"{prefix}.{attempt_label}.stderr.txt"
            prompt_path = trace_dir / f"{prefix}.{attempt_label}.prompt.txt"
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
                trace_lookup[(node.id, "stdout")] = stdout_path
                trace_lookup[(node.id, "stderr")] = stderr_path
                runtime_results[node.id] = {
                    "status": "failed",
                    "returncode": exc.returncode,
                    "stdout_path": stdout_path,
                    "stderr_path": stderr_path,
                    "attempts": attempt,
                }
                state.last_failure = {
                    "node_id": node.id,
                    "error_type": exc.error_type,
                    "message": exc.message,
                }
                duration_ms = elapsed_ms(started)
                write_state(run_dir / "state.json", state)
                append_trace_event(
                    trace_json,
                    TraceEvent(
                        seq=seq,
                        type="node_failed",
                        timestamp=timestamp_now(),
                        payload=_failure_payload(node.id, node.type, duration_ms, exc, attempt),
                    ),
                )
                seq += 1
                if visit_attempt < max_attempts:
                    append_trace_event(
                        trace_json,
                        TraceEvent(
                            seq=seq,
                            type="node_retry_scheduled",
                            timestamp=timestamp_now(),
                            payload={"node_id": node.id, "next_attempt": attempt + 1, "max_attempts": max_attempts},
                        ),
                    )
                    seq += 1
                    continue
                if _should_route_after_failure(node, nodes_by_id):
                    state.current_node = node.next
                    write_state(run_dir / "state.json", state)
                    current_node_id = node.next
                    break
                return _fail_run(
                    run_dir=run_dir,
                    trace_json=trace_json,
                    meta=meta,
                    state=state,
                    seq=seq,
                    node=node,
                    exc=exc,
                    duration_ms=duration_ms,
                    failure_already_recorded=True,
                )

            stdout_path.write_text(stdout_text, encoding="utf-8")
            stderr_path.write_text(stderr_text, encoding="utf-8")
            trace_lookup[(node.id, "stdout")] = stdout_path
            trace_lookup[(node.id, "stderr")] = stderr_path
            runtime_results[node.id] = {
                "status": "success",
                "returncode": 0,
                "stdout_path": stdout_path,
                "stderr_path": stderr_path,
                "attempts": attempt,
            }
            state.last_failure = None

            if node.produces:
                _register_node_output(run_dir, node.type, node.produces, stdout_path, state)

            _mark_node_completed(state, node.id)
            state.current_node = node.next
            write_state(run_dir / "state.json", state)
            append_trace_event(
                trace_json,
                TraceEvent(
                    seq=seq,
                    type="node_succeeded",
                    timestamp=timestamp_now(),
                    payload=_success_payload(node.id, node.type, elapsed_ms(started), node.produces, attempt),
                ),
            )
            seq += 1
            current_node_id = node.next
            break

    missing_outputs = [name for name in bundle.workflow.final_outputs if name not in state.outputs]
    if missing_outputs and last_node_id is not None:
        return _fail_run(
            run_dir=run_dir,
            trace_json=trace_json,
            meta=meta,
            state=state,
            seq=seq,
            node=nodes_by_id[last_node_id],
            exc=RunFailure(last_node_id, f"Missing final outputs: {', '.join(missing_outputs)}", error_type="missing_output"),
            duration_ms=0,
        )

    state.status = "success"
    state.current_node = None
    write_state(run_dir / "state.json", state)
    append_trace_event(
        trace_json,
        TraceEvent(
            seq=seq,
            type="run_succeeded",
            timestamp=timestamp_now(),
            payload={"run_id": run_id, "workflow_id": bundle.workflow.id, "duration_ms": 0},
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


def _success_payload(node_id: str, node_type: str, duration_ms: int, produces: str | None, attempt: int | None) -> dict[str, object]:
    payload: dict[str, object] = {
        "node_id": node_id,
        "node_type": node_type,
        "duration_ms": duration_ms,
    }
    if produces:
        payload["produces"] = produces
    if attempt is not None:
        payload["attempt"] = attempt
    return payload


def _failure_payload(node_id: str, node_type: str, duration_ms: int, exc: RunFailure, attempt: int | None) -> dict[str, object]:
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
    if attempt is not None:
        payload["attempt"] = attempt
    return payload


def _register_node_output(run_dir: Path, node_type: str, produces: str, stdout_path: Path, state: RunState) -> None:
    run_root = run_dir.resolve()
    output_target = resolve_output_target(run_root, produces)
    if node_type == "script" and output_target.exists():
        state.outputs[produces] = output_target.relative_to(run_root).as_posix()
        return
    output_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(stdout_path, output_target)
    state.outputs[produces] = output_target.relative_to(run_root).as_posix()


def _evaluate_router(node: NodeSpec, runtime_results: dict[str, dict[str, Any]]) -> tuple[str | None, RouteSpec | None]:
    for route in node.routes:
        if _route_matches(route, runtime_results):
            return route.next, route
    return node.default_next, None


def _route_matches(route: RouteSpec, runtime_results: dict[str, dict[str, Any]]) -> bool:
    source_node_id, source_field = parse_route_source(route.source)
    result = runtime_results.get(source_node_id)
    if result is None:
        return False
    actual = _read_route_actual(result, source_field)
    if route.operator == "equals":
        return str(actual) == str(route.value)
    if route.operator == "contains":
        return str(route.value) in str(actual)
    if route.operator == "regex":
        return re.search(str(route.value), str(actual)) is not None
    if route.operator == "gte":
        try:
            return int(actual) >= int(route.value)
        except (TypeError, ValueError):
            return False
    return False


def _read_route_actual(result: dict[str, Any], source_field: str) -> object:
    if source_field in {"status", "returncode", "attempts"}:
        return result.get(source_field)
    if source_field in {"stdout", "stderr"}:
        path = result.get(f"{source_field}_path")
        if isinstance(path, Path) and path.exists():
            return path.read_text(encoding="utf-8", errors="replace")
        return ""
    return None


def _fail_run(
    *,
    run_dir: Path,
    trace_json: Path,
    meta: RunMeta,
    state: RunState,
    seq: int,
    node: NodeSpec,
    exc: RunFailure,
    duration_ms: int,
    failure_already_recorded: bool = False,
) -> tuple[Path, RunState]:
    if not failure_already_recorded:
        append_trace_event(
            trace_json,
            TraceEvent(
                seq=seq,
                type="node_failed",
                timestamp=timestamp_now(),
                payload=_failure_payload(node.id, node.type, duration_ms, exc, state.node_attempts.get(node.id)),
            ),
        )
        seq += 1
    append_trace_event(
        trace_json,
        TraceEvent(
            seq=seq,
            type="run_failed",
            timestamp=timestamp_now(),
            payload={"run_id": meta.run_id, "workflow_id": meta.workflow_id, "failed_node": node.id},
        ),
    )
    state.status = "failed"
    state.current_node = node.id
    state.last_failure = {
        "node_id": node.id,
        "error_type": exc.error_type,
        "message": exc.message,
    }
    meta.finished_at = timestamp_now()
    meta.status = "failed"
    write_state(run_dir / "state.json", state)
    write_meta(run_dir / "meta.json", meta)
    return run_dir, state


def _copy_directory_contents(source_dir: Path, target_dir: Path) -> None:
    for source_path in sorted(source_dir.rglob("*")):
        relative = source_path.relative_to(source_dir)
        target_path = target_dir / relative
        if source_path.is_dir():
            target_path.mkdir(parents=True, exist_ok=True)
            continue
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, target_path)


def _seed_completed_nodes_from_outputs(
    *,
    run_dir: Path,
    trace_dir: Path,
    source_run_dir: Path | None,
    completed_nodes: list[str],
    nodes_by_id: dict[str, NodeSpec],
    prefix_map: dict[str, str],
    state: RunState,
    trace_lookup: dict[tuple[str, str], Path],
    runtime_results: dict[str, dict[str, Any]],
) -> None:
    source_trace_dir = source_run_dir / "trace" if source_run_dir is not None else None
    for node_id in completed_nodes:
        node = nodes_by_id.get(node_id)
        if node is None:
            continue
        stdout_seed: Path | None = None
        stderr_seed = trace_dir / f"{prefix_map[node_id]}.attempt-00.stderr.txt"
        source_stderr = _find_latest_trace_stream(source_trace_dir, prefix_map[node_id], "stderr")
        if source_stderr is not None:
            shutil.copyfile(source_stderr, stderr_seed)
        elif not stderr_seed.exists():
            stderr_seed.write_text("", encoding="utf-8")
        if node.produces and node.produces in state.outputs:
            output_path = run_dir / state.outputs[node.produces]
            stdout_seed = trace_dir / f"{prefix_map[node_id]}.attempt-00.stdout.txt"
            stdout_seed.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(output_path, stdout_seed)
            trace_lookup[(node_id, "stdout")] = stdout_seed
        else:
            source_stdout = _find_latest_trace_stream(source_trace_dir, prefix_map[node_id], "stdout")
            if source_stdout is not None:
                stdout_seed = trace_dir / f"{prefix_map[node_id]}.attempt-00.stdout.txt"
                stdout_seed.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source_stdout, stdout_seed)
                trace_lookup[(node_id, "stdout")] = stdout_seed
        trace_lookup[(node_id, "stderr")] = stderr_seed
        runtime_results[node_id] = {
            "status": "success",
            "returncode": 0,
            "stdout_path": stdout_seed,
            "stderr_path": stderr_seed,
            "attempts": 0,
        }


def _find_latest_trace_stream(source_trace_dir: Path | None, prefix: str, stream: str) -> Path | None:
    if source_trace_dir is None or not source_trace_dir.is_dir():
        return None
    matches = sorted(source_trace_dir.glob(f"{prefix}.attempt-*.{stream}.txt"))
    if matches:
        return matches[-1]
    legacy = source_trace_dir / f"{prefix}.{stream}.txt"
    if legacy.exists():
        return legacy
    return None


def _mark_node_completed(state: RunState, node_id: str) -> None:
    if node_id not in state.completed_nodes:
        state.completed_nodes.append(node_id)


def _should_route_after_failure(node: NodeSpec, nodes_by_id: dict[str, NodeSpec]) -> bool:
    if not node.next:
        return False
    next_node = nodes_by_id.get(node.next)
    return next_node is not None and next_node.type == "router"
