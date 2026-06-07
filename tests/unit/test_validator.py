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
        bundle, ordered_nodes = load_and_validate_workflow(config, self.repo_root / "workflows" / "problem_gen")
        self.assertEqual(bundle.workflow.id, "problem_gen")
        self.assertEqual([node.id for node in ordered_nodes][-1], "package_data")

    def test_validate_detects_cycle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = Path(tmp_dir)
            shutil.copytree(self.repo_root / "workflows", project_root / "workflows")
            shutil.copy2(self.repo_root / "mdflow.yaml", project_root / "mdflow.yaml")
            node_path = project_root / "workflows" / "problem_gen" / "nodes" / "04_package_data.md"
            text = node_path.read_text(encoding="utf-8").replace("next: null", "next: generate_statement")
            node_path.write_text(text, encoding="utf-8")
            config = load_project_config(project_root)
            with self.assertRaises(ValidationError):
                load_and_validate_workflow(config, project_root / "workflows" / "problem_gen")


if __name__ == "__main__":
    unittest.main()
