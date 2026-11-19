import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { exportPrefabToDirectories, type PrefabExportBatch } from "../shared/prefab-export";
import type { ResourceDirectory } from "../shared/psd-export-directory";
import type { WorkbenchSettingsController } from "./workbench-settings-controller";
import { exportRootsInProgress as inProgress } from "./export-lock";
export async function exportPrefab(settings: WorkbenchSettingsController, batch: PrefabExportBatch): Promise<number> {
  const resources = settings.directory("resources"), prefabs = settings.directory("prefabs");
  if (!resources || !prefabs) throw new Error("请先在工作台设置中选择资源和预制体导出根目录。");
  const keys = [...new Set([resources.toString(), prefabs.toString()])];
  if (keys.some(key => inProgress.has(key))) throw new Error("目录正在导出，请稍后重试。");
  keys.forEach(key => inProgress.add(key));
  const adapter = (root: vscode.Uri): ResourceDirectory => {
    const target = (name: string) => vscode.Uri.joinPath(root, ...name.split("/"));
    const ensureClean = (name: string) => { if (vscode.workspace.textDocuments.some(d => d.uri.toString() === target(name).toString() && d.isDirty)) throw new Error(name + " 有未保存修改。"); };
    return {
      list: async folder => { try { return (await vscode.workspace.fs.readDirectory(folder ? target(folder) : root)).map(([name]) => name); } catch (e) { if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") return []; throw e; } },
      mkdir: async folder => { await vscode.workspace.fs.createDirectory(target(folder)); },
      read: async name => { ensureClean(name); try { const info = await vscode.workspace.fs.stat(target(name)); if (info.type !== vscode.FileType.File || info.size > 48*1024*1024) throw new Error(name + " 不是普通文件或超过 48 MB。"); return await vscode.workspace.fs.readFile(target(name)); } catch (e) { if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") return null; throw e; } },
      write: async (name, bytes) => { ensureClean(name); await vscode.workspace.fs.writeFile(target(name), bytes); },
      remove: async name => { ensureClean(name); try { await vscode.workspace.fs.delete(target(name)); } catch (e) { if (!(e instanceof vscode.FileSystemError && e.code === "FileNotFound")) throw e; } }
    };
  };
  try { await vscode.workspace.fs.createDirectory(resources); await vscode.workspace.fs.createDirectory(prefabs); return await exportPrefabToDirectories(adapter(resources), adapter(prefabs), batch, { decode: value => Buffer.from(value,"base64"), hash: async bytes => createHash("sha256").update(bytes).digest("hex") }); }
  finally { keys.forEach(key => inProgress.delete(key)); }
}
