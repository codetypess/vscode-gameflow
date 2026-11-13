import type { PsdAsset, PsdLayer } from "../../shared/psd-meta";
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
