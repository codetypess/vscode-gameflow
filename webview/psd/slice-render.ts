import { sliceRegion, type PsdAsset, type SliceRegion } from "../../shared/psd-meta";
import { makeSliceExportBatch, MAX_EXPORT_BYTES, sliceExportIssues } from "../../shared/psd-export";

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
export async function renderSliceExportBatch(asset: PsdAsset) {
  const issues = sliceExportIssues(asset); if (issues.length) throw new Error(issues.map(i => i.message).join("\n"));
  const images = new Map<number, string>();
  let bytes = 0;
  for (const layer of asset.layers) if (layer.config.enabled && !layer.config.region) bytes += (layer.image?.length ?? 0) * .75;
  for (const layer of asset.layers) if (layer.config.enabled && layer.config.region) {
    const source = await loadSliceImage(layer.image!);
    const image = sliceImageCanvas(source, sliceRegion(layer)).toDataURL("image/png");
    bytes += image.length * .75;
    if (bytes > MAX_EXPORT_BYTES) throw new Error("切图总数据超过 48 MB，请分批导出。");
    images.set(layer.key, image);
  }
  return makeSliceExportBatch(asset, images);
}
