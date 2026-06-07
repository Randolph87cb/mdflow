import { Link } from "react-router-dom";
import { PropsWithChildren, useEffect, useState } from "react";
import { studioApi } from "../lib/api";
import type { SystemStatus } from "../lib/types";

export function AppShell({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    studioApi.getSystemStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-wrap">
          <Link to="/" className="brand-mark" aria-label="mdflow home">
            md
          </Link>
          <div>
            <Link to="/" className="brand">
              mdflow <span>Workflow Studio</span>
            </Link>
            <div className="subtle">本地 Markdown 工作流开发与调试平台</div>
          </div>
        </div>
        <div className="header-status-row">
          <span className="status-pill success">{status ? "Connected" : "Connecting"}</span>
          {status ? <span className="header-path">{status.workflows_dir}</span> : null}
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
