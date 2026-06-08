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

export function TraceViewer({ trace, title = "执行跟踪", subtitle }: Props) {
  if (!trace) {
    return (
      <section className="panel trace-panel">
        <div className="panel-header">
          <div>
            <strong>{title}</strong>
            {subtitle ? <div className="subtle">{subtitle}</div> : null}
          </div>
        </div>
        <div className="empty-state">选择运行节点后可查看执行跟踪。</div>
      </section>
    );
  }
  const sections = [
    ["输入", trace.input],
    ["提示词", trace.prompt],
    ["标准输出", trace.stdout],
    ["标准错误", trace.stderr],
    ["输出", trace.output],
    [
      "路由匹配",
      trace.route_selected
        ? `选中下一节点: ${trace.route_selected.selected_next ?? "-"}\n来源: ${trace.route_selected.route_source ?? "-"}\n操作符: ${trace.route_selected.route_operator ?? "-"}`
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
          {trace.attempt ? <span className="metric-chip">第 {trace.attempt} 次尝试</span> : null}
          <span className="subtle">{sections.length} 个区块</span>
        </div>
      </div>
      <div className="trace-viewer">
        {sections.length === 0 ? <div className="empty-state">暂无跟踪内容。</div> : null}
        {sections.map(([label, value]) => (
          <section key={label} className="trace-block">
            <div className="trace-block-header">
              <strong>{label}</strong>
              <span className="meta-label">跟踪区块</span>
            </div>
            <pre className="code-block">{value}</pre>
          </section>
        ))}
      </div>
    </section>
  );
}
