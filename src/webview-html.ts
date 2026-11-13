import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as vscode from "vscode";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function configureGameFlowWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  title: string
): void {
  const webviewRoot = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  webview.options = {
    enableScripts: true,
    localResourceRoots: [webviewRoot]
  };

  const htmlUri = vscode.Uri.joinPath(webviewRoot, "index.html");
  let html = fs.readFileSync(htmlUri.fsPath, "utf8");
  const assetsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(webviewRoot, "assets")
  );
  const nonce = randomBytes(18).toString("base64");
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
    "connect-src 'none'",
    "worker-src blob:"
  ].join("; ");

  html = html
    .replace(/(["'])\.\/assets\//g, `$1${assetsUri.toString()}/`)
    .replace(/<script\b/g, `<script nonce="${nonce}"`)
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`
    );

  webview.html = html;
}
