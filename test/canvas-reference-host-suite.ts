import assert from "node:assert/strict";
import type * as vscode from "vscode";
import { readFileSync } from "node:fs";
import { CanvasReferenceController } from "../src/canvas-reference-controller";
import { parseGameFlowDocument } from "../shared/model";
import type { HostToWebviewMessage } from "../shared/protocol";
import { referenceHost, TestTextDocument, Uri, workspace } from "./vscode-reference-host";

export const canvasReferenceHostTests: { name: string; run: () => Promise<void> }[] = [];
const test = (name: string, run: () => Promise<void>) => canvasReferenceHostTests.push({ name, run });
function fixture() {
  referenceHost.reset();
  const document = new TestTextDocument(new Uri("/workspace/modules/demo.gameflow.json"), readFileSync("sample/canvas-reference-demo.gameflow.json", "utf8"));
  const source = readFileSync("sample/shared-components.gameflow.json", "utf8");
  referenceHost.files.set("/workspace/modules/shared-components.gameflow.json", source);
  workspace.textDocuments.push(document);
  const messages: Extract<HostToWebviewMessage, { type: "canvasSources" }>[] = [];
  let notification: (() => void) | undefined;
  const webview = { postMessage(message: HostToWebviewMessage) {
    if (message.type === "canvasSources") { messages.push(message); notification?.(); }
    return Promise.resolve(true);
  } } as unknown as vscode.Webview;
  return { document, source, messages, controller: new CanvasReferenceController(document as unknown as vscode.TextDocument, webview),
    nextMessage: () => new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error("source refresh timed out")), 2000); notification = () => { clearTimeout(timeout); notification = undefined; resolve(); }; }) };
}

test("host references follow unsaved source edits and disk deletion/recreation with clean documents open", async () => {
  const f = fixture();
  try {
    await f.controller.refresh();
    assert.ok(f.messages.at(-1)!.sources["shared-components.gameflow.json"].document);
    const opened = await workspace.openTextDocument(new Uri("/workspace/modules/shared-components.gameflow.json"));
    opened.text = f.source.replace("来自公共模块的组件", "源文件尚未保存"); opened.isDirty = true;
    let next = f.nextMessage(); referenceHost.fireText(opened); await next;
    assert.equal(f.messages.at(-1)!.sources["shared-components.gameflow.json"].document!.pages[0].nodes[1].text, "源文件尚未保存");
    opened.isDirty = false;
    referenceHost.files.delete(opened.uri.path);
    next = f.nextMessage(); referenceHost.watchers[0].delete.fire(); await next;
    assert.match(f.messages.at(-1)!.sources["shared-components.gameflow.json"].error!, /文件不存在/);
    referenceHost.files.set(opened.uri.path, f.source.replace("来自公共模块的组件", "磁盘文件已恢复"));
    next = f.nextMessage(); referenceHost.watchers[0].create.fire(); await next;
    assert.equal(f.messages.at(-1)!.sources["shared-components.gameflow.json"].document!.pages[0].nodes[1].text, "磁盘文件已恢复");
    assert.equal(f.document.text.includes("demoref1"), true, "source updates do not replace the edited file");
  } finally { f.controller.dispose(); }
});

test("host source epochs suppress stale reads and disposal releases all watchers and subscriptions", async () => {
  const f = fixture();
  let resolveOld!: (bytes: Uint8Array) => void;
  referenceHost.readOverride = () => new Promise(resolve => { resolveOld = resolve; });
  const stale = f.controller.refresh();
  referenceHost.readOverride = undefined;
  referenceHost.files.set("/workspace/modules/shared-components.gameflow.json", f.source.replace("来自公共模块的组件", "最新文件内容"));
  await f.controller.refresh();
  resolveOld(Buffer.from(f.source)); await stale;
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].sources["shared-components.gameflow.json"].document!.pages[0].nodes[1].text, "最新文件内容");
  f.controller.dispose();
  assert.ok(referenceHost.watchers.every(watcher => watcher.disposed));
  referenceHost.fireText(f.document);
  await f.controller.refresh();
  assert.equal(f.messages.length, 1);
});

test("host file selection returns relative module paths, migrates legacy identities and opens only known sources", async () => {
  const f = fixture();
  try {
    const legacy = parseGameFlowDocument(f.source); delete legacy.elementIdScheme;
    referenceHost.files.set("/workspace/common/ui.gameflow.json", JSON.stringify(legacy));
    referenceHost.picked = new Uri("/workspace/common/ui.gameflow.json");
    await f.controller.choose();
    const result = f.messages.at(-1)!;
    assert.equal(result.pickedSource, "../common/ui.gameflow.json");
    const source = result.sources[result.pickedSource!].document!;
    assert.equal(source.elementIdScheme, "nanoid-8");
    assert.notEqual(source.pages[0].id, legacy.pages[0].id);
    assert.ok(source.pages[0].nodes.some(node => node.id === source.pages[0].componentRootId));
    assert.equal(workspace.textDocuments.find(document => document.uri.path === referenceHost.picked!.path)!.isDirty, true);
    await f.controller.open("../unknown.gameflow.json"); assert.equal(referenceHost.commands.length, 0);
    await f.controller.open(result.pickedSource!);
    assert.equal(referenceHost.commands[0].command, "vscode.openWith");
    assert.equal(referenceHost.commands[0].uri.path, "/workspace/common/ui.gameflow.json");
  } finally { f.controller.dispose(); }
});

test("host invalid dependency JSON reports an error and recovers when the file is corrected", async () => {
  const f = fixture();
  try {
    referenceHost.files.set("/workspace/modules/shared-components.gameflow.json", "{");
    await f.controller.refresh();
    assert.match(f.messages.at(-1)!.sources["shared-components.gameflow.json"].error!, /Invalid JSON/);
    referenceHost.files.set("/workspace/modules/shared-components.gameflow.json", f.source);
    const next = f.nextMessage(); referenceHost.watchers[0].change.fire(); await next;
    assert.ok(f.messages.at(-1)!.sources["shared-components.gameflow.json"].document);
  } finally { f.controller.dispose(); }
});
