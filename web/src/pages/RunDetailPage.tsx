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

  return (
    <div className="page run-detail-page">
      {detail ? (
        <RunStatusBar
          workflowId={workflowId}
          runId={runId}
          status={detail.state.status}
          currentNode={detail.state.current_node}
          startedAt={detail.meta.started_at}
          snapshotDir={detail.snapshot_dir}
        />
      ) : null}
      <div className="run-layout">
        <section className="panel">
          <div className="panel-header">
            <strong>Run Graph</strong>
          </div>
          <WorkflowGraph
            nodes={detail?.graph.nodes ?? []}
            edges={detail?.graph.edges ?? []}
            selectedNodeId={selectedNodeId}
            onSelectNode={loadNode}
          />
          {selectedNodeId ? (
            <button
              className="full-width-button"
              onClick={async () => {
                const result = await studioApi.rerun(workflowId, runId, { from_node: selectedNodeId });
                window.location.href = `/workflows/${workflowId}/runs/${result.run_id}`;
              }}
            >
              Rerun from {selectedNodeId}
            </button>
          ) : null}
        </section>
        <div className="run-center">
          <TraceViewer trace={nodeData?.trace ?? null} />
          <NodeInspector data={nodeData} title="Node Inspector" />
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
