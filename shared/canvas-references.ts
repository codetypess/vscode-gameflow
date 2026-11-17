import { CANVAS_INSTANCE_LAYOUT_KEYS, GAMEFLOW_SCHEMA_VERSION, type CanvasReference, type GameFlowDocument, type GameFlowNode, type GameFlowPage } from "./model";
import { ownedCanvasNodes, remapCanvasEdits } from "./canvas-instance-data";
import { descendants, inheritedFlag } from "./editor-ops";
import { resolvePageLayout } from "./ui-layout";
import { remapControlReferences } from "./ui-parts";

export interface CanvasSource { source: string; document?: GameFlowDocument; error?: string; readOnly?: boolean }
export type CanvasSources = Record<string, CanvasSource>;
export const MAX_CANVAS_SOURCES = 64;

/** Keys are relative to the active file, including .. segments for sibling modules. */
export function resolveCanvasSource(containing: string, relative: string): string {
  if (!relative) return containing;
  const parts = [...(containing ? containing.split("/").slice(0, -1) : []), ...relative.split("/")];
  const result: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === ".." && result.length && result.at(-1) !== "..") result.pop();
    else result.push(part);
  }
  return result.join("/");
}

/** Loads a bounded dependency closure. Failed files remain explicit registry entries. */
export async function loadCanvasSources(document: GameFlowDocument, read: (source: string) => Promise<GameFlowDocument>, extra: string[] = []): Promise<CanvasSources> {
  const sources: CanvasSources = {};
  const queue: { source: string; document?: GameFlowDocument }[] = [{ source: "", document }, ...extra.map(source => ({ source }))];
  const seen = new Set<string>();
  while (queue.length && seen.size < MAX_CANVAS_SOURCES + 1) {
    const item = queue.shift()!;
    if (seen.has(item.source)) continue;
    seen.add(item.source);
    let current = item.document;
    if (!current) {
      try { current = await read(item.source); sources[item.source] = { source: item.source, document: current }; }
      catch (error) { sources[item.source] = { source: item.source, error: `无法读取源画布：${error instanceof Error ? error.message : String(error)}` }; }
    }
    if (!current) continue;
    for (const page of current.pages) for (const node of ownedCanvasNodes(page.nodes)) if (node.prefab) {
      const source = resolveCanvasSource(item.source, node.prefab.source);
      if (source && !seen.has(source)) queue.push({ source });
    }
  }
  return sources;
}

export function canvasExtractionIssue(page: GameFlowPage, id: string): string | null {
  const root = page.nodes.find(node => node.id === id);
  if (!root || root.type !== "container" || root.prefab) return "只有可添加到画布的自由容器 UIBox 可以存到画布。";
  if (page.componentRootId === id) return "该节点已是画布组件的根节点。";
  const size = resolvePageLayout(page).nodes.get(id)!.local;
  if (size.width <= 0 || size.height <= 0) return "容器的布局尺寸为空，请先设置有效宽高。";
  const ids = descendants(page, id);
  if (page.nodes.some(node => ids.has(node.id) && inheritedFlag(page, node, "locked"))) return "请先解锁容器及其子节点。";
  for (const node of page.nodes) {
    const refs = [node.widget?.skinNodeId, ...node.widget?.optionNodeIds ?? []].filter((ref): ref is string => !!ref);
    if (refs.some(ref => ids.has(node.id) !== ids.has(ref))) return "容器与外部节点之间存在控件部件或单选组引用，请先解除绑定。";
  }
  return null;
}

export function extractCanvasComponent(document: GameFlowDocument, pageId: string, id: string, makeId: () => string): GameFlowDocument {
  const page = document.pages.find(item => item.id === pageId);
  if (!page) throw new Error("页面不存在。");
  const issue = canvasExtractionIssue(page, id);
  if (issue) throw new Error(issue);
  const root = page.nodes.find(node => node.id === id)!;
  const ids = descendants(page, id), remap = new Map(ownedCanvasNodes(page.nodes.filter(node=>ids.has(node.id))).map(node => [node.id, makeId()]));
  const local = resolvePageLayout(page).nodes.get(id)!.local;
  const sourceRoot = remap.get(id)!, componentId = makeId();
  const component: GameFlowPage = {
    id: componentId, name: `${root.name} 组件`, kind: "screen", rootType: "UIBox", componentRootId: sourceRoot,
    background: "transparent", frame: { x: Math.max(...document.pages.map(p => p.frame.x + p.frame.width)) + 80, y: page.frame.y, width: local.width, height: local.height },
    nodes: page.nodes.filter(node => ids.has(node.id)).map(node => {
      const next = remapControlReferences(remapCanvasEdits(structuredClone(node), remap, {documentId:document.documentId,pageId:componentId}), remap);
      next.id = remap.get(node.id)!;
      if (node.id === id) {
        delete next.parentId; delete next.transform; delete next.hidden; delete next.locked;
        next.frame = { x: 0, y: 0, width: local.width, height: local.height };
        next.layout = { ...next.layout, left: null, right: null, centerX: null, top: null, bottom: null, centerY: null, widthMode: "explicit", heightMode: "explicit" };
        delete next.layout.positionOffsetX; delete next.layout.positionOffsetY; delete next.layout.crossAxisMode;
      } else if (node.parentId) next.parentId = remap.get(node.parentId)!;
      return next;
    })
  };
  const instance: GameFlowNode = {
    id: root.id, name: root.name, type: "container", frame: { ...root.frame, width: local.width, height: local.height },
    ...(root.parentId ? { parentId: root.parentId } : {}),
    ...(root.variableName ? { variableName: root.variableName } : {}),
    ...(root.transform ? { transform: { ...root.transform } } : {}), hidden: root.hidden, locked: root.locked,
    layout: { ...Object.fromEntries(Object.entries(root.layout ?? {}).filter(([key]) => CANVAS_INSTANCE_LAYOUT_KEYS.includes(key))), widthMode: "explicit", heightMode: "explicit" },
    prefab: { source: "", documentId: document.documentId, pageId: component.id }
  };
  return { ...document, schemaVersion: GAMEFLOW_SCHEMA_VERSION, pages: [...document.pages.map(p => p.id === page.id ? { ...p, nodes: p.nodes.filter(n => !ids.has(n.id) || n.id === id).map(n => n.id === id ? instance : n) } : p), component] };
}

export function makeCanvasInstance(document: GameFlowDocument, page: GameFlowPage, source: string, id: string): GameFlowNode {
  const root = page.nodes.find(node => node.id === page.componentRootId);
  const size = root ? resolvePageLayout(page).nodes.get(root.id)!.local : page.frame;
  return { id, name: page.name, type: "container", frame: { x: 24, y: 24, width: Math.max(1, size.width), height: Math.max(1, size.height) },
    prefab: { source, documentId: document.documentId, pageId: page.id } };
}

export function findCanvasTarget(document: GameFlowDocument, sources: CanvasSources, reference: CanvasReference, containing = "") {
  const key = resolveCanvasSource(containing, reference.source);
  const entry = key ? sources[key] : { source: "", document };
  if (!entry?.document) return { key, error: entry?.error ?? `源画布不可用：${key || "当前文件"}` };
  if (entry.document.documentId !== reference.documentId) return { key, error: "源文件身份已变化，请重新选择画布引用。" };
  const page = entry.document.pages.find(page => page.id === reference.pageId);
  if (!page) return { key, error: "源画布已删除，请重新选择画布引用。" };
  return { key, page };
}

export interface CanvasProjection { page: GameFlowPage; owners: Map<string, string>; errors: Map<string, string> }

/** Ephemeral expansion only. Canonical documents retain one atomic node per instance. */
export function projectCanvasReferences(document: GameFlowDocument, page: GameFlowPage, sources: CanvasSources): CanvasProjection {
  const nodes: GameFlowNode[] = [], owners = new Map<string, string>(), errors = new Map<string, string>();
  const reserved = new Set(page.nodes.map(node => node.id));
  let serial = 0, budget = 5000;
  const virtualId = () => { let id: string; do { id = `@reference:${++serial}`; } while (reserved.has(id)); reserved.add(id); return id; };
  const expand = (node: GameFlowNode, source: string, owner: string, stack: string[], projected = false) => {
    if (projected && --budget < 0) { errors.set(owner, "组件展开超过 5000 个节点限制。"); return; }
    owners.set(node.id, owner);
    if (!node.prefab) { nodes.push(node); return; }
    const target = findCanvasTarget(document, sources, node.prefab, source);
    const token = `${target.key}\0${node.prefab.pageId}`;
    const error = target.error ?? (stack.includes(token) ? "检测到循环画布引用。" : stack.length >= 24 ? "组件嵌套超过 24 层限制。" : undefined);
    if (error || !target.page) { errors.set(owner, error!); nodes.push({ ...node, prefab: undefined, style: { fill: "#3d2025", borderColor: "#ee6677", borderWidth: 1 } }); return; }
    const definition = target.page;
    const root = definition.componentRootId ? definition.nodes.find(n => n.id === definition.componentRootId && n.type === "container" && !n.prefab && !n.parentId) : undefined;
    const subtree = root ? descendants(definition, root.id) : undefined;
    if (definition.componentRootId && (!root || definition.nodes.some(n => !subtree!.has(n.id)))) {
      errors.set(owner, "源组件根节点已删除或层级无效。"); nodes.push({ ...node, prefab: undefined }); return;
    }
    const map = new Map(definition.nodes.map(n => [n.id, n.id === root?.id ? node.id : virtualId()]));
    const inherited = Object.fromEntries(Object.entries(root?.layout ?? {}).filter(([key]) => !CANVAS_INSTANCE_LAYOUT_KEYS.includes(key)));
    const layout = { ...inherited, ...node.layout, widthMode: node.layout?.widthMode ?? "explicit" as const, heightMode: node.layout?.heightMode ?? "explicit" as const };
    // Root constraints belong to the instance's parent; source content padding remains inherited.
    for (const key of ["left", "right", "centerX", "top", "bottom", "centerY", "layoutUnit"] as const) {
      delete layout[key];
      if (node.layout?.[key] !== undefined) Object.assign(layout, { [key]: node.layout[key] });
    }
    nodes.push({ ...node, prefab: undefined, hidden: node.hidden || root?.hidden, widget: root?.widget, style: { ...(root ? root.style : { fill: definition.background ?? "#ffffff", borderWidth: 0, radius: 0 }), opacity: (root?.style?.opacity ?? 1) * (node.style?.opacity ?? 1) }, layout });
    for (const child of definition.nodes) {
      if (child.id === root?.id) continue;
      const copy = remapControlReferences({ ...child, id: map.get(child.id)!, parentId: child.parentId ? map.get(child.parentId)! : node.id }, map);
      expand(copy, target.key, owner, [...stack, token], true);
    }
  };
  for (const node of page.nodes) expand(node, "", node.id, [`\0${page.id}`]);
  return { page: { ...page, nodes }, owners, errors };
}
