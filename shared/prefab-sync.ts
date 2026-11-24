import type { CanvasReference, Frame, GameFlowDocument, GameFlowPage } from "./model";
import { allocateElementId, reserveDocumentElementIds } from "./element-id";
import { inheritedFlag, makeNode } from "./editor-ops";
import { COMPONENTS, COMPONENT_TYPES, pageRootType } from "./ui-components";
import { applyPrototypeTree, compareTrees, coordinatedBase, frameFields, plannedTrees, prototypeTree, type Decision, type SyncNode } from "./page-sync";
import { type PrefabExportBatch, type PrefabMetadataReview, referencedCellUuids, resourceUrl } from "./prefab-export";
import { applyNodeProperty, applyNodeRecordProperty, applyPageProperty, applyRootRecordProperty, prefabPropertyNames, prototypeNodeProperties, prototypePageProperties, recordNodeProperties, recordPageProperties, sameSyncProperty } from "./prefab-sync-properties";
import { variableNameError } from "./node-variable";
import { isSliceResourcePath } from "./slice-resources";
import { builtinPath } from "./builtin-image";

type RecordNode = Record<string,unknown>;
export type PrefabBase = NonNullable<GameFlowPage["prefabSync"]>;
export const prefabTarget = (target:{name:string;directory?:string}) => [target.directory,target.name].filter(Boolean).join("/");
const record = (o:unknown):o is RecordNode => !!o && typeof o==="object" && !Array.isArray(o);
function children(node:RecordNode):RecordNode[] {
  if (node._$child===undefined) return [];
  if (!Array.isArray(node._$child) || !node._$child.every(record)) throw new Error("预制体子节点格式无效："+node.name);
  return node._$child;
}
function walk(node:RecordNode, visit:(node:RecordNode)=>void) {
  visit(node);
  children(node).forEach(child=>walk(child,visit));
}
const free = (o:RecordNode) => ["left","right","top","bottom","centerX","centerY"].every(k=>o[k]==null) && o.widthMode!=="measured" && o.heightMode!=="measured";
function prototypeNodes(page:GameFlowPage) {
  const raw=new Map(page.nodes.map(node=>[node.id,node]));
  const nodes=prototypeTree(page).map(n=>{
    const node=raw.get(n.id)!;
    const parent=raw.get(n.parent);
    return {...n,properties:prototypeNodeProperties(node),...(free({...node.layout}) && !["hbox","vbox","grid","list"].includes(parent?.type??"")?node.frame:{})};
  });
  return [{id:page.id,name:page.name,type:"container" as const,parent:"",text:"",frame:{...page.frame},root:true,layer:page.id,properties:prototypePageProperties(page)},...nodes];
}
export const prefabChangeName = (change:{field:string;property?:string}) => change.field==="property" ? prefabPropertyNames[change.property??""]??change.property??"属性" : undefined;
export function initialPrefabBase(document:GameFlowDocument,page:GameFlowPage,target:string):PrefabBase {
  return {version:1,documentId:document.documentId,pageId:page.id,target,nodes:prototypeNodes(page).map(n=>({...n,layer:n.id}))};
}

function baseSignature(base:PrefabBase | undefined) {
  return JSON.stringify(base, (_key, value:unknown) => {
    if (!record(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key,value[key]]));
  });
}

export function inspectPrefab(document:GameFlowDocument,page:GameFlowPage,target:string,root:RecordNode,metadata?:PrefabMetadataReview, cellReferences: ReadonlyMap<string,CanvasReference> = new Map(), mode:PrefabSyncMode="review") {
  if (root._$id!==page.id || root._$type!==pageRootType(page)) throw new Error("目标文件的页面身份或根类型不匹配，请检查导出名称和目标文件。");
  const saved=page.prefabSync;
  const base=saved?.documentId===document.documentId && saved.pageId===page.id && saved.target===target ? {...saved,psdId:target} : undefined;
  const proto=prototypeNodes(page), originals=new Map<string,RecordNode>(), allIds=new Set<string>();
  const known=new Map(base?.nodes.map(n=>[n.layer??n.id,n]));
  const protoIds=new Map(proto.map(n=>[n.id,n]));
  const reserved=new Set([...protoIds.keys(),...(base?.nodes.map(n=>n.id)??[])]);
  reserveDocumentElementIds(document,reserved);
  walk(root,node=>{
    if (typeof node._$id!=="string") return;
    if (allIds.has(node._$id)) throw new Error("预制体节点 ID 重复："+node._$id);
    allIds.add(node._$id);
  });
  const nativeIds=new Map<string,string>([[page.id,String(root._$id)]]), tree:SyncNode[]=[{id:page.id,name:page.name,type:"container",parent:"",text:"",frame:{...page.frame},root:true,layer:String(root._$id),properties:recordPageProperties(page,root)}];
  function read(parentRecord:RecordNode,parent:string,origin:Frame) {
    for (const child of children(parentRecord)) {
      const external=child._$id;
      const previous=typeof external==="string"?known.get(external):undefined;
      const existing=protoIds.get(previous?.id??String(external));
      const type=child._$prefab || child._$override ? undefined : COMPONENT_TYPES.find(t=>COMPONENTS[t].laya===child._$type);
      if (!type) {
        if (existing || previous) throw new Error("已关联节点类型已改变："+child.name);
        continue;
      }
      if (typeof external!=="string" || !external) throw new Error("控件缺少稳定 ID："+child.name);
      let id=previous?.id ?? existing?.id;
      if (!id) id=/^[a-z0-9]{8}$/.test(external) && !reserved.has(external)?external:allocateElementId(reserved);
      if (originals.has(id)) throw new Error("多个预制体控件对应原型节点："+id);
      reserved.add(id); nativeIds.set(id,external); originals.set(id,child);
      const nodeType=existing?.type ?? previous?.type ?? type;
      if (COMPONENTS[nodeType].laya!==child._$type) throw new Error("控件类型已改变："+child.name);
      const defaults=makeNode(nodeType,id,0,0).frame, local={...defaults,x:0,y:0};
      for (const key of frameFields) if (typeof child[key]==="number" && Number.isFinite(child[key])) local[key]=child[key];
      const frame={...local,x:origin.x+local.x,y:origin.y+local.y};
      const variable=typeof child.name==="string" && child._$var===true && !variableNameError(child.name)?child.name:undefined;
      const name=child._$var || existing?.variable ? existing?.name??previous?.name??String(child.name??child._$type) : String(child.name??child._$type);
      const simple=free(child) && !["UIHBox","UIVBox","UIGrid","UIList"].includes(String(parentRecord._$type)) && local.width>0 && local.height>0;
      frame.width=Math.max(1,frame.width);frame.height=Math.max(1,frame.height);
      const bounds:Partial<Frame>=simple?{x:local.x,y:local.y}:{};
      if(simple && typeof child.width==="number") bounds.width=local.width;
      if(simple && typeof child.height==="number") bounds.height=local.height;
      tree.push({id,type:nodeType,name,parent,frame,text:(nodeType==="text" || nodeType==="input") && typeof child.text==="string"?child.text:"",variable,layer:external,...bounds});
      read(child,id,frame);
    }
  }
  read(root,"",{x:0,y:0,width:0,height:0});
  const logicalIds=new Map([...nativeIds].map(([id,external])=>[external,id]));
  const resolveRef=(value:unknown)=>record(value)&&typeof value._$ref==="string"?logicalIds.get(value._$ref)??null:null;
  for(const node of tree) if(!node.root) {
    node.properties=recordNodeProperties(node.type,originals.get(node.id)!,resolveRef);
    const cell = node.properties.cellPrefab;
    if (cell && typeof cell === "object" && "uuid" in cell && typeof cell.uuid === "string") {
      const reference = cellReferences.get(cell.uuid);
      if (reference) node.properties.cellPrefab = {source:reference.source,documentId:reference.documentId,pageId:reference.pageId};
    }
    const variable=node.properties.variableName;
    node.variable=typeof variable==="string"&&variable?variable:undefined;
  }
  const comparison=compareTrees(proto,tree,base,true,mode!=="review");
  if(mode==="art") {
    // Keep Laya-only settings when the source is a PSD layer tree.
    comparison.changes=comparison.changes.filter(ch=>ch.field!=="property" || ch.property==="hidden" || ch.property==="page.width" || ch.property==="page.height");
  }
  const engine=new Map<string,{name:string;value:unknown}[]>();
  const managed=new Set(originals.values());
  for(const [id,node] of [[page.id,root] as const,...originals]) {
    const extras=children(node).filter(n=>!managed.has(n)).map(value=>({name:String(value.name??value._$type??"子节点"),value}));
    if(Array.isArray(node._$comp)) for(const component of node._$comp) extras.push({name:String(component?._$type??"组件"),value:component});
    if(extras.length) engine.set(id,extras);
  }
  return {root,comparison,originals,nativeIds,allIds,target,page,document,engine,metadata,cellReferences};
}
export type PrefabReview = ReturnType<typeof inspectPrefab>;

function projectedPage(page:GameFlowPage,tree:SyncNode[],applyLocks:boolean,beforeTree?:SyncNode[]):GameFlowPage {
  const prior=new Map(page.nodes.map(n=>[n.id,n]));
  let next=applyPrototypeTree(page,tree);
  const byId=new Map(tree.map(n=>[n.id,n]));
  const before=new Map(beforeTree?.map(n=>[n.id,n])??[]);
  const root=tree.find(n=>n.root),oldRoot=before.get(root?.id??"");
  if(root?.properties) for(const [path,value] of Object.entries(root.properties)) if(!oldRoot || !sameSyncProperty(oldRoot.properties?.[path],value)) next=applyPageProperty(next,path,value);
  return {...next,nodes:next.nodes.map(node=>{
    const n=byId.get(node.id)!,original=prior.get(node.id);
    const frame={...node.frame};
    for(const f of frameFields) if(n[f]!==undefined) frame[f]=n[f]!;
    if(applyLocks && original && inheritedFlag(page,original,"locked") && frameFields.some(f=>frame[f]!==original.frame[f])) throw new Error("控件已锁定："+original.name);
    let result={...node,frame},old=before.get(node.id);
    if(n.properties) for(const [path,value] of Object.entries(n.properties)) if(!old || !sameSyncProperty(old.properties?.[path],value)) result=applyNodeProperty(result,path,value);
    if(applyLocks && original && inheritedFlag(page,original,"locked") && result!==node && n.properties && Object.keys(n.properties).some(path=>!sameSyncProperty(old?.properties?.[path],n.properties?.[path]))) throw new Error("控件已锁定："+original.name);
    return result;
  })};
}
export function prefabPreviewPage(review:PrefabReview,tree:SyncNode[],root:RecordNode=review.root,skins:Record<string,string>={}) {
  const raws=new Map<string,RecordNode>();
  walk(root,n=>raws.set(String(n._$id),n));
  const page=projectedPage({...review.page,nodes:[],componentRootId:undefined},tree,false);
  return {...page,
    nodes:page.nodes.map(n=>{
      const source=raws.get(review.nativeIds.get(n.id)??n.id);
      if(!source) return n;
      const result={...n};
      const slot=(key:string)=>{
        const value=source[key];
        if(typeof value!=="string")return null;
        const path=skins[value]??value;
        return isSliceResourcePath(path)?{art:{path}}:null;
      };
      if(n.type==="image") result.image=slot("skin");
      if(n.type==="button") for(const key of ["normalSkin","selectedSkin","disabledSkin"] as const) result[key]=slot(key);
      return result;
    })};
}

export type PrefabSyncMode = "review" | "push" | "pull" | "art";
export function mergePrefab(review:PrefabReview,decisions:Record<string,Decision>,batch:PrefabExportBatch,mode:PrefabSyncMode="review") {
  const {comparison:c,page,originals,nativeIds}=review;
  const trees=plannedTrees(c,decisions,mode==="review"?undefined:mode==="pull"?"psd":"proto");
  const rawIds=new Map(nativeIds);
  const exported=new Map<string,RecordNode>();
  walk(batch.prefab,node=>exported.set(String(node._$id),node));
  const added=new Set<string>();
  for(const node of trees.psd) if(!node.root && !originals.has(node.id)) {
    if(review.allIds.has(node.id)) throw new Error("新增控件的 ID 已在预制体内使用："+node.name);
    added.add(node.id); rawIds.set(node.id,node.id);
  }
  const kept=new Set(trees.psd.map(n=>n.id));
  const refs=new Set<string>(), neededUrls=new Set<string>();
  const imageByUrl=new Map(batch.images.map(image=>[resourceUrl(image.path),image.path]));
  function remapNew(value:unknown,key=""):unknown {
    if (Array.isArray(value)) return value.map(v=>remapNew(v));
    if (record(value)) return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remapNew(v,k)]));
    if(typeof value==="string") {
      if(key==="_$ref") {
        if(!kept.has(value)) throw new Error("新增控件引用的节点尚未同步："+value);
        return rawIds.get(value)??value;
      }
      if(["skin","normalSkin","selectedSkin","disabledSkin"].includes(key)) neededUrls.add(value);
    }
    return value;
  }
  const logicalId=new Map([...originals].map(([id,source])=>[source,id]));
  const current=new Map(c.psd.map(n=>[n.id,n]));
  const externalId=(id:string)=>{const external=rawIds.get(id);if(!external)throw new Error("请同时同步控件引用的节点："+id);return external;};
  function build(n:SyncNode):RecordNode {
    const source=originals.get(n.id);
    let node:RecordNode;
    if(source) {
      node={...source};
      const before=current.get(n.id)!;
      if(before.name!==n.name && !node._$var) node.name=n.name;
      if(before.text!==n.text) node.text=n.text;
      for(const f of frameFields) if(n[f]!==undefined && before[f]!==n[f]) node[f]=n[f];
      for(const [path,value] of Object.entries(n.properties??{})) if(!sameSyncProperty(before.properties?.[path],value)) {
        if (path === "cellPrefab") {
          const binding = exported.get(n.id)?.cellPrefab;
          if (binding) node.cellPrefab = binding;
          else delete node.cellPrefab;
        } else applyNodeRecordProperty(node,n.type,n.name,path,value,externalId);
      }
      const generated=exported.get(n.id);
      for(const key of ["skin","normalSkin","selectedSkin","disabledSkin"]) {
        const planned=generated?.[key];
        if(typeof planned!=="string") continue;
        const path=imageByUrl.get(planned);
        const meta=path && review.metadata?.images[path];
        if(mode==="push" || mode==="art") {
          if(mode==="art" && !planned) continue;
          const desired=meta ? "res://"+meta.uuid : planned;
          if(planned && (meta && meta.changed || node[key]!==desired)) neededUrls.add(planned);
          if(planned || node[key]!==undefined) node[key]=desired;
          continue;
        }
        if(!meta) continue;
        const url="res://"+meta.uuid;
        const legacyDefault=path===builtinPath("image/default") && review.metadata?.legacyDefaultSkins?.includes(String(node[key]));
        if(node[key]!==url && node[key]!==planned && node[key]!==path && !legacyDefault) continue;
        if(meta.changed || node[key]!==url) neededUrls.add(planned);
        node[key]=url;
      }
    } else {
      const generated=exported.get(n.id);
      if(!generated) throw new Error("缺少待新增控件："+n.name);
      const {_$child,...fields}=generated;
      node=remapNew(fields) as RecordNode;
    }
    return rebuildChildren(node,n.id,source);
  }
  function rebuildChildren(node:RecordNode,parent:string,source?:RecordNode):RecordNode {
    const desired=trees.psd.filter(n=>!n.root&&n.parent===parent), desiredIds=new Set(desired.map(n=>n.id));
    const prior=source?children(source):[], staying=new Set(prior.map(n=>logicalId.get(n)).filter(id=>id && desiredIds.has(id)));
    const output:RecordNode[]=[];
    let index=0;
    // Existing slots anchor engine-only objects. Fill each surviving UI slot in the
    // selected order, placing incoming controls before their next surviving sibling.
    for(const child of prior) {
      const id=logicalId.get(child);
      if(!id) {output.push(child);continue;}
      if(!staying.has(id)) continue;
      while(index<desired.length) {
        const n=desired[index++];output.push(build(n));
        if(staying.has(n.id)) break;
      }
    }
    while(index<desired.length) output.push(build(desired[index++]));
    if(output.length || source?._$child!==undefined) node._$child=output;
    return node;
  }
  const prefabRoot={...review.root},plannedRoot=trees.psd.find(n=>n.root),currentRoot=c.psd.find(n=>n.root);
  if(plannedRoot?.properties) for(const [path,value] of Object.entries(plannedRoot.properties)) if(!sameSyncProperty(currentRoot?.properties?.[path],value)) applyRootRecordProperty(prefabRoot,path,value);
  const prefab=rebuildChildren(prefabRoot,"",review.root);
  walk(prefab,node=>{
    if (node._$type === "UIList" && node.cellPrefab && children(node).length) throw new Error("请同时移除列表的静态子项。Laya UIList 会根据渲染项生成子节点。");
  });
  const removed=new Set<string>();
  JSON.stringify(review.root,(key,value)=>{if(key==="_$id" && typeof value==="string")removed.add(value);return value;});
  JSON.stringify(prefab,(key,value)=>{
    if(typeof value==="string") {
      if(key==="_$ref")refs.add(value);
      if(key==="_$id")removed.delete(value);
    }
    return value;
  });
  for(const ref of refs) if(removed.has(ref)) throw new Error("删除将破坏现有预制体引用："+ref+"，请先移除引用或跳过删除。");
  const proto=mode==="push" || mode==="art" ? page : projectedPage(page,trees.proto,true,c.proto);
  const oldIds=new Set(page.nodes.map(n=>n.id)), incoming=new Map([...nativeIds].map(([id,external])=>[external,id]));
  const available=new Set(proto.nodes.map(n=>n.id));
  const link=(ref:unknown)=>{
    if(!record(ref) || typeof ref._$ref!=="string")return null;
    const id=incoming.get(ref._$ref);
    if(!id || !available.has(id)) throw new Error("请同时同步控件引用的节点："+ref._$ref);
    return id;
  };
  for(const n of proto.nodes) {
    if(oldIds.has(n.id)) continue;
    const source=originals.get(n.id);
    if(!source) continue;
    if(["progress","slider","checkbox","radio"].includes(n.type) && record(source.skin) && source.skin._$ref)
      n.widget={...n.widget,skinNodeId:link(source.skin)};
    if(n.type==="combo" && record(source.textLabel) && source.textLabel._$ref)
      n.widget={...n.widget,textLabelNodeId:link(source.textLabel)};
    if(n.type==="radioGroup" && Array.isArray(source.options))
      n.widget={...n.widget,optionNodeIds:source.options.map(link)};
  }
  // Capture the resolved geometry and traversal order of the page that will be saved.
  const base=coordinatedBase(review.document.documentId,page.id,review.target,c,{proto:prototypeNodes(proto),psd:trees.psd});
  const nodes=base.nodes.map(n=>({...n,layer:rawIds.get(n.id)??n.layer??n.id}));
  const prefabSync:PrefabBase={version:1,documentId:base.documentId,pageId:page.id,target:review.target,nodes};
  const activeCells = referencedCellUuids(prefab);
  const byUuid = new Map(batch.cells?.map(cell=>[cell.uuid,cell]));
  for (const uuid of activeCells) {
    const template = byUuid.get(uuid)?.prefab;
    if (!template) continue;
    for (const nested of referencedCellUuids(template)) activeCells.add(nested);
    JSON.stringify(template,(key,value)=>{
      if (["skin","normalSkin","selectedSkin","disabledSkin"].includes(key) && imageByUrl.has(value)) neededUrls.add(value);
      return value;
    });
  }
  const cells = batch.cells?.filter(cell=>activeCells.has(cell.uuid));
  const images=batch.images.filter(image=>neededUrls.has(resourceUrl(image.path))).map(image=>{
    const meta=review.metadata?.images[image.path];
    return meta ? {...image,expectedUuid:meta.uuid} : image;
  });
  const output={...batch,prefab,images,...(cells ? {cells} : {})};
  const baseChanged=baseSignature(prefabSync)!==baseSignature(page.prefabSync);
  return {page:{...proto,prefabSync},trees,batch:output,added:[...added],baseChanged,changed:JSON.stringify(prefab)!==JSON.stringify(review.root)};
}
