from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from mdflow.models import RunMeta, RunState, TraceEvent


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_meta(path: Path, meta: RunMeta) -> None:
    write_json(path, meta.to_dict())


def write_state(path: Path, state: RunState) -> None:
    write_json(path, state.to_dict())


def append_trace_event(path: Path, event: TraceEvent) -> None:
    if path.exists():
        payload = read_json(path)
    else:
        payload = {"events": []}
    payload.setdefault("events", []).append(event.to_dict())
    write_json(path, payload)
