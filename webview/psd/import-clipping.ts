import type { Layer, PixelData } from "ag-psd";

/** Bake supported raster masks in PSD document coordinates, while preserving the editable layer frame. */
export function importPixels(layer: Layer, base?: Layer): PixelData {
  const pixels = layer.imageData!;
  const mask = layer.mask;
  const bitmap = mask && !mask.disabled && !mask.positionRelativeToLayer && !mask.userMaskFeather ? mask.imageData : undefined;
  // Photoshop clips against the base's alpha after its own raster mask.
  const clip = layer.clipping && base?.imageData ? importPixels(base) : undefined;
  if (!bitmap && !clip) return pixels;
  const data = new Uint8ClampedArray(pixels.data);
  for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
    const dx = x + (layer.left ?? 0), dy = y + (layer.top ?? 0);
    let alpha = data[(y * pixels.width + x) * 4 + 3];
    if (bitmap) {
      const mx = dx - (mask!.left ?? 0), my = dy - (mask!.top ?? 0);
      const gray = mx < 0 || my < 0 || mx >= bitmap.width || my >= bitmap.height
        ? mask!.defaultColor ?? 0 : bitmap.data[(my * bitmap.width + mx) * 4];
      alpha *= 1 - (mask!.userMaskDensity ?? 1) * (1 - gray / 255);
    }
    if (clip) {
      const bx = dx - (base!.left ?? 0), by = dy - (base!.top ?? 0);
      alpha *= bx < 0 || by < 0 || bx >= clip.width || by >= clip.height ? 0 : clip.data[(by * clip.width + bx) * 4 + 3] / 255;
    }
    data[(y * pixels.width + x) * 4 + 3] = alpha;
  }
  return { width: pixels.width, height: pixels.height, data };
}
