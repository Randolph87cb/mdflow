import "./styles.css";
import { workflows } from "./data.js";

const app = document.querySelector("#app");
const zoomLevels = [0.9, 1, 1.12];
const canvasMetrics = {
  width: 720,
  height: 690,
  nodeWidth: 170,
  nodeHeight: 184,
  toolbarWidth: 288,
  toolbarHeight: 46,
  canvasPadding: 16,
  edgeGap: 0,
  edgeRadius: 14
};

const state = {
  query: "",
  filter: "all",
  selectedWorkflowId: workflows[0].id,
  selectedNodeKey: workflows[0].entryNode,
  detailRailExpanded: false,
  editorMode: "edit",
  zoomIndex: 1,
  notice: "已对齐设计稿结构：中间画布为主，右侧固定编辑。"
};

const statusLabel = {
  failed: "失败",
  success: "已完成",
  running: "运行中",
  idle: "未运行"
};

const nodeTypeLabel = {
  markdown: "Markdown",
  python: "Python",
  shell: "Shell"
};

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getWorkflowById(workflowId) {
  return workflows.find((workflow) => workflow.id === workflowId) ?? workflows[0];
}

function getNodeByKey(workflow, nodeKey) {
  return workflow.graph.nodes.find((node) => node.key === nodeKey) ?? workflow.graph.nodes[0];
}

function getNodeRelations(workflow, nodeKey) {
  const upstreams = workflow.graph.edges
    .filter(([, to]) => to === nodeKey)
    .map(([from]) => getNodeByKey(workflow, from).label);
  const downstreams = workflow.graph.edges
    .filter(([from]) => from === nodeKey)
    .map(([, to]) => getNodeByKey(workflow, to).label);
  return { upstreams, downstreams };
}

function parseRoute() {
  const url = new URL(window.location.href);
  const view = url.searchParams.get("view");
  const workflowId = url.searchParams.get("workflow");
  if (view === "detail" && workflowId) {
    return { page: "detail", workflowId };
  }
  return { page: "overview" };
}

function pushRoute(page, workflowId = "") {
  const url = new URL(window.location.href);
  if (page === "detail") {
    url.searchParams.set("view", "detail");
    url.searchParams.set("workflow", workflowId);
  } else {
    url.search = "";
  }
  url.hash = "";
  window.history.pushState({}, "", url);
}

function goToOverview() {
  pushRoute("overview");
  render();
}

function goToWorkflowDetail(workflowId) {
  const workflow = getWorkflowById(workflowId);
  state.selectedWorkflowId = workflow.id;
  state.selectedNodeKey = workflow.entryNode;
  state.detailRailExpanded = false;
  state.editorMode = "edit";
  state.zoomIndex = 1;
  state.notice = `已打开 ${workflow.name} 的节点画布。`;
  pushRoute("detail", workflow.id);
  render();
}

function filterWorkflows() {
  const normalizedQuery = state.query.trim().toLowerCase();
  return workflows.filter((workflow) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      workflow.name.toLowerCase().includes(normalizedQuery) ||
      workflow.id.toLowerCase().includes(normalizedQuery);
    const matchesFilter = state.filter === "all" || workflow.status === state.filter;
    return matchesQuery && matchesFilter;
  });
}

function renderPreviewGraph(workflow) {
  const nodeMap = new Map(workflow.graph.nodes.map((node) => [node.key, node]));
  const edgeMarkup = workflow.graph.edges
    .map(([fromKey, toKey]) => {
      const from = nodeMap.get(fromKey);
      const to = nodeMap.get(toKey);
      return `<line x1="${from.x + 48}" y1="${from.y + 28}" x2="${to.x + 48}" y2="${to.y + 28}" class="graph-edge" />`;
    })
    .join("");

  const nodeMarkup = workflow.graph.nodes
    .map(
      (node) => `
        <g>
          <circle cx="${node.x + 48}" cy="${node.y + 28}" r="26" class="graph-node graph-node-${node.state}" />
          <text x="${node.x + 48}" y="${node.y + 32}" text-anchor="middle" class="graph-label">${escapeHtml(node.shortLabel)}</text>
        </g>
      `
    )
    .join("");

  return `
    <svg viewBox="0 0 1100 340" class="graph-svg" aria-label="${escapeHtml(workflow.name)} 工作流预览图">
      ${edgeMarkup}
      ${nodeMarkup}
    </svg>
  `;
}

function getDetailAnchor(node, side) {
  const centerX = node.x + canvasMetrics.nodeWidth / 2;
  const centerY = node.y + canvasMetrics.nodeHeight / 2;
  const gap = canvasMetrics.edgeGap;

  if (side === "top") {
    return { x: centerX, y: node.y - gap };
  }
  if (side === "bottom") {
    return { x: centerX, y: node.y + canvasMetrics.nodeHeight + gap };
  }
  if (side === "left") {
    return { x: node.x - gap, y: centerY };
  }
  return { x: node.x + canvasMetrics.nodeWidth + gap, y: centerY };
}

function getDetailAnchorSides(from, to) {
  const fromCenterY = from.y + canvasMetrics.nodeHeight / 2;
  const toCenterY = to.y + canvasMetrics.nodeHeight / 2;
  const verticalDelta = toCenterY - fromCenterY;
  const verticalThreshold = canvasMetrics.nodeHeight * 0.62;

  if (verticalDelta > verticalThreshold) {
    return { source: "bottom", target: "top" };
  }
  if (verticalDelta < -verticalThreshold) {
    return { source: "top", target: "bottom" };
  }
  if (to.x < from.x) {
    return { source: "left", target: "right" };
  }
  return { source: "right", target: "left" };
}

function buildStepPoints(start, end, sourceSide) {
  if (sourceSide === "top" || sourceSide === "bottom") {
    const midY = start.y + (end.y - start.y) / 2;
    return [
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end
    ];
  }

  const midX = start.x + (end.x - start.x) / 2;
  return [
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end
  ];
}

function roundedPath(points) {
  if (points.length < 2) {
    return "";
  }

  const radius = canvasMetrics.edgeRadius;
  const path = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const previousDistance = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const nextDistance = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const cornerRadius = Math.min(radius, previousDistance / 2, nextDistance / 2);
    const before = {
      x: current.x + Math.sign(previous.x - current.x) * cornerRadius,
      y: current.y + Math.sign(previous.y - current.y) * cornerRadius
    };
    const after = {
      x: current.x + Math.sign(next.x - current.x) * cornerRadius,
      y: current.y + Math.sign(next.y - current.y) * cornerRadius
    };

    path.push(`L ${before.x} ${before.y}`);
    path.push(`Q ${current.x} ${current.y} ${after.x} ${after.y}`);
  }

  const last = points[points.length - 1];
  path.push(`L ${last.x} ${last.y}`);
  return path.join(" ");
}

function getDetailNodePorts(workflow, nodeKey) {
  const nodeMap = new Map(workflow.graph.nodes.map((node) => [node.key, node]));
  const ports = new Set();
  workflow.graph.edges.forEach(([fromKey, toKey]) => {
    const from = nodeMap.get(fromKey);
    const to = nodeMap.get(toKey);
    const sides = getDetailAnchorSides(from, to);

    if (fromKey === nodeKey) {
      ports.add(sides.source);
    }
    if (toKey === nodeKey) {
      ports.add(sides.target);
    }
  });

  return [...ports];
}

function renderCanvasNodeHandles(ports) {
  return ports
    .map((side) => `<span class="canvas-node-handle canvas-node-handle-${side}" aria-hidden="true"></span>`)
    .join("");
}

function renderDetailEdges(workflow) {
  const nodeMap = new Map(workflow.graph.nodes.map((node) => [node.key, node]));
  return workflow.graph.edges
    .map(([fromKey, toKey], index) => {
      const from = nodeMap.get(fromKey);
      const to = nodeMap.get(toKey);
      const sides = getDetailAnchorSides(from, to);
      const start = getDetailAnchor(from, sides.source);
      const end = getDetailAnchor(to, sides.target);
      const points = buildStepPoints(start, end, sides.source);
      const edgeId = `detail-edge-${index}`;
      return `
        <path id="${edgeId}" d="${roundedPath(points)}" class="detail-edge" />
      `;
    })
    .join("");
}

function renderMarkdownPreview(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let inCode = false;
  let codeLines = [];
  let listItems = [];

  function flushList() {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      listItems = [];
    }
  }

  function flushCode() {
    if (codeLines.length) {
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeLines = [];
    }
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      blocks.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      flushList();
      blocks.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push(escapeHtml(line.slice(2)));
      continue;
    }

    if (line.trim().length === 0) {
      flushList();
      continue;
    }

    flushList();
    blocks.push(`<p>${escapeHtml(line)}</p>`);
  }

  flushList();
  flushCode();
  return blocks.join("");
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
  const filteredWorkflows = filterWorkflows();
  const selectedWorkflow =
    filteredWorkflows.find((workflow) => workflow.id === state.selectedWorkflowId) ??
    filteredWorkflows[0] ??
    null;

  if (selectedWorkflow) {
    state.selectedWorkflowId = selectedWorkflow.id;
    state.selectedNodeKey = selectedWorkflow.entryNode;
  }

  document.title = "mdflow 工作流总览";

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
          <input id="search-input" type="search" placeholder="搜索工作流名称或 ID" value="${escapeHtml(state.query)}" />
        </label>
        <label class="filter-field">
          <span>状态</span>
          <select id="filter-select">
            <option value="all" ${state.filter === "all" ? "selected" : ""}>全部</option>
            <option value="running" ${state.filter === "running" ? "selected" : ""}>运行中</option>
            <option value="success" ${state.filter === "success" ? "selected" : ""}>已完成</option>
            <option value="failed" ${state.filter === "failed" ? "selected" : ""}>失败</option>
            <option value="idle" ${state.filter === "idle" ? "selected" : ""}>未运行</option>
          </select>
        </label>
        <button class="toolbar-button toolbar-button-primary" data-action="announce" data-message="新建工作流入口仅做视觉占位。">新建工作流</button>
        <button class="toolbar-button" data-action="announce" data-message="导入入口仅做视觉占位。">导入</button>
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
              ? `<div class="empty-list"><strong>没有匹配的工作流</strong><p>试试更换关键词，或清空当前筛选条件。</p></div>`
              : filteredWorkflows
                  .map(
                    (workflow) => `
                      <button class="workflow-row ${workflow.id === state.selectedWorkflowId ? "selected" : ""}" data-action="select-workflow" data-workflow-id="${workflow.id}">
                        <div class="workflow-row-top">
                          <strong>${escapeHtml(workflow.name)}</strong>
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
                      <h2>${escapeHtml(selectedWorkflow.name)}</h2>
                      <span class="status-pill status-${selectedWorkflow.status}">${statusLabel[selectedWorkflow.status]}</span>
                    </div>
                    <div class="preview-id">${selectedWorkflow.id}</div>
                    <div class="preview-path">${selectedWorkflow.path}</div>
                  </div>
                  <div class="preview-tags">
                    ${selectedWorkflow.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
                  </div>
                </div>
                <div class="action-bar">
                  <button class="action-button action-button-primary" data-action="open-detail" data-workflow-id="${selectedWorkflow.id}">打开详情</button>
                  <button class="action-button" data-action="announce" data-message="最新运行页还未开始设计。">打开最新运行</button>
                  <button class="action-button" data-action="announce" data-message="运行入口已预留，当前是静态原型。">运行</button>
                  <button class="action-button" data-action="announce" data-message="复制入口已预留，当前是静态原型。">复制</button>
                </div>
                <div class="preview-body">
                  <section class="workflow-meta-card">
                    <div class="meta-callout">${escapeHtml(selectedWorkflow.blurb)}</div>
                    <div class="meta-summary">
                      <div class="summary-chip"><span>入口节点</span><strong>${escapeHtml(selectedWorkflow.entryLabel)}</strong></div>
                      <div class="summary-chip"><span>节点数</span><strong>${selectedWorkflow.nodeCount}</strong></div>
                      <div class="summary-chip"><span>产物数</span><strong>${selectedWorkflow.outputs}</strong></div>
                      <div class="summary-chip"><span>最后编辑</span><strong>${selectedWorkflow.lastEdited}</strong></div>
                    </div>
                    <div class="run-spotlight">
                      <div class="run-spotlight-copy">
                        <span>最近一次运行</span>
                        <strong>${selectedWorkflow.latestRunId}</strong>
                        <p>${selectedWorkflow.lastRunRelative === "未运行" ? "这个工作流还没有执行记录。" : `最近一次执行更新于 ${selectedWorkflow.lastRunRelative}。`}</p>
                      </div>
                      <button class="spotlight-button" data-action="announce" data-message="运行态页面下一步再设计。">打开运行</button>
                    </div>
                    <div class="meta-footnote">这一页只负责快速选择与分发动作；真正的节点阅读与 Markdown 编辑已经切到详情页承载。</div>
                  </section>
                  <section class="graph-card">
                    <div class="graph-card-header">
                      <div>
                        <div class="section-kicker">流程预览</div>
                        <h3>工作流拓扑</h3>
                      </div>
                      <div class="graph-card-note">点击预览直接进入详情页</div>
                    </div>
                    <button class="graph-stage graph-stage-button" data-action="open-detail" data-workflow-id="${selectedWorkflow.id}">
                      ${renderPreviewGraph(selectedWorkflow)}
                    </button>
                    <div class="graph-footer">
                      <span>入口：${escapeHtml(selectedWorkflow.entryLabel)}</span>
                      <span>${selectedWorkflow.nodeCount} 个节点</span>
                      <span>${selectedWorkflow.outputs} 个产物</span>
                    </div>
                  </section>
                </div>
              </div>
            `
            : `<div class="empty-preview"><div class="section-kicker">当前工作流</div><h2>从左侧选择一个工作流</h2><p>选中后，这里会显示概览信息、高频操作和结构预览。</p></div>`
        }
      </section>
    </main>
  `);
}

function renderDetailPage(workflowId) {
  const workflow = getWorkflowById(workflowId);
  const selectedNode = getNodeByKey(workflow, state.selectedNodeKey);
  const relations = getNodeRelations(workflow, selectedNode.key);
  const zoom = zoomLevels[state.zoomIndex];
  const nodeCenterX = selectedNode.x + canvasMetrics.nodeWidth / 2;
  const unclampedToolbarLeft = nodeCenterX - canvasMetrics.toolbarWidth / 2;
  const selectedToolbarLeft = Math.max(
    canvasMetrics.canvasPadding,
    Math.min(
      unclampedToolbarLeft,
      canvasMetrics.width - canvasMetrics.toolbarWidth - canvasMetrics.canvasPadding
    )
  );
  const selectedToolbarTop = Math.max(
    canvasMetrics.canvasPadding,
    selectedNode.y - canvasMetrics.toolbarHeight - 22
  );
  const toolbarArrowOffset = Math.max(
    28,
    Math.min(canvasMetrics.toolbarWidth - 28, nodeCenterX - selectedToolbarLeft)
  );
  const lines = selectedNode.markdown.split("\n");

  state.selectedWorkflowId = workflow.id;
  state.selectedNodeKey = selectedNode.key;
  document.title = `mdflow · ${workflow.name}`;

  renderShell(`
    <div class="detail-frame">
      <aside class="detail-rail ${state.detailRailExpanded ? "expanded" : "collapsed"}">
        <button class="rail-toggle" data-action="toggle-detail-rail" aria-label="${state.detailRailExpanded ? "收起左侧栏" : "展开左侧栏"}">${state.detailRailExpanded ? "‹" : "»"}</button>
        <div class="detail-rail-icons"><span>⊞</span><span>⋯</span></div>
        ${
          state.detailRailExpanded
            ? `
              <div class="detail-rail-panel">
                <div class="section-kicker">节点导航</div>
                <h2>${escapeHtml(workflow.name)}</h2>
                <div class="detail-rail-meta">
                  <span>${workflow.nodeCount} 个节点</span>
                  <span>${workflow.outputs} 个产物</span>
                </div>
                <div class="detail-node-list">
                  ${workflow.graph.nodes
                    .map(
                      (node) => `
                        <button class="detail-node-item ${node.key === selectedNode.key ? "selected" : ""}" data-action="select-node" data-node-key="${node.key}">
                          <span class="detail-node-item-badge">${escapeHtml(node.badge)}</span>
                          <span class="detail-node-item-copy">
                            <strong>${escapeHtml(node.label)}</strong>
                            <em>${escapeHtml(nodeTypeLabel[node.type])}</em>
                          </span>
                        </button>
                      `
                    )
                    .join("")}
                </div>
              </div>
            `
            : ""
        }
      </aside>
      <div class="detail-main">
        <header class="detail-topbar">
          <div class="detail-topbar-copy">
            <button class="detail-back-link" data-action="go-overview">‹ 工作流详情</button>
            <div class="detail-title-row">
              <h1>${escapeHtml(workflow.name)}</h1>
              <span class="workflow-state-pill">${workflow.workflowState}</span>
            </div>
            <div class="detail-topbar-meta">最后编辑：${workflow.lastEdited}　由 ${workflow.owner}</div>
          </div>
          <div class="detail-topbar-actions">
            <button class="toolbar-button" data-action="announce" data-message="运行工作流入口已预留，当前是静态原型。">运行工作流</button>
            <button class="toolbar-button" data-action="save-workflow">保存</button>
            <button class="toolbar-button toolbar-button-primary" data-action="announce" data-message="发布动作已预留，待接真实能力。">发布</button>
          </div>
        </header>
        <div class="detail-content">
          <section class="canvas-surface">
            <div class="canvas-topbar">
              <div class="canvas-zoom-group">
                <button class="zoom-button" data-action="zoom-out">−</button>
                <button class="zoom-button zoom-readout" data-action="zoom-reset">${Math.round(zoom * 100)}%</button>
                <button class="zoom-button" data-action="zoom-in">＋</button>
                <button class="zoom-button" data-action="zoom-reset">适配</button>
              </div>
              <div class="canvas-legend">
                <span><i class="legend-dot legend-idle"></i>未运行</span>
                <span><i class="legend-dot legend-running"></i>运行中</span>
                <span><i class="legend-dot legend-success"></i>已完成</span>
                <span><i class="legend-dot legend-failed"></i>失败</span>
              </div>
            </div>
            <div class="canvas-board-shell">
              <div class="canvas-board" style="transform: scale(${zoom});">
                <svg viewBox="0 0 720 690" class="detail-canvas-svg" aria-hidden="true">${renderDetailEdges(workflow)}</svg>
                <div class="selected-node-toolbar" style="left:${selectedToolbarLeft}px; top:${selectedToolbarTop}px; --arrow-offset:${toolbarArrowOffset}px;">
                  <button data-action="announce" data-message="当前节点已经处于画布中心附近。">定位</button>
                  <button data-action="toggle-preview">预览</button>
                  <button data-action="run-node">运行此节点</button>
                </div>
                ${workflow.graph.nodes
                  .map(
                    (node) => `
                      <button class="canvas-node ${node.key === selectedNode.key ? "selected" : ""}" data-action="select-node" data-node-key="${node.key}" style="left:${node.x}px; top:${node.y}px;">
                        ${renderCanvasNodeHandles(getDetailNodePorts(workflow, node.key))}
                        <div class="canvas-node-head">
                          <span class="canvas-node-badge">${escapeHtml(node.badge)}</span>
                          <span class="canvas-node-type">${escapeHtml(nodeTypeLabel[node.type])}</span>
                        </div>
                        <strong>${escapeHtml(node.label)}</strong>
                        <div class="canvas-node-path">${escapeHtml(node.file)}</div>
                        <div class="canvas-node-subline">${escapeHtml(node.routeHint)}</div>
                        <div class="canvas-node-output"><span>输出</span><em>${escapeHtml(node.outputHint)}</em></div>
                      </button>
                    `
                  )
                  .join("")}
              </div>
            </div>
            <div class="canvas-notice">${escapeHtml(state.notice)}</div>
          </section>
          <aside class="editor-dock">
            <div class="editor-dock-head">
              <div>
                <div class="editor-title-row">
                  <h3>${escapeHtml(selectedNode.label)}</h3>
                  <span class="node-type-pill">${escapeHtml(nodeTypeLabel[selectedNode.type])}</span>
                </div>
                <div class="editor-path">${escapeHtml(selectedNode.file)}</div>
              </div>
              <div class="editor-head-actions">
                <button class="icon-button" data-action="announce" data-message="更多动作待接入。">⋯</button>
                <button class="icon-button" data-action="announce" data-message="右侧固定栏保持打开。">×</button>
              </div>
            </div>
            <div class="editor-toolbar">
              <button class="toolbar-button ${state.editorMode === "edit" ? "toolbar-button-primary" : ""}" data-action="save-node">保存</button>
              <button class="toolbar-button" data-action="validate-node">校验</button>
              <button class="toolbar-button" data-action="toggle-preview">${state.editorMode === "preview" ? "返回编辑" : "预览"}</button>
            </div>
            ${
              state.editorMode === "preview"
                ? `<article class="markdown-preview">${renderMarkdownPreview(selectedNode.markdown)}</article>`
                : `<label class="markdown-editor-shell"><textarea class="markdown-editor" spellcheck="false">${escapeHtml(selectedNode.markdown)}</textarea></label>`
            }
            <div class="editor-footer">
              <span>上游：${relations.upstreams.join("、") || "无"}</span>
              <span>下游：${relations.downstreams.join("、") || "无"}</span>
              <span>行 ${lines.length}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `);
}

function render() {
  const route = parseRoute();
  if (route.page === "detail") {
    renderDetailPage(route.workflowId);
    return;
  }
  renderOverviewPage();
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === "select-workflow") {
    state.selectedWorkflowId = target.dataset.workflowId;
    render();
    return;
  }

  if (action === "open-detail") {
    goToWorkflowDetail(target.dataset.workflowId);
    return;
  }

  if (action === "go-overview") {
    goToOverview();
    return;
  }

  if (action === "toggle-detail-rail") {
    state.detailRailExpanded = !state.detailRailExpanded;
    render();
    return;
  }

  if (action === "select-node") {
    state.selectedNodeKey = target.dataset.nodeKey;
    state.notice = `已切换到节点：${getNodeByKey(getWorkflowById(state.selectedWorkflowId), state.selectedNodeKey).label}`;
    render();
    return;
  }

  if (action === "zoom-in") {
    state.zoomIndex = Math.min(zoomLevels.length - 1, state.zoomIndex + 1);
    render();
    return;
  }

  if (action === "zoom-out") {
    state.zoomIndex = Math.max(0, state.zoomIndex - 1);
    render();
    return;
  }

  if (action === "zoom-reset") {
    state.zoomIndex = 1;
    render();
    return;
  }

  if (action === "toggle-preview") {
    state.editorMode = state.editorMode === "preview" ? "edit" : "preview";
    state.notice = state.editorMode === "preview" ? "已切到预览模式。" : "已返回编辑模式。";
    render();
    return;
  }

  if (action === "save-workflow") {
    state.notice = "工作流草稿已保存。";
    render();
    return;
  }

  if (action === "save-node") {
    const workflow = getWorkflowById(state.selectedWorkflowId);
    const node = getNodeByKey(workflow, state.selectedNodeKey);
    state.notice = `已保存节点：${node.label}`;
    if (state.editorMode === "preview") {
      state.editorMode = "edit";
    }
    render();
    return;
  }

  if (action === "validate-node") {
    const workflow = getWorkflowById(state.selectedWorkflowId);
    const node = getNodeByKey(workflow, state.selectedNodeKey);
    state.notice = `已校验节点：${node.label}，未发现格式问题。`;
    render();
    return;
  }

  if (action === "run-node") {
    const workflow = getWorkflowById(state.selectedWorkflowId);
    const node = getNodeByKey(workflow, state.selectedNodeKey);
    state.notice = `已将节点 ${node.label} 加入重试队列。`;
    render();
    return;
  }

  if (action === "announce") {
    state.notice = target.dataset.message;
    render();
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;

  if (target.id === "search-input") {
    state.query = target.value;
    render();
    return;
  }

  if (target.classList.contains("markdown-editor")) {
    const workflow = getWorkflowById(state.selectedWorkflowId);
    const node = getNodeByKey(workflow, state.selectedNodeKey);
    node.markdown = target.value;
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.id === "filter-select") {
    state.filter = target.value;
    render();
  }
});

window.addEventListener("popstate", render);

render();
