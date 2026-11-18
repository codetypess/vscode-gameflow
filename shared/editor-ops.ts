import { ownedCanvasNodes, remapCanvasEdits } from "./canvas-instance-data";
import type { Frame, GameFlowDocument, GameFlowNode, GameFlowPage, NodeStyle, NodeType } from "./model";
import { canHaveChildren, COMPONENTS } from "./ui-components";
import { resolvePageLayout, type ResourceSizes } from "./ui-layout";
import { CONSTRAINTS } from "./ui-config";
import { allocateVariableName } from "./node-variable";
import { decomposeNode, IDENTITY, inverse, mapPoint, multiply, nodeMatrix, translation } from "./ui-transform";
import { controlHidden, controlSelected, hasNodeSkin, reconcileControlReferences, remapControlReferences, supportsNodeSkin } from "./ui-parts";

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

export function absoluteFrame(page: GameFlowPage, node: GameFlowNode, resourceSizes?: ResourceSizes): Frame {
  return resolvePageLayout(page, resourceSizes).nodes.get(node.id)?.absolute ?? node.frame;
}

export function inheritedFlag(page: GameFlowPage, node: GameFlowNode, key: "hidden" | "locked"): boolean {
  if (key === "hidden") return controlHidden(page, node);
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

export function reparentNode(page: GameFlowPage, id: string, parentId?: string, resourceSizes?: ResourceSizes): GameFlowPage {
  if (page.componentRootId === id && parentId !== undefined) return page;
  if (id !== page.componentRootId && page.nodes.some(node => node.id === page.componentRootId)) parentId ??= page.componentRootId;
  const node = page.nodes.find((item) => item.id === id);
  if (!node || node.parentId === parentId || inheritedFlag(page, node, "locked") || (parentId && descendants(page, id).has(parentId))) return page;
  const parent = page.nodes.find((item) => item.id === parentId);
  if (parentId && (!parent || !canHaveChildren(parent) || inheritedFlag(page, parent, "locked"))) return page;
  const geometry = resolvePageLayout(page, resourceSizes), resolved = geometry.nodes.get(id)!;
  const parentMatrix = multiply(parent ? geometry.nodes.get(parent.id)!.matrix : IDENTITY, translation(-(parent?.layout?.scrollX ?? 0), -(parent?.layout?.scrollY ?? 0)));
  const parentInverse = inverse(parentMatrix); if (!parentInverse) return page;
  const relative = multiply(parentInverse, resolved.matrix);
  const localMatrix = nodeMatrix(resolved.local, node.transform);
  const sameLinear = relative.slice(0, 4).every((v, i) => Math.abs(v-localMatrix[i]) < 1e-10);
  const pivot = mapPoint(relative, { x: (node.transform?.anchorX ?? 0)*resolved.local.width, y: (node.transform?.anchorY ?? 0)*resolved.local.height });
  const pose = sameLinear ? { frame: { ...resolved.local, x: pivot.x, y: pivot.y } } : decomposeNode(relative, resolved.local, node.transform);
  return reconcileControlReferences(page, {
    ...page,
    nodes: page.nodes.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...pose, frame: { ...pose.frame, width: Math.max(1, pose.frame.width), height: Math.max(1, pose.frame.height) } };
      if (item.layout) next.layout = { ...item.layout, ...Object.fromEntries(CONSTRAINTS.map((key) => [key, null])), widthMode: "explicit", heightMode: "explicit" };
      if (next.layout) { delete next.layout.crossAxisMode; delete next.layout.positionOffsetX; delete next.layout.positionOffsetY; }
      if (parentId) next.parentId = parentId;
      else delete next.parentId;
      return next;
    })
  });
}

export function removeNode(page: GameFlowPage, id: string): GameFlowPage {
  const ids = descendants(page, id);
  return reconcileControlReferences(page, { ...page, nodes: page.nodes.filter((node) => !ids.has(node.id)) });
}

export interface LayerDrop {
  targetId?: string;
  position: "before" | "inside" | "after";
}

/** Inserts a fresh node into a valid unlocked parent, in parent-local coordinates. */
export function insertNode(page: GameFlowPage, node: GameFlowNode, parentId?: string, afterId?: string): GameFlowPage {
  if (page.nodes.some(item => item.id === page.componentRootId)) parentId ??= page.componentRootId;
  if (afterId === page.componentRootId && parentId === page.componentRootId) afterId = undefined;
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
export function moveNode(page: GameFlowPage, id: string, drop: LayerDrop, resourceSizes?: ResourceSizes): GameFlowPage {
  if (page.componentRootId === id) return page;
  if (page.nodes.some(node => node.id === page.componentRootId) && (!drop.targetId || drop.targetId === page.componentRootId)) drop = { targetId: page.componentRootId, position: "inside" };
  const node = page.nodes.find((item) => item.id === id);
  const target = page.nodes.find((item) => item.id === drop.targetId);
  const moving = descendants(page, id);
  if (!node || inheritedFlag(page, node, "locked") || (drop.targetId && (!target || moving.has(drop.targetId)))) return page;
  if (!target && drop.position !== "inside") return page;
  const parentId = drop.position === "inside" ? target?.id : target?.parentId;
  const parent = page.nodes.find((item) => item.id === parentId);
  if (parentId && (!parent || !canHaveChildren(parent) || inheritedFlag(page, parent, "locked"))) return page;
  const reparented = node.parentId === parentId ? page : reparentNode(page, id, parentId, resourceSizes);
  if (node.parentId !== parentId && reparented === page) return page;
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
  const mapping = new Map(ownedCanvasNodes(page.nodes.filter(node=>ids.has(node.id))).map(node=>[node.id, makeId()]));
  const variableNames = new Set(page.nodes.flatMap((node) => node.variableName ? [node.variableName] : []));
  const copies = page.nodes.filter((node) => ids.has(node.id)).map((node) => remapControlReferences({
    ...structuredClone(node),
    id: mapping.get(node.id)!,
    name: node.id === id ? `${node.name} 副本` : node.name,
    ...(node.variableName ? { variableName: allocateVariableName(node.variableName, variableNames) } : {}),
    frame: { ...node.frame, x: node.frame.x + (node.id === id ? 16 : 0), y: node.frame.y + (node.id === id ? 16 : 0) },
    ...(node.parentId ? { parentId: mapping.get(node.parentId) ?? node.parentId } : {}),
    ...(node.id === page.componentRootId ? { parentId: page.componentRootId } : {}),
    ...(node.style ? { style: { ...node.style } } : {}),
    ...(node.type === "radio" ? { widget: { ...node.widget, selected: controlSelected(page, node) } } : {})
  }, mapping)).map(node=>remapCanvasEdits(node,mapping));
  return { page: { ...page, nodes: [...page.nodes, ...copies] }, id: mapping.get(id)! };
}

export function duplicatePage(page: GameFlowPage, makeId: () => string): GameFlowPage {
  const mapping = new Map(ownedCanvasNodes(page.nodes).map((node) => [node.id, makeId()]));
  const pageId = makeId();
  return {
    ...page, id: pageId, name: `${page.name} 副本`,
    ...(page.componentRootId ? { componentRootId: mapping.get(page.componentRootId) ?? page.componentRootId } : {}),
    ...(page.layout ? { layout: { ...page.layout } } : {}),
    frame: { ...page.frame, x: page.frame.x + page.frame.width + 80 },
    nodes: page.nodes.map((node) => remapControlReferences({ ...structuredClone(node), id: mapping.get(node.id)!, frame: { ...node.frame },
      ...(node.parentId ? { parentId: mapping.get(node.parentId)! } : {}),
      ...(node.style ? { style: { ...node.style } } : {}) }, mapping)).map(node=>remapCanvasEdits(node,mapping,{pageId}))
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
    italic: false, underline: false, strikethrough: false,
    textAlign: type === "text" ? "left" : "center",
    opacity: 1
  };
}

export function makeNode(type: InsertType, id: string, x: number, y: number): GameFlowNode {
  const box = ["container", "hbox", "vbox", "grid", "panel", "list", "radioGroup"].includes(type);
  const width = box ? 240 : type === "button" ? 108 : type === "progress" || type === "slider" ? 200 : 140;
  const height = box ? 160 : ["text", "checkbox", "radio", "progress", "slider"].includes(type) ? 32 : ["button", "input", "combo"].includes(type) ? 40 : 90;
  return { id, type, name: NODE_LABELS[type], frame: { x: Math.round(x - width / 2), y: Math.round(y - height / 2), width, height },
    style: { ...defaultStyle(type), ...(["checkbox", "radio", "radioGroup", "slider"].includes(type) ? { fill: "transparent", borderWidth: 0 } : {}) },
    ...(type === "text" ? { text: "文本内容" } : {}),
    ...(box ? { layout: { gap: 8, gapX: 8, gapY: 8, wrapCount: type === "list" ? 3 : 2, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, clipContent: type === "panel" || type === "list" } } : {}),
    ...(type === "input" ? { widget: { placeholder: "请输入内容" } } : {}),
    ...(["progress", "slider"].includes(type) ? { widget: { min: 0, max: 100, value: 60 } } : {}),
    ...(type === "combo" ? { widget: { options: ["选项一", "选项二", "选项三"], selectedIndex: 0 } } : {}) };
}

/** Creates explicit editable parts. Buttons have no required children. */
export function makeComponent(type: InsertType, id: string, x: number, y: number, makeId: () => string): GameFlowNode[] {
  const root = makeNode(type, id, x, y), nodes = [root];
  if (supportsNodeSkin(root)) {
    const slider = type === "slider", radio = type === "radio";
    if (slider) root.frame.height = 64;
    const image = (name: string, frame: Frame, fill: string, radius: number): GameFlowNode => ({
      ...makeNode("image", makeId(), 0, 0), parentId: id, name, frame,
      style: { fill, borderWidth: 0, radius }
    });
    const track = image(slider ? "轨道" : "底框", { x: 0, y: slider ? 29 : 6, width: slider ? root.frame.width : 20, height: slider ? 6 : 20 }, "#cbd5e1", radio ? 10 : 3);
    track.layout = slider ? { left: 0, right: 0, centerY: 0 } : { left: 0, centerY: 0 };
    const skin = image(slider ? "滑块" : "选中标记", { x: slider ? 0 : 4, y: slider ? 0 : 10, width: slider ? 24 : 12, height: slider ? 24 : 12 }, "#3b82f6", slider ? 12 : radio ? 6 : 2);
    if (!slider) skin.layout = { left: 4, centerY: 0 };
    root.widget = { ...root.widget, skinNodeId: skin.id };
    nodes.push(track, skin, { ...makeNode("text", makeId(), 0, 0), parentId: id, name: "说明", text: NODE_LABELS[type],
      frame: { x: slider ? 0 : 28, y: slider ? 46 : 0, width: slider ? root.frame.width : root.frame.width - 28, height: slider ? 18 : 32 },
      layout: slider ? { left: 0, right: 0, bottom: 0 } : { left: 28, right: 0, centerY: 0 },
      widget: { valign: "middle" }, style: { ...defaultStyle("text"), fontSize: 14 } });
  }
  if (type === "radioGroup") {
    const members: string[] = [];
    root.layout = {};
    root.frame.width = 160; root.frame.height = 80;
    for (let i = 0; i < 2; i++) {
      const parts = makeComponent("radio", makeId(), 0, 0, makeId);
      parts[0].parentId = id; parts[0].name = `选项${i + 1}`; parts[0].frame.x = 0; parts[0].frame.y = i * 40;
      parts[3].text = parts[0].name;
      members.push(parts[0].id); nodes.push(...parts);
    }
    root.widget = { optionNodeIds: members, selectedIndex: -1 };
  }
  if (type === "list") for (let i = 0; i < 6; i++) nodes.push({ ...makeNode("panel", makeId(), 0, 0), parentId: id, name: `列表项 ${i + 1}`, frame: { x: 0, y: 0, width: 64, height: 60 } });
  return nodes;
}

/** Opt-in conversion preserves the control identity, existing children and design state. */
export function createControlParts(page: GameFlowPage, id: string, makeId: () => string): GameFlowPage {
  const original = page.nodes.find(node => node.id === id);
  if (!original || !supportsNodeSkin(original) || hasNodeSkin(original) || inheritedFlag(page, original, "locked")) return page;
  const [template, ...parts] = makeComponent(original.type, id, 0, 0, makeId);
  const root = { ...original, widget: { ...original.widget, skinNodeId: template.widget!.skinNodeId } };
  delete root.text;
  const label = parts.find(node => node.type === "text")!;
  label.text = original.text ?? original.name;
  return { ...page, nodes: [...page.nodes.map(node => node.id === id ? root : node), ...parts] };
}
