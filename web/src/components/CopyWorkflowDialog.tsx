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
          <h3>Copy workflow</h3>
          <div className="subtle">Create a parallel local workflow ID while keeping the current definition intact.</div>
        </div>
        <label>
          New Workflow ID
          <input value={newWorkflowId} onChange={(e) => setNewWorkflowId(e.target.value)} />
        </label>
        <label>
          New Name
          <input value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={copyScripts} onChange={(e) => setCopyScripts(e.target.checked)} />
          Copy scripts
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={copyInputs} onChange={(e) => setCopyInputs(e.target.checked)} />
          Copy inputs
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Copy</button>
        </div>
      </form>
    </div>
  );
}
