import type { GameFlowNode, GameFlowPage } from "./model";
import { descendants, inheritedFlag, insertNode, orderedNodes } from "./editor-ops";
import { canHaveChildren } from "./ui-components";
import { CONSTRAINTS } from "./ui-config";
import { resolvePageLayout } from "./ui-layout";
import { allocateVariableName } from "./node-variable";

export interface NodeClipboard { rootId: string; nodes: GameFlowNode[] }

/** A session-local snapshot, independent of subsequent source edits or deletion. */
export function copyNode(page: GameFlowPage, id: string): NodeClipboard | null {
  const root = page.nodes.find((node) => node.id === id);
  if (!root) return null;
  const ids = descendants(page, id);
  const nodes = structuredClone(orderedNodes(page).filter((node) => ids.has(node.id)));
  nodes[0].frame = { ...resolvePageLayout(page).nodes.get(id)!.local };
  return { rootId: id, nodes };
}

export function pasteNode(page: GameFlowPage, clipboard: NodeClipboard, makeId: () => string, parentId?: string, afterId?: string): { page: GameFlowPage; id: string | null } {
  const parent = page.nodes.find((node) => node.id === parentId);
  const anchor = page.nodes.find((node) => node.id === afterId);
  if ((parentId && (!parent || !canHaveChildren(parent) || inheritedFlag(page, parent, "locked"))) ||
    (afterId && (!anchor || anchor.parentId !== parentId))) return { page, id: null };
  const mapping = new Map(clipboard.nodes.map((node) => [node.id, makeId()]));
  const variableNames = new Set(page.nodes.flatMap((node) => node.variableName ? [node.variableName] : []));
  const copies = structuredClone(clipboard.nodes).map((node) => {
    const root = node.id === clipboard.rootId;
    const next = { ...node, id: mapping.get(node.id)! };
    if (node.variableName) next.variableName = allocateVariableName(node.variableName, variableNames);
    if (root) {
      next.frame = { ...node.frame, x: node.frame.x + 16, y: node.frame.y + 16, width: Math.max(1, node.frame.width), height: Math.max(1, node.frame.height) };
      next.layout = { ...node.layout, ...Object.fromEntries(CONSTRAINTS.map((key) => [key, null])), widthMode: "explicit", heightMode: "explicit" };
      delete next.layout.crossAxisMode;
      if (parentId) next.parentId = parentId; else delete next.parentId;
    } else next.parentId = mapping.get(node.parentId!)!;
    return next;
  });
  const root = copies.find((node) => node.id === mapping.get(clipboard.rootId))!;
  const inserted = insertNode(page, root, parentId, afterId);
  return { page: { ...inserted, nodes: [...inserted.nodes, ...copies.filter((node) => node !== root)] }, id: root.id };
}
