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
          <strong>产物预览</strong>
          <div className="subtle">
            {data ? `${data.name} · ${data.path}` : "未选择文件"}
          </div>
        </div>
        <div className="actions-cell">
          {data ? (
            <span className="metric-chip metric-chip-compact">{data.previewable ? "文本预览" : "二进制文件"}</span>
          ) : null}
          {downloadHref ? (
            <a className="button-link" href={downloadHref} target="_blank" rel="noreferrer">
              下载
            </a>
          ) : null}
        </div>
      </div>
      {!data ? <div className="empty-state">请选择要预览的产物文件。</div> : null}
      {data && data.previewable ? <pre className="code-block">{data.content}</pre> : null}
      {data && !data.previewable ? <div className="empty-state">这是二进制或非文本产物，请使用下载。</div> : null}
    </section>
  );
}
