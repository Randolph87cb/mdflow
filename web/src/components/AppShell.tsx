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
            <Link to="/" className="brand-mark" aria-label="mdflow 首页">
              mf
            </Link>
            <div className="brand-copy">
              <Link to="/" className="brand">
                mdflow <span>工作流工作台</span>
              </Link>
              <div className="subtle">本地 Markdown 工作流开发与调试平台</div>
            </div>
          </div>
          <section className="header-surface-card">
            <span className="meta-label">当前页面</span>
            <strong>{surface.title}</strong>
            <div className="subtle">{surface.description}</div>
          </section>
          <div className="header-status-row">
            <div className="header-status-cluster">
              <span className={`status-pill ${status ? "success" : "running"}`}>
                {status ? "工作台在线" : "连接中"}
              </span>
              <span className="metric-chip">
                {status?.frontend_built ? "前端已构建" : "前端待构建"}
              </span>
            </div>
            <div className="header-path-grid">
              <div className="header-path-card">
                <span className="meta-label">工作流</span>
                <span className="header-path">{status?.workflows_dir || "正在加载工作区路径..."}</span>
              </div>
              <div className="header-path-card">
                <span className="meta-label">运行记录</span>
                <span className="header-path">{status?.runs_dir || "正在等待后端状态..."}</span>
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
      title: "运行调试台",
      description: "查看执行跟踪、检查快照节点定义、预览产物，并从选中的节点重新运行。",
    };
  }
  if (pathname.startsWith("/workflows/")) {
    return {
      title: "工作流定义",
      description: "查看当前节点图、编辑节点 Markdown 源码，并回顾最近的运行历史。",
    };
  }
  return {
    title: "工作流总览",
    description: "扫描本地工作区，打开工作流，发起运行，或复制一个分支版本继续编辑。",
  };
}
