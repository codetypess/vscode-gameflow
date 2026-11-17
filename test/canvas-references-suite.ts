import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canvasExtractionIssue, extractCanvasComponent, findCanvasTarget, loadCanvasSources, makeCanvasInstance, projectCanvasReferences, resolveCanvasSource } from "../shared/canvas-references";
import { GAMEFLOW_SCHEMA_VERSION, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type GameFlowDocument, type GameFlowNode, type GameFlowPage } from "../shared/model";
import { duplicateNode, duplicatePage, insertNode, makeComponent, moveNode, reparentNode } from "../shared/editor-ops";
import { canHaveChildren } from "../shared/ui-components";
import { copyNode, pasteNode } from "../shared/node-clipboard";
import { migrateDocumentElementIds } from "../shared/document-id-migration";
import { resolvePageLayout } from "../shared/ui-layout";
import { changeContainerType, convertNodeType } from "../shared/ui-edit";
import { isWebviewToHostMessage, type WebviewToHostMessage } from "../shared/protocol";
import { DocumentSession } from "../webview/document-session";
import { NodeView } from "../webview/editor/node-view";
import { canvasHitNode, canvasScopePath } from "../webview/lib/canvas-scope";
import { placeCanvasComponent } from "../webview/lib/canvas-scope";
import { duplicateSelection } from "../shared/selection-ops";

export const canvasReferenceTests: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) => canvasReferenceTests.push({ name, run });
let serial = 0;
const ids = () => `new${++serial}`;
const node = (id: string, parentId?: string): GameFlowNode => ({ id, name: id, type: "container", parentId, frame: { x: 20, y: 30, width: 220, height: 100 } });
const page = (id: string, nodes: GameFlowNode[] = []): GameFlowPage => ({ id, name: id, rootType: "UIBox", kind: "screen", frame: { x: 80, y: 90, width: 500, height: 400 }, nodes });
const doc = (...pages: GameFlowPage[]): GameFlowDocument => ({ schemaVersion: GAMEFLOW_SCHEMA_VERSION, elementIdScheme: "nanoid-8", documentId: "module-a", title: "A", pages, requirements: [], interactions: [] });
const fixture = () => {
  const root = { ...node("root"), style: { fill: "#446688", opacity: .7 }, transform: { rotation: 17, scaleX: 1.2, anchorX: .5 }, layout: { paddingLeft: 8 } };
  const label: GameFlowNode = { ...node("label", "root"), type: "text", text: "共享内容", frame: { x: 5, y: 8, width: 100, height: 25 } };
  return doc(page("main", [root, label, node("sibling")]));
};
const extracted = () => extractCanvasComponent(fixture(), "main", "root", ids);

test("saving an eligible UIBox creates one component and an identity-preserving atomic instance", () => {
  const before = fixture(), snapshot = JSON.stringify(before);
  const after = extractCanvasComponent(before, "main", "root", ids);
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(after.pages.length, 2);
  const instance = after.pages[0].nodes[0], source = after.pages[1];
  assert.equal(instance.id, "root"); assert.equal(instance.prefab?.pageId, source.id);
  assert.equal(instance.prefab?.documentId, before.documentId); assert.equal(instance.prefab?.source, "");
  assert.deepEqual(instance.transform, before.pages[0].nodes[0].transform);
  assert.equal(instance.style, undefined); assert.equal(instance.layout?.paddingLeft, undefined);
  assert.deepEqual(after.pages[0].nodes.map(n => n.id), ["root", "sibling"]);
  assert.equal(source.rootType, "UIBox"); assert.equal(source.nodes.length, 2);
  const root = source.nodes.find(n => n.id === source.componentRootId)!;
  assert.deepEqual(root.frame, { x: 0, y: 0, width: 220, height: 100 });
  assert.equal(root.parentId, undefined); assert.equal(root.transform, undefined);
  assert.equal(source.nodes[1].parentId, root.id);
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(after)), JSON.parse(JSON.stringify(after)));
  assert.equal(serializeGameFlowDocument(after).includes("@reference:"), false);
});

test("extraction preserves transformed subtree geometry and source root appearance defaults", () => {
  const before = fixture();
  before.pages[0].nodes.unshift({ ...node("parent"), transform: { rotation: -12, scaleY: 1.3 }, layout: { scrollX: 7 } });
  before.pages[0].nodes[1].parentId = "parent";
  before.pages[0].nodes[1].widget = { disabled: true };
  const after = extractCanvasComponent(before, "main", "root", ids);
  const projection = projectCanvasReferences(after, after.pages[0], {});
  const original = resolvePageLayout(before.pages[0]);
  const projected = resolvePageLayout(projection.page);
  for (const originalId of ["root", "label"]) {
    const actualId = originalId === "root" ? "root" : projection.page.nodes.find(n => n.name === "label")!.id;
    original.nodes.get(originalId)!.corners.forEach((p, i) => {
      const actual = projected.nodes.get(actualId)!.corners[i];
      assert.ok(Math.abs(p.x - actual.x) < 1e-8); assert.ok(Math.abs(p.y - actual.y) < 1e-8);
    });
  }
  assert.equal(projection.page.nodes.find(n => n.id === "root")!.style?.fill, "#446688");
  assert.equal(projection.page.nodes.find(n => n.id === "root")!.widget?.disabled, true);
  const noStyle = fixture(); delete noStyle.pages[0].nodes[0].style;
  const plain = extractCanvasComponent(noStyle, "main", "root", ids);
  assert.equal(projectCanvasReferences(plain, plain.pages[0], {}).page.nodes[0].style?.fill, undefined, "ordinary UIBox style defaults remain in force");
});

test("extraction preserves anchor compensation and measured or stretched root placement", () => {
  for (const layout of [{ positionOffsetX: 12.5, positionOffsetY: -3.25 }, { left: 0, right: 0, top: 20, positionOffsetX: -8 }, { widthMode: "measured" as const, heightMode: "measured" as const, positionOffsetY: 9 }]) {
    const input = fixture(); input.pages[0].nodes[0].layout = layout;
    const original = resolvePageLayout(input.pages[0]).nodes.get("root")!;
    const after = extractCanvasComponent(input, "main", "root", ids);
    const projected = resolvePageLayout(projectCanvasReferences(after, after.pages[0], {}).page).nodes.get("root")!;
    assert.deepEqual(projected.corners, original.corners);
    const definition = after.pages[1], root = definition.nodes.find(n => n.id === definition.componentRootId)!;
    assert.equal(resolvePageLayout(definition).nodes.get(root.id)!.local.x, 0);
  }
});

test("checked-in module samples resolve their real relative file dependency", async () => {
  const root = parseGameFlowDocument(readFileSync("sample/canvas-reference-demo.gameflow.json", "utf8"));
  const sources = await loadCanvasSources(root, async source => parseGameFlowDocument(readFileSync(`sample/${source}`, "utf8")));
  const result = projectCanvasReferences(root, root.pages[0], sources);
  assert.equal(result.errors.size, 0);
  assert.equal(result.page.nodes.filter(n => n.text === "来自公共模块的组件").length, 2);
});

test("save-to-canvas rejects non-canvas types, existing definitions, references and locked descendants", () => {
  const input = fixture(), p = input.pages[0];
  for (const type of ["text", "button", "panel", "hbox", "image"] as const) {
    const candidate = { ...p, nodes: [{ ...p.nodes[0], type }] };
    assert.match(canvasExtractionIssue(candidate, "root")!, /UIBox/);
  }
  p.nodes[1].locked = true;
  assert.throws(() => extractCanvasComponent(input, p.id, "root", ids), /解锁/);
  const after = extracted();
  assert.match(canvasExtractionIssue(after.pages[0], "root")!, /UIBox/);
  assert.match(canvasExtractionIssue(after.pages[1], after.pages[1].componentRootId!)!, /根节点/);
  const empty = page("empty", [{ ...node("measured"), layout: { widthMode: "measured" } }]);
  assert.match(canvasExtractionIssue(empty, "measured")!, /尺寸为空/);
});

test("component board insertion, paste, duplication and tree moves retain a single canvas root", () => {
  const input = extracted(), definition = input.pages[1], rootId = definition.componentRootId!;
  const placed = placeCanvasComponent(definition, null, "button", { x: 30, y: 40 }, ids);
  assert.equal(placed.page.nodes.find(n => n.id === placed.id)!.parentId, rootId);
  const added = insertNode(definition, node("added"));
  assert.equal(added.nodes.find(n => n.id === "added")!.parentId, rootId);
  const paste = pasteNode(definition, copyNode(definition, rootId)!, ids);
  assert.equal(paste.page.nodes.find(n => n.id === paste.id)!.parentId, rootId);
  const copy = duplicateSelection(definition, [rootId], ids);
  assert.equal(copy.page.nodes.find(n => n.id === copy.ids[0])!.parentId, rootId);
  const singleCopy = duplicateNode(definition, rootId, ids);
  assert.equal(singleCopy.page.nodes.find(n => n.id === singleCopy.id)!.parentId, rootId);
  const moved = moveNode(placed.page, placed.id!, { position: "inside" });
  assert.equal(moved.nodes.find(n => n.id === placed.id)!.parentId, rootId);
  assert.equal(reparentNode(placed.page, rootId, placed.id!), placed.page);
  const projection = projectCanvasReferences({ ...input, pages: [input.pages[0], paste.page] }, input.pages[0], {});
  assert.equal(projection.errors.size, 0);
});

test("extraction rejects cross-boundary controls and remaps contained control bindings", () => {
  const controls = makeComponent("radioGroup", "group", 0, 0, ids);
  controls[0].parentId = "root";
  const input = doc(page("main", [node("root"), ...controls]));
  const output = extractCanvasComponent(input, "main", "root", ids);
  assert.equal(validateGameFlowDocument(output).ok, true);
  const projected = projectCanvasReferences(output, output.pages[0], {}).page;
  assert.equal(validateGameFlowDocument(doc(projected)).ok, true, "virtual radio/skin references are remapped consistently");
  controls.find(n => n.type === "radio")!.parentId = undefined;
  assert.match(canvasExtractionIssue(input.pages[0], "root")!, /外部节点/);
});

test("source content and container layout update all instances without changing persisted placement", () => {
  const input = extracted(), p = input.pages[0], definition = input.pages[1];
  const second = { ...makeCanvasInstance(input, definition, "", "second"), frame: { x: 280, y: 40, width: 300, height: 140 } };
  p.nodes.push(second);
  const snapshot = JSON.stringify(p);
  const sourceRoot = definition.nodes.find(n => n.id === definition.componentRootId)!;
  sourceRoot.style = { fill: "#112233" }; sourceRoot.layout = { ...sourceRoot.layout, paddingLeft: 15, positionOffsetX: 77 };
  const label = definition.nodes.find(n => n.type === "text")!;
  label.text = "源已修改"; label.layout = { left: 0, right: 0, top: 0 };
  const result = projectCanvasReferences(input, p, {});
  assert.equal(JSON.stringify(p), snapshot, "projection never edits instance JSON");
  const labels = result.page.nodes.filter(n => n.text === "源已修改");
  assert.equal(labels.length, 2);
  const geometry = resolvePageLayout(result.page);
  assert.deepEqual(labels.map(n => geometry.nodes.get(n.id)!.local.width), [205, 285]);
  assert.equal(result.page.nodes.find(n => n.id === "second")!.style?.fill, "#112233");
  assert.equal(geometry.nodes.get("second")!.local.x, 280, "source-root placement never overrides instance placement");
  assert.deepEqual(p.nodes.find(n => n.id === "second")!.frame, second.frame);
});

test("cross-file dependencies resolve against each containing module including local nested targets", async () => {
  const leaf = doc(page("leaf", [{ ...node("caption"), type: "text", text: "跨文件内容" }])); leaf.documentId = "common";
  const module = doc(page("exported", [{ ...node("nested"), prefab: { source: "../common/widgets.gameflow.json", documentId: leaf.documentId, pageId: "leaf" } }])); module.documentId = "module-b";
  const root = doc(page("main", [makeCanvasInstance(module, module.pages[0], "../module-b/ui.gameflow.json", "instance")]));
  const reads: string[] = [];
  const files: Record<string, GameFlowDocument> = { "../module-b/ui.gameflow.json": module, "../common/widgets.gameflow.json": leaf };
  const sources = await loadCanvasSources(root, async key => { reads.push(key); return files[key]; });
  assert.deepEqual(reads, Object.keys(files));
  assert.equal(resolveCanvasSource("../module-b/ui.gameflow.json", "./../common/widgets.gameflow.json"), "../common/widgets.gameflow.json");
  const result = projectCanvasReferences(root, root.pages[0], sources);
  assert.equal(result.errors.size, 0);
  const content = result.page.nodes.find(n => n.text === "跨文件内容")!;
  assert.equal(result.owners.get(content.id), "instance");
  leaf.pages[0].nodes[0].text = "未保存修改";
  assert.ok(projectCanvasReferences(root, root.pages[0], sources).page.nodes.some(n => n.text === "未保存修改"));
  module.pages.push(page("same-file", [{ ...node("internal"), type: "text", text: "B 内部画布" }]));
  module.pages[0].nodes.push(makeCanvasInstance(module, module.pages[1], "", "local"));
  assert.ok(projectCanvasReferences(root, root.pages[0], sources).page.nodes.some(n => n.text === "B 内部画布"));
});

test("missing files, invalid source content, wrong identities and deleted component roots remain diagnosable", async () => {
  const input = extracted(), instance = input.pages[0].nodes[0];
  const missing = structuredClone(input); missing.pages.splice(1);
  assert.match(projectCanvasReferences(missing, missing.pages[0], {}).errors.get("root")!, /已删除/);
  instance.prefab!.source = "../missing.gameflow.json";
  const sources = await loadCanvasSources(input, async () => { throw new Error("磁盘文件不存在"); });
  const result = projectCanvasReferences(input, input.pages[0], sources);
  assert.match(result.errors.get("root")!, /磁盘文件不存在/); assert.ok(result.page.nodes.some(n => n.id === "root"));
  assert.equal(validateGameFlowDocument(input).ok, true, "unresolved dependencies do not destroy the editable document");
  assert.match(findCanvasTarget(input, { [instance.prefab!.source]: { source: instance.prefab!.source, document: { ...input, documentId: "other" } } }, instance.prefab!).error!, /身份/);
  instance.prefab!.source = ""; input.pages[1].nodes = [];
  assert.match(projectCanvasReferences(input, input.pages[0], {}).errors.get("root")!, /根节点已删除/);
});

test("local and cross-file cycles stop with a selectable instance and bounded source reads", async () => {
  const input = doc(page("main"));
  input.pages[0].nodes.push(makeCanvasInstance(input, input.pages[0], "", "cycle"));
  assert.match(projectCanvasReferences(input, input.pages[0], {}).errors.get("cycle")!, /循环/);
  const external = doc(page("external")); external.documentId = "external";
  input.pages[0].nodes[0].prefab = { source: "b.gameflow.json", documentId: "external", pageId: "external" };
  external.pages[0].nodes.push(makeCanvasInstance(external, external.pages[0], "", "back"));
  let reads = 0;
  const sources = await loadCanvasSources(input, async () => { reads++; return external; });
  assert.equal(reads, 1);
  assert.match(projectCanvasReferences(input, input.pages[0], sources).errors.get("cycle")!, /循环/);
});

test("projection limits cannot drop real nodes and virtual identities cannot collide with real IDs", () => {
  const input = doc(page("main"), page("huge", Array.from({ length: 5002 }, (_, i) => ({ ...node(`child${i}`), type: "text" as const, text: "a" }))));
  input.pages[0].nodes = [makeCanvasInstance(input, input.pages[1], "", "instance"), node("@reference:1"), node("tail")];
  const result = projectCanvasReferences(input, input.pages[0], {});
  assert.match(result.errors.get("instance")!, /5000/);
  assert.equal(result.page.nodes.filter(n => n.id === "@reference:1").length, 1);
  assert.ok(result.page.nodes.some(n => n.id === "tail"));
  assert.equal(new Set(result.page.nodes.map(n => n.id)).size, result.page.nodes.length);
  const chain = doc(...Array.from({ length: 27 }, (_, i) => page(`p${i}`)));
  chain.pages.slice(0, -1).forEach((p, i) => p.nodes.push(makeCanvasInstance(chain, chain.pages[i + 1], "", `link${i}`)));
  assert.match(projectCanvasReferences(chain, chain.pages[0], {}).errors.get("link0")!, /24/);
});

test("reference instances reject children and scopes, preserve targets on copy and remap definition identities", () => {
  const input = extracted(), p = input.pages[0], instance = p.nodes[0];
  assert.equal(canHaveChildren(instance), false);
  assert.deepEqual(canvasScopePath(p, instance.id), []);
  assert.equal(canvasHitNode(p, null, instance.id, true)?.id, instance.id);
  assert.equal(insertNode(p, node("forbidden"), instance.id), p);
  assert.equal(convertNodeType(p, instance.id, "button"), p);
  assert.equal(changeContainerType(p, instance.id, "hbox"), p);
  const pasted = pasteNode(p, copyNode(p, instance.id)!, ids);
  assert.deepEqual(pasted.page.nodes.find(n => n.id === pasted.id)!.prefab, instance.prefab);
  const copy = duplicatePage(input.pages[1], ids);
  assert.notEqual(copy.componentRootId, input.pages[1].componentRootId);
  assert.ok(copy.nodes.some(n => n.id === copy.componentRootId));
  delete input.elementIdScheme;
  const migrated = migrateDocumentElementIds(input);
  assert.equal(migrated.pages[0].nodes[0].prefab!.pageId, migrated.pages[1].id);
  assert.ok(migrated.pages[1].nodes.some(n => n.id === migrated.pages[1].componentRootId));
});

test("projected DOM hits select the owning instance and broken references display an explanation", () => {
  const input = extracted(), result = projectCanvasReferences(input, input.pages[0], {});
  const label = result.page.nodes.find(n => n.type === "text")!;
  const html = renderToStaticMarkup(createElement(NodeView, { page: result.page, node: label, hitId: result.owners.get(label.id) }));
  assert.match(html, /data-node-id="root"/);
  const broken = renderToStaticMarkup(createElement(NodeView, { page: input.pages[0], node: input.pages[0].nodes[0], referenceError: "源画布已删除" }));
  assert.match(broken, /组件引用失效/); assert.match(broken, /源画布已删除/);
});

test("v4 reference validation protects ownership, relative paths and legacy version compatibility", () => {
  const valid = extracted(); assert.equal(validateGameFlowDocument(valid).ok, true);
  for (const version of [1, 2, 3] as const) assert.equal(validateGameFlowDocument({ ...valid, schemaVersion: version }).ok, false);
  for (const version of [1, 2, 3] as const) assert.equal(parseGameFlowDocument(serializeGameFlowDocument({ ...doc(page("legacy")), schemaVersion: version, pages: [{ ...page("legacy"), rootType: undefined }] })).schemaVersion, version);
  for (const source of ["C:/secret.gameflow.json", "/absolute.gameflow.json", "https://remote.gameflow.json", "other.json", "bad\\path.gameflow.json"]) {
    const changed = structuredClone(valid); changed.pages[0].nodes[0].prefab!.source = source;
    assert.equal(validateGameFlowDocument(changed).ok, false, source);
    assert.equal(isWebviewToHostMessage({ type: "openCanvasSource", source }), false);
  }
  for (const patch of [{ style: { fill: "#000000" } }, { type: "button" }, { widget: {} }, { layout: { widthMode: "measured" } }, { layout: { paddingLeft: 8 } }]) {
    const changed = structuredClone(valid); Object.assign(changed.pages[0].nodes[0], patch);
    assert.equal(validateGameFlowDocument(changed).ok, false);
  }
  const child = node("bad-child", "root"); valid.pages[0].nodes.push(child);
  assert.equal(validateGameFlowDocument(valid).ok, false);
  assert.equal(isWebviewToHostMessage({ type: "chooseCanvasSource" }), true);
  assert.equal(isWebviewToHostMessage({ type: "openCanvasSource", source: "../module/ui.gameflow.json" }), true);
});

test("reference source snapshots cannot affect edit sessions or undo/save sequencing", () => {
  const original = fixture(), sent: WebviewToHostMessage[] = [];
  const session = new DocumentSession(message => sent.push(message), () => {});
  session.receive({ type: "init", document: original, documentVersion: 1, dirty: false, resourceName: "a.gameflow.json" });
  session.receive({ type: "canvasSources", sources: {}, error: "missing file", pickedSource: "b.gameflow.json" });
  assert.equal(session.state.document, original); assert.equal(session.state.dirty, false); assert.equal(sent.length, 0);
  session.edit(input => extractCanvasComponent(input, "main", "root", ids));
  assert.equal(sent.length, 1);
  const change = sent[0]; assert.equal(change.type, "replaceDocument");
  if (change.type !== "replaceDocument") throw new Error("missing transaction");
  session.receive({ type: "documentChanged", document: change.document, documentVersion: 2, dirty: true });
  session.command("undo");
  session.receive({ type: "documentChanged", document: original, documentVersion: 3, dirty: false });
  session.receive({ type: "commandCompleted", action: "undo" });
  assert.deepEqual(session.state.document, original);
  session.command("redo");
  session.receive({ type: "documentChanged", document: change.document, documentVersion: 4, dirty: true });
  session.receive({ type: "commandCompleted", action: "redo" });
  assert.equal(session.state.document!.pages.length, 2);
  session.command("save"); assert.deepEqual(sent.at(-1), { type: "save" });
});
