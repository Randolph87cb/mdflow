from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from mdflow.parser import parse_markdown_file


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


if __name__ == "__main__":
    unittest.main()
