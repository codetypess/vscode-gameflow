import * as vscode from "vscode";
import type { SelfUpdateClient } from "./extension-updates";
import { createGameFlowDocument } from "./create-document";
import { PsdEditorProvider, PSD_EDITOR_VIEW_TYPE } from "./psd-editor-provider";
import {
  GAMEFLOW_EDITOR_VIEW_TYPE,
  GameFlowEditorProvider
} from "./gameflow-editor-provider";
const { activateSelfUpdate } = require("../tools/internal-extensions/self-update.cjs") as {
  activateSelfUpdate(context: vscode.ExtensionContext, namespace: string): SelfUpdateClient;
};

export function activate(context: vscode.ExtensionContext) {
  const updates = activateSelfUpdate(context, "gameflow");
  const psd = new PsdEditorProvider(context, updates);
  const workbench = new GameFlowEditorProvider(context, psd);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(PSD_EDITOR_VIEW_TYPE, psd, { supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand("gameflow.openPsd", (uri?: vscode.Uri) => workbench.activeDocument ? workbench.openPsd(workbench.activeDocument, uri) : psd.open(uri)),
    vscode.window.registerCustomEditorProvider(
      GAMEFLOW_EDITOR_VIEW_TYPE,
      workbench,
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true }
      }
    ),
    vscode.commands.registerCommand("gameflow.createCanvas", () =>
      createGameFlowDocument()
    )
  );
  return { psd, workbench, updates };
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered on the extension context.
}
