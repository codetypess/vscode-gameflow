import type { CSSProperties } from "react";
import { ImageIcon } from "lucide-react";
import type { Frame, GameFlowNode, GameFlowPage } from "../../shared/model";
import { defaultStyle, inheritedFlag } from "../../shared/editor-ops";
import { intersectFrames, resolvePageLayout, type ResolvedNode } from "../../shared/ui-layout";

export { orderedNodes } from "../../shared/editor-ops";

export function NodeView({ page, node, frame, geometry }: { page: GameFlowPage; node: GameFlowNode; frame?: Frame; geometry?: ResolvedNode }) {
  if (inheritedFlag(page, node, "hidden")) return null;
  const appearance = { ...defaultStyle(node.type), ...node.style };
  const resolved = geometry ?? resolvePageLayout(page).nodes.get(node.id)!;
  const bounds = frame ?? resolved.absolute;
  const clipped = resolved.clip ? intersectFrames(resolved.clip, bounds) : undefined;
  const widget = node.widget ?? {};
  const ratio = Math.max(0, Math.min(1, ((widget.value ?? widget.min ?? 0) - (widget.min ?? 0)) / ((widget.max ?? 1) - (widget.min ?? 0))));
  let opacity = appearance.opacity;
  let parentId = node.parentId;
  while (parentId) {
    const parent = page.nodes.find((item) => item.id === parentId);
    if (!parent) break;
    opacity *= (parent.style?.opacity ?? 1) * (parent.widget?.disabled ? 0.45 : 1);
    parentId = parent.parentId;
  }
  const style: CSSProperties = {
    left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height,
    backgroundColor: appearance.fill, color: appearance.color,
    border: `${appearance.borderWidth}px solid ${appearance.borderColor}`,
    borderRadius: appearance.radius, fontSize: appearance.fontSize, fontWeight: appearance.fontWeight,
    textAlign: appearance.textAlign, justifyContent: appearance.textAlign === "left" ? "flex-start" : appearance.textAlign === "right" ? "flex-end" : "center",
    opacity: opacity * (widget.disabled ? 0.45 : 1),
    overflow: node.type === "text" && widget.overflow === "visible" ? "visible" : "hidden",
    alignItems: widget.valign === "top" ? "flex-start" : widget.valign === "bottom" ? "flex-end" : node.type === "text" && !widget.valign ? "flex-start" : "center",
    ...(clipped ? { clipPath: `inset(${Math.max(0, clipped.y - bounds.y)}px ${Math.max(0, bounds.x + bounds.width - clipped.x - clipped.width)}px ${Math.max(0, bounds.y + bounds.height - clipped.y - clipped.height)}px ${Math.max(0, clipped.x - bounds.x)}px)` } : {}),
    ...(clipped && (!clipped.width || !clipped.height) ? { visibility: "hidden" } : {})
  };
  return <div className={`node-body node-${node.type}`} data-node-id={node.id} data-locked={inheritedFlag(page, node, "locked")} style={style}>
    {node.type === "image" ? node.imageData
      ? <img src={node.imageData} alt={node.name} draggable={false} style={{ objectFit: widget.imageFit ?? "contain" }} />
      : <span className="image-placeholder"><ImageIcon size={24} /><small>图片</small></span>
      : node.type === "list" ? page.nodes.some((n) => n.parentId === node.id) ? null : <div className="list-placeholder">{Array.from({ length: 8 }, (_, i) => <span key={i} />)}</div>
      : ["container", "rectangle", "hbox", "vbox", "grid", "panel"].includes(node.type) ? null
      : node.type === "button" && node.text === undefined && page.nodes.some((n) => n.parentId === node.id) ? null
      : node.type === "checkbox" || node.type === "radio" ? <div className="widget-choice"><span className={`widget-check ${node.type === "radio" ? "is-radio" : ""}`}>{widget.selected ? node.type === "radio" ? "●" : "✓" : ""}</span><span>{node.text ?? node.name}</span></div>
      : node.type === "progress" ? <div className={`widget-progress ${widget.direction === "vertical" ? "is-vertical" : ""}`}><span style={widget.direction === "vertical" ? { height: `${ratio * 100}%` } : { width: `${ratio * 100}%` }} /><small>{Math.round(ratio * 100)}%</small></div>
      : node.type === "slider" ? <div className={`widget-slider ${widget.direction === "vertical" ? "is-vertical" : ""}`}><span className="widget-track" /><span className="widget-thumb" style={widget.direction === "vertical" ? { top: `${(1 - ratio) * 100}%` } : { left: `${ratio * 100}%` }} /></div>
      : node.type === "combo" ? <div className="widget-combo"><span>{(widget.options ?? ["选项一", "选项二", "选项三"])[widget.selectedIndex ?? 0] ?? "请选择"}</span><span>⌄</span></div>
      : node.type === "input" ? <span className="widget-input" style={{ opacity: node.text ? 1 : 0.55 }}>{node.text ? widget.password ? "•".repeat(Math.min(node.text.length, widget.maxChars || Infinity)) : node.text.slice(0, widget.maxChars || undefined) : widget.placeholder ?? "请输入内容"}</span>
      : <span className="node-content" style={{ whiteSpace: widget.wordWrap === false ? "pre" : "pre-wrap", overflowWrap: widget.wordWrap === false ? "normal" : "anywhere" }}>{node.text ?? node.name}</span>}
  </div>;
}
