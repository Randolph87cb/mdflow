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
          <div className="eyebrow">Workspace</div>
          <h1>Workflow Studio</h1>
          <p>Manage workflows, run snapshots, node graphs, traces, outputs, and reruns from one local debugging surface.</p>
        </div>
        <div className="hero-metrics">
          <div className="hero-metric">
            <span className="meta-label">Workflows</span>
            <strong>{items.length}</strong>
          </div>
          <div className="hero-metric">
            <span className="meta-label">Recent runs</span>
            <strong>{items.filter((item) => item.latest_run).length}</strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Workflows</strong>
            <div className="subtle">Open a workflow, trigger a run, or clone it into a new working branch.</div>
          </div>
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
