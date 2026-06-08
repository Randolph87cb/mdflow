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
    background: "#0f172a",
    primaryColor: "#152034",
    primaryBorderColor: "#3f5872",
    primaryTextColor: "#e2e8f0",
    lineColor: "#4ade80",
    tertiaryColor: "#0f172a",
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
      const attemptLine = node.attempts ? `\\nattempt ${node.attempts}` : "";
      const label = sanitizeNodeLabel(`${node.id}\\n${node.type}${node.status ? `\\n${node.status}` : ""}${attemptLine}`);
      lines.push(`  ${nodeIdMap.get(node.id)}["${label}"]`);
    }
    for (const edge of edges) {
      const arrow = edge.kind === "route" || edge.kind === "default" ? "-->" : "-->";
      const edgeText = edge.kind === "default" ? "default" : edge.kind === "route" ? "route" : "";
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
