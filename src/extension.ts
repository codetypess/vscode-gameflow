import * as vscode from "vscode";
import { createGameFlowDocument } from "./create-document";
import { PsdEditorProvider, PSD_EDITOR_VIEW_TYPE } from "./psd-editor-provider";
import {
  GAMEFLOW_EDITOR_VIEW_TYPE,
  GameFlowEditorProvider
} from "./gameflow-editor-provider";

export function activate(context: vscode.ExtensionContext) {
  const psd = new PsdEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(PSD_EDITOR_VIEW_TYPE, psd, { supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand("gameflow.openPsd", (uri?: vscode.Uri) => psd.open(uri)),
    vscode.window.registerCustomEditorProvider(
      GAMEFLOW_EDITOR_VIEW_TYPE,
      new GameFlowEditorProvider(context),
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true }
      }
    ),
    vscode.commands.registerCommand("gameflow.createCanvas", () =>
      createGameFlowDocument()
    )
  );
  return { psd };
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered on the extension context.
}
