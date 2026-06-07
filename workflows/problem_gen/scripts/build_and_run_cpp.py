from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--label", default="")
    parser.add_argument("--statement", required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    source_path = Path(args.src)
    statement_path = Path(args.statement)
    label = args.label or source_path.name
    if not source_path.is_file():
        sys.stderr.write(f"build failed for {label}\nsource file not found: {source_path}\n")
        return 1
    if not statement_path.is_file():
        sys.stderr.write(f"build failed for {label}\nstatement file not found: {statement_path}\n")
        return 1

    with tempfile.TemporaryDirectory(prefix="mdflow-build-run-") as tmp_dir:
        exe_path = Path(tmp_dir) / executable_name(source_path.stem)
        try:
            compile_result = subprocess.run(
                [
                    "g++",
                    "-std=c++17",
                    "-O2",
                    "-pipe",
                    str(source_path),
                    "-o",
                    str(exe_path),
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
        except FileNotFoundError:
            sys.stderr.write("compile failed\ng++ not found in PATH\n")
            return 1
        if compile_result.returncode != 0:
            sys.stderr.write(f"compile failed for {label}\n")
            _write_output(sys.stderr, compile_result.stdout)
            _write_output(sys.stderr, compile_result.stderr)
            return compile_result.returncode or 1

        sample_input = extract_sample_input(statement_path.read_text(encoding="utf-8"))
        if sample_input is None:
            print(f"compile success: {label}")
            print("sample run skipped: no sample input found")
            return 0

        run_result = subprocess.run(
            [str(exe_path)],
            input=sample_input,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
            check=False,
        )
        if run_result.returncode != 0:
            sys.stderr.write(f"run failed for {label}\n")
            _write_output(sys.stderr, run_result.stdout)
            _write_output(sys.stderr, run_result.stderr)
            return run_result.returncode or 1

        print(f"compile success: {label}")
        print("sample run success")
        if run_result.stdout.strip():
            print(run_result.stdout.strip())
        return 0


def extract_sample_input(statement_text: str) -> str | None:
    match = re.search(r"##\s*样例.*?```(?:text)?\s*(.*?)```", statement_text, re.DOTALL)
    if not match:
        return None
    block = match.group(1).strip()
    if not block:
        return None
    lines = [line.rstrip() for line in block.splitlines()]
    if not lines:
        return None
    if any(keyword in lines[0] for keyword in ["输入", "Input"]):
        return "\n".join(line for line in lines[1:] if line.strip()) + "\n"
    if "输出" in block:
        input_part = block.split("输出", 1)[0]
        input_lines = [line.rstrip() for line in input_part.splitlines() if line.strip() and "输入" not in line]
        if input_lines:
            return "\n".join(input_lines) + "\n"
    return block + "\n"


def executable_name(stem: str) -> str:
    return f"{stem}.exe" if sys.platform.startswith("win") else stem


def _write_output(stream, text: str) -> None:
    if text:
        stream.write(text)
        if not text.endswith("\n"):
            stream.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())
