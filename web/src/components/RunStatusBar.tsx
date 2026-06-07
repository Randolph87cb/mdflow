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
    <section className="run-status-bar panel">
      <div className="run-status-left">
        <div className="run-kicker">Run</div>
        <div className="table-primary">
          {runId} <span className="run-workflow-name">{workflowId}</span>
        </div>
        <div className="subtle">
          started {startedAt || "-"} · snapshot {snapshotDir || "-"}
        </div>
      </div>
      <div className="run-status-metrics">
        <span className={`status-pill ${toneFromStatus(status)}`}>{status}</span>
        <span className="metric-chip">current: {currentNode || "null"}</span>
      </div>
    </section>
  );
}

function toneFromStatus(status: string) {
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
