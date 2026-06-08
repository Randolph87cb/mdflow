import { FormEvent, useState } from "react";

type Props = {
  open: boolean;
  workflowId: string | null;
  onClose: () => void;
  onSubmit: (workflowId: string, payload: { new_workflow_id: string; new_name?: string; copy_scripts: boolean; copy_inputs: boolean }) => Promise<void>;
};

export function CopyWorkflowDialog({ open, workflowId, onClose, onSubmit }: Props) {
  const [newWorkflowId, setNewWorkflowId] = useState("");
  const [newName, setNewName] = useState("");
  const [copyScripts, setCopyScripts] = useState(true);
  const [copyInputs, setCopyInputs] = useState(true);
  if (!open || !workflowId) return null;
  const activeWorkflowId = workflowId;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(activeWorkflowId, {
      new_workflow_id: newWorkflowId,
      new_name: newName || undefined,
      copy_scripts: copyScripts,
      copy_inputs: copyInputs,
    });
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title-block">
          <h3>复制工作流</h3>
          <div className="subtle">在保留当前定义不变的前提下，新建一个并行的本地工作流 ID。</div>
        </div>
        <label>
          新工作流 ID
          <input value={newWorkflowId} onChange={(e) => setNewWorkflowId(e.target.value)} />
        </label>
        <label>
          新名称
          <input value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={copyScripts} onChange={(e) => setCopyScripts(e.target.checked)} />
          复制脚本
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={copyInputs} onChange={(e) => setCopyInputs(e.target.checked)} />
          复制输入
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="submit">复制</button>
        </div>
      </form>
    </div>
  );
}
