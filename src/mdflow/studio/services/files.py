from __future__ import annotations

import io
import zipfile
from pathlib import Path

from mdflow.errors import CliUsageError

from .common import is_previewable_text, read_run_bundle, resolve_safe_child


def get_trace_file(config, workflow_id: str, run_id: str, file_name: str) -> dict:
    run_dir, _meta, _state, _bundle, _catalog, _source_dir = read_run_bundle(config, workflow_id, run_id)
    path = resolve_safe_child(run_dir / "trace", file_name)
    if not path.is_file():
        raise CliUsageError(f"trace file not found: {file_name}")
    return {
        "file_name": file_name,
        "path": path.relative_to(config.project_root).as_posix(),
        "content": path.read_text(encoding="utf-8", errors="replace"),
    }


def list_outputs(config, workflow_id: str, run_id: str) -> list[dict]:
    run_dir, _meta, state, _bundle, _catalog, _source_dir = read_run_bundle(config, workflow_id, run_id)
    items: list[dict] = []
    for name, relative_path in state.get("outputs", {}).items():
        path = run_dir / relative_path
        items.append(
            {
                "name": name,
                "path": relative_path,
                "previewable": is_previewable_text(path),
                "size": path.stat().st_size if path.exists() else 0,
            }
        )
    return items


def get_output_file(config, workflow_id: str, run_id: str, file_name: str) -> tuple[Path, dict]:
    run_dir, _meta, state, _bundle, _catalog, _source_dir = read_run_bundle(config, workflow_id, run_id)
    relative_path = state.get("outputs", {}).get(file_name)
    if relative_path is None:
        raise CliUsageError(f"output file not found: {file_name}")
    path = run_dir / relative_path
    if not path.is_file():
        raise CliUsageError(f"output file not found: {file_name}")
    payload = {
        "name": file_name,
        "path": relative_path,
        "previewable": is_previewable_text(path),
    }
    if payload["previewable"]:
        payload["content"] = path.read_text(encoding="utf-8", errors="replace")
    return path, payload


def build_output_zip(config, workflow_id: str, run_id: str, files: list[str] | None) -> bytes:
    run_dir, _meta, state, _bundle, _catalog, _source_dir = read_run_bundle(config, workflow_id, run_id)
    selected = files or list(state.get("outputs", {}).keys())
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_name in selected:
            relative_path = state.get("outputs", {}).get(file_name)
            if relative_path is None:
                raise CliUsageError(f"output file not found: {file_name}")
            path = run_dir / relative_path
            if not path.is_file():
                raise CliUsageError(f"output file not found: {file_name}")
            archive.write(path, arcname=file_name)
    return buffer.getvalue()
