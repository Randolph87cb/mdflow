from __future__ import annotations

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
    config_path = project_root / "mdflow.yaml"
    data = _load_yaml_file(config_path)
    return ProjectConfig(
        name=str(data.get("name", "")),
        workflows_dir=str(data.get("workflows_dir", "")),
        runs_dir=str(data.get("runs_dir", "")),
        default_workflow=str(data.get("default_workflow", "")),
        model=_as_dict(data.get("model")),
        providers={str(k): _as_dict(v) for k, v in _as_dict(data.get("providers")).items()},
        project_root=project_root,
    )


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
