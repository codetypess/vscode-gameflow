import type { GameFlowNode, GameFlowPage } from "./model";
import { IMAGE_SLOT_FIELDS, type ImageSlotField } from "./image-slots";
import { layerNameKey, psdLayerPath } from "./psd-export";
import { enabledSliceLayers, type PsdAsset, type PsdLayer } from "./psd-meta";
import { psdSlotField } from "./psd-slot-markers";
import { isSliceResourcePath } from "./slice-resources";

export interface PrototypeLayerRef { documentId: string; pageId: string; nodeId: string; slot?: ImageSlotField }
export function prototypeLayerRef(value: unknown): value is PrototypeLayerRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as PrototypeLayerRef;
  return [ref.documentId, ref.pageId, ref.nodeId].every(v => typeof v === "string" && !!v) &&
    (ref.slot === undefined || IMAGE_SLOT_FIELDS.includes(ref.slot));
}

function matchSlot(layer: PsdLayer, layers: ReadonlyMap<number, PsdLayer>, page: GameFlowPage, documentId: string):
    { node: GameFlowNode; field: ImageSlotField } | undefined {
  const parent = layer.parentKey === null ? undefined : layers.get(layer.parentKey);
  const marker = psdSlotField(layer.name);
  if (marker && !parent?.group) return;
  const ref = layer.metadata.prototype;
  const legacy = prototypeLayerRef(ref) && ref.documentId === documentId && ref.pageId === page.id ? ref : undefined;
  const field = marker ?? legacy?.slot ?? "image";
  const publicName = layerNameKey(marker && parent ? parent.name : layer.name);
  const candidates = page.nodes.filter(node => node.type === (field === "image" ? "image" : "button"));
  const named = candidates.filter(node => layerNameKey(node.name) === publicName);
  const byId = legacy?.slot === field ? candidates.find(node => node.id === legacy.nodeId) : undefined;
  if (named.length === 1) return { node: named[0], field };
  if (named.length > 1) {
    if (byId && named.includes(byId)) return { node: byId, field };
    throw new Error(`页面有多个同名控件“${publicName}”，请区分控件名与对应 PSD 图层名。`);
  }
  // Older generated PSDs embed slot identities and sometimes decorate group names with the runtime class.
  if (byId && (!marker || publicName === `${byId.name} (${byId.type === "button" ? "UIButton" : "UIImage"})`)) return { node: byId, field };
}

/** Resolve public PSD names on each load. Embedded identities also support older generated PSDs. */
export function bindPrototypePsd(page: GameFlowPage, documentId: string, asset: PsdAsset): GameFlowPage {
  const layers = new Map(asset.layers.map(layer => [layer.key, layer]));
  const bindings = new Map<string, Map<ImageSlotField, PsdLayer>>();
  for (const layer of enabledSliceLayers(asset)) {
    const target = matchSlot(layer, layers, page, documentId);
    if (!target) continue;
    const { node, field } = target;
    const slots = bindings.get(node.id) ?? new Map<ImageSlotField, PsdLayer>();
    if (slots.has(field)) throw new Error(`“${node.name}”的 ${layer.name} 对应多个 PSD 图层，请保留一个导出来源。`);
    slots.set(field, layer);
    bindings.set(node.id, slots);
  }
  return { ...page, nodes: page.nodes.map(node => {
    const result = { ...node };
    for (const field of IMAGE_SLOT_FIELDS) {
      const layer = bindings.get(node.id)?.get(field);
      const slot = node[field];
      if (layer) {
        const path = psdLayerPath(asset, layer);
        if (!isSliceResourcePath(path)) throw new Error("切图资源路径无效。");
        result[field] = { ...slot, art: { path, source: { documentId: asset.documentId, layerId: layer.metadata.layerId } } };
      } else if (slot?.art) {
        result[field] = slot.builtin ? { builtin: slot.builtin } : null;
      }
    }
    return result;
  }) };
}
