import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { exportSlicesToDirectory, type ResourceDirectory } from "../shared/psd-export-directory";
import type { SliceExportBatch } from "../shared/psd-export";
import { WorkbenchSettingsController } from "./workbench-settings-controller";

const inProgress = new Set<string>();
export class PsdExportController {
  constructor(private readonly settings: WorkbenchSettingsController, private readonly document: Pick<vscode.TextDocument, "uri">, private readonly independentDirectory: () => string | undefined = () => undefined) {}
  get directoryLabel(): string | undefined { return this.settings.directory("resources")?.fsPath; }
  async choose(): Promise<boolean> {
    return this.settings.choose("resources", this.document.uri);
  }
  async export(batch: SliceExportBatch): Promise<number | null> {
    const root = this.settings.directory("resources");
    batch = { ...batch, directory: this.independentDirectory() };
    if (!root) throw new Error("请先在工作台设置中选择资源导出根目录。");
    const key = root.toString();
    if (inProgress.has(key)) throw new Error("该目录正在导出，请稍后重试。");
    inProgress.add(key);
    const target = (name: string) => vscode.Uri.joinPath(root, ...name.split("/"));
    const ensureClean = (name: string) => {
      if (vscode.workspace.textDocuments.some(d => d.uri.toString() === target(name).toString() && d.isDirty)) throw new Error(`${name} 有未保存修改，请先保存。`);
    };
    const adapter: ResourceDirectory = {
      list: async folder => {
        try { return (await vscode.workspace.fs.readDirectory(folder ? target(folder) : root)).map(([name]) => name); }
        catch (e) { if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") return []; throw e; }
      },
      mkdir: async folder => { await vscode.workspace.fs.createDirectory(target(folder)); },
      read: async name => {
        ensureClean(name);
        try {
          const info = await vscode.workspace.fs.stat(target(name));
          if (info.type !== vscode.FileType.File) throw new Error(`${name} 不是普通文件。`);
          if (info.size > 48 * 1024 * 1024) throw new Error(`${name} 超过 48 MB。`);
          return await vscode.workspace.fs.readFile(target(name));
        } catch (e) { if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") return null; throw e; }
      },
      write: async (name, bytes) => { ensureClean(name); await vscode.workspace.fs.writeFile(target(name), bytes); },
      remove: async name => { try { await vscode.workspace.fs.delete(target(name)); } catch (e) { if (!(e instanceof vscode.FileSystemError && e.code === "FileNotFound")) throw e; } }
    };
    try {
      await vscode.workspace.fs.createDirectory(root);
      return await exportSlicesToDirectory(adapter, batch, { decode: value => Buffer.from(value, "base64"), hash: async bytes => createHash("sha256").update(bytes).digest("hex") });
    }
    finally { inProgress.delete(key); }
  }
}
