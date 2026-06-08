type Props = {
  title?: string;
  subtitle?: string;
  trace: {
    attempt?: number;
    input?: string | null;
    prompt?: string | null;
    stdout?: string | null;
    stderr?: string | null;
    output?: string | null;
    route_selected?: {
      selected_next?: string | null;
      route_source?: string | null;
      route_operator?: string | null;
    } | null;
  } | null;
};

export function TraceViewer({ trace, title = "Trace", subtitle }: Props) {
  if (!trace) {
    return (
      <section className="panel trace-panel">
        <div className="panel-header">
          <div>
            <strong>{title}</strong>
            {subtitle ? <div className="subtle">{subtitle}</div> : null}
          </div>
        </div>
        <div className="empty-state">Select a run node to see trace.</div>
      </section>
    );
  }
  const sections = [
    ["Input", trace.input],
    ["Prompt", trace.prompt],
    ["Stdout", trace.stdout],
    ["Stderr", trace.stderr],
    ["Output", trace.output],
    [
      "Route Match",
      trace.route_selected
        ? `selected_next: ${trace.route_selected.selected_next ?? "-"}\nsource: ${trace.route_selected.route_source ?? "-"}\noperator: ${trace.route_selected.route_operator ?? "-"}`
        : null,
    ],
  ].filter(([, value]) => value);

  return (
    <section className="panel trace-panel">
      <div className="panel-header">
        <div>
          <strong>{title}</strong>
          {subtitle ? <div className="subtle">{subtitle}</div> : null}
        </div>
        <div className="trace-header-meta">
          {trace.attempt ? <span className="metric-chip">attempt {trace.attempt}</span> : null}
          <span className="subtle">{sections.length} sections</span>
        </div>
      </div>
      <div className="trace-viewer">
        {sections.length === 0 ? <div className="empty-state">No trace content.</div> : null}
        {sections.map(([label, value]) => (
          <section key={label} className="trace-block">
            <div className="trace-block-header">
              <strong>{label}</strong>
              <span className="meta-label">trace section</span>
            </div>
            <pre className="code-block">{value}</pre>
          </section>
        ))}
      </div>
    </section>
  );
}
