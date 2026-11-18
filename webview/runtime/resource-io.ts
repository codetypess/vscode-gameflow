import { readExportedSlice, type ExportedSliceResult } from "../../shared/slice-resources";
import { browserDirectory } from "../browser-directories";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
import type { HostToWebviewMessage } from "../../shared/protocol";

export async function loadExportedSlices(paths: string[], signal: AbortSignal): Promise<ExportedSliceResult[]> {
  if (!paths.length) return [];
  if (!isBrowserPreview) return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const cleanup = () => { clearTimeout(timeout); window.removeEventListener("message", listener); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("资源请求已取消", "AbortError")); };
    const listener = ({ data }: MessageEvent<HostToWebviewMessage>) => {
      if (data?.type !== "sliceResourcesResult" || data.requestId !== requestId) return;
      cleanup(); resolve(data.resources);
    };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("读取资源超时，请重试。")); }, 15000);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true }); window.addEventListener("message", listener);
    postHostMessage({ type: "sliceResources", requestId, paths });
  });
  const root = browserDirectory("resources");
  if (!root) return paths.map(path => ({ path, exists: false, error: "请先选择资源根目录或打开来源 PSD。" }));
  let total = 0;
  const reads = new Map<string, Promise<Uint8Array | null>>();
  const io = {
    read: (path: string) => {
      if (!reads.has(path)) reads.set(path, (async () => {
        const parts = path.split("/"), file = parts.pop()!; let directory = root;
        try {
          for (const segment of parts) directory = await directory.getDirectoryHandle(segment);
          const value = await (await directory.getFileHandle(file)).getFile(); total += value.size;
          if (total > 48 * 1024 * 1024) throw new Error("预览资源数据超过 48 MB。");
          return new Uint8Array(await value.arrayBuffer());
        } catch (error) { if (error instanceof DOMException && error.name === "NotFoundError") return null; throw error; }
      })());
      return reads.get(path)!;
    },
    hash: async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map(b => b.toString(16).padStart(2, "0")).join(""),
    encode: (bytes: Uint8Array) => { let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192)); return btoa(binary); }
  };
  const results: ExportedSliceResult[] = [];
  for (const path of paths) { if (signal.aborted) throw new DOMException("资源请求已取消", "AbortError"); results.push(await readExportedSlice(path, io)); }
  return results;
}
