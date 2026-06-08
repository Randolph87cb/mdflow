import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CopyWorkflowDialog } from "./CopyWorkflowDialog";
import { RunDialog } from "./RunDialog";
import { WorkflowGraph } from "./WorkflowGraph";
import { WorkflowTable } from "./WorkflowTable";
import { studioApi } from "../lib/api";
import type { WorkflowDetail, WorkflowSummary } from "../lib/types";
import {
  toWorkflowLayoutStyle,
  type WorkflowLayoutId,
  type WorkflowLayoutOverrides,
  WORKFLOW_LAYOUT_LABELS,
} from "../lib/workflowLayoutInspector";

type GraphData = {
  nodes: any[];
  edges: any[];
};

type WorkflowOverviewWorkbenchProps = {
  inspector?: {
    enabled: boolean;
    selectedId: WorkflowLayoutId | null;
    overrides: WorkflowLayoutOverrides;
    onSelect: (layoutId: WorkflowLayoutId) => void;
  };
};

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [] };

export function WorkflowOverviewWorkbench({ inspector }: WorkflowOverviewWorkbenchProps) {
  const [items, setItems] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  const [graph, setGraph] = useState<GraphData>(EMPTY_GRAPH);
  const [runWorkflowId, setRunWorkflowId] = useState<string | null>(null);
  const [copyWorkflowId, setCopyWorkflowId] = useState<string | null>(null);
  const navigate = useNavigate();
  const inspectorEnabled = Boolean(inspector?.enabled);

  const workflowCount = items.length;
  const selectedSummary = items.find((item) => item.workflow_id === selectedWorkflowId) ?? null;
  const selectedLatestRun = selectedSummary?.latest_run ?? null;

  const headlineStatus = useMemo(() => {
    if (!selectedLatestRun) return { label: "等待运行", tone: "idle" };
    switch (selectedLatestRun.status.toLowerCase()) {
      case "success":
        return { label: "最近运行成功", tone: "success" };
      case "failed":
        return { label: "最近运行失败", tone: "failed" };
      case "running":
        return { label: "当前有运行中任务", tone: "running" };
      default:
        return { label: "等待运行", tone: "idle" };
    }
  }, [selectedLatestRun]);

  async function load() {
    const workflows = await studioApi.listWorkflows();
    setItems(workflows);
    setSelectedWorkflowId((current) => {
      if (current && workflows.some((item) => item.workflow_id === current)) {
        return current;
      }
      return pickInitialWorkflowId(workflows);
    });
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedWorkflowId) {
      setSelectedWorkflow(null);
      setGraph(EMPTY_GRAPH);
      return;
    }

    let active = true;
    Promise.all([studioApi.getWorkflow(selectedWorkflowId), studioApi.getWorkflowGraph(selectedWorkflowId)])
      .then(([workflow, graphValue]) => {
        if (!active) return;
        setSelectedWorkflow(workflow);
        setGraph(graphValue);
      })
      .catch((error) => {
        if (!active) return;
        console.error(error);
        setSelectedWorkflow(null);
        setGraph(EMPTY_GRAPH);
      });

    return () => {
      active = false;
    };
  }, [selectedWorkflowId]);

  function getInspectableProps(layoutId: WorkflowLayoutId, className: string) {
    const selected = inspector?.selectedId === layoutId;
    const style = toWorkflowLayoutStyle(inspector?.overrides?.[layoutId]);

    if (!inspectorEnabled) {
      return { className, style };
    }

    return {
      className: [
        className,
        "layout-inspectable",
        selected ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" "),
      style,
      onClick: (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        inspector?.onSelect(layoutId);
      },
      "data-layout-id": layoutId,
      "data-layout-label": WORKFLOW_LAYOUT_LABELS[layoutId],
    };
  }

  function wrapPassiveContent(children: ReactNode) {
    if (!inspectorEnabled) return children;
    return <div className="layout-inspector-passive">{children}</div>;
  }

  return (
    <div className={"page workflow-list-page workflow-overview-page" + (inspectorEnabled ? " workflow-overview-page-inspector" : "")}>
      <section {...getInspectableProps("hero", "workflow-overview-hero panel")}>
        {wrapPassiveContent(
          selectedWorkflowId ? (
            <>
              <div className="workflow-current-main">
                <div className="eyebrow">当前工作流</div>
                <div className="workflow-current-heading">
                  <h1>{selectedWorkflow?.workflow_id || selectedWorkflowId}</h1>
                  <span className={`status-pill ${headlineStatus.tone}`}>{headlineStatus.label}</span>
                </div>
                <div className="workflow-current-name">
                  {selectedWorkflow?.name || selectedSummary?.name || "未命名工作流"}
                </div>
                <div className="workflow-current-path-block">
                  <span className="meta-label">工作流路径</span>
                  <div className="workflow-current-path">
                    {selectedWorkflow?.workflow_path || "正在加载工作流路径..."}
                  </div>
                </div>
              </div>

              <div className="workflow-current-meta">
                <div className="workflow-current-card">
                  <span className="meta-label">入口节点</span>
                  <strong>{selectedWorkflow?.entry || "-"}</strong>
                </div>
                <div className="workflow-current-card">
                  <span className="meta-label">节点数</span>
                  <strong>{selectedWorkflow?.node_count ?? selectedSummary?.node_count ?? 0}</strong>
                </div>
                <div className="workflow-current-card">
                  <span className="meta-label">最终产物</span>
                  <strong>{selectedWorkflow?.final_outputs.length ?? 0} 个</strong>
                </div>
                <div className="workflow-current-card">
                  <span className="meta-label">最新状态</span>
                  <strong>{headlineStatus.label}</strong>
                </div>
                <div className="workflow-current-card">
                  <span className="meta-label">最新运行时间</span>
                  <strong>{selectedLatestRun?.started_at || "暂无运行"}</strong>
                </div>
                <div className="workflow-current-card">
                  <span className="meta-label">最新运行 ID</span>
                  <strong>{selectedLatestRun?.run_id || "暂无运行"}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="workflow-current-empty">
              <div className="eyebrow">当前工作流</div>
              <strong>请选择左侧工作流</strong>
              <div className="subtle">选中后会在这里显示当前工作流摘要、最新状态和路径信息。</div>
            </div>
          ),
        )}
      </section>

      <section {...getInspectableProps("layout", "workflow-overview-layout")}>
        <aside {...getInspectableProps("sidebar", "workflow-overview-sidebar panel")}>
          {wrapPassiveContent(
            <>
              <div className="panel-header workflow-overview-panel-header">
                <div>
                  <strong>现有工作流</strong>
                  <div className="subtle">选择一个工作流，右侧会更新总览信息、按钮目标和结构图。</div>
                </div>
                <span className="metric-chip">共 {workflowCount} 个</span>
              </div>
              <WorkflowTable
                items={items}
                selectedWorkflowId={selectedWorkflowId}
                onSelect={setSelectedWorkflowId}
                emptyCopy="当前本地工作区中没有找到工作流。"
              />
            </>,
          )}
        </aside>

        <div {...getInspectableProps("main", "workflow-overview-main")}>
          <section {...getInspectableProps("actions", "workflow-overview-actions panel")}>
            {wrapPassiveContent(
              <>
                <div className="panel-header workflow-overview-panel-header">
                  <div>
                    <strong>关键操作</strong>
                    <div className="subtle">四个动作入口固定在这里，不再把历史运行、定义或产物塞进首页首屏。</div>
                  </div>
                </div>
                <div className="workflow-overview-action-grid">
                  <button
                    className="workflow-overview-action-card"
                    type="button"
                    onClick={() => {
                      if (!selectedWorkflowId || !selectedLatestRun || inspectorEnabled) return;
                      navigate(`/workflows/${selectedWorkflowId}/runs/${selectedLatestRun.run_id}`);
                    }}
                    disabled={inspectorEnabled || !selectedWorkflowId || !selectedLatestRun}
                  >
                    <span className="meta-label">最新运行</span>
                    <strong>打开最新运行</strong>
                    <span className="subtle">
                      {selectedLatestRun ? selectedLatestRun.run_id : "当前工作流还没有运行记录"}
                    </span>
                  </button>
                  <button
                    className="workflow-overview-action-card"
                    type="button"
                    onClick={() => {
                      if (!selectedWorkflowId || inspectorEnabled) return;
                      navigate(`/workflows/${selectedWorkflowId}`);
                    }}
                    disabled={inspectorEnabled || !selectedWorkflowId}
                  >
                    <span className="meta-label">详情页</span>
                    <strong>历史运行列表</strong>
                    <span className="subtle">跳转到工作流详情页面查看历史运行与节点定义。</span>
                  </button>
                  <button
                    className="workflow-overview-action-card workflow-overview-action-card-primary"
                    type="button"
                    onClick={() => {
                      if (!selectedWorkflowId || inspectorEnabled) return;
                      setRunWorkflowId(selectedWorkflowId);
                    }}
                    disabled={inspectorEnabled || !selectedWorkflowId}
                  >
                    <span className="meta-label">执行</span>
                    <strong>运行</strong>
                    <span className="subtle">打开运行面板，创建新的执行记录。</span>
                  </button>
                  <button
                    className="workflow-overview-action-card"
                    type="button"
                    onClick={() => {
                      if (!selectedWorkflowId || inspectorEnabled) return;
                      setCopyWorkflowId(selectedWorkflowId);
                    }}
                    disabled={inspectorEnabled || !selectedWorkflowId}
                  >
                    <span className="meta-label">分支</span>
                    <strong>复制</strong>
                    <span className="subtle">复制当前工作流，生成新的本地变体继续编辑。</span>
                  </button>
                </div>
              </>,
            )}
          </section>

          <section {...getInspectableProps("graph", "workflow-overview-graph panel")}>
            {wrapPassiveContent(
              <>
                <div className="panel-header workflow-overview-panel-header">
                  <div>
                    <strong>节点图预览</strong>
                    <div className="subtle">这里只负责快速理解结构，不显示源码、历史运行详情或产物预览。</div>
                  </div>
                  <div className="workflow-overview-graph-meta">
                    <span className="metric-chip">入口 {selectedWorkflow?.entry || "-"}</span>
                    <span className="metric-chip">
                      节点 {selectedWorkflow?.node_count ?? selectedSummary?.node_count ?? 0}
                    </span>
                    <span className="metric-chip">产物 {selectedWorkflow?.final_outputs.length ?? 0}</span>
                  </div>
                </div>
                {selectedWorkflow ? (
                  <div className="workflow-overview-graph-frame">
                    <div className="workflow-overview-graph-info">
                      <div>
                        <span className="meta-label">工作流路径</span>
                        <div className="workflow-overview-path">{selectedWorkflow.workflow_path}</div>
                      </div>
                      <div className="workflow-overview-graph-badges">
                        <span className={`status-pill ${headlineStatus.tone}`}>{headlineStatus.label}</span>
                        <span className="metric-chip">最新运行 {selectedLatestRun?.started_at || "-"}</span>
                      </div>
                    </div>
                    <div className="workflow-overview-graph-surface">
                      <WorkflowGraph nodes={graph.nodes} edges={graph.edges} />
                    </div>
                  </div>
                ) : (
                  <div className="empty-state workflow-overview-empty">
                    当前没有可展示的工作流。请先在左侧选择一个工作流，或检查本地工作区是否已加载内容。
                  </div>
                )}
              </>,
            )}
          </section>
        </div>
      </section>

      {!inspectorEnabled ? (
        <>
          <RunDialog
            open={Boolean(runWorkflowId)}
            onClose={() => setRunWorkflowId(null)}
            onSubmit={async (payload) => {
              if (!runWorkflowId) return;
              const result = await studioApi.createRun(runWorkflowId, payload);
              setRunWorkflowId(null);
              navigate(`/workflows/${runWorkflowId}/runs/${result.run_id}`);
            }}
          />
          <CopyWorkflowDialog
            open={Boolean(copyWorkflowId)}
            workflowId={copyWorkflowId}
            onClose={() => setCopyWorkflowId(null)}
            onSubmit={async (workflowId, payload) => {
              const result = await studioApi.copyWorkflow(workflowId, payload);
              setCopyWorkflowId(null);
              await load();
              navigate(`/workflows/${result.workflow_id}`);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function pickInitialWorkflowId(items: WorkflowSummary[]) {
  if (!items.length) return null;
  const recent = [...items]
    .filter((item) => item.latest_run)
    .sort((left, right) => {
      const leftTime = Date.parse(left.latest_run?.started_at || "");
      const rightTime = Date.parse(right.latest_run?.started_at || "");
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    })[0];
  return recent?.workflow_id || items[0].workflow_id;
}
