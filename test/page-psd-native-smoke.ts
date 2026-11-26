import * as vscode from "vscode";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writePsdUint8Array } from "ag-psd";
import type { GameFlowEditorProvider } from "../src/gameflow-editor-provider";
import type { PsdEditorProvider } from "../src/psd-editor-provider";
import { PagePsdWatcher, rebasePagePsds, type PagePsdController } from "../src/page-psd-controller";
import { parseGameFlowDocument, serializeGameFlowDocument } from "../shared/model";
import { pagePsdFixture } from "./page-psd-fixture";
export async function pagePsdChecks(api: { workbench: GameFlowEditorProvider; psd: PsdEditorProvider }, root: string, directory: string): Promise<string[]> {
  const checks: string[] = [], cancel = new vscode.CancellationTokenSource();
  const document = parseGameFlowDocument(readFileSync(join(root, "sample/star-sea-login.gameflow.json"), "utf8"));
  const { binding, bytes: source } = pagePsdFixture(root);
  document.pages[0].artPsd = { ...binding, source: "page-art.psd" };
  const file = join(directory, "page-binding.gameflow.json"), uri = vscode.Uri.file(file);
  writeFileSync(file, serializeGameFlowDocument(document)); writeFileSync(join(directory, "page-art.psd"), source);
  const controller = (api.workbench as unknown as { pagePsds: PagePsdController }).pagePsds;
  const open = () => api.workbench.openCustomDocument(uri, { backupId: undefined, untitledDocumentData: undefined }, cancel.token);
  let doc = await open();
  const load = () => controller.handle(doc, { type: "pagePsd", requestId: "native-load", pageId: document.pages[0].id, action: "load", expected: document.pages[0].artPsd });
  try {
    const boundText = doc.getText(), boundDisk = readFileSync(file, "utf8");
    const result = await load(); assert.equal(result.error, undefined); assert.equal(result.draft?.documentId, document.pages[0].artPsd.documentId);
    assert.equal(doc.currentPsd, undefined); assert.equal(doc.dirty, false); assert.equal(doc.psds.size, 0);
    assert.deepEqual(Buffer.from((await controller.renderSource(doc, result.draft!.sourceHash))!), source);
    assert.equal(await controller.renderSource(doc, "0".repeat(64)), undefined);
    assert.equal(doc.getText(), boundText); assert.equal(readFileSync(file, "utf8"), boundDisk);
    checks.push("page art loads its saved file without opening, dirtying, rebinding or saving the prototype");
    const component = document.pages[1];
    const componentReview = { type: "pagePsd" as const, requestId: "missing-component", action: "review" as const,
      pageId: component.id, expected: component.artPsd, component: { canvas: "", documentId: document.documentId, pageId: component.id } };
    const missingComponent = await controller.handle(doc, componentReview);
    assert.equal(missingComponent.missingComponent, true, missingComponent.error);
    writeFileSync(join(directory, component.artPsd!.source), Buffer.from("damaged PSD"));
    const unreadableComponent = await controller.handle(doc, componentReview);
    assert.ok(unreadableComponent.error);
    assert.equal(unreadableComponent.missingComponent, undefined);
    checks.push("native component review distinguishes a missing bound PSD from a damaged file");
    const review=await controller.handle(doc,{type:"pagePsd",requestId:"sync-review",action:"review",pageId:document.pages[0].id,expected:document.pages[0].artPsd});
    assert.equal(review.error,undefined);
    assert.deepEqual(review.draft,result.draft);
    assert.equal(review.base64,source.toString("base64"));
    assert.equal(doc.dirty,false);
    checks.push("sync review reads the exact bound PSD and configuration in a native workbench without an edit");
    doc.replace(serializeGameFlowDocument({ ...document, title: "持久页面绑定" }));
    await api.workbench.saveCustomDocument(doc, cancel.token);
    assert.deepEqual(parseGameFlowDocument(readFileSync(file, "utf8")).pages[0].artPsd, document.pages[0].artPsd);
    doc.dispose(); doc = await open();
    const reopened = await load(); assert.equal(reopened.error, undefined); assert.equal(reopened.draft?.documentId, result.draft?.documentId); assert.equal(doc.currentPsd, undefined);
    checks.push("native save and reopen retain page PSD binding and stable source identity");
    const folder = vscode.Uri.file(join(directory, "page-copy")); await vscode.workspace.fs.createDirectory(folder);
    let destination = vscode.Uri.joinPath(folder, "saved.gameflow.json");
    if (process.platform === "win32") {
      assert.match(uri.path, /^\/[a-z]:\//i);
      const drive = uri.path[1], otherCase = drive === drive.toLowerCase() ? drive.toUpperCase() : drive.toLowerCase();
      destination = destination.with({ path: "/" + otherCase + destination.path.slice(2) });
      assert.notEqual(destination.path[1], uri.path[1]);
      assert.equal(rebasePagePsds(document, uri, destination).pages[0].artPsd?.source, "../page-art.psd");
      checks.push("real Windows file URIs with mixed drive casing keep a portable page PSD path");
    }
    await api.workbench.saveCustomDocumentAs(doc, destination, cancel.token);
    const savedAs = parseGameFlowDocument(readFileSync(destination.fsPath, "utf8")); assert.equal(savedAs.pages[0].artPsd?.source, "../page-art.psd");
    checks.push("native save as rebases relative PSD paths");
    const missing = { ...document, pages: [{ ...document.pages[0], artPsd: { ...document.pages[0].artPsd!, source: "missing.psd" } }] };
    doc.replace(serializeGameFlowDocument(missing));
    const failure = await controller.handle(doc, { type: "pagePsd", requestId: "missing", pageId: missing.pages[0].id, action: "load", expected: missing.pages[0].artPsd });
    assert.ok(failure.error); assert.equal(doc.currentPsd, undefined); checks.push("missing bound PSD reports an error without switching active sessions");
    const pixels = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) };
    const plainUri = vscode.Uri.file(join(directory, "plain-art.psd"));
    writeFileSync(plainUri.fsPath, writePsdUint8Array({ width: 2, height: 2, imageData: pixels, children: [{ name: "art", imageData: pixels }] }, { generateThumbnail: false }));
    const plain = await api.psd.openCustomDocument(plainUri, { backupId: undefined, untitledDocumentData: undefined }, cancel.token, { preview: true });
    assert.equal(plain.model.asset.hasEmbeddedIdentity, false); assert.equal(plain.model.dirty, true);
    document.pages[0].artPsd = { source: "plain-art.psd", documentId: plain.model.asset.documentId };
    doc.psds.set(plainUri.toString(), plain); doc.replace(serializeGameFlowDocument(document));
    await api.workbench.saveCustomDocument(doc, cancel.token);
    doc.dispose(); doc = await open();
    const plainReload = await load(); assert.equal(plainReload.error, undefined); assert.equal(plainReload.draft?.documentId, document.pages[0].artPsd.documentId);
    checks.push("untagged PSD identity is saved in sidecar and reloads through its page binding");
    const beforeSlice = doc.getText();
    const editedPlain = writePsdUint8Array({ width: 2, height: 2, imageData: { ...pixels, data: new Uint8ClampedArray(16).fill(100) },
      children: [{ name: "art", imageData: pixels }] }, { generateThumbnail: false });
    const savedPlainConfig = readFileSync(join(directory, "plain-art.meta.json"));
    let notifyChange: () => void;
    const changed = new Promise<void>(resolve => { notifyChange = resolve; });
    const watcher = new PagePsdWatcher(uri, { visible: true, onDidChangeViewState: () => new vscode.Disposable(() => {}),
      webview: { postMessage: (message: { sources: string[] }) => {
        if (message.sources.includes("plain-art.psd")) notifyChange();
      } } } as unknown as vscode.WebviewPanel);
    watcher.update(document.pages);
    // VS Code installs native watches asynchronously, including those outside workspace folders.
    const write = () => writeFileSync(plainUri.fsPath, editedPlain);
    const repeat = setInterval(write, 350);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      write();
      await Promise.race([changed, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("No external PSD save notification")), 10000);
      })]);
    } finally { clearInterval(repeat); clearTimeout(timeout); watcher.dispose(); }
    const refreshedPlain = await load();
    assert.equal(refreshedPlain.error, undefined);
    assert.equal(refreshedPlain.draft?.documentId, document.pages[0].artPsd.documentId);
    assert.deepEqual(Buffer.from(refreshedPlain.base64!, "base64"), Buffer.from(editedPlain));
    assert.deepEqual(readFileSync(join(directory, "plain-art.meta.json")), savedPlainConfig);
    assert.equal(doc.dirty, false);
    writeFileSync(plainUri.fsPath, Buffer.from(plainReload.base64!, "base64"));
    checks.push("bound Photoshop preview reads externally changed pixels without rewriting the slice configuration");
    const slice = () => controller.handle(doc, { type: "pagePsd", requestId: "open-slice", pageId: document.pages[0].id, action: "slice", expected: document.pages[0].artPsd });
    assert.equal((await slice()).error, undefined);
    const existing = doc.psds.get(plainUri.toString());
    assert.ok(existing); assert.equal(doc.currentPsd, existing);
    assert.equal((await slice()).error, undefined);
    assert.equal(doc.currentPsd, existing); assert.equal(doc.getText(), beforeSlice); assert.equal(doc.dirty, false);
    checks.push("page slice opens the bound native document with its saved sidecar and reuses the session on repeat");
    const configFile = join(directory, "plain-art.meta.json");
    const savedConfig = readFileSync(configFile);
    writeFileSync(plainUri.fsPath, source);
    assert.equal((await slice()).error, undefined);
    assert.deepEqual(Buffer.from(doc.currentPsd!.bytes), source);
    assert.equal(doc.currentPsd!.model.asset.documentId, binding.documentId);
    assert.match(doc.currentPsd!.configReadIssue!, /这份切图设置属于另一张设计图/);
    assert.equal((await load()).error, "这份切图设置属于另一张设计图。请换成当前 PSD 对应的设置文件，再点「重试」。");
    assert.doesNotMatch(doc.currentPsd!.state().warning!, /已放弃本次修改/);
    assert.equal(doc.dirty, false);
    assert.deepEqual(readFileSync(configFile), savedConfig);
    assert.equal(doc.getText(), beforeSlice);
    checks.push("page slice loads the replacement PSD at the bound path and preserves the previous file's sidecar");
    doc.dispose(); doc = await open();
    assert.equal((await slice()).error, undefined);
    assert.deepEqual(Buffer.from(doc.currentPsd!.bytes), source);
    assert.deepEqual(readFileSync(configFile), savedConfig);
    checks.push("reopening page slice with a foreign sidecar shows the current artwork");
  } finally { doc.dispose(); cancel.dispose(); }
  return checks;
}
