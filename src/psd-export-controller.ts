import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { exportSlicesToDirectory, type ResourceDirectory } from "../shared/psd-export-directory";
import type { SliceExportBatch } from "../shared/psd-export";

const inProgress = new Set<string>();
export class PsdExportController {
  private directory?: vscode.Uri;
  constructor(private readonly context: vscode.ExtensionContext, private readonly document: Pick<vscode.TextDocument, "uri">) {
    const saved = context.workspaceState.get<string>("gameflow.psdExportDirectory");
    if (saved) this.directory = vscode.Uri.parse(saved);
  }
  get directoryLabel(): string | undefined { return this.directory?.fsPath; }
  async choose(): Promise<boolean> {
    const selected = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: "选择资源导出目录", defaultUri: this.directory ?? vscode.Uri.joinPath(this.document.uri, "..") });
    if (!selected?.[0]) return false;
    this.directory = selected[0];
    await this.context.workspaceState.update("gameflow.psdExportDirectory", this.directory.toString());
    return true;
  }
  async export(batch: SliceExportBatch): Promise<number | null> {
    if (!this.directory && !await this.choose()) return null;
    const root = this.directory!, key = root.toString();
    if (inProgress.has(key)) throw new Error("该目录正在导出，请稍后重试。");
    inProgress.add(key);
    const target = (name: string) => vscode.Uri.joinPath(root, name);
    const ensureClean = (name: string) => {
      if (vscode.workspace.textDocuments.some(d => d.uri.toString() === target(name).toString() && d.isDirty)) throw new Error(`${name} 有未保存修改，请先保存。`);
    };
    const adapter: ResourceDirectory = {
      list: async () => (await vscode.workspace.fs.readDirectory(root)).map(([name]) => name),
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
    try { return await exportSlicesToDirectory(adapter, batch, { decode: value => Buffer.from(value, "base64"), hash: async bytes => createHash("sha256").update(bytes).digest("hex") }); }
    finally { inProgress.delete(key); }
  }
}
