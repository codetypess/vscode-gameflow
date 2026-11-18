import { exportSlicesToDirectory, type ResourceDirectory } from "../../shared/psd-export-directory";
import { SliceExportConflict, type SliceExportBatch } from "../../shared/psd-export";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
import type { HostToWebviewMessage } from "../../shared/protocol";
import { browserDirectory, browserSettings } from "../browser-directories";

type ExportResult = Extract<HostToWebviewMessage, { type: "psdResourceExportResult" }>;
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
    if (action === "choose") {
      const result = await browserSettings({ type: "workbenchSettings", requestId, action: "choose", directory: "resources" });
      if (result.error) throw new Error(result.error);
      return { type: "psdResourceExportResult", requestId, cancelled: result.cancelled, directory: result.settings.resourceDirectory };
    }
    const root = browserDirectory("resources");
    if (!root) throw new Error("请先在工作台设置中选择资源导出根目录。");
    if (!batch) throw new Error("没有切图数据。");
    const directory = root.name;
    const folder = async (path: string, create = false) => {
      let result = root;
      for (const segment of path.split("/").filter(Boolean)) result = await result.getDirectoryHandle(segment, { create });
      return result;
    };
    const parent = async (path: string) => ({ handle: await folder(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""), name: path.slice(path.lastIndexOf("/") + 1) });
    const adapter: ResourceDirectory = {
      list: async path => {
        try { const names: string[] = []; for await (const key of (await folder(path ?? "")).keys()) names.push(key); return names; }
        catch (e) { if (e instanceof DOMException && e.name === "NotFoundError") return []; throw e; }
      },
      mkdir: async path => { await folder(path, true); },
      read: async path => {
        try { const { handle, name } = await parent(path); const file = await (await handle.getFileHandle(name)).getFile(); if (file.size > 48 * 1024 * 1024) throw new Error(path + " 超过 48 MB。"); return new Uint8Array(await file.arrayBuffer()); }
        catch (e) { if (e instanceof DOMException && e.name === "NotFoundError") return null; throw e; }
      },
      write: async (path, bytes) => {
        const { handle, name } = await parent(path), stream = await (await handle.getFileHandle(name, { create: true })).createWritable();
        try { await stream.write(bytes); await stream.close(); } catch (e) { try { await stream.abort(); } catch { /* The batch restores prior data. */ } throw e; }
      },
      remove: async path => { try { const { handle, name } = await parent(path); await handle.removeEntry(name); } catch (e) { if (!(e instanceof DOMException && e.name === "NotFoundError")) throw e; } }
    };
    const count = await exportSlicesToDirectory(adapter, batch, {
      decode: value => Uint8Array.from(atob(value), c => c.charCodeAt(0)),
      hash: async bytes => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map(b => b.toString(16).padStart(2, "0")).join("")
    });
    return { type: "psdResourceExportResult", requestId, directory, count };
  } finally { exporting = false; }
}
