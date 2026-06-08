import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  const selectedNode = nodes.find((item) => item.id === selectedNodeId) ?? null;

  const inspectorData = useMemo<NodeInspectorData | null>(() => {
    const node = nodes.find((item) => item.id === selectedNodeId);
    if (!node || !nodeContent) return null;
    return {
      node,
      source: { path: node.path, scope: "当前工作流", content: nodeContent },
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
          <div className="workspace-breadcrumbs">
            <Link className="subtle-link" to="/">
              工作流总览
            </Link>
            <span className="subtle">/</span>
            <span className="subtle">定义</span>
          </div>
          <div className="eyebrow">当前工作流</div>
          <strong>{workflow?.workflow_id}</strong>
          <div className="subtle">{workflow?.name || "基于 Markdown 定义的本地工作流"}</div>
          <div className="workspace-path">{workflow?.workflow_path}</div>
        </div>
        <div className="workspace-summary">
          <div className="summary-chip">
            <span className="meta-label">入口节点</span>
            <strong>{workflow?.entry || "-"}</strong>
          </div>
          <div className="summary-chip">
            <span className="meta-label">节点数</span>
            <strong>{nodes.length}</strong>
          </div>
          <div className="summary-chip">
            <span className="meta-label">最近运行</span>
            <strong>{runs.length}</strong>
          </div>
          <div className="summary-chip">
            <span className="meta-label">最终产物</span>
            <strong>{workflow?.final_outputs.length || 0}</strong>
          </div>
        </div>
        <div className="actions-cell">
          <button className="primary-button" onClick={() => setRunOpen(true)}>
            运行工作流
          </button>
          <button className="ghost-button" onClick={() => setCopyOpen(true)}>
            复制工作流
          </button>
        </div>
      </section>
      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <section className="panel">
            <div className="panel-header">
              <div>
                <strong>节点</strong>
                <div className="subtle">选择节点后可查看当前 Markdown 源码。</div>
              </div>
              <span className="metric-chip">{nodes.length}</span>
            </div>
            <div className="list-panel">
              {nodes.map((node) => (
                <button
                  key={node.id}
                  className={`list-row list-row-stack ${selectedNodeId === node.id ? "selected" : ""}`}
                  onClick={() => loadNode(node.id)}
                >
                  <div className="list-row-main">
                    <strong>{node.id}</strong>
                    <div className="subtle">{node.produces || node.path}</div>
                  </div>
                  <span className={`status-pill ${toneFromNodeType(node.type)}`}>{localizeNodeType(node.type)}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div>
                <strong>最近运行</strong>
                <div className="subtle">从定义页直接跳转到某次执行快照。</div>
              </div>
              <span className="metric-chip">{runs.length}</span>
            </div>
            <div className="list-panel">
              {runs.map((run) => (
                <button
                  key={run.run_id}
                  className="list-row list-row-stack"
                  onClick={() => navigate(`/workflows/${workflowId}/runs/${run.run_id}`)}
                >
                  <div className="list-row-main">
                    <strong>{run.run_id}</strong>
                    <div className="subtle">{run.started_at}</div>
                  </div>
                  <span className={`status-pill ${toneFromRunStatus(run.status)}`}>{localizeRunStatus(run.status)}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
        <section className="workspace-main panel">
          <div className="panel-header">
            <div>
              <strong>定义图</strong>
              <div className="subtle">先理解结构，再查看或编辑所选节点。</div>
            </div>
            {selectedNode ? <span className="metric-chip">已选 {selectedNode.id}</span> : null}
          </div>
          <WorkflowGraph nodes={graph.nodes} edges={graph.edges} selectedNodeId={selectedNodeId} onSelectNode={loadNode} />
        </section>
        <aside className="workspace-inspector">
          <section className="panel inspector-note-panel">
            <div className="panel-header">
              <div>
                <strong>工作流产物</strong>
                <div className="subtle">当前定义声明的最终交付物。</div>
              </div>
            </div>
            <div className="tag-cloud">
              {(workflow?.final_outputs || []).map((output) => (
                <span key={output} className="tag-chip">
                  {output}
                </span>
              ))}
              {!workflow?.final_outputs.length ? <div className="empty-state">未声明最终产物。</div> : null}
            </div>
          </section>
          <NodeInspector data={inspectorData} title="当前节点定义" mode="workflow" />
          {selectedNodeId ? (
            <button className="primary-button full-width-button" onClick={() => setEditorOpen(true)}>
              编辑节点
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
    default:
      return "空闲";
  }
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
