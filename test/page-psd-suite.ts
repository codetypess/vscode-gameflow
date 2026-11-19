import assert from "node:assert/strict";
import type * as vscode from "vscode";
import { createDefaultGameFlowDocument, isPagePsdBinding, isPagePsdSource, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type GameFlowPage } from "../shared/model";
import { bindPagePsd, pagePsdKey } from "../shared/page-psd";
import { isWebviewToHostMessage } from "../shared/protocol";
import type { PsdAsset } from "../shared/psd-meta";
import { makeNode } from "../shared/editor-ops";
import { PagePsdController, rebasePagePsds } from "../src/page-psd-controller";
import type { PsdEditorProvider } from "../src/psd-editor-provider";
import type { WorkbenchDocument } from "../src/workbench-document";
import { referenceHost, Uri } from "./vscode-reference-host";
const tests: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) => tests.push({ name, run });
export const pagePsdTests = tests;
function fixture() {
  const page: GameFlowPage = { id: "page", name: "登录", kind: "screen", frame: { x: 0, y: 0, width: 320, height: 240 }, nodes: [makeNode("button", "button", 0, 0)] };
  const document = { ...createDefaultGameFlowDocument("prototype"), pages: [page], interactions: [] };
  const asset: PsdAsset = { name: "login.psd", documentId: "art", sourceHash: "0".repeat(64), hasEmbeddedIdentity: true, width: 320, height: 240, preview: "", layers: [{ key: 0, nativeId: 1, parentKey: null, name: "改过名字", group: false, left: 0, top: 0, width: 100, height: 40, hidden: false, identityOrigin: "embedded", metadata: { namespace: "com.codetypes.gameflow", version: 1, documentId: "art", layerId: "normal", prototype: { documentId: document.documentId, pageId: page.id, nodeId: "button", slot: "normalSkin" } }, config: { enabled: true, name: "normal", exportName: "confirm", nineGrid: null } }] };
  return { page, document, asset };
}
test("page PSD bindings persist independently and reject absolute or malformed sources", () => {
  const f = fixture();
  for (const source of ["login.psd", "../art/登录.psd", "layouts/menu.PSD"]) assert.ok(isPagePsdSource(source));
  for (const source of ["", "/art/a.psd", "C:/art/a.psd", "a\\b.psd", "file:///a.psd", "a.png", "a.psd\n"]) assert.equal(isPagePsdSource(source), false, source);
  for (const binding of [null, { source: "a.psd" }, { source: "a.psd", documentId: " " }, { source: "a.psd", documentId: "a", extra: true }]) assert.equal(isPagePsdBinding(binding), false);
  f.page.artPsd = { source: "../art/login.psd", documentId: "art" };
  f.document.pages.push({ ...f.page, id: "other", nodes: [], artPsd: { source: "menu.psd", documentId: "menu" } });
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(f.document)).pages.map(p => p.artPsd), f.document.pages.map(p => p.artPsd));
  assert.equal(validateGameFlowDocument({ ...f.document, pages: [{ ...f.page, artPsd: { source: "/wrong.psd", documentId: "art" } }] }).ok, false);
});
test("explicit binding maps stable slots, preserves builtins and does not guess another page", () => {
  const f = fixture(), bound = bindPagePsd(f.page, f.document.documentId, "art/login.psd", f.asset);
  assert.equal(bound.artPsd?.source, "art/login.psd"); assert.equal(bound.nodes[0].normalSkin?.builtin, "button/gray");
  assert.equal(bound.nodes[0].normalSkin?.art?.source?.documentId, "art");
  const other = bindPagePsd({ ...f.page, id: "other" }, f.document.documentId, "art/login.psd", f.asset);
  assert.equal(other.nodes[0].normalSkin?.art, undefined); assert.equal(other.artPsd?.documentId, "art");
  const replacement = bindPagePsd(bound, f.document.documentId, "new.psd", { ...f.asset, documentId: "new", layers: [] });
  assert.equal(replacement.nodes[0].normalSkin?.art, undefined); assert.equal(replacement.nodes[0].normalSkin?.builtin, "button/gray");
  assert.deepEqual(bindPagePsd(bound, f.document.documentId, "moved.psd", { ...f.asset, layers: [] }).nodes, bound.nodes);
});
test("page PSD protocol constrains requests and requires an explicit load binding", () => {
  const base = { type: "pagePsd", requestId: "request", pageId: "page" };
  assert.ok(isWebviewToHostMessage({ ...base, action: "choose" }));
  assert.ok(isWebviewToHostMessage({ ...base, action: "load", expected: { source: "a.psd", documentId: "art" } }));
  assert.equal(isWebviewToHostMessage({ ...base, action: "load" }), false);
  assert.equal(isWebviewToHostMessage({ ...base, action: "generate", name: "../a.psd", base64: "YWJj" }), false);
  assert.ok(isWebviewToHostMessage({ ...base, action: "generate", name: "a.psd", base64: "YWJj" }));
  for (const name of ["CON.psd", "a..psd", "../a.psd"]) assert.equal(isWebviewToHostMessage({ ...base, action: "generate", name, base64: "YWJj" }), false);
});
function hostFixture() {
  referenceHost.reset(); const f = fixture(); let text = serializeGameFlowDocument(f.document), opens = 0;
  const doc = { uri: new Uri("/workspace/layouts/main.gameflow.json"), psds: new Map(), currentPsd: { marker: "active editor" }, disposed: false, getText: () => text } as unknown as WorkbenchDocument;
  const psd = { documents: new Map(), async openCustomDocument(uri: Uri) { ++opens; return { uri, bytes: Buffer.from("PSD"), model: { asset: f.asset, dirty: false }, dispose() {} }; } } as unknown as PsdEditorProvider;
  const controller = new PagePsdController(psd);
  return { ...f, doc, controller, get opens() { return opens; }, setDocument: (document: typeof f.document) => { text = serializeGameFlowDocument(document); } };
}
test("host page PSD choice and generation cancellation leave the working copy unchanged", async () => {
  const f = hostFixture(), before = f.doc.getText();
  for (const action of ["choose", "generate"] as const) assert.equal((await f.controller.handle(f.doc, { type: "pagePsd", requestId: action, pageId: "page", action, name: "a.psd", base64: "YWJj" })).cancelled, true);
  assert.equal(f.opens, 0); assert.equal(f.doc.getText(), before); assert.equal(referenceHost.files.size, 0);
});
test("host page PSD loading uses the saved relative source and preserves the active editor", async () => {
  const f = hostFixture(); f.page.artPsd = { source: "../art/login.psd", documentId: "art" }; f.setDocument(f.document);
  const active = f.doc.currentPsd;
  const response = await f.controller.handle(f.doc, { type: "pagePsd", requestId: "load", pageId: "page", action: "load", expected: f.page.artPsd });
  assert.equal(response.error, undefined); assert.equal(response.source, "../art/login.psd"); assert.equal(response.draft?.documentId, "art");
  assert.equal(f.doc.currentPsd, active); assert.equal(f.opens, 1); assert.ok(f.doc.psds.has("file:///workspace/art/login.psd"));
  const stale = await f.controller.handle(f.doc, { type: "pagePsd", requestId: "old", pageId: "page", action: "load", expected: { source: "other.psd", documentId: "art" } });
  assert.match(stale.error!, /已变化/); assert.equal(f.opens, 1);
});
test("host PSD binding rejects identity mismatch and missing target pages", async () => {
  const f = hostFixture(); f.page.artPsd = { source: "a.psd", documentId: "wrong" }; f.setDocument(f.document);
  assert.match((await f.controller.handle(f.doc, { type: "pagePsd", requestId: "bad", pageId: "page", action: "load", expected: f.page.artPsd })).error!, /身份/);
  assert.match((await f.controller.handle(f.doc, { type: "pagePsd", requestId: "gone", pageId: "deleted", action: "choose" })).error!, /已删除/);
});
test("save as rebases every page PSD while preserving source file identity", () => {
  const f = fixture(); f.page.artPsd = { source: "../art/login.psd", documentId: "art" };
  const rebased = rebasePagePsds(f.document, new Uri("/workspace/layouts/main.gameflow.json") as unknown as vscode.Uri, new Uri("/workspace/copy/deep/main.gameflow.json") as unknown as vscode.Uri);
  assert.equal(rebased.pages[0].artPsd?.source, "../../art/login.psd"); assert.equal(rebased.pages[0].artPsd?.documentId, "art");
  assert.notEqual(pagePsdKey(rebased.pages[0].artPsd), pagePsdKey(f.page.artPsd)); assert.equal(f.page.artPsd.source, "../art/login.psd");
});

test("host choice and generation return the selected file for the captured page", async () => {
  for (const action of ["choose", "generate"] as const) {
    const f = hostFixture(); referenceHost.picked = new Uri("/workspace/art/chosen.psd");
    const result = await f.controller.handle(f.doc, { type: "pagePsd", requestId: action, pageId: "page", action, name: "chosen.psd", base64: "YWJj" });
    assert.equal(result.error, undefined); assert.equal(result.source, "../art/chosen.psd"); assert.equal(result.draft?.documentId, "art");
    assert.equal(f.opens, 1); assert.equal(parseGameFlowDocument(f.doc.getText()).pages[0].artPsd, undefined);
    assert.equal(referenceHost.files.get("/workspace/art/chosen.psd"), action === "generate" ? "abc" : undefined);
  }
});
