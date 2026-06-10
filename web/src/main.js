import "./styles.css";
import { workflows } from "./data.js";

const app = document.querySelector("#app");

const state = {
  query: "",
  filter: "all",
  selectedId: workflows[0].id
};

const statusLabel = {
  failed: "失败",
  success: "成功",
  running: "运行中",
  idle: "未运行"
};

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

function renderGraph(workflow) {
  const edgeMarkup = workflow.graph.edges
    .map(([fromIndex, toIndex]) => {
      const from = workflow.graph.nodes[fromIndex];
      const to = workflow.graph.nodes[toIndex];
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
          <text x="${node.x}" y="${node.y + 4}" text-anchor="middle" class="graph-label">${node.id}</text>
        </g>
      `
    )
    .join("");

  return `
    <svg viewBox="0 0 940 300" class="graph-svg" aria-label="${workflow.name} 工作流预览图">
      <defs>
        <linearGradient id="edgeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(88, 180, 161, 0.16)" />
          <stop offset="100%" stop-color="rgba(63, 114, 175, 0.42)" />
        </linearGradient>
      </defs>
      ${edgeMarkup}
      ${nodeMarkup}
    </svg>
  `;
}

function getSelectedWorkflow(filteredWorkflows) {
  return (
    filteredWorkflows.find((workflow) => workflow.id === state.selectedId) ??
    filteredWorkflows[0] ??
    null
  );
}

function render() {
  const filteredWorkflows = filterWorkflows();
  const selectedWorkflow = getSelectedWorkflow(filteredWorkflows);

  if (selectedWorkflow) {
    state.selectedId = selectedWorkflow.id;
  }

  app.innerHTML = `
    <div class="shell">
      <div class="shell-glow shell-glow-a"></div>
      <div class="shell-glow shell-glow-b"></div>
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
                          class="workflow-row ${workflow.id === state.selectedId ? "selected" : ""}"
                          data-workflow-id="${workflow.id}"
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
                    <button class="action-button">打开详情</button>
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
                          <strong>${selectedWorkflow.entryNode}</strong>
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
                      <div class="graph-stage">
                        ${renderGraph(selectedWorkflow)}
                      </div>
                      <div class="graph-footer">
                        <span>入口：${selectedWorkflow.entryNode}</span>
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
    </div>
  `;

  document.querySelector("#search-input")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  document.querySelector("#filter-select")?.addEventListener("change", (event) => {
    state.filter = event.target.value;
    render();
  });

  document.querySelectorAll("[data-workflow-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.workflowId;
      render();
    });
  });
}

render();
