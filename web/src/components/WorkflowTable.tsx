import type { WorkflowSummary } from "../lib/types";

type Props = {
  items: WorkflowSummary[];
  selectedWorkflowId?: string | null;
  onSelect: (workflowId: string) => void;
  emptyCopy?: string;
};

export function WorkflowTable({ items, selectedWorkflowId, onSelect, emptyCopy }: Props) {
  if (items.length === 0) {
    return <div className="empty-state">{emptyCopy || "当前没有可用数据。"}</div>;
  }

  return (
    <div className="workflow-overview-list">
      {items.map((item) => {
        const isSelected = item.workflow_id === selectedWorkflowId;
        return (
          <button
            key={item.workflow_id}
            type="button"
            className={`workflow-overview-list-item ${isSelected ? "selected" : ""}`}
            onClick={() => onSelect(item.workflow_id)}
          >
            <div className="workflow-overview-list-item-head">
              <div className="workflow-overview-list-item-copy">
                <span className="meta-label">工作流</span>
                <strong>{item.name || item.workflow_id}</strong>
              </div>
              <span className={`status-pill ${toneFromStatus(item.latest_run?.status)}`}>
                {localizeRunStatus(item.latest_run?.status)}
              </span>
            </div>
            <div className="workflow-overview-list-item-id">{item.workflow_id}</div>
            <div className="workflow-overview-list-item-meta">
              <span>节点 {item.node_count}</span>
              <span>{item.latest_run?.started_at || "尚未运行"}</span>
            </div>
          </button>
        );
      })}
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
