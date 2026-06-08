import { Link } from "react-router-dom";
import type { WorkflowSummary } from "../lib/types";

type Props = {
  items: WorkflowSummary[];
  onRun: (workflowId: string) => void;
  onCopy: (workflowId: string) => void;
};

export function WorkflowTable({ items, onRun, onCopy }: Props) {
  if (items.length === 0) {
    return <div className="empty-state">当前本地工作区中没有找到工作流。</div>;
  }

  return (
    <div className="workflow-card-list">
      {items.map((item) => (
        <article key={item.workflow_id} className="workflow-card">
          <div className="workflow-card-main">
            <div className="workflow-card-title-row">
              <div>
                <div className="meta-label">工作流</div>
                <div className="workflow-card-title">
                  <div className="table-primary">{item.workflow_id}</div>
                  <span className={`status-pill ${toneFromStatus(item.latest_run?.status)}`}>
                    {localizeRunStatus(item.latest_run?.status)}
                  </span>
                </div>
              </div>
              {item.latest_run ? (
                <Link className="button-link" to={`/workflows/${item.workflow_id}/runs/${item.latest_run.run_id}`}>
                  打开最新运行
                </Link>
              ) : null}
            </div>
            <div className="workflow-card-copy">
              <strong>{item.name || item.workflow_id}</strong>
              <div className="subtle">查看当前图结构、编辑节点 Markdown，或进入最近一次执行详情。</div>
            </div>
            <div className="workflow-meta-grid">
              <div>
                <span className="meta-label">节点数</span>
                <strong>{item.node_count}</strong>
              </div>
              <div>
                <span className="meta-label">最新运行</span>
                <strong>{item.latest_run?.run_id || "-"}</strong>
              </div>
              <div>
                <span className="meta-label">开始时间</span>
                <strong>{item.latest_run?.started_at || "-"}</strong>
              </div>
            </div>
          </div>
          <div className="actions-cell">
            <Link className="button-link" to={`/workflows/${item.workflow_id}`}>
              打开
            </Link>
            <button className="ghost-button" onClick={() => onRun(item.workflow_id)}>
              运行
            </button>
            <button className="ghost-button" onClick={() => onCopy(item.workflow_id)}>
              复制
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function localizeRunStatus(status?: string | null) {
  switch ((status || "").toLowerCase()) {
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

function toneFromStatus(status?: string | null) {
  switch ((status || "").toLowerCase()) {
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
