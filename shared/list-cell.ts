import { findCanvasTarget, type CanvasSources } from "./canvas-references";
import { composeCanvasPage } from "./canvas-instances";
import type { CanvasReference, Frame, GameFlowDocument, GameFlowNode, GameFlowPage } from "./model";

export type CellReference = NonNullable<GameFlowNode["cellPrefab"]>;
export const cellKey = (ref: CellReference) => "uuid" in ref ? ref.uuid : JSON.stringify([ref.source, ref.documentId, ref.pageId]);

export function resolveCellPage(document: GameFlowDocument, sources: CanvasSources, ref: CanvasReference) {
  const target = findCanvasTarget(document, sources, ref);
  if (!target.page || target.error) throw new Error(target.error ?? "找不到列表项画板。");
  if (target.page.rootType !== "UIBox") throw new Error("列表项模板需要 UIBox 画板。");
  if (Object.entries(target.page.layout ?? {}).some(([key,value])=>key !== "layoutUnit" && value != null)) throw new Error("列表项画板根节点需要清除相对约束。");
  const sourceDocument = target.key ? sources[target.key].document! : document;
  const composed = composeCanvasPage(document, target.page, sources, target.key);
  if (composed.errors.size) throw new Error([...composed.errors.values()].join("；"));
  return { document: sourceDocument, page:composed.page };
}

/** The IDE repeats complete lines while the start of the line lies inside the content viewport. */
export function listCellPositions(list: GameFlowNode, bounds: Frame, template: GameFlowPage) {
  const layout = list.layout ?? {};
  const left = layout.paddingLeft ?? 0, top = layout.paddingTop ?? 0;
  const width = bounds.width - left - (layout.paddingRight ?? 0);
  const height = bounds.height - top - (layout.paddingBottom ?? 0);
  const horizontal = listScrollType(list) === 1;
  const dx = template.frame.width + (layout.gapX ?? 0), dy = template.frame.height + (layout.gapY ?? 0);
  if (template.frame.width <= 0 || template.frame.height <= 0 || !Number.isFinite(dx) || !Number.isFinite(dy) || dx <= 0 || dy <= 0) throw new Error("列表项尺寸和含间距的步长必须为正数。");
  const lines = width > 0 && height > 0 ? Math.ceil(horizontal ? width / dx : height / dy) : 0;
  const wrap = layout.wrapCount ?? 1;
  return { left, top, width, height, columns: horizontal ? lines : wrap, rows: horizontal ? wrap : lines, dx, dy, horizontal };
}

export function listScrollType(list: GameFlowNode) {
  return list.layout?.scrollType ?? (list.layout?.direction === "vertical" ? 1 : 2);
}
