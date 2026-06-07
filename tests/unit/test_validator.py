from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from mdflow.config import load_project_config
from mdflow.errors import ValidationError
from mdflow.validator import load_and_validate_workflow


class ValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[2]

    def test_validate_sample_workflow_success(self) -> None:
        config = load_project_config(self.repo_root)
        bundle, node_catalog = load_and_validate_workflow(config, self.repo_root / "workflows" / "problem_gen")
        self.assertEqual(bundle.workflow.id, "problem_gen")
        self.assertEqual([node.id for node in node_catalog][-1], "package_data")

    def test_validate_router_workflow_success(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = self._make_router_project(Path(tmp_dir))
            config = load_project_config(project_root)
            bundle, node_catalog = load_and_validate_workflow(config, project_root / "workflows" / "router_demo")
            self.assertEqual(bundle.workflow.id, "router_demo")
            self.assertIn("route_compile", [node.id for node in node_catalog])

    def test_validate_rejects_invalid_router_source(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = self._make_router_project(Path(tmp_dir))
            route_path = project_root / "workflows" / "router_demo" / "nodes" / "03_route_compile.md"
            text = route_path.read_text(encoding="utf-8").replace("compile_source.status", "seed_source.status")
            route_path.write_text(text, encoding="utf-8")
            config = load_project_config(project_root)
            with self.assertRaises(ValidationError):
                load_and_validate_workflow(config, project_root / "workflows" / "router_demo")

    def test_validate_rejects_missing_default_next(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = self._make_router_project(Path(tmp_dir))
            route_path = project_root / "workflows" / "router_demo" / "nodes" / "03_route_compile.md"
            lines = [line for line in route_path.read_text(encoding="utf-8").splitlines() if not line.startswith("default_next:")]
            route_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            config = load_project_config(project_root)
            with self.assertRaises(ValidationError):
                load_and_validate_workflow(config, project_root / "workflows" / "router_demo")

    def test_validate_rejects_unreachable_node(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = self._make_router_project(Path(tmp_dir))
            extra_node = project_root / "workflows" / "router_demo" / "nodes" / "99_orphan.md"
            extra_node.write_text(
                "---\n"
                "id: orphan\n"
                "type: script\n"
                "next: null\n"
                "exec:\n"
                "  program: python\n"
                "  args: [\"scripts/package.py\"]\n"
                "  cwd: outputs\n"
                "  timeout_sec: 10\n"
                "---\n",
                encoding="utf-8",
            )
            config = load_project_config(project_root)
            with self.assertRaises(ValidationError):
                load_and_validate_workflow(config, project_root / "workflows" / "router_demo")

    def _make_router_project(self, project_root: Path) -> Path:
        shutil.copy2(self.repo_root / "mdflow.yaml", project_root / "mdflow.yaml")
        workflows_dir = project_root / "workflows" / "router_demo"
        nodes_dir = workflows_dir / "nodes"
        scripts_dir = workflows_dir / "scripts"
        inputs_dir = workflows_dir / "inputs"
        nodes_dir.mkdir(parents=True)
        scripts_dir.mkdir(parents=True)
        inputs_dir.mkdir(parents=True)

        config_path = project_root / "mdflow.yaml"
        config_text = config_path.read_text(encoding="utf-8")
        config_text = config_text.replace("provider: micu_main", "provider: mock", 1)
        config_text = config_text.replace("model: gpt-5.4-mini", "model: mock-llm", 1)
        config_path.write_text(config_text, encoding="utf-8")

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
        return project_root


if __name__ == "__main__":
    unittest.main()
