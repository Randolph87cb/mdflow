import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { NodeInspector } from "../components/NodeInspector";
import { OutputBrowser } from "../components/OutputBrowser";
import { OutputPreview } from "../components/OutputPreview";
import { RunStatusBar } from "../components/RunStatusBar";
import { TraceViewer } from "../components/TraceViewer";
import { WorkflowGraph } from "../components/WorkflowGraph";
import { studioApi } from "../lib/api";
import type { NodeInspectorData, OutputPreview as OutputPreviewType, RunDetail } from "../lib/types";

export function RunDetailPage() {
  const { workflowId = "", runId = "" } = useParams();
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeData, setNodeData] = useState<NodeInspectorData | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  const [outputPreview, setOutputPreview] = useState<OutputPreviewType | null>(null);
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>([]);
  const autoFocusedFailureRef = useRef<string | null>(null);

  async function loadRun() {
    const nextDetail = await studioApi.getRun(workflowId, runId);
    setDetail(nextDetail);
    const candidateNode =
      nextDetail.state.last_failure?.node_id ||
      nextDetail.state.current_node ||
      nextDetail.state.completed_nodes?.[nextDetail.state.completed_nodes.length - 1] ||
      nextDetail.graph.nodes[0]?.id ||
      null;
    const nodeIds = new Set(nextDetail.graph.nodes.map((node) => node.id));
    if (!selectedNodeId || !nodeIds.has(selectedNodeId)) {
      if (candidateNode) {
        setSelectedNodeId(candidateNode);
      }
      return;
    }
    const failedNode = nextDetail.state.last_failure?.node_id || null;
    if (failedNode && autoFocusedFailureRef.current !== failedNode) {
      autoFocusedFailureRef.current = failedNode;
      setSelectedNodeId(failedNode);
    }
    if (!failedNode) {
      autoFocusedFailureRef.current = null;
    }
  }

  async function loadNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setNodeData(await studioApi.getRunNode(workflowId, runId, nodeId));
  }

  async function loadOutput(name: string) {
    setSelectedOutput(name);
    setOutputPreview(await studioApi.getOutput(workflowId, runId, name));
  }

  useEffect(() => {
    loadRun().catch(console.error);
  }, [workflowId, runId]);

  useEffect(() => {
    if (!selectedNodeId) return;
    loadNode(selectedNodeId).catch(console.error);
  }, [selectedNodeId, workflowId, runId]);

  useEffect(() => {
    if (detail?.state.status !== "running") return;
    const timer = window.setInterval(() => {
      loadRun()
        .then(async () => {
          if (selectedNodeId) {
            setNodeData(await studioApi.getRunNode(workflowId, runId, selectedNodeId));
          }
        })
        .catch(console.error);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [detail?.state.status, runId, selectedNodeId, workflowId]);

  const downloadHref = useMemo(
    () => (selectedOutput ? studioApi.downloadOutput(workflowId, runId, selectedOutput) : null),
    [runId, selectedOutput, workflowId],
  );
  const selectedGraphNode = useMemo(
    () => detail?.graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [detail?.graph.nodes, selectedNodeId],
  );
  const failedNodeId = detail?.state.last_failure?.node_id ?? null;
  const traceSubtitle = selectedGraphNode
    ? `${selectedGraphNode.id} · ${localizeNodeType(selectedGraphNode.type)}${selectedGraphNode.status ? ` · ${localizeRunStatus(selectedGraphNode.status)}` : ""}`
    : "所选节点的执行证据。";

  return (
    <div className="page run-detail-page">
      {detail ? (
        <RunStatusBar
          workflowId={workflowId}
          runId={runId}
          status={detail.state.status}
          currentNode={detail.state.current_node}
          startedAt={detail.meta.started_at}
          finishedAt={detail.meta.finished_at}
          snapshotDir={detail.snapshot_dir}
          sourceRunId={detail.meta.source_run_id}
          rerunFromNode={detail.meta.rerun_from_node}
          completedCount={detail.state.completed_nodes?.length ?? 0}
          outputCount={detail.outputs.length}
        />
      ) : null}
      <div className="run-layout">
        <section className="panel run-graph-panel">
          <div className="panel-header">
            <div>
              <strong>运行图</strong>
              <div className="subtle">聚焦节点后可查看跟踪、快照定义以及重新运行边界。</div>
            </div>
            {selectedGraphNode ? <span className="metric-chip">{localizeNodeType(selectedGraphNode.type)}</span> : null}
          </div>
          <WorkflowGraph
            nodes={detail?.graph.nodes ?? []}
            edges={detail?.graph.edges ?? []}
            selectedNodeId={selectedNodeId}
            onSelectNode={loadNode}
          />
          <div className="run-graph-footer">
            <div className="selected-node-card">
              <div className="selected-node-header">
                <strong>{selectedGraphNode?.id || "未选择节点"}</strong>
                {selectedGraphNode ? (
                  <span className={`status-pill ${toneFromNodeStatus(selectedGraphNode.status)}`}>
                    {selectedGraphNode.status ? localizeRunStatus(selectedGraphNode.status) : localizeNodeType(selectedGraphNode.type)}
                  </span>
                ) : null}
              </div>
              <div className="subtle">
                {selectedGraphNode
                  ? `类型 ${localizeNodeType(selectedGraphNode.type)} · 尝试 ${selectedGraphNode.attempts ?? 0} 次${failedNodeId === selectedGraphNode.id ? " · 最近失败节点" : ""}`
                  : "选择图中的节点后，可查看执行跟踪并从该节点重新运行。"}
              </div>
            </div>
            {selectedNodeId ? (
              <button
                className="primary-button full-width-button"
                onClick={async () => {
                  const result = await studioApi.rerun(workflowId, runId, { from_node: selectedNodeId });
                  window.location.href = `/workflows/${workflowId}/runs/${result.run_id}`;
                }}
              >
                从所选节点重新运行
              </button>
            ) : null}
          </div>
        </section>
        <div className="run-center">
          <TraceViewer trace={nodeData?.trace ?? null} title="执行跟踪" subtitle={traceSubtitle} />
          <NodeInspector data={nodeData} title="快照节点定义" mode="run" />
        </div>
        <div className="run-right">
          <OutputBrowser
            items={detail?.outputs ?? []}
            selected={selectedOutputs}
            active={selectedOutput}
            onSelect={loadOutput}
            onToggle={(name) =>
              setSelectedOutputs((current) =>
                current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
              )
            }
            onDownloadZip={async () => {
              const blob = await studioApi.downloadOutputsZip(workflowId, runId, selectedOutputs.length ? selectedOutputs : undefined);
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${workflowId}-${runId}-outputs.zip`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          />
          <OutputPreview data={outputPreview} downloadHref={downloadHref} />
        </div>
      </div>
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

function toneFromNodeStatus(status?: string) {
  switch ((status || "").toLowerCase()) {
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
