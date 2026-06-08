import type { CSSProperties } from "react";

export const WORKFLOW_LAYOUT_IDS = [
  "hero",
  "layout",
  "sidebar",
  "main",
  "actions",
  "graph",
] as const;

export type WorkflowLayoutId = (typeof WORKFLOW_LAYOUT_IDS)[number];

export type WorkflowLayoutOverride = Partial<Record<WorkflowLayoutField, string>>;
export type WorkflowLayoutOverrides = Partial<Record<WorkflowLayoutId, WorkflowLayoutOverride>>;
export type WorkflowDomStyleOverride = Partial<Record<WorkflowLayoutField, string>>;
export type WorkflowDomStyleOverrides = Record<string, WorkflowDomStyleOverride>;

export type WorkflowDomInspectorNode = {
  id: string;
  label: string;
  descriptor: string;
  depth: number;
  children: WorkflowDomInspectorNode[];
};

export type WorkflowLayoutField =
  | "display"
  | "width"
  | "height"
  | "minHeight"
  | "maxWidth"
  | "gridTemplateColumns"
  | "gridTemplateRows"
  | "gridColumn"
  | "gridRow"
  | "gap"
  | "padding"
  | "margin"
  | "alignSelf"
  | "justifySelf";

export const WORKFLOW_LAYOUT_FIELD_LABELS: Record<WorkflowLayoutField, string> = {
  display: "display",
  width: "宽度",
  height: "高度",
  minHeight: "最小高度",
  maxWidth: "最大宽度",
  gridTemplateColumns: "grid-template-columns",
  gridTemplateRows: "grid-template-rows",
  gridColumn: "grid-column",
  gridRow: "grid-row",
  gap: "gap",
  padding: "padding",
  margin: "margin",
  alignSelf: "align-self",
  justifySelf: "justify-self",
};

export const WORKFLOW_LAYOUT_LABELS: Record<WorkflowLayoutId, string> = {
  hero: "顶部当前工作流信息",
  layout: "内容区主布局",
  sidebar: "左侧工作流列表",
  main: "右侧主列",
  actions: "右上关键操作",
  graph: "右下节点图",
};

const STORAGE_KEY = "mdflow.workflow-layout-inspector";
const DOM_STORAGE_KEY = "mdflow.workflow-dom-inspector";

export function readWorkflowLayoutOverrides(): WorkflowLayoutOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WorkflowLayoutOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveWorkflowLayoutOverrides(overrides: WorkflowLayoutOverrides) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function clearWorkflowLayoutOverrides() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function readWorkflowDomStyleOverrides(): WorkflowDomStyleOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DOM_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WorkflowDomStyleOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveWorkflowDomStyleOverrides(overrides: WorkflowDomStyleOverrides) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DOM_STORAGE_KEY, JSON.stringify(overrides));
}

export function clearWorkflowDomStyleOverrides() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DOM_STORAGE_KEY);
}

export function toWorkflowLayoutStyle(override?: WorkflowLayoutOverride): CSSProperties | undefined {
  if (!override) return undefined;
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(override)) {
    if (!value) continue;
    style[key] = value;
  }
  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}
