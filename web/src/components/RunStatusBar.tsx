type Props = {
  workflowId: string;
  runId: string;
  status: string;
  currentNode?: string | null;
  startedAt?: string;
  snapshotDir?: string | null;
};

export function RunStatusBar({ workflowId, runId, status, currentNode, startedAt, snapshotDir }: Props) {
  return (
    <section className="run-status-bar">
      <div>
        <div className="table-primary">
          {workflowId} / {runId}
        </div>
        <div className="subtle">started: {startedAt || "-"} | snapshot: {snapshotDir || "-"}</div>
      </div>
      <div className="run-status-metrics">
        <span className="status-chip">{status}</span>
        <span className="subtle">current: {currentNode || "null"}</span>
      </div>
    </section>
  );
}
