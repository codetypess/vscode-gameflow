import type { GameFlowNode, GameFlowPage } from "./model";
import { descendants, inheritedFlag, insertNode, orderedNodes } from "./editor-ops";
import { canHaveChildren } from "./ui-components";
import { CONSTRAINTS } from "./ui-config";
import { resolvePageLayout } from "./ui-layout";
import { allocateVariableName } from "./node-variable";
import { controlSelected, remapControlReferences } from "./ui-parts";

export interface NodeClipboard { rootId: string; rootIds?: string[]; nodes: GameFlowNode[] }

/** A session-local snapshot, independent of subsequent source edits or deletion. */
export function copyNode(page: GameFlowPage, id: string): NodeClipboard | null {
  const root = page.nodes.find((node) => node.id === id);
  if (!root) return null;
  const ids = descendants(page, id);
  const nodes = structuredClone(orderedNodes(page).filter((node) => ids.has(node.id)));
  for (const node of nodes) if (node.type === "radio") node.widget = { ...node.widget, selected: controlSelected(page, node) };
  nodes[0].frame = { ...resolvePageLayout(page).nodes.get(id)!.local };
  return { rootId: id, nodes };
}

export function pasteNode(page: GameFlowPage, clipboard: NodeClipboard, makeId: () => string, parentId?: string, afterId?: string): { page: GameFlowPage; id: string | null; ids?: string[] } {
  if (page.nodes.some(node => node.id === page.componentRootId)) parentId ??= page.componentRootId;
  if (afterId === page.componentRootId && parentId === page.componentRootId) afterId = undefined;
  const parent = page.nodes.find((node) => node.id === parentId);
  const anchor = page.nodes.find((node) => node.id === afterId);
  if ((parentId && (!parent || !canHaveChildren(parent) || inheritedFlag(page, parent, "locked"))) ||
    (afterId && (!anchor || anchor.parentId !== parentId))) return { page, id: null };
  const mapping = new Map(clipboard.nodes.map((node) => [node.id, makeId()]));
  const rootIds = clipboard.rootIds ?? [clipboard.rootId];
  const variableNames = new Set(page.nodes.flatMap((node) => node.variableName ? [node.variableName] : []));
  const copies = structuredClone(clipboard.nodes).map((node) => {
    const root = rootIds.includes(node.id);
    const next = { ...node, id: mapping.get(node.id)! };
    if (node.variableName) next.variableName = allocateVariableName(node.variableName, variableNames);
    if (root) {
      next.frame = { ...node.frame, x: node.frame.x + 16, y: node.frame.y + 16, width: Math.max(1, node.frame.width), height: Math.max(1, node.frame.height) };
      next.layout = { ...node.layout, ...Object.fromEntries(CONSTRAINTS.map((key) => [key, null])), widthMode: "explicit", heightMode: "explicit" };
      delete next.layout.crossAxisMode;
      delete next.layout.positionOffsetX; delete next.layout.positionOffsetY;
      if (parentId) next.parentId = parentId; else delete next.parentId;
    } else next.parentId = mapping.get(node.parentId!)!;
    return remapControlReferences(next, mapping);
  });
  const ids = rootIds.map(id => mapping.get(id)!);
  let inserted = page, anchorId = afterId;
  for (const id of ids) { const root = copies.find(node => node.id === id)!; inserted = insertNode(inserted, root, parentId, anchorId); anchorId = id; }
  return { page: { ...inserted, nodes: [...inserted.nodes, ...copies.filter(node => !ids.includes(node.id))] }, id: ids[0], ids };
}
