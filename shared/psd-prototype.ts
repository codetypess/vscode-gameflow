import type { GameFlowPage } from "./model";
import { IMAGE_SLOT_FIELDS, type ImageSlotField } from "./image-slots";
import { effectiveExportName, psdSliceDirectory } from "./psd-export";
import type { PsdAsset } from "./psd-meta";
import { sliceResourcePath } from "./slice-resources";
export interface PrototypeLayerRef { documentId:string; pageId:string; nodeId:string; slot?:ImageSlotField }
export function prototypeLayerRef(value:unknown):value is PrototypeLayerRef {
  if(!value || typeof value!=="object")return false;
  const ref=value as PrototypeLayerRef;
  return [ref.documentId,ref.pageId,ref.nodeId].every(v=>typeof v==="string"&&!!v)&&(ref.slot===undefined||IMAGE_SLOT_FIELDS.includes(ref.slot));
}
/** Only explicit stable identities link art to slots; duplicate names never identify controls. */
export function bindPrototypePsd(page:GameFlowPage,documentId:string,asset:PsdAsset):GameFlowPage {
  const bindings=new Map<string,Map<ImageSlotField,PsdAsset["layers"][number]>>();
  for(const layer of asset.layers){const ref=layer.metadata.prototype;if(!prototypeLayerRef(ref)||ref.documentId!==documentId||ref.pageId!==page.id||!ref.slot||!layer.config.enabled)continue;const slots=bindings.get(ref.nodeId)??new Map();if(slots.has(ref.slot))throw new Error("同一控件图片槽位关联了多个 PSD 图层，请先处理重复身份。");slots.set(ref.slot,layer);bindings.set(ref.nodeId,slots);}
  return {...page,nodes:page.nodes.map(node=>{
    const slots=bindings.get(node.id);if(!slots)return node;const next={...node};
    for(const[field,layer]of slots){if(field==="image"?node.type!=="image":node.type!=="button")continue;next[field]={...node[field],art:{path:sliceResourcePath(psdSliceDirectory(asset,layer.config.shared),effectiveExportName(asset,layer)),source:{documentId:asset.documentId,layerId:layer.metadata.layerId}}};}
    return next;
  })};
}
