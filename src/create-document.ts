import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import * as vscode from "vscode";
import {
  createDefaultGameFlowDocument,
  createEmptyGameFlowDocument,
  serializeGameFlowDocument
} from "../shared/model";
import { GAMEFLOW_EDITOR_VIEW_TYPE } from "./gameflow-editor-provider";
import { atomicWrite } from "./psd-file-io";

const GAMEFLOW_SUFFIX = ".gameflow.json";

function ensureGameFlowSuffix(uri: vscode.Uri): vscode.Uri {
  if (uri.path.toLowerCase().endsWith(GAMEFLOW_SUFFIX)) {
    return uri;
  }
  return uri.with({ path: `${uri.path}${GAMEFLOW_SUFFIX}` });
}

export async function createGameFlowDocument(kind: "planning" | "prototype"): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  const defaultName = kind === "prototype" ? "新建原型画布" : "new-canvas";
  const defaultUri = workspaceUri
    ? vscode.Uri.joinPath(workspaceUri, `${defaultName}${GAMEFLOW_SUFFIX}`)
    : undefined;
  const selectedUri = await vscode.window.showSaveDialog({
    defaultUri,
    title: kind === "prototype" ? "新建原型画布" : "新建 GameFlow 策划画布",
    saveLabel: "创建画布",
    filters: { "GameFlow 文档": ["gameflow.json"] }
  });

  if (!selectedUri) {
    return;
  }

  const uri = ensureGameFlowSuffix(selectedUri);
  const documentId = `gameflow-${randomUUID()}`;
  const document = kind === "prototype"
    ? createEmptyGameFlowDocument(documentId, posix.basename(uri.path).slice(0, -GAMEFLOW_SUFFIX.length).trim() || defaultName)
    : createDefaultGameFlowDocument(documentId);
  const bytes = new TextEncoder().encode(serializeGameFlowDocument(document));
  // The save dialog can only confirm replacement for the path it returned.
  await atomicWrite(uri, bytes, undefined, uri.path === selectedUri.path);
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    GAMEFLOW_EDITOR_VIEW_TYPE
  );
}
