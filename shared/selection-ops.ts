import type { GameFlowNode, GameFlowPage } from "./model";
import { descendants, inheritedFlag, moveNode, orderedNodes, type LayerDrop } from "./editor-ops";
import { editNodeFrame, nodeDragFrame } from "./ui-edit";
import { resolvePageLayout } from "./ui-layout";
import { controlSelected, reconcileControlReferences, remapControlReferences, sliderOwner } from "./ui-parts";
import { allocateVariableName } from "./node-variable";
import { copyNode, type NodeClipboard } from "./node-clipboard";
import { decomposeNode, IDENTITY, inverse, multiply, translation } from "./ui-transform";
import { canHaveChildren, flowType } from "./ui-components";

export function selectionRoots(page: GameFlowPage, ids: string[]): GameFlowNode[] {
  const selected = new Set(ids), byId = new Map(page.nodes.map(node => [node.id, node]));
  return orderedNodes(page).filter(node => {
    if (!selected.has(node.id)) return false;
    let parentId = node.parentId;
    while (parentId) { if (selected.has(parentId)) return false; parentId = byId.get(parentId)?.parentId; }
    return true;
  });
}

export function commonSelectionParent(page: GameFlowPage, ids: string[]): string | null {
  const paths = page.nodes.filter(node => ids.includes(node.id)).map(node => {
    const path: string[] = []; let parentId = node.parentId;
    while (parentId) { path.unshift(parentId); parentId = page.nodes.find(item => item.id === parentId)?.parentId; }
    return path;
  });
  let common: string | null = null;
  for (const [i, id] of (paths[0] ?? []).entries()) { if (!paths.every(path => path[i] === id)) break; common = id; }
  return common;
}

export function removeSelection(page: GameFlowPage, ids: string[]): GameFlowPage {
  const roots = selectionRoots(page, ids);
  if (!roots.length || roots.some(node => inheritedFlag(page, node, "locked"))) return page;
  const removed = new Set(roots.flatMap(node => [...descendants(page, node.id)]));
  return reconcileControlReferences(page, { ...page, nodes: page.nodes.filter(node => !removed.has(node.id)) });
}

/** Every root consumes the same page-space displacement; selected descendants move only once. */
export function translateSelection(page: GameFlowPage, ids: string[], dx: number, dy: number, intent: "move" | "nudge" = "move"): GameFlowPage {
  const roots = selectionRoots(page, ids), geometry = resolvePageLayout(page);
  if (!roots.length || roots.some(node => inheritedFlag(page, node, "locked") || sliderOwner(page, node) || !inverse(geometry.nodes.get(node.id)!.parentMatrix))) return page;
  const groups = new Map<string | undefined, GameFlowNode[]>();
  for (const node of roots) groups.set(node.parentId, [...(groups.get(node.parentId) ?? []), node]);
  const ordered = [...groups.values()].flatMap(group => {
    const parent = page.nodes.find(node => node.id === group[0].parentId), flow = flowType(parent);
    if (flow === "free") return group;
    const resolved = geometry.nodes.get(group[0].id)!, frame = nodeDragFrame(resolved.local, resolved.parentMatrix, dx, dy);
    const axis = flow === "vbox" || (flow === "grid" && parent?.layout?.direction === "vertical") ? "y" : "x";
    const delta = frame[axis] - resolved.local[axis] || (flow === "grid" ? frame[axis === "x" ? "y" : "x"] - resolved.local[axis === "x" ? "y" : "x"] : 0);
    return delta > 0 ? [...group].reverse() : group;
  });
  const frames = ordered.map(node => {
    const resolved = geometry.nodes.get(node.id)!;
    return { id: node.id, next: nodeDragFrame(resolved.local, resolved.parentMatrix, dx, dy) };
  });
  // Process each flow's leading edge first, using its own transformed layout direction.
  return frames.reduce((next, item) => {
    const node = next.nodes.find(node => node.id === item.id)!, parent = next.nodes.find(parent => parent.id === node.parentId), flow = flowType(parent);
    const current = resolvePageLayout(next).nodes.get(node.id)!;
    const frame = intent === "nudge" ? nodeDragFrame(current.local, current.parentMatrix, dx, dy) : item.next;
    if (intent === "nudge" && flow !== "free") {
      const axis = flow === "vbox" || (flow === "grid" && parent?.layout?.direction === "vertical") ? "y" : "x";
      const delta = frame[axis] - current.local[axis] || (flow === "grid" ? frame[axis === "x" ? "y" : "x"] - current.local[axis === "x" ? "y" : "x"] : 0);
      const siblings = next.nodes.filter(sibling => sibling.parentId === node.parentId), target = siblings[siblings.indexOf(node) + Math.sign(delta)];
      // A selected neighbor at the boundary must not swap places with its own group.
      if (target && ids.includes(target.id)) return next;
    }
    return editNodeFrame(next, item.id, frame, intent);
  }, page);
}

export function moveSelection(page: GameFlowPage, ids: string[], drop: LayerDrop): GameFlowPage {
  const roots = selectionRoots(page, ids), all = new Set(roots.flatMap(node => [...descendants(page, node.id)]));
  if (!roots.length || roots.some(node => inheritedFlag(page, node, "locked")) || (drop.targetId && all.has(drop.targetId))) return page;
  const target = page.nodes.find(node => node.id === drop.targetId);
  if ((!target && (drop.targetId || drop.position !== "inside"))) return page;
  const parentId = drop.position === "inside" ? target?.id : target?.parentId;
  const parent = page.nodes.find(node => node.id === parentId);
  if (parent && (!canHaveChildren(parent) || !inverse(resolvePageLayout(page).nodes.get(parent.id)!.matrix) || inheritedFlag(page, parent, "locked"))) return page;
  // Validate all reparentings against the original snapshot, including locked reference owners.
  if (roots.some(node => node.parentId !== parentId && moveNode(page, node.id, drop) === page)) return page;
  const ordered = drop.position === "after" ? [...roots].reverse() : roots;
  return ordered.reduce((next, node) => moveNode(next, node.id, drop), page);
}

export function copySelection(page: GameFlowPage, ids: string[]): NodeClipboard | null {
  const roots = selectionRoots(page, ids);
  if (roots.length === 1) return copyNode(page, roots[0].id);
  if (!roots.length) return null;
  const rootIds = roots.map(node => node.id), selected = new Set(roots.flatMap(node => [...descendants(page, node.id)]));
  const nodes = structuredClone(orderedNodes(page).filter(node => selected.has(node.id))), geometry = resolvePageLayout(page);
  const parent = page.nodes.find(node => node.id === commonSelectionParent(page, rootIds));
  const parentMatrix = multiply(parent ? geometry.nodes.get(parent.id)!.matrix : IDENTITY, translation(-(parent?.layout?.scrollX ?? 0), -(parent?.layout?.scrollY ?? 0)));
  const inv = inverse(parentMatrix); if (!inv) return null;
  for (const node of nodes) {
    if (node.type === "radio") node.widget = { ...node.widget, selected: controlSelected(page, node) };
    if (rootIds.includes(node.id)) {
      const resolved = geometry.nodes.get(node.id)!;
      Object.assign(node, decomposeNode(multiply(inv, resolved.matrix), resolved.local, node.transform));
    }
  }
  return { rootId: rootIds[0], rootIds, nodes };
}

export function duplicateSelection(page: GameFlowPage, ids: string[], makeId: () => string): { page: GameFlowPage; ids: string[] } {
  const roots = selectionRoots(page, ids);
  if (!roots.length || roots.some(node => inheritedFlag(page, node, "locked"))) return { page, ids: [] };
  const rootIds = new Set(roots.map(node => node.id)), selected = new Set(roots.flatMap(node => [...descendants(page, node.id)]));
  const source = orderedNodes(page).filter(node => selected.has(node.id)), mapping = new Map(source.map(node => [node.id, makeId()]));
  const variables = new Set(page.nodes.flatMap(node => node.variableName ? [node.variableName] : []));
  const copies = source.map(original => {
    const node = structuredClone(original), root = rootIds.has(node.id);
    if (node.type === "radio") node.widget = { ...node.widget, selected: controlSelected(page, node) };
    if (node.variableName) node.variableName = allocateVariableName(node.variableName, variables);
    node.id = mapping.get(original.id)!;
    if (node.parentId) node.parentId = mapping.get(node.parentId) ?? node.parentId;
    if (root) { node.name += " 副本"; node.frame.x += 16; node.frame.y += 16; }
    return remapControlReferences(node, mapping);
  });
  return { page: { ...page, nodes: [...page.nodes, ...copies] }, ids: roots.map(node => mapping.get(node.id)!) };
}
