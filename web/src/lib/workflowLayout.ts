import type { CSSProperties } from "react";

export type WorkflowLayoutComponentType =
  | "workflow-header"
  | "workflow-list"
  | "workflow-actions"
  | "workflow-graph"
  | "placeholder";

export type WorkflowLayoutBlock = {
  id: string;
  title: string;
  componentType: WorkflowLayoutComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

export type WorkflowLayoutBlockRelativeRect = {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
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
        x: 24,
        y: 24,
        width: canvasWidth - 48,
        height: 196,
        zIndex: 1,
      },
      {
        id: "sidebar",
        title: "工作流列表",
        componentType: "workflow-list",
        x: 24,
        y: 244,
        width: 318,
        height: canvasHeight - 268,
        zIndex: 1,
      },
      {
        id: "actions",
        title: "关键操作",
        componentType: "workflow-actions",
        x: 366,
        y: 244,
        width: canvasWidth - 390,
        height: 230,
        zIndex: 1,
      },
      {
        id: "graph",
        title: "节点图预览",
        componentType: "workflow-graph",
        x: 366,
        y: 498,
        width: canvasWidth - 390,
        height: canvasHeight - 522,
        zIndex: 1,
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
      width: Math.min(320, canvas.width - offset * 2),
      height: Math.min(180, canvas.height - offset * 2),
      zIndex: 1,
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
  const canvasWidth = clampNumber(input.canvas?.width, 960, 3840, fallbackCanvas?.width ?? 1440);
  const canvasHeight = clampNumber(input.canvas?.height, 640, 2160, fallbackCanvas?.height ?? 960);
  const canvas = { width: canvasWidth, height: canvasHeight };
  const blocks = Array.isArray(input.blocks)
    ? input.blocks.map((block, index) =>
        clampBlockToCanvas(
          {
            id: typeof block.id === "string" && block.id ? block.id : `block-${index + 1}`,
            title: typeof block.title === "string" && block.title ? block.title : `模块 ${index + 1}`,
            componentType: isWorkflowComponentType(block.componentType) ? block.componentType : "placeholder",
            x: readLayoutMetric(block.x, block.relative?.xPct, canvas.width, 24 + index * 12),
            y: readLayoutMetric(block.y, block.relative?.yPct, canvas.height, 24 + index * 12),
            width: readLayoutMetric(block.width, block.relative?.widthPct, canvas.width, 320),
            height: readLayoutMetric(block.height, block.relative?.heightPct, canvas.height, 180),
            zIndex: clampNumber(block.zIndex, 0, 20, 1),
          },
          canvas,
        ),
      )
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

export function getWorkflowBlockStyle(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
): CSSProperties {
  const relative = getWorkflowBlockRelativeRect(block, canvas);
  return {
    left: `${relative.xPct}%`,
    top: `${relative.yPct}%`,
    width: `${relative.widthPct}%`,
    height: `${relative.heightPct}%`,
    zIndex: block.zIndex,
  };
}

export function getWorkflowBlockRelativeRect(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
): WorkflowLayoutBlockRelativeRect {
  return {
    xPct: roundPercent((block.x / canvas.width) * 100),
    yPct: roundPercent((block.y / canvas.height) * 100),
    widthPct: roundPercent((block.width / canvas.width) * 100),
    heightPct: roundPercent((block.height / canvas.height) * 100),
  };
}

export function patchBlockWithRelativeRect(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
  relativePatch: Partial<WorkflowLayoutBlockRelativeRect>,
) {
  const currentRelative = getWorkflowBlockRelativeRect(block, canvas);
  return clampBlockToCanvas(
    {
      ...block,
      x:
        relativePatch.xPct !== undefined
          ? convertPercentToPixels(relativePatch.xPct, canvas.width, block.x)
          : convertPercentToPixels(currentRelative.xPct, canvas.width, block.x),
      y:
        relativePatch.yPct !== undefined
          ? convertPercentToPixels(relativePatch.yPct, canvas.height, block.y)
          : convertPercentToPixels(currentRelative.yPct, canvas.height, block.y),
      width:
        relativePatch.widthPct !== undefined
          ? convertPercentToPixels(relativePatch.widthPct, canvas.width, block.width)
          : convertPercentToPixels(currentRelative.widthPct, canvas.width, block.width),
      height:
        relativePatch.heightPct !== undefined
          ? convertPercentToPixels(relativePatch.heightPct, canvas.height, block.height)
          : convertPercentToPixels(currentRelative.heightPct, canvas.height, block.height),
    },
    canvas,
  );
}

export function resizeWorkflowLayoutToCanvas(
  layout: WorkflowLayoutDefinition,
  nextCanvas: WorkflowLayoutDefinition["canvas"],
) {
  return {
    canvas: nextCanvas,
    blocks: layout.blocks.map((block) =>
      patchBlockWithRelativeRect(block, nextCanvas, getWorkflowBlockRelativeRect(block, layout.canvas)),
    ),
  };
}

export function clampBlockToCanvas(
  block: WorkflowLayoutBlock,
  canvas: WorkflowLayoutDefinition["canvas"],
): WorkflowLayoutBlock {
  const width = clampNumber(block.width, MIN_BLOCK_WIDTH, canvas.width, MIN_BLOCK_WIDTH);
  const height = clampNumber(block.height, MIN_BLOCK_HEIGHT, canvas.height, MIN_BLOCK_HEIGHT);
  const x = clampNumber(block.x, 0, Math.max(0, canvas.width - width), 0);
  const y = clampNumber(block.y, 0, Math.max(0, canvas.height - height), 0);
  return {
    ...block,
    x,
    y,
    width,
    height,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function readLayoutMetric(pxValue: unknown, percentValue: unknown, axisSize: number, fallback: number) {
  if (typeof pxValue === "number" && Number.isFinite(pxValue)) {
    return Math.round(pxValue);
  }
  if (typeof percentValue === "number" && Number.isFinite(percentValue)) {
    return convertPercentToPixels(percentValue, axisSize, fallback);
  }
  return fallback;
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
