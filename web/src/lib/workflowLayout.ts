import type { CSSProperties } from "react";

export type WorkflowLayoutComponentType =
  | "workflow-header"
  | "workflow-list"
  | "workflow-actions"
  | "workflow-graph"
  | "placeholder";

export type WorkflowLayoutUnit = "px" | "percent" | "fill";

export type WorkflowLayoutField = "x" | "y" | "width" | "height";

export type WorkflowLayoutBlockUnits = Record<WorkflowLayoutField, WorkflowLayoutUnit>;

export type WorkflowLayoutBlock = {
  id: string;
  title: string;
  componentType: WorkflowLayoutComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  units: WorkflowLayoutBlockUnits;
};

export type WorkflowLayoutBlockRelativeRect = {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
};

export type WorkflowLayoutResolvedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkflowLayoutDefinition = {
  canvas: {
    width: number;
    height: number;
  };
  blocks: WorkflowLayoutBlock[];
};

type StoredWorkflowLayoutBlock = Partial<WorkflowLayoutBlock> & {
  relative?: Partial<WorkflowLayoutBlockRelativeRect>;
  units?: Partial<WorkflowLayoutBlockUnits>;
};

type StoredWorkflowLayoutDefinition = {
  canvas?: Partial<WorkflowLayoutDefinition["canvas"]>;
  blocks?: StoredWorkflowLayoutBlock[];
};

export const WORKFLOW_LAYOUT_STORAGE_KEY = "mdflow.workflow-layout.v1";

const MIN_BLOCK_WIDTH = 120;
const MIN_BLOCK_HEIGHT = 88;

export function createDefaultWorkflowLayout(canvasWidth = 1440, canvasHeight = 960): WorkflowLayoutDefinition {
  return {
    canvas: {
      width: canvasWidth,
      height: canvasHeight,
    },
    blocks: [
      {
        id: "header",
        title: "顶部工作流信息",
        componentType: "workflow-header",
        x: 1.67,
        y: 24,
        width: 96.67,
        height: 196,
        zIndex: 1,
        units: { x: "percent", y: "px", width: "percent", height: "px" },
      },
      {
        id: "sidebar",
        title: "工作流列表",
        componentType: "workflow-list",
        x: 1.67,
        y: 244,
        width: 22.08,
        height: 0,
        zIndex: 1,
        units: { x: "percent", y: "px", width: "percent", height: "fill" },
      },
      {
        id: "actions",
        title: "关键操作",
        componentType: "workflow-actions",
        x: 25.42,
        y: 244,
        width: 72.92,
        height: 230,
        zIndex: 1,
        units: { x: "percent", y: "px", width: "percent", height: "px" },
      },
      {
        id: "graph",
        title: "节点图预览",
        componentType: "workflow-graph",
        x: 25.42,
        y: 498,
        width: 72.92,
        height: 0,
        zIndex: 1,
        units: { x: "percent", y: "px", width: "percent", height: "fill" },
      },
    ],
  };
}

export function getDefaultBlockTitle(componentType: WorkflowLayoutComponentType) {
  switch (componentType) {
    case "workflow-header":
      return "顶部工作流信息";
    case "workflow-list":
      return "工作流列表";
    case "workflow-actions":
      return "关键操作";
    case "workflow-graph":
      return "节点图预览";
    default:
      return "占位模块";
  }
}

export function createBlock(
  componentType: WorkflowLayoutComponentType,
  blockIndex: number,
  canvas: WorkflowLayoutDefinition["canvas"],
): WorkflowLayoutBlock {
  const offset = 24 + blockIndex * 18;
  return clampBlockToCanvas(
    {
      id: `${componentType}-${Date.now()}`,
      title: getDefaultBlockTitle(componentType),
      componentType,
      x: offset,
      y: offset,
      width: Math.min(320, Math.max(160, canvas.width - offset * 2)),
      height: Math.min(180, Math.max(120, canvas.height - offset * 2)),
      zIndex: 1,
      units: { x: "px", y: "px", width: "px", height: "px" },
    },
    canvas,
  );
}

export function readStoredWorkflowLayout(defaultCanvas?: { width: number; height: number }) {
  const fallback = createDefaultWorkflowLayout(defaultCanvas?.width, defaultCanvas?.height);
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(WORKFLOW_LAYOUT_STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    return normalizeWorkflowLayout(JSON.parse(raw), fallback.canvas);
  } catch {
    return fallback;
  }
}

export function saveWorkflowLayout(layout: WorkflowLayoutDefinition) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    WORKFLOW_LAYOUT_STORAGE_KEY,
    JSON.stringify(serializeWorkflowLayout(normalizeWorkflowLayout(layout))),
  );
}

export function clearWorkflowLayout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WORKFLOW_LAYOUT_STORAGE_KEY);
}

export function normalizeWorkflowLayout(
  input: Partial<StoredWorkflowLayoutDefinition> | StoredWorkflowLayoutDefinition,
  fallbackCanvas?: { width: number; height: number },
): WorkflowLayoutDefinition {
  const canvasWidth = clampNumber(input.canvas?.width, 480, 3840, fallbackCanvas?.width ?? 1440);
  const canvasHeight = clampNumber(input.canvas?.height, 360, 2160, fallbackCanvas?.height ?? 960);
  const canvas = { width: canvasWidth, height: canvasHeight };

  const blocks = Array.isArray(input.blocks)
    ? input.blocks.map((block, index) => {
        const units = normalizeUnits(block.units);
        const resolvedX = readLayoutMetric(block.x, units.x, block.relative?.xPct, canvas.width, 24 + index * 12);
        const resolvedY = readLayoutMetric(block.y, units.y, block.relative?.yPct, canvas.height, 24 + index * 12);
        const resolvedRect: WorkflowLayoutResolvedRect = {
          x: resolvedX,
          y: resolvedY,
          width:
            units.width === "fill"
              ? Math.max(MIN_BLOCK_WIDTH, canvas.width - resolvedX)
              : readLayoutMetric(block.width, units.width, block.relative?.widthPct, canvas.width, 320),
          height:
            units.height === "fill"
              ? Math.max(MIN_BLOCK_HEIGHT, canvas.height - resolvedY)
              : readLayoutMetric(block.height, units.height, block.relative?.heightPct, canvas.height, 180),
        };

        return clampBlockToCanvas(
          patchBlockFromResolvedRect(
            {
              id: typeof block.id === "string" && block.id ? block.id : `block-${index + 1}`,
              title: typeof block.title === "string" && block.title ? block.title : `模块 ${index + 1}`,
              componentType: isWorkflowComponentType(block.componentType) ? block.componentType : "placeholder",
              x: block.x ?? 0,
              y: block.y ?? 0,
              width: block.width ?? 0,
              height: block.height ?? 0,
              zIndex: clampNumber(block.zIndex, 0, 20, 1),
              units,
            },
            canvas,
            resolvedRect,
          ),
          canvas,
        );
      })
    : [];

  return {
    canvas,
    blocks,
  };
}

export function serializeWorkflowLayout(layout: WorkflowLayoutDefinition) {
  const normalized = normalizeWorkflowLayout(layout);
  return {
    canvas: normalized.canvas,
    blocks: normalized.blocks.map((block) => ({
      ...block,
      relative: getWorkflowBlockRelativeRect(block, normalized.canvas),
    })),
  };
}

export function getWorkflowLayoutBlock(
  layout: WorkflowLayoutDefinition,
  componentType: WorkflowLayoutComponentType,
) {
  return layout.blocks.find((block) => block.componentType === componentType) ?? null;
}

export function getWorkflowBlockStyle(block: WorkflowLayoutBlock): CSSProperties {
  const left = formatMetric(block.x, block.units.x);
  const top = formatMetric(block.y, block.units.y);
  return {
    left,
    top,
    width: block.units.width === "fill" ? `calc(100% - ${left})` : formatMetric(block.width, block.units.width),
    height: block.units.height === "fill" ? `calc(100% - ${top})` : formatMetric(block.height, block.units.height),
    zIndex: block.zIndex,
  };
}

export function resolveWorkflowBlockRect(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
): WorkflowLayoutResolvedRect {
  return {
    x: convertMetricToPixels(block.x, block.units.x, canvas.width),
    y: convertMetricToPixels(block.y, block.units.y, canvas.height),
    width: convertMetricToPixels(block.width, block.units.width, canvas.width),
    height: convertMetricToPixels(block.height, block.units.height, canvas.height),
  };
}

export function getWorkflowBlockRelativeRect(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
): WorkflowLayoutBlockRelativeRect {
  const resolved = resolveWorkflowBlockRect(block, canvas);
  return {
    xPct: roundPercent((resolved.x / canvas.width) * 100),
    yPct: roundPercent((resolved.y / canvas.height) * 100),
    widthPct: roundPercent((resolved.width / canvas.width) * 100),
    heightPct: roundPercent((resolved.height / canvas.height) * 100),
  };
}

export function patchBlockFromResolvedRect(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
  resolvedPatch: Partial<WorkflowLayoutResolvedRect>,
) {
  const current = resolveWorkflowBlockRect(block, canvas);
  const next = {
    ...current,
    ...resolvedPatch,
  };

  return {
    ...block,
    x: convertPixelsToMetric(next.x, block.units.x, canvas.width),
    y: convertPixelsToMetric(next.y, block.units.y, canvas.height),
    width: convertPixelsToMetric(next.width, block.units.width, canvas.width),
    height: convertPixelsToMetric(next.height, block.units.height, canvas.height),
  };
}

export function patchWorkflowBlockUnits(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
  unitsPatch: Partial<WorkflowLayoutBlockUnits>,
) {
  const current = resolveWorkflowBlockRect(block, canvas);
  const nextUnits = {
    ...block.units,
    ...unitsPatch,
  };

  return {
    ...block,
    units: nextUnits,
    x: convertPixelsToMetric(current.x, nextUnits.x, canvas.width),
    y: convertPixelsToMetric(current.y, nextUnits.y, canvas.height),
    width: convertPixelsToMetric(current.width, nextUnits.width, canvas.width),
    height: convertPixelsToMetric(current.height, nextUnits.height, canvas.height),
  };
}

export function clampBlockToCanvas(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
): WorkflowLayoutBlock {
  const resolved = resolveWorkflowBlockRect(block, canvas);
  const width = clampNumber(resolved.width, MIN_BLOCK_WIDTH, canvas.width, MIN_BLOCK_WIDTH);
  const height = clampNumber(resolved.height, MIN_BLOCK_HEIGHT, canvas.height, MIN_BLOCK_HEIGHT);
  const x = clampNumber(resolved.x, 0, Math.max(0, canvas.width - width), 0);
  const y = clampNumber(resolved.y, 0, Math.max(0, canvas.height - height), 0);
  return patchBlockFromResolvedRect(block, canvas, { x, y, width, height });
}

export function normalizeLayoutCanvas(
  width: number,
  height: number,
): WorkflowLayoutDefinition["canvas"] {
  return {
    width: clampNumber(width, 480, 3840, 1440),
    height: clampNumber(height, 360, 2160, 960),
  };
}

function normalizeUnits(units?: Partial<WorkflowLayoutBlockUnits>): WorkflowLayoutBlockUnits {
  return {
    x: units?.x === "percent" ? "percent" : "px",
    y: units?.y === "percent" ? "percent" : "px",
    width: units?.width === "fill" ? "fill" : units?.width === "percent" ? "percent" : "px",
    height: units?.height === "fill" ? "fill" : units?.height === "percent" ? "percent" : "px",
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function readLayoutMetric(
  rawValue: unknown,
  unit: WorkflowLayoutUnit,
  relativeValue: unknown,
  axisSize: number,
  fallbackPx: number,
) {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return convertMetricToPixels(rawValue, unit, axisSize);
  }
  if (typeof relativeValue === "number" && Number.isFinite(relativeValue)) {
    return convertPercentToPixels(relativeValue, axisSize, fallbackPx);
  }
  return fallbackPx;
}

function convertMetricToPixels(value: number, unit: WorkflowLayoutUnit, axisSize: number) {
  if (unit === "percent") {
    return Math.round((value / 100) * axisSize);
  }
  return Math.round(value);
}

function convertPixelsToMetric(value: number, unit: WorkflowLayoutUnit, axisSize: number) {
  if (unit === "percent") {
    return roundPercent((value / axisSize) * 100);
  }
  if (unit === "fill") {
    return 0;
  }
  return Math.round(value);
}

function formatMetric(value: number, unit: WorkflowLayoutUnit) {
  if (unit === "fill") {
    return "0px";
  }
  return unit === "percent" ? `${value}%` : `${Math.round(value)}px`;
}

function convertPercentToPixels(percent: number, axisSize: number, fallback: number) {
  if (!Number.isFinite(percent)) return fallback;
  return Math.round((percent / 100) * axisSize);
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function isWorkflowComponentType(value: unknown): value is WorkflowLayoutComponentType {
  return (
    value === "workflow-header" ||
    value === "workflow-list" ||
    value === "workflow-actions" ||
    value === "workflow-graph" ||
    value === "placeholder"
  );
}
