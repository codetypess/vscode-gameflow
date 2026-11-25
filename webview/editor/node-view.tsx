import { useContext, type CSSProperties } from "react";
import { cellKey, listCellOffset, listCellPositions, listScrollType } from "../../shared/list-cell";
import { orderedNodes } from "../../shared/editor-ops";
import { ListCells } from "./list-cell-context";
import { nodeImageSlot, progressRatio } from "../../shared/image-slots";
import { SlotImage } from "../runtime/slot-image";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { defaultStyle, inheritedFlag } from "../../shared/editor-ops";
import { resolvePageLayout, type ResolvedNode } from "../../shared/ui-layout";
import { intersectPolygons, mapPoint } from "../../shared/ui-transform";
import { skinOwner } from "../../shared/ui-parts";
import { LabelView } from "./label-view";
import { ResourceCanvas, SliceResourcesProvider, useSliceResources } from "../runtime/resource-context";

export { orderedNodes } from "../../shared/editor-ops";

export function NodeView({ page, node, geometry, hitId, referenceError, cellTrail = [], previewBudget = 5000 }: { page: GameFlowPage; node: GameFlowNode; geometry?: ResolvedNode; hitId?: string; referenceError?: string; cellTrail?: string[]; previewBudget?: number }) {
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
    overflow: node.type === "list" && listScrollType(node) === 0 || node.type === "text" && widget.overflow === "visible" ? "visible" : "hidden",
    alignItems: widget.valign === "top" ? "flex-start" : widget.valign === "bottom" ? "flex-end" : node.type === "text" && !widget.valign ? "flex-start" : "center",
    ...(clipLocal?.length ? { clipPath: `polygon(${clipLocal.map(p => `${p.x}px ${p.y}px`).join(",")})` } : {}),
    ...(!resolved.inverse || (clipped && clipped.length < 3) ? { visibility: "hidden" } : {})
  };
  return <div className={`node-body node-${node.type}${referenceError ? " reference-broken" : ""}`} data-node-id={hitId ?? node.id} data-reference-error={referenceError} data-locked={inheritedFlag(page, node, "locked")} style={style}>
    {referenceError ? <span className="reference-error-label" role="status">组件引用失效<br />{referenceError}</span> : null}
    {node.type === "list" && node.cellPrefab && <ListCellPreview list={node} bounds={bounds} trail={cellTrail} budget={previewBudget} />}
    {node.type === "image" || node.type === "button" ? node.type === "button" || node.image !== undefined
      ? <SlotImage slot={nodeImageSlot(node, resources.mode)} width={bounds.width} height={bounds.height} label={node.name} fit={widget.imageFit ?? "fill"} progress={progress} />
      : resource ? resource.status === "ready" ? <ResourceCanvas resource={resource} width={bounds.width} height={bounds.height} fit={widget.imageFit ?? "fill"} label={node.name} progress={progress} />
        : <span className="slice-resource-placeholder" role="status" data-resource-status={resource.status}>{resource.status === "error" ? "切图异常\n" + resource.error : "装载中…"}</span>
      : node.imageData && (!node.sliceResource || resources.mode !== "prototype") ? <img src={node.imageData} alt={node.name} draggable={false} style={{ objectFit: widget.imageFit ?? "fill" }} />
      : <SlotImage slot={{ builtin: "image/default" }} width={bounds.width} height={bounds.height} label={node.name} progress={progress} />
      : node.type === "input" ? <span className="widget-input" style={{ opacity: node.text ? 1 : 0.55 }}>{node.text ? widget.password ? "•".repeat(Math.min(node.text.length, widget.maxChars || Infinity)) : node.text.slice(0, widget.maxChars || undefined) : widget.placeholder ?? "请输入内容"}</span>
      : node.type === "text" ? <LabelView node={displayNode} width={bounds.width} height={bounds.height} />
      : null}

  </div>;
}

function ListCellPreview({ list, bounds, trail, budget }: { list: GameFlowNode; bounds: GameFlowNode["frame"]; trail: string[]; budget: number }) {
  const cells = useContext(ListCells), resources = useSliceResources();
  try {
    const ref = list.cellPrefab!, key = cellKey(ref);
    if (trail.includes(key)) throw new Error("列表项模板循环引用。");
    const page = cells.resolve(ref);
    const positions = listCellPositions(list, bounds, page);
    const { left, top, width, height, rows, columns } = positions;
    const count = rows * columns;
    if (!count || !page.nodes.length) return null;
    const itemBudget = Math.floor(budget / (count * page.nodes.length));
    if (!itemBudget) throw new Error("列表项预览超过节点数量上限。");
    const scoped = resources.forPage?.(page) ?? resources;
    const geometry = resolvePageLayout(page, scoped.sizes), nodes = orderedNodes(page);
    const nextTrail = [...trail, key];
    return <SliceResourcesProvider value={{...scoped,mode:resources.mode,forPage:resources.forPage, ...(resources.mode === "prefab" ? {resolve:resources.resolve} : {})}}><div aria-hidden="true" style={{position:"absolute", left, top, width, height, pointerEvents:"none", overflow:listScrollType(list) === 0 ? "visible" : "hidden"}}>
      {Array.from({length:count}, (_, index) => {
        const { x, y } = listCellOffset(positions, index);
        return <div key={index} data-cell-index={index} style={{position:"absolute", left:x, top:y, width:page.frame.width, height:page.frame.height}}>
          {nodes.map(node => <NodeView key={node.id} page={page} node={node} hitId={list.id} geometry={geometry.nodes.get(node.id)} cellTrail={nextTrail} previewBudget={itemBudget}/>)}
        </div>;
      })}
    </div></SliceResourcesProvider>;
  } catch (error) {
    return <span className="reference-error-label" role="status">{error instanceof Error ? error.message : String(error)}</span>;
  }
}
