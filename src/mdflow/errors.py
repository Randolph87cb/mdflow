from __future__ import annotations


class MdflowError(Exception):
    """Base exception for mdflow."""


class ValidationError(MdflowError):
    def __init__(self, messages: list[str]) -> None:
        super().__init__("\n".join(messages))
        self.messages = messages


class CliUsageError(MdflowError):
    pass


class RunFailure(MdflowError):
    def __init__(
        self,
        node_id: str,
        message: str,
        *,
        error_type: str,
        returncode: int | None = None,
        timeout_sec: int | None = None,
    ) -> None:
        super().__init__(message)
        self.node_id = node_id
        self.message = message
        self.error_type = error_type
        self.returncode = returncode
        self.timeout_sec = timeout_sec
