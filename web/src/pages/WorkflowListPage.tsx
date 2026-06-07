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
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <strong>Workflows</strong>
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
