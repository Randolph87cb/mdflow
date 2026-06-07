import { Link } from "react-router-dom";
import type { WorkflowSummary } from "../lib/types";

type Props = {
  items: WorkflowSummary[];
  onRun: (workflowId: string) => void;
  onCopy: (workflowId: string) => void;
};

export function WorkflowTable({ items, onRun, onCopy }: Props) {
  return (
    <table className="studio-table">
      <thead>
        <tr>
          <th>Workflow</th>
          <th>Nodes</th>
          <th>Latest Run</th>
          <th>Status</th>
          <th>Started</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.workflow_id}>
            <td>
              <div className="table-primary">{item.workflow_id}</div>
              <div className="subtle">{item.name || item.workflow_id}</div>
            </td>
            <td>{item.node_count}</td>
            <td>{item.latest_run?.run_id || "-"}</td>
            <td>{item.latest_run?.status || "-"}</td>
            <td>{item.latest_run?.started_at || "-"}</td>
            <td className="actions-cell">
              <Link to={`/workflows/${item.workflow_id}`}>Open</Link>
              <button onClick={() => onRun(item.workflow_id)}>Run</button>
              <button onClick={() => onCopy(item.workflow_id)}>Copy</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
