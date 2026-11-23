import type { ImageMetaTarget, PrefabExportBatch, ExportImageResolver } from "../../shared/prefab-export";
import { exportPrefabToDirectories, readPrefabSnapshot, type PrefabSnapshot, type PrefabTarget, type PrefabWriteGuard } from "../../shared/prefab-export";
import type { GameFlowDocument } from "../../shared/model";
import type { HostToWebviewMessage, WebviewToHostMessage } from "../../shared/protocol";
import type { ResourceDirectory } from "../../shared/psd-export-directory";
import { browserDirectory, type BrowserDirectory } from "../browser-directories";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
import { paintBuiltin } from "./paint-builtin";
import { builtinImage, BUILTIN_SOURCE } from "../../shared/builtin-image";
import { DEFAULT_IMAGE_ID } from "../../shared/image-rendering";
import { loadSliceImage } from "../psd/slice-render";
import type { Resources } from "./resource-context";
export const bytesBase64 = (bytes:Uint8Array) => { let result=""; for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(result); };
export const browserHash = async (bytes:Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes)))].map(b=>b.toString(16).padStart(2,"0")).join("");
export function browserResourceDirectory(root:BrowserDirectory):ResourceDirectory {
  const folder=async(path:string,create=false)=>{let handle=root;for(const part of path.split("/").filter(Boolean))handle=await handle.getDirectoryHandle(part,{create});return handle;};
  const parent=async(path:string)=>({handle:await folder(path.includes("/")?path.slice(0,path.lastIndexOf("/")):""),name:path.slice(path.lastIndexOf("/")+1)});
  const missing=(e:unknown)=>e instanceof DOMException&&e.name==="NotFoundError";
  return {
    list:async path=>{try{const names:string[]=[];for await(const name of (await folder(path??"")).keys())names.push(name);return names;}catch(e){if(missing(e))return [];throw e;}},
    mkdir:async path=>{await folder(path,true);},
    read:async path=>{try{const {handle,name}=await parent(path),file=await(await handle.getFileHandle(name)).getFile();if(file.size>48*1024*1024)throw new Error(path+" 超过 48 MB。");return new Uint8Array(await file.arrayBuffer());}catch(e){if(missing(e))return null;throw e;}},
    write:async(path,bytes)=>{const {handle,name}=await parent(path),stream=await(await handle.getFileHandle(name,{create:true})).createWritable();try{await stream.write(bytes);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}},
    remove:async path=>{try{const {handle,name}=await parent(path);await handle.removeEntry(name);}catch(e){if(!missing(e))throw e;}}
  };
}
export function exportImageResolver(resources:Resources):ExportImageResolver {
  return async (ref,render)=>{
    if(render) {
      try {
        const canvas=document.createElement("canvas");
        paintBuiltin(canvas,await loadSliceImage(render.builtin.dataUri),render.builtin,render.width,render.height);
        return {status:"ready",image:{path:ref.path,base64:canvas.toDataURL("image/png").split(",")[1],description:{path:ref.path,width:canvas.width,height:canvas.height,nineGrid:null,source:{documentId:"gameflow-builtin",psdName:"builtin.psd",sourceHash:"0".repeat(64)},layerId:render.builtin.id,layerName:render.builtin.name,shared:true}}};
      } catch(error) { return {status:"error",error:String(error)}; }
    }
    const resource=resources.resolveForExport?.(ref) ?? resources.resolve(ref);
    if(resource.status!=="ready")return {status:"error",error:resource.status==="error"?resource.error:"资源正在装载，请稍后重试"};
    if (resource.description.source.documentId === BUILTIN_SOURCE.documentId && ref.path.startsWith("builtin/")) {
      const builtin = builtinImage(resource.description.layerId);
      if (builtin && builtin.id !== DEFAULT_IMAGE_ID) return { status: "ready", image: {
        path: ref.path, description: resource.description, base64: builtin.dataUri.split(",")[1]
      } };
    }
    try{const canvas=document.createElement("canvas");canvas.width=resource.description.width;canvas.height=resource.description.height;canvas.getContext("2d")!.drawImage(resource.pixels,0,0);return {status:"ready",image:{path:ref.path,description:resource.description,base64:canvas.toDataURL("image/png").split(",")[1]}};}catch(error){return {status:"error",error:String(error)};}
  };
}
function request<T extends "prefabInspectResult"|"prefabExportResult">(message:Extract<WebviewToHostMessage,{type:"prefabCommit"|"prefabInspect"}>,type:T) {
  return new Promise<Extract<HostToWebviewMessage,{type:T}>>((resolve,reject)=>{
    const timer=window.setTimeout(()=>{window.removeEventListener("message",handler);reject(new Error("预制体操作超时，请重新比较。"));},60000);
    const handler=({data}:MessageEvent)=>{
      if(data?.type!==type || data.requestId!==message.requestId)return;
      clearTimeout(timer);window.removeEventListener("message",handler);
      if(data.error) reject(new Error(data.error)); else resolve(data);
    };
    window.addEventListener("message",handler);postHostMessage(message);
  });
}
type BrowserSnapshot=PrefabSnapshot & {directory?:BrowserDirectory;resources?:BrowserDirectory};
export async function inspectPrefabTarget(target:PrefabTarget,images:ImageMetaTarget[]):Promise<BrowserSnapshot> {
  if(isBrowserPreview) {
    const directory=browserDirectory("prefabs");
    if(!directory) throw new Error("请选择预制体目录。");
    const resources=browserDirectory("resources");
    return {...await readPrefabSnapshot(browserResourceDirectory(directory),target,browserHash,resources?browserResourceDirectory(resources):undefined,images),directory,resources,root:directory.name,version:0};
  }
  if(!document.querySelector('meta[name="gameflow-prefab-sync"]')) throw new Error("请重新加载 VS Code 窗口以启用预制体同步。");
  const reply=await request({type:"prefabInspect",requestId:crypto.randomUUID(),target,images},"prefabInspectResult");
  if(!reply.snapshot) throw new Error("未能读取目标预制体。");
  return reply.snapshot;
}
const writing=new Set<BrowserDirectory>();
export async function commitPrefab(batch:PrefabExportBatch,snapshot:BrowserSnapshot,guard:PrefabWriteGuard,document:GameFlowDocument,apply:()=>void) {
  if(isBrowserPreview) {
    const resources=browserDirectory("resources"),prefabs=browserDirectory("prefabs");
    if(!resources || !prefabs || resources!==snapshot.resources || prefabs!==snapshot.directory) throw new Error("导出目录已变化，请重新比较。");
    if(writing.has(prefabs) || writing.has(resources)) throw new Error("目录正在导出，请稍后重试。");
    writing.add(prefabs);writing.add(resources);
    try {return await exportPrefabToDirectories(browserResourceDirectory(resources),browserResourceDirectory(prefabs),batch,
      {decode:value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0)),hash:browserHash},guard,async()=>apply());}
    finally {writing.delete(prefabs);writing.delete(resources);}
  }
  return (await request({type:"prefabCommit",requestId:crypto.randomUUID(),batch,guard,document,root:snapshot.root,baseVersion:snapshot.version},"prefabExportResult")).count??0;
}
