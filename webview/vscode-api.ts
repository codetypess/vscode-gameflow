import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument } from "../shared/model";
import type { GameFlowDocument } from "../shared/model";
import { isWebviewToHostMessage, type HostToWebviewMessage, type WebviewToHostMessage } from "../shared/protocol";
import componentSample from "../sample/ui-components.gameflow.json";

export const isBrowserPreview = typeof acquireVsCodeApi !== "function";
const api = isBrowserPreview ? createBrowserPreviewApi() : acquireVsCodeApi();

function createBrowserPreviewApi(): VsCodeApi {
  const sample = new URLSearchParams(location.search).get("sample") === "ui-components";
  const storageKey = sample ? "gameflow.prototype.ui-components.v2" : "gameflow.prototype.v1";
  let document = sample ? parseGameFlowDocument(JSON.stringify(componentSample)) : createDefaultGameFlowDocument("gameflow-browser-preview");
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) document = parseGameFlowDocument(saved);
  } catch { /* Preserve invalid stored content until the next explicit edit. */ }
  let version = 1;
  const past: GameFlowDocument[] = [];
  const future: GameFlowDocument[] = [];
  let state: unknown;
  const send = (message: HostToWebviewMessage) => window.setTimeout(() => {
    window.dispatchEvent(new MessageEvent("message", { data: message }));
  }, 0);
  const snapshot = () => {
    let dirty = false;
    try { localStorage.setItem(storageKey, serializeGameFlowDocument(document)); }
    catch { dirty = true; }
    send({ type: "documentChanged", document, documentVersion: version, dirty });
  };
  return {
    postMessage(raw: unknown) {
      if (!isWebviewToHostMessage(raw)) return;
      if (raw.type === "ready") {
        send({ type: "init", document, documentVersion: version, resourceName: "策划原型.gameflow.json", dirty: false });
      } else if (raw.type === "replaceDocument") {
        if (raw.baseVersion !== version) {
          send({ type: "updateRejected", reason: "文档版本变化，请重新操作。", currentVersion: version });
          return;
        }
        past.push(document);
        if (past.length > 80) past.shift();
        future.length = 0;
        document = raw.document;
        version++;
        snapshot();
      } else if (raw.type === "history") {
        const source = raw.action === "undo" ? past : future;
        const target = raw.action === "undo" ? future : past;
        const next = source.pop();
        if (next) { target.push(document); document = next; version++; }
        snapshot();
        send({ type: "commandCompleted", action: raw.action });
      } else { snapshot(); send({ type: "commandCompleted", action: "save" }); }
    },
    getState: () => state,
    setState: (next) => { state = next; return state; }
  };
}

export function postHostMessage(message: WebviewToHostMessage): void { api.postMessage(message); }
