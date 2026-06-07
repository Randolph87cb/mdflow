from __future__ import annotations

import argparse
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--out", required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    src_path = Path(args.src)
    out_path = Path(args.out)
    source_text = src_path.read_text(encoding="utf-8")
    result = (
        "mock-run-ok\n"
        f"source={src_path.name}\n"
        f"chars={len(source_text)}\n"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(result, encoding="utf-8")
    print(result, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
