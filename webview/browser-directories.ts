import type { ExportDirectoryKind, WorkbenchSettings, WorkbenchSettingsRequest, WorkbenchSettingsResult } from "../shared/workbench-settings";

export interface BrowserFile {
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(bytes: Uint8Array): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
}
export interface BrowserDirectory {
  name: string; keys(): AsyncIterableIterator<string>;
  getFileHandle(name: string, options?: { create: boolean }): Promise<BrowserFile>;
  getDirectoryHandle(name: string, options?: { create: boolean }): Promise<BrowserDirectory>;
  removeEntry(name: string): Promise<void>;
}
const directories: Partial<Record<ExportDirectoryKind, BrowserDirectory>> = {};
export const browserDirectory = (kind: ExportDirectoryKind) => directories[kind];
const snapshot = (): WorkbenchSettings => ({ resourceDirectory: directories.resources?.name, prefabDirectory: directories.prefabs?.name });
export async function browserSettings(request: WorkbenchSettingsRequest): Promise<WorkbenchSettingsResult> {
  let cancelled = false;
  try {
    if (request.action === "clear") delete directories[request.directory];
    else if (request.action === "choose") {
      const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<BrowserDirectory> }).showDirectoryPicker;
      if (!picker) throw new Error("当前浏览器不支持选择本地目录，请在 VS Code 中设置导出目录。");
      try { directories[request.directory] = await picker.call(window, { mode: "readwrite" }); }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") cancelled = true; else throw error; }
    }
    return { type: "workbenchSettingsResult", requestId: request.requestId, settings: snapshot(), cancelled };
  } catch (error) { return { type: "workbenchSettingsResult", requestId: request.requestId, settings: snapshot(), error: error instanceof Error ? error.message : String(error) }; }
}
