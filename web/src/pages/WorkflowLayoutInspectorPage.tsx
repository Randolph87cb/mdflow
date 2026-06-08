import { useEffect, useMemo, useRef, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { WorkflowOverviewWorkbench } from "../components/WorkflowOverviewWorkbench";
import {
  clearWorkflowDomStyleOverrides,
  readWorkflowDomStyleOverrides,
  saveWorkflowDomStyleOverrides,
  type WorkflowDomInspectorNode,
  type WorkflowDomStyleOverrides,
  type WorkflowLayoutField,
  WORKFLOW_LAYOUT_FIELD_LABELS,
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

const STYLE_FIELDS_TO_RESET = EDITABLE_FIELDS;

export function WorkflowLayoutInspectorPage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tree, setTree] = useState<WorkflowDomInspectorNode | null>(null);
  const [nodeMap, setNodeMap] = useState<Record<string, WorkflowDomInspectorNode>>({});
  const [overrides, setOverrides] = useState<WorkflowDomStyleOverrides>({});
  const [hydrated, setHydrated] = useState(false);
  const [domPanelOpen, setDomPanelOpen] = useState(true);
  const [stylePanelOpen, setStylePanelOpen] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [domPanelPosition, setDomPanelPosition] = useState({ x: 1460, y: 92 });
  const [stylePanelPosition, setStylePanelPosition] = useState({ x: 1020, y: 112 });

  useEffect(() => {
    setOverrides(readWorkflowDomStyleOverrides());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveWorkflowDomStyleOverrides(overrides);
  }, [hydrated, overrides]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let rafId = 0;
    const rebuild = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const root = stage.firstElementChild as HTMLElement | null;
        if (!root) return;
        const nextMap: Record<string, WorkflowDomInspectorNode> = {};
        const nextTree = buildDomInspectorTree(root, "root", 0, nextMap);
        setTree(nextTree);
        setNodeMap(nextMap);
        setExpandedIds((current) => expandAllAncestors(nextTree, selectedId, current));
        setSelectedId((current) => {
          if (current && nextMap[current]) return current;
          return nextTree.id;
        });
      });
    };

    rebuild();
    const observer = new MutationObserver(rebuild);
    observer.observe(stage, {
      subtree: true,
      childList: true,
      characterData: false,
    });

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [selectedId]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    applyDomStyleOverrides(stage, overrides);
  }, [nodeMap, overrides]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.querySelectorAll("[data-dom-inspector-selected='true']").forEach((element) => {
      element.removeAttribute("data-dom-inspector-selected");
    });
    if (!selectedId) return;
    const selected = stage.querySelector<HTMLElement>(`[data-dom-inspector-id="${cssEscape(selectedId)}"]`);
    if (selected) {
      selected.setAttribute("data-dom-inspector-selected", "true");
    }
  }, [nodeMap, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const row = document.querySelector<HTMLElement>(`[data-inspector-tree-id="${cssEscape(selectedId)}"]`);
    row?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const selectedNode = selectedId ? nodeMap[selectedId] ?? null : null;
  const selectedOverride = selectedId ? overrides[selectedId] ?? {} : {};
  const configPreview = useMemo(() => JSON.stringify(overrides, null, 2), [overrides]);

  function updateField(field: WorkflowLayoutField, value: string) {
    if (!selectedId) return;
    setOverrides((current) => {
      const next = { ...(current[selectedId] ?? {}) };
      if (value.trim()) {
        next[field] = value;
      } else {
        delete next[field];
      }

      const updated = { ...current };
      if (Object.keys(next).length) {
        updated[selectedId] = next;
      } else {
        delete updated[selectedId];
      }
      return updated;
    });
  }

  function clearSelected() {
    if (!selectedId) return;
    setOverrides((current) => {
      const updated = { ...current };
      delete updated[selectedId];
      return updated;
    });
  }

  function resetAll() {
    setOverrides({});
    clearWorkflowDomStyleOverrides();
  }

  function handleStageClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;
    const target = event.target as HTMLElement | null;
    const nextElement = target?.closest<HTMLElement>("[data-dom-inspector-id]");
    if (!nextElement || !stage.contains(nextElement)) return;

    event.preventDefault();
    event.stopPropagation();

    const nextId = nextElement.dataset.domInspectorId;
    if (!nextId) return;
    setSelectedId(nextId);
    setStylePanelOpen(true);
    setExpandedIds((current) => expandBranch(nextId, current));
  }

  function selectNode(nodeId: string) {
    setSelectedId(nodeId);
    setStylePanelOpen(true);
    setExpandedIds((current) => expandBranch(nodeId, current));
    const stage = stageRef.current;
    const target = stage?.querySelector<HTMLElement>(`[data-dom-inspector-id="${cssEscape(nodeId)}"]`);
    target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }

  function toggleExpanded(nodeId: string) {
    setExpandedIds((current) => ({
      ...current,
      [nodeId]: !(current[nodeId] ?? true),
    }));
  }

  return (
    <div className="page workflow-layout-inspector-page">
      <div ref={stageRef} className="layout-inspector-stage" onClickCapture={handleStageClickCapture}>
        <WorkflowOverviewWorkbench />
      </div>

      <DraggableInspectorWindow
        title="DOM 树"
        open={domPanelOpen}
        onToggle={() => setDomPanelOpen((current) => !current)}
        position={domPanelPosition}
        onPositionChange={setDomPanelPosition}
        className="layout-inspector-window layout-inspector-window-dom panel"
      >
        <div className="layout-inspector-window-toolbar">
          <button className="ghost-button" type="button" onClick={resetAll}>
            清空全部覆盖
          </button>
          <button className="ghost-button" type="button" onClick={() => setStylePanelOpen((current) => !current)}>
            {stylePanelOpen ? "隐藏值窗" : "显示值窗"}
          </button>
          <Link className="ghost-button" to="/">
            返回首页
          </Link>
        </div>
        <div className="layout-inspector-window-body">
          <div className="layout-inspector-section">
            <div className="subtle">
              点击树节点会跳到页面里的对应 DOM。直接点页面元素，也会在这里同步选中。
            </div>
          </div>
          <div className="layout-inspector-section">
            <div className="meta-label">DOM 树</div>
            <div className="layout-inspector-tree">
              {tree ? (
                <DomTreeNode
                  node={tree}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onSelect={selectNode}
                  onToggle={toggleExpanded}
                />
              ) : (
                <div className="subtle">正在读取页面 DOM…</div>
              )}
            </div>
          </div>
        </div>
      </DraggableInspectorWindow>

      <DraggableInspectorWindow
        title="样式值"
        open={stylePanelOpen}
        onToggle={() => setStylePanelOpen((current) => !current)}
        position={stylePanelPosition}
        onPositionChange={setStylePanelPosition}
        className="layout-inspector-window layout-inspector-window-style panel"
      >
        <div className="layout-inspector-window-body">
          <div className="layout-inspector-selection-head">
            <div>
              <div className="meta-label">当前元素</div>
              <strong>{selectedNode?.label ?? "未选中元素"}</strong>
              {selectedNode ? <div className="subtle">{selectedNode.descriptor}</div> : null}
            </div>
            <button className="ghost-button" type="button" onClick={clearSelected} disabled={!selectedId}>
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
                  disabled={!selectedId}
                />
              </label>
            ))}
          </div>
          <div className="layout-inspector-section">
            <div className="meta-label">当前配置</div>
            <pre className="code-block layout-inspector-code">{configPreview}</pre>
          </div>
        </div>
      </DraggableInspectorWindow>
    </div>
  );
}

type DraggableInspectorWindowProps = PropsWithChildren<{
  className: string;
  onPositionChange: Dispatch<SetStateAction<{ x: number; y: number }>>;
  onToggle: () => void;
  open: boolean;
  position: { x: number; y: number };
  title: string;
}>;

function DraggableInspectorWindow({
  children,
  className,
  onPositionChange,
  onToggle,
  open,
  position,
  title,
}: DraggableInspectorWindowProps) {
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) {
      return;
    }

    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };

    const move = (moveEvent: PointerEvent) => {
      onPositionChange({
        x: Math.max(8, moveEvent.clientX - dragOffsetRef.current.x),
        y: Math.max(8, moveEvent.clientY - dragOffsetRef.current.y),
      });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <aside
      className={className}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="layout-inspector-window-head" onPointerDown={handlePointerDown}>
        <div className="layout-inspector-window-title">
          <strong>{title}</strong>
          <span className="subtle">拖动标题栏可移动位置</span>
        </div>
        <button className="ghost-button" type="button" onClick={onToggle}>
          {open ? "收起" : "展开"}
        </button>
      </div>
      {open ? children : null}
    </aside>
  );
}

type DomTreeNodeProps = {
  node: WorkflowDomInspectorNode;
  selectedId: string | null;
  expandedIds: Record<string, boolean>;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
};

function DomTreeNode({ node, selectedId, expandedIds, onSelect, onToggle }: DomTreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds[node.id] ?? true;

  return (
    <div className="layout-inspector-tree-node">
      <div
        className={`layout-inspector-tree-row ${selectedId === node.id ? "active" : ""}`}
        data-inspector-tree-id={node.id}
        style={{ paddingLeft: `${node.depth * 16}px` }}
      >
        <button
          className={`layout-inspector-tree-toggle ${hasChildren ? "visible" : "placeholder"}`}
          type="button"
          onClick={() => {
            if (hasChildren) onToggle(node.id);
          }}
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (expanded ? "▾" : "▸") : "·"}
        </button>
        <button className="layout-inspector-tree-select" type="button" onClick={() => onSelect(node.id)}>
          <strong>{node.label}</strong>
          <span className="subtle">{node.descriptor}</span>
        </button>
      </div>

      {hasChildren && expanded ? (
        <div className="layout-inspector-tree-children">
          {node.children.map((child) => (
            <DomTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildDomInspectorTree(
  element: Element,
  nodeId: string,
  depth: number,
  nodeMap: Record<string, WorkflowDomInspectorNode>,
): WorkflowDomInspectorNode {
  const htmlElement = element as HTMLElement;
  htmlElement.dataset.domInspectorId = nodeId;

  const node: WorkflowDomInspectorNode = {
    id: nodeId,
    label: describeElementLabel(htmlElement),
    descriptor: describeElementDescriptor(htmlElement),
    depth,
    children: [],
  };
  nodeMap[nodeId] = node;

  const children = Array.from(element.children);
  node.children = children.map((child, index) =>
    buildDomInspectorTree(child, `${nodeId}.${index}`, depth + 1, nodeMap),
  );

  return node;
}

function describeElementLabel(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter((name) => !name.startsWith("layout-inspector"))
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join("");
  return `${tag}${id}${classes}`;
}

function describeElementDescriptor(element: HTMLElement) {
  const aria = element.getAttribute("aria-label");
  if (aria) return aria;

  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 48);

  return `${element.children.length} 个子元素`;
}

function applyDomStyleOverrides(stage: HTMLElement, overrides: WorkflowDomStyleOverrides) {
  stage.querySelectorAll<HTMLElement>("[data-dom-inspector-id]").forEach((element) => {
    for (const field of STYLE_FIELDS_TO_RESET) {
      ((element.style as unknown) as Record<string, string>)[field] = "";
    }
  });

  for (const [nodeId, override] of Object.entries(overrides)) {
    const target = stage.querySelector<HTMLElement>(`[data-dom-inspector-id="${cssEscape(nodeId)}"]`);
    if (!target) continue;
    for (const field of STYLE_FIELDS_TO_RESET) {
      ((target.style as unknown) as Record<string, string>)[field] = override[field] ?? "";
    }
  }
}

function expandAllAncestors(
  tree: WorkflowDomInspectorNode,
  selectedId: string | null,
  current: Record<string, boolean>,
) {
  if (!selectedId) {
    return current;
  }

  const branch = selectedId.split(".");
  const next = { ...current };
  let cursor = "";
  for (const segment of branch) {
    cursor = cursor ? `${cursor}.${segment}` : segment;
    next[cursor] = true;
  }
  next[tree.id] = true;
  return next;
}

function expandBranch(nodeId: string, current: Record<string, boolean>) {
  const next = { ...current };
  let cursor = "";
  for (const segment of nodeId.split(".")) {
    cursor = cursor ? `${cursor}.${segment}` : segment;
    next[cursor] = true;
  }
  return next;
}

function cssEscape(value: string) {
  return value.replace(/"/g, '\\"');
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
      return "grid / flex / block";
    case "alignSelf":
    case "justifySelf":
      return "stretch";
    default:
      return "例如 320px / 48% / auto";
  }
}
