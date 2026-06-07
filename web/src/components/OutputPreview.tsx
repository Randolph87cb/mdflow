import type { OutputPreview as OutputPreviewType } from "../lib/types";

type Props = {
  data: OutputPreviewType | null;
  downloadHref?: string | null;
};

export function OutputPreview({ data, downloadHref }: Props) {
  return (
    <section className="panel">
      <div className="panel-header">
        <strong>Output Preview</strong>
        {downloadHref ? (
          <a href={downloadHref} target="_blank" rel="noreferrer">
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
