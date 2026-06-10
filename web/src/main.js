import "./styles.css";
import { workflows } from "./data.js";

const app = document.querySelector("#app");

const state = {
  query: "",
  filter: "all",
  selectedWorkflowId: workflows[0].id,
  selectedNodeKey: workflows[0].entryNode
};

const statusLabel = {
  failed: "失败",
  success: "成功",
  running: "运行中",
  idle: "未运行"
};

const nodeTypeLabel = {
  llm: "LLM 节点",
  script: "脚本节点",
  router: "路由节点"
};

function getWorkflowById(workflowId) {
  return workflows.find((workflow) => workflow.id === workflowId) ?? workflows[0];
}

function getNodeByKey(workflow, nodeKey) {
  return workflow.graph.nodes.find((node) => node.key === nodeKey) ?? workflow.graph.nodes[0];
}

function getNodeLabel(workflow, nodeKey) {
  return getNodeByKey(workflow, nodeKey)?.label ?? "无";
}

function parseRoute() {
  const url = new URL(window.location.href);
  const view = url.searchParams.get("view");
  const workflowId = url.searchParams.get("workflow");

  if (view === "detail" && workflowId) {
    return { page: "detail", workflowId };
  }

  const hash = window.location.hash.replace(/^#/, "") || "/";
  const detailMatch = hash.match(/^\/workflows\/([^/]+)$/);

  if (detailMatch) {
    return { page: "detail", workflowId: decodeURIComponent(detailMatch[1]) };
  }

  return { page: "overview" };
}

function goToOverview() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  window.history.pushState({}, "", url);
  render();
}

function goToWorkflowDetail(workflowId) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "detail");
  url.searchParams.set("workflow", workflowId);
  url.hash = "";
  window.history.pushState({}, "", url);
  render();
}

function filterWorkflows() {
  const normalizedQuery = state.query.trim().toLowerCase();
  return workflows.filter((workflow) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      workflow.name.toLowerCase().includes(normalizedQuery) ||
      workflow.id.toLowerCase().includes(normalizedQuery);

    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "failed" && workflow.status === "failed") ||
      (state.filter === "running" && workflow.status === "running") ||
      (state.filter === "idle" && workflow.status === "idle");

    return matchesQuery && matchesFilter;
  });
}

function renderPreviewGraph(workflow) {
  const nodeMap = new Map(workflow.graph.nodes.map((node) => [node.key, node]));
  const edgeMarkup = workflow.graph.edges
    .map(([fromKey, toKey]) => {
      const from = nodeMap.get(fromKey);
      const to = nodeMap.get(toKey);

      return `
        <line
          x1="${from.x}"
          y1="${from.y}"
          x2="${to.x}"
          y2="${to.y}"
          class="graph-edge"
        />
      `;
    })
    .join("");

  const nodeMarkup = workflow.graph.nodes
    .map(
      (node) => `
        <g>
          <circle cx="${node.x}" cy="${node.y}" r="28" class="graph-node graph-node-${node.state}" />
          <text x="${node.x}" y="${node.y + 4}" text-anchor="middle" class="graph-label">${node.shortLabel}</text>
        </g>
      `
    )
    .join("");

  return `
    <svg viewBox="0 0 1340 380" class="graph-svg" aria-label="${workflow.name} 工作流预览图">
      ${edgeMarkup}
      ${nodeMarkup}
    </svg>
  `;
}

function renderDetailEdges(workflow) {
  const nodeMap = new Map(workflow.graph.nodes.map((node) => [node.key, node]));

  return workflow.graph.edges
    .map(([fromKey, toKey]) => {
      const from = nodeMap.get(fromKey);
      const to = nodeMap.get(toKey);
      const x1 = from.x + 92;
      const y1 = from.y + 60;
      const x2 = to.x + 92;
      const y2 = to.y + 60;
      const curve = Math.abs(x2 - x1) * 0.36;

      return `
        <path
          d="M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}"
          class="detail-edge"
        />
      `;
    })
    .join("");
}

function renderShell(content) {
  app.innerHTML = `
    <div class="shell">
      <div class="shell-glow shell-glow-a"></div>
      <div class="shell-glow shell-glow-b"></div>
      ${content}
    </div>
  `;
}

function renderOverviewPage() {
  document.title = "mdflow 工作流总览";
  const filteredWorkflows = filterWorkflows();
  const selectedWorkflow =
    filteredWorkflows.find((workflow) => workflow.id === state.selectedWorkflowId) ??
    filteredWorkflows[0] ??
    null;

  if (selectedWorkflow) {
    state.selectedWorkflowId = selectedWorkflow.id;
  }

  renderShell(`
    <header class="topbar">
      <div class="brand-group">
        <div class="brand-mark">m</div>
        <div>
          <div class="brand-kicker">工作流总览</div>
          <div class="brand-title">mdflow</div>
        </div>
      </div>
      <div class="toolbar">
        <label class="search-field">
          <span class="search-icon">⌕</span>
          <input id="search-input" type="search" placeholder="搜索工作流名称或 ID" value="${state.query}" />
        </label>
        <label class="filter-field">
          <span>状态</span>
          <select id="filter-select">
            <option value="all" ${state.filter === "all" ? "selected" : ""}>全部</option>
            <option value="running" ${state.filter === "running" ? "selected" : ""}>运行中</option>
            <option value="failed" ${state.filter === "failed" ? "selected" : ""}>失败</option>
            <option value="idle" ${state.filter === "idle" ? "selected" : ""}>未运行</option>
          </select>
        </label>
        <button class="toolbar-button toolbar-button-primary">新建工作流</button>
        <button class="toolbar-button">导入</button>
      </div>
    </header>
    <main class="workspace">
      <aside class="workflow-rail">
        <div class="rail-header">
          <div>
            <div class="section-kicker">工作流列表</div>
            <h1>当前显示 ${filteredWorkflows.length} 个</h1>
          </div>
          <span class="muted-chip">共 ${workflows.length} 个</span>
        </div>
        <div class="workflow-list">
          ${
            filteredWorkflows.length === 0
              ? `
                <div class="empty-list">
                  <strong>没有匹配的工作流</strong>
                  <p>试试更换关键词，或清空当前筛选条件。</p>
                </div>
              `
              : filteredWorkflows
                  .map(
                    (workflow) => `
                      <button
                        class="workflow-row ${workflow.id === state.selectedWorkflowId ? "selected" : ""}"
                        data-select-workflow="${workflow.id}"
                      >
                        <div class="workflow-row-top">
                          <strong>${workflow.name}</strong>
                          <span class="status-pill status-${workflow.status}">${statusLabel[workflow.status]}</span>
                          <span class="workflow-time">${workflow.lastRunRelative}</span>
                        </div>
                        <div class="workflow-row-bottom">
                          <span>${workflow.id}</span>
                          <span>${workflow.nodeCount} 个节点</span>
                        </div>
                      </button>
                    `
                  )
                  .join("")
          }
        </div>
      </aside>
      <section class="preview-panel">
        ${
          selectedWorkflow
            ? `
              <div class="preview-panel-inner">
                <div class="preview-header">
                  <div>
                    <div class="section-kicker">当前工作流</div>
                    <div class="preview-title-row">
                      <h2>${selectedWorkflow.name}</h2>
                      <span class="status-pill status-${selectedWorkflow.status}">${statusLabel[selectedWorkflow.status]}</span>
                    </div>
                    <div class="preview-id">${selectedWorkflow.id}</div>
                    <div class="preview-path">${selectedWorkflow.path}</div>
                  </div>
                  <div class="preview-tags">
                    ${selectedWorkflow.tags.map((tag) => `<span>${tag}</span>`).join("")}
                  </div>
                </div>
                <div class="action-bar">
                  <button class="action-button" data-open-detail="${selectedWorkflow.id}">打开详情</button>
                  <button class="action-button" ${selectedWorkflow.latestRunId === "暂无运行记录" ? "disabled" : ""}>打开最新运行</button>
                  <button class="action-button action-button-primary">运行</button>
                  <button class="action-button">复制</button>
                </div>
                <div class="preview-body">
                  <section class="workflow-meta-card">
                    <div class="meta-callout">${selectedWorkflow.blurb}</div>
                    <div class="meta-summary">
                      <div class="summary-chip">
                        <span>入口节点</span>
                        <strong>${selectedWorkflow.entryLabel}</strong>
                      </div>
                      <div class="summary-chip">
                        <span>节点数</span>
                        <strong>${selectedWorkflow.nodeCount}</strong>
                      </div>
                      <div class="summary-chip">
                        <span>产物数</span>
                        <strong>${selectedWorkflow.outputs}</strong>
                      </div>
                      <div class="summary-chip">
                        <span>最后编辑</span>
                        <strong>${selectedWorkflow.lastEdited}</strong>
                      </div>
                    </div>
                    <div class="run-spotlight">
                      <div class="run-spotlight-copy">
                        <span>最近一次运行</span>
                        <strong>${selectedWorkflow.latestRunId}</strong>
                        <p>${selectedWorkflow.lastRunRelative === "未运行" ? "这个工作流还没有执行记录。" : `最近一次执行更新于 ${selectedWorkflow.lastRunRelative}。`}</p>
                      </div>
                      <button class="spotlight-button" ${selectedWorkflow.latestRunId === "暂无运行记录" ? "disabled" : ""}>打开运行</button>
                    </div>
                    <div class="meta-footnote">
                      这里专注于浏览与分发动作，不直接编辑节点；需要进入完整画布时，再跳转到详情页处理。
                    </div>
                  </section>
                  <section class="graph-card">
                    <div class="graph-card-header">
                      <div>
                        <div class="section-kicker">流程预览</div>
                        <h3>工作流拓扑</h3>
                      </div>
                      <div class="graph-card-note">这里只看结构，节点编辑在详情页完成</div>
                    </div>
                    <button class="graph-stage graph-stage-button" data-open-detail="${selectedWorkflow.id}">
                      ${renderPreviewGraph(selectedWorkflow)}
                    </button>
                    <div class="graph-footer">
                      <span>入口：${selectedWorkflow.entryLabel}</span>
                      <span>${selectedWorkflow.nodeCount} 个节点</span>
                      <span>${selectedWorkflow.outputs} 个产物</span>
                    </div>
                  </section>
                </div>
              </div>
            `
            : `
              <div class="empty-preview">
                <div class="section-kicker">当前工作流</div>
                <h2>从左侧选择一个工作流</h2>
                <p>选中后，这里会显示概览信息、高频操作和结构预览。</p>
              </div>
            `
        }
      </section>
    </main>
  `);

  document.querySelector("#search-input")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  document.querySelector("#filter-select")?.addEventListener("change", (event) => {
    state.filter = event.target.value;
    render();
  });

  document.querySelectorAll("[data-select-workflow]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedWorkflowId = button.dataset.selectWorkflow;
      render();
    });
  });

  document.querySelectorAll("[data-open-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedWorkflowId = button.dataset.openDetail;
      state.selectedNodeKey = getWorkflowById(state.selectedWorkflowId).entryNode;
      goToWorkflowDetail(state.selectedWorkflowId);
    });
  });
}

function renderDetailPage(workflowId) {
  const workflow = getWorkflowById(workflowId);
  const selectedNode = getNodeByKey(workflow, state.selectedNodeKey);
  state.selectedWorkflowId = workflow.id;
  state.selectedNodeKey = selectedNode.key;
  document.title = `mdflow · ${workflow.name}`;

  renderShell(`
    <header class="topbar detail-topbar">
      <div class="brand-group">
        <button class="back-button" id="back-overview">← 总览</button>
        <div class="detail-header-copy">
          <div class="brand-kicker">工作流详情</div>
          <div class="brand-title">${workflow.name}</div>
          <div class="detail-subtitle">${workflow.id} · ${workflow.path}</div>
        </div>
      </div>
      <div class="toolbar">
        <button class="toolbar-button">校验</button>
        <button class="toolbar-button">复制工作流</button>
        <button class="toolbar-button">查看历史运行</button>
        <button class="toolbar-button toolbar-button-primary">运行工作流</button>
      </div>
    </header>
    <main class="detail-layout">
      <aside class="detail-sidebar">
        <div class="detail-sidebar-section">
          <div class="section-kicker">工作流摘要</div>
          <h2>${workflow.name}</h2>
          <div class="detail-sidebar-id">${workflow.id}</div>
          <div class="detail-summary-list">
            <div><span>入口</span><strong>${workflow.entryLabel}</strong></div>
            <div><span>节点数</span><strong>${workflow.nodeCount}</strong></div>
            <div><span>产物数</span><strong>${workflow.outputs}</strong></div>
            <div><span>最近运行</span><strong>${workflow.latestRunId}</strong></div>
          </div>
        </div>
        <div class="detail-sidebar-section">
          <div class="section-kicker">节点列表</div>
          <div class="node-list">
            ${workflow.graph.nodes
              .map(
                (node, index) => `
                  <button
                    class="node-list-item ${node.key === selectedNode.key ? "selected" : ""}"
                    data-select-node="${node.key}"
                  >
                    <div class="node-list-index">${String(index + 1).padStart(2, "0")}</div>
                    <div class="node-list-copy">
                      <strong>${node.label}</strong>
                      <span>${nodeTypeLabel[node.type] ?? node.type} · ${node.file}</span>
                    </div>
                    <span class="status-dot status-dot-${node.state}"></span>
                  </button>
                `
              )
              .join("")}
          </div>
        </div>
      </aside>
      <section class="detail-canvas-panel">
        <div class="detail-panel-head">
          <div>
            <div class="section-kicker">节点画布</div>
            <h3>点击节点即可切换右侧 Markdown 编辑区</h3>
          </div>
          <div class="canvas-toolbar">
            <span>缩放 100%</span>
            <span>只读预览线条</span>
          </div>
        </div>
        <div class="detail-canvas-stage">
          <svg viewBox="0 0 1440 520" class="detail-canvas-svg" aria-hidden="true">
            ${renderDetailEdges(workflow)}
          </svg>
          ${workflow.graph.nodes
            .map(
              (node) => `
                <button
                  class="canvas-node ${node.key === selectedNode.key ? "selected" : ""}"
                  data-select-node="${node.key}"
                  style="left:${node.x}px; top:${node.y}px;"
                >
                  <span class="canvas-node-type">${nodeTypeLabel[node.type] ?? node.type}</span>
                  <strong>${node.label}</strong>
                  <span class="canvas-node-file">${node.file.split("/").pop()}</span>
                </button>
              `
            )
            .join("")}
        </div>
      </section>
      <aside class="detail-editor-panel">
        <div class="detail-panel-head">
          <div>
            <div class="section-kicker">节点编辑</div>
            <h3>${selectedNode.label}</h3>
          </div>
          <span class="status-pill status-${selectedNode.state}">${statusLabel[selectedNode.state]}</span>
        </div>
        <div class="editor-meta">
          <div><span>节点类型</span><strong>${nodeTypeLabel[selectedNode.type] ?? selectedNode.type}</strong></div>
          <div><span>文件位置</span><strong>${selectedNode.file}</strong></div>
          <div><span>下一节点</span><strong>${selectedNode.next ? getNodeLabel(workflow, selectedNode.next) : "无"}</strong></div>
          <div><span>产物</span><strong>${selectedNode.produces?.join(" / ") || "无"}</strong></div>
        </div>
        <div class="editor-toolbar">
          <button class="toolbar-button">预览</button>
          <button class="toolbar-button">格式校验</button>
          <button class="toolbar-button toolbar-button-primary">保存节点</button>
        </div>
        <label class="markdown-editor-shell">
          <span>Markdown 源文件</span>
          <textarea class="markdown-editor" spellcheck="false">${selectedNode.markdown}</textarea>
        </label>
      </aside>
    </main>
  `);

  document.querySelector("#back-overview")?.addEventListener("click", () => {
    goToOverview();
  });

  document.querySelectorAll("[data-select-node]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedNodeKey = button.dataset.selectNode;
      render();
    });
  });
}

function render() {
  const route = parseRoute();

  if (route.page === "detail") {
    renderDetailPage(route.workflowId);
    return;
  }

  renderOverviewPage();
}

window.addEventListener("hashchange", render);
window.addEventListener("popstate", render);

render();
