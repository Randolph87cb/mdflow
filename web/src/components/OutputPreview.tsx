import type { OutputPreview as OutputPreviewType } from "../lib/types";

type Props = {
  data: OutputPreviewType | null;
  downloadHref?: string | null;
};

export function OutputPreview({ data, downloadHref }: Props) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <strong>Output Preview</strong>
          <div className="subtle">
            {data ? `${data.name} · ${data.path}` : "No file selected"}
          </div>
        </div>
        {downloadHref ? (
          <a className="button-link" href={downloadHref} target="_blank" rel="noreferrer">
            Download
          </a>
        ) : null}
      </div>
      {!data ? <div className="empty-state">Select an output file.</div> : null}
      {data && data.previewable ? <pre className="code-block">{data.content}</pre> : null}
      {data && !data.previewable ? <div className="empty-state">Binary or non-text output. Use download.</div> : null}
    </section>
  );
}
