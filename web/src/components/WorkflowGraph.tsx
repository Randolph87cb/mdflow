import mermaid from "mermaid";
import { useEffect, useMemo, useRef } from "react";
import type { GraphEdge, GraphNode } from "../lib/types";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
};

mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "neutral" });

export function WorkflowGraph({ nodes, edges, selectedNodeId, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphDef = useMemo(() => {
    const lines = ["flowchart LR"];
    for (const node of nodes) {
      const label = sanitizeNodeLabel(`${node.id}\\n${node.type}${node.status ? `\\n${node.status}` : ""}`);
      lines.push(`  ${safe(node.id)}["${label}"]`);
    }
    for (const edge of edges) {
      const arrow = edge.kind === "route" || edge.kind === "default" ? "-->" : "-->";
      const edgeText = edge.kind === "default" ? "default" : edge.kind === "route" ? "route" : "";
      const label = edgeText ? `|${edgeText}|` : "";
      lines.push(`  ${safe(edge.from)} ${arrow}${label} ${safe(edge.to)}`);
    }
    return lines.join("\n");
  }, [edges, nodes]);

  useEffect(() => {
    let disposed = false;
    async function render() {
      const id = `graph-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, graphDef);
      if (!disposed && containerRef.current) {
        containerRef.current.innerHTML = svg;
        const root = containerRef.current;
        root.querySelectorAll(".node").forEach((element) => {
          const nodeId = (element as SVGGElement).id.replace(/^flowchart-/, "");
          (element as HTMLElement).style.cursor = "pointer";
          element.addEventListener("click", () => onSelectNode?.(nodeId));
          if (selectedNodeId && nodeId.endsWith(safe(selectedNodeId))) {
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
  }, [graphDef, onSelectNode, selectedNodeId]);

  return <div className="graph-panel" ref={containerRef} />;
}

function safe(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function sanitizeNodeLabel(value: string) {
  return value.replace(/"/g, '\\"');
}
