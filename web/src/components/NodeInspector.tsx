import { useMemo, useState } from "react";
import type { NodeInspectorData } from "../lib/types";

type Props = {
  data: NodeInspectorData | null;
  title?: string;
  mode?: "workflow" | "run";
};

export function NodeInspector({ data, title, mode = "run" }: Props) {
  const [tab, setTab] = useState<"source" | "meta">("source");
  const metaLines = useMemo(() => {
    if (!data) {
      return [];
    }
    const lines = [
      ["Type", data.node.type],
      ["Produces", data.node.produces || "none"],
      ["Next", data.node.next || "null"],
      ["Retry", data.node.retry ? `max_attempts=${data.node.retry.max_attempts}` : "none"],
      ["Default next", data.node.default_next || "null"],
      ["Source", data.source.scope || (mode === "run" ? "workflow snapshot" : "live workflow")],
      ["Path", data.source.path],
    ];
    return lines;
  }, [data, mode]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <strong>{title || "Node Inspector"}</strong>
          {data ? <div className="subtle">{data.node.id} · {data.source.scope || (mode === "run" ? "workflow snapshot" : "live workflow")}</div> : null}
        </div>
        {data ? <span className={`status-pill ${toneFromType(data.node.type)}`}>{data.node.type}</span> : null}
      </div>
      <div className="tabs">
        <button className={tab === "source" ? "active" : ""} onClick={() => setTab("source")}>
          Source
        </button>
        <button className={tab === "meta" ? "active" : ""} onClick={() => setTab("meta")}>
          Meta
        </button>
      </div>
      {!data ? <div className="empty-state">Select a node to inspect.</div> : null}
      {data && tab === "source" ? <pre className="code-block">{data.source.content}</pre> : null}
      {data && tab === "meta" ? (
        <div className="inspector-meta">
          {metaLines.map(([label, value]) => (
            <div key={label} className="inspector-meta-row">
              <span className="meta-label">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          {data.node.routes && data.node.routes.length ? (
            <div className="inspector-route-list">
              <div className="meta-label">Routes</div>
              {data.node.routes.map((route, index) => (
                <div key={`${route.source}-${route.next}-${index}`} className="inspector-route-card">
                  <strong>{route.source}</strong>
                  <span className="subtle">
                    {route.operator} {String(route.value)} {"->"} {route.next}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
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
