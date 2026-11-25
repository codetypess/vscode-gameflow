import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as vscode from "vscode";
import { configureGameFlowWebview } from "../src/webview-html";
import { Uri } from "./vscode-reference-host";

export const webviewHtmlTests = [{
  name: "Vite module preloads use the nonce authorized by the native Webview script policy",
  run() {
    const root = mkdtempSync(join(tmpdir(), "gameflow-webview-html-"));
    try {
      const output = join(root, "dist", "webview");
      mkdirSync(output, { recursive: true });
      writeFileSync(join(output, "index.html"),
        '<!doctype html><html><head><title>GameFlow</title><script type="module" src="./assets/index.js"></script></head></html>');
      const webview = {
        html: "",
        cspSource: "https://*.vscode-cdn.net",
        asWebviewUri: () => new URL("https://gameflow.vscode-cdn.net/assets")
      };
      configureGameFlowWebview(webview as unknown as vscode.Webview,
        new Uri(root.replaceAll("\\", "/")) as unknown as vscode.Uri, "GameFlow");

      const nonce = webview.html.match(/script-src 'nonce-([^']+)'/)?.[1];
      assert.ok(nonce, "the script policy authorizes a nonce");
      assert.ok(webview.html.includes(`<script nonce="${nonce}" type="module"`), "the packaged entry carries the nonce");
      assert.ok(webview.html.includes(`<meta property="csp-nonce" nonce="${nonce}">`), "Vite can apply the same nonce to its preload links");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
}];
