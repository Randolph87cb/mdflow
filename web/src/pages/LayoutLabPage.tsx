import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  clampBlockToCanvas,
  clearWorkflowLayout,
  createBlock,
  createDefaultWorkflowLayout,
  getDefaultBlockTitle,
  getWorkflowBlockRelativeRect,
  normalizeLayoutCanvas,
  patchBlockFromResolvedRect,
  patchWorkflowBlockUnits,
  readStoredWorkflowLayout,
  resolveWorkflowBlockRect,
  saveWorkflowLayout,
  serializeWorkflowLayout,
  type WorkflowLayoutBlock,
  type WorkflowLayoutBlockUnits,
  type WorkflowLayoutComponentType,
  type WorkflowLayoutDefinition,
  type WorkflowLayoutField,
  type WorkflowLayoutResolvedRect,
  type WorkflowLayoutUnit,
} from "../lib/workflowLayout";

type ResizeHandle = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

type DragState =
  | {
      mode: "move";
      blockId: string;
      pointerX: number;
      pointerY: number;
      initialBlock: WorkflowLayoutBlock;
      initialRect: WorkflowLayoutResolvedRect;
    }
  | {
      mode: "resize";
      blockId: string;
      pointerX: number;
      pointerY: number;
      initialBlock: WorkflowLayoutBlock;
      initialRect: WorkflowLayoutResolvedRect;
      handle: ResizeHandle;
    };

const GRID_SIZE = 8;

const COMPONENT_OPTIONS: Array<{ type: WorkflowLayoutComponentType; label: string }> = [
  { type: "workflow-header", label: "顶部工作流信息" },
  { type: "workflow-list", label: "工作流列表" },
  { type: "workflow-actions", label: "关键操作" },
  { type: "workflow-graph", label: "节点图预览" },
  { type: "placeholder", label: "占位模块" },
];

const UNIT_OPTIONS: Array<{ value: WorkflowLayoutUnit; label: string }> = [
  { value: "px", label: "px" },
  { value: "percent", label: "%" },
];

const METRIC_FIELDS: Array<{ field: WorkflowLayoutField; label: string }> = [
  { field: "x", label: "X" },
  { field: "y", label: "Y" },
  { field: "width", label: "宽度" },
  { field: "height", label: "高度" },
];

export function LayoutLabPage() {
  const navigate = useNavigate();
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<WorkflowLayoutDefinition>(() =>
    readStoredWorkflowLayout(getViewportCanvas()),
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => {
    const initial = readStoredWorkflowLayout(getViewportCanvas());
    return initial.blocks[0]?.id ?? null;
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [message, setMessage] = useState(
    "已读取当前布局。每个模块的 X、Y、宽度、高度都可以单独切换 px 或 %。",
  );
  const [dirty, setDirty] = useState(false);

  const selectedBlock = useMemo(
    () => layout.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [layout.blocks, selectedBlockId],
  );

  const exportedJson = useMemo(() => JSON.stringify(serializeWorkflowLayout(layout), null, 2), [layout]);

  useEffect(() => {
    if (selectedBlockId && layout.blocks.some((block) => block.id === selectedBlockId)) {
      return;
    }
    setSelectedBlockId(layout.blocks[0]?.id ?? null);
  }, [layout.blocks, selectedBlockId]);

  useEffect(() => {
    const element = canvasStageRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const nextCanvas = normalizeLayoutCanvas(entry.contentRect.width, entry.contentRect.height);
      setLayout((current) => {
        if (
          current.canvas.width === nextCanvas.width &&
          current.canvas.height === nextCanvas.height
        ) {
          return current;
        }
        return {
          ...current,
          canvas: nextCanvas,
        };
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const activeDrag = dragState;

    function handlePointerMove(event: PointerEvent) {
      setLayout((current) => {
        const activeBlock = current.blocks.find((block) => block.id === activeDrag.blockId);
        if (!activeBlock) return current;

        const deltaX = snap(event.clientX - activeDrag.pointerX);
        const deltaY = snap(event.clientY - activeDrag.pointerY);
        const nextRect =
          activeDrag.mode === "move"
            ? {
                ...activeDrag.initialRect,
                x: activeDrag.initialRect.x + deltaX,
                y: activeDrag.initialRect.y + deltaY,
              }
            : resizeResolvedRect(activeDrag.initialRect, activeDrag.handle, deltaX, deltaY);

        const nextBlock = clampBlockToCanvas(
          patchBlockFromResolvedRect(activeDrag.initialBlock, current.canvas, nextRect),
          current.canvas,
        );

        return {
          ...current,
          blocks: current.blocks.map((block) => (block.id === nextBlock.id ? nextBlock : block)),
        };
      });
      setDirty(true);
    }

    function handlePointerUp() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  return (
    <div className="page layout-lab-page">
      <section className="layout-lab-hero panel">
        <div>
          <div className="eyebrow">Layout Lab</div>
          <h1>按真实页面宽高直接画模块</h1>
          <p>
            画布会跟着当前编辑区域自动伸缩，不再锁定一个像素尺寸。每个模块的 X、Y、宽度和高度都可以分别选择 `px` 或 `%`。
          </p>
        </div>
        <div className="layout-lab-hero-meta">
          <span className="metric-chip">
            画布 {layout.canvas.width} x {layout.canvas.height}
          </span>
          <span className="metric-chip">模块 {layout.blocks.length} 个</span>
          <span className={`status-pill ${dirty ? "running" : "success"}`}>{dirty ? "未保存" : "已保存"}</span>
        </div>
      </section>

      <section className="layout-lab-shell">
        <div className="layout-lab-main panel">
          <div className="panel-header layout-lab-toolbar">
            <div className="layout-lab-toolbar-group">
              {COMPONENT_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const nextBlock = createBlock(option.type, layout.blocks.length, layout.canvas);
                    setLayout((current) => ({ ...current, blocks: [...current.blocks, nextBlock] }));
                    setSelectedBlockId(nextBlock.id);
                    setDirty(true);
                    setMessage(`已新增 ${option.label}。`);
                  }}
                >
                  新增{option.label}
                </button>
              ))}
            </div>
            <div className="layout-lab-toolbar-group">
              <button
                type="button"
                className="secondary-button"
                disabled={!selectedBlock}
                onClick={() => {
                  if (!selectedBlock) return;
                  setLayout((current) => ({
                    ...current,
                    blocks: current.blocks.filter((block) => block.id !== selectedBlock.id),
                  }));
                  setSelectedBlockId(null);
                  setDirty(true);
                  setMessage("已删除当前模块。");
                }}
              >
                删除当前模块
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const nextLayout = createDefaultWorkflowLayout(layout.canvas.width, layout.canvas.height);
                  clearWorkflowLayout();
                  setLayout(nextLayout);
                  setSelectedBlockId(nextLayout.blocks[0]?.id ?? null);
                  setDirty(true);
                  setMessage("已重置为默认四区布局。");
                }}
              >
                重置默认
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(exportedJson);
                    setMessage("布局 JSON 已复制到剪贴板。");
                  } catch {
                    setMessage("浏览器没有提供剪贴板权限，但页面里的 JSON 仍可手动复制。");
                  }
                }}
              >
                复制 JSON
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  saveWorkflowLayout(layout);
                  setDirty(false);
                  setMessage("布局已保存到本地。");
                }}
              >
                保存布局
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  saveWorkflowLayout(layout);
                  setDirty(false);
                  navigate("/");
                }}
              >
                应用到 workflow 页
              </button>
            </div>
          </div>

          <div className="layout-lab-status">{message}</div>

          <div className="layout-lab-canvas-stage" ref={canvasStageRef}>
            <div className="layout-lab-canvas">
              {layout.blocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                const relative = getWorkflowBlockRelativeRect(block, layout.canvas);
                const resolved = resolveWorkflowBlockRect(block, layout.canvas);
                return (
                  <div
                    key={block.id}
                    className={`layout-lab-block ${isSelected ? "selected" : ""}`}
                    style={{
                      left: `${resolved.x}px`,
                      top: `${resolved.y}px`,
                      width: `${resolved.width}px`,
                      height: `${resolved.height}px`,
                      zIndex: block.zIndex,
                    }}
                    onPointerDown={(event) => {
                      if ((event.target as HTMLElement).dataset.handle) return;
                      event.preventDefault();
                      setSelectedBlockId(block.id);
                      setDragState({
                        mode: "move",
                        blockId: block.id,
                        pointerX: event.clientX,
                        pointerY: event.clientY,
                        initialBlock: block,
                        initialRect: resolved,
                      });
                    }}
                  >
                    <div className="layout-lab-block-header">
                      <strong>{block.title}</strong>
                      <span>{getComponentLabel(block.componentType)}</span>
                    </div>
                    <div className="layout-lab-block-meta">
                      <span>
                        {formatBlockMetric(block.width, block.units.width)} x {formatBlockMetric(block.height, block.units.height)}
                      </span>
                      <span>
                        {formatBlockMetric(block.x, block.units.x)}, {formatBlockMetric(block.y, block.units.y)}
                      </span>
                      <span>
                        {relative.widthPct}% x {relative.heightPct}%
                      </span>
                    </div>
                    {RESIZE_HANDLES.map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        data-handle={handle}
                        className={`layout-lab-resize-handle handle-${handle}`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedBlockId(block.id);
                          setDragState({
                            mode: "resize",
                            blockId: block.id,
                            pointerX: event.clientX,
                            pointerY: event.clientY,
                            initialBlock: block,
                            initialRect: resolved,
                            handle,
                          });
                        }}
                        aria-label={`调整 ${block.title} 大小`}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="layout-lab-sidebar panel">
          <div className="panel-header layout-lab-panel-header">
            <div>
              <strong>属性面板</strong>
              <div className="subtle">模块的四个字段都能单独切换单位。保存后 JSON 会保留单位定义和相对比例。</div>
            </div>
          </div>

          <div className="layout-lab-form">
            <div className="panel-header layout-lab-panel-header">
              <div>
                <strong>当前画布</strong>
                <div className="subtle">这里直接反映当前页面可用区域大小，不再手工输入画布像素。</div>
              </div>
            </div>
            <div className="layout-lab-grid-fields">
              <MetricPreview label="宽度" value={`${layout.canvas.width}px`} />
              <MetricPreview label="高度" value={`${layout.canvas.height}px`} />
            </div>
          </div>

          {selectedBlock ? (
            <div className="layout-lab-form">
              <label className="field">
                <span>模块标题</span>
                <input
                  value={selectedBlock.title}
                  onChange={(event) => {
                    updateSelectedBlock(setLayout, selectedBlock.id, { title: event.target.value });
                    setDirty(true);
                  }}
                />
              </label>
              <label className="field">
                <span>组件类型</span>
                <select
                  value={selectedBlock.componentType}
                  onChange={(event) => {
                    const componentType = event.target.value as WorkflowLayoutComponentType;
                    updateSelectedBlock(setLayout, selectedBlock.id, {
                      componentType,
                      title: getDefaultBlockTitle(componentType),
                    });
                    setDirty(true);
                  }}
                >
                  {COMPONENT_OPTIONS.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="layout-lab-field-grid">
                {METRIC_FIELDS.map(({ field, label }) => (
                  <MetricField
                    key={field}
                    label={label}
                    value={selectedBlock[field]}
                    unit={selectedBlock.units[field]}
                    onChange={(value) => {
                      updateSelectedBlock(setLayout, selectedBlock.id, { [field]: value } as Partial<WorkflowLayoutBlock>);
                      setDirty(true);
                    }}
                    onUnitChange={(unit) => {
                      updateSelectedBlockUnits(setLayout, selectedBlock.id, layout.canvas, { [field]: unit });
                      setDirty(true);
                    }}
                  />
                ))}
              </div>

              <NumberField
                label="层级"
                value={selectedBlock.zIndex}
                step="1"
                onChange={(value) => {
                  updateSelectedBlock(setLayout, selectedBlock.id, { zIndex: value });
                  setDirty(true);
                }}
              />
            </div>
          ) : (
            <div className="empty-state">先在左侧画布里选中一个模块，或先新增一个模块。</div>
          )}

          <div className="layout-lab-json">
            <div className="panel-header layout-lab-panel-header">
              <div>
                <strong>布局 JSON</strong>
                <div className="subtle">这里会写入数值、单位和相对比例，便于后续直接生成页面。</div>
              </div>
            </div>
            <textarea readOnly value={exportedJson} className="layout-lab-json-viewer" />
          </div>
        </aside>
      </section>
    </div>
  );
}

function MetricPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="layout-lab-metric-preview">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricField({
  label,
  value,
  unit,
  onChange,
  onUnitChange,
}: {
  label: string;
  value: number;
  unit: WorkflowLayoutUnit;
  onChange: (value: number) => void;
  onUnitChange: (unit: WorkflowLayoutUnit) => void;
}) {
  return (
    <div className="layout-lab-metric-field">
      <NumberField
        label={label}
        value={value}
        step={unit === "percent" ? "0.1" : "1"}
        onChange={onChange}
      />
      <label className="field">
        <span>单位</span>
        <select value={unit} onChange={(event) => onUnitChange(event.target.value as WorkflowLayoutUnit)}>
          {UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value || 0));
        }}
      />
    </label>
  );
}

function updateSelectedBlock(
  setLayout: Dispatch<SetStateAction<WorkflowLayoutDefinition>>,
  blockId: string,
  patch: Partial<WorkflowLayoutBlock>,
) {
  setLayout((current) => ({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === blockId ? clampBlockToCanvas({ ...block, ...patch }, current.canvas) : block,
    ),
  }));
}

function updateSelectedBlockUnits(
  setLayout: Dispatch<SetStateAction<WorkflowLayoutDefinition>>,
  blockId: string,
  canvas: WorkflowLayoutDefinition["canvas"],
  unitsPatch: Partial<WorkflowLayoutBlockUnits>,
) {
  setLayout((current) => ({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === blockId ? clampBlockToCanvas(patchWorkflowBlockUnits(block, canvas, unitsPatch), current.canvas) : block,
    ),
  }));
}

function resizeResolvedRect(
  rect: WorkflowLayoutResolvedRect,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
) {
  const next = { ...rect };

  if (handle.includes("e")) {
    next.width = rect.width + deltaX;
  }
  if (handle.includes("s")) {
    next.height = rect.height + deltaY;
  }
  if (handle.includes("w")) {
    next.x = rect.x + deltaX;
    next.width = rect.width - deltaX;
  }
  if (handle.includes("n")) {
    next.y = rect.y + deltaY;
    next.height = rect.height - deltaY;
  }

  return next;
}

function snap(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function getViewportCanvas() {
  if (typeof window === "undefined") {
    return { width: 1440, height: 960 };
  }
  return normalizeLayoutCanvas(window.innerWidth - 520, window.innerHeight - 280);
}

function getComponentLabel(componentType: WorkflowLayoutComponentType) {
  return COMPONENT_OPTIONS.find((option) => option.type === componentType)?.label ?? "占位模块";
}

function formatBlockMetric(value: number, unit: WorkflowLayoutUnit) {
  return unit === "percent" ? `${value}%` : `${Math.round(value)}px`;
}

const RESIZE_HANDLES: ResizeHandle[] = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];
