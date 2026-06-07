type Props = {
  workflowId: string;
  runId: string;
  status: string;
  currentNode?: string | null;
  startedAt?: string;
  finishedAt?: string | null;
  snapshotDir?: string | null;
  sourceRunId?: string | null;
  rerunFromNode?: string | null;
  completedCount?: number;
  outputCount?: number;
};

export function RunStatusBar({
  workflowId,
  runId,
  status,
  currentNode,
  startedAt,
  finishedAt,
  snapshotDir,
  sourceRunId,
  rerunFromNode,
  completedCount,
  outputCount,
}: Props) {
  const durationLabel = formatDuration(startedAt, finishedAt);
  return (
    <section className="run-status-bar panel">
      <div className="run-status-left">
        <div className="run-kicker">Run</div>
        <div className="table-primary">
          {runId} <span className="run-workflow-name">{workflowId}</span>
        </div>
        <div className="run-status-meta">
          <span className="subtle">started {startedAt || "-"}</span>
          <span className="subtle">duration {durationLabel}</span>
          <span className="subtle">snapshot {snapshotDir || "-"}</span>
          {sourceRunId ? <span className="subtle">source {sourceRunId}</span> : null}
          {rerunFromNode ? <span className="subtle">rerun from {rerunFromNode}</span> : null}
        </div>
      </div>
      <div className="run-status-metrics">
        <span className={`status-pill ${toneFromStatus(status)}`}>{status}</span>
        <span className="metric-chip">current: {currentNode || "null"}</span>
        <span className="metric-chip">completed: {completedCount ?? 0}</span>
        <span className="metric-chip">outputs: {outputCount ?? 0}</span>
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

function formatDuration(startedAt?: string, finishedAt?: string | null) {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "-";
  }
  const totalSeconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}
