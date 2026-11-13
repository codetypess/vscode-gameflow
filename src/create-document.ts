import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import {
  createDefaultGameFlowDocument,
  serializeGameFlowDocument
} from "../shared/model";
import { GAMEFLOW_EDITOR_VIEW_TYPE } from "./gameflow-editor-provider";

const GAMEFLOW_SUFFIX = ".gameflow.json";

function ensureGameFlowSuffix(uri: vscode.Uri): vscode.Uri {
  if (uri.path.toLowerCase().endsWith(GAMEFLOW_SUFFIX)) {
    return uri;
  }
  return uri.with({ path: `${uri.path}${GAMEFLOW_SUFFIX}` });
}

export async function createGameFlowDocument(): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  const defaultUri = workspaceUri
    ? vscode.Uri.joinPath(workspaceUri, `new-canvas${GAMEFLOW_SUFFIX}`)
    : undefined;
  const selectedUri = await vscode.window.showSaveDialog({
    defaultUri,
    title: "新建 GameFlow 策划画布",
    saveLabel: "创建画布",
    filters: { "GameFlow 文档": ["gameflow.json"] }
  });

  if (!selectedUri) {
    return;
  }

  const uri = ensureGameFlowSuffix(selectedUri);
  const document = createDefaultGameFlowDocument(`gameflow-${randomUUID()}`);
  await vscode.workspace.fs.writeFile(
    uri,
    new TextEncoder().encode(serializeGameFlowDocument(document))
  );
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    GAMEFLOW_EDITOR_VIEW_TYPE
  );
}
