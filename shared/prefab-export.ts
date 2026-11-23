import type { GameFlowDocument, GameFlowNode, GameFlowPage } from "./model";
import { DEFAULT_IMAGE_ID, imageRenderSize } from "./image-rendering";
import { resolvePageLayout } from "./ui-layout";
import { COMPONENTS, pageRootType } from "./ui-components";
import { builtinImage, builtinPath, nodeImageSlot, type BuiltinImage, type ImageSlot, type ImageSlotField } from "./image-slots";
import { isSliceResourcePath, type SliceResourceDescription, type SliceResourceRef } from "./slice-resources";
import { parseResourceManifest, RESOURCE_MANIFEST, type ResourceManifest } from "./psd-export";
import { exportDirectoryError } from "./export-directory";
import { validatePng, type ExportCodec, type ResourceDirectory } from "./psd-export-directory";
import { mergeLayaMeta, resourceUuid } from "./laya-meta";
import type { NineGrid } from "./psd-meta";
import { sameGrid } from "./psd-builtin";
export { resourceUuid } from "./laya-meta";

export interface PrefabImage { path: string; base64: string; description: SliceResourceDescription; expectedUuid?:string }
export interface PrefabExportBatch { name: string; directory?: string; prefab: Record<string, unknown>; images: PrefabImage[] }
export interface PrefabTarget {name:string;directory?:string}
export interface ImageMetaTarget {path:string; nineGrid:NineGrid|null}
export interface PrefabMetadataReview {
  prefabMetaChanged: boolean;
  images: Record<string, {uuid:string; changed:boolean}>;
}
export interface PrefabSnapshot {prefab:Record<string,unknown>|null;hash:string|null;root:string;version:number;skins?:Record<string,string>;metadata?:PrefabMetadataReview}
export interface PrefabWriteGuard {hash:string|null; writePrefab:boolean; added:string[]}
export function validPrefabTarget(value:unknown):value is PrefabTarget {
  const t=value as PrefabTarget|undefined;
  return !!t && typeof t.name==="string" && /^[^\\/:*?"<>|\x00-\x1f]{1,128}\.lh$/.test(t.name) && !t.name.includes("..") && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(t.name) && !exportDirectoryError(t.directory);
}
export async function readPrefabSnapshot(directory:ResourceDirectory,target:PrefabTarget,hash:ExportCodec["hash"],resources?:ResourceDirectory,images:ImageMetaTarget[]=[]) {
  if(!validPrefabTarget(target)) throw new Error("预制体路径无效。");
  const file = [target.directory,target.name].filter(Boolean).join("/");
  const data=await directory.read(file);
  if(!data) return {prefab:null,hash:null};
  if(data.length>8*1024*1024) throw new Error("预制体超过 8 MB。");
  const prefab=JSON.parse(new TextDecoder().decode(data));
  if(!prefab || typeof prefab!=="object" || Array.isArray(prefab)) throw new Error("预制体根节点无效。");
  const skins:Record<string,string>={};
  const metadata:PrefabMetadataReview = {prefabMetaChanged:!!mergeLayaMeta(file,await directory.read(file+".meta")).bytes, images:{}};
  if(resources) {
    const needed=new Set<string>();
    JSON.stringify(prefab,(key,value)=>{
      if(["skin","normalSkin","selectedSkin","disabledSkin"].includes(key) && typeof value==="string" && value.startsWith("res://")) needed.add(value);
      return value;
    });
    const raw=needed.size || images.length ? await resources.read(RESOURCE_MANIFEST) : null;
    if(raw && raw.length>8*1024*1024) throw new Error("资源来源清单超过 8 MB。");
    const entries=raw ? parseResourceManifest(JSON.parse(new TextDecoder().decode(raw))).resources : [];
    const records=new Map(entries.map(entry=>[entry.file,entry]));
    const listings=new Map<string,Set<string>>();
    for(const image of images) {
      if(!isSliceResourcePath(image.path)) throw new Error("图片资源路径无效。");
      const slash=image.path.lastIndexOf("/"),folder=slash<0?"":image.path.slice(0,slash);
      let files=listings.get(folder);
      if(!files) {
        files=new Set(await resources.list(folder || undefined));
        listings.set(folder,files);
      }
      const meta=mergeLayaMeta(image.path,await resources.read(image.path+".meta"),image.nineGrid);
      const entry=records.get(image.path);
      const changed=!!meta.bytes || !files.has(image.path.slice(slash+1)) || !entry || !sameGrid(entry.nineGrid,image.nineGrid);
      metadata.images[image.path]={uuid:meta.uuid,changed};
      const url="res://"+meta.uuid;
      if(needed.delete(url)) skins[url]=image.path;
    }
    if(needed.size) {
      const paths=entries.map(r=>r.file).filter(p=>isSliceResourcePath(p) && !metadata.images[p]).sort((a,b)=>Number(needed.has(resourceUrl(b)))-Number(needed.has(resourceUrl(a))));
      for(let i=0;i<paths.length && needed.size;i+=16) {
        await Promise.all(paths.slice(i,i+16).map(async path=>{
          const bytes=await resources.read(path+".meta");
          if(!bytes || bytes.length>1024*1024) return;
          let meta;try {meta=JSON.parse(new TextDecoder().decode(bytes));}catch{return;}
          const url="res://"+meta?.uuid;
          if(needed.delete(url)) skins[url]=path;
        }));
      }
    }
  }
  return {prefab:prefab as Record<string,unknown>,hash:await hash(data),skins,metadata};
}
export interface MissingImage { nodeId: string; nodeName: string; slot: ImageSlotField; path: string; error: string }
export interface PrefabPlan { batch: PrefabExportBatch; missing: MissingImage[] }
export type ExportImageResolver = (ref: SliceResourceRef, render?: { builtin: BuiltinImage; width: number; height: number }) => Promise<{ status: "ready"; image: PrefabImage } | { status: "error"; error: string }>;

export const resourceUrl = (path: string) => "res://" + resourceUuid(path);
const scriptPath = (type: string) => "../src/game/app/core/ui/" + "ui-" + type.slice(2).replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() + ".ts";
export const nodeSlots = (node: GameFlowNode): [ImageSlotField, ImageSlot | null | undefined][] => node.type === "button" ? [["normalSkin",node.normalSkin],["selectedSkin",node.selectedSkin],["disabledSkin",node.disabledSkin]] : node.type === "image" ? [["image",node.image === undefined && node.sliceResource ? { art: node.sliceResource } : node.image]] : [];
export function prefabFileName(page: GameFlowPage): string {
  let name=(page.exportName ?? page.name).replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/[ .]+$/g, "").slice(0,120);
  if(!name)name="page";
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name="_"+name;
  return name+".lh";
}

export async function planPrefabExport(document: GameFlowDocument, page: GameFlowPage, resolve: ExportImageResolver): Promise<PrefabPlan> {
  const images = new Map<string,PrefabImage>(), refs = new Map<string,string>(), missing: MissingImage[] = [];
  const placeholders: {node:GameFlowNode;field:ImageSlotField;builtin:BuiltinImage}[] = [];
  for (const node of page.nodes) for (const [field,slot] of nodeSlots(node)) {
    if (!slot) continue;
    const path = slot.art?.path ?? (slot.builtin ? builtinPath(slot.builtin) : undefined);
    if (!path) continue;
    refs.set(node.id + ":" + field, path);
    if (slot.art) {
      const result = await resolve(slot.art);
      if (result.status === "error") missing.push({nodeId:node.id,nodeName:node.name,slot:field,path,error:result.error});
      else images.set(path,result.image);
    } else {
      const builtin = builtinImage(slot.builtin!);
      if (!builtin) { missing.push({nodeId:node.id,nodeName:node.name,slot:field,path,error:"内置图片不存在"}); continue; }
      if (builtin.id === DEFAULT_IMAGE_ID) { placeholders.push({node,field,builtin}); continue; }
      images.set(path,{path,base64:builtin.dataUri.split(",")[1],description:{path,width:builtin.width,height:builtin.height,nineGrid:builtin.nineGrid,source:{documentId:"gameflow-builtin",psdName:"builtin.psd",sourceHash:"0".repeat(64)},layerId:builtin.id,layerName:builtin.name,shared:true}});
    }
  }
  // Geometry follows the resources being exported, independently of the active preview mode.
  if (placeholders.length) {
    const sizes = new Map<string,{width:number;height:number}>();
    for (const node of page.nodes) {
      const slot = nodeImageSlot(node, "art"), art = slot?.art ?? (node.image === undefined ? node.sliceResource : undefined);
      const image = art ? images.get(art.path)?.description : slot?.builtin ? builtinImage(slot.builtin) : undefined;
      if (image) sizes.set("@node:" + node.id, "logicalSize" in image && image.logicalSize ? image.logicalSize : image);
    }
    const layout = resolvePageLayout(page, sizes);
    for (const {node,field,builtin} of placeholders) {
      const size = imageRenderSize(page,node,layout), path = builtinPath(builtin.id,size);
      refs.set(node.id+":"+field,path);
      if (images.has(path)) continue;
      const result = await resolve({path},{builtin,...size});
      if (result.status === "error") missing.push({nodeId:node.id,nodeName:node.name,slot:field,path,error:result.error});
      else images.set(path,result.image);
    }
  }
  // Missing references retain their portable path; successful images use importer UUIDs.
  const failed = new Set(missing.map(item=>item.path));
  const skin = (node:GameFlowNode,field:ImageSlotField) => { const path=refs.get(node.id+":"+field); return path ? failed.has(path) ? path : resourceUrl(path) : ""; };
  const nodeRecord = (node:GameFlowNode): Record<string,unknown> => {
    const type=COMPONENTS[node.type].laya, widget=node.widget ?? {}, style=node.style ?? {};
    const record:Record<string,unknown> = {"_$id":node.id,"_$type":type,name:node.variableName ?? node.name,scriptPath:scriptPath(type),...node.frame,...node.layout,...node.transform};
    if (node.variableName) record._$var=true;
    if (node.hidden) record.visible=false;
    if (style.opacity!==undefined) record.alpha=style.opacity;
    if (node.type === "image") {record.skin=skin(node,"image"); record.imageFit=widget.imageFit ?? "fill";}
    if (node.type === "button") for(const field of ["normalSkin","selectedSkin","disabledSkin"] as const) record[field]=skin(node,field);
    if (node.type === "text" || node.type === "input") {
      record.text=node.text ?? "";
      for(const key of ["fontSize","color","italic","underline","strikethrough"] as const) if(style[key]!==undefined) record[key]=style[key];
      if(style.fontWeight!==undefined) record.bold=style.fontWeight>=600;
      if(style.textAlign) record.align=style.textAlign;
      if(node.type === "text") record.wordWrap=widget.wordWrap ?? true;
    }
    for(const [key,value] of Object.entries(widget)) {
      if(["skinNodeId","optionNodeIds","textLabelNodeId"].includes(key)) continue;
      if (key === "password") record.type = value ? "password" : "text";
      else record[key==="options"?"labels":key==="placeholder"?"prompt":key]=value;
    }
    if (widget.skinNodeId) record.skin={"_$ref":widget.skinNodeId};
    if (widget.textLabelNodeId) record.textLabel={"_$ref":widget.textLabelNodeId};
    if (widget.optionNodeIds) record.options=widget.optionNodeIds.map(id=>id ? {"_$ref":id}:null);
    const children=page.nodes.filter(child=>child.parentId===node.id).map(nodeRecord);
    if(children.length) record._$child=children;
    return record;
  };
  const root=pageRootType(page);
  const prefab:Record<string,unknown>={"_$ver":1,"_$id":page.id,"_$type":root,name:page.exportName ?? page.name,scriptPath:scriptPath(root),width:page.frame.width,height:page.frame.height,...page.layout,"_$child":page.nodes.filter(node=>!node.parentId).map(nodeRecord)};
  return {batch:{name:prefabFileName(page),directory:document.exportDirectory,prefab,images:[...images.values()].filter(image=>!failed.has(image.path))},missing};
}

export function isPrefabExportBatch(value: unknown): value is PrefabExportBatch {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const batch=value as PrefabExportBatch;
  if(typeof batch.name!=="string" || !/^[^\\/:*?"<>|\x00-\x1f]{1,128}\.lh$/.test(batch.name) || batch.name.includes("..") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(batch.name) || exportDirectoryError(batch.directory) || !batch.prefab || Array.isArray(batch.prefab) || typeof batch.prefab!=="object" || !Array.isArray(batch.images) || batch.images.length>512) return false;
  let size:number; try { size=JSON.stringify(batch.prefab).length; } catch { return false; } if(size>8*1024*1024) return false;
  const paths=new Set<string>();
  return batch.images.every(image=>{
    size+=typeof image?.base64==="string"?image.base64.length:Infinity;
    if(!image || !isSliceResourcePath(image.path) || paths.has(image.path) || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64) || image.base64.length%4 || size>48*1024*1024 || image.description?.path!==image.path || (image.expectedUuid!==undefined && typeof image.expectedUuid!=="string")) return false;
    paths.add(image.path);
    try { parseResourceManifest({schema:"gameflow.resources",version:2,resources:[{...image.description,name:image.path.slice(image.path.lastIndexOf("/")+1,-4),file:image.path,sha256:"0".repeat(64)}]});return true;}catch{return false;}
  });
}

/** Older one-step callers have no review decisions. Merge generated nodes by identity
 * while keeping the existing hierarchy, engine-only children and custom properties. */
function mergeGeneratedPrefab(existing:Record<string,unknown>, generated:Record<string,unknown>) {
  type Node = Record<string,unknown>;
  const children=(node:Node):Node[]=>{
    if(node._$child===undefined) return [];
    if(!Array.isArray(node._$child) || node._$child.some(n=>!n || typeof n!=="object" || Array.isArray(n)))
      throw new Error("预制体子节点格式无效。");
    return node._$child;
  };
  function index(root:Node) {
    const nodes=new Map<string,Node>();
    const visit=(node:Node)=>{
      if(typeof node._$id==="string") {
        if(nodes.has(node._$id)) throw new Error("预制体节点 ID 重复："+node._$id);
        nodes.set(node._$id,node);
      }
      children(node).forEach(visit);
    };
    visit(root);
    return nodes;
  }
  if(existing._$id!==generated._$id || existing._$type!==generated._$type) throw new Error("预制体页面身份或根类型不匹配。");
  const oldNodes=index(existing), newNodes=index(generated);
  function merge(old:Node|undefined,next:Node|undefined):Node {
    if(old && next && old._$type!==next._$type) throw new Error("预制体控件类型已变化："+old._$id);
    const node={...old,...next};
    if(old?._$child!==undefined || next?._$child!==undefined) {
      const kept=old ? children(old).map(child=>merge(child,newNodes.get(String(child._$id)))) : [];
      const added=next ? children(next).filter(child=>!oldNodes.has(String(child._$id))).map(child=>merge(undefined,child)) : [];
      node._$child=[...kept,...added];
    }
    return node;
  }
  return merge(existing,generated);
}

/** Preflight both roots, then commit all images, importer metadata, ledger and prefab with rollback. */
export async function exportPrefabToDirectories(resources:ResourceDirectory, prefabs:ResourceDirectory, batch:PrefabExportBatch, codec:ExportCodec,guard?:PrefabWriteGuard,finish?:()=>Promise<void>):Promise<number> {
  if(!isPrefabExportBatch(batch)) throw new Error("预制体导出请求无效。");
  const target=[batch.directory,batch.name].filter(Boolean).join("/");
  const original=await prefabs.read(target);
  const targetHash=guard ? guard.hash : original ? await codec.hash(original) : null;
  const assertReviewed=async(bytes:Uint8Array|null)=>{
    if((bytes ? await codec.hash(bytes) : null)!==targetHash) throw new Error("预制体目标已变化，请重新比较并合并。");
  };
  if(guard) await assertReviewed(original);
  const incremental=!!guard?.hash;
  const ledgerBytes=!incremental || batch.images.length ? await resources.read(RESOURCE_MANIFEST) : null;
  if(ledgerBytes && ledgerBytes.length>8*1024*1024)throw new Error("资源来源清单超过 8 MB。");
  const ledger:ResourceManifest=ledgerBytes?parseResourceManifest(JSON.parse(new TextDecoder().decode(ledgerBytes))):{schema:"gameflow.resources",version:2,resources:[]};
  const records=new Map(ledger.resources.map(item=>[item.file,item]));
  const staged:{directory:ResourceDirectory;path:string;bytes:Uint8Array|null;before:Uint8Array|null}[]=[];
  const urls=new Map<string,string>();
  const stage=async(directory:ResourceDirectory,path:string,bytes:Uint8Array|null,before:Uint8Array|null)=>{
    if(path===RESOURCE_MANIFEST && bytes && bytes.length>8*1024*1024)throw new Error("生成的来源清单超过 8 MB。");
    const folder=path.includes("/")?path.slice(0,path.lastIndexOf("/")):undefined,name=path.slice(path.lastIndexOf("/")+1);
    for(const existing of await directory.list(folder)) if(existing.toLowerCase()===name.toLowerCase() && existing!==name) throw new Error(path+" 存在大小写冲突。");
    staged.push({directory,path,bytes,before});
  };
  let ledgerChanged=false;
  for(const image of batch.images){
    const bytes=codec.decode(image.base64),d=image.description;
    validatePng(bytes,d.width,d.height);
    const previous=records.get(image.path),exists=await resources.read(image.path);
    if(exists && !d.shared && (!previous || previous.source.documentId!==d.source.documentId)) throw new Error(image.path+" 已有其他来源的资源，请先处理冲突。");
    const sha256=await codec.hash(bytes);
    const diskHash=exists ? await codec.hash(exists) : null;
    // A reviewed merge keeps engine-edited pixels. Changes to slice geometry can
    // regenerate compacted pixels when the previous export still owns the file.
    const gridChanged=previous && !sameGrid(previous.nineGrid,d.nineGrid);
    const keepPixels=incremental && exists && !(gridChanged && previous.sha256===diskHash);
    if(!previous || !incremental || gridChanged || !exists) {
      if(keepPixels) validatePng(exists,d.width,d.height);
      const record={...previous,...d,name:image.path.slice(image.path.lastIndexOf("/")+1,-4),file:image.path,sha256:keepPixels ? diskHash! : sha256};
      if(!d.logicalSize) delete record.logicalSize;
      records.set(image.path,record);
      ledgerChanged=true;
    }
    const oldMeta=await resources.read(image.path+".meta");
    const meta=mergeLayaMeta(image.path,oldMeta,d.nineGrid);
    if(image.expectedUuid!==undefined && image.expectedUuid!==meta.uuid) throw new Error(image.path+".meta 的 UUID 在审阅后已变化，请重新比较。");
    urls.set(resourceUrl(image.path),"res://"+meta.uuid);
    await stage(resources,image.path+".meta",meta.bytes,oldMeta);
    await stage(resources,image.path,diskHash===sha256 || keepPixels ? null : bytes,exists);
  }
  if(!incremental || ledgerChanged) await stage(resources,RESOURCE_MANIFEST,new TextEncoder().encode(JSON.stringify({...ledger,version:2,resources:[...records.values()].sort((a,b)=>a.file.localeCompare(b.file))},null,2)+"\n"),ledgerBytes);
  const oldPrefabMeta=await prefabs.read(target+".meta");
  await stage(prefabs,target+".meta",mergeLayaMeta(target,oldPrefabMeta).bytes,oldPrefabMeta);
  if(!guard || guard.writePrefab) {
    const added=new Set(guard?.added);
    let prefab=JSON.parse(JSON.stringify(batch.prefab),function(key,value){
      return (!incremental || added.has(this._$id)) && ["skin","normalSkin","selectedSkin","disabledSkin"].includes(key) && typeof value==="string" && urls.has(value) ? urls.get(value) : value;
    });
    if(!guard && original) prefab=mergeGeneratedPrefab(JSON.parse(new TextDecoder().decode(original)),prefab);
    await stage(prefabs,target,new TextEncoder().encode(JSON.stringify(prefab,null,2)+"\n"),original);
  }
  let backupSize=0;
  for(const item of staged) {
    if(item.bytes) backupSize+=item.before?.length??0;
    if(backupSize>48*1024*1024) throw new Error("待替换文件总大小超过 48 MB。");
    const now=await item.directory.read(item.path);
    if((now===null)!==(item.before===null) || now && item.before && await codec.hash(now)!==await codec.hash(item.before))
      throw new Error(item.path+" 在检查期间被修改。");
  }
  const touched:(typeof staged[number] & {bytes:Uint8Array})[]=[];
  try {
    for(const item of staged) {
      if(!item.bytes) continue;
      const folder=item.path.includes("/")?item.path.slice(0,item.path.lastIndexOf("/")):undefined;
      if(folder) await item.directory.mkdir(folder);
      if(item.directory===prefabs && item.path===target) await assertReviewed(await prefabs.read(target));
      touched.push({...item,bytes:item.bytes});await item.directory.write(item.path,item.bytes);
    }
    if(guard && !guard.writePrefab) await assertReviewed(await prefabs.read(target));
    await finish?.();
  } catch(error) {
    const failed:string[]=[];
    for(const item of touched.reverse()) try {
      const now=await item.directory.read(item.path);
      if(now && await codec.hash(now)===await codec.hash(item.bytes)) {
        if(item.before) await item.directory.write(item.path,item.before); else await item.directory.remove(item.path);
      } else if(now && (!item.before || await codec.hash(now)!==await codec.hash(item.before)) || !now && item.before) failed.push(item.path);
    } catch {failed.push(item.path);}
    throw new Error("导出失败："+String(error)+(failed.length?"；需检查："+failed.join("、"):"；已恢复本次写入。"));
  }
  return batch.images.length;
}
