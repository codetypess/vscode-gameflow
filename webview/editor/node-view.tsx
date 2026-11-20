import type { CSSProperties } from "react";
import { nodeImageSlot, progressRatio } from "../../shared/image-slots";
import { SlotImage } from "../runtime/slot-image";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { defaultStyle, inheritedFlag } from "../../shared/editor-ops";
import { resolvePageLayout, type ResolvedNode } from "../../shared/ui-layout";
import { intersectPolygons, mapPoint } from "../../shared/ui-transform";
import { skinOwner } from "../../shared/ui-parts";
import { LabelView } from "./label-view";
import { ResourceCanvas, useSliceResources } from "../runtime/resource-context";

export { orderedNodes } from "../../shared/editor-ops";

export function NodeView({ page, node, geometry, hitId, referenceError }: { page: GameFlowPage; node: GameFlowNode; geometry?: ResolvedNode; hitId?: string; referenceError?: string }) {
  const resources = useSliceResources();
  const resource = node.sliceResource && resources.mode !== "prototype" ? resources.resolve(node.sliceResource) : undefined;
  if (inheritedFlag(page, node, "hidden")) return null;
  const appearance = { ...defaultStyle(node.type), ...node.style };
  const resolved = geometry ?? resolvePageLayout(page, resources.sizes).nodes.get(node.id)!;
  const bounds = resolved.local;
  const clipped = resolved.clipPolygon ? intersectPolygons(resolved.corners, resolved.clipPolygon) : undefined;
  const clipLocal = clipped && resolved.inverse ? clipped.map(p => mapPoint(resolved.inverse!, p)) : undefined;
  const widget = node.widget ?? {};
  const disabledOpacity = (item: GameFlowNode) => item.widget?.disabled && !["checkbox", "radio", "radioGroup", "slider", "button"].includes(item.type) ? .45 : 1;
  const owner = skinOwner(page, node);
  const progress = owner?.type === "progress" ? { ratio: progressRatio(owner), mode: owner.widget?.mode ?? "horizontal" as const, fullWidth: Math.max(0, (resolvePageLayout(page, resources.sizes).nodes.get(owner.id)?.local.width ?? owner.frame.width) - (owner.layout?.paddingLeft ?? 0) - (owner.layout?.paddingRight ?? 0)) } : undefined;
  const combo = page.nodes.find(parent => parent.type === "combo" && parent.widget?.textLabelNodeId === node.id && node.parentId === parent.id);
  const displayNode = combo ? { ...node, text: (combo.widget?.options ?? [])[combo.widget?.selectedIndex ?? -1] ?? "" } : node;
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
    backgroundColor: "transparent", color: appearance.color,
    border: "none",
    borderRadius: 0, fontSize: appearance.fontSize, fontWeight: appearance.fontWeight,
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
    {node.type === "image" || node.type === "button" ? node.type === "button" || node.image !== undefined
      ? <SlotImage sourceSize={resources.sizes.get("@builtin:" + node.id)} slot={nodeImageSlot(node, resources.mode)} width={bounds.width} height={bounds.height} label={node.name} fit={widget.imageFit ?? "fill"} progress={progress} />
      : resource ? resource.status === "ready" ? <ResourceCanvas resource={resource} width={bounds.width} height={bounds.height} fit={widget.imageFit ?? "fill"} label={node.name} progress={progress} />
        : <span className="slice-resource-placeholder" role="status" data-resource-status={resource.status}>{resource.status === "error" ? "切图异常\n" + resource.error : "装载中…"}</span>
      : resources.mode !== "prototype" && node.imageData ? <img src={node.imageData} alt={node.name} draggable={false} style={{ objectFit: widget.imageFit ?? "fill" }} />
      : <SlotImage slot={{ builtin: "image/default" }} width={bounds.width} height={bounds.height} label={node.name} progress={progress} />
      : node.type === "input" ? <span className="widget-input" style={{ opacity: node.text ? 1 : 0.55 }}>{node.text ? widget.password ? "•".repeat(Math.min(node.text.length, widget.maxChars || Infinity)) : node.text.slice(0, widget.maxChars || undefined) : widget.placeholder ?? "请输入内容"}</span>
      : node.type === "text" ? <LabelView node={displayNode} width={bounds.width} height={bounds.height} />
      : null}

  </div>;
}
