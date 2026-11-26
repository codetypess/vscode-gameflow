import type * as vscode from "vscode";
import { isExtensionUpdateRequest, type ExtensionUpdateMessage, type ExtensionUpdateState } from "../shared/extension-update";

export interface SelfUpdateClient {
  check(options?: { silent?: boolean }): Promise<unknown>;
  getState(): ExtensionUpdateState;
  subscribe(listener: (state: ExtensionUpdateState) => void): vscode.Disposable;
  install(): Promise<unknown>;
}

export function attachExtensionUpdates(panel: vscode.WebviewPanel, updates?: SelfUpdateClient): vscode.Disposable {
  if (!updates) return { dispose() {} };
  const send = (state = updates.getState()) => panel.webview.postMessage({ type: "extensionUpdateState", state } satisfies ExtensionUpdateMessage);
  const changes = updates.subscribe(state => { void send(state); });
  const requests = panel.webview.onDidReceiveMessage(async (raw: unknown) => {
    if (!isExtensionUpdateRequest(raw)) return;
    if (raw.type === "installExtensionUpdate") await updates.install();
    await send();
  });
  const views = panel.onDidChangeViewState(() => { if (panel.visible) void send(); });
  void send();
  return { dispose() { changes.dispose(); requests.dispose(); views.dispose(); } };
}
