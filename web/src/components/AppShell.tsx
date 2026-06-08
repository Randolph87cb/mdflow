import { Link, useLocation } from "react-router-dom";
import { PropsWithChildren, useEffect, useState } from "react";
import { studioApi } from "../lib/api";
import type { SystemStatus } from "../lib/types";

export function AppShell({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const location = useLocation();

  useEffect(() => {
    studioApi.getSystemStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const surface = describeSurface(location.pathname);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-grid">
          <div className="brand-wrap">
            <Link to="/" className="brand-mark" aria-label="mdflow home">
              mf
            </Link>
            <div className="brand-copy">
              <Link to="/" className="brand">
                mdflow <span>Workflow Studio</span>
              </Link>
              <div className="subtle">本地 Markdown 工作流开发与调试平台</div>
            </div>
          </div>
          <section className="header-surface-card">
            <span className="meta-label">Current Surface</span>
            <strong>{surface.title}</strong>
            <div className="subtle">{surface.description}</div>
          </section>
          <div className="header-status-row">
            <div className="header-status-cluster">
              <span className={`status-pill ${status ? "success" : "running"}`}>
                {status ? "Studio online" : "Connecting"}
              </span>
              <span className="metric-chip">
                {status?.frontend_built ? "frontend built" : "frontend pending"}
              </span>
            </div>
            <div className="header-path-grid">
              <div className="header-path-card">
                <span className="meta-label">Workflows</span>
                <span className="header-path">{status?.workflows_dir || "Loading workspace path..."}</span>
              </div>
              <div className="header-path-card">
                <span className="meta-label">Runs</span>
                <span className="header-path">{status?.runs_dir || "Waiting for backend status..."}</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

function describeSurface(pathname: string) {
  if (pathname.includes("/runs/")) {
    return {
      title: "Run Cockpit",
      description: "Trace execution, inspect the snapshot node definition, preview outputs, and rerun from a selected node.",
    };
  }
  if (pathname.startsWith("/workflows/")) {
    return {
      title: "Workflow Definition",
      description: "Inspect the live node graph, edit Markdown node sources, and review recent run history.",
    };
  }
  return {
    title: "Workflow Index",
    description: "Scan the local workspace, open a workflow, launch a run, or branch a copy for edits.",
  };
}
