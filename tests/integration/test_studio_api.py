from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from mdflow.studio.app import create_app


class StudioApiIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[2]

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

    def test_system_status_and_workflow_list(self) -> None:
        project_root = self._make_project_copy()
        client = TestClient(create_app(project_root))

        status = client.get("/api/system/status")
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.json()["workflows_dir"], "workflows")

        workflows = client.get("/api/workflows")
        self.assertEqual(workflows.status_code, 200)
        workflow_ids = {item["workflow_id"] for item in workflows.json()}
        self.assertIn("problem_gen", workflow_ids)

    def test_create_run_uses_snapshot_and_input_md(self) -> None:
        project_root = self._make_project_copy()
        client = TestClient(create_app(project_root))

        response = client.post(
            "/api/workflows/problem_gen/runs",
            json={
                "input_mode": "text",
                "input_text": "知识点：加法\n难度：入门",
                "run_name": "studio-run-1",
                "note": "api smoke",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        run_dir = project_root / "runs" / "problem_gen" / "studio-run-1"
        self.assertTrue((run_dir / "input.md").is_file())
        self.assertTrue((run_dir / "workflow_snapshot" / "workflow.md").is_file())
        self.assertTrue((run_dir / "workflow_snapshot" / "nodes").is_dir())

        meta = json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["input_source"]["mode"], "text")
        self.assertEqual(meta["note"], "api smoke")

        live_node_path = project_root / "workflows" / "problem_gen" / "nodes" / "01_generate_statement.md"
        live_text = live_node_path.read_text(encoding="utf-8")
        live_node_path.write_text(live_text + "\n<!-- live changed -->\n", encoding="utf-8")
        self.addCleanup(lambda: live_node_path.write_text(live_text, encoding="utf-8"))

        node_detail = client.get("/api/workflows/problem_gen/runs/studio-run-1/nodes/generate_statement")
        self.assertEqual(node_detail.status_code, 200, node_detail.text)
        payload = node_detail.json()
        self.assertIn("workflow_snapshot", payload["source"]["path"])
        self.assertNotIn("live changed", payload["source"]["content"])

    def test_copy_workflow_and_update_node(self) -> None:
        project_root = self._make_project_copy()
        client = TestClient(create_app(project_root))

        copy_response = client.post(
            "/api/workflows/problem_gen/copy",
            json={
                "new_workflow_id": "problem_gen_copy",
                "new_name": "Problem Gen Copy",
                "copy_scripts": True,
                "copy_inputs": True,
            },
        )
        self.assertEqual(copy_response.status_code, 200, copy_response.text)
        copied_dir = project_root / "workflows" / "problem_gen_copy"
        self.assertTrue((copied_dir / "workflow.md").is_file())
        self.assertTrue((copied_dir / "scripts").is_dir())

        get_node = client.get("/api/workflows/problem_gen_copy/nodes/generate_statement")
        self.assertEqual(get_node.status_code, 200)
        original_content = get_node.json()["content"]
        updated_content = original_content.rstrip() + "\n\n<!-- edited in studio api test -->\n"
        update_response = client.put(
            "/api/workflows/problem_gen_copy/nodes/generate_statement",
            json={"content": updated_content},
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        self.assertIn("edited in studio api test", copied_dir.joinpath("nodes", "01_generate_statement.md").read_text(encoding="utf-8"))

    def test_trace_and_output_paths_are_sandboxed(self) -> None:
        project_root = self._make_project_copy()
        client = TestClient(create_app(project_root))

        run_response = client.post(
            "/api/workflows/problem_gen/runs",
            json={
                "input_mode": "file",
                "input_file": "workflows/problem_gen/inputs/default.md",
                "run_name": "studio-run-secure",
            },
        )
        self.assertEqual(run_response.status_code, 200, run_response.text)

        bad_trace = client.get("/api/workflows/problem_gen/runs/studio-run-secure/trace/..%2Fmeta.json")
        self.assertEqual(bad_trace.status_code, 400)

        bad_output = client.get("/api/workflows/problem_gen/runs/studio-run-secure/outputs/..%2Fmeta.json")
        self.assertEqual(bad_output.status_code, 400)


if __name__ == "__main__":
    unittest.main()
