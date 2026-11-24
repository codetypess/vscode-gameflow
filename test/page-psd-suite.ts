import assert from "node:assert/strict";
import type * as vscode from "vscode";
import { createDefaultGameFlowDocument, isPagePsdBinding, isPagePsdSource, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type GameFlowPage } from "../shared/model";
import { bindPagePsd, pagePsdKey } from "../shared/page-psd";
import { isWebviewToHostMessage } from "../shared/protocol";
import { effectiveExportName, makeSliceExportBatch } from "../shared/psd-export";
import type { PsdAsset, PsdLayer } from "../shared/psd-meta";
import { makeNode } from "../shared/editor-ops";
import { prototypeTree, psdTree, compareTrees, coordinatedBase, plannedTrees } from "../shared/page-sync";
import { PagePsdController, rebasePagePsds } from "../src/page-psd-controller";
import type { PsdEditorProvider } from "../src/psd-editor-provider";
import type { WorkbenchDocument } from "../src/workbench-document";
import { referenceHost, Uri, workspace, TestTextDocument } from "./vscode-reference-host";
import { bytesHash } from "../src/psd-document-model";
const tests: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) => tests.push({ name, run });
export const pagePsdTests = tests;
test("property sync suggests a source only for an agreed, recorded value",()=>{
  const {page}=fixture();
  const [node]=prototypeTree(page);
  const old={...node,properties:{enabled:false,count:0,label:"",link:null,deferred:false},undecided:["property:deferred"]};
  const base={version:1 as const,documentId:"doc",pageId:page.id,psdId:"target",nodes:[old]};
  const right={...node,properties:{...old.properties,enabled:true,count:1,label:"new",link:"target",deferred:true,added:3}};
  const comparison=compareTrees([old],[right],base);
  const suggestions=Object.fromEntries(comparison.changes.map(change=>[change.property,change.suggested]));
  assert.deepEqual(suggestions,{enabled:"psd",count:"psd",label:"psd",link:"psd",deferred:undefined,added:undefined});
});
test("sync ignores skin sublayers and pixel geometry while tracking text and subtree deletions",()=>{
  const {page,asset,document}=fixture();
  const [button]=prototypeTree(page);
  const art={...button,layer:"button-layer",frame:{...button.frame,x:200,width:300}};
  const proto=[button], psd=[art];
  const base=coordinatedBase(document.documentId,page.id,asset.documentId,compareTrees(proto,psd),{proto,psd});
  assert.deepEqual(compareTrees(proto,psd,base).changes,[]);
  assert.equal(compareTrees(proto,[],base).changes[0].kind,"delete");
  assert.deepEqual(psdTree(document.documentId,page,asset,()=>{throw Error("art layer treated as a control");}),[]);
});
test("skipping an initial text disagreement does not assign it to one side on reopen",()=>{
  const {page}=fixture();
  const left={...prototypeTree(page)[0],type:"text" as const,text:"left"};
  const proto=[left], psd=[{...left,text:"right"}];
  const c=compareTrees(proto,psd), trees=plannedTrees(c,{[left.id+"/text"]:"skip"});
  const base=coordinatedBase("d",page.id,"a",c,trees);
  assert.equal(compareTrees(proto,psd,base).changes[0].suggested,undefined);
});
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
  assert.deepEqual(bindPagePsd(bound, f.document.documentId, "moved.psd", { ...f.asset, layers: [] }).nodes, f.page.nodes, "removed layers release their derived slots");
});
test("public PSD groups resolve direct state and image markers, without prototype metadata", () => {
  const { document, page, asset } = fixture();
  const button = { ...page.nodes[0], name: "登录按钮" };
  const icon = { ...makeNode("image", "icon", 0, 0), name: "头像" };
  page.nodes = [button, icon];
  const layer = (key: number, parentKey: number | null, name: string, group = false): PsdLayer => ({
    ...asset.layers[0], key, parentKey, name, group, image: "data:image/png;base64,AAAA",
    config: { enabled: !group, name, nineGrid: null },
    metadata: { namespace: "com.codetypes.gameflow", version: 1, documentId: asset.documentId, layerId: String(key) }
  });
  const normal = layer(2, 1, "@normal"), selected = layer(3, 1, "@selected"), image = layer(5, 4, "@image");
  selected.config.exportName = "CUSTOM_SELECTED";
  asset.layers = [layer(1, null, button.name, true), normal, selected, layer(4, null, icon.name, true), image];
  const bind = () => bindPagePsd(page, document.documentId, asset.name, asset);
  const bound = bind();
  assert.equal(bound.nodes[0].normalSkin?.art?.path, "unclassified/login_dlan_normal.png");
  assert.equal(bound.nodes[0].selectedSkin?.art?.path, "unclassified/login_dlan_selected.png");
  assert.equal(bound.nodes[0].disabledSkin, undefined);
  assert.equal(bound.nodes[1].image?.art?.path, "unclassified/login_tx.png");
  asset.atlasName = "Menu";
  assert.equal(bind().nodes[0].normalSkin?.art?.path, "unclassified/menu_dlan_normal.png");
  normal.config.shared = true;
  assert.equal(bind().nodes[0].normalSkin?.art?.path, "shared/menu_dlan_normal.png");
  normal.config.shared = false;
  asset.layers.push(layer(6, null, "退出按钮", true), layer(7, 6, "@normal"));
  const ordinary = layer(9, null, "普通切图");
  ordinary.config.exportName = "custom_image";
  asset.layers.push(ordinary);
  const batch = makeSliceExportBatch(asset);
  assert.equal(effectiveExportName(asset, normal), "menu_dlan_normal");
  assert.equal(bind().nodes[0].normalSkin?.art?.path, "unclassified/menu_dlan_normal.png");
  assert.ok(batch.items.some(item => item.name === "menu_dlan_selected"));
  assert.ok(batch.items.some(item => item.name === "menu_custom_image"));
  assert.ok(batch.items.some(item => item.name === "menu_tcan_normal"));
  asset.layers.push(layer(8, 1, "@normal"));
  assert.throws(bind, /登录按钮.*@normal.*多个 PSD 图层/);
  asset.layers.pop();
  page.nodes.push({ ...button, id: "second" });
  assert.throws(bind, /多个同名控件/);
});
test("button state export and page binding follow the parent group's custom export name", () => {
  const { asset, page, document } = fixture();
  const base = asset.layers[0];
  page.nodes[0].name = "Expedition";
  const owner: PsdLayer = {
    ...base, name: page.nodes[0].name, group: true,
    metadata: { ...base.metadata, layerId: "button-owner", variableName: "startButton" },
    config: { enabled: false, name: page.nodes[0].name, exportName: "BTN_Launch_Expedition", nineGrid: null }
  };
  const states = ["normal", "selected", "disabled"] as const;
  asset.layers = [owner, ...states.map((state, index) => ({
    ...base, key: index + 1, parentKey: owner.key, name: `@${state}`, image: "data:image/png;base64,AAAA",
    metadata: { ...base.metadata, layerId: state },
    config: { enabled: true, name: `@${state}`, exportName: "old_override", nineGrid: null }
  }))];
  const assertNames = (button: string) => {
    const groupName = `login_${button}`;
    assert.equal(effectiveExportName(asset, owner), groupName);
    const names = states.map(state => `${groupName}_${state}`);
    assert.deepEqual(makeSliceExportBatch(asset).items.map(item => item.name), names);
    const node = bindPagePsd(page, document.documentId, asset.name, asset).nodes[0];
    assert.deepEqual([node.normalSkin, node.selectedSkin, node.disabledSkin].map(slot => slot?.art?.path),
      names.map(name => `unclassified/${name}.png`));
  };
  assertNames("launch_expedition");
  owner.config.exportName = "continue";
  assertNames("continue");
  owner.config.variableName = "login_special";
  assertNames("login_special");
  owner.config.variableName = "btn_manual";
  assertNames("btn_manual");
  asset.layers[1].config.variableName = "ignored_child";
  assertNames("btn_manual");
  owner.config.variableName = "";
  assertNames("expedition");
  owner.name = "Journey";
  page.nodes[0].name = owner.name;
  assertNames("journey");
});

test("PSD image markers follow the parent variable and keep atlas names in shared exports", () => {
  const { asset } = fixture(), base = asset.layers[0];
  const owner: PsdLayer = { ...base, group: true, name: "头像 (UIImage)", config: { ...base.config, enabled: false, exportName: undefined, variableName: "portrait" } };
  const image: PsdLayer = { ...base, key: 1, parentKey: owner.key, name: "@image", image: "data:image/png;base64,AAAA", metadata: { ...base.metadata, layerId: "portrait-image" }, config: { ...base.config, variableName: "ignored", shared: true } };
  asset.layers = [owner, image];
  assert.equal(makeSliceExportBatch(asset).items[0].name, "login_portrait");
  owner.config.variableName = "";
  assert.equal(makeSliceExportBatch(asset).items[0].name, "login_tx");
  asset.atlasName = "menu";
  assert.equal(makeSliceExportBatch(asset).items[0].name, "menu_tx");
});
test("page PSD protocol constrains requests and requires an explicit load binding", () => {
  const base = { type: "pagePsd", requestId: "request", pageId: "page" };
  assert.ok(isWebviewToHostMessage({ ...base, action: "choose" }));
  assert.ok(isWebviewToHostMessage({ ...base, action: "load", expected: { source: "a.psd", documentId: "art" } }));
  assert.equal(isWebviewToHostMessage({ ...base, action: "load" }), false);
  assert.ok(isWebviewToHostMessage({ ...base, action: "slice", expected: { source: "../art/a.psd", documentId: "art" } }));
  assert.equal(isWebviewToHostMessage({ ...base, action: "slice" }), false);
  assert.equal(isWebviewToHostMessage({ ...base, action: "generate", name: "../a.psd", base64: "YWJj" }), false);
  assert.ok(isWebviewToHostMessage({ ...base, action: "generate", name: "a.psd", base64: "YWJj" }));
  for (const name of ["CON.psd", "a..psd", "../a.psd"]) assert.equal(isWebviewToHostMessage({ ...base, action: "generate", name, base64: "YWJj" }), false);
});
function hostFixture(uri = new Uri("/workspace/layouts/main.gameflow.json")) {
  referenceHost.reset(); const f = fixture(); let text = serializeGameFlowDocument(f.document), opens = 0;
  const doc = { uri, psds: new Map(), currentPsd: { marker: "active editor" }, disposed: false, getText: () => text } as unknown as WorkbenchDocument;
  const documents = new Map();
  const psd = { documents, async openCustomDocument(uri: Uri) { ++opens; const loaded = { uri, panels: new Set(), bytes: Buffer.from("PSD"), model: { asset: f.asset, dirty: false }, dispose() { documents.delete(uri.toString()); } }; documents.set(uri.toString(), loaded); return loaded; } } as unknown as PsdEditorProvider;
  const controller = new PagePsdController(psd, async () => { assert.fail("A background page operation opened the slice editor"); });
  return { ...f, doc, psd, controller, get opens() { return opens; }, setDocument: (document: typeof f.document) => { text = serializeGameFlowDocument(document); } };
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
  assert.equal(f.doc.currentPsd, active); assert.equal(f.opens, 1); assert.equal(f.doc.psds.size, 0); assert.equal(f.psd.documents.size, 0);
  const stale = await f.controller.handle(f.doc, { type: "pagePsd", requestId: "old", pageId: "page", action: "load", expected: { source: "other.psd", documentId: "art" } });
  assert.match(stale.error!, /已变化/); assert.equal(f.opens, 1);
});
test("host PSD binding rejects identity mismatch and missing target pages", async () => {
  const f = hostFixture(); f.page.artPsd = { source: "a.psd", documentId: "wrong" }; f.setDocument(f.document);
  for (const action of ["slice", "load"] as const) {
    f.doc.psds.clear();
    assert.match((await f.controller.handle(f.doc, { type: "pagePsd", requestId: "bad", pageId: "page", action, expected: f.page.artPsd })).error!, /身份/);
  }
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

test("background PSD reads release ownership so same-name regeneration can repeat", async () => {
  const f = hostFixture(); referenceHost.picked = new Uri("/workspace/art/chosen.psd");
  const request = { type: "pagePsd" as const, requestId: "repeat", pageId: "page", action: "generate" as const, name: "chosen.psd", base64: "YWJj" };
  for (let i = 0; i < 3; i++) {
    const result = await f.controller.handle(f.doc, request);
    assert.equal(result.error, undefined); assert.equal(result.draft?.documentId, "art");
    assert.equal(f.doc.psds.size, 0); assert.equal(f.psd.documents.size, 0);
  }
  assert.equal(f.opens, 3);
});

test("PSD regeneration protects dirty configuration and other editing sessions before writing", async () => {
  for (const mode of ["dirty", "foreign", "text"] as const) {
    const f = hostFixture(), uri = new Uri("/workspace/art/chosen.psd"); referenceHost.picked = uri;
    referenceHost.files.set(uri.path, "original");
    const loaded = await f.psd.openCustomDocument(uri as unknown as vscode.Uri, {} as never, {} as never);
    if (mode === "dirty") { Object.defineProperty(loaded.model, "dirty", { value: true }); f.doc.psds.set(uri.toString(), loaded); }
    if (mode === "text") { loaded.dispose(); const text = new TestTextDocument(uri, "unsaved"); text.isDirty = true; workspace.textDocuments.push(text); }
    const result = await f.controller.handle(f.doc, { type: "pagePsd", requestId: mode, pageId: "page", action: "generate", name: "chosen.psd", base64: "YWJj" });
    assert.ok(result.error); assert.equal(referenceHost.files.get(uri.path), "original");
    if (mode === "dirty") assert.equal(f.doc.psds.get(uri.toString()), loaded);
  }
});

test("page loading retains active slice sessions and unsaved drafts", async () => {
  for (const mode of ["current", "panel", "dirty"] as const) {
    const f = hostFixture(), uri = new Uri("/workspace/art/login.psd");
    f.page.artPsd = { source: "../art/login.psd", documentId: "art" }; f.setDocument(f.document);
    referenceHost.files.set(uri.path, "PSD"); f.asset.sourceHash = bytesHash(Buffer.from("PSD"));
    const loaded = await f.psd.openCustomDocument(uri as unknown as vscode.Uri, {} as never, {} as never);
    f.doc.psds.set(uri.toString(), loaded);
    if (mode === "current") f.doc.currentPsd = loaded;
    if (mode === "panel") loaded.panels.add({} as never);
    if (mode === "dirty") Object.defineProperty(loaded.model, "dirty", { value: true });
    const result = await f.controller.handle(f.doc, { type: "pagePsd", requestId: mode, pageId: "page", action: "load", expected: f.page.artPsd });
    assert.equal(result.error, undefined); assert.equal(f.doc.psds.get(uri.toString()), loaded); assert.equal(f.psd.documents.get(uri.toString()), loaded);
  }
});

test("Windows page PSD choice and generation ignore drive and common directory casing", async () => {
  for (const action of ["choose", "generate"] as const) {
    const f = hostFixture(new Uri("/d:/Users/Bite/Project/layouts/main.gameflow.json"));
    referenceHost.picked = new Uri("/D:/users/bite/project/Art/登录.PSD");
    const result = await f.controller.handle(f.doc, { type: "pagePsd", requestId: action, pageId: "page", action, name: "登录.PSD", base64: "YWJj" });
    assert.equal(result.error, undefined); assert.equal(result.source, "../Art/登录.PSD");
    assert.equal(f.opens, 1); assert.equal(parseGameFlowDocument(f.doc.getText()).pages[0].artPsd, undefined);
    assert.equal(referenceHost.files.get(referenceHost.picked.path), action === "generate" ? "abc" : undefined);
  }
});
test("Windows page PSD rejects a genuinely different drive before loading or generating", async () => {
  for (const action of ["choose", "generate"] as const) {
    const f = hostFixture(new Uri("/d:/project/layouts/main.gameflow.json"));
    referenceHost.picked = new Uri("/E:/project/art/login.psd");
    const before = f.doc.getText();
    const result = await f.controller.handle(f.doc, { type: "pagePsd", requestId: action, pageId: "page", action, name: "login.psd", base64: "YWJj" });
    assert.match(result.error!, /同一磁盘/); assert.equal(f.opens, 0); assert.equal(referenceHost.files.size, 0);
    assert.equal(f.doc.getText(), before);
  }
});
test("Windows save as rebases page PSD with mixed drive casing and preserves target spelling", () => {
  const f = fixture(); f.page.artPsd = { source: "../Art/登录.PSD", documentId: "art" };
  const rebased = rebasePagePsds(f.document, new Uri("/d:/Project/layouts/main.gameflow.json") as unknown as vscode.Uri, new Uri("/D:/project/copy/deep/main.gameflow.json") as unknown as vscode.Uri);
  assert.equal(rebased.pages[0].artPsd?.source, "../../Art/登录.PSD");
  assert.equal(f.page.artPsd.source, "../Art/登录.PSD");
});
test("remote POSIX page PSD paths preserve case-sensitive directory identity", async () => {
  const owner = new Uri("/workspace/Layouts/main.gameflow.json"), target = new Uri("/workspace/layouts/Art/login.PSD");
  owner.scheme = target.scheme = "vscode-remote"; owner.authority = target.authority = "ssh-remote+test";
  const f = hostFixture(owner); referenceHost.picked = target;
  const result = await f.controller.handle(f.doc, { type: "pagePsd", requestId: "remote", pageId: "page", action: "choose" });
  assert.equal(result.error, undefined); assert.equal(result.source, "../layouts/Art/login.PSD");
});
