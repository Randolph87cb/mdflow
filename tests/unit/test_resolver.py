from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from mdflow.models import NodeSpec
from mdflow.resolver import make_trace_lookup, render_prompt, resolve_script_args


class ResolverTests(unittest.TestCase):
    def test_render_prompt_replaces_node_content(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            run_dir = Path(tmp_dir)
            trace_dir = run_dir / "trace"
            outputs_dir = run_dir / "outputs"
            trace_dir.mkdir()
            outputs_dir.mkdir()
            (trace_dir / "00_initial.stdout.txt").write_text("input text", encoding="utf-8")
            (outputs_dir / "std.cpp").write_text("int main() { return 0; }\n", encoding="utf-8")
            nodes = [NodeSpec(id="demo", type="llm", next=None, body="", path=Path("demo.md"))]
            lookup = make_trace_lookup(run_dir, nodes)
            lookup[("demo", "stdout")].write_text("demo output", encoding="utf-8")
            rendered = render_prompt("A\n{{initial.stdout}}\nB\n{{demo.stdout}}\nC\n{{file:outputs/std.cpp}}\n", lookup)
            self.assertIn("input text", rendered)
            self.assertIn("demo output", rendered)
            self.assertIn("int main()", rendered)

    def test_resolve_script_args_supports_explicit_paths_and_refs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            workflow_dir = root / "workflows" / "wf"
            run_dir = root / "runs" / "wf" / "run1"
            (workflow_dir / "scripts").mkdir(parents=True)
            (workflow_dir / "scripts" / "run.py").write_text("print('ok')\n", encoding="utf-8")
            (run_dir / "trace").mkdir(parents=True)
            (run_dir / "outputs").mkdir(parents=True)
            nodes = [NodeSpec(id="demo", type="llm", next=None, body="", path=Path("demo.md"))]
            lookup = make_trace_lookup(run_dir, nodes)
            resolved = resolve_script_args(
                "python",
                ["scripts/run.py", "--src", "outputs/std.cpp", "--raw", "{{demo.stdout}}"],
                workflow_dir,
                run_dir,
                lookup,
            )
            self.assertEqual(Path(resolved[0]), (workflow_dir / "scripts" / "run.py").absolute())
            self.assertEqual(Path(resolved[2]), (run_dir / "outputs" / "std.cpp").absolute())
            self.assertEqual(Path(resolved[4]), lookup[("demo", "stdout")].absolute())


if __name__ == "__main__":
    unittest.main()
