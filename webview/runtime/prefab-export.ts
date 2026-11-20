import type { PrefabExportBatch, ExportImageResolver } from "../../shared/prefab-export";
import { exportPrefabToDirectories } from "../../shared/prefab-export";
import type { ResourceDirectory } from "../../shared/psd-export-directory";
import { browserDirectory, type BrowserDirectory } from "../browser-directories";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
import { paintBuiltin } from "./paint-builtin";
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
    try{const canvas=document.createElement("canvas");canvas.width=resource.description.width;canvas.height=resource.description.height;canvas.getContext("2d")!.drawImage(resource.pixels,0,0);return {status:"ready",image:{path:ref.path,description:resource.description,base64:canvas.toDataURL("image/png").split(",")[1]}};}catch(error){return {status:"error",error:String(error)};}
  };
}
export async function writePrefab(batch:PrefabExportBatch):Promise<number> {
  if(isBrowserPreview){const resources=browserDirectory("resources"),prefabs=browserDirectory("prefabs");if(!resources||!prefabs)throw new Error("请先设置资源和预制体导出根目录。");return exportPrefabToDirectories(browserResourceDirectory(resources),browserResourceDirectory(prefabs),batch,{decode:value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0)),hash:browserHash});}
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{
    const timer=window.setTimeout(()=>{window.removeEventListener("message",handler);reject(new Error("导出响应超时，请检查输出目录后重试。"));},60000);
    const handler=({data}:MessageEvent)=>{if(data?.type!=="prefabExportResult"||data.requestId!==requestId)return;clearTimeout(timer);window.removeEventListener("message",handler);if(data.error)reject(new Error(data.error));else resolve(data.count??0);};
    window.addEventListener("message",handler);postHostMessage({type:"prefabExport",requestId,batch});
  });
}
