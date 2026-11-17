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
    if (!root) throw new Error("请先在工作台设置中选择资源导出目录。");
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
