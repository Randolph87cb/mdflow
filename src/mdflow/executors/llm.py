from __future__ import annotations

import textwrap

from mdflow.errors import RunFailure
from mdflow.models import NodeSpec


def run_llm_node(node: NodeSpec, prompt_text: str, resolved_model: dict[str, object]) -> tuple[str, str]:
    provider = str(resolved_model.get("provider", ""))
    if provider != "mock":
        raise RunFailure(
            node.id,
            f"provider '{provider}' is not supported in phase one runtime",
            error_type="llm_error",
        )

    produces = node.produces or ""
    if produces.endswith(".cpp"):
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
