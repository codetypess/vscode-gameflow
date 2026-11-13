import * as vscode from "vscode";
import { createGameFlowDocument } from "./create-document";
import {
  GAMEFLOW_EDITOR_VIEW_TYPE,
  GameFlowEditorProvider
} from "./gameflow-editor-provider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
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
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered on the extension context.
}
