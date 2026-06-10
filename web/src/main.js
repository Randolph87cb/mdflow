import "./styles.css";
import { workflows } from "./data.js";

const app = document.querySelector("#app");

const state = {
  query: "",
  filter: "all",
  selectedId: workflows[0].id
};

const statusLabel = {
  failed: "Failed",
  success: "Success",
  running: "Running",
  idle: "Idle"
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
    <svg viewBox="0 0 940 300" class="graph-svg" aria-label="${workflow.name} workflow graph preview">
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
            <div class="brand-kicker">Workflow Studio</div>
            <div class="brand-title">mdflow</div>
          </div>
        </div>
        <div class="toolbar">
          <label class="search-field">
            <span class="search-icon">⌕</span>
            <input id="search-input" type="search" placeholder="Search workflow by name or id" value="${state.query}" />
          </label>
          <label class="filter-field">
            <span>Status</span>
            <select id="filter-select">
              <option value="all" ${state.filter === "all" ? "selected" : ""}>All</option>
              <option value="running" ${state.filter === "running" ? "selected" : ""}>Running</option>
              <option value="failed" ${state.filter === "failed" ? "selected" : ""}>Failed</option>
              <option value="idle" ${state.filter === "idle" ? "selected" : ""}>Idle</option>
            </select>
          </label>
          <button class="toolbar-button toolbar-button-primary">New Workflow</button>
          <button class="toolbar-button">Import</button>
        </div>
      </header>
      <main class="workspace">
        <aside class="workflow-rail">
          <div class="rail-header">
            <div>
              <div class="section-kicker">Workflows</div>
              <h1>${filteredWorkflows.length} visible</h1>
            </div>
            <span class="muted-chip">${workflows.length} total</span>
          </div>
          <div class="workflow-list">
            ${
              filteredWorkflows.length === 0
                ? `
                  <div class="empty-list">
                    <strong>No workflows found</strong>
                    <p>Adjust the keyword or clear the status filter.</p>
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
                            <span>${workflow.nodeCount} nodes</span>
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
                      <div class="section-kicker">Selected workflow</div>
                      <div class="preview-title-row">
                        <h2>${selectedWorkflow.name}</h2>
                        <span class="status-pill status-${selectedWorkflow.status}">${statusLabel[selectedWorkflow.status]}</span>
                      </div>
                      <div class="preview-id">${selectedWorkflow.id}</div>
                    </div>
                    <div class="preview-tags">
                      ${selectedWorkflow.tags.map((tag) => `<span>${tag}</span>`).join("")}
                    </div>
                  </div>
                  <div class="action-bar">
                    <button class="action-button">Open Details</button>
                    <button class="action-button" ${selectedWorkflow.latestRunId === "No runs yet" ? "disabled" : ""}>Open Latest Run</button>
                    <button class="action-button action-button-primary">Run</button>
                    <button class="action-button">Duplicate</button>
                  </div>
                  <div class="preview-body">
                    <section class="workflow-meta-card">
                      <div class="meta-callout">${selectedWorkflow.blurb}</div>
                      <div class="meta-grid">
                        <div class="meta-item">
                          <span>Path</span>
                          <strong>${selectedWorkflow.path}</strong>
                        </div>
                        <div class="meta-item">
                          <span>Entry node</span>
                          <strong>${selectedWorkflow.entryNode}</strong>
                        </div>
                        <div class="meta-item">
                          <span>Node count</span>
                          <strong>${selectedWorkflow.nodeCount}</strong>
                        </div>
                        <div class="meta-item">
                          <span>Outputs</span>
                          <strong>${selectedWorkflow.outputs}</strong>
                        </div>
                        <div class="meta-item">
                          <span>Latest run</span>
                          <strong>${selectedWorkflow.latestRunId}</strong>
                        </div>
                        <div class="meta-item">
                          <span>Last edited</span>
                          <strong>${selectedWorkflow.lastEdited}</strong>
                        </div>
                      </div>
                    </section>
                    <section class="graph-card">
                      <div class="graph-card-header">
                        <div>
                          <div class="section-kicker">Graph preview</div>
                          <h3>Workflow topology</h3>
                        </div>
                        <div class="graph-card-note">Preview only, edit happens in details</div>
                      </div>
                      <div class="graph-stage">
                        ${renderGraph(selectedWorkflow)}
                      </div>
                    </section>
                  </div>
                </div>
              `
              : `
                <div class="empty-preview">
                  <div class="section-kicker">Selected workflow</div>
                  <h2>Pick a workflow from the left rail</h2>
                  <p>The overview, actions, and graph preview will appear here.</p>
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
