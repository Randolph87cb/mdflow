import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import {
  clampBlockToCanvas,
  clearWorkflowLayout,
  createBlock,
  createDefaultWorkflowLayout,
  getDefaultBlockTitle,
  readStoredWorkflowLayout,
  saveWorkflowLayout,
  type WorkflowLayoutBlock,
  type WorkflowLayoutComponentType,
  type WorkflowLayoutDefinition,
} from "../lib/workflowLayout";

type ResizeHandle = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

type DragState =
  | {
      mode: "move";
      blockId: string;
      pointerX: number;
      pointerY: number;
      initialBlock: WorkflowLayoutBlock;
    }
  | {
      mode: "resize";
      blockId: string;
      pointerX: number;
      pointerY: number;
      initialBlock: WorkflowLayoutBlock;
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

export function LayoutLabPage() {
  const navigate = useNavigate();
  const [layout, setLayout] = useState<WorkflowLayoutDefinition>(() =>
    readStoredWorkflowLayout(getViewportCanvas()),
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => {
    const initial = readStoredWorkflowLayout(getViewportCanvas());
    return initial.blocks[0]?.id ?? null;
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [message, setMessage] = useState("已读取当前布局。你可以直接拖动矩形，按像素调整页面骨架。");
  const [dirty, setDirty] = useState(false);

  const selectedBlock = useMemo(
    () => layout.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [layout.blocks, selectedBlockId],
  );

  const exportedJson = useMemo(() => JSON.stringify(layout, null, 2), [layout]);

  useEffect(() => {
    if (selectedBlockId && layout.blocks.some((block) => block.id === selectedBlockId)) {
      return;
    }
    setSelectedBlockId(layout.blocks[0]?.id ?? null);
  }, [layout.blocks, selectedBlockId]);

  useEffect(() => {
    if (!dragState) return;
    const activeDrag = dragState;

    function handlePointerMove(event: PointerEvent) {
      setLayout((current) => {
        const activeBlock = current.blocks.find((block) => block.id === activeDrag.blockId);
        if (!activeBlock) return current;

        const deltaX = snap(event.clientX - activeDrag.pointerX);
        const deltaY = snap(event.clientY - activeDrag.pointerY);
        const nextBlock =
          activeDrag.mode === "move"
            ? clampBlockToCanvas(
                {
                  ...activeDrag.initialBlock,
                  x: activeDrag.initialBlock.x + deltaX,
                  y: activeDrag.initialBlock.y + deltaY,
                },
                current.canvas,
              )
            : clampBlockToCanvas(
                resizeBlock(activeDrag.initialBlock, activeDrag.handle, deltaX, deltaY),
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
          <h1>像画框一样定义 workflow 页面布局</h1>
          <p>
            先按像素放置四个真实模块，再把这份布局直接应用到 workflow 首页。第一版只解决结构与尺寸，不处理配色和细节视觉。
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
                onClick={() => {
                  const nextCanvas = getViewportCanvas();
                  setLayout((current) => ({
                    ...current,
                    canvas: nextCanvas,
                    blocks: current.blocks.map((block) => clampBlockToCanvas(block, nextCanvas)),
                  }));
                  setDirty(true);
                  setMessage(`画布已同步到当前窗口尺寸 ${nextCanvas.width} x ${nextCanvas.height}。`);
                }}
              >
                同步窗口尺寸
              </button>
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

          <div className="layout-lab-canvas-wrap">
            <div
              className="layout-lab-canvas"
              style={{
                width: `${layout.canvas.width}px`,
                height: `${layout.canvas.height}px`,
              }}
            >
              {layout.blocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                return (
                  <div
                    key={block.id}
                    className={`layout-lab-block ${isSelected ? "selected" : ""}`}
                    style={{
                      left: `${block.x}px`,
                      top: `${block.y}px`,
                      width: `${block.width}px`,
                      height: `${block.height}px`,
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
                      });
                    }}
                  >
                    <div className="layout-lab-block-header">
                      <strong>{block.title}</strong>
                      <span>{getComponentLabel(block.componentType)}</span>
                    </div>
                    <div className="layout-lab-block-meta">
                      <span>
                        {block.width} x {block.height}
                      </span>
                      <span>
                        {block.x}, {block.y}
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
              <div className="subtle">输入像素值时会自动限制在画布范围内，便于直接贴合页面尺寸。</div>
            </div>
          </div>

          <div className="layout-lab-form">
            <div className="panel-header layout-lab-panel-header">
              <div>
                <strong>画布尺寸</strong>
                <div className="subtle">优先按当前窗口大小编辑，也可以直接输入像素值模拟目标分辨率。</div>
              </div>
            </div>
            <div className="layout-lab-grid-fields">
              <NumberField
                label="画布宽度"
                value={layout.canvas.width}
                onChange={(value) => {
                  const nextCanvas = {
                    width: Math.max(960, value),
                    height: layout.canvas.height,
                  };
                  setLayout((current) => ({
                    ...current,
                    canvas: nextCanvas,
                    blocks: current.blocks.map((block) => clampBlockToCanvas(block, nextCanvas)),
                  }));
                  setDirty(true);
                }}
              />
              <NumberField
                label="画布高度"
                value={layout.canvas.height}
                onChange={(value) => {
                  const nextCanvas = {
                    width: layout.canvas.width,
                    height: Math.max(720, value),
                  };
                  setLayout((current) => ({
                    ...current,
                    canvas: nextCanvas,
                    blocks: current.blocks.map((block) => clampBlockToCanvas(block, nextCanvas)),
                  }));
                  setDirty(true);
                }}
              />
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

              <div className="layout-lab-grid-fields">
                <NumberField
                  label="X"
                  value={selectedBlock.x}
                  onChange={(value) => {
                    updateSelectedBlock(setLayout, selectedBlock.id, { x: value });
                    setDirty(true);
                  }}
                />
                <NumberField
                  label="Y"
                  value={selectedBlock.y}
                  onChange={(value) => {
                    updateSelectedBlock(setLayout, selectedBlock.id, { y: value });
                    setDirty(true);
                  }}
                />
                <NumberField
                  label="宽度"
                  value={selectedBlock.width}
                  onChange={(value) => {
                    updateSelectedBlock(setLayout, selectedBlock.id, { width: value });
                    setDirty(true);
                  }}
                />
                <NumberField
                  label="高度"
                  value={selectedBlock.height}
                  onChange={(value) => {
                    updateSelectedBlock(setLayout, selectedBlock.id, { height: value });
                    setDirty(true);
                  }}
                />
              </div>

              <NumberField
                label="层级"
                value={selectedBlock.zIndex}
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
                <div className="subtle">这份数据就是 workflow 首页布局的输入源。</div>
              </div>
            </div>
            <textarea readOnly value={exportedJson} className="layout-lab-json-viewer" />
          </div>
        </aside>
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
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

function resizeBlock(block: WorkflowLayoutBlock, handle: ResizeHandle, deltaX: number, deltaY: number) {
  let next = { ...block };

  if (handle.includes("e")) {
    next.width = block.width + deltaX;
  }
  if (handle.includes("s")) {
    next.height = block.height + deltaY;
  }
  if (handle.includes("w")) {
    next.x = block.x + deltaX;
    next.width = block.width - deltaX;
  }
  if (handle.includes("n")) {
    next.y = block.y + deltaY;
    next.height = block.height - deltaY;
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
  return {
    width: Math.max(960, window.innerWidth - 88),
    height: Math.max(720, window.innerHeight - 180),
  };
}

function getComponentLabel(componentType: WorkflowLayoutComponentType) {
  return COMPONENT_OPTIONS.find((option) => option.type === componentType)?.label ?? "占位模块";
}

const RESIZE_HANDLES: ResizeHandle[] = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];
