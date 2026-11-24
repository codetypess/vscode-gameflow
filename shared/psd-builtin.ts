import { builtinImage, builtinPath, BUILTIN_SOURCE, type BuiltinImage } from "./builtin-image";
import { rasterSize } from "./image-rendering";
import type { BuiltinSlice, NineGrid, PsdLayer } from "./psd-meta";

// Generated PSD layers retain the guides of their original built-in catalog.
const previousDefaultGrids = new Map<string, NineGrid | null>([
  ["3dccf74ca613bd63269ffb5762dda833b4314c84a0f9a91e5946c16f24fb1e07", null],
  ["a6f05a18559c38595b2b3a84e60d4183bbd65a14a55b80c23f61abd85a83f31f", { top: 18, right: 18, bottom: 18, left: 18, repeat: false }],
  ["413e696ebaacc4d4f0ba04f7ca9952e06dc55609e96b39d036190d9e51c52f1f", { top: 2, right: 2, bottom: 2, left: 2, repeat: false }],
  ["92ee686ed8b984fbced21a079d5dbff9c4650ce870f01b4602371b73ed534b92", { top: 32, right: 28, bottom: 28, left: 30, repeat: false }],
  ["91fb827d08ae53c8f25a004e531346e3ffdfe9ae0e0bf08c511b8398c8dd0449", { top: 34, right: 38, bottom: 0, left: 0, repeat: false }]
]);

export function validBuiltinSlice(value: unknown): value is BuiltinSlice {
  const ref = value as Partial<BuiltinSlice> | null;
  return !!ref && typeof ref.id === "string" && !!builtinImage(ref.id) &&
    [ref.width, ref.height].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 4096);
}

async function digest(data: Uint8Array<ArrayBuffer> | Uint8ClampedArray<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), n => n.toString(16).padStart(2, "0")).join("");
}
const catalogHashes = new Map<string, Promise<string>>();
function catalogHash(image: BuiltinImage) {
  let hash = catalogHashes.get(image.id);
  if (!hash) {
    hash = digest(new TextEncoder().encode(image.dataUri));
    catalogHashes.set(image.id, hash);
  }
  return hash;
}

export async function builtinOrigin(image: BuiltinImage, width: number, height: number, pixels: Uint8ClampedArray<ArrayBuffer>) {
  return { id: image.id, width, height, catalog: await catalogHash(image), pixels: await digest(pixels) };
}

export async function verifyBuiltinOrigin(value: unknown, pixels: { width: number; height: number; data: ArrayLike<number> }) {
  if (!validBuiltinSlice(value)) return;
  const origin = value as BuiltinSlice & { catalog?: unknown; pixels?: unknown };
  const size = rasterSize(origin.width, origin.height);
  if (size.width !== pixels.width || size.height !== pixels.height) return;
  const legacy = origin.id === "image/default" && typeof origin.catalog === "string" && previousDefaultGrids.has(origin.catalog);
  if (!legacy && origin.catalog !== await catalogHash(builtinImage(origin.id)!)) return;
  if (origin.pixels === await digest(Uint8Array.from(pixels.data))) return { id: origin.id, width: origin.width, height: origin.height };
}

export function sameGrid(a: NineGrid | null, b: NineGrid | null) {
  return a === b || !!a && !!b && a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right && a.repeat === b.repeat;
}

/** Raster layers reserve one center pixel and give leading borders priority, as in nineGridPatches. */
export function builtinLayerGrid(grid: NineGrid | null, width: number, height: number): NineGrid | null {
  if (!grid) return null;
  const left = Math.min(grid.left, width - 1), top = Math.min(grid.top, height - 1);
  return { left, top, right: Math.min(grid.right, width - 1 - left),
    bottom: Math.min(grid.bottom, height - 1 - top), repeat: grid.repeat };
}

export function builtinSlice(layer: PsdLayer) {
  const ref = layer.verifiedBuiltin;
  if (!ref || layer.group || layer.text || layer.limitation) return;
  const region = layer.config.region;
  if (region && (region.x !== 0 || region.y !== 0 || region.width !== layer.width || region.height !== layer.height)) return;
  const origin = layer.metadata.builtinOrigin as { catalog?: string } | undefined;
  const catalog = origin?.catalog;
  const previousGrid = ref.id === "image/default" && catalog ? previousDefaultGrids.get(catalog) : undefined;
  const grid = previousGrid === undefined ? builtinImage(ref.id)!.nineGrid : previousGrid;
  if (sameGrid(layer.config.nineGrid, builtinLayerGrid(grid, layer.width, layer.height))) return ref;
}

export function builtinSliceDescription(ref: BuiltinSlice) {
  const image = builtinImage(ref.id)!;
  return { path: builtinPath(ref.id), width: image.width, height: image.height, nineGrid: image.nineGrid,
    source: BUILTIN_SOURCE, layerId: ref.id, layerName: image.name, shared: true };
}
