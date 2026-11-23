import { absoluteFrame, inheritedFlag, makeNode, orderedNodes, removeNode, reparentNode } from "./editor-ops";
import type { Frame, GameFlowPage, NodeType } from "./model";
import { resolvePageLayout } from "./ui-layout";
import { COMPONENTS, COMPONENT_TYPES } from "./ui-components";
import { prototypeLayerRef } from "./psd-prototype";
import { identityProblems, type PsdAsset, type PsdLayer } from "./psd-meta";
import { psdSlotField } from "./psd-slot-markers";

export interface SyncNode {
  id: string; name: string; type: NodeType; parent: string; text: string; frame: Frame;
  variable?: string; layer?: string; undecided?: Field[];
  x?: number; y?: number; width?: number; height?: number;
}
export interface SyncBase { version: 1; documentId: string; pageId: string; psdId: string; nodes: SyncNode[] }
export type Side = "proto" | "psd";
export type Decision = Side | "skip";
export const frameFields = ["x","y","width","height"] as const;
export type Field = "exist" | "text" | "name" | "parent" | "order" | keyof Frame;
export interface Change { key: string; id: string; field: Field; kind: "add" | "delete" | "edit"; suggested?: Decision; members: string[] }
export interface Comparison { proto: SyncNode[]; psd: SyncNode[]; base?: SyncBase; changes: Change[] }
export const fieldNames: Record<Field,string> = { exist:"控件结构", name:"节点名称", text:"文字内容", parent:"父节点", order:"同级顺序", x:"横坐标", y:"纵坐标", width:"宽度", height:"高度" };

export function validSyncBase(value: unknown): value is SyncBase {
  if (!value || typeof value !== "object") return false;
  const b = value as SyncBase;
  if (b.version !== 1 || ![b.documentId,b.pageId,b.psdId].every(v => typeof v === "string" && v.length) || !Array.isArray(b.nodes)) return false;
  const ids = new Set<string>();
  return b.nodes.every(n => n && typeof n.id === "string" && !!n.id && !ids.has(n.id) && ids.add(n.id) &&
    COMPONENT_TYPES.includes(n.type) && [n.name,n.parent,n.text].every(v => typeof v === "string") &&
    (n.layer === undefined || typeof n.layer === "string") && (n.variable === undefined || typeof n.variable === "string") &&
    frameFields.every(f=>n[f]===undefined || Number.isFinite(n[f])) &&
    (n.undecided === undefined || Array.isArray(n.undecided) && n.undecided.every(f=>["text","name","parent","order",...frameFields].includes(f))) &&
    n.frame && [n.frame.x,n.frame.y,n.frame.width,n.frame.height].every(Number.isFinite));
}
export function prototypeTree(page: GameFlowPage): SyncNode[] {
  const geometry=resolvePageLayout(page);
  return orderedNodes(page).map(n => ({ id:n.id, name:n.name, type:n.type, parent:n.parentId ?? "", text:n.text ?? "",
    frame:geometry.nodes.get(n.id)?.absolute??n.frame, variable:n.variableName }));
}
export function currentSyncBase(docId:string, page:GameFlowPage, asset:PsdAsset) {
  const base = page.psdSync;
  return base?.documentId === docId && base.pageId === page.id && base.psdId === asset.documentId ? base : undefined;
}
export function psdTree(docId:string, page:GameFlowPage, asset:PsdAsset, makeId:(layer:PsdLayer)=>string, pairs:ReadonlyMap<string,string> = new Map()): SyncNode[] {
  if (identityProblems(asset).length) throw new Error("PSD 图层身份重复，请先在切图编辑器中修复。");
  const base = currentSyncBase(docId,page,asset);
  const result:SyncNode[] = [], seen = new Set<string>();
  function walk(parentKey:number|null, parent:string, parentType?:NodeType) {
    // PSD records arrive front-to-back. Prototype siblings are painted back-to-front.
    for (const layer of asset.layers.filter(l=>l.parentKey===parentKey).reverse()) {
      if (psdSlotField(layer.name)) continue;
      const ref = layer.metadata.prototype;
      if (prototypeLayerRef(ref) && (ref.documentId!==docId || ref.pageId!==page.id || ref.slot && ref.slot!=="image")) continue;
      if (prototypeLayerRef(ref) && ref.nodeId===page.id && layer.group) {walk(layer.key,"");continue;}
      const saved = base?.nodes.find(n=>n.layer===layer.metadata.layerId);
      const paired = pairs.get(layer.metadata.layerId);
      const id = paired ?? saved?.id ?? (prototypeLayerRef(ref) ? ref.nodeId : undefined);
      const proto = page.nodes.find(n=>n.id===id);
      const annotation = layer.name.match(/\s*\((UI\w+)\)$/);
      const tagged = COMPONENT_TYPES.find(type=>COMPONENTS[type].laya===annotation?.[1]);
      const type = proto?.type ?? saved?.type ?? tagged ?? (layer.text && (id || parentType==="button") ? "text" : undefined);
      if (!type || !(id || tagged || layer.text && parentType==="button")) continue;
      const nodeId = id ?? makeId(layer);
      if (seen.has(nodeId)) throw new Error("多个 PSD 图层对应同一控件，请检查 " + layer.name);
      seen.add(nodeId);
      const name = tagged ? layer.name.slice(0,annotation!.index).trim() : layer.name;
      result.push({ id:nodeId, name, type, parent, text:layer.textContent ?? "", layer:layer.metadata.layerId,
        variable:proto?.variableName, frame:{x:layer.left,y:layer.top,width:Math.max(1,layer.width),height:Math.max(1,layer.height)} });
      if (layer.group && COMPONENTS[type].children) walk(layer.key,nodeId,type);
    }
  }
  walk(null,"");
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
export function compareTrees(proto:SyncNode[], psd:SyncNode[], base?:SyncBase, compareInitialOrder=false): Comparison {
  const changes:Change[] = [], bundled = new Set<string>();
  const maps = [proto,psd,base?.nodes ?? []].map(tree=>new Map(tree.map(n=>[n.id,n])));
  const [p,a,b] = maps;
  const all = new Set([...p.keys(),...a.keys(),...b.keys()]);
  const order = (tree:SyncNode[], n:SyncNode) => {
    const members=base?maps:[p,a];
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
      if (field!=="order" && frameFields.some(f=>f===field) && (left[field]===undefined || right[field]===undefined || left.parent!==right.parent)) continue;
      if (field==="order" && ((!old && (!compareInitialOrder || base)) || left.parent!==right.parent || old && old.parent!==left.parent)) continue;
      const l=field==="order"?order(proto,left):left[field], r=field==="order"?order(psd,right):right[field];
      if (l===r) continue;
      const o=old && (field==="order"?order(base!.nodes,old):old[field]);
      changes.push({id,key:id+"/"+field,field,kind:"edit",members:[id],suggested:old?.undecided?.includes(field)?undefined:l===o?"psd":r===o?"proto":undefined});
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
export function plannedTrees(c:Comparison, decisions:Record<string,Decision>) {
  const trees={proto:c.proto.map(n=>({...n})),psd:c.psd.map(n=>({...n}))};
  for (const change of c.changes) {
    const side=decisions[change.key];
    if (!side || side==="skip") continue;
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
        } else Object.assign(target[index],{[change.field]:from[change.field]});
      }
    }
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
export function applyPrototypeTree(page:GameFlowPage, tree:SyncNode[]):GameFlowPage {
  let next=page;
  const ids=new Set(tree.map(n=>n.id));
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
    if (node.name===n.name && (!hasText || (node.text??"")===n.text)) return;
    if (inheritedFlag(next,node,"locked")) throw new Error("控件已锁定："+n.name);
    next={...next,nodes:next.nodes.map(item=>item.id===n.id?{...item,name:n.name,...(hasText?{text:n.text}:{})}:item)};
  }
  tree.forEach(write);
  for (const n of next.nodes) if (!ids.has(n.id)) {
    if (n.id===page.componentRootId || inheritedFlag(next,n,"locked")) throw new Error("无法删除根节点或锁定控件："+n.name);
    next=removeNode(next,n.id);
  }
  const byId=new Map(next.nodes.map(n=>[n.id,n]));
  return {...next,nodes:tree.map(n=>byId.get(n.id)!)};
}
export function coordinatedBase(docId:string,pageId:string,psdId:string,c:Comparison,trees:{proto:SyncNode[];psd:SyncNode[]}):SyncBase {
  const nodes:SyncNode[]=[];
  for (const node of trees.proto) {
    const art=trees.psd.find(a=>a.id===node.id), old=c.base?.nodes.find(n=>n.id===node.id);
    if (!art) {if(old) nodes.push(old);continue;}
    const baseline:SyncNode={...node,layer:art.layer};
    for (const field of ["text","name","parent",...frameFields] as const) if(node[field]!==art[field]) {
      if(old) Object.assign(baseline,{[field]:old[field]});
      if(!old || old.undecided?.includes(field)) (baseline.undecided??=[]).push(field);
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
