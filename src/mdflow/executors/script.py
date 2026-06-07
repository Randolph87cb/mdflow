from __future__ import annotations

import subprocess

from mdflow.errors import RunFailure


def run_script_node(
    *,
    program: str,
    args: list[str],
    cwd: str,
    timeout_sec: int,
) -> tuple[str, str]:
    try:
        completed = subprocess.run(
            [program, *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_sec,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RunFailure(
            "",
            "Script execution timed out",
            error_type="script_timeout",
            timeout_sec=timeout_sec,
            stdout=exc.stdout or "",
            stderr=exc.stderr or "",
        ) from exc

    if completed.returncode != 0:
        raise RunFailure(
            "",
            "Script exited with non-zero status",
            error_type="script_exit_nonzero",
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )
    return completed.stdout, completed.stderr
