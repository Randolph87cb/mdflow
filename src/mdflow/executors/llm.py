from __future__ import annotations

import json
import textwrap
import urllib.error
import urllib.request

from mdflow.errors import RunFailure
from mdflow.models import NodeSpec


def run_llm_node(
    node: NodeSpec,
    prompt_text: str,
    resolved_model: dict[str, object],
    provider_config: dict[str, object],
) -> tuple[str, str]:
    provider = str(resolved_model.get("provider", ""))
    provider_type = str(provider_config.get("type", ""))
    if provider == "mock" or provider_type == "mock":
        return _run_mock_node(node, prompt_text, resolved_model, provider)
    if provider_type != "openai_compatible":
        raise RunFailure(
            node.id,
            f"provider '{provider}' is not supported in phase one runtime",
            error_type="llm_error",
        )
    return _run_openai_compatible(node, prompt_text, resolved_model, provider_config)


def _run_mock_node(
    node: NodeSpec,
    prompt_text: str,
    resolved_model: dict[str, object],
    provider: str,
) -> tuple[str, str]:
    produces = node.produces or ""
    if produces == "std.cpp":
        stdout = textwrap.dedent(
            """\
            #include <iostream>

            int main() {
                long long a = 0;
                long long b = 0;
                std::cin >> a >> b;
                std::cout << (a + b) << '\\n';
                return 0;
            }
            """
        )
    elif produces == "gen.cpp":
        stdout = textwrap.dedent(
            """\
            #include <cstdlib>
            #include <iostream>

            int main(int argc, char** argv) {
                int case_id = 1;
                if (argc >= 2) {
                    case_id = std::atoi(argv[1]);
                }
                long long a = case_id * 17LL + 3;
                long long b = case_id * 29LL + 5;
                std::cout << a << ' ' << b << '\\n';
                return 0;
            }
            """
        )
    elif produces.endswith(".cpp"):
        stdout = textwrap.dedent(
            """\
            #include <iostream>

            int main() {
                std::cout << "mock-ok" << std::endl;
                return 0;
            }
            """
        )
    elif produces.endswith(".md"):
        if produces == "题面.md":
            stdout = textwrap.dedent(
                """\
                # A + B

                给定两个整数 `a` 和 `b`，输出它们的和。

                ## 输入格式

                一行两个整数 `a b`。

                ## 输出格式

                输出一个整数，表示 `a + b`。
                """
            )
        else:
            stdout = textwrap.dedent(
                f"""\
                # Mock Output: {node.id}

                Provider: {provider}
                Model: {resolved_model.get("model", "mock-llm")}

                Prompt Summary:
                {prompt_text.strip()[:200]}
                """
            )
    elif produces.endswith(".json"):
        stdout = '{"node": "%s", "provider": "%s"}\n' % (node.id, provider)
    else:
        stdout = f"[mock:{node.id}] {prompt_text.strip()[:200]}\n"
    return stdout, ""


def _run_openai_compatible(
    node: NodeSpec,
    prompt_text: str,
    resolved_model: dict[str, object],
    provider_config: dict[str, object],
) -> tuple[str, str]:
    base_url = _normalize_base_url(_read_env(provider_config, "base_url_env"))
    api_key = _read_env(provider_config, "api_key_env")
    payload = {
        "model": str(resolved_model.get("model", "")),
        "input": prompt_text,
    }
    temperature = resolved_model.get("temperature")
    if isinstance(temperature, (int, float)):
        payload["temperature"] = temperature
    max_tokens = resolved_model.get("max_tokens")
    if isinstance(max_tokens, int) and max_tokens > 0:
        payload["max_output_tokens"] = max_tokens

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "codex-cli/0.1 mdflow/0.1",
    }

    try:
        response = _post_json(f"{base_url}/responses", payload, headers)
    except RunFailure as exc:
        if exc.error_type != "llm_http_error":
            raise
        fallback_payload = {
            "model": str(resolved_model.get("model", "")),
            "messages": [{"role": "user", "content": prompt_text}],
        }
        if isinstance(temperature, (int, float)):
            fallback_payload["temperature"] = temperature
        if isinstance(max_tokens, int) and max_tokens > 0:
            fallback_payload["max_tokens"] = max_tokens
        response = _post_json(f"{base_url}/chat/completions", fallback_payload, headers)

    stdout = _sanitize_output(node, _extract_response_text(response))
    return stdout, ""


def _post_json(url: str, payload: dict[str, object], headers: dict[str, str]) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RunFailure(
            "",
            f"LLM request failed: HTTP {exc.code}: {body[:500]}",
            error_type="llm_http_error",
        ) from exc
    except urllib.error.URLError as exc:
        raise RunFailure("", f"LLM request failed: {exc.reason}", error_type="llm_error") from exc
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RunFailure("", f"LLM response was not valid JSON: {body[:500]}", error_type="llm_error") from exc
    if not isinstance(parsed, dict):
        raise RunFailure("", "LLM response JSON must be an object", error_type="llm_error")
    return parsed


def _extract_response_text(response: dict[str, object]) -> str:
    output_text = response.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    output = response.get("output")
    if isinstance(output, list):
        parts: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                if block.get("type") in {"output_text", "text"} and isinstance(block.get("text"), str):
                    parts.append(str(block["text"]))
        if parts:
            return "".join(parts)

    choices = response.get("choices")
    if isinstance(choices, list) and choices:
        choice0 = choices[0]
        if isinstance(choice0, dict):
            message = choice0.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    parts = [block.get("text", "") for block in content if isinstance(block, dict) and isinstance(block.get("text"), str)]
                    if parts:
                        return "".join(parts)

    raise RunFailure("", f"LLM response did not contain text content: {json.dumps(response, ensure_ascii=False)[:500]}", error_type="llm_error")


def _read_env(provider_config: dict[str, object], key: str) -> str:
    import os

    env_name = str(provider_config.get(key, ""))
    value = os.environ.get(env_name, "")
    if not env_name or not value:
        raise RunFailure("", f"Missing required environment variable: {env_name}", error_type="llm_error")
    return value


def _normalize_base_url(base_url: str) -> str:
    normalized = base_url.rstrip("/")
    if normalized.endswith("/v1"):
        return normalized
    return f"{normalized}/v1"


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return text
    lines = stripped.splitlines()
    if len(lines) >= 3 and lines[0].startswith("```") and lines[-1].strip() == "```":
        body_lines = lines[1:-1]
        if body_lines and body_lines[0].strip().lower() in {"cpp", "c++"}:
            body_lines = body_lines[1:]
        body = "\n".join(body_lines).strip("\n")
        return f"{body}\n" if body else ""
    return text


def _sanitize_output(node: NodeSpec, text: str) -> str:
    produces = node.produces or ""
    if produces.endswith(".cpp"):
        return _sanitize_cpp_output(text)
    if produces.endswith(".md"):
        return _sanitize_markdown_output(text)
    return text


def _sanitize_cpp_output(text: str) -> str:
    cleaned = _strip_code_fence(text).strip()
    for marker in ["#include", "using namespace std;", "int main("]:
        index = cleaned.find(marker)
        if index != -1:
            cleaned = cleaned[index:]
            break
    return f"{cleaned}\n" if cleaned else ""


def _sanitize_markdown_output(text: str) -> str:
    cleaned = text.strip()
    lines = cleaned.splitlines()
    for index, line in enumerate(lines):
        if line.lstrip().startswith("#"):
            return "\n".join(lines[index:]).strip() + "\n"
    return f"{cleaned}\n" if cleaned else ""
