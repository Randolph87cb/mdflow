from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
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

        config_path = project_root / "mdflow.yaml"
        config_text = config_path.read_text(encoding="utf-8")
        config_text = config_text.replace("provider: micu_main", "provider: mock", 1)
        config_text = config_text.replace("model: gpt-5.4-mini", "model: mock-llm", 1)
        config_path.write_text(config_text, encoding="utf-8")
        return project_root

    def _run_cli(self, project_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["PYTHONPATH"] = self.pythonpath
        env["PYTHONUTF8"] = "1"
        return subprocess.run(
            [sys.executable, "-m", "mdflow.cli", *args],
            cwd=project_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
        )

    def _write_router_workflow(self, project_root: Path) -> None:
        workflows_dir = project_root / "workflows" / "router_demo"
        nodes_dir = workflows_dir / "nodes"
        scripts_dir = workflows_dir / "scripts"
        inputs_dir = workflows_dir / "inputs"
        nodes_dir.mkdir(parents=True)
        scripts_dir.mkdir(parents=True)
        inputs_dir.mkdir(parents=True)
        (workflows_dir / "workflow.md").write_text(
            "---\n"
            "id: router_demo\n"
            "entry: seed_source\n"
            "final_outputs:\n"
            "  - source.txt\n"
            "  - final.txt\n"
            "---\n",
            encoding="utf-8",
        )
        (inputs_dir / "default.md").write_text("demo\n", encoding="utf-8")
        (nodes_dir / "01_seed_source.md").write_text(
            "---\n"
            "id: seed_source\n"
            "type: script\n"
            "next: compile_source\n"
            "produces: source.txt\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/seed.py\", \"--out\", \"outputs/source.txt\", \"--content\", \"broken\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "02_compile_source.md").write_text(
            "---\n"
            "id: compile_source\n"
            "type: script\n"
            "next: route_compile\n"
            "retry:\n"
            "  max_attempts: 3\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/compile.py\", \"--src\", \"outputs/source.txt\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "03_route_compile.md").write_text(
            "---\n"
            "id: route_compile\n"
            "type: router\n"
            "routes:\n"
            "  - when:\n"
            "      source: compile_source.status\n"
            "      equals: success\n"
            "    next: package\n"
            "  - when:\n"
            "      source: compile_source.stderr\n"
            "      contains: compile error\n"
            "    next: fix_source\n"
            "  - when:\n"
            "      source: compile_source.attempts\n"
            "      gte: 5\n"
            "    next: hard_fail\n"
            "default_next: hard_fail\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "04_fix_source.md").write_text(
            "---\n"
            "id: fix_source\n"
            "type: script\n"
            "next: compile_source\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/fix.py\", \"--src\", \"outputs/source.txt\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "05_package.md").write_text(
            "---\n"
            "id: package\n"
            "type: script\n"
            "next: null\n"
            "produces: final.txt\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/package.py\", \"--src\", \"outputs/source.txt\", \"--out\", \"outputs/final.txt\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "06_hard_fail.md").write_text(
            "---\n"
            "id: hard_fail\n"
            "type: script\n"
            "next: null\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/hard_fail.py\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (scripts_dir / "seed.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--out');p.add_argument('--content');a=p.parse_args();Path(a.out).write_text(a.content, encoding='utf-8');print(a.content)\n", encoding="utf-8")
        (scripts_dir / "compile.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--src');a=p.parse_args();text=Path(a.src).read_text(encoding='utf-8');\nif 'fixed' in text:\n print('compile success')\n raise SystemExit(0)\nraise SystemExit('compile error')\n", encoding="utf-8")
        (scripts_dir / "fix.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--src');a=p.parse_args();Path(a.src).write_text('fixed', encoding='utf-8');print('fixed')\n", encoding="utf-8")
        (scripts_dir / "package.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--src');p.add_argument('--out');a=p.parse_args();text=Path(a.src).read_text(encoding='utf-8');Path(a.out).write_text(f'packaged:{text}', encoding='utf-8');print('packaged')\n", encoding="utf-8")
        (scripts_dir / "hard_fail.py").write_text("raise SystemExit('hard fail')\n", encoding="utf-8")

    def _write_rerun_workflow(self, project_root: Path) -> None:
        workflows_dir = project_root / "workflows" / "rerun_demo"
        nodes_dir = workflows_dir / "nodes"
        scripts_dir = workflows_dir / "scripts"
        inputs_dir = workflows_dir / "inputs"
        nodes_dir.mkdir(parents=True)
        scripts_dir.mkdir(parents=True)
        inputs_dir.mkdir(parents=True)
        (workflows_dir / "workflow.md").write_text(
            "---\n"
            "id: rerun_demo\n"
            "entry: seed_source\n"
            "final_outputs:\n"
            "  - source.txt\n"
            "  - final.txt\n"
            "---\n",
            encoding="utf-8",
        )
        (inputs_dir / "default.md").write_text("demo\n", encoding="utf-8")
        (nodes_dir / "01_seed_source.md").write_text(
            "---\n"
            "id: seed_source\n"
            "type: script\n"
            "next: compile_source\n"
            "produces: source.txt\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/seed.py\", \"--out\", \"outputs/source.txt\", \"--content\", \"broken\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "02_compile_source.md").write_text(
            "---\n"
            "id: compile_source\n"
            "type: script\n"
            "next: package\n"
            "retry:\n"
            "  max_attempts: 2\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/compile.py\", \"--src\", \"outputs/source.txt\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "03_package.md").write_text(
            "---\n"
            "id: package\n"
            "type: script\n"
            "next: null\n"
            "produces: final.txt\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/package.py\", \"--src\", \"outputs/source.txt\", \"--out\", \"outputs/final.txt\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (scripts_dir / "seed.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--out');p.add_argument('--content');a=p.parse_args();Path(a.out).write_text(a.content, encoding='utf-8');print(a.content)\n", encoding="utf-8")
        (scripts_dir / "compile.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--src');a=p.parse_args();text=Path(a.src).read_text(encoding='utf-8');\nif 'fixed' in text:\n print('compile success')\n raise SystemExit(0)\nraise SystemExit('compile error')\n", encoding="utf-8")
        (scripts_dir / "package.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--src');p.add_argument('--out');a=p.parse_args();text=Path(a.src).read_text(encoding='utf-8');Path(a.out).write_text(f'packaged:{text}', encoding='utf-8');print('packaged')\n", encoding="utf-8")

    def _write_trace_seed_workflow(self, project_root: Path) -> None:
        workflows_dir = project_root / "workflows" / "trace_seed_demo"
        nodes_dir = workflows_dir / "nodes"
        scripts_dir = workflows_dir / "scripts"
        inputs_dir = workflows_dir / "inputs"
        nodes_dir.mkdir(parents=True)
        scripts_dir.mkdir(parents=True)
        inputs_dir.mkdir(parents=True)
        (workflows_dir / "workflow.md").write_text(
            "---\n"
            "id: trace_seed_demo\n"
            "entry: seed_source\n"
            "final_outputs:\n"
            "  - source.txt\n"
            "  - final.txt\n"
            "---\n",
            encoding="utf-8",
        )
        (inputs_dir / "default.md").write_text("demo\n", encoding="utf-8")
        (nodes_dir / "01_seed_source.md").write_text(
            "---\n"
            "id: seed_source\n"
            "type: script\n"
            "next: capture_source\n"
            "produces: source.txt\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/seed.py\", \"--out\", \"outputs/source.txt\", \"--content\", \"from-seed\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "02_capture_source.md").write_text(
            "---\n"
            "id: capture_source\n"
            "type: script\n"
            "next: package\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/dump.py\", \"--src\", \"outputs/source.txt\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (nodes_dir / "03_package.md").write_text(
            "---\n"
            "id: package\n"
            "type: script\n"
            "next: null\n"
            "produces: final.txt\n"
            "exec:\n"
            "  program: python\n"
            "  args: [\"scripts/package_from_trace.py\", \"--src\", \"{{capture_source.stdout}}\", \"--out\", \"outputs/final.txt\"]\n"
            "  cwd: .\n"
            "  timeout_sec: 10\n"
            "---\n",
            encoding="utf-8",
        )
        (scripts_dir / "seed.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--out');p.add_argument('--content');a=p.parse_args();Path(a.out).write_text(a.content, encoding='utf-8');print(a.content)\n", encoding="utf-8")
        (scripts_dir / "dump.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--src');a=p.parse_args();print(Path(a.src).read_text(encoding='utf-8'))\n", encoding="utf-8")
        (scripts_dir / "package_from_trace.py").write_text("import argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--src');p.add_argument('--out');a=p.parse_args();text=Path(a.src).read_text(encoding='utf-8');Path(a.out).write_text(f'trace:{text.strip()}', encoding='utf-8');print('packaged')\n", encoding="utf-8")

    def test_run_success_show_and_cat(self) -> None:
        project_root = self._make_project_copy()
        result = self._run_cli(project_root, "run", "problem_gen", "--input", "workflows/problem_gen/inputs/default.md", "--run-id", "test-run")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        run_dir = project_root / "runs" / "problem_gen" / "test-run"
        for filename in ["题面.md", "std.cpp", "gen.cpp", "data.zip"]:
            self.assertTrue((run_dir / "outputs" / filename).exists(), filename)

        state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
        self.assertEqual(state["status"], "success")
        self.assertEqual(set(state["outputs"]), {"题面.md", "std.cpp", "gen.cpp", "data.zip"})

        with zipfile.ZipFile(run_dir / "outputs" / "data.zip") as archive:
            names = sorted(archive.namelist())
        self.assertEqual(len(names), 50)
        self.assertIn("01.in", names)
        self.assertIn("25.out", names)

        show = self._run_cli(project_root, "show", "runs/problem_gen/test-run")
        self.assertEqual(show.returncode, 0, show.stdout + show.stderr)
        self.assertIn("status: success", show.stdout)
        self.assertIn("data.zip -> outputs/data.zip", show.stdout)

        cat = self._run_cli(project_root, "cat", "runs/problem_gen/test-run", "output:题面.md")
        self.assertEqual(cat.returncode, 0, cat.stdout + cat.stderr)
        self.assertIn("# A + B", cat.stdout)

    def test_run_failure_on_script_exit_nonzero(self) -> None:
        project_root = self._make_project_copy()
        script_path = project_root / "workflows" / "problem_gen" / "scripts" / "package_data.py"
        script_path.write_text("raise SystemExit(1)\n", encoding="utf-8")
        result = self._run_cli(project_root, "run", "problem_gen", "--input", "workflows/problem_gen/inputs/default.md", "--run-id", "fail-run")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        run_dir = project_root / "runs" / "problem_gen" / "fail-run"
        state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
        self.assertEqual(state["status"], "failed")
        self.assertEqual(state["current_node"], "package_data")

    def test_run_failure_on_script_timeout(self) -> None:
        project_root = self._make_project_copy()
        script_path = project_root / "workflows" / "problem_gen" / "scripts" / "package_data.py"
        script_path.write_text(
            "import time\n"
            "time.sleep(2)\n"
            "print('late')\n",
            encoding="utf-8",
        )
        node_path = project_root / "workflows" / "problem_gen" / "nodes" / "07_package_data.md"
        node_path.write_text(node_path.read_text(encoding="utf-8").replace("timeout_sec: 300", "timeout_sec: 1"), encoding="utf-8")
        result = self._run_cli(project_root, "run", "problem_gen", "--input", "workflows/problem_gen/inputs/default.md", "--run-id", "timeout-run")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        run_dir = project_root / "runs" / "problem_gen" / "timeout-run"
        trace = json.loads((run_dir / "trace" / "trace.json").read_text(encoding="utf-8"))
        self.assertEqual(trace["events"][-1]["type"], "run_failed")

    def test_router_and_retry_success_path(self) -> None:
        project_root = self._make_project_copy()
        self._write_router_workflow(project_root)
        result = self._run_cli(project_root, "run", "router_demo", "--input", "workflows/router_demo/inputs/default.md", "--run-id", "router-run")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        run_dir = project_root / "runs" / "router_demo" / "router-run"
        state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
        self.assertEqual(state["status"], "success")
        self.assertEqual(state["node_attempts"]["compile_source"], 4)
        self.assertTrue((run_dir / "outputs" / "final.txt").exists())

        trace = json.loads((run_dir / "trace" / "trace.json").read_text(encoding="utf-8"))
        event_types = [event["type"] for event in trace["events"]]
        self.assertIn("node_retry_scheduled", event_types)
        self.assertIn("router_selected", event_types)

        cat = self._run_cli(project_root, "cat", "runs/router_demo/router-run", "compile_source.stdout")
        self.assertEqual(cat.returncode, 0, cat.stdout + cat.stderr)
        self.assertIn("compile success", cat.stdout)

    def test_rerun_from_failed_node_creates_new_run(self) -> None:
        project_root = self._make_project_copy()
        self._write_rerun_workflow(project_root)
        first = self._run_cli(project_root, "run", "rerun_demo", "--input", "workflows/rerun_demo/inputs/default.md", "--run-id", "rerun-fail")
        self.assertEqual(first.returncode, 1, first.stdout + first.stderr)

        failed_run_dir = project_root / "runs" / "rerun_demo" / "rerun-fail"
        failed_state = json.loads((failed_run_dir / "state.json").read_text(encoding="utf-8"))
        self.assertEqual(failed_state["status"], "failed")
        self.assertEqual(failed_state["current_node"], "compile_source")

        (failed_run_dir / "outputs" / "source.txt").write_text("fixed", encoding="utf-8")
        rerun = self._run_cli(project_root, "rerun", "runs/rerun_demo/rerun-fail", "--from", "compile_source", "--run-id", "rerun-ok")
        self.assertEqual(rerun.returncode, 0, rerun.stdout + rerun.stderr)

        rerun_dir = project_root / "runs" / "rerun_demo" / "rerun-ok"
        rerun_state = json.loads((rerun_dir / "state.json").read_text(encoding="utf-8"))
        rerun_meta = json.loads((rerun_dir / "meta.json").read_text(encoding="utf-8"))
        self.assertEqual(rerun_state["status"], "success")
        self.assertEqual((rerun_dir / "outputs" / "final.txt").read_text(encoding="utf-8"), "packaged:fixed")
        self.assertEqual(rerun_meta["source_run_id"], "rerun-fail")
        self.assertEqual(rerun_meta["rerun_from_node"], "compile_source")
        self.assertEqual(failed_state["status"], "failed")

    def test_rerun_seeds_non_produced_trace_dependencies(self) -> None:
        project_root = self._make_project_copy()
        self._write_trace_seed_workflow(project_root)

        first = self._run_cli(project_root, "run", "trace_seed_demo", "--input", "workflows/trace_seed_demo/inputs/default.md", "--run-id", "trace-seed-1")
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)

        rerun = self._run_cli(project_root, "rerun", "runs/trace_seed_demo/trace-seed-1", "--from", "package", "--run-id", "trace-seed-2")
        self.assertEqual(rerun.returncode, 0, rerun.stdout + rerun.stderr)

        rerun_dir = project_root / "runs" / "trace_seed_demo" / "trace-seed-2"
        self.assertEqual((rerun_dir / "outputs" / "final.txt").read_text(encoding="utf-8"), "trace:from-seed")


if __name__ == "__main__":
    unittest.main()
