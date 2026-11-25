import type { Layer, PixelData } from "ag-psd";

// Generated cell masks use document coordinates and a black exterior.
export function readableCellMask(layer: Layer) {
  const mask = layer.mask, bitmap = mask?.imageData ?? mask?.canvas;
  return !!mask && !!bitmap && !mask.disabled && !mask.positionRelativeToLayer && !mask.fromVectorData &&
    !mask.defaultColor && !mask.userMaskFeather && (mask.userMaskDensity ?? 1) === 1 &&
    mask.left === layer.left && mask.top === layer.top &&
    bitmap.width === (layer.right ?? 0) - (layer.left ?? 0) && bitmap.height === (layer.bottom ?? 0) - (layer.top ?? 0);
}

export function maskedCellPixels(pixels: PixelData, mask: PixelData) {
  const data = new Uint8ClampedArray(pixels.data);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = data[i + 3] * mask.data[i] / 255;
  return new ImageData(data, pixels.width, pixels.height);
}
