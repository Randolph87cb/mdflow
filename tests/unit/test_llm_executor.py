from __future__ import annotations

import unittest

from mdflow.executors.llm import _normalize_base_url, _sanitize_cpp_output, _sanitize_markdown_output, _strip_code_fence


class LlmExecutorTests(unittest.TestCase):
    def test_normalize_base_url_appends_v1(self) -> None:
        self.assertEqual(_normalize_base_url("https://www.micuapi.ai"), "https://www.micuapi.ai/v1")
        self.assertEqual(_normalize_base_url("https://www.micuapi.ai/"), "https://www.micuapi.ai/v1")

    def test_normalize_base_url_keeps_existing_v1(self) -> None:
        self.assertEqual(_normalize_base_url("https://www.micuapi.ai/v1"), "https://www.micuapi.ai/v1")

    def test_strip_code_fence_for_cpp(self) -> None:
        fenced = "```cpp\n#include <iostream>\nint main() {}\n```\n"
        self.assertEqual(_strip_code_fence(fenced), "#include <iostream>\nint main() {}\n")

    def test_sanitize_cpp_output_removes_explanatory_prefix(self) -> None:
        raw = "我先写生成器。#include <bits/stdc++.h>\nint main() { return 0; }\n"
        self.assertEqual(_sanitize_cpp_output(raw), "#include <bits/stdc++.h>\nint main() { return 0; }\n")

    def test_sanitize_markdown_output_keeps_first_heading(self) -> None:
        raw = "我先确认题型。\n# 标题\n正文\n"
        self.assertEqual(_sanitize_markdown_output(raw), "# 标题\n正文\n")


if __name__ == "__main__":
    unittest.main()
