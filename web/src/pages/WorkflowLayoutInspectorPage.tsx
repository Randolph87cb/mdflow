import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WorkflowOverviewWorkbench } from "../components/WorkflowOverviewWorkbench";
import {
  clearWorkflowLayoutOverrides,
  readWorkflowLayoutOverrides,
  saveWorkflowLayoutOverrides,
  type WorkflowLayoutField,
  type WorkflowLayoutId,
  type WorkflowLayoutOverrides,
  WORKFLOW_LAYOUT_FIELD_LABELS,
  WORKFLOW_LAYOUT_IDS,
  WORKFLOW_LAYOUT_LABELS,
} from "../lib/workflowLayoutInspector";

const EDITABLE_FIELDS: WorkflowLayoutField[] = [
  "display",
  "width",
  "height",
  "minHeight",
  "maxWidth",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridColumn",
  "gridRow",
  "gap",
  "padding",
  "margin",
  "alignSelf",
  "justifySelf",
];

export function WorkflowLayoutInspectorPage() {
  const [selectedId, setSelectedId] = useState<WorkflowLayoutId>("hero");
  const [overrides, setOverrides] = useState<WorkflowLayoutOverrides>({});
  const [hydrated, setHydrated] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    setOverrides(readWorkflowLayoutOverrides());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveWorkflowLayoutOverrides(overrides);
  }, [hydrated, overrides]);

  const selectedOverride = overrides[selectedId] ?? {};
  const configPreview = useMemo(() => JSON.stringify(overrides, null, 2), [overrides]);

  function updateField(field: WorkflowLayoutField, value: string) {
    setOverrides((current) => {
      const next = { ...(current[selectedId] ?? {}) };
      if (value.trim()) {
        next[field] = value;
      } else {
        delete next[field];
      }

      const updated: WorkflowLayoutOverrides = { ...current };
      if (Object.keys(next).length) {
        updated[selectedId] = next;
      } else {
        delete updated[selectedId];
      }
      return updated;
    });
  }

  function clearSelected() {
    setOverrides((current) => {
      const updated = { ...current };
      delete updated[selectedId];
      return updated;
    });
  }

  function resetAll() {
    setOverrides({});
    clearWorkflowLayoutOverrides();
  }

  return (
    <div className="page workflow-layout-inspector-page">
      <div className="layout-inspector-stage">
        <WorkflowOverviewWorkbench
          inspector={{
            enabled: true,
            selectedId,
            overrides,
            onSelect: (layoutId) => {
              setSelectedId(layoutId);
              setPanelOpen(true);
            },
          }}
        />
      </div>

      <div className="layout-inspector-toolbar">
        <div className="layout-inspector-toolbar-card">
          <div className="layout-inspector-toolbar-copy">
            <div>
              <strong>Inspector</strong>
              <div className="subtle">
                当前元素：{WORKFLOW_LAYOUT_LABELS[selectedId]}
              </div>
            </div>
          </div>
          <div className="layout-inspector-toolbar-actions">
            <button className="ghost-button" type="button" onClick={() => setPanelOpen((current) => !current)}>
              {panelOpen ? "隐藏设置窗" : "显示设置窗"}
            </button>
            <button className="ghost-button" type="button" onClick={resetAll}>
              清空全部覆盖
            </button>
            <Link className="ghost-button" to="/">
              返回首页
            </Link>
          </div>
        </div>
      </div>

      <aside className={`layout-inspector-sidebar panel ${panelOpen ? "open" : "closed"}`}>
        <div className="layout-inspector-sidebar-handle">
          <button className="ghost-button" type="button" onClick={() => setPanelOpen((current) => !current)}>
            {panelOpen ? "收起" : "展开"}
          </button>
        </div>
        {panelOpen ? (
          <>
          <div className="panel-header">
            <div>
              <strong>布局设置</strong>
              <div className="subtle">先选中模块，再改这一块自己的布局值。</div>
            </div>
          </div>

          <div className="layout-inspector-sidebar-body">
            <div className="layout-inspector-section">
              <div className="meta-label">可选元素</div>
              <div className="layout-inspector-target-list">
                {WORKFLOW_LAYOUT_IDS.map((layoutId) => (
                  <button
                    key={layoutId}
                    className={`layout-inspector-target ${selectedId === layoutId ? "active" : ""}`}
                    type="button"
                    onClick={() => setSelectedId(layoutId)}
                  >
                    <strong>{WORKFLOW_LAYOUT_LABELS[layoutId]}</strong>
                    <span className="subtle">{layoutId}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="layout-inspector-section">
              <div className="layout-inspector-selection-head">
                <div>
                  <div className="meta-label">当前元素</div>
                  <strong>{WORKFLOW_LAYOUT_LABELS[selectedId]}</strong>
                </div>
                <button className="ghost-button" type="button" onClick={clearSelected}>
                  清空当前元素
                </button>
              </div>
              <div className="layout-inspector-field-grid">
                {EDITABLE_FIELDS.map((field) => (
                  <label key={field} className="layout-inspector-field">
                    <span>{WORKFLOW_LAYOUT_FIELD_LABELS[field]}</span>
                    <input
                      type="text"
                      value={selectedOverride[field] ?? ""}
                      onChange={(event) => updateField(field, event.target.value)}
                      placeholder={getFieldPlaceholder(field)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="layout-inspector-section">
              <div className="meta-label">当前配置</div>
              <pre className="code-block layout-inspector-code">{configPreview}</pre>
            </div>
          </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function getFieldPlaceholder(field: WorkflowLayoutField) {
  switch (field) {
    case "gridTemplateColumns":
      return "320px minmax(0, 1fr)";
    case "gridTemplateRows":
      return "auto minmax(0, 1fr)";
    case "gridColumn":
      return "1 / -1";
    case "gridRow":
      return "2";
    case "gap":
      return "18px";
    case "display":
      return "grid";
    case "alignSelf":
    case "justifySelf":
      return "stretch";
    default:
      return "例如 320px / 48% / auto";
  }
}
