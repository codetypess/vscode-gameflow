import type { PsdLayer } from "../../shared/psd-meta";
import { makePixelMask, maskContains, type PixelMask } from "./layer-hit-test";

/** Transient masks share the lifetime of one loaded PSD; source PNGs never change during configuration edits. */
export function createPixelHitCache() {
  const cache = new Map<number, Promise<PixelMask | null>>();
  const decode = async (layer: PsdLayer): Promise<PixelMask | null> => {
    const image = new Image(), canvas = document.createElement("canvas");
    try {
      image.src = layer.image!; await image.decode();
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return null;
      context.drawImage(image, 0, 0);
      return makePixelMask(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    } catch { return null; }
    finally { canvas.width = canvas.height = 0; }
  };
  return async (layer: PsdLayer, x: number, y: number) => {
    let promise = cache.get(layer.key);
    if (!promise) { promise = decode(layer); cache.set(layer.key, promise); }
    const mask = await promise;
    return mask ? maskContains(mask, x, y) : false;
  };
}
