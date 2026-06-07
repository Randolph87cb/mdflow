from __future__ import annotations

import argparse
from pathlib import Path

from mdflow.config import find_project_root, load_project_config
from mdflow.errors import CliUsageError, ValidationError
from mdflow.resolver import resolve_input_file, resolve_run_dir, resolve_workflow_dir
from mdflow.runner import execute_run, make_run_id
from mdflow.trace import read_json
from mdflow.validator import load_and_validate_workflow, validate_project_config


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="mdflow")
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("workflow")

    run_parser = subparsers.add_parser("run")
    run_parser.add_argument("workflow", nargs="?")
    run_parser.add_argument("--input", required=True)
    run_parser.add_argument("--run-id")

    show_parser = subparsers.add_parser("show")
    show_parser.add_argument("run_dir")

    cat_parser = subparsers.add_parser("cat")
    cat_parser.add_argument("run_dir")
    cat_parser.add_argument("target")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        project_root = find_project_root(Path.cwd())
        config = load_project_config(project_root)
        validate_project_config(config)
        if args.command == "validate":
            return command_validate(config, args.workflow)
        if args.command == "run":
            return command_run(config, args.workflow, args.input, args.run_id)
        if args.command == "show":
            return command_show(config, args.run_dir)
        if args.command == "cat":
            return command_cat(config, args.run_dir, args.target)
    except CliUsageError as exc:
        print(f"ERROR: {exc}")
        return 2
    except ValidationError as exc:
        for message in exc.messages:
            print(message)
        return 1
    return 0


def command_validate(config, workflow_arg: str) -> int:
    workflow_id, workflow_dir, _rel = resolve_workflow_dir(config, workflow_arg)
    load_and_validate_workflow(config, workflow_dir)
    print(f"OK  workflow={workflow_id}")
    return 0


def command_run(config, workflow_arg: str | None, input_arg: str, run_id: str | None) -> int:
    workflow_id, workflow_dir, _rel = resolve_workflow_dir(config, workflow_arg)
    bundle, ordered_nodes = load_and_validate_workflow(config, workflow_dir)
    input_path, input_rel = resolve_input_file(config.project_root, input_arg)
    final_run_id = run_id or make_run_id()
    run_dir, state = execute_run(
        config=config,
        bundle=bundle,
        ordered_nodes=ordered_nodes,
        input_path=input_path,
        input_rel=input_rel,
        run_id=final_run_id,
    )
    if state.status == "success":
        print("RUN OK")
        print(f"workflow: {workflow_id}")
        print(f"run_id: {final_run_id}")
        print(f"run_dir: {run_dir.relative_to(config.project_root).as_posix()}")
        print("status: success")
        return 0
    print("RUN FAILED")
    print(f"workflow: {workflow_id}")
    print(f"run_id: {final_run_id}")
    print(f"run_dir: {run_dir.relative_to(config.project_root).as_posix()}")
    print(f"failed_node: {state.current_node}")
    print("status: failed")
    return 1


def command_show(config, run_arg: str) -> int:
    run_dir = resolve_run_dir(config.project_root, run_arg)
    meta = read_json(run_dir / "meta.json")
    state = read_json(run_dir / "state.json")
    print(f"workflow: {meta['workflow_id']}")
    print(f"run_id: {meta['run_id']}")
    print(f"status: {state['status']}")
    current_node = "null" if state["current_node"] is None else state["current_node"]
    print(f"current_node: {current_node}")
    print("completed_nodes:")
    for node_id in state["completed_nodes"]:
        print(f"- {node_id}")
    print("outputs:")
    for name, value in state["outputs"].items():
        print(f"- {name} -> {value}")
    return 0


def command_cat(config, run_arg: str, target: str) -> int:
    run_dir = resolve_run_dir(config.project_root, run_arg)
    if target == "initial.stdout":
        print((run_dir / "trace" / "00_initial.stdout.txt").read_text(encoding="utf-8"), end="")
        return 0
    if target.startswith("output:"):
        output_name = target.split(":", 1)[1]
        state = read_json(run_dir / "state.json")
        if output_name not in state["outputs"]:
            print(f"CAT FAILED\ntarget: {target}\nreason: target file not found")
            return 1
        print((run_dir / state["outputs"][output_name]).read_text(encoding="utf-8"), end="")
        return 0
    node_id, stream = _parse_node_target(target)
    if stream not in {"stdout", "stderr"}:
        print(f"CAT FAILED\ntarget: {target}\nreason: invalid target")
        return 1
    matches = sorted((run_dir / "trace").glob(f"*_{node_id}.{stream}.txt"))
    if not matches:
        print(f"CAT FAILED\ntarget: {target}\nreason: target file not found")
        return 1
    print(matches[0].read_text(encoding="utf-8"), end="")
    return 0


def _parse_node_target(target: str) -> tuple[str, str]:
    if "." not in target:
        return target, ""
    node_id, stream = target.rsplit(".", 1)
    return node_id, stream


if __name__ == "__main__":
    raise SystemExit(main())
