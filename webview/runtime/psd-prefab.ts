import type { GameFlowDocument, GameFlowPage } from "../../shared/model";
import { makeNode } from "../../shared/editor-ops";
import { psdTree } from "../../shared/page-sync";
import { psdSlotField } from "../../shared/psd-slot-markers";
import { enabledSliceLayers } from "../../shared/psd-meta";
import { resourceUuid, type ExportImageResolver } from "../../shared/prefab-export";
import { builtinImage, builtinPath } from "../../shared/image-slots";
import { builtinSlice } from "../../shared/psd-builtin";
import { draftStamp } from "../../shared/psd-draft";
import { psdLayerPath } from "../../shared/psd-export";
import { generateSliceProducts } from "../psd/slice-render";
import { requestPsd } from "./page-psd";
import { isBrowserPreview } from "../vscode-api";

export async function readPsdPrefabSource(doc: GameFlowDocument, page: GameFlowPage) {
  if (!isBrowserPreview && !document.querySelector('meta[name="gameflow-page-psd-sync"][content="1"]')) {
    throw new Error("请重新加载 VS Code 窗口以启用 PSD 同步。");
  }
  const read = async () => {
    const result = await requestPsd({action:"review",pageId:page.id,expected:page.artPsd});
    if (!result || result.asset.documentId !== page.artPsd?.documentId) throw new Error("页面 PSD 绑定已变化。");
    return result.asset;
  };
  const asset = await read();
  const tree = psdTree(doc.documentId,page,asset,layer=>resourceUuid(asset.documentId + "/" + layer.metadata.layerId).slice(0,8),undefined,true);
  if (!tree.length) throw new Error("PSD 中没有可同步的控件、文字或已启用的切图。");
  const byId = new Map(tree.map(node=>[node.id,node]));
  const layers = new Map(asset.layers.map(layer=>[layer.metadata.layerId,layer]));
  const slices = enabledSliceLayers(asset);
  const projected:GameFlowPage = {
    ...page,frame:{...page.frame,width:asset.width,height:asset.height},
    nodes:tree.map(node=>{
      const parent = byId.get(node.parent)?.frame;
      const layer = layers.get(node.layer!)!;
      const control = {...makeNode(node.type,node.id,0,0), name:node.name, parentId:node.parent || undefined,
        variableName:node.variable, hidden:layer.hidden, text:node.text || undefined,
        frame:{...node.frame,x:node.frame.x-(parent?.x??0),y:node.frame.y-(parent?.y??0)}};
      if (node.type==="image" || node.type==="button") {
        delete control.image;
        delete control.normalSkin;
        const slots = slices.filter(l=>l.parentKey===layer.key && psdSlotField(l.name));
        if (node.type==="image" && !slots.length && layer.config.enabled) slots.push(layer);
        const seen = new Set<string>();
        for (const slot of slots) {
          const field = psdSlotField(slot.name) ?? "image";
          if (seen.has(field)) throw new Error(node.name+" 的 PSD 切图槽位重复："+slot.name);
          seen.add(field);
          control[field]={art:{path:psdLayerPath(asset,slot),source:{documentId:asset.documentId,layerId:slot.metadata.layerId}}};
        }
      }
      return control;
    })
  };
  const products = await generateSliceProducts(asset);
  const resolve: ExportImageResolver = async ref => {
    const layer = ref.source && layers.get(ref.source.layerId);
    const product = layer && products.get(layer.key);
    if (!product || product.status!=="ready") return {status:"error",error:product?.status==="error"?product.error:"未找到 PSD 切图。"};
    const builtin = builtinSlice(layer);
    const image = builtin && product.description.path===builtinPath(builtin.id) ? builtinImage(builtin.id)!.dataUri : product.pixels.toDataURL("image/png");
    return {status:"ready",image:{path:ref.path,description:product.description,base64:image.split(",")[1]}};
  };
  const stamp = draftStamp(asset);
  return {page:projected,asset,resolve,verify:async()=>{
    if (draftStamp(await read())!==stamp) throw new Error("PSD 或切图配置已变化，请重新比较。");
  }};
}
