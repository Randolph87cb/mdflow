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
          <h3>运行工作流</h3>
          <div className="subtle">直接在工作台中通过文件输入或内联文本创建一次新的运行。</div>
        </div>
        <label>
          输入方式
          <select value={inputMode} onChange={(e) => setInputMode(e.target.value as "text" | "file")}>
            <option value="file">文件</option>
            <option value="text">文本</option>
          </select>
        </label>
        {inputMode === "file" ? (
          <label>
            输入文件
            <input value={inputFile} onChange={(e) => setInputFile(e.target.value)} placeholder="workflows/problem_gen/inputs/default.md" />
          </label>
        ) : (
          <label>
            输入文本
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} rows={8} />
          </label>
        )}
        <label>
          运行名称
          <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="可选" />
        </label>
        <label>
          备注
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="submit">开始运行</button>
        </div>
      </form>
    </div>
  );
}
