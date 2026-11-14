import type { Frame, GameFlowNode, GameFlowPage, NodeLayout, NodeType } from "./model";
import { AXES, constraintsFor, managedAxis, resolvePageLayout } from "./ui-layout";
import { inheritedFlag, makeNode, moveNode } from "./editor-ops";
import type { Constraint } from "./ui-config";
import { canHaveChildren, flowType } from "./ui-components";

/** Switch anchors without reverting to stale authored coordinates or changing the visible bounds. */
export function setNodeConstraint(page: GameFlowPage, id: string, key: Constraint, enabled: boolean): GameFlowPage {
  const node = page.nodes.find((item) => item.id === id);
  if (!node || inheritedFlag(page, node, "locked") || (node.layout?.[key] != null) === enabled) return page;
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
  const frame = { ...node.frame, [axis]: local[axis], [a.size]: local[a.size] };
  const wasStretch = node.layout?.[a.leading] != null && node.layout?.[a.trailing] != null;
  if (wasStretch && (layout[a.leading] == null || layout[a.trailing] == null)) layout[a.mode] = "explicit";
  if (unit > 0) {
    if (layout[a.leading] != null) layout[a.leading] = (local[axis] - start) / unit;
    if (layout[a.trailing] != null) layout[a.trailing] = (start + available - local[axis] - local[a.size]) / unit;
    if (layout[a.center] != null) layout[a.center] = (local[axis] - start - (available - local[a.size]) / 2) / unit;
  }
  return { ...page, nodes: page.nodes.map((item) => item.id === id ? { ...item, frame, layout } : item) };
}
/** Converts a resolved local rectangle back into authored coordinates/constraints. */
export function editNodeFrame(page: GameFlowPage, id: string, next: Frame, intent: "move" | "resize" | "nudge" = "resize"): GameFlowPage {
  const node = page.nodes.find((n) => n.id === id);
  if (!node || inheritedFlag(page, node, "locked")) return page;
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
    frame[axis] = next[axis];
    if (unit === 0) continue;
    if (layout[a.leading] != null) layout[a.leading] = (next[axis] - start) / unit;
    if (layout[a.trailing] != null) layout[a.trailing] = (start + available - next[axis] - next[a.size]) / unit;
    if (layout[a.center] != null) layout[a.center] = (next[axis] - start - (available - next[a.size]) / 2) / unit;
  }
  const updated = { ...node, frame, ...(node.layout || Object.keys(layout).length ? { layout } : {}) };
  return { ...result, nodes: result.nodes.map((n) => n.id === id ? updated : n) };
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
  return { ...changed, nodes: changed.nodes.map((node) => node.id === id ? {
    ...node, type,
    ...(node.text === undefined && defaults.text !== undefined ? { text: defaults.text } : {}),
    ...(!node.widget && defaults.widget ? { widget: structuredClone(defaults.widget) } : {})
  } : node) };
}
