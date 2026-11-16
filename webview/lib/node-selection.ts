import type { GameFlowPage } from "../../shared/model";
import { orderedNodes } from "../../shared/editor-ops";

export interface NodeSelection { ids: string[]; primaryId: string | null; anchorId: string | null }
export interface SelectionIntent { toggle?: boolean; range?: boolean; order?: string[]; preserve?: boolean }
export const singleSelection = (id: string | null): NodeSelection => ({ ids: id ? [id] : [], primaryId: id, anchorId: id });

export function pickSelection(current: NodeSelection, id: string, intent: SelectionIntent = {}): NodeSelection {
  if (intent.preserve && current.ids.includes(id)) return current;
  const order = intent.order ?? [], anchor = current.anchorId ?? current.primaryId;
  const from = anchor ? order.indexOf(anchor) : -1, to = order.indexOf(id);
  if (intent.range && from >= 0 && to >= 0) {
    const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    return { ids: intent.toggle ? [...new Set([...current.ids, ...range])] : range, primaryId: id, anchorId: anchor };
  }
  if (intent.range) return singleSelection(id);
  if (intent.toggle) {
    const ids = current.ids.includes(id) ? current.ids.filter(value => value !== id) : [...current.ids, id];
    return { ids, primaryId: ids.includes(id) ? id : ids.at(-1) ?? null, anchorId: id };
  }
  return singleSelection(id);
}

export function reconcileSelection(page: GameFlowPage, current: NodeSelection): NodeSelection {
  const available = new Set(page.nodes.map(node => node.id)), ids = [...new Set(current.ids)].filter(id => available.has(id));
  return { ids, primaryId: current.primaryId && ids.includes(current.primaryId) ? current.primaryId : ids.at(-1) ?? null,
    anchorId: current.anchorId && available.has(current.anchorId) ? current.anchorId : ids.at(-1) ?? null };
}

/** Range selection follows only rows actually rendered after filtering and folding. */
export function visibleLayerOrder(page: GameFlowPage, visible: Set<string>, collapsed: Set<string>): string[] {
  const blocked = new Set<string>();
  return orderedNodes(page).filter(node => {
    if (node.parentId && (blocked.has(node.parentId) || collapsed.has(node.parentId))) { blocked.add(node.id); return false; }
    return visible.has(node.id);
  }).map(node => node.id);
}
