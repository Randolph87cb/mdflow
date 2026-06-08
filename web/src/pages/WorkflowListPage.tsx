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
          <div className="eyebrow">Local Control Room</div>
          <h1>Workflow Studio</h1>
          <p>
            Traverse the local workspace, branch definitions safely, and jump straight into the runs that matter without
            leaving the debugging surface.
          </p>
          <div className="hero-caption">
            Three surfaces, one loop: discover workflows, understand the live definition, then debug a single run in
            detail.
          </div>
        </div>
        <div className="hero-metrics">
          <div className="hero-metric">
            <span className="meta-label">Workflows</span>
            <strong>{workflowCount}</strong>
          </div>
          <div className="hero-metric">
            <span className="meta-label">With recent runs</span>
            <strong>{recentRunCount}</strong>
          </div>
          <div className="hero-metric">
            <span className="meta-label">Running now</span>
            <strong>{runningCount}</strong>
          </div>
          <div className="hero-metric">
            <span className="meta-label">Needs attention</span>
            <strong>{failedCount}</strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Workflow Registry</strong>
            <div className="subtle">Open a workflow, trigger a run, or clone it into a new local variant.</div>
          </div>
          <span className="metric-chip">{workflowCount} loaded</span>
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
