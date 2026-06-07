from __future__ import annotations

import argparse
import sys
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    source_path = Path(args.src)
    if not source_path.is_file():
        sys.stderr.write(f"source file not found: {source_path}\n")
        return 1
    sys.stdout.write(source_path.read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
