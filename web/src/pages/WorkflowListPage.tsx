import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CopyWorkflowDialog } from "../components/CopyWorkflowDialog";
import { RunDialog } from "../components/RunDialog";
import { WorkflowTable } from "../components/WorkflowTable";
import { studioApi } from "../lib/api";
import type { WorkflowSummary } from "../lib/types";

export function WorkflowListPage() {
  const [items, setItems] = useState<WorkflowSummary[]>([]);
  const [runWorkflowId, setRunWorkflowId] = useState<string | null>(null);
  const [copyWorkflowId, setCopyWorkflowId] = useState<string | null>(null);
  const navigate = useNavigate();
  const workflowCount = items.length;
  const recentRunCount = items.filter((item) => item.latest_run).length;
  const runningCount = items.filter((item) => item.latest_run?.status.toLowerCase() === "running").length;
  const failedCount = items.filter((item) => item.latest_run?.status.toLowerCase() === "failed").length;

  async function load() {
    setItems(await studioApi.listWorkflows());
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  return (
    <div className="page workflow-list-page">
      <section className="hero-panel panel">
        <div className="hero-copy">
          <div className="eyebrow">本地控制台</div>
          <h1>mdflow 工作流工作台</h1>
          <p>
            浏览本地工作区，安全地复制工作流定义，并直接跳转到关键运行记录，不离开当前调试界面。
          </p>
          <div className="hero-caption">
            三个页面，一个闭环：先发现工作流，再理解当前定义，最后进入某次运行做细致调试。
          </div>
        </div>
        <div className="hero-metrics">
          <div className="hero-metric">
            <span className="meta-label">工作流</span>
            <strong>{workflowCount}</strong>
          </div>
          <div className="hero-metric">
            <span className="meta-label">近期有运行</span>
            <strong>{recentRunCount}</strong>
          </div>
          <div className="hero-metric">
            <span className="meta-label">运行中</span>
            <strong>{runningCount}</strong>
          </div>
          <div className="hero-metric">
            <span className="meta-label">需要关注</span>
            <strong>{failedCount}</strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>工作流目录</strong>
            <div className="subtle">打开工作流、发起运行，或复制出新的本地变体。</div>
          </div>
          <span className="metric-chip">已加载 {workflowCount} 个</span>
        </div>
        <WorkflowTable items={items} onRun={setRunWorkflowId} onCopy={setCopyWorkflowId} />
      </section>
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
    </div>
  );
}
