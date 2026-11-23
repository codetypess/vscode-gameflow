import { builtinImage, builtinPath, BUILTIN_SOURCE, type BuiltinImage } from "./builtin-image";
import { DEFAULT_IMAGE_ID, rasterSize } from "./image-rendering";
import type { BuiltinSlice, NineGrid, PsdLayer } from "./psd-meta";

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
  if (size.width !== pixels.width || size.height !== pixels.height || origin.catalog !== await catalogHash(builtinImage(origin.id)!)) return;
  if (origin.pixels === await digest(Uint8Array.from(pixels.data))) return { id: origin.id, width: origin.width, height: origin.height };
}

export function sameGrid(a: NineGrid | null, b: NineGrid | null) {
  return a === b || !!a && !!b && a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right && a.repeat === b.repeat;
}

export function builtinSlice(layer: PsdLayer) {
  const ref = layer.verifiedBuiltin;
  if (!ref || layer.group || layer.text || layer.limitation) return;
  const region = layer.config.region;
  if (region && (region.x !== 0 || region.y !== 0 || region.width !== layer.width || region.height !== layer.height)) return;
  if (sameGrid(layer.config.nineGrid, builtinImage(ref.id)!.nineGrid)) return ref;
}

export function builtinSliceDescription(ref: BuiltinSlice) {
  const image = builtinImage(ref.id)!;
  const size = image.id === DEFAULT_IMAGE_ID ? rasterSize(ref.width, ref.height) : image;
  return { path: builtinPath(ref.id, ref), width: size.width, height: size.height, nineGrid: image.nineGrid,
    source: BUILTIN_SOURCE, layerId: ref.id, layerName: image.name, shared: true };
}
