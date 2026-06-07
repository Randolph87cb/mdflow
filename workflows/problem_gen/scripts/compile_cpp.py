from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--label", default="")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    source_path = Path(args.src)
    label = args.label or source_path.name
    if not source_path.is_file():
        sys.stderr.write(f"compile failed for {label}\nsource file not found: {source_path}\n")
        return 1

    with tempfile.TemporaryDirectory(prefix="mdflow-compile-") as tmp_dir:
        output_path = Path(tmp_dir) / executable_name(source_path.stem)
        command = [
            "g++",
            "-std=c++17",
            "-O2",
            "-pipe",
            str(source_path),
            "-o",
            str(output_path),
        ]
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
        except FileNotFoundError:
            sys.stderr.write("compile failed\ng++ not found in PATH\n")
            return 1

        if completed.returncode != 0:
            sys.stderr.write(f"compile failed for {label}\n")
            if completed.stdout:
                sys.stderr.write(completed.stdout)
                if not completed.stdout.endswith("\n"):
                    sys.stderr.write("\n")
            if completed.stderr:
                sys.stderr.write(completed.stderr)
                if not completed.stderr.endswith("\n"):
                    sys.stderr.write("\n")
            return completed.returncode

        print(f"compile success: {label}")
        return 0


def executable_name(stem: str) -> str:
    return f"{stem}.exe" if sys.platform.startswith("win") else stem


if __name__ == "__main__":
    raise SystemExit(main())
