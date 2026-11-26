import { compositeOwners, isCompositeGroup, type PsdAsset, type PsdLayer } from "../../shared/psd-meta";
import type { PsdCamera } from "./canvas-layout";

export type Point = { x: number; y: number };
export type PixelMask = { width: number; height: number; bits: Uint8Array };
export const isCanvasDrag = (start: Point, current: Point) => Math.hypot(current.x - start.x, current.y - start.y) > 4;
export const psdPoint = (screen: Point, camera: PsdCamera): Point => ({ x: (screen.x - camera.x) / camera.zoom, y: (screen.y - camera.y) / camera.zoom });

export function makePixelMask(rgba: Uint8ClampedArray, width: number, height: number): PixelMask {
  const bits = new Uint8Array(Math.ceil(width * height / 8));
  for (let i = 0; i < width * height; i++) if (rgba[i * 4 + 3] > 0) bits[i >> 3] |= 1 << (i & 7);
  return { width, height, bits };
}
export function maskContains(mask: PixelMask, x: number, y: number): boolean {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
  const index = y * mask.width + x;
  return !!(mask.bits[index >> 3] & (1 << (index & 7)));
}

/** Groups from the PSD root through the current editing scope. */
export function psdScopePath(asset: PsdAsset, scopeKey: number | null): PsdLayer[] {
  const path: PsdLayer[] = [], visited = new Set<number>();
  let key = scopeKey;
  while (key !== null) {
    const layer = asset.layers.find(item => item.key === key);
    if (!layer?.group || isCompositeGroup(layer) || visited.has(key)) return [];
    visited.add(key); path.unshift(layer); key = layer.parentKey;
  }
  return path;
}

/** Normally select the scope's direct child; direct mode keeps the actual visible hit. */
export function psdHitLayer(asset: PsdAsset, scopeKey: number | null, hitKey?: number, direct = false): PsdLayer | null {
  const visited = new Set<number>();
  if (hitKey === undefined) return null;
  let layer = compositeOwners(asset.layers).get(hitKey) ?? asset.layers.find(item => item.key === hitKey);
  if (direct) return layer && !layer.hidden ? layer : null;
  while (layer && !visited.has(layer.key)) {
    if (layer.key === scopeKey) return null;
    if (layer.parentKey === scopeKey) return layer;
    visited.add(layer.key);
    layer = asset.layers.find(item => item.key === layer!.parentKey);
  }
  return null;
}

export async function pickPsdLayer(asset: PsdAsset, point: Point, hasPixel: (layer: PsdLayer, x: number, y: number) => Promise<boolean>): Promise<number | null> {
  if (point.x < 0 || point.y < 0 || point.x >= asset.width || point.y >= asset.height) return null;
  for (const layer of asset.layers) {
    if (layer.hidden || layer.group || !layer.image) continue;
    const x = point.x - layer.left, y = point.y - layer.top;
    if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) continue;
    if (layer.text || await hasPixel(layer, x, y)) return layer.key;
  }
  return null;
}
