import * as vscode from "vscode";
import { posix } from "node:path";

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
