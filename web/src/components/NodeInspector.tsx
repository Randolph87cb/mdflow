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
      ["类型", localizeNodeType(data.node.type)],
      ["产物", data.node.produces || "无"],
      ["下一节点", data.node.next || "无"],
      ["重试", data.node.retry ? `最大尝试次数=${data.node.retry.max_attempts}` : "无"],
      ["默认下一节点", data.node.default_next || "无"],
      ["来源", localizeScope(data.source.scope || (mode === "run" ? "workflow snapshot" : "live workflow"))],
      ["路径", data.source.path],
    ];
    return lines;
  }, [data, mode]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <strong>{title || "节点检查器"}</strong>
          {data ? (
            <div className="subtle">
              {data.node.id} · {localizeScope(data.source.scope || (mode === "run" ? "workflow snapshot" : "live workflow"))}
            </div>
          ) : null}
        </div>
        {data ? <span className={`status-pill ${toneFromType(data.node.type)}`}>{localizeNodeType(data.node.type)}</span> : null}
      </div>
      <div className="tabs" role="tablist" aria-label="节点检查器标签页">
        <button type="button" className={tab === "source" ? "active" : ""} onClick={() => setTab("source")}>
          源码
        </button>
        <button type="button" className={tab === "meta" ? "active" : ""} onClick={() => setTab("meta")}>
          元数据
        </button>
      </div>
      {!data ? <div className="empty-state">请选择一个节点进行查看。</div> : null}
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
              <div className="meta-label">路由规则</div>
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

function localizeNodeType(type: string) {
  switch (type) {
    case "llm":
      return "LLM";
    case "script":
      return "脚本";
    case "router":
      return "路由";
    default:
      return type;
  }
}

function localizeScope(scope: string) {
  switch (scope) {
    case "workflow snapshot":
      return "工作流快照";
    case "live workflow":
      return "当前工作流";
    default:
      return scope;
  }
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
