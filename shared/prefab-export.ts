import type { GameFlowDocument, GameFlowNode, GameFlowPage } from "./model";
import { COMPONENTS, pageRootType } from "./ui-components";
import { builtinImage, builtinPath, IMAGE_SLOT_FIELDS, type ImageSlot, type ImageSlotField } from "./image-slots";
import { isSliceResourcePath, type SliceResourceDescription, type SliceResourceRef } from "./slice-resources";
import { parseResourceManifest, RESOURCE_MANIFEST, type ResourceManifest } from "./psd-export";
import { exportDirectoryError } from "./export-directory";
import type { ExportCodec, ResourceDirectory } from "./psd-export-directory";

export interface PrefabImage { path: string; base64: string; description: SliceResourceDescription }
export interface PrefabExportBatch { name: string; directory?: string; prefab: Record<string, unknown>; images: PrefabImage[] }
export interface MissingImage { nodeId: string; nodeName: string; slot: ImageSlotField; path: string; error: string }
export interface PrefabPlan { batch: PrefabExportBatch; missing: MissingImage[] }
export type ExportImageResolver = (ref: SliceResourceRef) => Promise<{ status: "ready"; image: PrefabImage } | { status: "error"; error: string }>;

/** Stable importer identity: every reference to the same portable resource path uses the same UUID. */
export function resourceUuid(path: string): string {
  const bytes = new TextEncoder().encode("gameflow-resource:" + path);
  const hex = [2166136261, 2166136261 ^ 0x9e3779b9, 2166136261 ^ 0x85ebca6b, 2166136261 ^ 0xc2b2ae35].map(seed => {
    let value = seed; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619); return (value >>> 0).toString(16).padStart(8, "0");
  }).join("");
  return hex.slice(0,8) + "-" + hex.slice(8,12) + "-5" + hex.slice(13,16) + "-a" + hex.slice(17,20) + "-" + hex.slice(20);
}
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
      images.set(path,{path,base64:builtin.dataUri.split(",")[1],description:{path,width:builtin.width,height:builtin.height,nineGrid:builtin.nineGrid,source:{documentId:"gameflow-builtin",psdName:"builtin.psd",sourceHash:"0".repeat(64)},layerId:builtin.id,layerName:builtin.name,shared:true}});
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
    if(!image || !isSliceResourcePath(image.path) || paths.has(image.path) || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64) || image.base64.length%4 || size>48*1024*1024 || image.description?.path!==image.path) return false;
    paths.add(image.path);
    try { parseResourceManifest({schema:"gameflow.resources",version:2,resources:[{...image.description,name:image.path.slice(image.path.lastIndexOf("/")+1,-4),file:image.path,sha256:"0".repeat(64)}]});return true;}catch{return false;}
  });
}

/** Preflight both roots, then commit all images, importer metadata, ledger and prefab with rollback. */
export async function exportPrefabToDirectories(resources:ResourceDirectory, prefabs:ResourceDirectory, batch:PrefabExportBatch, codec:ExportCodec):Promise<number> {
  if(!isPrefabExportBatch(batch)) throw new Error("预制体导出请求无效。");
  const ledgerBytes=await resources.read(RESOURCE_MANIFEST);
  if(ledgerBytes && ledgerBytes.length>8*1024*1024)throw new Error("资源来源清单超过 8 MB。");
  const ledger:ResourceManifest=ledgerBytes?parseResourceManifest(JSON.parse(new TextDecoder().decode(ledgerBytes))):{schema:"gameflow.resources",version:2,resources:[]};
  const records=new Map(ledger.resources.map(item=>[item.file,item]));
  const writes:{directory:ResourceDirectory;path:string;bytes:Uint8Array;before:Uint8Array|null}[]=[];
  const urls=new Map<string,string>();
  const stage=async(directory:ResourceDirectory,path:string,bytes:Uint8Array)=>{
    if(path===RESOURCE_MANIFEST && bytes.length>8*1024*1024)throw new Error("生成的来源清单超过 8 MB。");
    const folder=path.includes("/")?path.slice(0,path.lastIndexOf("/")):undefined,name=path.slice(path.lastIndexOf("/")+1);
    for(const existing of await directory.list(folder)) if(existing.toLowerCase()===name.toLowerCase() && existing!==name) throw new Error(path+" 存在大小写冲突。");
    writes.push({directory,path,bytes,before:await directory.read(path)});
  };
  for(const image of batch.images){
    const bytes=codec.decode(image.base64),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),d=image.description;
    if(bytes.length<33 || view.getUint32(0)!==0x89504e47 || view.getUint32(4)!==0x0d0a1a0a || view.getUint32(12)!==0x49484452 || view.getUint32(16)!==d.width || view.getUint32(20)!==d.height) throw new Error(image.path+" PNG 数据或尺寸无效。");
    const previous=records.get(image.path),exists=await resources.read(image.path);
    if(exists && !d.shared && (!previous || previous.source.documentId!==d.source.documentId)) throw new Error(image.path+" 已有其他来源的资源，请先处理冲突。");
    const sha256=await codec.hash(bytes);
    records.set(image.path,{...d,name:image.path.slice(image.path.lastIndexOf("/")+1,-4),file:image.path,sha256});
    await stage(resources,image.path,bytes);
    const grid=d.nineGrid;
    const oldMeta=await resources.read(image.path+".meta");
    let existing:Record<string,unknown>={};
    if(oldMeta){try{existing=JSON.parse(new TextDecoder().decode(oldMeta));}catch{throw new Error(image.path+".meta 已损坏。");} if(typeof existing?.uuid!=="string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(existing.uuid)) throw new Error(image.path+".meta 的导入身份无效。");}
    const importer={...(existing.importer && typeof existing.importer==="object" ? existing.importer : {}),textureType:2,...(grid?{sizeGrid:[grid.top,grid.right,grid.bottom,grid.left,grid.repeat?1:0]}:{sizeGrid:[0,0,0,0,0]})};
    const meta={...existing,uuid:existing.uuid??resourceUuid(image.path),importer};
    urls.set(resourceUrl(image.path),"res://"+meta.uuid);
    await stage(resources,image.path+".meta",new TextEncoder().encode(JSON.stringify(meta,null,2)+"\n"));
  }
  await stage(resources,RESOURCE_MANIFEST,new TextEncoder().encode(JSON.stringify({...ledger,version:2,resources:[...records.values()].sort((a,b)=>a.file.localeCompare(b.file))},null,2)+"\n"));
  const target=(batch.directory?batch.directory+"/":"")+batch.name;
  const prefab=JSON.parse(JSON.stringify(batch.prefab),(key,value)=>["skin","normalSkin","selectedSkin","disabledSkin"].includes(key)&&typeof value==="string"&&urls.has(value)?urls.get(value):value);
  await stage(prefabs,target,new TextEncoder().encode(JSON.stringify(prefab,null,2)+"\n"));
  let backupSize=0;for(const item of writes){backupSize+=item.before?.length??0; if(backupSize>48*1024*1024)throw new Error("待替换文件总大小超过 48 MB。"); const now=await item.directory.read(item.path);if((now===null)!==(item.before===null)||now&&item.before&&await codec.hash(now)!==await codec.hash(item.before))throw new Error(item.path+" 在检查期间被修改。");}
  const touched:typeof writes=[];
  try{for(const item of writes){const folder=item.path.includes("/")?item.path.slice(0,item.path.lastIndexOf("/")):undefined;if(folder)await item.directory.mkdir(folder);touched.push(item);await item.directory.write(item.path,item.bytes);}}
  catch(error){const failed:string[]=[];for(const item of touched.reverse())try{if(item.before)await item.directory.write(item.path,item.before);else await item.directory.remove(item.path);}catch{failed.push(item.path);}throw new Error("导出失败："+String(error)+(failed.length?"；无法恢复："+failed.join("、"):"；已恢复本次写入。"));}
  return batch.images.length;
}
