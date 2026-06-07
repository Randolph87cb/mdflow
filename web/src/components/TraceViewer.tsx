type Props = {
  trace: {
    input?: string | null;
    prompt?: string | null;
    stdout?: string | null;
    stderr?: string | null;
    output?: string | null;
  } | null;
};

export function TraceViewer({ trace }: Props) {
  if (!trace) {
    return <div className="empty-state">Select a run node to see trace.</div>;
  }
  const sections = [
    ["Input", trace.input],
    ["Prompt", trace.prompt],
    ["Stdout", trace.stdout],
    ["Stderr", trace.stderr],
    ["Output", trace.output],
  ].filter(([, value]) => value);

  return (
    <div className="trace-viewer">
      {sections.length === 0 ? <div className="empty-state">No trace content.</div> : null}
      {sections.map(([label, value]) => (
        <section key={label} className="panel">
          <div className="panel-header">
            <strong>{label}</strong>
          </div>
          <pre className="code-block">{value}</pre>
        </section>
      ))}
    </div>
  );
}
