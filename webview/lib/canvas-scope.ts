import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { inheritedFlag, insertNode, makeComponent, type InsertType } from "../../shared/editor-ops";
import { canHaveChildren } from "../../shared/ui-components";
import { resolvePageLayout } from "../../shared/ui-layout";
import { inverse, mapPoint, multiply, translation, type Point } from "../../shared/ui-transform";

/** Containers from the page root through the current editing scope. */
export function canvasScopePath(page: GameFlowPage, scopeId: string | null): GameFlowNode[] {
  const path: GameFlowNode[] = [], visited = new Set<string>();
  let id = scopeId;
  while (id) {
    const node = page.nodes.find(item => item.id === id);
    if (!node || !canHaveChildren(node) || visited.has(id)) return [];
    visited.add(id); path.unshift(node); id = node.parentId ?? null;
  }
  return path;
}

/** Normally select the scope's direct child; direct mode keeps the actual visible hit. */
export function canvasHitNode(page: GameFlowPage, scopeId: string | null, hitId?: string, direct = false): GameFlowNode | null {
  const visited = new Set<string>();
  let node = page.nodes.find(item => item.id === hitId);
  if (direct) return node && !inheritedFlag(page, node, "hidden") ? node : null;
  while (node && !visited.has(node.id)) {
    if (node.id === scopeId) return null;
    if ((node.parentId ?? null) === scopeId) return node;
    visited.add(node.id);
    const parentId: string | undefined = node.parentId;
    node = page.nodes.find(item => item.id === parentId);
  }
  return null;
}

/** Right-click follows normal hit testing, preserving an already selected group member. */
export function canvasContextTarget(page: GameFlowPage, scopeId: string | null, hitId: string | undefined, selectedIds: string[], direct = false) {
  const member = selectedIds.length > 1 && selectedIds.includes(hitId ?? "") ? page.nodes.find(node => node.id === hitId && !inheritedFlag(page, node, "hidden")) : undefined;
  const node = member ?? canvasHitNode(page, scopeId, hitId, direct);
  const root = page.nodes.find(node => node.id === page.componentRootId);
  return { id: node?.id ?? null, backgroundParentId: scopeId ?? root?.id };
}

/** Follow a reparented selection, or retreat to a surviving scope after deletion/undo. */
export function reconcileCanvasScope(page: GameFlowPage, previousPath: string[], selectedId: string | null) {
  const selected = page.nodes.find(node => node.id === selectedId);
  if (selected) return { path: canvasScopePath(page, selected.parentId ?? null), selectedId: selected.id };
  for (const id of [...previousPath].reverse()) {
    const path = canvasScopePath(page, id);
    if (path.length) return { path, selectedId: null };
  }
  return { path: [] as GameFlowNode[], selectedId: null };
}

export function canvasPasteTarget(page: GameFlowPage, scopeId: string | null, selectedId: string | null): { parentId?: string; afterId?: string } {
  const selected = page.nodes.find(node => node.id === selectedId);
  if (!selected) return { parentId: scopeId ?? undefined };
  return canHaveChildren(selected) ? { parentId: selected.id } : { parentId: selected.parentId, afterId: selected.id };
}

/** Insert immediately at the center of the current layer, offsetting repeated additions. */
export function insertCanvasComponent(page: GameFlowPage, parentId: string | undefined, type: InsertType, id: string, makeId: () => string, afterId?: string): { page: GameFlowPage; id: string | null } {
  if (!parentId && page.nodes.some(node => node.id === page.componentRootId)) parentId = page.componentRootId;
  const parent = page.nodes.find(node => node.id === parentId);
  if (parentId && (!parent || !canHaveChildren(parent) || inheritedFlag(page,parent,"locked"))) return {page,id:null};
  const bounds = parent ? resolvePageLayout(page).nodes.get(parent.id)?.local : page.frame;
  if (!bounds) return {page,id:null};
  const offset = page.nodes.filter(node => node.parentId === parentId).length % 4 * 12;
  const nodes = makeComponent(type,id,bounds.width / 2 + offset,bounds.height / 2 + offset,makeId);
  const inserted = insertNode(page,nodes[0],parentId,afterId);
  return inserted === page ? {page,id:null} : {page:{...inserted,nodes:[...inserted.nodes,...nodes.slice(1)]},id};
}

/** Convert page-space placement into the scope's child coordinates, including scrolling. */
export function canvasPlacementPoint(page: GameFlowPage, scopeId: string | null, point: Point): Point | null {
  if (!scopeId) return point;
  const parent = page.nodes.find(node => node.id === scopeId);
  if (!parent || !canHaveChildren(parent) || inheritedFlag(page, parent, "locked")) return null;
  const geometry = resolvePageLayout(page).nodes.get(parent.id)!;
  const matrix = multiply(geometry.matrix, translation(-(parent.layout?.scrollX ?? 0), -(parent.layout?.scrollY ?? 0)));
  const inv = inverse(matrix);
  return inv ? mapPoint(inv, point) : null;
}

export function placeCanvasComponent(page: GameFlowPage, scopeId: string | null, type: InsertType, point: Point, makeId: () => string, afterId?: string): { page: GameFlowPage; id: string | null } {
  if (!scopeId && page.nodes.some(node => node.id === page.componentRootId)) scopeId = page.componentRootId!;
  const local = canvasPlacementPoint(page, scopeId, point);
  if (!local) return { page, id: null };
  const nodes = makeComponent(type, makeId(), local.x, local.y, makeId);
  const inserted = insertNode(page, nodes[0], scopeId ?? undefined, afterId);
  if (inserted === page) return { page, id: null };
  return { page: { ...inserted, nodes: [...inserted.nodes, ...nodes.slice(1)] }, id: nodes[0].id };
}
