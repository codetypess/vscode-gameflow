import type { CSSProperties } from "react";
import { ImageIcon } from "lucide-react";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { defaultStyle, inheritedFlag } from "../../shared/editor-ops";
import { resolvePageLayout, type ResolvedNode } from "../../shared/ui-layout";
import { intersectPolygons, mapPoint } from "../../shared/ui-transform";
import { controlSelected, hasNodeSkin } from "../../shared/ui-parts";
import { LabelView } from "./label-view";

export { orderedNodes } from "../../shared/editor-ops";

export function NodeView({ page, node, geometry, hitId, referenceError }: { page: GameFlowPage; node: GameFlowNode; geometry?: ResolvedNode; hitId?: string; referenceError?: string }) {
  if (inheritedFlag(page, node, "hidden")) return null;
  const appearance = { ...defaultStyle(node.type), ...node.style };
  const resolved = geometry ?? resolvePageLayout(page).nodes.get(node.id)!;
  const bounds = resolved.local;
  const clipped = resolved.clipPolygon ? intersectPolygons(resolved.corners, resolved.clipPolygon) : undefined;
  const clipLocal = clipped && resolved.inverse ? clipped.map(p => mapPoint(resolved.inverse!, p)) : undefined;
  const widget = node.widget ?? {};
  const disabledOpacity = (item: GameFlowNode) => item.widget?.disabled && !["checkbox", "radio", "radioGroup", "slider", "button"].includes(item.type) ? .45 : 1;
  const partImage = node.type === "image" && page.nodes.some(parent => parent.id === node.parentId && hasNodeSkin(parent));
  const ratio = Math.max(0, Math.min(1, ((widget.value ?? widget.min ?? 0) - (widget.min ?? 0)) / ((widget.max ?? 1) - (widget.min ?? 0))));
  let opacity = appearance.opacity;
  let parentId = node.parentId;
  while (parentId) {
    const parent = page.nodes.find((item) => item.id === parentId);
    if (!parent) break;
    opacity *= (parent.style?.opacity ?? 1) * disabledOpacity(parent);
    parentId = parent.parentId;
  }
  const style: CSSProperties = {
    left: 0, top: 0, width: bounds.width, height: bounds.height,
    transformOrigin: "0 0", transform: `matrix(${resolved.matrix.join(",")})`,
    backgroundColor: appearance.fill, color: appearance.color,
    border: `${appearance.borderWidth}px solid ${appearance.borderColor}`,
    borderRadius: appearance.radius, fontSize: appearance.fontSize, fontWeight: appearance.fontWeight,
    fontStyle: appearance.italic ? "italic" : "normal",
    textDecorationLine: [appearance.underline && "underline", appearance.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
    textAlign: appearance.textAlign, justifyContent: appearance.textAlign === "left" ? "flex-start" : appearance.textAlign === "right" ? "flex-end" : "center",
    opacity: opacity * disabledOpacity(node),
    overflow: node.type === "text" && widget.overflow === "visible" ? "visible" : "hidden",
    alignItems: widget.valign === "top" ? "flex-start" : widget.valign === "bottom" ? "flex-end" : node.type === "text" && !widget.valign ? "flex-start" : "center",
    ...(clipLocal?.length ? { clipPath: `polygon(${clipLocal.map(p => `${p.x}px ${p.y}px`).join(",")})` } : {}),
    ...(!resolved.inverse || (clipped && clipped.length < 3) ? { visibility: "hidden" } : {})
  };
  return <div className={`node-body node-${node.type}${referenceError ? " reference-broken" : ""}`} data-node-id={hitId ?? node.id} data-reference-error={referenceError} data-locked={inheritedFlag(page, node, "locked")} style={style}>
    {referenceError ? <span className="reference-error-label" role="status">组件引用失效<br />{referenceError}</span> : null}
    {node.type === "image" ? node.imageData
      ? <img src={node.imageData} alt={node.name} draggable={false} style={{ objectFit: widget.imageFit ?? "contain" }} />
      : partImage ? null : <span className="image-placeholder"><ImageIcon size={24} /><small>图片</small></span>
      : node.type === "list" ? page.nodes.some((n) => n.parentId === node.id) ? null : <div className="list-placeholder">{Array.from({ length: 8 }, (_, i) => <span key={i} />)}</div>
      : ["container", "rectangle", "hbox", "vbox", "grid", "panel", "radioGroup"].includes(node.type) || hasNodeSkin(node) ? null
      : node.type === "button" && node.text === undefined ? null
      : node.type === "checkbox" || node.type === "radio" ? <div className="widget-choice"><span className={`widget-check ${node.type === "radio" ? "is-radio" : ""}`}>{controlSelected(page, node) ? node.type === "radio" ? "●" : "✓" : ""}</span><span>{node.text ?? node.name}</span></div>
      : node.type === "progress" ? <div className={`widget-progress ${widget.direction === "vertical" ? "is-vertical" : ""}`}><span style={widget.direction === "vertical" ? { height: `${ratio * 100}%` } : { width: `${ratio * 100}%` }} /><small>{Math.round(ratio * 100)}%</small></div>
      : node.type === "slider" ? <div className={`widget-slider ${widget.direction === "vertical" ? "is-vertical" : ""}`}><span className="widget-track" /><span className="widget-thumb" style={widget.direction === "vertical" ? { top: `${(1 - ratio) * 100}%` } : { left: `${ratio * 100}%` }} /></div>
      : node.type === "combo" ? <div className="widget-combo"><span>{(widget.options ?? ["选项一", "选项二", "选项三"])[widget.selectedIndex ?? 0] ?? "请选择"}</span><span>⌄</span></div>
      : node.type === "input" ? <span className="widget-input" style={{ opacity: node.text ? 1 : 0.55 }}>{node.text ? widget.password ? "•".repeat(Math.min(node.text.length, widget.maxChars || Infinity)) : node.text.slice(0, widget.maxChars || undefined) : widget.placeholder ?? "请输入内容"}</span>
      : node.type === "text" ? <LabelView node={node} width={bounds.width} height={bounds.height} />
      : <span className="node-content" style={{ whiteSpace: widget.wordWrap === false ? "pre" : "pre-wrap", overflowWrap: widget.wordWrap === false ? "normal" : "anywhere" }}>{node.text ?? node.name}</span>}
  </div>;
}
