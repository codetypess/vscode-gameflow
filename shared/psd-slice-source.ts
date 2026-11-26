import type { PsdAsset, PsdLayer, SliceRegion } from "./psd-meta";

export function needsPhotoCraft(layer: PsdLayer, nativeGroups: boolean) {
  return !!(layer.limitation || layer.config.additionalLayerIds?.length || (layer.group && (nativeGroups || !layer.image)));
}

export function sliceSourceKeys(asset: PsdAsset, primary: PsdLayer): number[] {
  const keys = new Set([primary.key]);
  for (const id of primary.config.additionalLayerIds ?? []) {
    const matches = asset.layers.filter(layer => layer.metadata.layerId === id);
    if (matches.length !== 1) throw new Error(`合成图层 ${id} 已丢失或身份重复，请重新选择。`);
    keys.add(matches[0].key);
  }
  return [...keys].sort((a, b) => a - b);
}

export type SlicePixels = Pick<PsdLayer, "left" | "top" | "width" | "height"> & { image: string };

/** Region offsets on disk are relative to the PSD layer, even when effects extend past it. */
export function translateRegion(region: SliceRegion, from: Pick<PsdLayer, "left" | "top">, to: Pick<PsdLayer, "left" | "top">): SliceRegion {
  return { ...region, x: region.x + from.left - to.left, y: region.y + from.top - to.top };
}

export function renderedSliceLayer(layer: PsdLayer, pixels: SlicePixels): PsdLayer {
  const region = layer.config.region && translateRegion(layer.config.region, layer, pixels);
  return { ...layer, ...pixels, config: { ...layer.config, region } };
}
