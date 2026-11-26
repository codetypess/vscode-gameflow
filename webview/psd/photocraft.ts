import type { PsdAsset, PsdLayer } from "../../shared/psd-meta";
import type { SlicePixels } from "../../shared/psd-slice-source";
import type { HostToWebviewMessage, WebviewToHostMessage } from "../../shared/protocol";

type RenderRequest = Extract<WebviewToHostMessage, { type: "psdRenderSlice" | "psdRenderVisibility" }>;
let send: ((request: RenderRequest) => void) | undefined;
export const hasPhotoCraftHost = () => !!send;
export function connectPhotoCraft(post: (request: RenderRequest) => void) { send = post; }

export function requestRender(sourceHash: string, keys: number[], type: RenderRequest["type"] = "psdRenderSlice", base64?: string): Promise<string> {
  if (!send) return Promise.reject(new Error("合成切图需要在 VS Code 中使用 PhotoCraft CLI。"));
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const cleanup = () => { clearTimeout(timer); window.removeEventListener("message", receive); };
    const receive = ({ data }: MessageEvent<HostToWebviewMessage>) => {
      if (data?.type !== (type === "psdRenderSlice" ? "psdRenderSliceResult" : "psdRenderVisibilityResult") || data.requestId !== requestId) return;
      cleanup();
      if (data.image) resolve(data.image);
      else reject(new Error(data.error || "PhotoCraft 未返回图像。"));
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("PhotoCraft 渲染超时。")); }, 75000);
    window.addEventListener("message", receive);
    send!({ type, requestId, sourceHash, keys, base64 });
  });
}

export async function trimSlice(data: string, width: number, height: number): Promise<SlicePixels> {
  const source = new Image();
  source.src = data;
  await source.decode();
  if (source.naturalWidth !== width || source.naturalHeight !== height) throw new Error("PhotoCraft 返回的画布尺寸与 PSD 不符。");
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!pixels[(y * width + x) * 4 + 3]) continue;
      left = Math.min(x, left); right = Math.max(x, right);
      top = Math.min(y, top); bottom = y;
    }
  }
  if (right < left) throw new Error("所选图层合成后完全透明。剪贴层或调整层可选择包含底层的组导出。");
  canvas.width = right - left + 1; canvas.height = bottom - top + 1;
  ctx.drawImage(source, -left, -top);
  return { left, top, width: canvas.width, height: canvas.height, image: canvas.toDataURL("image/png") };
}

const cache = new Map<string, Promise<SlicePixels>>();
let queue: Promise<unknown> = Promise.resolve();

export function photoCraftPixels(asset: PsdAsset, layer: PsdLayer): Promise<SlicePixels> {
  const id = asset.sourceHash + ":" + layer.key;
  const existing = cache.get(id);
  if (existing) return existing;
  const work = queue.then(async () => trimSlice(await requestRender(asset.sourceHash, [layer.key]), asset.width, asset.height));
  queue = work.catch(() => {});
  cache.set(id, work);
  if (cache.size > 32) cache.delete(cache.keys().next().value!);
  void work.catch(() => { if (cache.get(id) === work) cache.delete(id); });
  return work;
}
