import { useMemo, useState } from "react";
import type { NodeInspectorData } from "../lib/types";

type Props = {
  data: NodeInspectorData | null;
  title?: string;
};

export function NodeInspector({ data, title }: Props) {
  const [tab, setTab] = useState<"source" | "trace" | "output">("source");
  const traceText = useMemo(() => {
    if (!data) {
      return "";
    }
    return [
      data.trace.input ? `## Input\n${data.trace.input}` : "",
      data.trace.prompt ? `## Prompt\n${data.trace.prompt}` : "",
      data.trace.stdout ? `## Stdout\n${data.trace.stdout}` : "",
      data.trace.stderr ? `## Stderr\n${data.trace.stderr}` : "",
      data.trace.route_selected
        ? `## Route\nselected_next: ${data.trace.route_selected.selected_next ?? ""}\nsource: ${data.trace.route_selected.route_source ?? ""}\noperator: ${data.trace.route_selected.route_operator ?? ""}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [data]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <strong>{title || "Node Inspector"}</strong>
          {data ? <div className="subtle">{data.node.id}</div> : null}
        </div>
        {data ? <span className={`status-pill ${toneFromType(data.node.type)}`}>{data.node.type}</span> : null}
      </div>
      <div className="tabs">
        <button className={tab === "source" ? "active" : ""} onClick={() => setTab("source")}>
          Source
        </button>
        <button className={tab === "trace" ? "active" : ""} onClick={() => setTab("trace")}>
          Trace
        </button>
        <button className={tab === "output" ? "active" : ""} onClick={() => setTab("output")}>
          Output
        </button>
      </div>
      {!data ? <div className="empty-state">Select a node to inspect.</div> : null}
      {data && tab === "source" ? <pre className="code-block">{data.source.content}</pre> : null}
      {data && tab === "trace" ? <pre className="code-block">{traceText || "No trace available."}</pre> : null}
      {data && tab === "output" ? <pre className="code-block">{data.trace.output || "No output preview available."}</pre> : null}
    </section>
  );
}

function toneFromType(type: string) {
  switch (type) {
    case "llm":
      return "running";
    case "script":
      return "idle";
    case "router":
      return "success";
    default:
      return "idle";
  }
}
