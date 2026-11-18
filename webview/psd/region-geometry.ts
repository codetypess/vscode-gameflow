import { MAX_SLICE_SIZE, validSliceRegion, type SliceRegion } from "../../shared/psd-meta";

export type RegionEdge = "left" | "right" | "top" | "bottom";
export type RegionCamera = { x: number; y: number; zoom: number };
export const REGION_EDGES: { edge: RegionEdge; label: string }[] = [{ edge: "left", label: "左" }, { edge: "right", label: "右" }, { edge: "top", label: "上" }, { edge: "bottom", label: "下" }];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clampZoom = (value: number) => clamp(value, .01, 16);

/** Moving a single edge preserves the opposite edge and valid export geometry. */
export function resizeSliceRegion(region: SliceRegion, edge: RegionEdge, delta: number, minimum = { width: 1, height: 1 }): SliceRegion {
  if (!validSliceRegion(region) || !Number.isFinite(delta)) return region;
  const horizontal = edge === "left" || edge === "right", start = horizontal ? region.x : region.y;
  const size = horizontal ? region.width : region.height, other = horizontal ? region.height : region.width;
  const max = Math.min(MAX_SLICE_SIZE, Math.floor(8_000_000 / other));
  const min = clamp(horizontal ? minimum.width : minimum.height, 1, max);
  const leading = edge === "left" || edge === "top", end = start + size;
  const nextStart = leading ? clamp(start + Math.round(delta), Math.max(-MAX_SLICE_SIZE, end - max), Math.min(MAX_SLICE_SIZE, end - min)) : start;
  const nextSize = leading ? end - nextStart : clamp(size + Math.round(delta), min, max);
  return horizontal ? { ...region, x: nextStart, width: nextSize } : { ...region, y: nextStart, height: nextSize };
}
export function fitRegionCamera(viewport: { width: number; height: number }, region: SliceRegion): RegionCamera {
  const zoom = clampZoom(Math.min(2, (viewport.width - 48) / region.width, (viewport.height - 48) / region.height));
  return { x: (viewport.width - region.width * zoom) / 2, y: (viewport.height - region.height * zoom) / 2, zoom };
}
export function zoomRegionCamera(camera: RegionCamera, point: { x: number; y: number }, requested: number): RegionCamera {
  const zoom = clampZoom(requested);
  return { x: point.x - (point.x - camera.x) / camera.zoom * zoom, y: point.y - (point.y - camera.y) / camera.zoom * zoom, zoom };
}
/** Keep source pixels stationary while the export origin moves with a leading edge. */
export function resizedRegionCamera(camera: RegionCamera, before: SliceRegion, after: SliceRegion): RegionCamera {
  return { ...camera, x: camera.x + (after.x - before.x) * camera.zoom, y: camera.y + (after.y - before.y) * camera.zoom };
}
