import { FormEvent, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { input_mode: "text" | "file"; input_text?: string; input_file?: string; run_name?: string; note?: string }) => Promise<void>;
};

export function RunDialog({ open, onClose, onSubmit }: Props) {
  const [inputMode, setInputMode] = useState<"text" | "file">("file");
  const [inputText, setInputText] = useState("");
  const [inputFile, setInputFile] = useState("");
  const [runName, setRunName] = useState("");
  const [note, setNote] = useState("");
  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      input_mode: inputMode,
      input_text: inputMode === "text" ? inputText : undefined,
      input_file: inputMode === "file" ? inputFile : undefined,
      run_name: runName || undefined,
      note: note || undefined,
    });
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title-block">
          <h3>Run workflow</h3>
          <div className="subtle">Create a new run from file input or inline text without leaving the Studio.</div>
        </div>
        <label>
          Input Mode
          <select value={inputMode} onChange={(e) => setInputMode(e.target.value as "text" | "file")}>
            <option value="file">file</option>
            <option value="text">text</option>
          </select>
        </label>
        {inputMode === "file" ? (
          <label>
            Input File
            <input value={inputFile} onChange={(e) => setInputFile(e.target.value)} placeholder="workflows/problem_gen/inputs/default.md" />
          </label>
        ) : (
          <label>
            Input Text
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} rows={8} />
          </label>
        )}
        <label>
          Run Name
          <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="optional" />
        </label>
        <label>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Start Run</button>
        </div>
      </form>
    </div>
  );
}
