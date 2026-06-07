from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from mdflow.parser import load_workflow_bundle, parse_markdown_file


class ParserTests(unittest.TestCase):
    def test_parse_markdown_file_success(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "node.md"
            path.write_text("---\nid: demo\ntype: llm\nnext: null\n---\n\nhello\n", encoding="utf-8")
            front_matter, body = parse_markdown_file(path)
            self.assertEqual(front_matter["id"], "demo")
            self.assertEqual(body.strip(), "hello")

    def test_parse_markdown_file_requires_front_matter(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "node.md"
            path.write_text("no front matter\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                parse_markdown_file(path)

    def test_load_workflow_bundle_parses_retry_and_router(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            workflow_dir = Path(tmp_dir) / "workflows" / "demo"
            nodes_dir = workflow_dir / "nodes"
            nodes_dir.mkdir(parents=True)
            (workflow_dir / "workflow.md").write_text(
                "---\n"
                "id: demo\n"
                "entry: compile\n"
                "final_outputs:\n"
                "  - final.txt\n"
                "---\n",
                encoding="utf-8",
            )
            (nodes_dir / "01_compile.md").write_text(
                "---\n"
                "id: compile\n"
                "type: script\n"
                "next: route_compile\n"
                "retry:\n"
                "  max_attempts: 3\n"
                "exec:\n"
                "  program: python\n"
                "  args: [\"scripts/compile.py\"]\n"
                "  cwd: outputs\n"
                "  timeout_sec: 10\n"
                "---\n",
                encoding="utf-8",
            )
            (nodes_dir / "02_route_compile.md").write_text(
                "---\n"
                "id: route_compile\n"
                "type: router\n"
                "routes:\n"
                "  - when:\n"
                "      source: compile.status\n"
                "      equals: success\n"
                "    next: package\n"
                "default_next: package\n"
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
                "  args: [\"scripts/package.py\"]\n"
                "  cwd: outputs\n"
                "  timeout_sec: 10\n"
                "---\n",
                encoding="utf-8",
            )

            bundle = load_workflow_bundle(workflow_dir)
            compile_node = bundle.nodes_by_id["compile"]
            router_node = bundle.nodes_by_id["route_compile"]
            self.assertEqual(compile_node.retry.max_attempts, 3)
            self.assertEqual(router_node.routes[0].source, "compile.status")
            self.assertEqual(router_node.routes[0].operator, "equals")
            self.assertEqual(router_node.routes[0].next, "package")


if __name__ == "__main__":
    unittest.main()
