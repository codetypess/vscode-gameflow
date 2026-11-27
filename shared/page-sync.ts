import { absoluteFrame, defaultStyle, descendants, inheritedFlag, makeNode, orderedNodes, removeNode, reparentNode } from "./editor-ops";
import type { CanvasComposition } from "./canvas-instances";
import type { Frame, GameFlowPage, NodeType } from "./model";
import { resolvePageLayout } from "./ui-layout";
import { COMPONENTS, COMPONENT_TYPES } from "./ui-components";
import { prototypeLayerRef } from "./psd-prototype";
import { identityProblems, isCompositeGroup, sliceLayers, type PsdAsset, type PsdLayer } from "./psd-meta";
import { psdSlotField } from "./psd-slot-markers";

export interface SyncNode {
  id: string; name: string; type: NodeType; parent: string; text: string; frame: Frame;
  variable?: string; layer?: string; psdTextSource?: string; root?: boolean; properties?: SyncProperties; undecided?: string[];
  x?: number; y?: number; width?: number; height?: number;
}
export type SyncPropertyValue = string | number | boolean | null | SyncPropertyValue[] | { [key: string]: SyncPropertyValue };
export type SyncProperties = Record<string, SyncPropertyValue>;
export interface SyncBase { version: 1; documentId: string; pageId: string; psdId: string; nodes: SyncNode[] }
export type Side = "proto" | "psd";
export type Decision = Side | "skip";
export const frameFields = ["x","y","width","height"] as const;
export type Field = "exist" | "text" | "name" | "parent" | "order" | "property" | keyof Frame;
export type PsdVisualUpdate = "psd-list-cells" | "psd-default-image";
export interface Change { key: string; id: string; field: Field; property?: string; kind: "add" | "delete" | "edit"; suggested?: Decision; replacement?: Side; representation?: "prefab-reference" | "component-root" | "psd-smart-object" | "psd-component-layers" | "psd-component-source" | PsdVisualUpdate; members: string[]; addedLayers?: string[]; componentSource?: { name: string; conflict: boolean; firstLink: boolean }; prefabImage?: { current: string; planned: string } }
export interface Comparison { proto: SyncNode[]; psd: SyncNode[]; base?: SyncBase; changes: Change[] }
export const fieldNames: Record<Field,string> = { exist:"控件结构", name:"节点名称", text:"文字内容", parent:"父节点", order:"同级顺序", property:"属性", x:"横坐标", y:"纵坐标", width:"宽度", height:"高度" };

const propertyToken = (path:string) => "property:"+path;
export function hasSyncedValue(node: SyncNode | undefined, field: Field, property?: string): boolean {
  if (!node) return false;
  if (field === "property") {
    return !!property && node.properties?.[property] !== undefined && !node.undecided?.includes(propertyToken(property));
  }
  if (node.undecided?.includes(field)) return false;
  return field === "order" || field === "exist" || node[field] !== undefined;
}
const sameValue = (left:unknown,right:unknown) => JSON.stringify(left)===JSON.stringify(right);
function validPropertyValue(value:unknown,depth=0):value is SyncPropertyValue {
  if(value===null || typeof value==="boolean" || typeof value==="string" && value.length<=10000 || typeof value==="number" && Number.isFinite(value)) return true;
  if(depth>=8) return false;
  if(Array.isArray(value)) return value.length<=1000 && value.every(item=>validPropertyValue(item,depth+1));
  return !!value && typeof value==="object" && Object.keys(value).length<=1000 && Object.entries(value).every(([key,item])=>key.length<=128 && validPropertyValue(item,depth+1));
}
function validProperties(value:unknown):value is SyncProperties {
  return !!value && typeof value==="object" && !Array.isArray(value) && Object.keys(value).length<=256 &&
    Object.entries(value).every(([key,item])=>/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(key) && validPropertyValue(item));
}

export function validSyncBase(value: unknown): value is SyncBase {
  if (!value || typeof value !== "object") return false;
  const b = value as SyncBase;
  if (b.version !== 1 || ![b.documentId,b.pageId,b.psdId].every(v => typeof v === "string" && v.length) || !Array.isArray(b.nodes)) return false;
  const ids = new Set<string>();
  return b.nodes.every(n => n && typeof n.id === "string" && !!n.id && !ids.has(n.id) && ids.add(n.id) &&
    COMPONENT_TYPES.includes(n.type) && [n.name,n.parent,n.text].every(v => typeof v === "string") &&
    (n.layer === undefined || typeof n.layer === "string") && (n.variable === undefined || typeof n.variable === "string") &&
    (n.psdTextSource === undefined || typeof n.psdTextSource === "string" && /^(?:native:[0-9]{1,10}|[a-f0-9]{64}:[0-9]+)$/.test(n.psdTextSource)) &&
    (n.root === undefined || typeof n.root === "boolean") && (n.properties === undefined || validProperties(n.properties)) &&
    frameFields.every(f=>n[f]===undefined || Number.isFinite(n[f])) &&
    (n.undecided === undefined || Array.isArray(n.undecided) && n.undecided.every(f=>typeof f==="string" && (["text","name","parent","order",...frameFields].includes(f as never) || /^property:[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(f)))) &&
    n.frame && [n.frame.x,n.frame.y,n.frame.width,n.frame.height].every(Number.isFinite));
}
export interface PsdComponentInstance { key: string; sourceName: string }
export function psdComponentInstances(composition: CanvasComposition): Map<string, PsdComponentInstance> {
  const components = new Map<string, PsdComponentInstance>();
  const inside = new Set<string>();
  for (const node of orderedNodes(composition.page)) {
    if (node.parentId && inside.has(node.parentId)) {
      inside.add(node.id);
      continue;
    }
    const item = composition.info.get(node.id);
    if (item?.reference && item.sourcePageName !== undefined && !composition.errors.has(node.id)) {
      inside.add(node.id);
      components.set(node.id, { key: JSON.stringify([item.source, item.reference.documentId, item.reference.pageId]),
        sourceName: item.sourcePageName });
    }
  }
  return components;
}
export function prototypeTree(page: GameFlowPage, components?: ReadonlyMap<string, PsdComponentInstance>): SyncNode[] {
  const geometry=resolvePageLayout(page);
  const inside = new Set<string>();
  return orderedNodes(page).filter(node => {
    const nested = node.parentId !== undefined && inside.has(node.parentId);
    if (nested || components?.has(node.id)) inside.add(node.id);
    return !nested;
  }).map(n => ({ id:n.id, name:n.name, type:n.type, parent:n.parentId ?? "", text:n.text ?? "",
    frame:geometry.nodes.get(n.id)?.absolute??n.frame, variable:n.variableName }));
}
export function currentSyncBase(docId:string, page:GameFlowPage, asset:PsdAsset) {
  const base = page.psdSync;
  return base?.documentId === docId && base.pageId === page.id && base.psdId === asset.documentId ? base : undefined;
}
export function implicitPsdComponentRoot(docId: string, page: GameFlowPage, asset: PsdAsset) {
  const root = page.nodes.find(node => node.id === page.componentRootId && node.type === "container" && !node.parentId);
  if (!root) return;
  const top = asset.layers.filter(layer => layer.parentKey === null && prototypeLayerRef(layer.metadata.prototype) &&
    layer.metadata.prototype.documentId === docId && layer.metadata.prototype.pageId === page.id);
  if (top.some(layer => prototypeLayerRef(layer.metadata.prototype) && layer.metadata.prototype.nodeId === root.id)) return;
  if (top.some(layer => layer.metadata.componentRootId === root.id) ||
      currentSyncBase(docId, page, asset)?.nodes.some(node => node.id === root.id && !node.layer)) return root;
}
export function psdTree(docId:string, page:GameFlowPage, asset:PsdAsset, makeId:(layer:PsdLayer)=>string, pairs:ReadonlyMap<string,string> = new Map(), forPrefab=false, components?: ReadonlyMap<string, PsdComponentInstance>): SyncNode[] {
  if (identityProblems(asset).length) throw new Error("PSD 图层身份重复，请先在切图编辑器中修复。");
  const base = currentSyncBase(docId,page,asset);
  const layers = sliceLayers(asset.layers);
  const layerIds = new Set(asset.layers.map(layer => layer.metadata.layerId));
  const result:SyncNode[] = [], seen = new Set<string>();
  const implicitRoot = implicitPsdComponentRoot(docId, page, asset);
  const rootNode: SyncNode | undefined = implicitRoot && { id: implicitRoot.id, name: implicitRoot.name, type: "container",
    parent: "", text: "", frame: implicitRoot.frame, variable: implicitRoot.variableName };
  const rootChildren = implicitRoot && new Set(descendants(page, implicitRoot.id));
  const previousChildren = implicitRoot && new Set(syncSubtree(base?.nodes ?? [], implicitRoot.id));
  let rootInserted = false;
  if (rootNode) seen.add(rootNode.id);
  function walk(parentKey:number|null, parent:string) {
    // PSD records arrive front-to-back. Prototype siblings are painted back-to-front.
    for (const layer of layers.filter(l=>l.parentKey===parentKey).reverse()) {
      if (layer.metadata.listCellIndex !== undefined || psdSlotField(layer.name)) continue;
      const ref = layer.metadata.prototype;
      if (prototypeLayerRef(ref) && (ref.documentId!==docId || ref.pageId!==page.id || ref.slot && ref.slot!=="image")) continue;
      if (prototypeLayerRef(ref) && ref.nodeId===page.id && layer.group) {walk(layer.key,"");continue;}
      // A Photoshop-created text layer gets a temporary GameFlow ID on each fresh read.
      let psdTextSource: string | undefined;
      if (layer.text && layer.identityOrigin === "new" && !prototypeLayerRef(ref)) {
        const uniqueNativeId = layer.nativeId !== null && !asset.layers.some(other => other !== layer && other.nativeId === layer.nativeId);
        psdTextSource = uniqueNativeId ? "native:" + layer.nativeId : asset.sourceHash + ":" + layer.key;
      }
      const saved = base?.nodes.find(n => n.layer === layer.metadata.layerId) ??
        (psdTextSource ? base?.nodes.find(n => n.psdTextSource === psdTextSource && n.layer && !layerIds.has(n.layer)) : undefined);
      const paired = pairs.get(layer.metadata.layerId);
      const annotation = layer.name.match(/\s*\((UI\w+)\)$/);
      const tagged = COMPONENT_TYPES.find(type=>COMPONENTS[type].laya===annotation?.[1]);
      const name = tagged ? layer.name.slice(0,annotation!.index).trim() : layer.name;
      const slots = forPrefab && layer.group ? layers.filter(l=>l.parentKey===layer.key).map(l=>psdSlotField(l.name)) : [];
      const standalone = !forPrefab ? undefined : slots.includes("image") ? "image" : slots.some(Boolean) ? "button" :
        layer.text ? "text" : layer.config.enabled ? "image" : undefined;
      const inferredType = isCompositeGroup(layer) ? "image" : tagged ?? standalone;
      const candidates = (forPrefab || isCompositeGroup(layer)) && inferredType ? page.nodes.filter(n=>n.name===name && n.type===inferredType) : [];
      const id = paired ?? saved?.id ?? (prototypeLayerRef(ref) ? ref.nodeId : candidates.length===1 ? candidates[0].id : undefined);
      const proto = page.nodes.find(n=>n.id===id);
      const type = proto?.type ?? saved?.type ?? inferredType ?? (layer.text ? "text" : undefined);
      if (!type) {
        if(forPrefab && layer.group) walk(layer.key,parent);
        continue;
      }
      const nodeId = id ?? makeId(layer);
      if (seen.has(nodeId)) throw new Error("多个 PSD 图层对应同一控件，请检查 " + layer.name);
      seen.add(nodeId);
      const belongsToRoot = rootNode && parentKey === null && (layer.metadata.componentRootId === rootNode.id ||
        (proto ? rootChildren?.has(proto.id) : saved ? previousChildren?.has(saved.id) : true));
      if (belongsToRoot && !rootInserted) { result.push(rootNode); rootInserted = true; }
      const effectiveParent = belongsToRoot ? rootNode.id : parent;
      result.push({ id:nodeId, name, type, parent:effectiveParent, text:layer.textContent ?? "", layer:layer.metadata.layerId,
        ...(psdTextSource && { psdTextSource }),
        variable:proto?.variableName, frame:{x:layer.left,y:layer.top,width:Math.max(1,layer.width),height:Math.max(1,layer.height)} });
      if (layer.group && COMPONENTS[type].children && !components?.has(nodeId)) walk(layer.key,nodeId);
    }
  }
  walk(null,"");
  if (rootNode && !rootInserted) result.unshift(rootNode);
  return result;
}
export function syncSubtree(tree:SyncNode[], id:string): string[] {
  const result = new Set([id]);
  for (let size = 0; size !== result.size;) {
    size = result.size;
    for (const n of tree) if (result.has(n.parent)) result.add(n.id);
  }
  return [...result];
}

/** Project PSD canvas pixels into the destination control's local font-size units. */
export function psdTreeWithFontSizes(page: GameFlowPage, art: SyncNode[], asset: PsdAsset): SyncNode[] {
  const layout = resolvePageLayout(page);
  const layers = new Map(asset.layers.map(layer => [layer.metadata.layerId, layer]));
  const controls = new Map(page.nodes.map(node => [node.id, node]));
  const scales = new Map<string, number>();
  return art.map(node => {
    const matrix = layout.nodes.get(node.id)?.matrix;
    // New controls have no local transform and inherit the scale of their planned parent.
    const scale = matrix ? Math.hypot(matrix[0], matrix[1]) : scales.get(node.parent) ?? 1;
    scales.set(node.id, scale);
    const pixels = node.layer ? layers.get(node.layer)?.textFontSize : undefined;
    if ((node.type !== "text" && node.type !== "input") || typeof pixels !== "number" || !scale) return node;
    const local = pixels / scale;
    if (!Number.isFinite(local) || local <= 0) return node;
    const current = controls.get(node.id)?.style?.fontSize;
    const size = current !== undefined && Math.abs(current - local) < 0.0001 ? current : Math.max(1, Number(local.toFixed(4)));
    return { ...node, properties: { "style.fontSize": size } };
  });
}

export function comparePagePsd(page: GameFlowPage, proto: SyncNode[], art: SyncNode[], asset: PsdAsset, base?: SyncBase, source?: Side): Comparison {
  const psd = psdTreeWithFontSizes(page, art, asset);
  const comparable = new Set(psd.filter(node => node.properties?.["style.fontSize"] !== undefined).map(node => node.id));
  const controls = new Map(page.nodes.map(node => [node.id, node]));
  const prototype = proto.map(node => {
    if (!comparable.has(node.id)) return node;
    const size = controls.get(node.id)?.style?.fontSize ?? defaultStyle(node.type).fontSize;
    return { ...node, properties: { "style.fontSize": size } };
  });
  const comparison = compareTrees(prototype, psd, base, false, !!source);
  comparison.changes = comparison.changes.filter(change => {
    if (change.property !== "style.fontSize") return true;
    change.replacement = "psd";
    return source !== "proto";
  });
  return comparison;
}
export function compareTrees(proto:SyncNode[], psd:SyncNode[], base?:SyncBase, compareInitialOrder=false, fixedDirection=false): Comparison {
  const changes:Change[] = [], bundled = new Set<string>();
  const maps = [proto,psd,base?.nodes ?? []].map(tree=>new Map(tree.map(n=>[n.id,n])));
  const [p,a,b] = maps;
  const all = new Set([...p.keys(),...a.keys(),...b.keys()]);
  const order = (tree:SyncNode[], n:SyncNode) => {
    const members=base && !fixedDirection?maps:[p,a];
    const common = tree.filter(s=>s.parent===n.parent && members.every(m=>m.get(s.id)?.parent===n.parent));
    return common.slice(0,common.findIndex(s=>s.id===n.id)).map(s=>s.id).sort().join("|");
  };
  for (const id of all) {
    const left=p.get(id), right=a.get(id), old=b.get(id);
    if (!left || !right) {
      if ((!left && !right) || bundled.has(id)) continue;
      const tree=left?proto:psd, here=(left ?? right)!;
      // A moved child present on both sides keeps its own decision.
      const members=syncSubtree(tree,id).filter(child=>!(left?a:p).has(child));
      members.forEach(child=>bundled.add(child));
      const kind=old?"delete":"add";
      const unilateral=left?"proto":"psd";
      changes.push({id,key:id+"/exist",field:"exist",kind,members,
        suggested:base && kind==="add" ? unilateral : kind==="delete" && old && here.name===old.name && here.text===old.text ? "skip" : undefined});
      continue;
    }
    if (left.type!==right.type) throw new Error("控件类型不一致，请重新确认关联："+left.name);
    for (const field of ["name","text","parent","order",...frameFields] as const) {
      if(left.root && ["parent","order",...frameFields].includes(field as never)) continue;
      if (field!=="order" && frameFields.some(f=>f===field) && (left[field]===undefined || right[field]===undefined || left.parent!==right.parent)) continue;
      if (field==="order" && (left.parent!==right.parent || !fixedDirection && ((!old && (!compareInitialOrder || base)) || old && old.parent!==left.parent))) continue;
      const l=field==="order"?order(proto,left):left[field], r=field==="order"?order(psd,right):right[field];
      if (l===r) continue;
      const o=old && (field==="order"?order(base!.nodes,old):old[field]);
      changes.push({id,key:id+"/"+field,field,kind:"edit",members:[id],suggested:!hasSyncedValue(old,field)?undefined:l===o?"psd":r===o?"proto":undefined});
    }
    const properties=new Set([...Object.keys(left.properties??{}),...Object.keys(right.properties??{}),...Object.keys(old?.properties??{})]);
    for(const property of properties) {
      const l=left.properties?.[property],r=right.properties?.[property];
      if(sameValue(l,r)) continue;
      const o=old?.properties?.[property];
      changes.push({id,key:id+"/property/"+property,field:"property",property,kind:"edit",members:[id],
        suggested:!hasSyncedValue(old,"property",property)?undefined:sameValue(l,o)?"psd":sameValue(r,o)?"proto":undefined});
    }
  }
  return {proto,psd,base,changes};
}

function insertFrom(source:SyncNode[], target:SyncNode[], node:SyncNode) {
  const siblings=source.filter(n=>n.parent===node.parent);
  const pos=siblings.findIndex(n=>n.id===node.id);
  const after=siblings.slice(pos+1).find(n=>target.some(t=>t.id===n.id && t.parent===node.parent));
  const index=after ? target.findIndex(n=>n.id===after.id) : target.length;
  target.splice(index,0,{...node});
}
export function plannedTrees(c:Comparison, decisions:Record<string,Decision>, fixedSource?:Side) {
  const clone=(n:SyncNode):SyncNode=>({...n,frame:{...n.frame},properties:n.properties?{...n.properties}:undefined,undecided:n.undecided?[...n.undecided]:undefined});
  const trees={proto:c.proto.map(clone),psd:c.psd.map(clone)};
  for (const change of c.changes) {
    const side=decisions[change.key];
    if (!side || side==="skip" || change.prefabImage || change.replacement && side!==change.replacement ||
      change.representation?.startsWith("psd-")) continue;
    const source=c[side], target=trees[side==="proto"?"psd":"proto"];
    for (const id of change.members) {
      const from=source.find(n=>n.id===id), index=target.findIndex(n=>n.id===id);
      if (change.field==="exist") {
        if (from && index<0) insertFrom(source,target,from);
        if (!from && index>=0) target.splice(index,1);
      } else if (from && index>=0) {
        if (change.field==="order" || change.field==="parent") {
          const [n]=target.splice(index,1);
          const moved={...n,parent:from.parent};
          if(change.field==="parent") {
            for(const f of ["x","y"] as const) if(from[f]!==undefined && n[f]!==undefined) moved[f]=from[f];
          }
          insertFrom(source,target,moved);
        } else if(change.field==="property" && change.property) {
          const value=from.properties?.[change.property];
          const properties={...target[index].properties};
          if(value===undefined) delete properties[change.property]; else properties[change.property]=value;
          target[index].properties=properties;
        } else if(change.field!=="property") Object.assign(target[index],{[change.field]:from[change.field]});
      }
    }
  }
  if (fixedSource) {
    const target = trees[fixedSource==="proto"?"psd":"proto"];
    const order = new Map(c[fixedSource].map((node,index)=>[node.id,index]));
    target.sort((a,b)=>order.get(a.id)!-order.get(b.id)!);
  }
  // Independent additions may target the same gap. Once both sides' nodes exist,
  // use the agreed prototype order for the new PSD slots, retaining other art layers.
  const pushed=new Set(c.changes.filter(ch=>ch.field==="exist" && decisions[ch.key]==="proto" && !c.psd.some(n=>n.id===ch.id)).flatMap(ch=>ch.members));
  for (const n of [...trees.proto].reverse()) if(pushed.has(n.id)) {
    const index=trees.psd.findIndex(p=>p.id===n.id);
    if(index>=0) insertFrom(trees.proto,trees.psd,trees.psd.splice(index,1)[0]);
  }
  for (const tree of Object.values(trees)) {
    const index=new Map(tree.map(n=>[n.id,n]));
    for (const n of tree) {
      const visited=new Set([n.id]);
      let parent=n.parent;
      while (parent) {
        if (!index.has(parent) || visited.has(parent)) throw new Error("请同时处理相关父节点的结构变更："+n.name);
        visited.add(parent); parent=index.get(parent)!.parent;
      }
    }
  }
  return trees;
}
export function applyPrototypeTree(page:GameFlowPage, tree:SyncNode[], components?: ReadonlyMap<string, PsdComponentInstance>, source?: Side):GameFlowPage {
  tree=tree.filter(n=>!n.root);
  let next=page;
  const ids=new Set(tree.map(n=>n.id));
  const componentContents = new Map<string, string[]>();
  for (const node of tree) if (components?.has(node.id)) {
    const children = [...descendants(page, node.id)].filter(id => id !== node.id && !ids.has(id));
    componentContents.set(node.id, children);
    for (const id of children) ids.add(id);
  }
  const done=new Set<string>();
  function write(n:SyncNode) {
    if (done.has(n.id)) return;
    if (n.parent) write(tree.find(p=>p.id===n.parent)!);
    done.add(n.id);
    let node=next.nodes.find(p=>p.id===n.id);
    if (!node) {
      const box=n.parent ? absoluteFrame(next,next.nodes.find(p=>p.id===n.parent)!) : {x:0,y:0};
      node={...makeNode(n.type,n.id,0,0),name:n.name,parentId:n.parent||undefined,frame:{...n.frame,x:n.frame.x-box.x,y:n.frame.y-box.y}};
      next={...next,nodes:[...next.nodes,node]};
    } else if ((node.parentId??"")!==n.parent) {
      next=reparentNode(next,n.id,n.parent||undefined);
      node=next.nodes.find(p=>p.id===n.id)!;
      if ((node.parentId??"")!==n.parent) throw new Error("无法移动控件："+n.name);
    }
    const hasText=n.type==="text" || n.type==="input";
    const size = source === "psd" && hasText ? n.properties?.["style.fontSize"] : undefined;
    const resizeText = typeof size === "number" && size !== (node.style?.fontSize ?? defaultStyle(n.type).fontSize);
    if (node.name===n.name && (!hasText || (node.text??"")===n.text) && !resizeText) return;
    if (inheritedFlag(next,node,"locked")) throw new Error("控件已锁定："+n.name);
    next={...next,nodes:next.nodes.map(item=>item.id===n.id?{...item,name:n.name,...(hasText?{text:n.text}:{}),
      ...(resizeText && { style: { ...item.style, fontSize: size } })}:item)};
  }
  tree.forEach(write);
  for (const n of next.nodes) if (!ids.has(n.id)) {
    if (n.id===page.componentRootId || inheritedFlag(next,n,"locked")) throw new Error("无法删除根节点或锁定控件："+n.name);
    next=removeNode(next,n.id);
  }
  const byId=new Map(next.nodes.map(n=>[n.id,n]));
  return {...next,nodes:tree.flatMap(n=>[n.id, ...componentContents.get(n.id) ?? []].map(id=>byId.get(id)!))};
}
export function coordinatedBase(docId:string,pageId:string,psdId:string,c:Comparison,trees:{proto:SyncNode[];psd:SyncNode[]}):SyncBase {
  const nodes:SyncNode[]=[];
  for (const node of trees.proto) {
    const art=trees.psd.find(a=>a.id===node.id), old=c.base?.nodes.find(n=>n.id===node.id);
    if (!art) {if(old) nodes.push(old);continue;}
    const baseline:SyncNode={...node,frame:{...node.frame},properties:node.properties?{...node.properties}:undefined,
      layer:art.layer, psdTextSource:art.psdTextSource};
    for (const field of ["text","name","parent",...frameFields] as const) if(node[field]!==art[field]) {
      if(old) Object.assign(baseline,{[field]:old[field]});
      if(!old || old.undecided?.includes(field)) (baseline.undecided??=[]).push(field);
    }
    const properties=new Set([...Object.keys(node.properties??{}),...Object.keys(art.properties??{}),...Object.keys(old?.properties??{})]);
    for(const property of properties) if(!sameValue(node.properties?.[property],art.properties?.[property])) {
      const token=propertyToken(property),values={...baseline.properties};
      if(old?.properties && Object.hasOwn(old.properties,property)) values[property]=old.properties[property]; else delete values[property];
      baseline.properties=Object.keys(values).length?values:undefined;
      if(!old || old.undecided?.includes(token)) (baseline.undecided??=[]).push(token);
    }
    nodes.push(baseline);
  }
  for(const old of c.base?.nodes??[]) if (!nodes.some(n=>n.id===old.id) && trees.psd.some(n=>n.id===old.id)) nodes.push(old);
  for(const ch of compareTrees(trees.proto,trees.psd,c.base,!c.base && c.changes.some(ch=>ch.field==="order")).changes.filter(ch=>ch.field==="order")) {
    const item=nodes.find(n=>n.id===ch.id);
    if(item && c.base?.nodes.some(n=>n.id===ch.id)) {
      nodes.splice(nodes.indexOf(item),1);insertFrom(c.base.nodes,nodes,item);
    } else if(item) (item.undecided??=[]).push("order");
  }
  return {version:1,documentId:docId,pageId,psdId,nodes};
}
