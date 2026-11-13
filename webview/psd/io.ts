import PsdWorker from "./psd-worker?worker&inline";
import { type PsdAsset, type PsdLayerMeta } from "../../shared/psd-meta";
import { isBrowserPreview, postHostMessage } from "../vscode-api";

export function psdTask<T>(type: "read" | "patch", bytes: ArrayBuffer, name: string, updates?: [number, PsdLayerMeta][]): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new PsdWorker();
    const timer = window.setTimeout(() => { worker.terminate(); reject(new Error("PSD 处理超时，请使用较小的文件。")); }, 30000);
    const finish = () => { window.clearTimeout(timer); worker.terminate(); };
    worker.onerror = () => { finish(); reject(new Error("PSD 工作线程不可用，请检查文件或重新打开工作区。")); };
    worker.onmessage = ({ data }) => { finish(); if (data.error) reject(new Error(data.error)); else resolve(data.result as T); };
    const copy = bytes.slice(0); worker.postMessage({ id: 1, type, bytes: copy, name, updates }, [copy]);
  });
}
export async function openPsd(file: File): Promise<{ asset: PsdAsset; bytes: ArrayBuffer }> {
  if (file.size > 32 * 1024 * 1024) throw new Error("当前支持不超过 32 MB 的 PSD。");
  const bytes = await file.arrayBuffer();
  return { asset: await psdTask<PsdAsset>("read", bytes, file.name), bytes };
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
