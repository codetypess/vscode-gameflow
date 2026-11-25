import { useEffect, useMemo } from "react";
import { useRuntimeResources } from "../webview/runtime/resources";
import { browserSettings, type BrowserDirectory } from "../webview/browser-directories";
import { NodeView } from "../webview/editor/node-view";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SlotImage } from "../webview/runtime/slot-image";
import { generatePrototypePsd } from "../webview/runtime/prototype-psd";
import { openPsd } from "../webview/psd/io";
import { loadSliceImage, renderSliceExportBatch } from "../webview/psd/slice-render";
import { builtinSlice, sameGrid, verifyBuiltinOrigin } from "../shared/psd-builtin";
import { paintSlice } from "../webview/runtime/paint-slice";
import { builtinImage, builtinPath } from "../shared/image-slots";
import { createDefaultGameFlowDocument, type GameFlowPage } from "../shared/model";
import { planPrefabExport, exportPrefabToDirectories, resourceUrl } from "../shared/prefab-export";
import { exportImageResolver, browserHash, bytesBase64 } from "../webview/runtime/prefab-export";
import { readExportedSlice } from "../shared/slice-resources";
import type { ResourceDirectory } from "../shared/psd-export-directory";
import { SliceResourcesProvider, type Resources } from "../webview/runtime/resource-context";

const results = document.createElement("pre"); document.body.append(results);
const gallery=document.createElement("div");gallery.id="default-image-gallery";gallery.style.cssText="display:inline-flex;gap:20px;padding:20px;align-items:flex-start";document.body.append(gallery);
const pixels=(canvas:HTMLCanvasElement)=>canvas.getContext("2d")!.getImageData(0,0,canvas.width,canvas.height).data;
async function decode(dataUri:string) { const image=await loadSliceImage(dataUri),canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext("2d")!.drawImage(image,0,0);return canvas; }
function directory() { const files=new Map<string,Uint8Array>(); const io:ResourceDirectory={list:async folder=>[...files.keys()].filter(p=>folder?p.startsWith(folder+"/"):!p.includes("/")).map(p=>folder?p.slice(folder.length+1):p),mkdir:async()=>{},read:async p=>files.get(p)??null,write:async(p,bytes)=>{files.set(p,bytes);},remove:async p=>{files.delete(p);}};return{files,io}; }
const equal = (actual: unknown, expected: unknown, label: string) => {
  if(actual instanceof Uint8ClampedArray && expected instanceof Uint8ClampedArray) {
    if(actual.length!==expected.length)throw new Error(label+": pixel length mismatch");
    let max=0,count=0,first=-1;
    for(let i=0;i<actual.length;i++) { const delta=Math.abs(actual[i]-expected[i]);max=Math.max(max,delta);if(delta){count++;if(first<0)first=i;} }
    if(max>0)throw new Error(label+": max channel delta "+max+", changed "+count+", first "+first);
  } else if(actual!==expected)throw new Error(label+": expected "+expected+", got "+actual);
};
const empty: Resources = {mode:"prototype",entries:new Map(),sizes:new Map(),resolve:()=>({status:"error",error:"missing"}),refresh(){}};
function diskDirectory(files:Map<string,Uint8Array>,prefix=""):BrowserDirectory {
  return {name:"test-resources",async *keys(){for(const file of files.keys())if(file.startsWith(prefix))yield file.slice(prefix.length).split("/")[0];},
    getDirectoryHandle:async name=>diskDirectory(files,prefix+name+"/"),
    getFileHandle:async name=>{const bytes=files.get(prefix+name);if(!bytes)throw new DOMException("Missing","NotFoundError");return{getFile:async()=>new File([new Uint8Array(bytes)],name),createWritable:async()=>{throw new Error("read only fixture");}};},removeEntry:async()=>{throw new Error("read only fixture");}};
}
const noAssets:never[]=[];
function DiskFixture({page,onResources,displayPage=page,nodeId=page.nodes[0].id}:{page:GameFlowPage;displayPage?:GameFlowPage;nodeId?:string;onResources(value:Resources):void}) {
  const pages=useMemo(()=>[page],[page]),resources=useRuntimeResources(noAssets,pages,"test-resources","prefab");
  useEffect(()=>onResources(resources),[resources]);
  return <SliceResourcesProvider value={resources}><NodeView page={displayPage} node={displayPage.nodes.find(node=>node.id===nodeId)!} /></SliceResourcesProvider>;
}
async function run() {
  const mount=document.getElementById("root")!, root=createRoot(mount), lines:string[]=[], expected=new Map<string,Uint8ClampedArray>(), builtin=builtinImage("image/default")!;
  const render=async(width:number,height:number,resources=empty,fit:"fill"|"contain"|"cover"="fill",slot={builtin:"image/default"})=>{
    mount.style.cssText="width:"+width+"px;height:"+height+"px";
    flushSync(()=>root.render(<SliceResourcesProvider value={resources}><SlotImage slot={slot} width={width} height={height} fit={fit} label="默认图片" /></SliceResourcesProvider>));
    for(let attempt=0;attempt<100&&!mount.querySelector("canvas");attempt++) await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const canvas=mount.querySelector("canvas");if(!canvas)throw new Error("图片未装载："+mount.textContent);
    return canvas;
  };
  const glyph=await decode(new URL("../scripts/art/default-landscape.png",import.meta.url).href);
  for(const [width,height] of [[750,1334],[600,100],[64,64],[240,64],[120,480],[40,36],[38,34],[16,12],[8,100],[100,8]]) {
    const canvas=await render(width,height),reference=document.createElement("canvas");
    paintSlice(reference,await loadSliceImage(builtin.dataUri),builtin,width,height);
    equal(pixels(canvas),pixels(reference),"默认图片使用普通九宫格渲染 "+width+"×"+height);
    expected.set(width+"x"+height,pixels(canvas));
    if(width>=40 && height>=36){
      const context=reference.getContext("2d")!;
      context.resetTransform();
      context.fillStyle="#e3e7ec";context.fillRect(0,0,width,height);
      context.drawImage(glyph,6,6);
      equal(pixels(canvas),pixels(reference),"左上角山景图标保持原始像素和 6px 间距 "+width+"×"+height);
    }
    if([64,240,120].includes(width)){
      const card=document.createElement("div"),copy=document.createElement("canvas");
      copy.width=width;copy.height=height;copy.getContext("2d")!.drawImage(canvas,0,0);
      copy.style.cssText="display:block;margin-top:8px";card.textContent=width+" × "+height;card.append(copy);gallery.append(card);
    }
    lines.push("PASS 默认图片九宫格 "+width+"×"+height);
  }
  const page:GameFlowPage={id:"default-page",name:"默认图片",kind:"screen",frame:{x:0,y:0,width:800,height:1500},nodes:[
    {id:"portrait",type:"image",name:"竖图",frame:{x:0,y:0,width:750,height:1334},image:{builtin:"image/default"}},
    {id:"wide",type:"image",name:"横图",frame:{x:0,y:1350,width:600,height:100},image:{builtin:"image/default"},widget:{imageFit:"contain"}},
    {id:"duplicate",type:"image",name:"复用横图",frame:{x:0,y:1450,width:600,height:100},image:{builtin:"image/default"},hidden:true},
    {id:"small",type:"image",name:"小图",frame:{x:0,y:0,width:16.25,height:11.75},image:{builtin:"image/default"},hidden:true}
  ]};
  const doc={...createDefaultGameFlowDocument("default-image-test"),pages:[page]};
  const bytes=await generatePrototypePsd(doc,page),opened=await openPsd(new File([bytes],"default.psd"));
  const slices=await renderSliceExportBatch(opened.asset);
  equal(slices.items.length,1,"不同尺寸的 PSD 图层共用一张切图");
  equal(slices.items[0].base64,builtin.dataUri.split(",")[1],"PSD 切图使用内置原图");
  equal(sameGrid(slices.items[0].nineGrid,builtin.nineGrid),true,"PSD 输出源图九宫格");
  for(const [id,key] of [["portrait","750x1334"],["wide","600x100"]]) {
    const layer=opened.asset.layers.find(l=>l.metadata.prototype?.nodeId===id)!;
    equal(pixels(await decode(layer.image!)),expected.get(key),"PSD 图层与原型一致 "+id);
  }
  const composite=await decode(opened.asset.preview);
  const portrait = opened.asset.layers.find(layer => layer.name === "竖图")!;
  const oldOrigin = { ...portrait.metadata.builtinOrigin as object, catalog: "c2aba2a565d8cbd0e0442efbb994e956e81ec2cea179d34fac82ca42ff32c06d" };
  const portraitPixels = (await decode(portrait.image!)).getContext("2d")!.getImageData(0,0,portrait.width,portrait.height);
  const old = { ...portrait, metadata: { ...portrait.metadata, builtinOrigin: oldOrigin },
    verifiedBuiltin: await verifyBuiltinOrigin(oldOrigin, portraitPixels),
    config: { ...portrait.config, nineGrid: { top: 34, right: 0, bottom: 0, left: 38, repeat: false } } };
  equal(builtinSlice(old)?.id, "image/default", "上一版左上图标仍复用共享图片");
  equal(builtinSlice({ ...old, config: { ...old.config, nineGrid: builtin.nineGrid } }), undefined, "美术改过的旧切线独立导出");
  equal(composite.getContext("2d")!.getImageData(0,0,750,1334).data,expected.get("750x1334"),"PSD 合成与原型一致");
  lines.push("PASS 真实 PSD 图层、合成图与原型像素一致");
  const plan=await planPrefabExport(doc,page,exportImageResolver(empty));
  equal(plan.missing.length,0,"默认图片导出无缺失");equal(plan.batch.images.length,1,"不同尺寸共用同一默认图片资源");
  const resources=directory(),prefabs=directory();
  await exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,{decode:value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0)),hash:browserHash});
  const path=builtinPath("image/default"),item=await readExportedSlice(path,{read:resources.io.read,hash:browserHash,encode:bytesBase64});
  if(item.error)throw new Error(item.error);equal(item.description!.width,builtin.width,"导出宽度");equal(item.description!.height,builtin.height,"导出高度");equal(sameGrid(item.description!.nineGrid,builtin.nineGrid),true,"导出九宫格");
  const png=await decode("data:image/png;base64,"+item.base64);equal(pixels(png),pixels(await decode(builtin.dataUri)),"导出 PNG 与内置资源一致");
  const disk:Resources={...empty,mode:"prefab",resolve:ref=>ref.path===path?{status:"ready",pixels:png,description:item.description!}:{status:"error",error:"缺少导出资源"}};
  for(const [width,height] of [[750,1334],[600,100]]) equal(pixels(await render(width,height,disk)),expected.get(width+"x"+height),"预制体模式读取共享默认资源");
  const prefabNodes=plan.batch.prefab._$child as Record<string,unknown>[];equal(prefabNodes[0].skin,resourceUrl(path),"Prefab 使用共享默认资源");equal(prefabNodes[1].skin,prefabNodes[2].skin,"重复默认资源复用引用");
  const browserWindow=window as unknown as {showDirectoryPicker?:()=>Promise<BrowserDirectory>};
  const originalPicker=browserWindow.showDirectoryPicker;browserWindow.showDirectoryPicker=async()=>diskDirectory(resources.files);
  await browserSettings({requestId:"test-resources",action:"choose",directory:"resources"});browserWindow.showDirectoryPicker=originalPicker;
  let live:Resources=empty;
  flushSync(()=>root.render(<DiskFixture page={page} onResources={value=>{live=value;}} />));
  for(let i=0;i<100&&!mount.querySelector("canvas");i++)await new Promise(requestAnimationFrame);
  const diskCanvas=mount.querySelector("canvas");if(!diskCanvas)throw new Error("真实资源 hook 未加载共享默认 PNG："+mount.textContent);
  equal(pixels(diskCanvas),expected.get("750x1334"),"真实资源 hook 读取共享默认 PNG");
  const temporary={...page,nodes:page.nodes.map((node,i)=>i?node:{...node,frame:{...node.frame,width:900}})};
  flushSync(()=>root.render(<DiskFixture page={page} displayPage={temporary} onResources={value=>{live=value;}} />));await new Promise(requestAnimationFrame);
  equal(mount.querySelector("canvas")!.width,900,"临时预览尺寸更新");
  equal(mount.querySelector("canvas")!.dataset.resourcePath,path,"临时预览继续使用共享原图");
  resources.files.delete(path);live.refresh();
  for(let i=0;i<100&&!mount.querySelector('[data-resource-status="error"]');i++)await new Promise(requestAnimationFrame);
  equal(mount.querySelectorAll("canvas").length,0,"预制体 PNG 缺失时不回退内置图片");
  if(!mount.querySelector('[data-resource-status="error"]'))throw new Error("缺失导出资源应显示错误");
  lines.push("PASS 真实资源 hook 加载共享 PNG，临时缩放保留来源，磁盘缺失明确报错");
  const parentPixels=document.createElement("canvas");parentPixels.width=300;parentPixels.height=100;parentPixels.getContext("2d")!.fillRect(0,0,300,100);
  const parentPath="unclassified/parent.png",parentDescription={path:parentPath,width:300,height:100,nineGrid:null,source:{documentId:"artist",psdName:"parent.psd",sourceHash:"0".repeat(64)},layerId:"parent",layerName:"parent",shared:false};
  const measuredPage:GameFlowPage={...page,nodes:[
    {id:"parent",type:"button",name:"图片自适应按钮",frame:{x:0,y:0,width:10,height:10},layout:{widthMode:"measured",heightMode:"measured"},normalSkin:{builtin:"image/default"}},
    {id:"child",type:"image",name:"按图片测量内容",parentId:"parent",frame:{x:0,y:0,width:10,height:10},layout:{widthMode:"measured",heightMode:"measured"},image:{art:{path:parentPath}}}
  ]};
  const measuredPlan=await planPrefabExport({...doc,pages:[measuredPage]},measuredPage,async ref=>ref.path===parentPath?{status:"ready",image:{path:parentPath,description:parentDescription,base64:parentPixels.toDataURL().split(",")[1]}}:{status:"error",error:"unexpected resource"});
  await exportPrefabToDirectories(resources.io,prefabs.io,measuredPlan.batch,{decode:value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0)),hash:browserHash});
  flushSync(()=>root.render(<DiskFixture page={measuredPage} nodeId="parent" onResources={value=>{live=value;}} />));
  for(let i=0;i<100&&mount.querySelector("canvas")?.dataset.resourcePath!==path;i++)await new Promise(requestAnimationFrame);
  equal(mount.querySelector("canvas")?.dataset.resourcePath,path,"没有 PSD 内存时仍装载共享默认图资源");
  equal(mount.querySelector("canvas")?.width,300,"测量型父节点的占位图宽度正确");
  lines.push("PASS 没有 PSD 内存时仍使用共享默认图资源并保留测量布局");
  const image=await decode(builtin.dataUri),art={path:"unclassified/custom.png"};
  const artResources:Resources={...empty,mode:"art",resolve:()=>({status:"ready",pixels:image,description:{path:art.path,width:64,height:64,nineGrid:null,source:{documentId:"artist",psdName:"art.psd",sourceHash:"0".repeat(64)},layerId:"image/default",layerName:"默认图片",shared:false}})};
  const artCanvas=await render(600,100,artResources,"fill",{builtin:"image/default",...{art}}),reference=document.createElement("canvas");
  paintSlice(reference,image,{...builtin,nineGrid:null},600,100);equal(pixels(artCanvas),pixels(reference),"已绑定美术图片仍按原填充绘制");
  lines.push("PASS Prefab PNG、来源清单、尺寸复用、回读预览一致；美术绑定保持原填充");
  root.unmount();mount.remove();results.textContent=lines.join("\n");results.dataset.complete="true";
}
void run().catch(error=>{results.textContent="FAIL "+String(error);results.dataset.complete="true";});
