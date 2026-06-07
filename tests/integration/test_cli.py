from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class CliIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[2]
        self.pythonpath = str(self.repo_root / "src")

    def _make_project_copy(self) -> Path:
        tmp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(tmp_dir.cleanup)
        project_root = Path(tmp_dir.name)
        shutil.copy2(self.repo_root / "mdflow.yaml", project_root / "mdflow.yaml")
        shutil.copytree(self.repo_root / "workflows", project_root / "workflows")
        (project_root / "runs").mkdir()
        return project_root

    def _run_cli(self, project_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["PYTHONPATH"] = self.pythonpath
        return subprocess.run(
            [sys.executable, "-m", "mdflow.cli", *args],
            cwd=project_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
        )

    def test_run_success_show_and_cat(self) -> None:
        project_root = self._make_project_copy()
        result = self._run_cli(project_root, "run", "problem_gen", "--input", "workflows/problem_gen/inputs/default.md", "--run-id", "test-run")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        run_dir = project_root / "runs" / "problem_gen" / "test-run"
        self.assertTrue((run_dir / "outputs" / "package.json").exists())
        state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
        self.assertEqual(state["status"], "success")

        show = self._run_cli(project_root, "show", "runs/problem_gen/test-run")
        self.assertEqual(show.returncode, 0, show.stdout + show.stderr)
        self.assertIn("status: success", show.stdout)

        cat = self._run_cli(project_root, "cat", "runs/problem_gen/test-run", "output:package.json")
        self.assertEqual(cat.returncode, 0, cat.stdout + cat.stderr)
        self.assertIn('"code": "std.cpp"', cat.stdout)

    def test_run_failure_on_script_exit_nonzero(self) -> None:
        project_root = self._make_project_copy()
        script_path = project_root / "workflows" / "problem_gen" / "scripts" / "run_cpp.py"
        script_path.write_text("raise SystemExit(1)\n", encoding="utf-8")
        result = self._run_cli(project_root, "run", "problem_gen", "--input", "workflows/problem_gen/inputs/default.md", "--run-id", "fail-run")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        run_dir = project_root / "runs" / "problem_gen" / "fail-run"
        state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
        self.assertEqual(state["status"], "failed")
        self.assertEqual(state["current_node"], "run_cpp")

    def test_run_failure_on_script_timeout(self) -> None:
        project_root = self._make_project_copy()
        script_path = project_root / "workflows" / "problem_gen" / "scripts" / "run_cpp.py"
        script_path.write_text(
            "import time\n"
            "time.sleep(2)\n"
            "print('late')\n",
            encoding="utf-8",
        )
        node_path = project_root / "workflows" / "problem_gen" / "nodes" / "04_run_cpp.md"
        node_path.write_text(node_path.read_text(encoding="utf-8").replace("timeout_sec: 300", "timeout_sec: 1"), encoding="utf-8")
        result = self._run_cli(project_root, "run", "problem_gen", "--input", "workflows/problem_gen/inputs/default.md", "--run-id", "timeout-run")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        run_dir = project_root / "runs" / "problem_gen" / "timeout-run"
        trace = json.loads((run_dir / "trace" / "trace.json").read_text(encoding="utf-8"))
        self.assertEqual(trace["events"][-1]["type"], "run_failed")


if __name__ == "__main__":
    unittest.main()
