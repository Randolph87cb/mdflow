from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from mdflow.models import RunState
from mdflow.runtime import derive_rerun_completed_nodes
from mdflow.runner import _register_node_output


class RunnerTests(unittest.TestCase):
    def test_derive_rerun_completed_nodes_uses_actual_completed_prefix(self) -> None:
        old_state = {
            "completed_nodes": ["generate_statement", "generate_std", "build_and_run_std", "route_std_result", "generate_gen"],
            "current_node": "package_data",
            "last_failure": None,
        }
        completed = derive_rerun_completed_nodes(old_state, "build_and_run_std")
        self.assertEqual(completed, ["generate_statement", "generate_std"])

    def test_derive_rerun_completed_nodes_keeps_failed_node_predecessors(self) -> None:
        old_state = {
            "completed_nodes": ["generate_statement", "generate_std"],
            "current_node": "build_and_run_std",
            "last_failure": {"node_id": "build_and_run_std", "error_type": "script_exit_nonzero"},
        }
        completed = derive_rerun_completed_nodes(old_state, "build_and_run_std")
        self.assertEqual(completed, ["generate_statement", "generate_std"])

    def test_script_output_prefers_existing_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            run_dir = Path(tmp_dir)
            outputs_dir = run_dir / "outputs"
            trace_dir = run_dir / "trace"
            outputs_dir.mkdir()
            trace_dir.mkdir()
            stdout_path = trace_dir / "04_package_data.stdout.txt"
            stdout_path.write_text("summary text\n", encoding="utf-8")
            target = outputs_dir / "data.zip"
            target.write_bytes(b"PK\x03\x04zip-data")
            state = RunState(
                run_id="test",
                workflow_id="problem_gen",
                status="running",
                current_node="package_data",
                completed_nodes=[],
                outputs={},
            )

            _register_node_output(run_dir, "script", "data.zip", stdout_path, state)

            self.assertEqual(target.read_bytes(), b"PK\x03\x04zip-data")
            self.assertEqual(state.outputs["data.zip"], "outputs/data.zip")

    def test_script_output_falls_back_to_stdout_copy(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            run_dir = Path(tmp_dir)
            outputs_dir = run_dir / "outputs"
            trace_dir = run_dir / "trace"
            outputs_dir.mkdir()
            trace_dir.mkdir()
            stdout_path = trace_dir / "04_package_data.stdout.txt"
            stdout_path.write_text("summary text\n", encoding="utf-8")
            state = RunState(
                run_id="test",
                workflow_id="problem_gen",
                status="running",
                current_node="package_data",
                completed_nodes=[],
                outputs={},
            )

            _register_node_output(run_dir, "script", "data.zip", stdout_path, state)

            self.assertEqual((outputs_dir / "data.zip").read_text(encoding="utf-8"), "summary text\n")
            self.assertEqual(state.outputs["data.zip"], "outputs/data.zip")


if __name__ == "__main__":
    unittest.main()
