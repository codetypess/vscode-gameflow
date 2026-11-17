import { exportSlicesToDirectory, type ResourceDirectory } from "../../shared/psd-export-directory";
import { SliceExportConflict, type SliceExportBatch } from "../../shared/psd-export";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
import type { HostToWebviewMessage } from "../../shared/protocol";

interface BrowserFile {
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(bytes: Uint8Array): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
}
interface BrowserDirectory {
  name: string;
  keys(): AsyncIterableIterator<string>;
  getFileHandle(name: string, options?: { create: boolean }): Promise<BrowserFile>;
  removeEntry(name: string): Promise<void>;
}
type ExportResult = Extract<HostToWebviewMessage, { type: "psdResourceExportResult" }>;
let browserDirectory: BrowserDirectory | undefined;
let exporting = false;

export async function resourceExport(action: "choose" | "export", batch?: SliceExportBatch): Promise<ExportResult> {
  const requestId = crypto.randomUUID();
  if (!isBrowserPreview) return new Promise((resolve, reject) => {
    const handler = ({ data }: MessageEvent) => {
      if (data?.type !== "psdResourceExportResult" || data.requestId !== requestId) return;
      window.removeEventListener("message", handler);
      if (data.conflicts?.length) reject(new SliceExportConflict(data.conflicts));
      else if (data.error) reject(new Error(data.error)); else resolve(data);
    };
    window.addEventListener("message", handler);
    postHostMessage({ type: "psdResourceExport", requestId, action, ...(batch ? { batch } : {}) });
  });
  if (exporting) throw new Error("正在导出资源，请稍后重试。");
  exporting = true;
  try {
    if (action === "choose" || !browserDirectory) {
      const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<BrowserDirectory> }).showDirectoryPicker;
      if (!picker) throw new Error("当前浏览器不支持选择导出目录，请在 VS Code 中导出资源。");
      try { browserDirectory = await picker.call(window, { mode: "readwrite" }); }
      catch (e) { if (e instanceof DOMException && e.name === "AbortError") return { type: "psdResourceExportResult", requestId, cancelled: true, directory: browserDirectory?.name }; throw e; }
    }
    const root = browserDirectory;
    if (action === "choose") return { type: "psdResourceExportResult", requestId, directory: root.name };
    if (!batch) throw new Error("没有切图数据。");
    const adapter: ResourceDirectory = {
      list: async () => { const names: string[] = []; for await (const key of root.keys()) names.push(key); return names; },
      read: async name => {
        try { const file = await (await root.getFileHandle(name)).getFile(); if (file.size > 48 * 1024 * 1024) throw new Error(`${name} 超过 48 MB。`); return new Uint8Array(await file.arrayBuffer()); }
        catch (e) { if (e instanceof DOMException && e.name === "NotFoundError") return null; throw e; }
      },
      write: async (name, bytes) => { const stream = await (await root.getFileHandle(name, { create: true })).createWritable(); try { await stream.write(bytes); await stream.close(); } catch (e) { try { await stream.abort(); } catch { /* Preserve the original failure; the batch restores prior data. */ } throw e; } },
      remove: async name => { try { await root.removeEntry(name); } catch (e) { if (!(e instanceof DOMException && e.name === "NotFoundError")) throw e; } }
    };
    const count = await exportSlicesToDirectory(adapter, batch, {
      decode: value => Uint8Array.from(atob(value), c => c.charCodeAt(0)),
      hash: async bytes => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map(b => b.toString(16).padStart(2, "0")).join("")
    });
    return { type: "psdResourceExportResult", requestId, directory: root.name, count };
  } finally { exporting = false; }
}
