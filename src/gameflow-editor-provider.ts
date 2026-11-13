import * as vscode from "vscode";
import {
  GameFlowValidationError,
  parseGameFlowDocument,
  serializeGameFlowDocument,
  validateGameFlowDocument
} from "../shared/model";
import {
  type HostToWebviewMessage,
  isWebviewToHostMessage
} from "../shared/protocol";
import { configureGameFlowWebview } from "./webview-html";
import { parsePsdBinary } from "../shared/psd-binary";

export const GAMEFLOW_EDITOR_VIEW_TYPE = "gameflow.canvasEditor";

export class GameFlowEditorProvider
  implements vscode.CustomTextEditorProvider
{
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    configureGameFlowWebview(
      webviewPanel.webview,
      this.context.extensionUri,
      document.fileName
    );

    const sendSnapshot = async (kind: "init" | "documentChanged") => {
      try {
        const gameFlowDocument = parseGameFlowDocument(document.getText());
        const message: HostToWebviewMessage =
          kind === "init"
            ? {
                type: "init",
                document: gameFlowDocument,
                documentVersion: document.version,
                resourceName: document.uri.path.split("/").pop() ?? document.fileName,
                dirty: document.isDirty
              }
            : {
                type: "documentChanged",
                document: gameFlowDocument,
                documentVersion: document.version,
                dirty: document.isDirty
              };
        await webviewPanel.webview.postMessage(message);
      } catch (error) {
        const details =
          error instanceof GameFlowValidationError
            ? error.errors
            : [error instanceof Error ? error.message : String(error)];
        const message: HostToWebviewMessage = {
          type: "documentError",
          message: "当前文档不是有效的 GameFlow 文档。",
          details
        };
        await webviewPanel.webview.postMessage(message);
      }
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          void sendSnapshot("documentChanged");
        }
      }
    );

    const messageSubscription = webviewPanel.webview.onDidReceiveMessage(
      async (rawMessage: unknown) => {
        if (!isWebviewToHostMessage(rawMessage)) {
          const rejection: HostToWebviewMessage = {
            type: "updateRejected",
            reason: "Webview 发来的消息格式无效。",
            currentVersion: document.version
          };
          await webviewPanel.webview.postMessage(rejection);
          return;
        }

        if (rawMessage.type === "psdOutput") {
          try {
            const bytes = Buffer.from(rawMessage.base64, "base64");
            if (rawMessage.kind === "psd") parsePsdBinary(bytes);
            else {
              if (bytes.length > 1024 * 1024) throw new Error("配置文件超过 1 MB。");
              const value = JSON.parse(bytes.toString("utf8"));
              if (value?.schema !== "gameflow.psd-meta" || value.version !== 1 || !Array.isArray(value.layers)) throw new Error("无效的 PSD 配置。");
            }
            const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(document.uri, "..", rawMessage.name), filters: rawMessage.kind === "psd" ? { Photoshop: ["psd"] } : { "GameFlow metadata": ["json"] }, saveLabel: "保存" });
            if (target) {
              if (rawMessage.kind === "psd" ? !target.path.toLowerCase().endsWith(".psd") : !target.path.toLowerCase().endsWith(".meta.json")) throw new Error("请使用对应的 .psd 或 .meta.json 后缀。");
              if (vscode.workspace.textDocuments.some(d => d.uri.toString() === target.toString() && d.isDirty)) throw new Error("目标文件有未保存修改，请先保存或另选路径。");
              await vscode.workspace.fs.writeFile(target, bytes);
            }
            await webviewPanel.webview.postMessage({ type: "psdOutputResult", requestId: rawMessage.requestId, saved: !!target } satisfies HostToWebviewMessage);
          } catch (error) { await webviewPanel.webview.postMessage({ type: "psdOutputResult", requestId: rawMessage.requestId, saved: false, error: error instanceof Error ? error.message : String(error) } satisfies HostToWebviewMessage); }
          return;
        }
        if (rawMessage.type === "ready") {
          await sendSnapshot("init");
          return;
        }
        if (rawMessage.type === "save") {
          try {
            if (!await document.save()) throw new Error("文档保存失败，请检查文件权限。");
            await sendSnapshot("documentChanged");
            await webviewPanel.webview.postMessage({ type: "commandCompleted", action: "save" } satisfies HostToWebviewMessage);
          } catch (error) {
            await webviewPanel.webview.postMessage({ type: "updateRejected", reason: String(error), currentVersion: document.version } satisfies HostToWebviewMessage);
          }
          return;
        }
        if (rawMessage.type === "history") {
          try {
            await vscode.commands.executeCommand(rawMessage.action);
            await sendSnapshot("documentChanged");
            await webviewPanel.webview.postMessage({ type: "commandCompleted", action: rawMessage.action } satisfies HostToWebviewMessage);
          } catch (error) {
            await webviewPanel.webview.postMessage({ type: "updateRejected", reason: String(error), currentVersion: document.version } satisfies HostToWebviewMessage);
          }
          return;
        }

        if (rawMessage.baseVersion !== document.version) {
          const rejection: HostToWebviewMessage = {
            type: "updateRejected",
            reason: "文档已在其他位置更新，画布已刷新到最新版本。",
            currentVersion: document.version
          };
          await webviewPanel.webview.postMessage(rejection);
          await sendSnapshot("documentChanged");
          return;
        }

        const validation = validateGameFlowDocument(rawMessage.document);
        if (!validation.ok) {
          const rejection: HostToWebviewMessage = {
            type: "updateRejected",
            reason: validation.errors.join("；"),
            currentVersion: document.version
          };
          await webviewPanel.webview.postMessage(rejection);
          return;
        }

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        edit.replace(
          document.uri,
          fullRange,
          serializeGameFlowDocument(validation.document)
        );
        const applied = await vscode.workspace.applyEdit(edit);
        if (!applied) {
          const rejection: HostToWebviewMessage = {
            type: "updateRejected",
            reason: "VS Code 未能应用这次文档更新。",
            currentVersion: document.version
          };
          await webviewPanel.webview.postMessage(rejection);
        } else await sendSnapshot("documentChanged");
      }
    );

    const saveSubscription = vscode.workspace.onDidSaveTextDocument((saved) => {
      if (saved.uri.toString() === document.uri.toString()) void sendSnapshot("documentChanged");
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      messageSubscription.dispose();
      saveSubscription.dispose();
    });
  }
}
