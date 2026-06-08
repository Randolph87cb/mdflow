import { Link } from "react-router-dom";
import type { WorkflowSummary } from "../lib/types";

type Props = {
  items: WorkflowSummary[];
  onRun: (workflowId: string) => void;
  onCopy: (workflowId: string) => void;
};

export function WorkflowTable({ items, onRun, onCopy }: Props) {
  if (items.length === 0) {
    return <div className="empty-state">No workflows found in the local workspace.</div>;
  }

  return (
    <div className="workflow-card-list">
      {items.map((item) => (
        <article key={item.workflow_id} className="workflow-card">
          <div className="workflow-card-main">
            <div className="workflow-card-title-row">
              <div>
                <div className="meta-label">Workflow</div>
                <div className="workflow-card-title">
                  <div className="table-primary">{item.workflow_id}</div>
                  <span className={`status-pill ${toneFromStatus(item.latest_run?.status)}`}>
                    {item.latest_run?.status || "Idle"}
                  </span>
                </div>
              </div>
              {item.latest_run ? (
                <Link className="button-link" to={`/workflows/${item.workflow_id}/runs/${item.latest_run.run_id}`}>
                  Open latest run
                </Link>
              ) : null}
            </div>
            <div className="workflow-card-copy">
              <strong>{item.name || item.workflow_id}</strong>
              <div className="subtle">Review the live graph, edit node Markdown, or step into recent execution evidence.</div>
            </div>
            <div className="workflow-meta-grid">
              <div>
                <span className="meta-label">Nodes</span>
                <strong>{item.node_count}</strong>
              </div>
              <div>
                <span className="meta-label">Latest run</span>
                <strong>{item.latest_run?.run_id || "-"}</strong>
              </div>
              <div>
                <span className="meta-label">Started</span>
                <strong>{item.latest_run?.started_at || "-"}</strong>
              </div>
            </div>
          </div>
          <div className="actions-cell">
            <Link className="button-link" to={`/workflows/${item.workflow_id}`}>
              Open
            </Link>
            <button className="ghost-button" onClick={() => onRun(item.workflow_id)}>
              Run
            </button>
            <button className="ghost-button" onClick={() => onCopy(item.workflow_id)}>
              Copy
            </button>
          </div>
        </article>
      ))}
    </div>
  );
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
