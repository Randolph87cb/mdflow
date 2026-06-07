from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--statement", required=True)
    parser.add_argument("--std", required=True)
    parser.add_argument("--gen", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--cases", type=int, required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    statement_path = Path(args.statement)
    std_path = Path(args.std)
    gen_path = Path(args.gen)
    zip_path = Path(args.out)
    cases = args.cases

    outputs_dir = zip_path.parent
    bin_dir = outputs_dir / "bin"
    temp_dir = outputs_dir / "tmp_data"
    if bin_dir.exists():
        shutil.rmtree(bin_dir)
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    bin_dir.mkdir(parents=True, exist_ok=True)
    temp_dir.mkdir(parents=True, exist_ok=True)

    std_exe = compile_cpp(std_path, bin_dir / executable_name("std"))
    gen_exe = compile_cpp(gen_path, bin_dir / executable_name("gen"))

    generated_files: list[Path] = []
    for case_id in range(1, cases + 1):
        in_path = temp_dir / f"{case_id:02d}.in"
        out_path = temp_dir / f"{case_id:02d}.out"

        gen_stdout = run_binary([str(gen_exe), str(case_id)])
        in_path.write_text(gen_stdout, encoding="utf-8")

        out_stdout = run_binary([str(std_exe)], stdin_text=gen_stdout)
        out_path.write_text(out_stdout, encoding="utf-8")

        generated_files.extend([in_path, out_path])

    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in generated_files:
            archive.write(file_path, arcname=file_path.name)

    shutil.rmtree(bin_dir, ignore_errors=True)
    shutil.rmtree(temp_dir, ignore_errors=True)

    summary = {
        "statement": statement_path.name,
        "std": std_path.name,
        "gen": gen_path.name,
        "cases": cases,
        "zip": zip_path.name,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def compile_cpp(source_path: Path, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "g++",
        "-std=c++17",
        "-O2",
        "-pipe",
        str(source_path),
        "-o",
        str(output_path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if completed.returncode != 0:
        message = f"compile failed for {source_path.name}\n{completed.stdout}\n{completed.stderr}".strip()
        raise SystemExit(message)
    return output_path


def run_binary(command: list[str], *, stdin_text: str | None = None) -> str:
    completed = subprocess.run(
        command,
        input=stdin_text,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        message = f"run failed: {' '.join(command)}\n{completed.stdout}\n{completed.stderr}".strip()
        raise SystemExit(message)
    return completed.stdout


def executable_name(stem: str) -> str:
    return f"{stem}.exe" if sys.platform.startswith("win") else stem


if __name__ == "__main__":
    raise SystemExit(main())
