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
        <div className="run-kicker">运行调试台</div>
        <div className="run-status-headline">
          <strong>{runId}</strong>
          <span className="run-workflow-name">{workflowId}</span>
        </div>
        <div className="run-status-meta">
          <span className="subtle">开始于 {startedAt || "-"}</span>
          <span className="subtle">持续时间 {durationLabel}</span>
          <span className="subtle">快照 {snapshotDir || "-"}</span>
          {sourceRunId ? <span className="subtle">来源运行 {sourceRunId}</span> : null}
          {rerunFromNode ? <span className="subtle">从节点重新运行 {rerunFromNode}</span> : null}
        </div>
      </div>
      <div className="run-status-metrics">
        <div className="status-card">
          <span className="meta-label">状态</span>
          <span className={`status-pill ${toneFromStatus(status)}`}>{localizeRunStatus(status)}</span>
        </div>
        <div className="status-card">
          <span className="meta-label">当前节点</span>
          <strong>{currentNode || "无"}</strong>
        </div>
        <div className="status-card">
          <span className="meta-label">已完成</span>
          <strong>{completedCount ?? 0}</strong>
        </div>
        <div className="status-card">
          <span className="meta-label">产物数</span>
          <strong>{outputCount ?? 0}</strong>
        </div>
      </div>
    </section>
  );
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
    return `${seconds} 秒`;
  }
  return `${minutes} 分 ${seconds} 秒`;
}
