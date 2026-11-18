import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { readExportedSlice, type ExportedSliceResult } from "../shared/slice-resources";
import type { WorkbenchSettingsController } from "./workbench-settings-controller";

export async function readWorkbenchSlices(settings: WorkbenchSettingsController, paths: string[]): Promise<ExportedSliceResult[]> {
  let root: vscode.Uri | undefined;
  try { root = settings.directory("resources"); }
  catch (error) { return paths.map(path => ({ path, exists: false, error: `资源根目录设置无效：${error instanceof Error ? error.message : String(error)}` })); }
  if (!root) return paths.map(path => ({ path, exists: false, error: "尚未设置资源导出根目录；可打开来源 PSD 生成内存切图。" }));
  let total = 0;
  const reads = new Map<string, Promise<Uint8Array | null>>();
  const io = {
    read: (path: string) => {
      if (!reads.has(path)) reads.set(path, (async () => {
        const uri = vscode.Uri.joinPath(root, ...path.split("/"));
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.size > 48 * 1024 * 1024 || total + stat.size > 48 * 1024 * 1024) throw new Error("预览资源数据超过 48 MB，请减少本页资源。");
          total += stat.size;
          return await vscode.workspace.fs.readFile(uri);
        } catch (error) { if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") return null; throw error; }
      })());
      return reads.get(path)!;
    },
    hash: async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex"),
    encode: (bytes: Uint8Array) => Buffer.from(bytes).toString("base64")
  };
  const results: ExportedSliceResult[] = [];
  for (const path of paths) results.push(await readExportedSlice(path, io));
  return results;
}
