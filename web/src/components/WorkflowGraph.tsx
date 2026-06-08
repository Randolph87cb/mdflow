import mermaid from "mermaid";
import { useEffect, useMemo, useRef } from "react";
import type { GraphEdge, GraphNode } from "../lib/types";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
};

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "base",
  themeVariables: {
    background: "#fffaf7",
    primaryColor: "#ffffff",
    primaryBorderColor: "#cdb8ff",
    primaryTextColor: "#4d5a77",
    lineColor: "#8da8ff",
    tertiaryColor: "#fff7fb",
    fontFamily: '"JetBrains Mono", monospace',
  },
});

export function WorkflowGraph({ nodes, edges, selectedNodeId, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeIdMap = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((node, index) => {
      map.set(node.id, `node_${index}`);
    });
    return map;
  }, [nodes]);
  const graphDef = useMemo(() => {
    const lines = ["flowchart LR"];
    for (const node of nodes) {
      const attemptLine = node.attempts ? `\\n尝试 ${node.attempts}` : "";
      const label = sanitizeNodeLabel(
        `${node.id}\\n${localizeNodeType(node.type)}${node.status ? `\\n${localizeRunStatus(node.status)}` : ""}${attemptLine}`,
      );
      lines.push(`  ${nodeIdMap.get(node.id)}["${label}"]`);
    }
    for (const edge of edges) {
      const arrow = edge.kind === "route" || edge.kind === "default" ? "-->" : "-->";
      const edgeText = edge.kind === "default" ? "默认" : edge.kind === "route" ? "路由" : "";
      const label = edgeText ? `|${edgeText}|` : "";
      const fromId = nodeIdMap.get(edge.from);
      const toId = nodeIdMap.get(edge.to);
      if (fromId && toId) {
        lines.push(`  ${fromId} ${arrow}${label} ${toId}`);
      }
    }
    return lines.join("\n");
  }, [edges, nodeIdMap, nodes]);

  useEffect(() => {
    let disposed = false;
    async function render() {
      const id = `graph-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, graphDef);
      if (!disposed && containerRef.current) {
        containerRef.current.innerHTML = svg;
        const root = containerRef.current;
        Array.from(root.querySelectorAll(".node")).forEach((element, index) => {
          const node = nodes[index];
          if (!node) {
            return;
          }
          (element as HTMLElement).style.cursor = "pointer";
          element.classList.add(`graph-node-status-${(node.status || node.type || "idle").toLowerCase()}`);
          element.addEventListener("click", () => onSelectNode?.(node.id));
          if (selectedNodeId === node.id) {
            (element as HTMLElement).classList.add("graph-node-selected");
          }
        });
      }
    }
    render().catch(() => {
      if (containerRef.current) {
        containerRef.current.textContent = graphDef;
      }
    });
    return () => {
      disposed = true;
    };
  }, [graphDef, nodes, onSelectNode, selectedNodeId]);

  return <div className="graph-panel" ref={containerRef} />;
}

function sanitizeNodeLabel(value: string) {
  return value.replace(/"/g, '\\"');
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

function localizeRunStatus(status: string) {
  switch (status.toLowerCase()) {
    case "success":
      return "成功";
    case "failed":
      return "失败";
    case "running":
      return "运行中";
    case "idle":
      return "空闲";
    default:
      return status;
  }
}
