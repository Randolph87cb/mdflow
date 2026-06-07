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
  const nodeIdMap = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((node, index) => {
      map.set(node.id, `node_${index}`);
    });
    return map;
  }, [nodes]);
  const renderedIdToNodeId = useMemo(() => {
    return new Map<string, string>(Array.from(nodeIdMap.entries(), ([nodeId, renderedId]) => [renderedId, nodeId]));
  }, [nodeIdMap]);
  const graphDef = useMemo(() => {
    const lines = ["flowchart LR"];
    for (const node of nodes) {
      const label = sanitizeNodeLabel(`${node.id}\\n${node.type}${node.status ? `\\n${node.status}` : ""}`);
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
        root.querySelectorAll(".node").forEach((element) => {
          const renderedNodeId = (element as SVGGElement).id.replace(/^flowchart-/, "");
          const nodeId = renderedIdToNodeId.get(renderedNodeId);
          if (!nodeId) {
            return;
          }
          (element as HTMLElement).style.cursor = "pointer";
          element.addEventListener("click", () => onSelectNode?.(nodeId));
          if (selectedNodeId === nodeId) {
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
  }, [graphDef, onSelectNode, renderedIdToNodeId, selectedNodeId]);

  return <div className="graph-panel" ref={containerRef} />;
}

function sanitizeNodeLabel(value: string) {
  return value.replace(/"/g, '\\"');
}
