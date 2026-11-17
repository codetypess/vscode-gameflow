import type { GameFlowNode } from "./model";

/** Each boundary records the defining identity, so equal IDs in different sources never alias. */
export interface CanvasAddressPart {
  documentId: string;
  pageId: string;
  kind: "node" | "addition";
  nodeId: string;
}
export interface CanvasTarget { path: CanvasAddressPart[] }
export interface CanvasPropertySelection { target: CanvasTarget; fields: string[] }
export interface CanvasOverride {
  target: CanvasTarget;
  set: Record<string, unknown>;
  unset: string[];
}
export interface CanvasAddition {
  node: GameFlowNode;
  parent: CanvasTarget;
  before?: CanvasTarget;
  /** Scoped control references are resolved only in the composed tree. */
  references?: Record<string, CanvasTarget | (CanvasTarget | null)[]>;
}
export interface CanvasInstanceEdits { overrides: CanvasOverride[]; additions: CanvasAddition[] }
export const ROOT_TARGET: CanvasTarget = { path: [] };
export const targetKey = (target: CanvasTarget) => JSON.stringify(target.path.map(part => [part.documentId, part.pageId, part.kind, part.nodeId]));
export const sameTarget = (a: CanvasTarget, b: CanvasTarget) => targetKey(a) === targetKey(b);
const SCALARS = new Set(["name", "variableName", "text", "imageData", "hidden"]);
const PROPERTY_GROUPS: Record<string, readonly string[]> = {
  frame: ["x", "y", "width", "height"],
  style: ["fill", "color", "borderColor", "borderWidth", "radius", "fontSize", "fontWeight", "italic", "underline", "strikethrough", "textAlign", "opacity"],
  layout: ["left", "right", "centerX", "top", "bottom", "centerY", "layoutUnit", "widthMode", "heightMode", "crossAxisMode", "positionOffsetX", "positionOffsetY", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "gap", "gapX", "gapY", "align", "valign", "direction", "wrapCount", "clipContent", "scrollX", "scrollY"],
  widget: ["skinNodeId", "optionNodeIds", "selected", "disabled", "min", "max", "value", "direction", "placeholder", "password", "maxChars", "options", "selectedIndex", "wordWrap", "overflow", "valign", "imageFit", "leading", "letterSpacing", "html", "ubb", "templateVars", "scrollX", "scrollY"],
  transform: ["anchorX", "anchorY", "scaleX", "scaleY", "skewX", "skewY", "rotation"]
};
export function isCanvasProperty(path: string): boolean {
  const keys = path.split(".");
  return keys.length === 1 ? SCALARS.has(path) : keys.length === 2 && Object.hasOwn(PROPERTY_GROUPS, keys[0]) && PROPERTY_GROUPS[keys[0]].includes(keys[1]);
}
export function readProperty(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((item, key) => item && typeof item === "object" ? (item as Record<string, unknown>)[key] : undefined, value);
}
export function writeProperty(node: GameFlowNode, path: string, value: unknown, unset = false): GameFlowNode {
  if (!isCanvasProperty(path)) throw new Error(`不能覆盖属性：${path}`);
  const next = { ...node } as unknown as Record<string, unknown>;
  const [group, key] = path.split(".");
  if (key) {
    const object = { ...(next[group] as Record<string, unknown> | undefined) };
    if (unset) delete object[key]; else object[key] = structuredClone(value);
    if (Object.keys(object).length) next[group] = object; else delete next[group];
  } else if (unset) delete next[group]; else next[group] = structuredClone(value);
  return next as unknown as GameFlowNode;
}
export function nodeProperties(node: GameFlowNode): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined) continue;
    if (SCALARS.has(key)) result[key] = value;
    else if (["frame", "style", "layout", "widget", "transform"].includes(key))
      for (const [field, v] of Object.entries(value as object)) if (v !== undefined) result[`${key}.${field}`] = v;
  }
  return result;
}
export function ownedCanvasNodes(nodes: readonly GameFlowNode[]): GameFlowNode[] {
  return nodes.flatMap(node => [node, ...ownedCanvasNodes(node.instanceEdits?.additions.map(item => item.node) ?? [])]);
}
export function mapOwnedCanvasNodes(nodes: GameFlowNode[], transform: (node: GameFlowNode) => GameFlowNode): GameFlowNode[] {
  return nodes.map(node => transform(node.instanceEdits ? { ...node, instanceEdits: { ...node.instanceEdits, additions: node.instanceEdits.additions.map(item => ({ ...item, node: mapOwnedCanvasNodes([item.node], transform)[0] })) } } : node));
}
export function validCanvasTarget(value: unknown): value is CanvasTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && Array.isArray(record.path) && record.path.length <= 24 && record.path.every(part => part && typeof part === "object" && Object.keys(part).length === 4 && ["node", "addition"].includes(part.kind) && [part.documentId, part.pageId, part.nodeId].every(v => typeof v === "string" && v.trim().length > 0 && !v.startsWith("@")));
}

export function validCanvasSelections(value: unknown): value is CanvasPropertySelection[] {
  if (!Array.isArray(value) || !value.length || value.length > 5000) return false;
  const targets = new Set<string>(); let fields = 0;
  return value.every(item => {
    if (!item || typeof item !== "object" || !validCanvasTarget(item.target) || !Array.isArray(item.fields) || !item.fields.length || item.fields.length > 200 || !item.fields.every((field: unknown) => typeof field === "string" && isCanvasProperty(field)) || new Set(item.fields).size !== item.fields.length) return false;
    const key = targetKey(item.target); fields += item.fields.length;
    if (targets.has(key) || fields > 10000) return false;
    targets.add(key); return true;
  });
}

/** Reject stale choices instead of silently applying only their surviving subset. */
export function selectedCanvasOverrides(overrides: CanvasOverride[], selections: CanvasPropertySelection[]): CanvasOverride[] {
  if (!validCanvasSelections(selections)) throw new Error("请选择有效且不重复的属性覆盖。");
  return selections.map(selection => {
    const patch = overrides.find(patch => sameTarget(patch.target, selection.target));
    if (!patch || selection.fields.some(field => !Object.hasOwn(patch.set, field) && !patch.unset.includes(field))) throw new Error("选中的属性覆盖已变化，请重新选择。");
    return { target: patch.target, set: Object.fromEntries(Object.entries(patch.set).filter(([field]) => selection.fields.includes(field))), unset: patch.unset.filter(field => selection.fields.includes(field)) };
  });
}

/** Clone owned identities, preserving addresses inside source definitions. */
export function remapCanvasEdits(node: GameFlowNode, mapping: ReadonlyMap<string,string>, context?: { documentId?: string; pageId: string }): GameFlowNode {
  if (!node.instanceEdits) return node;
  const address = (target: CanvasTarget): CanvasTarget => ({ path: target.path.map(part => target.path.length === 1 && part.kind === "addition" ? { ...part, nodeId: mapping.get(part.nodeId) ?? part.nodeId, ...(context ? { ...(context.documentId ? { documentId: context.documentId } : {}), pageId: context.pageId } : {}) } : part) });
  const value = (v: unknown): unknown => Array.isArray(v) ? v.map(value) : v && typeof v === "object" && "canvasTarget" in v ? { canvasTarget: address((v as {canvasTarget:CanvasTarget}).canvasTarget) } : v;
  return { ...node, instanceEdits: {
    overrides: node.instanceEdits.overrides.map(patch => ({ ...patch, target: address(patch.target), set: Object.fromEntries(Object.entries(patch.set).map(([k,v])=>[k,value(v)])) })),
    additions: node.instanceEdits.additions.map(item => ({ ...item, node: remapCanvasEdits({ ...item.node, id: mapping.get(item.node.id) ?? item.node.id, widget: item.node.widget ? { ...item.node.widget, ...(typeof item.node.widget.skinNodeId === "string" ? { skinNodeId: mapping.get(item.node.widget.skinNodeId) ?? item.node.widget.skinNodeId } : {}), ...(item.node.widget.optionNodeIds ? { optionNodeIds: item.node.widget.optionNodeIds.map(id=>id ? mapping.get(id) ?? id : null) } : {}) } : undefined }, mapping, context), parent: address(item.parent), before: item.before ? address(item.before) : undefined,
      references: item.references ? Object.fromEntries(Object.entries(item.references).map(([k,v])=>[k,Array.isArray(v)?v.map(item=>item?address(item):null):address(v)])) : undefined }))
  } };
}

/** Rewrite only identities owned by the document during its explicit ID migration. */
export function rekeyCanvasTargets(node: GameFlowNode, documentId: string, mapping: ReadonlyMap<string, string>): GameFlowNode {
  const next = structuredClone(node);
  if (next.prefab?.source === "" && next.prefab.documentId === documentId) next.prefab.pageId = mapping.get(next.prefab.pageId) ?? next.prefab.pageId;
  const target = (address: CanvasTarget) => { for (const part of address.path) if (part.documentId === documentId) { part.pageId = mapping.get(part.pageId) ?? part.pageId; part.nodeId = mapping.get(part.nodeId) ?? part.nodeId; } };
  const value = (v: unknown): void => { if (Array.isArray(v)) v.forEach(value); else if (v && typeof v === "object" && "canvasTarget" in v) target((v as {canvasTarget: CanvasTarget}).canvasTarget); };
  if (next.instanceEdits) {
    for (const patch of next.instanceEdits.overrides) { target(patch.target); Object.values(patch.set).forEach(value); }
    for (const addition of next.instanceEdits.additions) {
      target(addition.parent); if (addition.before) target(addition.before);
      for (const ref of Object.values(addition.references ?? {})) if (Array.isArray(ref)) ref.forEach(item => { if (item) target(item); }); else target(ref);
      addition.node = rekeyCanvasTargets(addition.node, documentId, mapping);
    }
  }
  return next;
}
