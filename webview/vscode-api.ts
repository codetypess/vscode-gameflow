import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument } from "../shared/model";
import type { GameFlowDocument } from "../shared/model";
import { isWebviewToHostMessage, type HostToWebviewMessage, type WebviewToHostMessage } from "../shared/protocol";
import componentSample from "../sample/ui-components.gameflow.json";
import localInstanceSample from "../sample/canvas-instance-local-demo.gameflow.json";
import instanceSample from "../sample/canvas-instance-demo.gameflow.json";
import sharedSample from "../sample/shared-components.gameflow.json";
import starSeaSample from "../sample/star-sea-login.gameflow.json";
import { loadCanvasSources, type CanvasSources } from "../shared/canvas-references";
import { planCanvasApply } from "../shared/canvas-instances";
import type { PsdEditorRequest } from "../shared/psd-editor-protocol";
import { browserSettings } from "./browser-directories";
import { connectPhotoCraft } from "./psd/photocraft";

export const isBrowserPreview = typeof acquireVsCodeApi !== "function";
const api = isBrowserPreview ? createBrowserPreviewApi() : acquireVsCodeApi();
if (!isBrowserPreview) connectPhotoCraft(postHostMessage);

function createBrowserPreviewApi(): VsCodeApi {
  const sampleName = new URLSearchParams(location.search).get("sample");
  const sample = sampleName === "canvas-instances-local" ? localInstanceSample : sampleName === "canvas-instances" ? instanceSample : sampleName === "ui-components" ? componentSample : sampleName === "star-sea-login" ? starSeaSample : null;
  const storageKey = sampleName === "canvas-instances-local" ? "gameflow.prototype.canvas-instances-local.v1" : sampleName === "canvas-instances" ? "gameflow.prototype.canvas-instances.v1" : sampleName === "star-sea-login" ? "gameflow.prototype.star-sea-login.v1" : sample ? "gameflow.prototype.ui-components.v2" : "gameflow.prototype.v1";
  let document = sample ? parseGameFlowDocument(JSON.stringify(sample)) : createDefaultGameFlowDocument("gameflow-browser-preview");
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) document = parseGameFlowDocument(saved);
  } catch { /* Preserve invalid stored content until the next explicit edit. */ }
  let version = 1;
  const past: GameFlowDocument[] = [];
  const future: GameFlowDocument[] = [];
  let state: unknown;
  const imported: Record<string, GameFlowDocument> = sampleName === "canvas-instances" ? {"shared-components.gameflow.json":parseGameFlowDocument(JSON.stringify(sharedSample))} : {};
  try {
    const stored = JSON.parse(localStorage.getItem(`${storageKey}.sources`) ?? "{}");
    for (const [key, value] of Object.entries(stored)) imported[key] = parseGameFlowDocument(JSON.stringify(value));
  } catch { /* Invalid source snapshots are shown as unresolved references. */ }
  let sourceEpoch = 0;
  let sources: CanvasSources = {};
  const send = (message: HostToWebviewMessage) => window.setTimeout(() => {
    window.dispatchEvent(new MessageEvent("message", { data: message }));
  }, 0);
  const refreshSources = async (pickedSource?: string) => {
    const epoch = ++sourceEpoch;
    const next = await loadCanvasSources(document, async source => {
      if (!Object.hasOwn(imported, source)) throw new Error(`请重新导入 ${source}（浏览器使用文件快照）`);
      return imported[source];
    }, Object.keys(imported));
    if (epoch !== sourceEpoch) return;
    sources = next; send({ type: "canvasSources", sources, ...(pickedSource !== undefined ? { pickedSource } : {}) });
  };
  const chooseSource = () => {
    const input = window.document.createElement("input");
    input.type = "file"; input.accept = ".gameflow.json,application/json"; input.multiple = true; input.hidden = true;
    input.setAttribute("aria-label", "导入引用画布文件"); window.document.body.append(input);
    input.addEventListener("cancel", () => input.remove(), { once: true });
    input.addEventListener("change", async () => {
      try {
        const files = Array.from(input.files ?? []);
        for (const file of files) {
          if (!/\.gameflow\.json$/i.test(file.name) || file.size > 50 * 1024 * 1024) throw new Error("请选择不超过 50 MB 的 .gameflow.json 文件。");
          imported[file.name] = parseGameFlowDocument(await file.text());
        }
        try { localStorage.setItem(`${storageKey}.sources`, JSON.stringify(imported)); }
        catch { send({ type: "canvasSources", sources, error: "浏览器存储空间不足，源文件快照仅在本次会话可用。" }); }
        await refreshSources(files[0]?.name);
      } catch (error) { send({ type: "canvasSources", sources, error: String(error) }); }
      finally { input.remove(); }
    }, { once: true });
    input.click();
  };
  const snapshot = () => {
    let dirty = false;
    try { localStorage.setItem(storageKey, serializeGameFlowDocument(document)); }
    catch { dirty = true; }
    send({ type: "documentChanged", document, documentVersion: version, dirty });
    void refreshSources();
  };
  return {
    postMessage(raw: unknown) {
      if (!isWebviewToHostMessage(raw)) return;
      if (raw.type === "workbenchSettings") {
        void browserSettings(raw).then(send);
      } else if (raw.type === "ready") {
        send({ type: "init", document, documentVersion: version, resourceName: "策划原型.gameflow.json", dirty: false });
        void refreshSources();
      } else if (raw.type === "chooseCanvasSource") {
        chooseSource();
      } else if (raw.type === "openCanvasSource") {
        send({ type: "canvasSources", sources, error: "浏览器预览使用文件快照；请在 VS Code 打开源文件编辑，再重新导入快照。" });
      } else if (raw.type === "applyCanvasOverrides") {
        try {
          if (raw.baseVersion !== version) throw new Error("文档已变化，请重试。");
          const plan = planCanvasApply(document, sources, raw.request);
          if (plan.source) throw new Error("浏览器源文件是导入快照，请在 VS Code 中应用到源文件。");
          past.push(document); future.length = 0; document = plan.document; version++; snapshot();
          send({ type: "commandCompleted", action: "applyCanvas", requestId: raw.requestId });
        } catch (error) { send({ type: "updateRejected", reason: String(error), currentVersion: version }); }
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
export function postPsdMessage(message: PsdEditorRequest): void { api.postMessage(message); }
