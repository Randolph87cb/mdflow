from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from mdflow.errors import CliUsageError
from mdflow.models import NodeSpec, ProjectConfig

REFERENCE_PATTERN = re.compile(r"\{\{\s*(initial|[A-Za-z0-9_-]+)\.(stdout|stderr)\s*\}\}")
INTERPRETER_PROGRAMS = {"python", "python.exe", "py", "node", "node.exe"}


def resolve_workflow_dir(config: ProjectConfig, workflow_arg: str | None) -> tuple[str, Path, Path]:
    workflow_name = workflow_arg or config.default_workflow
    candidate = Path(workflow_name)
    if candidate.is_absolute():
        workflow_dir = candidate
    else:
        direct_candidate = (config.project_root / candidate).resolve()
        if direct_candidate.is_dir():
            workflow_dir = direct_candidate
        else:
            workflow_dir = (config.project_root / config.workflows_dir / workflow_name).resolve()
    if not workflow_dir.is_dir():
        raise CliUsageError(f"workflow not found: {workflow_name}")
    workflow_id = workflow_dir.name
    workflow_rel = workflow_dir.relative_to(config.project_root)
    return workflow_id, workflow_dir, workflow_rel


def resolve_input_file(project_root: Path, input_arg: str) -> tuple[Path, Path]:
    input_path = Path(input_arg)
    if not input_path.is_absolute():
        input_path = (project_root / input_path).resolve()
    else:
        input_path = input_path.resolve()
    if not input_path.is_file():
        raise CliUsageError(f"input file not found: {input_arg}")
    try:
        rel = input_path.relative_to(project_root)
    except ValueError as exc:
        raise CliUsageError("input file must be inside the project root") from exc
    return input_path, rel


def resolve_run_dir(project_root: Path, run_arg: str) -> Path:
    run_path = Path(run_arg)
    if not run_path.is_absolute():
        run_path = (project_root / run_path).resolve()
    else:
        run_path = run_path.resolve()
    if not run_path.is_dir():
        raise CliUsageError(f"run directory not found: {run_arg}")
    return run_path


def merge_model_config(
    project_model: dict[str, object],
    workflow_model: dict[str, object],
    node_model: dict[str, object],
) -> dict[str, object]:
    merged: dict[str, object] = {}
    merged.update(project_model)
    merged.update(workflow_model)
    merged.update(node_model)
    return merged


def build_reachable_nodes(entry: str, nodes_by_id: dict[str, NodeSpec]) -> set[str]:
    reachable: set[str] = set()
    stack: list[str] = [entry]
    while stack:
        current_id = stack.pop()
        if current_id in reachable:
            continue
        reachable.add(current_id)
        node = nodes_by_id[current_id]
        for next_id in list_node_targets(node):
            if next_id is not None:
                stack.append(next_id)
    return reachable


def extract_references(text: str) -> list[tuple[str, str]]:
    refs = [(match.group(1), match.group(2)) for match in REFERENCE_PATTERN.finditer(text)]
    scrubbed = REFERENCE_PATTERN.sub("", text)
    if "{{" in scrubbed or "}}" in scrubbed:
        raise ValueError("unsupported template reference syntax")
    return refs


def ensure_relative_output_path(value: str, *, label: str) -> None:
    path = Path(value)
    if path.is_absolute():
        raise ValueError(f"{label} must not be an absolute path: {value}")
    if ".." in path.parts:
        raise ValueError(f"{label} must not contain '..': {value}")


def resolve_cwd(run_dir: Path, cwd_value: str) -> Path:
    cwd_path = (run_dir / cwd_value).resolve()
    ensure_within(run_dir, cwd_path, "exec.cwd")
    return cwd_path


def resolve_output_target(run_dir: Path, produces: str) -> Path:
    ensure_relative_output_path(produces, label="produces")
    return (run_dir / "outputs" / produces).resolve()


def ensure_within(base: Path, target: Path, label: str) -> None:
    try:
        target.relative_to(base.resolve())
    except ValueError as exc:
        raise ValueError(f"{label} escapes run directory: {target}") from exc


def is_workflow_script_arg(program: str, arg0: str) -> bool:
    program_name = Path(program).name.lower()
    candidate = Path(arg0)
    return (
        program_name in INTERPRETER_PROGRAMS
        and not candidate.is_absolute()
        and not arg0.startswith(("outputs/", "trace/"))
        and not REFERENCE_PATTERN.fullmatch(arg0)
        and ("/" in arg0 or "\\" in arg0 or candidate.suffix)
    )


def resolve_script_args(
    program: str,
    args: list[str],
    workflow_dir: Path,
    run_dir: Path,
    trace_lookup: dict[tuple[str, str], Path],
) -> list[str]:
    resolved: list[str] = []
    for index, arg in enumerate(args):
        ref_match = REFERENCE_PATTERN.fullmatch(arg)
        if ref_match:
            key = (ref_match.group(1), ref_match.group(2))
            resolved.append(str(trace_lookup[key]))
            continue
        if index == 0 and is_workflow_script_arg(program, arg):
            resolved.append(str((workflow_dir / arg).absolute()))
            continue
        if arg.startswith("outputs/") or arg.startswith("trace/"):
            resolved.append(str((run_dir / arg).absolute()))
            continue
        resolved.append(arg)
    return resolved


def render_prompt(text: str, trace_lookup: dict[tuple[str, str], Path]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = (match.group(1), match.group(2))
        return trace_lookup[key].read_text(encoding="utf-8")

    rendered = REFERENCE_PATTERN.sub(replace, text)
    if "{{" in rendered or "}}" in rendered:
        raise ValueError("unsupported template reference syntax")
    return rendered


def make_trace_lookup(run_dir: Path, ordered_nodes: Iterable[NodeSpec]) -> dict[tuple[str, str], Path]:
    lookup: dict[tuple[str, str], Path] = {("initial", "stdout"): run_dir / "trace" / "00_initial.stdout.txt"}
    for index, node in enumerate(ordered_nodes, start=1):
        prefix = f"{index:02d}_{node.id}"
        lookup[(node.id, "stdout")] = run_dir / "trace" / f"{prefix}.stdout.txt"
        lookup[(node.id, "stderr")] = run_dir / "trace" / f"{prefix}.stderr.txt"
    return lookup


def make_trace_prefix_map(ordered_nodes: Iterable[NodeSpec]) -> dict[str, str]:
    return {node.id: f"{index:02d}_{node.id}" for index, node in enumerate(ordered_nodes, start=1)}


def list_node_targets(node: NodeSpec) -> list[str]:
    targets: list[str] = []
    if node.type == "router":
        for route in node.routes:
            if route.next:
                targets.append(route.next)
        if node.default_next:
            targets.append(node.default_next)
        return targets
    if node.next:
        targets.append(node.next)
    return targets


def parse_route_source(source: str) -> tuple[str, str]:
    if "." not in source:
        raise ValueError(f"invalid route source '{source}'")
    node_id, field = source.rsplit(".", 1)
    return node_id, field
