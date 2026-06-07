import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CopyWorkflowDialog } from "../components/CopyWorkflowDialog";
import { NodeEditorDrawer } from "../components/NodeEditorDrawer";
import { NodeInspector } from "../components/NodeInspector";
import { RunDialog } from "../components/RunDialog";
import { WorkflowGraph } from "../components/WorkflowGraph";
import { studioApi } from "../lib/api";
import type { NodeInspectorData, NodeSummary, RunSummary, WorkflowDetail } from "../lib/types";

export function WorkflowDetailPage() {
  const { workflowId = "" } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeContent, setNodeContent] = useState("");
  const [runOpen, setRunOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const inspectorData = useMemo<NodeInspectorData | null>(() => {
    const node = nodes.find((item) => item.id === selectedNodeId);
    if (!node || !nodeContent) return null;
    return {
      node: { id: node.id, type: node.type, name: node.name, produces: node.produces, next: node.next },
      source: { path: node.path, content: nodeContent },
      trace: { attempt: 0, input: null, prompt: null, stdout: null, stderr: null, output: null },
    };
  }, [nodeContent, nodes, selectedNodeId]);

  async function loadAll() {
    const [workflowValue, graphValue, nodesValue, runsValue] = await Promise.all([
      studioApi.getWorkflow(workflowId),
      studioApi.getWorkflowGraph(workflowId),
      studioApi.listNodes(workflowId),
      studioApi.listRuns(workflowId),
    ]);
    setWorkflow(workflowValue);
    setGraph(graphValue);
    setNodes(nodesValue);
  setRuns(runsValue);
  }

  async function loadNode(nodeId: string) {
    const node = await studioApi.getNode(workflowId, nodeId);
    setSelectedNodeId(nodeId);
    setNodeContent(node.content);
  }

  useEffect(() => {
    loadAll().catch(console.error);
  }, [workflowId]);

  return (
    <div className="page workflow-detail-page">
      <section className="workspace-header panel">
        <div className="workspace-heading">
          <div className="eyebrow">Workflow</div>
          <strong>{workflow?.workflow_id}</strong>
          <div className="subtle">{workflow?.workflow_path}</div>
        </div>
        <div className="workspace-summary">
          <div className="summary-chip">
            <span className="meta-label">Entry</span>
            <strong>{workflow?.entry || "-"}</strong>
          </div>
          <div className="summary-chip">
            <span className="meta-label">Nodes</span>
            <strong>{nodes.length}</strong>
          </div>
          <div className="summary-chip">
            <span className="meta-label">Outputs</span>
            <strong>{workflow?.final_outputs.length || 0}</strong>
          </div>
        </div>
        <div className="actions-cell">
          <button className="primary-button" onClick={() => setRunOpen(true)}>
            Run workflow
          </button>
          <button className="ghost-button" onClick={() => setCopyOpen(true)}>
            Copy workflow
          </button>
        </div>
      </section>
      <div className="workspace-layout">
        <aside className="workspace-sidebar panel">
          <div className="panel-header">
            <strong>Nodes</strong>
          </div>
          <div className="list-panel">
            {nodes.map((node) => (
              <button key={node.id} className={`list-row ${selectedNodeId === node.id ? "selected" : ""}`} onClick={() => loadNode(node.id)}>
                <span>{node.id}</span>
                <span className={`status-pill ${toneFromNodeType(node.type)}`}>{node.type}</span>
              </button>
            ))}
          </div>
          <div className="panel-header">
            <strong>Recent runs</strong>
          </div>
          <div className="list-panel">
            {runs.map((run) => (
              <button key={run.run_id} className="list-row" onClick={() => navigate(`/workflows/${workflowId}/runs/${run.run_id}`)}>
                <span>{run.run_id}</span>
                <span className={`status-pill ${toneFromRunStatus(run.status)}`}>{run.status}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="workspace-main panel">
          <div className="panel-header">
            <div>
              <strong>Node graph</strong>
              <div className="subtle">Click a node to inspect source and edit the live workflow definition.</div>
            </div>
          </div>
          <WorkflowGraph nodes={graph.nodes} edges={graph.edges} selectedNodeId={selectedNodeId} onSelectNode={loadNode} />
        </section>
        <aside className="workspace-inspector">
          <NodeInspector data={inspectorData} title="Node Source" />
          {selectedNodeId ? (
            <button className="primary-button full-width-button" onClick={() => setEditorOpen(true)}>
              Edit node
            </button>
          ) : null}
        </aside>
      </div>
      <RunDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onSubmit={async (payload) => {
          const result = await studioApi.createRun(workflowId, payload);
          setRunOpen(false);
          navigate(`/workflows/${workflowId}/runs/${result.run_id}`);
        }}
      />
      <CopyWorkflowDialog
        open={copyOpen}
        workflowId={workflowId}
        onClose={() => setCopyOpen(false)}
        onSubmit={async (_workflowId, payload) => {
          const result = await studioApi.copyWorkflow(workflowId, payload);
          setCopyOpen(false);
          navigate(`/workflows/${result.workflow_id}`);
        }}
      />
      <NodeEditorDrawer
        open={editorOpen}
        workflowId={workflowId}
        nodeId={selectedNodeId}
        initialContent={nodeContent}
        onClose={() => setEditorOpen(false)}
        onSave={async (content) => {
          if (!selectedNodeId) return;
          await studioApi.updateNode(workflowId, selectedNodeId, content);
          setEditorOpen(false);
          await loadAll();
          await loadNode(selectedNodeId);
        }}
      />
    </div>
  );
}

function toneFromNodeType(type: string) {
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

function toneFromRunStatus(status: string) {
  switch (status.toLowerCase()) {
    case "success":
      return "success";
    case "failed":
      return "failed";
    case "running":
      return "running";
    default:
      return "idle";
  }
}
