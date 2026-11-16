import type { Frame, GameFlowNode, GameFlowPage, NodeLayout, NodeType } from "./model";
import { AXES, constraintsFor, managedAxis, resolvePageLayout } from "./ui-layout";
import { inheritedFlag, makeNode, moveNode } from "./editor-ops";
import type { Constraint } from "./ui-config";
import { canHaveChildren, flowType } from "./ui-components";
import { reconcileControlReferences, sliderOwner } from "./ui-parts";
import { axisAnchor, axisScale, inverse, mapVector, nodeMatrix, type Matrix } from "./ui-transform";

/** Keep the intended resolved coordinates when constraint positioning rounds its base value. */
function compensatePosition(page: GameFlowPage, id: string, target: Partial<Pick<Frame, "x" | "y">>): GameFlowPage {
  if (!Object.keys(target).length) return page;
  const node = page.nodes.find(n => n.id === id)!, local = resolvePageLayout(page).nodes.get(id)!.local;
  const layout = { ...node.layout };
  let changed = false;
  for (const axis of ["x", "y"] as const) {
    if (target[axis] === undefined || Math.abs(target[axis]!-local[axis]) < 1e-10) continue;
    const key = AXES[axis].positionOffset, offset = (layout[key] ?? 0)+target[axis]!-local[axis];
    if (Math.abs(offset) < 1e-12) delete layout[key]; else layout[key] = offset;
    changed = true;
  }
  return changed ? { ...page, nodes: page.nodes.map(n => n.id === id ? { ...n, layout } : n) } : page;
}

/** Move the anchor inside the same visual rectangle, including layout-managed axes. */
export function setNodeAnchor(page: GameFlowPage, id: string, anchor: { anchorX?: number; anchorY?: number }): GameFlowPage {
  const node = page.nodes.find(n => n.id === id);
  if (!node || inheritedFlag(page, node, "locked") || Object.values(anchor).some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) return page;
  const transform = { ...node.transform, ...anchor };
  if (sliderOwner(page, node)) return { ...page, nodes: page.nodes.map(item => item.id === id ? { ...item, transform } : item) };
  if ((transform.anchorX ?? 0) === (node.transform?.anchorX ?? 0) && (transform.anchorY ?? 0) === (node.transform?.anchorY ?? 0)) return page;
  const geometry = resolvePageLayout(page), old = geometry.nodes.get(id)!;
  const delta = mapVector(nodeMatrix(old.local, node.transform), {
    x: ((transform.anchorX ?? 0)-(node.transform?.anchorX ?? 0))*old.local.width,
    y: ((transform.anchorY ?? 0)-(node.transform?.anchorY ?? 0))*old.local.height
  });
  const candidate = { ...node, transform }, next = { ...page, nodes: page.nodes.map(n => n.id === id ? candidate : n) };
  const resolved = resolvePageLayout(next).nodes.get(id)!;
  const parent = page.nodes.find(n => n.id === node.parentId), parentGeometry = parent ? geometry.nodes.get(parent.id)! : undefined;
  const frame = { ...node.frame }, layout = { ...node.layout };
  for (const axis of ["x", "y"] as const) {
    const a = AXES[axis], correction = old.local[axis]+delta[axis]-resolved.local[axis];
    if (Math.abs(correction) < 1e-12) continue;
    const free = !constraintsFor(axis).some(key => node.layout?.[key] != null) && !managedAxis(parent, axis) &&
      (flowType(parent) === "free" || node.layout?.crossAxisMode === "explicit") && parentGeometry?.[axis === "x" ? "widthSource" : "heightSource"] !== "measured";
    if (free) frame[axis] += correction;
    else {
      const offset = (layout[a.positionOffset] ?? 0)+correction;
      if (Math.abs(offset) < 1e-12) delete layout[a.positionOffset]; else layout[a.positionOffset] = offset;
    }
  }
  return { ...page, nodes: page.nodes.map(n => n.id === id ? { ...candidate, frame, ...(node.layout || Object.keys(layout).length ? { layout } : {}) } : n) };
}

/** Switch anchors without reverting to stale authored coordinates or changing the visible bounds. */
export function setNodeConstraint(page: GameFlowPage, id: string, key: Constraint, enabled: boolean): GameFlowPage {
  const node = page.nodes.find((item) => item.id === id);
  if (!node || inheritedFlag(page, node, "locked") || (node.layout?.[key] != null) === enabled) return page;
  if (enabled && sliderOwner(page, node)) return page;
  const axis = key === "left" || key === "centerX" || key === "right" ? "x" : "y";
  const parent = page.nodes.find((item) => item.id === node.parentId);
  if (managedAxis(parent, axis)) return page;
  const geometry = resolvePageLayout(page), local = geometry.nodes.get(id)!.local, a = AXES[axis];
  const parentFrame = parent ? geometry.nodes.get(parent.id)!.local : page.frame;
  const start = parent?.layout?.[a.padStart] ?? 0;
  const available = parentFrame[a.size] - start - (parent?.layout?.[a.padEnd] ?? 0);
  const unit = node.layout?.layoutUnit === "percent" ? available / 100 : 1;
  if (enabled && unit <= 0) return page;
  const layout = { ...node.layout, [key]: enabled ? 0 : null };
  if (flowType(parent) !== "free") {
    if (enabled) delete layout.crossAxisMode;
    else if (!constraintsFor(axis).some((constraint) => layout[constraint] != null)) layout.crossAxisMode = "explicit";
  }
  const frame = { ...node.frame, [axis]: local[axis]-(layout[a.positionOffset] ?? 0), [a.size]: local[a.size] };
  const wasStretch = node.layout?.[a.leading] != null && node.layout?.[a.trailing] != null;
  if (wasStretch && (layout[a.leading] == null || layout[a.trailing] == null)) layout[a.mode] = "explicit";
  if (unit > 0) {
    const length = local[a.size] * axisScale(node.transform, axis), position = local[axis] - (layout[a.positionOffset] ?? 0) - axisAnchor(node.transform, axis) * length;
    if (layout[a.leading] != null) layout[a.leading] = (position - start) / unit;
    if (layout[a.trailing] != null) layout[a.trailing] = (start + available - position - length) / unit;
    if (layout[a.center] != null) layout[a.center] = (position - start - (available - length) / 2) / unit;
  }
  const next = { ...page, nodes: page.nodes.map((item) => item.id === id ? { ...item, frame, layout } : item) };
  return compensatePosition(next, id, { [axis]: local[axis] });
}
/** Converts a resolved local rectangle back into authored coordinates/constraints. */
export function editNodeFrame(page: GameFlowPage, id: string, next: Frame, intent: "move" | "resize" | "nudge" = "resize"): GameFlowPage {
  const node = page.nodes.find((n) => n.id === id);
  if (!node || inheritedFlag(page, node, "locked")) return page;
  if (sliderOwner(page, node)) {
    if (intent !== "resize" || (next.width === resolvePageLayout(page).nodes.get(id)!.local.width && next.height === resolvePageLayout(page).nodes.get(id)!.local.height)) return page;
    return { ...page, nodes: page.nodes.map(item => item.id === id ? { ...item, frame: { ...item.frame, width: Math.max(1, Math.round(next.width)), height: Math.max(1, Math.round(next.height)) }, layout: { ...item.layout, widthMode: "explicit", heightMode: "explicit" } } : item) };
  }
  const geometry = resolvePageLayout(page), old = geometry.nodes.get(id)!.local;
  next = { ...next };
  for (const key of ["x", "y", "width", "height"] as const) {
    if (next[key] !== old[key]) next[key] = key === "width" || key === "height" ? Math.max(1, Math.round(next[key])) : Math.round(next[key]);
  }
  const parent = page.nodes.find((n) => n.id === node.parentId), flow = flowType(parent);
  let result = page;
  if (parent && flow !== "free" && intent !== "resize") {
    const siblings = page.nodes.filter((n) => n.parentId === parent.id), index = siblings.indexOf(node);
    const axis = flow === "vbox" || (flow === "grid" && parent.layout?.direction === "vertical") ? "y" : "x";
    let target = node;
    if (intent === "nudge") {
      const delta = next[axis] - old[axis] || (flow === "grid" ? next[axis === "x" ? "y" : "x"] - old[axis === "x" ? "y" : "x"] : 0);
      target = siblings[index + Math.sign(delta)] ?? node;
    } else {
      const distance = (n: GameFlowNode) => {
        const f = geometry.nodes.get(n.id)!.local;
        return flow === "grid" ? Math.hypot(next.x + old.width / 2 - f.x - f.width / 2, next.y + old.height / 2 - f.y - f.height / 2) : Math.abs(next[axis] + old[AXES[axis].size] / 2 - f[axis] - f[AXES[axis].size] / 2);
      };
      target = siblings.reduce((nearest, n) => distance(n) < distance(nearest) ? n : nearest, node);
    }
    if (target !== node) result = moveNode(page, id, { targetId: target.id, position: siblings.indexOf(target) < index ? "before" : "after" });
  }
  const frame = { ...node.frame }, layout: NodeLayout = { ...node.layout };
  const positionTargets: Partial<Pick<Frame, "x" | "y">> = {};
  for (const axis of ["x", "y"] as const) {
    const a = AXES[axis], changedSize = next[a.size] !== old[a.size], changedPosition = next[axis] !== old[axis];
    if (!changedSize && !changedPosition) continue;
    const managed = managedAxis(parent, axis);
    const parentFrame = parent ? geometry.nodes.get(parent.id)!.local : page.frame;
    const start = parent?.layout?.[a.padStart] ?? 0, available = parentFrame[a.size] - start - (parent?.layout?.[a.padEnd] ?? 0);
    const unit = layout.layoutUnit === "percent" ? available / 100 : 1;
    if (changedSize) {
      frame[a.size] = Math.max(1, next[a.size]); layout[a.mode] = "explicit";
    }
    if (managed) continue;
    // Unanchored flow children follow alignment until an explicit cross-axis position is authored.
    if (flow !== "free" && layout.crossAxisMode !== "explicit" && !constraintsFor(axis).some((key) => layout[key] != null)) continue;
    frame[axis] = next[axis] - (layout[a.positionOffset] ?? 0);
    positionTargets[axis] = next[axis];
    if (unit === 0) continue;
    const length = next[a.size] * axisScale(node.transform, axis), position = next[axis] - (layout[a.positionOffset] ?? 0) - axisAnchor(node.transform, axis) * length;
    if (layout[a.leading] != null) layout[a.leading] = (position - start) / unit;
    if (layout[a.trailing] != null) layout[a.trailing] = (start + available - position - length) / unit;
    if (layout[a.center] != null) layout[a.center] = (position - start - (available - length) / 2) / unit;
  }
  const updated = { ...node, frame, ...(node.layout || Object.keys(layout).length ? { layout } : {}) };
  return compensatePosition({ ...result, nodes: result.nodes.map((n) => n.id === id ? updated : n) }, id, positionTargets);
}

/** Screen/page movement becomes a parent-local delta, independent of the node's own rotation. */
export function nodeDragFrame(frame: Frame, parentMatrix: Matrix, dx: number, dy: number): Frame {
  const inv = inverse(parentMatrix);
  const delta = inv ? mapVector(inv, { x: dx, y: dy }) : { x: 0, y: 0 };
  return { ...frame, x: frame.x + delta.x, y: frame.y + delta.y };
}

/** Resize local dimensions while keeping the opposite transformed edge/corner fixed. */
export function nodeResizeFrame(node: GameFlowNode, frame: Frame, matrix: Matrix, handle: string, dx: number, dy: number): Frame {
  const inv = inverse(matrix); if (!inv) return frame;
  const delta = mapVector(inv, { x: dx, y: dy });
  const width = handle.includes("w") ? Math.max(8, frame.width-delta.x) : handle.includes("e") ? Math.max(8, frame.width+delta.x) : frame.width;
  const height = handle.includes("n") ? Math.max(8, frame.height-delta.y) : handle.includes("s") ? Math.max(8, frame.height+delta.y) : frame.height;
  const localOffset = { x: (handle.includes("w") ? frame.width-width : 0)+axisAnchor(node.transform,"x")*(width-frame.width), y: (handle.includes("n") ? frame.height-height : 0)+axisAnchor(node.transform,"y")*(height-frame.height) };
  const offset = mapVector(nodeMatrix(frame,node.transform),localOffset);
  return { x: frame.x+offset.x, y: frame.y+offset.y, width, height };
}

export function changeContainerType(page: GameFlowPage, id: string, type: NodeType): GameFlowPage {
  const original = page.nodes.find((n) => n.id === id);
  if (!original || inheritedFlag(page, original, "locked") || page.nodes.some((n) => n.parentId === id && n.locked)) return page;
  const resolved = resolvePageLayout(page), parent = { ...original, type, layout: { ...original.layout } };
  if (type !== "hbox" && parent.layout.align === "justify") parent.layout.align = "left";
  if (type !== "vbox" && parent.layout.valign === "justify") parent.layout.valign = "top";
  return { ...page, nodes: page.nodes.map((n) => {
    if (n.id === id) return parent;
    if (n.parentId !== id) return n;
    const layout = { ...n.layout };
    delete layout.crossAxisMode;
    delete layout.positionOffsetX; delete layout.positionOffsetY;
    for (const axis of ["x", "y"] as const) if (managedAxis(parent, axis)) {
      for (const key of constraintsFor(axis)) layout[key] = null;
      if (resolved.nodes.get(n.id)![axis === "x" ? "widthSource" : "heightSource"] === "stretch") layout[AXES[axis].mode] = "explicit";
    }
    const local = resolved.nodes.get(n.id)!.local;
    return { ...n, frame: { ...local, width: Math.max(1, local.width), height: Math.max(1, local.height) }, layout };
  }) };
}

export function canConvertNodeType(page: GameFlowPage, id: string, type: NodeType): boolean {
  const node = page.nodes.find((item) => item.id === id);
  const children = page.nodes.filter((item) => item.parentId === id);
  return !!node && node.type !== type && !inheritedFlag(page, node, "locked") &&
    !children.some((child) => child.locked) && (!children.length || canHaveChildren({ type }));
}

/** Changes identity's presentation without dropping children or authored content. */
export function convertNodeType(page: GameFlowPage, id: string, type: NodeType): GameFlowPage {
  if (!canConvertNodeType(page, id, type)) return page;
  const changed = changeContainerType(page, id, type);
  const defaults = makeNode(type, id, 0, 0);
  return reconcileControlReferences(page, { ...changed, nodes: changed.nodes.map((node) => node.id === id ? {
    ...node, type,
    ...(node.text === undefined && defaults.text !== undefined ? { text: defaults.text } : {}),
    ...(type === "radioGroup" ? { widget: { ...node.widget, optionNodeIds: [], selectedIndex: -1 } } : !node.widget && defaults.widget ? { widget: structuredClone(defaults.widget) } : {})
  } : node) });
}
