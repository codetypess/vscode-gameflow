import { sliceRegion, type NineGrid, type PsdAsset, type SliceRegion } from "../../shared/psd-meta";
import { effectiveExportName, makeSliceExportBatch, MAX_EXPORT_BYTES, psdSliceDirectory, sliceExportIssues, type SliceProductGeometry } from "../../shared/psd-export";
import { compactNineGrid } from "../../shared/nine-grid";
import type { SliceResourceDescription, SliceResourceState } from "../../shared/slice-resources";

export type SliceProduct = SliceResourceState<HTMLCanvasElement>;
const products = new Map<string, { stamp: string; result: Promise<Map<number, SliceProduct>> }>();
export function sliceGenerationStamp(asset: PsdAsset): string {
  return JSON.stringify([asset.documentId, asset.sourceHash, asset.name, asset.atlasName, asset.independentDirectory, asset.layers.map(l => [l.key, l.name, l.metadata.layerId, l.config, l.limitation])]);
}
/** Cache the actual generated canvases: export encodes these same pixels on demand. */
export function generateSliceProducts(asset: PsdAsset): Promise<Map<number, SliceProduct>> {
  const stamp = sliceGenerationStamp(asset), cached = products.get(asset.documentId);
  if (cached?.stamp === stamp) return cached.result;
  const result = (async () => {
    const entries = new Map<number, SliceProduct>(), issues = sliceExportIssues(asset);
    for (const layer of asset.layers.filter(l => l.config.enabled)) {
      const { width, height } = sliceRegion(layer);
      const description: SliceResourceDescription = { path: `${effectiveExportName(asset, layer)}.png`, width, height, nineGrid: layer.config.nineGrid,
        source: { documentId: asset.documentId, psdName: asset.name, sourceHash: asset.sourceHash }, layerId: layer.metadata.layerId, layerName: layer.name, shared: layer.config.shared === true };
      try {
        const directory = psdSliceDirectory(asset, layer.config.shared);
        description.path = `${directory ? `${directory}/` : ""}${effectiveExportName(asset, layer)}.png`;
        const issue = issues.filter(i => i.keys.includes(layer.key));
        if (issue.length) throw new Error(issue.map(i => i.message).join("\n"));
        const source = await loadSliceImage(layer.image!);
        if (source.naturalWidth !== layer.width || source.naturalHeight !== layer.height) throw new Error("图层像素尺寸与 PSD 描述不一致。");
        const { pixels, geometry } = sliceImageProduct(source, sliceRegion(layer), layer.config.nineGrid);
        entries.set(layer.key, { status: "ready", description: { ...description, ...geometry }, pixels });
      } catch (error) { entries.set(layer.key, { status: "error", description, error: error instanceof Error ? error.message : String(error) }); }
    }
    return entries;
  })();
  products.set(asset.documentId, { stamp, result });
  if (products.size > 32) products.delete(products.keys().next().value!);
  return result;
}

/** One rendering path for previews, nine-grid sampling and exported PNGs. */
export function sliceImageCanvas(source: HTMLImageElement, region: SliceRegion, canvas = document.createElement("canvas")): HTMLCanvasElement {
  canvas.width = region.width; canvas.height = region.height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("无法创建切图画布。");
  ctx.drawImage(source, -region.x, -region.y);
  return canvas;
}
export function loadSliceImage(image: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const source = new Image(); source.onload = () => resolve(source); source.onerror = () => reject(new Error("切图图片读取失败。")); source.src = image;
  });
}

export function sliceImageProduct(source: HTMLImageElement, region: SliceRegion, nineGrid: NineGrid | null): { pixels: HTMLCanvasElement; geometry: SliceProductGeometry } {
  const canvas = sliceImageCanvas(source, region);
  const { width, height } = canvas;
  if (!nineGrid) return { pixels: canvas, geometry: { width, height, nineGrid } };
  const data = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const plan = compactNineGrid(new Uint32Array(data.buffer, data.byteOffset, width * height), width, height, nineGrid);
  const geometry = { width: plan.width, height: plan.height, nineGrid: plan.nineGrid };
  if (width === plan.width && height === plan.height) return { pixels: canvas, geometry };
  const pixels = document.createElement("canvas"); pixels.width = plan.width; pixels.height = plan.height;
  const ctx = pixels.getContext("2d"); if (!ctx) throw new Error("无法创建压缩切图画布。");
  for (const y of plan.rows) for (const x of plan.columns) {
    ctx.drawImage(canvas, x.src, y.src, x.length, y.length, x.dst, y.dst, x.length, y.length);
  }
  return { pixels, geometry: { ...geometry, logicalSize: { width, height } } };
}

export async function renderSliceExportBatch(asset: PsdAsset) {
  const issues = sliceExportIssues(asset); if (issues.length) throw new Error(issues.map(i => i.message).join("\n"));
  const images = new Map<number, { image: string; geometry: SliceProductGeometry }>();
  let bytes = 0;
  for (const [key, product] of await generateSliceProducts(asset)) {
    if (product.status !== "ready") throw new Error(product.status === "error" ? product.error : "切图尚未生成。");
    const image = product.pixels.toDataURL("image/png");
    bytes += image.length * .75;
    if (bytes > MAX_EXPORT_BYTES) throw new Error("切图总数据超过 48 MB，请分批导出。");
    images.set(key, { image, geometry: product.description });
  }
  return makeSliceExportBatch(asset, images);
}
