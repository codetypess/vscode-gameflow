import { readPsd, writePsdUint8Array, type Layer } from "ag-psd";
import { parsePsdBinary, patchPsdMetadata } from "../../shared/psd-binary";
import { preservePsdArt } from "../../shared/psd-sync-binary";
import { sliceLayerMetadata, type PsdAsset, type PsdLayerMeta } from "../../shared/psd-meta";
import type { GameFlowDocument, GameFlowPage } from "../../shared/model";
import type { SyncNode } from "../../shared/page-sync";
import { prototypeLayerRef } from "../../shared/psd-prototype";
import { generatePrototypePsd } from "./prototype-psd";

function flatten(children:Layer[]):Layer[] {
  return [...children].reverse().flatMap(layer=>[layer,...flatten(layer.children??[])]);
}
function canvas(width:number,height:number) {
  const result=document.createElement("canvas");
  result.width=width; result.height=height;
  return result;
}
function replaceText(layer:Layer, value:string) {
  const text=layer.text;
  if (!text || text.textOnPath || text.textPath || text.orientation==="vertical" || (text.styleRuns?.length??0)>1 ||
      (text.paragraphStyleRuns?.length??0)>1 || text.warp?.style && text.warp.style!=="none") throw new Error("该文字层的变形或分段样式需要在 Photoshop 中修改："+layer.name);
  const style={...text.style,...text.styleRuns?.[0]?.style};
  const transform=text.transform??[1,0,0,1,layer.left??0,layer.top??0];
  if (transform[0]!==1 || transform[1]!==0 || transform[2]!==0 || transform[3]!==1) throw new Error("变换文字暂只支持采用到原型："+layer.name);
  const size=style.fontSize??14, font=style.font?.name??"Microsoft YaHei";
  const bitmap=canvas(Math.max(1,(layer.right??0)-(layer.left??0)),Math.max(1,(layer.bottom??0)-(layer.top??0)));
  const ctx=bitmap.getContext("2d")!;
  ctx.font=(style.fauxItalic?"italic ":"")+(style.fauxBold?"bold ":"")+size+'px "'+font.replaceAll('"','')+'"';
  const color=style.fillColor;
  if(color && !("r" in color)) throw new Error("该文字颜色模式暂不支持写出。");
  ctx.fillStyle=color?`rgb(${color.r},${color.g},${color.b})`:"#000";
  const align=text.paragraphStyle?.justification;
  ctx.textAlign=align==="center"?"center":align==="right"?"right":"left";
  const x=ctx.textAlign==="center"?bitmap.width/2:ctx.textAlign==="right"?bitmap.width:0;
  value.split("\n").forEach((line,i)=>ctx.fillText(line,x,transform[5]-(layer.top??0)+i*(style.leading||size*1.2)));
  text.text=value;
  for(const run of [...text.styleRuns??[],...text.paragraphStyleRuns??[]]) run.length=value.length;
  layer.canvas=bitmap;
}

export async function writeSyncCopy(doc:GameFlowDocument, proto:GameFlowPage, asset:PsdAsset, source:Uint8Array, before:SyncNode[], after:SyncNode[]) {
  if(asset.layers.some(l=>l.limitation)) throw new Error("这份 PSD 含特殊混合、蒙版或效果，无法可靠重建合成预览。可跳过写入 PSD 的项目，先应用原型侧修改。");
  const original=parsePsdBinary(source);
  if(source.subarray(original.infoEnd,original.maskEnd).some(b=>b!==0)) throw new Error("当前 PSD 含其他全局图层数据，暂只支持采用到原型。");
  const template=await generatePrototypePsd(doc,proto);
  const load=(bytes:Uint8Array)=>readPsd(bytes,{skipThumbnail:true,skipCompositeImageData:true,totalMemoryLimit:384*1024*1024});
  const art=load(source), generated=load(template);
  const originalLayers=flatten(art.children??[]), generatedLayers=flatten(generated.children??[]);
  const templateRecords=parsePsdBinary(template).layers;
  const metadata=new Map<Layer,PsdLayerMeta>(), logical=new Map<string,Layer>(), templates=new Map<string,Layer>();
  const oldById=new Map(before.map(n=>[n.id,n]));
  const owner=new Map<Layer,string>(), untouched=new Set<number>();
  let serial=Math.max(0,...asset.layers.map(l=>l.nativeId??0));
  const used=new Set<number>();
  originalLayers.forEach((layer,i)=>{
    const item=asset.layers[i];
    if(layer.name!==item.name || (layer.id??null)!==item.nativeId) throw new Error("PSD 结构在同步期间已变化。");
    if(layer.id!=null && used.has(layer.id)) throw new Error("PSD 原生图层编号重复。");
    if(layer.id==null) layer.id=++serial; else untouched.add(layer.id);
    used.add(layer.id);
    metadata.set(layer,sliceLayerMetadata(asset,item));
    const mapped=before.find(n=>n.layer===item.metadata.layerId);
    if(mapped) {logical.set(mapped.id,layer); owner.set(layer,mapped.id);}
  });
  generatedLayers.forEach((layer,i)=>{
    const meta=templateRecords[i].metadata as PsdLayerMeta, ref=meta.prototype;
    metadata.set(layer,{...meta,documentId:asset.documentId});
    layer.id=++serial;
    if(prototypeLayerRef(ref) && (!ref.slot || ref.slot==="image")) {templates.set(ref.nodeId,layer);owner.set(layer,ref.nodeId);}
  });
  for(const node of after) {
    const old=oldById.get(node.id);
    if(!old) {
      const layer=templates.get(node.id);
      if(!layer) throw new Error("找不到新增控件的 PSD 占位："+node.name);
      logical.set(node.id,layer);
      continue;
    }
    const layer=logical.get(node.id)!;
    if(old.name!==node.name || old.text!==node.text) {
      const record=original.layers[originalLayers.indexOf(layer)];
      if(record.blocks.some(b=>!["luni","lyid","lsct","lsdk","shmd","TySh","lclr","lyvr","clbl","infx","knko","fxrp","lspf"].includes(b.key))) throw new Error("此层含无法保真的附加信息："+node.name);
      untouched.delete(layer.id!);
      if(old.text!==node.text) replaceText(layer,node.text);
      if(old.name!==node.name) layer.name=node.name+(layer.name?.match(/\s*\(UI\w+\)$/)?.[0]??"");
    }
  }
  function arrange(parent:string, existing:Layer[]):Layer[] {
    const children=after.filter(n=>n.parent===parent).map(n=>logical.get(n.id)!);
    // Maintain decorative layers in their authored position relative to surviving controls.
    const survivors=existing.filter(l=>!owner.has(l) || children.includes(l));
    const slots=survivors.filter(l=>owner.has(l));
    const ordered=children.filter(l=>slots.includes(l));
    let i=0;
    const result=survivors.map(l=>owner.has(l)?ordered[i++]:l);
    for(let j=0;j<children.length;j++) {
      const child=children[j];
      if(!result.includes(child)) {
        const next=children.slice(j+1).find(l=>result.includes(l));
        result.splice(next?result.indexOf(next):result.length,0,child);
      }
      if(child.children) child.children=arrange(owner.get(child)!,child.children);
    }
    return result;
  }
  const pageRoot=originalLayers.find(l=>{
    const ref=metadata.get(l)?.prototype;
    return prototypeLayerRef(ref) && ref.documentId===doc.documentId && ref.pageId===proto.id && ref.nodeId===proto.id && l.children;
  });
  if(pageRoot) pageRoot.children=arrange("",pageRoot.children??[]);
  else art.children=arrange("",art.children??[]);
  const composite=canvas(art.width,art.height), ctx=composite.getContext("2d")!;
  const draw=(layers:Layer[])=>{for(const l of layers) if(!l.hidden) {if(l.children) draw(l.children); else if(l.canvas) ctx.drawImage(l.canvas,l.left??0,l.top??0);}};
  draw(art.children??[]); art.canvas=composite;
  const result=writePsdUint8Array(art,{generateThumbnail:false,invalidateTextLayers:false});
  const output=preservePsdArt(source,result,untouched);
  const records=parsePsdBinary(output).layers, layers=flatten(art.children??[]);
  const updates=new Map<number,PsdLayerMeta>();
  records.forEach((r,i)=>{
    const l=layers[i], m=metadata.get(l);
    if(!m || l.name!==r.name) throw new Error("同步副本的图层结构校验失败。");
    updates.set(r.key,m);
  });
  return patchPsdMetadata(output,updates);
}
