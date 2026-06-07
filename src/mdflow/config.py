from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from mdflow.models import ProjectConfig


def find_project_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / "mdflow.yaml").exists():
            return candidate
    raise FileNotFoundError("mdflow.yaml not found from current directory upward")


def load_project_config(project_root: Path) -> ProjectConfig:
    resolved_root = project_root.resolve()
    load_project_env(resolved_root)
    config_path = resolved_root / "mdflow.yaml"
    data = _load_yaml_file(config_path)
    return ProjectConfig(
        name=str(data.get("name", "")),
        workflows_dir=str(data.get("workflows_dir", "")),
        runs_dir=str(data.get("runs_dir", "")),
        default_workflow=str(data.get("default_workflow", "")),
        model=_as_dict(data.get("model")),
        providers={str(k): _as_dict(v) for k, v in _as_dict(data.get("providers")).items()},
        project_root=resolved_root,
    )


def load_project_env(project_root: Path) -> None:
    env_path = project_root / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def _load_yaml_file(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        parsed = yaml.safe_load(handle) or {}
    if not isinstance(parsed, dict):
        raise ValueError(f"{path} must contain a YAML object")
    return parsed


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}
