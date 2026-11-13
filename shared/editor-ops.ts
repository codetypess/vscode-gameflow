import type { Frame, GameFlowDocument, GameFlowNode, GameFlowPage, NodeStyle, NodeType } from "./model";
import { canHaveChildren, COMPONENTS } from "./ui-components";
import { resolvePageLayout } from "./ui-layout";
import { CONSTRAINTS } from "./ui-config";

export type InsertType = NodeType;
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export const NODE_LABELS: Record<string, string> = Object.fromEntries(Object.entries(COMPONENTS).map(([key, value]) => [key, value.label]));

export function orderedNodes(page: GameFlowPage): GameFlowNode[] {
  const result: GameFlowNode[] = [];
  const children = new Map<string | undefined, GameFlowNode[]>();
  for (const node of page.nodes) {
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node); children.set(node.parentId, siblings);
  }
  const visit = (parentId?: string) => { for (const node of children.get(parentId) ?? []) { result.push(node); visit(node.id); } };
  visit();
  return result;
}

export function descendants(page: GameFlowPage, id: string): Set<string> {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of page.nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function absoluteFrame(page: GameFlowPage, node: GameFlowNode): Frame {
  return resolvePageLayout(page).nodes.get(node.id)?.absolute ?? node.frame;
}

export function inheritedFlag(page: GameFlowPage, node: GameFlowNode, key: "hidden" | "locked"): boolean {
  let current: GameFlowNode | undefined = node;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current[key]) return true;
    visited.add(current.id);
    const parentId: string | undefined = current.parentId;
    current = page.nodes.find((item) => item.id === parentId);
  }
  return false;
}

export function reparentNode(page: GameFlowPage, id: string, parentId?: string): GameFlowPage {
  const node = page.nodes.find((item) => item.id === id);
  if (!node || node.parentId === parentId || inheritedFlag(page, node, "locked") || (parentId && descendants(page, id).has(parentId))) return page;
  const parent = page.nodes.find((item) => item.id === parentId);
  if (parentId && (!parent || !canHaveChildren(parent) || inheritedFlag(page, parent, "locked"))) return page;
  const absolute = absoluteFrame(page, node);
  const origin = parent ? absoluteFrame(page, parent) : { x: 0, y: 0 };
  return {
    ...page,
    nodes: page.nodes.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, frame: { ...absolute, width: Math.max(1, absolute.width), height: Math.max(1, absolute.height), x: absolute.x - origin.x + (parent?.layout?.scrollX ?? 0), y: absolute.y - origin.y + (parent?.layout?.scrollY ?? 0) } };
      if (item.layout) next.layout = { ...item.layout, ...Object.fromEntries(CONSTRAINTS.map((key) => [key, null])), widthMode: "explicit", heightMode: "explicit" };
      if (parentId) next.parentId = parentId;
      else delete next.parentId;
      return next;
    })
  };
}

export function removeNode(page: GameFlowPage, id: string): GameFlowPage {
  const ids = descendants(page, id);
  return { ...page, nodes: page.nodes.filter((node) => !ids.has(node.id)) };
}

export interface LayerDrop {
  targetId?: string;
  position: "before" | "inside" | "after";
}

/** Inserts a fresh node into a valid unlocked parent, in parent-local coordinates. */
export function insertNode(page: GameFlowPage, node: GameFlowNode, parentId?: string, afterId?: string): GameFlowPage {
  if (page.nodes.some((item) => item.id === node.id)) return page;
  const parent = page.nodes.find((item) => item.id === parentId);
  if (parentId && (!parent || !canHaveChildren(parent) || inheritedFlag(page, parent, "locked"))) return page;
  const next = { ...node, frame: { ...node.frame } };
  if (parentId) next.parentId = parentId; else delete next.parentId;
  const anchor = page.nodes.find((item) => item.id === afterId);
  if (afterId && (!anchor || anchor.parentId !== parentId)) return page;
  const following = anchor ? descendants(page, anchor.id) : null;
  const nodes = orderedNodes(page);
  const index = following ? Math.max(...nodes.map((item, i) => following.has(item.id) ? i : -1)) + 1 : nodes.length;
  nodes.splice(index, 0, next);
  return { ...page, nodes };
}

/** Moves a whole subtree, preserving page-space positions when its parent changes. */
export function moveNode(page: GameFlowPage, id: string, drop: LayerDrop): GameFlowPage {
  const node = page.nodes.find((item) => item.id === id);
  const target = page.nodes.find((item) => item.id === drop.targetId);
  const moving = descendants(page, id);
  if (!node || inheritedFlag(page, node, "locked") || (drop.targetId && (!target || moving.has(drop.targetId)))) return page;
  if (!target && drop.position !== "inside") return page;
  const parentId = drop.position === "inside" ? target?.id : target?.parentId;
  const parent = page.nodes.find((item) => item.id === parentId);
  if (parentId && (!parent || !canHaveChildren(parent) || inheritedFlag(page, parent, "locked"))) return page;
  const reparented = node.parentId === parentId ? page : reparentNode(page, id, parentId);
  const ordered = orderedNodes(reparented);
  const subtree = ordered.filter((item) => moving.has(item.id));
  const nodes = ordered.filter((item) => !moving.has(item.id));
  let index = nodes.length;
  if (target && drop.position === "before") index = nodes.findIndex((item) => item.id === target.id);
  if (target && drop.position === "after") {
    const targetTree = descendants(page, target.id);
    index = Math.max(...nodes.map((item, i) => targetTree.has(item.id) ? i : -1)) + 1;
  }
  nodes.splice(index, 0, ...subtree);
  // Arrays may be interleaved on disk; only sibling order and parent membership affect rendering.
  const sameOrder = [undefined, ...page.nodes.map((item) => item.id)].every((parent) => {
    const before = page.nodes.filter((item) => item.parentId === parent).map((item) => item.id);
    const after = nodes.filter((item) => item.parentId === parent).map((item) => item.id);
    return before.length === after.length && before.every((key, i) => key === after[i]);
  });
  return sameOrder ? page : { ...page, nodes };
}

export function duplicateNode(page: GameFlowPage, id: string, makeId: () => string): { page: GameFlowPage; id: string } {
  const ids = descendants(page, id);
  const mapping = new Map([...ids].map((key) => [key, makeId()]));
  const copies = page.nodes.filter((node) => ids.has(node.id)).map((node) => ({
    ...structuredClone(node),
    id: mapping.get(node.id)!,
    name: node.id === id ? `${node.name} 副本` : node.name,
    frame: { ...node.frame, x: node.frame.x + (node.id === id ? 16 : 0), y: node.frame.y + (node.id === id ? 16 : 0) },
    ...(node.parentId ? { parentId: mapping.get(node.parentId) ?? node.parentId } : {}),
    ...(node.style ? { style: { ...node.style } } : {})
  }));
  return { page: { ...page, nodes: [...page.nodes, ...copies] }, id: mapping.get(id)! };
}

export function duplicatePage(page: GameFlowPage, makeId: () => string): GameFlowPage {
  const mapping = new Map(page.nodes.map((node) => [node.id, makeId()]));
  return {
    ...page, id: makeId(), name: `${page.name} 副本`,
    frame: { ...page.frame, x: page.frame.x + page.frame.width + 80 },
    nodes: page.nodes.map((node) => ({ ...structuredClone(node), id: mapping.get(node.id)!, frame: { ...node.frame },
      ...(node.parentId ? { parentId: mapping.get(node.parentId)! } : {}),
      ...(node.style ? { style: { ...node.style } } : {}) }))
  };
}

export function removePage(document: GameFlowDocument, id: string): GameFlowDocument {
  return { ...document, pages: document.pages.filter((page) => page.id !== id),
    interactions: document.interactions.filter((edge) => edge.fromPageId !== id && edge.toPageId !== id) };
}

export function resizeFrame(frame: Frame, handle: Handle, dx: number, dy: number): Frame {
  let { x, y, width, height } = frame;
  if (handle.includes("e")) width = Math.max(8, width + dx);
  if (handle.includes("s")) height = Math.max(8, height + dy);
  if (handle.includes("w")) { width = Math.max(8, width - dx); x = frame.x + frame.width - width; }
  if (handle.includes("n")) { height = Math.max(8, height - dy); y = frame.y + frame.height - height; }
  return { x, y, width, height };
}

export function defaultStyle(type: string): Required<NodeStyle> {
  return {
    fill: type === "button" ? "#3b82f6" : type === "text" ? "transparent" : type === "image" ? "#e2e8f0" : "#f1f5f9",
    color: type === "button" ? "#ffffff" : "#263244",
    borderColor: type === "button" ? "#3b82f6" : "#cbd5e1",
    borderWidth: type === "text" ? 0 : 1,
    radius: type === "button" ? 6 : 2,
    fontSize: type === "text" ? 16 : 14,
    fontWeight: type === "button" ? 600 : 400,
    textAlign: type === "text" ? "left" : "center",
    opacity: 1
  };
}

export function makeNode(type: InsertType, id: string, x: number, y: number): GameFlowNode {
  const box = ["container", "hbox", "vbox", "grid", "panel", "list"].includes(type);
  const width = box ? 240 : type === "button" ? 108 : type === "progress" || type === "slider" ? 200 : 140;
  const height = box ? 160 : ["text", "checkbox", "radio", "progress", "slider"].includes(type) ? 32 : ["button", "input", "combo"].includes(type) ? 40 : 90;
  return { id, type, name: NODE_LABELS[type], frame: { x: Math.round(x - width / 2), y: Math.round(y - height / 2), width, height },
    style: { ...defaultStyle(type), ...(["checkbox", "radio", "slider"].includes(type) ? { fill: "transparent", borderWidth: 0 } : {}) },
    ...(type === "text" ? { text: "文本内容" } : ["button", "checkbox", "radio"].includes(type) ? { text: NODE_LABELS[type] } : {}),
    ...(box ? { layout: { gap: 8, gapX: 8, gapY: 8, wrapCount: type === "list" ? 3 : 2, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, clipContent: type === "panel" || type === "list" } } : {}),
    ...(type === "input" ? { widget: { placeholder: "请输入内容" } } : {}),
    ...(["progress", "slider"].includes(type) ? { widget: { min: 0, max: 100, value: 60 } } : {}),
    ...(type === "combo" ? { widget: { options: ["选项一", "选项二", "选项三"], selectedIndex: 0 } } : {}) };
}

/** Buttons use a real label child; lists start with editable static cells. */
export function makeComponent(type: InsertType, id: string, x: number, y: number, makeId: () => string): GameFlowNode[] {
  const root = makeNode(type, id, x, y), nodes = [root];
  if (type === "button") {
    delete root.text;
    nodes.push({ ...makeNode("text", makeId(), 0, 0), parentId: id, name: "按钮文字", text: "按钮", frame: { x: 0, y: 0, width: 108, height: 32 },
      layout: { left: 0, right: 0, centerY: 0 }, style: { ...defaultStyle("text"), fontSize: 14, color: "#ffffff", textAlign: "center" } });
  }
  if (type === "list") for (let i = 0; i < 6; i++) nodes.push({ ...makeNode("rectangle", makeId(), 0, 0), parentId: id, name: `列表项 ${i + 1}`, frame: { x: 0, y: 0, width: 64, height: 60 } });
  return nodes;
}
