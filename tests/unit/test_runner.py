from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from mdflow.models import RunState
from mdflow.runner import _register_node_output


class RunnerTests(unittest.TestCase):
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
