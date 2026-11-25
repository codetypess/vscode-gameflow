import { readPsd, writePsdUint8Array, type Layer, type LinkedFile, type Warp } from "ag-psd";
import { parsePsdBinary, patchPsdMetadata } from "../../shared/psd-binary";
import { hasOnlyEmbeddedFileBlocks, preservePsdArt } from "../../shared/psd-sync-binary";
import { sliceLayerMetadata, type PsdAsset, type PsdEmbeddedLayer, type PsdLayerMeta } from "../../shared/psd-meta";
import type { GameFlowDocument, GameFlowPage } from "../../shared/model";
import type { PsdComponentInstance, PsdVisualUpdate, SyncNode } from "../../shared/page-sync";
import { componentPsdFileName } from "../../shared/page-psd";
import { prototypeLayerRef } from "../../shared/psd-prototype";
import { generatePrototypePsd } from "./prototype-psd";
import { embeddedPsdFiles, embedPsdGroup, placeComponentPsd, type ComponentPsd } from "./psd-smart-object";
import { psdComponentSource } from "../../shared/psd-meta";
import { matchComponentLayers } from "../../shared/psd-component-layers";
import type { Matrix } from "../../shared/ui-transform";
import type { CanvasSources } from "../../shared/canvas-references";
import { maskedCellPixels, readableCellMask } from "../psd/list-cell-mask";
import { psdVisualUpdates } from "../../shared/psd-visual-updates";
import { builtinImage } from "../../shared/builtin-image";
import { builtinOrigin, builtinLayerGrid } from "../../shared/psd-builtin";
import { loadSliceImage } from "../psd/slice-render";
import { paintSlice } from "./paint-slice";

function flatten(children:Layer[]):Layer[] {
  return [...children].reverse().flatMap(layer=>[layer,...flatten(layer.children??[])]);
}
function canvas(width:number,height:number) {
  const result=document.createElement("canvas");
  result.width=width; result.height=height;
  return result;
}
const readForSync = (bytes: Uint8Array) => readPsd(bytes, { skipThumbnail: true, skipCompositeImageData: true, totalMemoryLimit: 384 * 1024 * 1024 });
const aligned = (a: number, b: number) => Math.abs(a - b) <= .01;

function isIdentityWarp(warp: Warp | undefined, width: number, height: number) {
  if (!warp || warp.style === "none") return true;
  if (warp.style !== "custom" || warp.value || warp.values?.some(Boolean) || warp.perspective || warp.perspectiveOther ||
    warp.uOrder !== 4 || warp.vOrder !== 4 || warp.rotate !== "horizontal" || warp.deformNumRows || warp.deformNumCols) return false;
  const envelope = warp.customEnvelopeWarp;
  const bounds = warp.bounds;
  // ag-psd writes an undeformed four-by-four mesh by default.
  return !!bounds && [bounds.left, bounds.top, bounds.right, bounds.bottom].every(value => value.units === "Pixels") &&
    aligned(bounds.left.value, 0) && aligned(bounds.top.value, 0) && aligned(bounds.right.value, width) && aligned(bounds.bottom.value, height) &&
    !envelope?.quiltSliceX?.length && !envelope?.quiltSliceY?.length && envelope?.meshPoints.length === 16 &&
    envelope.meshPoints.every(({ x, y }, index) => aligned(x, (index % 4) * width / 3) && aligned(y, Math.floor(index / 4) * height / 3));
}

function mergeComponentChildren(current: Layer[], generated: Layer[]): Layer[] {
  const info = (layer: Layer): { name: string; kind: PsdEmbeddedLayer["kind"] } => ({
    name: layer.name ?? "",
    kind: layer.children ? "group" : layer.text ? "text" : layer.placedLayer ? "smartObject" : "image"
  });
  const matches = matchComponentLayers([...generated].reverse().map(info), [...current].reverse().map(info)).reverse();
  const result = [...current];
  let next: Layer | undefined;
  for (let i = generated.length - 1; i >= 0; i--) {
    const match = matches[i], wanted = generated[i];
    if (match === undefined) {
      result.splice(next ? result.indexOf(next) : result.length, 0, wanted);
      next = wanted;
    } else {
      const kept = current[current.length - 1 - match];
      if (kept.children && wanted.children) kept.children = mergeComponentChildren(kept.children, wanted.children);
      next = kept;
    }
  }
  return result;
}

async function updateEmbeddedComponent(layer: Layer, placedFile: LinkedFile, generatedFile: LinkedFile, component: PsdComponentInstance) {
  const placed = layer.placedLayer!;
  const source = placedFile.data!;
  const parsed = parsePsdBinary(source);
  if (source.subarray(parsed.infoEnd, parsed.maskEnd).some(byte => byte !== 0) || parsed.layers.some(item =>
    item.blocks.some(block => !["luni", "lyid", "lsct", "lsdk", "TySh", "Txt2", "lclr", "lyvr", "clbl", "infx", "knko", "fxrp", "lspf"].includes(block.key))))
    throw new Error("智能对象内含无法安全写回的图层信息：" + layer.name);
  const current = readForSync(source);
  const generated = readForSync(generatedFile.data!);
  const supported = flatten(current.children ?? []).every(child => !child.mask && !child.vectorMask && !child.effects &&
    !child.clipping && !child.adjustment && !child.placedLayer && child.opacity === 1 && (child.fillOpacity ?? 1) === 1 &&
    (child.blendMode === "normal" || child.blendMode === "pass through"));
  const [x0,y0,x1,y1,x2,y2,x3,y3] = placed.transform;
  const width = placed.width || current.width, height = placed.height || current.height;
  const dx = x1 - x0, dy = y1 - y0, ex = x3 - x0, ey = y3 - y0;
  if (!supported || placed.filter || !isIdentityWarp(placed.warp, width, height) ||
    placed.nonAffineTransform?.some((value, index) => !aligned(value, placed.transform[index])) ||
    !aligned(x0 + dx + ex, x2) || !aligned(y0 + dy + ey, y2))
    throw new Error("智能对象的效果或变换需要在 Photoshop 中处理：" + layer.name);
  const matrix: Matrix = [dx / width, dy / width, ex / height, ey / height, x0, y0];
  const children = mergeComponentChildren(current.children ?? [], generated.children ?? []);
  const frame = { x: 0, y: 0, width: Math.max(current.width, generated.width), height: Math.max(current.height, generated.height) };
  const result = await embedPsdGroup({ ...layer, children }, component.key, generatedFile.name, frame, { matrix, preserveLayerIds: true });
  const replacement = result.layer.placedLayer!;
  Object.assign(layer, { left: result.layer.left, top: result.layer.top, canvas: result.layer.canvas, right: undefined,
    bottom: undefined, imageData: undefined, placedLayer: { ...placed, ...replacement, placed: placed.placed,
      warp: undefined, nonAffineTransform: undefined } });
  return result.file;
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

export async function writeSyncCopy(doc:GameFlowDocument, proto:GameFlowPage, asset:PsdAsset, source:Uint8Array, before:SyncNode[], after:SyncNode[],
  components: ReadonlyMap<string,PsdComponentInstance> = new Map(), conversions: ReadonlySet<string> = new Set(),
  componentUpdates: ReadonlySet<string> = new Set(), componentPsds?: ReadonlyMap<string, ComponentPsd>,
  sourceUpdates: ReadonlyMap<string, "proto" | "psd"> = new Map(), sources: CanvasSources = {},
  visualUpdates: ReadonlyMap<string,PsdVisualUpdate> = new Map()) {
  if(asset.layers.some(l=>l.limitation)) throw new Error("这份 PSD 含特殊混合、蒙版或效果，无法可靠重建合成预览。可跳过写入 PSD 的项目，先应用原型侧修改。");
  const original=parsePsdBinary(source);
  if(!hasOnlyEmbeddedFileBlocks(source,original)) throw new Error("当前 PSD 含其他全局图层数据，暂只支持采用到原型。");
  const existing = new Set(before.map(node => node.id));
  const addedComponentPsds = new Map(Array.from(componentPsds ?? []).filter(([id]) => !existing.has(id)));
  const template=await generatePrototypePsd(doc,proto,components,{ reserved: asset.layers.map(layer=>layer.metadata.layerId), sources }, addedComponentPsds);
  const art=readForSync(source), generated=readForSync(template);
  const artFiles = embeddedPsdFiles(art.linkedFiles);
  if (artFiles.size !== (art.linkedFiles?.length ?? 0)) throw new Error("当前 PSD 含无法保真的智能对象链接。");
  const generatedFiles = embeddedPsdFiles(generated.linkedFiles);
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
  if (visualUpdates.size) {
    const eligible = psdVisualUpdates(doc, proto, asset, before, sources);
    for (const [id, kind] of visualUpdates) {
      const layer = logical.get(id);
      if (!layer || eligible.get(id) !== kind) throw new Error("原型或美术图层已变化，请重新比较。");
      const meta = metadata.get(layer)!;
      if (kind === "psd-list-cells") {
        const rows = templates.get(id)?.children?.filter(row => metadata.get(row)?.listNodeId === id);
        if (!rows || !layer.children) throw new Error("未找到列表项模板：" + layer.name);
        layer.children.push(...rows);
        metadata.set(layer, { ...meta, listCellsGenerated: true });
      } else {
        const item = asset.layers.find(item => item.metadata.layerId === meta.layerId)!;
        const record = original.layers[originalLayers.indexOf(layer)];
        if (record.blocks.some(b => !["luni","lyid","shmd","lclr","lyvr","clbl","infx","knko","fxrp","lspf"].includes(b.key)))
          throw new Error("此图片含无法安全写回的附加信息：" + layer.name);
        const image = builtinImage("image/default")!, { width, height } = item.verifiedBuiltin!;
        const bitmap = canvas(item.width, item.height);
        const node = proto.nodes.find(node => node.id === id)!;
        paintSlice(bitmap, await loadSliceImage(image.dataUri), image, width, height, node.widget?.imageFit ?? "fill");
        const pixels = bitmap.getContext("2d")!.getImageData(0, 0, bitmap.width, bitmap.height);
        layer.canvas = bitmap;
        untouched.delete(layer.id!);
        metadata.set(layer, { ...meta, builtinOrigin: await builtinOrigin(image, width, height, pixels.data),
          slicing: { ...item.config, nineGrid: builtinLayerGrid(image.nineGrid, bitmap.width, bitmap.height) } });
      }
    }
  }
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
      if(record.blocks.some(b=>!["luni","lyid","lsct","lsdk","shmd","TySh","lclr","lyvr","clbl","infx","knko","fxrp","lspf"].includes(b.key) &&
        !(metadata.get(layer)?.componentSmartObject === true && ["PlLd","SoLd"].includes(b.key)))) throw new Error("此层含无法保真的附加信息："+node.name);
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

  const linkedFiles = new Map(artFiles);
  const updatedFiles = new Set<string>();
  for (const [id, choice] of sourceUpdates) {
    const current = logical.get(id), incoming = componentPsds?.get(id);
    const placed = current?.placedLayer;
    const meta = current && metadata.get(current);
    const layer = asset.layers.find(item => item.metadata.layerId === meta?.layerId);
    if (!current || !incoming || !placed || !meta || !layer?.smartObject?.hash || !artFiles.has(placed.id))
      throw new Error("无法读取智能对象的内嵌 PSD：" + current?.name);
    const origin = incoming.origin;
    if (choice === "psd") {
      const previous = psdComponentSource(meta.componentSource);
      // Keep the last installed hash so future source edits still require a choice.
      metadata.set(current, { ...meta, componentSource: { ...origin, embeddedHash: previous?.embeddedHash ?? origin.sourceHash } });
      continue;
    }
    metadata.set(current, { ...meta, componentSmartObject: true, componentSource: origin });
    if (layer.smartObject.hash === origin.sourceHash) continue;
    const width = placed.width ?? 0, height = placed.height ?? 0;
    if (placed.filter || !isIdentityWarp(placed.warp, width, height) ||
        placed.nonAffineTransform?.some((value, index) => !aligned(value, placed.transform[index])))
      throw new Error("请在 Photoshop 中更新带特殊变形或滤镜的智能对象：" + current.name);
    const replacement = await placeComponentPsd(incoming, placed.transform, current.name ?? incoming.name);
    const next = replacement.layer.placedLayer!;
    Object.assign(current, { left: replacement.layer.left, top: replacement.layer.top, canvas: replacement.layer.canvas,
      right: undefined, bottom: undefined, imageData: undefined, placedLayer: { ...placed, id: next.id, width: next.width,
        height: next.height, warp: width === next.width && height === next.height ? placed.warp : undefined } });
    linkedFiles.set(replacement.file.id, replacement.file);
    updatedFiles.add(placed.id);
    if (current.id !== undefined) untouched.delete(current.id);
  }
  for (const id of componentUpdates) {
    const current = logical.get(id);
    if (!current || !after.some(node => node.id === id)) continue;
    const placedFile = current.placedLayer && artFiles.get(current.placedLayer.id);
    const newLayer = templates.get(id)?.placedLayer;
    const generatedFile = newLayer && generatedFiles.get(newLayer.id);
    if (!placedFile || !generatedFile) throw new Error("无法读取智能对象的内嵌 PSD：" + current.name);
    const file = await updateEmbeddedComponent(current, placedFile, generatedFile, components.get(id)!);
    linkedFiles.set(file.id, file);
    updatedFiles.add(placedFile.id);
    if (current.id !== undefined) untouched.delete(current.id);
  }
  async function replaceGroups(layers: Layer[]) {
    for (let index = 0; index < layers.length; index++) {
      const group = layers[index], id = owner.get(group);
      const component = id && components.get(id);
      if (id && conversions.has(id) && component && group.children) {
        for (const member of [group, ...flatten(group.children)]) {
          const record = original.layers[originalLayers.indexOf(member)];
          if (member.placedLayer || record?.blocks.some(block =>
            !["luni","lyid","lsct","lsdk","shmd","TySh","Txt2","lclr","lyvr","clbl","infx","knko","fxrp","lspf"].includes(block.key)))
            throw new Error("组件图层组含无法保真的附加信息：" + member.name);
        }
        const frame = after.find(node => node.id === id)!.frame;
        const { layer, file } = await embedPsdGroup(group, component.key, componentPsdFileName(component.sourceName), frame);
        metadata.set(layer, { ...metadata.get(group)!, componentSmartObject: true });
        if (group.id !== undefined) untouched.delete(group.id);
        layers[index] = layer;
        if (!linkedFiles.has(file.id)) linkedFiles.set(file.id, file);
      } else if (group.children) await replaceGroups(group.children);
    }
  }
  if (conversions.size) await replaceGroups(art.children ?? []);
  const resultLayers = flatten(art.children ?? []);
  for (const layer of resultLayers) {
    const id = layer.placedLayer?.id;
    if (!id || !generatedLayers.includes(layer)) continue;
    const file = generatedFiles.get(id);
    if (!file?.data) throw new Error("缺少生成的组件内容：" + layer.name);
    const previous = linkedFiles.get(id)?.data;
    if (previous && (previous.length !== file.data.length || previous.some((byte, index) => byte !== file.data![index]))) {
      const unique = crypto.randomUUID();
      layer.placedLayer!.id = unique;
      linkedFiles.set(unique, { ...file, id: unique });
    } else if (!previous) linkedFiles.set(id, file);
  }
  const referencedFiles = new Set(resultLayers.map(layer => layer.placedLayer?.id));
  for (const id of updatedFiles) if (!referencedFiles.has(id)) linkedFiles.delete(id);
  art.linkedFiles = [...linkedFiles.values()];
  const composite=canvas(art.width,art.height), ctx=composite.getContext("2d")!;
  const draw=(layers:Layer[])=>{
    for(const layer of layers) {
      if(layer.hidden) continue;
      if(layer.children) { draw(layer.children); continue; }
      let bitmap=layer.canvas;
      if(!bitmap) continue;
      if(layer.mask?.canvas && readableCellMask(layer) && Number.isInteger(metadata.get(layer)?.listCellIndex)) {
        const { width, height } = bitmap;
        const pixels = bitmap.getContext("2d")!.getImageData(0,0,width,height);
        const mask = layer.mask.canvas.getContext("2d")!.getImageData(0,0,width,height);
        bitmap = canvas(width,height);
        bitmap.getContext("2d")!.putImageData(maskedCellPixels(pixels,mask),0,0);
      }
      ctx.drawImage(bitmap,layer.left??0,layer.top??0);
    }
  };
  draw(art.children??[]); art.canvas=composite;
  const result=writePsdUint8Array(art,{generateThumbnail:false,invalidateTextLayers:false});
  const output=preservePsdArt(source,result,untouched,linkedFiles.size > 0);
  const records=parsePsdBinary(output).layers, layers=flatten(art.children??[]);
  const updates=new Map<number,PsdLayerMeta>();
  records.forEach((r,i)=>{
    const l=layers[i], m=metadata.get(l);
    if(!m || l.name!==r.name) throw new Error("同步副本的图层结构校验失败。");
    updates.set(r.key,m);
  });
  return patchPsdMetadata(output,updates);
}
