import { readPsd, writePsdUint8Array, type Layer, type LinkedFile } from "ag-psd";
import type { Frame } from "../../shared/model";
import type { PsdComponentSource } from "../../shared/psd-meta";
import { mapPoint, type Matrix } from "../../shared/ui-transform";

export async function embedPsdGroup(group: Layer, component: string, fileName: string, frame: Frame,
  placement?: { matrix: Matrix; composite?: HTMLCanvasElement; preserveLayerIds?: boolean; linkedFiles?: LinkedFile[] }) {
  const frames = [frame];
  function collect(layer: Layer) {
    const { left = 0, top = 0 } = layer;
    const bitmap = layer.canvas ?? layer.imageData;
    if (bitmap) frames.push({ x: left, y: top, width: bitmap.width, height: bitmap.height });
    layer.children?.forEach(collect);
  }
  group.children?.forEach(collect);
  const left = Math.floor(Math.min(...frames.map(bounds => bounds.x)));
  const top = Math.floor(Math.min(...frames.map(bounds => bounds.y)));
  const right = Math.max(left + 1, Math.ceil(Math.max(...frames.map(bounds => bounds.x + bounds.width))));
  const bottom = Math.max(top + 1, Math.ceil(Math.max(...frames.map(bounds => bounds.y + bounds.height))));
  const width = right - left, height = bottom - top;
  if (width > 4096 || height > 4096 || width * height > 8_000_000) throw new Error("组件智能对象尺寸超出 PSD 生成范围。");
  const bitmap = document.createElement("canvas");
  bitmap.width = width;
  bitmap.height = height;
  const ctx = bitmap.getContext("2d")!;

  function localize(layer: Layer, visible: boolean): Layer {
    const { id, text, children, ...rest } = layer;
    const retained = placement?.preserveLayerIds && id !== undefined ? { ...rest, id } : rest;
    if (children) return { ...retained, children: children.map(child => localize(child, visible && !layer.hidden)) };
    const x = (layer.left ?? 0) - left, y = (layer.top ?? 0) - top;
    if (!placement?.composite && visible && !layer.hidden && layer.canvas) ctx.drawImage(layer.canvas, x, y);
    if (!placement?.composite && visible && !layer.hidden && !layer.canvas && layer.imageData) {
      const pixels = layer.imageData;
      const canvas = document.createElement("canvas");
      canvas.width = pixels.width;
      canvas.height = pixels.height;
      canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
      ctx.drawImage(canvas, x, y);
    }
    const transform = text?.transform?.slice();
    if (transform) {
      transform[4] -= left;
      transform[5] -= top;
    }
    if (layer.placedLayer && (left || top)) {
      const offset = (points: number[]) => points.map((value, i) => value - (i % 2 ? top : left));
      retained.placedLayer = { ...layer.placedLayer, transform: offset(layer.placedLayer.transform),
        nonAffineTransform: layer.placedLayer.nonAffineTransform && offset(layer.placedLayer.nonAffineTransform) };
    }
    if (layer.mask && !layer.mask.positionRelativeToLayer && (left || top))
      retained.mask = { ...layer.mask, left: (layer.mask.left ?? 0) - left, top: (layer.mask.top ?? 0) - top, right: undefined, bottom: undefined };
    return { ...retained, left: x, top: y, right: undefined, bottom: undefined, ...(text ? { text: { ...text, transform } } : {}) };
  }

  const children = group.children?.map(layer => localize(layer, true)) ?? [];
  if (placement?.composite) ctx.drawImage(placement.composite, -left, -top);
  const data = writePsdUint8Array({ width, height, canvas: bitmap, children: children.length ? children : [{ name: "内容", canvas: bitmap }], linkedFiles: placement?.linkedFiles },
    { generateThumbnail: false, invalidateTextLayers: false });
  const identity = new TextEncoder().encode(component);
  const contents = new Uint8Array(identity.length + 1 + data.length);
  contents.set(identity);
  contents.set(data, identity.length + 1);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", contents));
  const hex = Array.from(digest.subarray(0, 16), value => value.toString(16).padStart(2, "0")).join("");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const file: LinkedFile = { id, name: fileName, type: "8BPS", data };
  const corners = [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  const points = placement ? corners.map(point => mapPoint(placement.matrix, point)) : corners;
  const x = Math.floor(Math.min(...points.map(point => point.x))), y = Math.floor(Math.min(...points.map(point => point.y)));
  const layer: Layer = { id: group.id, name: group.name, hidden: group.hidden, left: x, top: y, canvas: bitmap,
    placedLayer: { id, placed: crypto.randomUUID(), type: "raster", width, height, transform: points.flatMap(point => [point.x, point.y]) } };
  if (placement) {
    const raster = document.createElement("canvas");
    raster.width = Math.max(1, Math.ceil(Math.max(...points.map(point => point.x))) - x);
    raster.height = Math.max(1, Math.ceil(Math.max(...points.map(point => point.y))) - y);
    if (raster.width > 4096 || raster.height > 4096 || raster.width * raster.height > 8_000_000)
      throw new Error("组件智能对象变换后超出图层尺寸范围。");
    const paint = raster.getContext("2d")!;
    paint.translate(-x, -y);
    paint.transform(...placement.matrix);
    paint.drawImage(bitmap, left, top);
    layer.canvas = raster;
  }
  return { layer, file };
}

export function embeddedPsdFiles(files: LinkedFile[] | undefined) {
  return new Map((files ?? []).filter(file => !file.linkedFile && file.data?.length &&
    file.data[0] === 56 && file.data[1] === 66 && file.data[2] === 80 && file.data[3] === 83).map(file => [file.id, file]));
}

export interface ComponentPsd {
  name: string;
  embeddedName: string;
  bytes: Uint8Array;
  origin: PsdComponentSource;
}

export async function psdContentHash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function placeComponentPsd(source: ComponentPsd, transform: number[], name: string) {
  const psd = readPsd(source.bytes, { useImageData: true, skipLayerImageData: true, skipThumbnail: true,
    totalMemoryLimit: 384 * 1024 * 1024 });
  const pixels = psd.imageData;
  if (!pixels) throw new Error("组件 PSD 缺少已保存的合成图：" + source.name);
  const [x0, y0, x1, y1, x2, y2, x3, y3] = transform;
  if (Math.abs(x1 + x3 - x0 - x2) > .01 || Math.abs(y1 + y3 - y0 - y2) > .01)
    throw new Error("请在 Photoshop 中更新带透视变换的智能对象：" + name);
  const left = Math.floor(Math.min(x0, x1, x2, x3)), top = Math.floor(Math.min(y0, y1, y2, y3));
  const width = Math.max(1, Math.ceil(Math.max(x0, x1, x2, x3)) - left);
  const height = Math.max(1, Math.ceil(Math.max(y0, y1, y2, y3)) - top);
  if (width > 4096 || height > 4096 || width * height > 8_000_000)
    throw new Error("组件智能对象超出图层尺寸范围：" + name);
  const bitmap = document.createElement("canvas");
  bitmap.width = pixels.width;
  bitmap.height = pixels.height;
  bitmap.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.setTransform((x1 - x0) / psd.width, (y1 - y0) / psd.width, (x3 - x0) / psd.height, (y3 - y0) / psd.height, x0 - left, y0 - top);
  context.drawImage(bitmap, 0, 0);
  const hex = await psdContentHash(new TextEncoder().encode(JSON.stringify(source.origin)));
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  const file: LinkedFile = { id, name: source.embeddedName, type: "8BPS", data: source.bytes };
  const layer: Layer = { name, left, top, canvas,
    placedLayer: { id, placed: crypto.randomUUID(), type: "raster", width: psd.width, height: psd.height, transform } };
  return { layer, file };
}
