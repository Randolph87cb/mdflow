import { FormEvent, useEffect, useState } from "react";

type Props = {
  open: boolean;
  workflowId: string;
  nodeId: string | null;
  initialContent: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
};

export function NodeEditorDrawer({ open, workflowId, nodeId, initialContent, onClose, onSave }: Props) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (open) {
      setContent(initialContent);
    }
  }, [open, nodeId, initialContent]);

  if (!open || !nodeId) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSave(content);
  }

  return (
    <div className="drawer-backdrop">
      <form className="drawer" onSubmit={handleSubmit}>
        <div className="panel-header">
          <strong>
            Edit {workflowId} / {nodeId}
          </strong>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <textarea className="editor-textarea" value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="modal-actions">
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}
