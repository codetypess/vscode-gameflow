import type { PsdLayer, SliceRegion } from "./psd-meta";

export function needsPhotoCraft(layer: PsdLayer, nativeGroups: boolean) {
  return !!(layer.limitation || (layer.group && (nativeGroups || !layer.image)));
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
