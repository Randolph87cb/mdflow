import type { OutputEntry } from "../lib/types";

type Props = {
  items: OutputEntry[];
  selected: string[];
  active?: string | null;
  onSelect: (name: string) => void;
  onToggle: (name: string) => void;
  onDownloadZip: () => void;
};

export function OutputBrowser({ items, selected, active, onSelect, onToggle, onDownloadZip }: Props) {
  const selectedCount = selected.length;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>, name: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(name);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <strong>Outputs</strong>
          <div className="subtle">
            {items.length} files{selectedCount ? ` · ${selectedCount} selected` : ""}
          </div>
        </div>
        <button className="ghost-button" onClick={onDownloadZip}>
          {selectedCount ? `Download ${selectedCount} files` : "Download zip"}
        </button>
      </div>
      <div className="output-list">
        {items.map((item) => (
          <div
            key={item.name}
            className={`output-item ${active === item.name ? "active" : ""}`}
            onClick={() => onSelect(item.name)}
            onKeyDown={(event) => handleKeyDown(event, item.name)}
            role="button"
            tabIndex={0}
            aria-pressed={active === item.name}
          >
            <input
              type="checkbox"
              checked={selected.includes(item.name)}
              onChange={(event) => {
                event.stopPropagation();
                onToggle(item.name);
              }}
            />
            <div className="output-main">
              <div className="output-name-row">
                <div>{item.name}</div>
                <span className="metric-chip metric-chip-compact">
                  {item.previewable ? "preview" : "binary"}
                </span>
              </div>
              <div className="subtle">
                {item.path} · {item.size} bytes {item.previewable ? "· preview" : "· binary"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
