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
        <div>
          <Link to="/" className="brand">
            mdflow Workflow Studio
          </Link>
          <div className="subtle">本地 Workflow 调试工作台</div>
        </div>
        <div className="status-chip">{status ? "Service OK" : "Loading..."}</div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
