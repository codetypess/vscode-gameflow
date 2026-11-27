import * as vscode from "vscode";
import { posix } from "node:path";
import type { WebviewToHostMessage } from "../shared/protocol";
import type { WorkbenchDocument } from "./workbench-document";

export async function saveWorkbenchOutput(doc: Pick<WorkbenchDocument, "uri" | "psds">,
  output: Extract<WebviewToHostMessage, { type: "psdOutput" }>): Promise<boolean> {
  const filters = { psd: { Photoshop: ["psd"] }, meta: { JSON: ["json"] }, png: { "PNG 图片": ["png"] } };
  const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(doc.uri, "..", output.name), filters: filters[output.kind] });
  if (!uri) return false;
  if (output.kind === "png" && !/\.png$/i.test(uri.path)) throw new Error("请将画板快照保存为 .png 文件。");
  if ([...doc.psds.values()].some(psd => psd.uri.toString() === uri.toString() && psd.model.dirty)) throw new Error("目标 PSD 有未保存修改。");
  if (vscode.workspace.textDocuments.some(d => d.uri.toString() === uri.toString() && d.isDirty)) throw new Error("目标文件有未保存修改。");
  const bytes = Buffer.from(output.base64, "base64");
  if (output.kind === "png") await atomicWrite(uri, bytes);
  else await vscode.workspace.fs.writeFile(uri, bytes);
  return true;
}

export async function atomicWrite(uri: vscode.Uri, bytes: Uint8Array, beforeReplace?: () => Promise<void>, overwrite = true) {
  const temporary = vscode.Uri.joinPath(uri, "..", `.${posix.basename(uri.path)}.${crypto.randomUUID()}.tmp`);
  try {
    await vscode.workspace.fs.writeFile(temporary, bytes);
    if (beforeReplace) await beforeReplace();
    await vscode.workspace.fs.rename(temporary, uri, { overwrite });
  } finally {
    try { await vscode.workspace.fs.delete(temporary); } catch { /* Renamed or already removed. */ }
  }
}
