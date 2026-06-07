from __future__ import annotations

import argparse
import json
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--statement", required=True)
    parser.add_argument("--solution", required=True)
    parser.add_argument("--code", required=True)
    parser.add_argument("--run-result", required=True)
    parser.add_argument("--out", required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    statement = Path(args.statement)
    solution = Path(args.solution)
    code = Path(args.code)
    run_result = Path(args.run_result)
    out_path = Path(args.out)

    payload = {
        "statement": statement.name,
        "solution": solution.name,
        "code": code.name,
        "run_result": run_result.name,
        "sizes": {
            "statement": len(statement.read_text(encoding="utf-8")),
            "solution": len(solution.read_text(encoding="utf-8")),
            "code": len(code.read_text(encoding="utf-8")),
            "run_result": len(run_result.read_text(encoding="utf-8")),
        },
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    out_path.write_text(json_text, encoding="utf-8")
    print(json_text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
