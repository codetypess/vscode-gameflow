import PsdWorker from "./psd-worker?worker&inline";
import { type PsdAsset, type PsdLayerMeta } from "../../shared/psd-meta";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
import type { PsdPrototype } from "./prototype-import";
import { hasPhotoCraftHost, requestRender, trimSlice } from "./photocraft";
import { isImageData } from "../../shared/model";
import { stringFingerprint } from "../../shared/string-fingerprint";
import { paintContent } from "./import-signature";

export function psdTask<T>(type: "read" | "readPage" | "patch" | "importPrototype", bytes: ArrayBuffer, name: string, updates?: [number, PsdLayerMeta][]): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new PsdWorker();
    const timer = window.setTimeout(() => { worker.terminate(); reject(new Error("PSD 处理超时，请使用较小的文件。")); }, 30000);
    const finish = () => { window.clearTimeout(timer); worker.terminate(); };
    worker.onerror = () => { finish(); reject(new Error("PSD 工作线程不可用，请检查文件或重新打开工作区。")); };
    worker.onmessage = ({ data }) => { finish(); if (data.error) reject(new Error(data.error)); else resolve(data.result as T); };
    const copy = bytes.slice(0); worker.postMessage({ id: 1, type, bytes: copy, name, updates }, [copy]);
  });
}
export async function importPsdPrototype(file: File): Promise<PsdPrototype> {
  if (!/\.psd$/i.test(file.name)) throw new Error("请选择 .psd 文件。");
  if (file.size > 32 * 1024 * 1024) throw new Error("当前支持不超过 32 MB 的 PSD。");
  const bytes = await file.arrayBuffer();
  const imported = await psdTask<PsdPrototype>("importPrototype", bytes, file.name);
  const complex = imported.layers.filter(layer => layer.rasterEffect);
  if (!complex.length || !hasPhotoCraftHost()) return imported;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error); reader.readAsDataURL(file);
  });
  for (const {node} of complex) {
    const paint = node.psdPaint;
    if (!paint) continue;
    try {
      const png = await requestRender(hash, [paint.key], "psdRenderSlice", base64);
      const pixels = await trimSlice(png, imported.width, imported.height);
      if (!isImageData(pixels.image)) continue;
      const f = node.frame;
      paint.bitmap = { image: pixels.image, content: node.imageData ? stringFingerprint(node.imageData) : paintContent(node),
        frame: { x: (pixels.left - f.x) / f.width, y: (pixels.top - f.y) / f.height, width: pixels.width / f.width, height: pixels.height / f.height } };
      delete paint.effects;
    } catch { /* The component still has its saved PSD pixels and supported live effects. */ }
  }
  return imported;
}
export async function openPsd(file: File, type: "read" | "readPage" = "read"): Promise<{ asset: PsdAsset; bytes: ArrayBuffer }> {
  if (file.size > 32 * 1024 * 1024) throw new Error("当前支持不超过 32 MB 的 PSD。");
  const bytes = await file.arrayBuffer();
  return { asset: await psdTask<PsdAsset>(type, bytes, file.name), bytes };
}
export async function saveOutput(name: string, kind: "psd" | "meta", bytes: Uint8Array): Promise<boolean> {
  if (isBrowserPreview) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: kind === "psd" ? "image/vnd.adobe.photoshop" : "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30000); return true;
  }
  let payload = ""; for (let i = 0; i < bytes.length; i += 8192) payload += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const handler = ({ data }: MessageEvent) => { if (data?.type !== "psdOutputResult" || data.requestId !== requestId) return; window.removeEventListener("message", handler); if (data.error) reject(new Error(data.error)); else resolve(data.saved === true); };
    window.addEventListener("message", handler);
    postHostMessage({ type: "psdOutput", requestId, name, kind, base64: btoa(payload) });
  });
}
