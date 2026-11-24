import type { ResourceSizes } from "./ui-layout";
import { GAMEFLOW_SCHEMA_VERSION, validateGameFlowDocument, type CanvasReference, type GameFlowDocument, type GameFlowNode, type GameFlowPage } from "./model";
import { CANVAS_INSTANCE_LAYOUT_KEYS } from "./model";
import { extractCanvasComponent, findCanvasTarget, resolveCanvasSource, type CanvasSources } from "./canvas-references";
import { canHaveChildren } from "./ui-components";
import { inheritedFlag } from "./editor-ops";
import { copySelection } from "./selection-ops";
import { descendants } from "./editor-ops";
import type { NodeClipboard } from "./node-clipboard";
import { validateControlReferences, remapControlReferences } from "./ui-parts";
import { ROOT_TARGET, isCanvasProperty, nodeProperties, ownedCanvasNodes, readProperty, sameTarget, targetKey, writeProperty, remapCanvasEdits, type CanvasAddition, type CanvasAddressPart, type CanvasOverride, type CanvasTarget } from "./canvas-instance-data";
import { selectedCanvasOverrides, type CanvasPropertySelection } from "./canvas-instance-data";

export interface CanvasNodeInfo {
  ownerId?: string;
  scope?: string;
  sourceOpacity?: number;
  target: CanvasTarget;
  inherited: boolean;
  localId?: string;
  added?: boolean;
  reference?: CanvasReference;
  source: string;
  sourcePageId?: string;
  base: GameFlowNode;
  overrides: string[];
  stored?: GameFlowNode;
}
export interface CanvasOrphan { ownerId: string; additionId?: string; name: string; message: string; target?: CanvasTarget }
export interface CanvasComposition {
  page: GameFlowPage;
  info: Map<string, CanvasNodeInfo>;
  errors: Map<string, string>;
  orphans: CanvasOrphan[];
}
interface Entry { node: GameFlowNode; address: CanvasTarget; meta: CanvasNodeInfo }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clean = (node: GameFlowNode) => { const next = structuredClone(node); delete next.parentId; return next; };
const virtual = (root: string, address: CanvasTarget) => `${root}/@${encodeURIComponent(targetKey(address))}`;
const prepend = (part: CanvasAddressPart, target: CanvasTarget): CanvasTarget => ({ path: [part, ...target.path] });
const partFor = (document: GameFlowDocument, page: GameFlowPage, nodeId: string, kind: CanvasAddressPart["kind"] = "node"): CanvasAddressPart => ({ documentId: document.documentId, pageId: page.id, nodeId, kind });
const nativeRoot = (path: string) => ["name", "variableName", "hidden"].includes(path) || path.startsWith("frame.") || path.startsWith("transform.") || path === "style.opacity" || path.startsWith("layout.") && CANVAS_INSTANCE_LAYOUT_KEYS.includes(path.slice(7));
export function findOwnedCanvasNode(document: GameFlowDocument, id: string): GameFlowNode | undefined {
  return document.pages.flatMap(page => ownedCanvasNodes(page.nodes)).find(node => node.id === id);
}
function decodeValue(value: unknown, entries: Entry[]): unknown {
  if (Array.isArray(value)) return value.map(item => decodeValue(item, entries));
  if (value && typeof value === "object" && "canvasTarget" in value) {
    const target = (value as { canvasTarget: CanvasTarget }).canvasTarget;
    const entry = entries.find(item => sameTarget(item.address, target));
    if (!entry) throw new Error("覆盖引用的部件目标已失效。");
    return entry.node.id;
  }
  return value;
}

/** One composed tree for rendering and editing. Persistence always stores stable scoped targets. */
export function composeCanvasPage(document: GameFlowDocument, page: GameFlowPage, sources: CanvasSources, containingSource = ""): CanvasComposition {
  const info = new Map<string, CanvasNodeInfo>(), errors = new Map<string, string>(), orphans: CanvasOrphan[] = [];
  let budget = 5000;
  const expand = (instance: GameFlowNode, containing: GameFlowDocument, containingPage: GameFlowPage, source: string, stack: string[], editable: boolean, depth = 0): Entry[] => {
    const target = findCanvasTarget(document, sources, instance.prefab!, source);
    const sourceDocument = target.key ? sources[target.key]?.document : document;
    const token = `${target.key}\0${instance.prefab!.pageId}`;
    const problem = target.error ?? (stack.includes(token) ? "检测到循环画布引用。" : depth >= 24 ? "组件嵌套超过 24 层限制。" : budget <= 0 ? "组件展开超过 5000 个节点限制。" : undefined);
    const rootMeta: CanvasNodeInfo = { ownerId: instance.id, target: ROOT_TARGET, inherited: false, reference: instance.prefab, source: target.key, sourcePageId: target.page?.id, base: instance, stored: instance, overrides: [] };
    if (problem || !target.page || !sourceDocument) {
      errors.set(instance.id, problem ?? "源画布不可用。");
      if (editable) for (const patch of instance.instanceEdits?.overrides ?? []) orphans.push({ ownerId:instance.id,name:patch.target.path.at(-1)?.nodeId ?? instance.name,message:"源不可用，属性覆盖已保留。",target:patch.target });
      for (const addition of instance.instanceEdits?.additions ?? []) if (editable) orphans.push({ ownerId: instance.id, additionId: addition.node.id, name: addition.node.name, message: "源不可用，附加内容已保留。" });
      return [{ node: { ...instance, prefab: undefined, instanceEdits: undefined }, address: ROOT_TARGET, meta: rootMeta }];
    }
    const definition = target.page;
    const root = definition.componentRootId ? definition.nodes.find(node => node.id === definition.componentRootId && node.type === "container" && !node.prefab && !node.parentId) : undefined;
    if (definition.componentRootId && !root) { errors.set(instance.id, "源组件根节点已删除。"); return [{ node: { ...instance, prefab: undefined, instanceEdits: undefined }, address: ROOT_TARGET, meta: rootMeta }]; }
    const addresses = new Map(definition.nodes.map(node => [node.id, node.id === root?.id ? ROOT_TARGET : { path: [partFor(sourceDocument, definition, node.id)] }]));
    const ids = new Map([...addresses].map(([id, address]) => [id, address.path.length ? virtual(instance.id, address) : instance.id]));
    const layout = { ...Object.fromEntries(Object.entries(root?.layout ?? {}).filter(([key]) => !CANVAS_INSTANCE_LAYOUT_KEYS.includes(key))), ...instance.layout, widthMode: instance.layout?.widthMode ?? "explicit" as const, heightMode: instance.layout?.heightMode ?? "explicit" as const };
    const visualRoot: GameFlowNode = { ...instance, prefab: undefined, instanceEdits: undefined, hidden: instance.hidden || root?.hidden, locked: instance.locked || root?.locked, widget: root?.widget, layout,
      style: { ...(root?.style ?? { fill: definition.background ?? "#ffffff", borderWidth: 0, radius: 0 }), opacity: (root?.style?.opacity ?? 1) * (instance.style?.opacity ?? 1) } };
    const entries: Entry[] = [{ node: remapControlReferences(visualRoot, ids), address: ROOT_TARGET, meta: { ...rootMeta, base: visualRoot, sourceOpacity: root?.style?.opacity ?? 1 } }];
    for (const child of definition.nodes) {
      if (child.id === root?.id) continue;
      if (--budget < 0) { errors.set(instance.id, "组件展开超过 5000 个节点限制。"); break; }
      const address = addresses.get(child.id)!;
      const node = remapControlReferences({ ...child, id: ids.get(child.id)!, parentId: child.parentId ? ids.get(child.parentId) : instance.id }, ids);
      if (child.cellPrefab && "source" in child.cellPrefab) node.cellPrefab = { ...child.cellPrefab, source: resolveCanvasSource(target.key, child.cellPrefab.source) };
      if (child.prefab) {
        const nested = expand(node, sourceDocument, definition, target.key, [...stack, token], false, depth + 1);
        if (errors.has(node.id)) errors.set(instance.id,errors.get(node.id)!);
        for (const entry of nested) entries.push({ ...entry, address: prepend(address.path[0], entry.address), meta: { ...entry.meta, ownerId: instance.id, inherited: true, added: false, target: prepend(address.path[0], entry.address), base: structuredClone(entry.node), overrides: [] } });
      } else entries.push({ node, address, meta: { ...rootMeta, reference: undefined, target: address, inherited: true, base: structuredClone(node) } });
    }
    const pending = [...instance.instanceEdits?.additions ?? []];
    const localIds = new Map(pending.map(item => { const address = { path: [partFor(containing, containingPage, item.node.id, "addition")] }; return [item.node.id, editable ? item.node.id : virtual(instance.id, address)]; }));
    let changed = true;
    while (pending.length && changed) {
      changed = false;
      for (let i = 0; i < pending.length; i++) {
        const addition = pending[i], parent = entries.find(item => sameTarget(item.address, addition.parent));
        if (!parent || !canHaveChildren(parent.node)) continue;
        if (--budget < 0) { errors.set(instance.id, "组件展开超过 5000 个节点限制。"); continue; }
        pending.splice(i--, 1); changed = true;
        const address: CanvasTarget = { path: [partFor(containing, containingPage, addition.node.id, "addition")] };
        const node = remapControlReferences({ ...addition.node, id: localIds.get(addition.node.id)!, parentId: parent.node.id }, localIds);
        if (node.cellPrefab && "source" in node.cellPrefab) node.cellPrefab = {...node.cellPrefab,source:resolveCanvasSource(source,node.cellPrefab.source)};
        let added: Entry[];
        if (node.prefab) {
          added = expand(node, containing, containingPage, source, editable ? stack : [...stack, token], editable, depth + 1);
          added = added.map(entry => ({ ...entry, address: entry.address.path.length ? prepend(address.path[0], entry.address) : address }));
        } else added = [{ node, address, meta: { ownerId: instance.id, localId: editable ? addition.node.id : undefined, inherited: !editable, target: address, reference: undefined, source: target.key, sourcePageId: definition.id, base: structuredClone(node), overrides: [] } }];
        if (editable && added[0]) added[0].meta.added = true;
        if (!editable) for (const entry of added) entry.meta = { ...entry.meta, ownerId: instance.id, inherited: true, added: false, target: entry.address, base: structuredClone(entry.node) };
        if (addition.before) {
          const anchor = entries.find(item => sameTarget(item.address, addition.before!));
          if (anchor?.node.parentId === parent.node.id) entries.splice(entries.indexOf(anchor), 0, ...added);
          else { entries.push(...added); if (editable) orphans.push({ ownerId: instance.id, additionId: addition.node.id, name: node.name, message: "排序锚点已失效，暂排末尾；重新排序可修复。" }); }
        } else entries.push(...added);
      }
    }
    if (editable) for (const addition of pending) orphans.push({ ownerId: instance.id, additionId: addition.node.id, name: addition.node.name, message: "待重新挂接：父目标已失效或不支持子节点。" });
    for (const patch of instance.instanceEdits?.overrides ?? []) {
      const entry = entries.find(item => sameTarget(item.address, patch.target));
      if (!entry) { if (editable) orphans.push({ ownerId: instance.id, name: patch.target.path.at(-1)?.nodeId ?? instance.name, message: "属性覆盖的源目标已失效。", target: patch.target }); continue; }
      try {
        let candidate = entry.node;
        const fields = [...Object.keys(patch.set), ...patch.unset];
        for (const field of fields) {
          if (field === "text" && !["text","input","button","checkbox","radio"].includes(entry.node.type) || ["imageData", "sliceResource", "image"].includes(field) && entry.node.type !== "image" || ["normalSkin", "selectedSkin", "disabledSkin"].includes(field) && entry.node.type !== "button") throw new Error("源节点类型已变化，该内容覆盖暂不可用。");
          if (!isCanvasProperty(field) || !patch.target.path.length && nativeRoot(field)) throw new Error("实例独立属性不能作为源覆盖。");
          candidate = writeProperty(candidate, field, decodeValue(patch.set[field], entries), patch.unset.includes(field));
          if (field === "cellPrefab" && candidate.cellPrefab && "source" in candidate.cellPrefab) candidate.cellPrefab = {...candidate.cellPrefab,source:resolveCanvasSource(source,candidate.cellPrefab.source)};
        }
        const check = { ...candidate, id: "check", parentId: undefined, variableName: undefined, widget: { ...candidate.widget } };
        delete check.widget!.skinNodeId; delete check.widget!.optionNodeIds; delete check.widget!.textLabelNodeId;
        if (check.type === "radioGroup") check.widget!.selectedIndex = -1;
        const valid = validateGameFlowDocument({ ...document, pages: [{ id: "validation-page", name: "validation", kind: "screen", frame: page.frame, nodes: [check] }], interactions: [] });
        if (!valid.ok) throw new Error(valid.errors.join("；"));
        const controlErrors: string[] = [];
        validateControlReferences({...page,nodes:entries.map(item=>item===entry?candidate:item.node)},controlErrors);
        const invalidControl = controlErrors.find(issue=>issue.includes(candidate.id));
        if (invalidControl) throw new Error(invalidControl);
        entry.node = candidate; entry.meta.overrides = fields;
      } catch (error) { errors.set(instance.id, `覆盖暂未应用：${error instanceof Error ? error.message : String(error)}`); }
    }

    for (const addition of instance.instanceEdits?.additions ?? []) {
      const node = entries.find(item => item.node.id === localIds.get(addition.node.id));
      if (!node) continue;
      for (const [field, ref] of Object.entries(addition.references ?? {})) {
        try { node.node = writeProperty(node.node, field, Array.isArray(ref) ? ref.map(canvasTarget => canvasTarget === null ? null : decodeValue({ canvasTarget }, entries)) : decodeValue({ canvasTarget: ref }, entries)); }
        catch { errors.set(instance.id, "附加节点的控件引用已失效。"); }
      }
    }
    return entries;
  };
  const nodes: GameFlowNode[] = [];
  for (const node of page.nodes) {
    if (!node.prefab) { nodes.push(containingSource && node.cellPrefab && "source" in node.cellPrefab ? { ...node, cellPrefab: { ...node.cellPrefab, source: resolveCanvasSource(containingSource, node.cellPrefab.source) } } : node); info.set(node.id, { target: ROOT_TARGET, inherited: false, source: "", base: node, overrides: [] }); continue; }
    for (const entry of expand(node, document, page, containingSource, [`${containingSource}\0${page.id}`], true)) { nodes.push(entry.node); info.set(entry.node.id, entry.meta); }
  }
  const composed = { ...page, nodes };
  for (const node of nodes) info.get(node.id)!.scope = canvasVariableScope(composed, info, node.id);
  const semantic = canvasSemanticIssues(composed, info);
  for (const [id, message] of semantic) errors.set(info.get(id)?.ownerId ?? id, message);
  return { page: composed, info, errors, orphans };
}

export function canvasVariableScope(page: GameFlowPage, info: ReadonlyMap<string,CanvasNodeInfo>, id: string): string {
  let parentId = page.nodes.find(node => node.id === id)?.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    if (info.get(parentId)?.reference) return parentId;
    parentId = page.nodes.find(node => node.id === parentId)?.parentId;
  }
  return "";
}
export function canvasSemanticIssues(page: GameFlowPage, info: ReadonlyMap<string,CanvasNodeInfo>): [string,string][] {
  const issues: [string,string][] = [], names = new Map<string,string>();
  for (const node of page.nodes) {
    const scope = canvasVariableScope(page,info,node.id);
    if (node.variableName) {
      const key = `${scope}\0${node.variableName}`;
      if (names.has(key)) issues.push([node.id, `变量 ${node.variableName} 在同一实例作用域内重名。`]);
      names.set(key,node.id);
    }
    for (const ref of [node.widget?.skinNodeId, node.widget?.textLabelNodeId, ...node.widget?.optionNodeIds ?? []]) if (ref && canvasVariableScope(page,info,ref) !== scope) issues.push([node.id,"控件引用不能跨越独立实例作用域。"]);
  }
  const controls: string[] = []; validateControlReferences(page,controls);
  for (const issue of controls) issues.push([page.nodes.find(node=>issue.includes(node.id))?.id ?? page.id,issue]);
  return issues;
}

function editsFor(node: GameFlowNode) { return node.instanceEdits ??= { overrides: [], additions: [] }; }
function setOverride(owner: GameFlowNode, target: CanvasTarget, field: string, value: unknown, unset: boolean) {
  const edits = editsFor(owner);
  let patch = edits.overrides.find(item => sameTarget(item.target, target));
  if (!patch) { patch = { target: structuredClone(target), set: {}, unset: [] }; edits.overrides.push(patch); }
  delete patch.set[field]; patch.unset = patch.unset.filter(key => key !== field);
  if (unset) patch.unset.push(field); else patch.set[field] = structuredClone(value);
}
function encodeValue(field: string, value: unknown, ownerId: string, composition: CanvasComposition): unknown {
  if (!["widget.skinNodeId", "widget.optionNodeIds", "widget.textLabelNodeId"].includes(field) || value == null) return value;
  const encode = (id: string) => {
    const meta = composition.info.get(id);
    if (!meta || meta.ownerId !== ownerId) throw new Error("控件部件必须属于同一组合实例。");
    return { canvasTarget: meta.target };
  };
  return Array.isArray(value) ? value.map(id => id === null ? null : encode(id)) : encode(value as string);
}
export function canvasStructureIssue(composition: CanvasComposition, ids: string[], action: "delete" | "convert" | "move"): string | null {
  return ids.some(id => composition.info.get(id)?.inherited) ? `源组件节点不能在实例中${action === "delete" ? "删除或剪切，可隐藏或编辑源组件" : action === "move" ? "换父或排序" : "转换类型"}。` : null;
}

/** Translate a normal editor operation into owned node edits or scoped property deltas. */
export function editCanvasPage(document: GameFlowDocument, pageId: string, sources: CanvasSources, transform: (page: GameFlowPage) => GameFlowPage): GameFlowDocument {
  const canonical = document.pages.find(page => page.id === pageId);
  if (!canonical) return document;
  const composition = composeCanvasPage(document, canonical, sources), before = composition.page, after = transform(before);
  if (equal(before, after)) return document;
  const byId = new Map(after.nodes.map(node => [node.id, node]));
  for (const old of before.nodes) {
    const meta = composition.info.get(old.id)!, next = byId.get(old.id);
    if (meta.inherited && meta.ownerId && byId.has(meta.ownerId)) {
      if (!next) throw new Error("源组件节点不能在实例中删除，可隐藏或编辑源组件。");
      if (next.type !== old.type || next.parentId !== old.parentId || next.prefab) throw new Error("源组件节点的类型和层级受保护。");

      if (next.locked !== old.locked) throw new Error("源节点锁定状态请在源组件中修改。");
    }
  }
  // Check direct structural violations before their effect on sibling ordering.
  for (const old of before.nodes) {
    const meta = composition.info.get(old.id)!;
    if (!meta.inherited || !meta.ownerId || !byId.has(meta.ownerId)) continue;
    const oldOrder = before.nodes.filter(n => n.parentId === old.parentId && composition.info.get(n.id)?.inherited).map(n => n.id);
    const nextOrder = after.nodes.filter(n => n.parentId === old.parentId && composition.info.get(n.id)?.inherited).map(n => n.id);
    if (!equal(oldOrder, nextOrder)) throw new Error("源组件节点不能在实例中排序。");
  }
  const nextDocument = structuredClone(document), nextPage = nextDocument.pages.find(p => p.id === pageId)!;
  nextDocument.schemaVersion = GAMEFLOW_SCHEMA_VERSION;
  Object.assign(nextPage, { ...after, nodes: nextPage.nodes });
  // Remove owned canonical nodes; descendants of removed instances disappear with their owner.
  nextPage.nodes = nextPage.nodes.filter(node => byId.has(node.id));
  for (const owner of ownedCanvasNodes(nextPage.nodes)) if (owner.instanceEdits) owner.instanceEdits.additions = owner.instanceEdits.additions.filter(item => {
    const shown = before.nodes.find(n => composition.info.get(n.id)?.localId === item.node.id || n.id === item.node.id);
    return !shown || byId.has(shown.id);
  });
  const ownerFor = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    const meta = composition.info.get(id);
    if (meta?.reference && !meta.inherited) return id;
    if (meta?.ownerId) return meta.ownerId;
    return ownerFor(byId.get(id)?.parentId);
  };
  const addressFor = (id: string, ownerId: string): CanvasTarget => {
    if (id === ownerId) return ROOT_TARGET;
    if (findOwnedCanvasNode(nextDocument,ownerId)?.instanceEdits?.additions.some(item=>item.node.id===id)) return {path:[partFor(document,canonical,id,"addition")]};
    const meta = composition.info.get(id);
    if (meta) { if (meta.ownerId !== ownerId) throw new Error("暂不支持跨独立引用实例移动节点。"); return meta.target; }
    return { path: [partFor(document, canonical, id, "addition")] };
  };
  const editedInfo = new Map(composition.info);
  for (const node of after.nodes) if (!editedInfo.has(node.id)) {
    const ownerId = ownerFor(node.parentId);
    editedInfo.set(node.id, { ownerId, target: ownerId ? addressFor(node.id, ownerId) : ROOT_TARGET, inherited: false, localId: ownerId ? node.id : undefined, source: "", base: node, overrides: [] });
  }
  const editedComposition = { ...composition, page: after, info: editedInfo };
  const previousIssues = canvasSemanticIssues(before, composition.info);
  const newIssues = canvasSemanticIssues(after, editedInfo).filter(([id, issue]) => !previousIssues.some(([oldId, oldIssue]) => id === oldId && issue === oldIssue));
  if (newIssues.length) throw new Error(newIssues.map(([, issue]) => issue).join("；"));
  const additionRecord = (node: GameFlowNode, ownerId: string): Pick<CanvasAddition,"node"|"references"> => {
    const saved = clean(node), references: NonNullable<CanvasAddition["references"]> = {};
    for (const field of ["widget.skinNodeId", "widget.optionNodeIds", "widget.textLabelNodeId"]) {
      const value = readProperty(node, field);
      if (value == null) continue;
      const encoded = encodeValue(field, value, ownerId, editedComposition);
      references[field] = Array.isArray(encoded) ? encoded.map(item => item === null ? null : item.canvasTarget) : (encoded as {canvasTarget:CanvasTarget}).canvasTarget;
      delete (saved.widget as Record<string,unknown>)[field.slice(7)];
    }
    return { node: remapCanvasEdits(saved,new Map(),{documentId:document.documentId,pageId}), ...(Object.keys(references).length ? {references} : {}) };
  };
  for (const node of after.nodes) {
    const meta = composition.info.get(node.id), old = before.nodes.find(n => n.id === node.id);
    const ownerId = meta?.reference && !meta.inherited ? node.id : meta?.ownerId ?? ownerFor(node.parentId);
    if (!old || meta && !meta.ownerId && ownerId && node.id !== ownerId) {
      if (old) nextPage.nodes = nextPage.nodes.filter(item=>item.id!==node.id);
      if (ownerId) {
        const owner = findOwnedCanvasNode(nextDocument, ownerId);
        if (!owner) throw new Error("附加节点的引用拥有者不存在。");
        editsFor(owner).additions.push({ ...additionRecord(node, ownerId), parent: addressFor(node.parentId!, ownerId) });
      } else nextPage.nodes.push(remapCanvasEdits(structuredClone(node),new Map(),{documentId:document.documentId,pageId}));
      continue;
    }
    if (!ownerId) { const index = nextPage.nodes.findIndex(n => n.id === node.id); if (index >= 0) nextPage.nodes[index] = structuredClone(node); continue; }
    const owner = findOwnedCanvasNode(nextDocument, ownerId);
    if (!owner) continue;
    if (!meta!.inherited && meta!.localId) {
      if (ownerFor(node.parentId) !== ownerId) throw new Error("暂不支持跨独立引用实例移动节点。");
      const record = editsFor(owner).additions.find(item => item.node.id === meta!.localId)!;
      const saved = additionRecord(node, ownerId);
      record.node = saved.node; record.references = saved.references; record.parent = addressFor(node.parentId!, ownerId);
      continue;
    }
    const a = nodeProperties(old), b = nodeProperties(node);
    for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (equal(a[field], b[field])) continue;
      if (inheritedFlag(before, old, "locked")) throw new Error("节点已锁定。");
      if (!meta!.inherited && node.id === ownerId && nativeRoot(field)) {
        let value = b[field];
        if (field === "style.opacity" && typeof value === "number") value = value / (meta!.sourceOpacity || 1);
        const replacement = writeProperty(owner, field, value, b[field] === undefined);
        for (const key of Object.keys(owner)) if (!(key in replacement)) delete (owner as unknown as Record<string,unknown>)[key];
        Object.assign(owner, replacement);
        if (b[field] === undefined) { const [group,key] = field.split("."); if (!key) delete (owner as unknown as Record<string, unknown>)[group]; }
      } else setOverride(owner, meta!.target, field, encodeValue(field, b[field], ownerId, editedComposition), b[field] === undefined);
    }
    if (!meta!.inherited && node.id === ownerId) {
      if (node.type !== old.type) throw new Error("引用实例不能转换类型。");
      if (old.locked !== node.locked) owner.locked = node.locked;
      const containingOwner = ownedCanvasNodes(nextPage.nodes).find(candidate => candidate.instanceEdits?.additions.some(item=>item.node.id===ownerId));
      if (containingOwner) {
        if (ownerFor(node.parentId) !== containingOwner.id) throw new Error("暂不支持跨独立引用实例移动节点。");
        containingOwner.instanceEdits!.additions.find(item=>item.node.id===ownerId)!.parent=addressFor(node.parentId!,containingOwner.id);
      }
      const canonicalNode = nextPage.nodes.find(n => n.id === ownerId);
      if (canonicalNode) canonicalNode.parentId = node.parentId;
    }
  }
  // Persist local ordering with scoped sibling anchors; source siblings retain definition order.
  for (const owner of ownedCanvasNodes(nextPage.nodes)) if (owner.instanceEdits) for (const addition of owner.instanceEdits.additions) {
    const shown = after.nodes.find(node => node.id === addition.node.id);
    if (!shown) continue;
    const siblings = after.nodes.filter(node => node.parentId === shown.parentId);
    const anchor = siblings[siblings.findIndex(node => node.id === shown.id) + 1];
    const previous = before.nodes.filter(node => node.parentId === shown.parentId).map(node => node.id);
    if (!equal(previous, siblings.map(node => node.id)) || !oldAddition(document, owner.id, addition.node.id)) addition.before = anchor ? addressFor(anchor.id, owner.id) : undefined;
  }
  nextPage.nodes.sort((a,b) => after.nodes.findIndex(n => n.id === a.id) - after.nodes.findIndex(n => n.id === b.id));
  const validation = validateGameFlowDocument(nextDocument);
  if (!validation.ok) throw new Error(validation.errors.join("；"));
  const composedAfter = composeCanvasPage(nextDocument, nextPage, sources);
  for (const [id, issue] of composedAfter.errors) if ((issue.includes("循环") || issue.includes("超过")) && composition.errors.get(id) !== issue) throw new Error(issue);
  return nextDocument;
}
function oldAddition(document: GameFlowDocument, ownerId: string, id: string) { return findOwnedCanvasNode(document, ownerId)?.instanceEdits?.additions.find(item => item.node.id === id); }

/** Materialize one owned reference without persisting composed display identities. */
export function unbindCanvasInstance(document: GameFlowDocument, pageId: string, sources: CanvasSources, id: string, recursive: boolean, makeId: () => string): GameFlowDocument {
  const composition = composeCanvasPage(document, document.pages.find(page => page.id === pageId)!, sources);
  const root = composition.page.nodes.find(node => node.id === id), meta = composition.info.get(id);
  if (!root || !meta?.reference || meta.inherited || inheritedFlag(composition.page, root, "locked")) throw new Error("请选择未锁定的本地原型组件引用根。");
  const subtree = descendants(composition.page, id);
  if ([...composition.errors.keys()].some(key => subtree.has(key)) || composition.orphans.some(orphan => subtree.has(orphan.ownerId))) throw new Error("请先修复源组件或失效的实例编辑，再解除绑定。");
  const info = new Map(composition.info);
  for (const key of subtree) if (recursive || key === id) info.delete(key);
  const snapshot = copyCanvasSelection(document, { ...composition, info }, [id]);
  if (!snapshot) return document;
  const mapping = new Map(ownedCanvasNodes(snapshot.nodes).map(node => [node.id, node.id === id ? id : makeId()]));
  const nodes = snapshot.nodes.map(node => remapControlReferences(remapCanvasEdits({ ...node, id: mapping.get(node.id)!, parentId: node.id === id ? root.parentId : mapping.get(node.parentId!) }, mapping), mapping));
  nodes[0].frame = structuredClone(root.frame);
  const next = structuredClone(document), page = next.pages.find(page => page.id === pageId)!;
  const replace = page.nodes.findIndex(node => node.id === id);
  if (replace < 0) throw new Error("暂不支持解除附加实例的绑定。");
  next.schemaVersion = GAMEFLOW_SCHEMA_VERSION;
  page.nodes.splice(replace, 1, ...nodes);
  const validation = validateGameFlowDocument(next);
  if (!validation.ok) throw new Error(validation.errors.join("\n"));
  return next;
}

/** Ordinary inherited selections become snapshots; reference boundaries retain linked definitions. */
export function copyCanvasSelection(document: GameFlowDocument, composition: CanvasComposition, ids: string[], resourceSizes?: ResourceSizes): NodeClipboard | null {
  const clipboard = copySelection(composition.page, ids, resourceSizes);
  if (!clipboard) return null;
  const selected = new Set(clipboard.nodes.map(node => node.id)), removed = new Set<string>();
  for (const node of clipboard.nodes) {
    for (const ref of [node.widget?.skinNodeId, node.widget?.textLabelNodeId, ...node.widget?.optionNodeIds ?? []]) if (ref && !selected.has(ref)) throw new Error("复制范围与外部节点之间存在控件引用，请一并复制或解除绑定。");
  }
  clipboard.nodes = clipboard.nodes.flatMap(node => {
    if (removed.has(node.id)) return [];
    const meta = composition.info.get(node.id);
    if (!meta?.reference || !meta.stored) return [node];
    for (const id of descendants(composition.page,node.id)) if (id !== node.id) removed.add(id);
    let linked = structuredClone(!meta.inherited ? findOwnedCanvasNode(document,node.id) ?? meta.stored : meta.stored);
    linked.id=node.id; linked.parentId=node.parentId; linked.frame=node.frame;
    linked.prefab={...meta.reference,source:meta.source};
    if(meta.inherited && meta.ownerId) {
      const owner=findOwnedCanvasNode(document,meta.ownerId), prefix=meta.target.path;
      const inside=(target:CanvasTarget)=>target.path.length>=prefix.length && sameTarget({path:target.path.slice(0,prefix.length)},{path:prefix});
      const rebaseTarget=(target:CanvasTarget):CanvasTarget=>inside(target)?{path:target.path.slice(prefix.length)}:target;
      const rebaseValue=(value:unknown):unknown=>Array.isArray(value)?value.map(rebaseValue):value && typeof value === "object" && "canvasTarget" in value ? {canvasTarget:rebaseTarget((value as {canvasTarget:CanvasTarget}).canvasTarget)} : value;
      for(const patch of owner?.instanceEdits?.overrides??[])if(inside(patch.target)) {
        const target={path:patch.target.path.slice(prefix.length)};
        for(const field of [...Object.keys(patch.set),...patch.unset]) {
          if(!target.path.length && nativeRoot(field)) linked=writeProperty(linked,field,patch.set[field],patch.unset.includes(field));
          else setOverride(linked,target,field,rebaseValue(patch.set[field]),patch.unset.includes(field));
        }
      }
      const included=new Set<string>();let changed=true;
      while(changed) { changed=false;for(const addition of owner?.instanceEdits?.additions??[])if(!included.has(addition.node.id)&&(inside(addition.parent)||addition.parent.path.length===1&&addition.parent.path[0].kind==="addition"&&included.has(addition.parent.path[0].nodeId))) {included.add(addition.node.id);changed=true;} }
      for(const addition of owner?.instanceEdits?.additions??[])if(included.has(addition.node.id))editsFor(linked).additions.push({...structuredClone(addition),parent:inside(addition.parent)?{path:addition.parent.path.slice(prefix.length)}:addition.parent,before:addition.before&&inside(addition.before)?{path:addition.before.path.slice(prefix.length)}:undefined,references:addition.references?Object.fromEntries(Object.entries(addition.references).map(([key,value])=>[key,Array.isArray(value)?value.map(target=>target?rebaseTarget(target):null):rebaseTarget(value)])):undefined});
    }
    return [linked];
  });
  return clipboard;
}

export function revertCanvasProperties(document: GameFlowDocument, ownerId: string, target?: CanvasTarget, fields?: string[]): GameFlowDocument {
  const next = structuredClone(document), owner = findOwnedCanvasNode(next, ownerId);
  if (!owner?.instanceEdits) return document;
  if (owner.locked) throw new Error("实例已锁定。");
  owner.instanceEdits.overrides = owner.instanceEdits.overrides.flatMap(patch => {
    if (target && !sameTarget(target, patch.target)) return [patch];
    if (!fields) return [];
    const set = Object.fromEntries(Object.entries(patch.set).filter(([key]) => !fields.includes(key))), unset = patch.unset.filter(key => !fields.includes(key));
    return Object.keys(set).length || unset.length ? [{ ...patch, set, unset }] : [];
  });
  return next;
}

export function revertCanvasSelections(document: GameFlowDocument, ownerId: string, selections: CanvasPropertySelection[]): GameFlowDocument {
  const owner = findOwnedCanvasNode(document, ownerId);
  if (!owner || owner.locked) throw new Error("实例不存在或已锁定。");
  const selected = selectedCanvasOverrides(owner.instanceEdits?.overrides ?? [], selections);
  const next = structuredClone(document), edited = findOwnedCanvasNode(next, ownerId)!;
  edited.instanceEdits!.overrides = edited.instanceEdits!.overrides.flatMap(patch => {
    const selection = selected.find(item => sameTarget(item.target, patch.target));
    if (!selection) return [patch];
    const fields = [...Object.keys(selection.set), ...selection.unset];
    const set = Object.fromEntries(Object.entries(patch.set).filter(([field]) => !fields.includes(field))), unset = patch.unset.filter(field => !fields.includes(field));
    return Object.keys(set).length || unset.length ? [{...patch,set,unset}] : [];
  });
  return next;
}

export interface CanvasApplyRequest { pageId: string; ownerId: string; target?: CanvasTarget; fields?: string[]; selections?: CanvasPropertySelection[] }
export function canvasFingerprint(document: GameFlowDocument): string {
  const value = JSON.stringify(document); let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ value.charCodeAt(i); }
  return `${value.length}:${a >>> 0}:${b >>> 0}`;
}
export interface CanvasApplyPlan { document: GameFlowDocument; source: string; sourceDocument: GameFlowDocument; fields: string[] }
/** Always writes the directly referenced definition, including its own nested-instance overlay. */
export function planCanvasApply(document: GameFlowDocument, sources: CanvasSources, request: CanvasApplyRequest): CanvasApplyPlan {
  const containingPage = document.pages.find(page=>page.id===request.pageId);
  const owner = containingPage && findOwnedCanvasNode({...document,pages:[containingPage]}, request.ownerId);
  if (owner && containingPage) {
    const composition = composeCanvasPage(document,containingPage,sources), shown=composition.page.nodes.find(node=>node.id===owner.id);
    if (shown && inheritedFlag(composition.page,shown,"locked")) throw new Error("引用实例或其父级已锁定。");
  }
  if (!owner?.prefab || owner.locked) throw new Error("引用实例不存在或已锁定。");
  const target = findCanvasTarget(document, sources, owner.prefab);
  if (!target.page) throw new Error(target.error ?? "源组件不可用。");
  const sourceDocument = target.key ? sources[target.key]?.document : document;
  if (!sourceDocument) throw new Error("源文件不可用。");
  if (request.selections && (request.target !== undefined || request.fields !== undefined)) throw new Error("属性选择不能混用两种范围。");
  const patches = request.selections ? selectedCanvasOverrides(owner.instanceEdits?.overrides ?? [], request.selections) : owner.instanceEdits?.overrides.filter(patch => !request.target || sameTarget(patch.target, request.target)).map(patch => ({ ...patch, set: Object.fromEntries(Object.entries(patch.set).filter(([field]) => !request.fields || request.fields.includes(field))), unset: patch.unset.filter(field => !request.fields || request.fields.includes(field)) })).filter(patch => Object.keys(patch.set).length || patch.unset.length) ?? [];
  if (!patches.length) throw new Error("没有可应用的属性覆盖。");
  const sourceSources: CanvasSources = target.key ? Object.fromEntries(Object.entries(sources).map(([key,entry])=>[relativeCanvasSource(target.key,key),{...entry,source:relativeCanvasSource(target.key,key)}])) : sources;
  const sourceComposition = composeCanvasPage(sourceDocument, target.page, sourceSources);
  const locate = (address: CanvasTarget): string => {
    if (!address.path.length) {
      if (!target.page!.componentRootId) throw new Error("源画布合成根暂不支持应用，请先存为 UIBox 组件。");
      return target.page!.componentRootId;
    }
    const [first,...rest] = address.path;
    if (first.kind !== "node" || first.documentId !== sourceDocument.documentId || first.pageId !== target.page!.id) throw new Error("该属性引用了本实例附加节点，源中没有对应部件。");
    if (!rest.length && sourceComposition.page.nodes.some(node=>node.id===first.nodeId)) return first.nodeId;
    const entry = [...sourceComposition.info].find(([,meta])=>meta.ownerId===first.nodeId && sameTarget(meta.target,{path:rest}));
    if (!entry) throw new Error("源目标已删除或嵌套身份已变化。");
    return entry[0];
  };
  const remapValue = (value: unknown): unknown => Array.isArray(value) ? value.map(remapValue) : value && typeof value === "object" && "canvasTarget" in value ? locate((value as {canvasTarget:CanvasTarget}).canvasTarget) : value;
  const fields: string[] = [];
  let updatedSource = editCanvasPage(sourceDocument,target.page.id,sourceSources,page=>{
    const nodes = new Map(page.nodes.map(node=>[node.id,node]));
    for (const patch of patches) {
      const id = locate(patch.target); let node = nodes.get(id)!;
      if (!node || inheritedFlag(page,node,"locked")) throw new Error("源目标不存在或已锁定。");
      for (const field of [...Object.keys(patch.set),...patch.unset]) {
        node = writeProperty(node,field,remapValue(patch.set[field]),patch.unset.includes(field));
        fields.push(field);
      }
      nodes.set(id,node);
    }
    return {...page,nodes:[...nodes.values()]};
  });
  updatedSource = {...updatedSource,schemaVersion:GAMEFLOW_SCHEMA_VERSION};
  const validation = validateGameFlowDocument(updatedSource);
  if (!validation.ok) throw new Error(validation.errors.join("；"));
  const updated = request.selections ? revertCanvasSelections(target.key ? document : updatedSource, owner.id, request.selections) : revertCanvasProperties(target.key ? document : updatedSource, owner.id, request.target, request.fields);
  return { document: { ...updated, schemaVersion: GAMEFLOW_SCHEMA_VERSION }, source: target.key, sourceDocument: target.key ? updatedSource : updated, fields };
}

export function changeCanvasAddition(document: GameFlowDocument, ownerId: string, additionId: string, parent?: CanvasTarget): GameFlowDocument {
  const next = structuredClone(document), owner = findOwnedCanvasNode(next, ownerId);
  const addition = owner?.instanceEdits?.additions.find(item => item.node.id === additionId);
  if (!owner || !addition || owner.locked) return document;
  if (parent) {
    const seen = new Set([additionId]); let current: CanvasTarget | undefined = parent;
    while (current?.path.length === 1 && current.path[0].kind === "addition") {
      const id: string = current.path[0].nodeId;
      if (seen.has(id)) throw new Error("不能将附加节点挂接到自身或其子节点。");
      seen.add(id); current = owner.instanceEdits!.additions.find(item=>item.node.id===id)?.parent;
    }
    addition.parent = structuredClone(parent); delete addition.before;
  }
  else {
    const removed = new Set([additionId]);
    let changed = true;
    while (changed) { changed = false; for (const item of owner.instanceEdits!.additions) if (item.parent.path.length === 1 && item.parent.path[0].kind === "addition" && removed.has(item.parent.path[0].nodeId) && !removed.has(item.node.id)) { removed.add(item.node.id); changed = true; } }
    owner.instanceEdits!.additions = owner.instanceEdits!.additions.filter(item => !removed.has(item.node.id));
  }
  return next;
}

/** Extract an owned local UIBox through the same composition/persistence boundary. */
export function extractCanvasSelection(document: GameFlowDocument, pageId: string, sources: CanvasSources, id: string, makeId: () => string, resourceSizes?: ResourceSizes): GameFlowDocument {
  const page = document.pages.find(page=>page.id===pageId);
  if (!page) throw new Error("页面不存在。");
  const composition = composeCanvasPage(document,page,sources), meta=composition.info.get(id);
  if (meta?.inherited || meta?.reference) throw new Error("源节点和引用实例不能存到画布。");
  if (!meta?.ownerId) return extractCanvasComponent(document,pageId,id,makeId,resourceSizes);
  const snapshot = copyCanvasSelection(document,composition,[id],resourceSizes);
  if (!snapshot) throw new Error("节点不存在。");
  // Keep linked nested references atomic; source-derived children remain in their definition.
  const localPage = {...page,nodes:snapshot.nodes.map(node=>node.id===id ? {...node,parentId:undefined} : node),componentRootId:undefined};
  const extracted = extractCanvasComponent({...document,pages:[...document.pages.filter(p=>p.id!==pageId),localPage]},pageId,id,makeId,resourceSizes);
  const component = extracted.pages.at(-1)!;
  const instance = extracted.pages.find(p=>p.id===pageId)!.nodes.find(node=>node.id===id)!;
  const removed = descendants(composition.page,id);
  const withSource = {...document,pages:[...document.pages,component]};
  return editCanvasPage(withSource,pageId,sources,current=>({...current,nodes:current.nodes.filter(node=>!removed.has(node.id)||node.id===id).map(node=>node.id===id?{...instance,parentId:current.nodes.find(n=>n.id===id)!.parentId}:node)}));
}

function relativeCanvasSource(from: string, to: string): string {
  const base=from.split("/").slice(0,-1), destination=to.split("/");
  while(base.length && destination.length && base[0]===destination[0]) {base.shift();destination.shift();}
  return [...base.map(()=>".."),...destination].join("/");
}

export function copyCanvasOrphan(document: GameFlowDocument, orphan: CanvasOrphan): NodeClipboard | null {
  const owner=findOwnedCanvasNode(document,orphan.ownerId), additions=owner?.instanceEdits?.additions ?? [];
  const root=additions.find(item=>item.node.id===orphan.additionId);
  if (!root) return null;
  const included=new Set([root.node.id]); let changed=true;
  while(changed) { changed=false; for(const item of additions) if(item.parent.path.length===1 && item.parent.path[0].kind==="addition" && included.has(item.parent.path[0].nodeId) && !included.has(item.node.id)) {included.add(item.node.id);changed=true;} }
  const reference=(target:CanvasTarget):string=> {
    if(target.path.length!==1 || target.path[0].kind!=="addition" || !included.has(target.path[0].nodeId)) throw new Error("附加内容与复制范围外存在控件引用，请先重新挂接或解除绑定。");
    return target.path[0].nodeId;
  };
  const nodes=additions.filter(item=>included.has(item.node.id)).map(item=>{
    let node: GameFlowNode={...structuredClone(item.node),parentId:item.node.id===root.node.id?undefined:item.parent.path.at(-1)?.nodeId};
    for(const [field,value] of Object.entries(item.references??{})) node=writeProperty(node,field,Array.isArray(value)?value.map(target=>target?reference(target):null):reference(value));
    return node;
  });
  return {rootId:root.node.id,nodes};
}
