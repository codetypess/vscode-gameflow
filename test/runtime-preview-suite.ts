import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type GameFlowNode, type GameFlowPage } from "../shared/model";
import { isSliceResourcePath, isSliceResourceRef, readExportedSlice, resolveSliceResource, sliceResourcePath, sourceKey, type SliceResourceDescription, type SliceResourceRef, type SliceResourceState } from "../shared/slice-resources";
import { nineGridPatches } from "../shared/nine-grid";
import { previewControl } from "../shared/preview-session";
import { resolvePageLayout } from "../shared/ui-layout";
import { convertNodeType, editNodeFrame, setNodeAnchor, setNodeConstraint } from "../shared/ui-edit";
import { reparentNode } from "../shared/editor-ops";
import { copyNode } from "../shared/node-clipboard";
import { composeCanvasPage, editCanvasPage, revertCanvasProperties } from "../shared/canvas-instances";
import { extractCanvasComponent, makeCanvasInstance, type CanvasSources } from "../shared/canvas-references";
import { isWebviewToHostMessage } from "../shared/protocol";
import { NodeView } from "../webview/editor/node-view";
import { controlSelected } from "../shared/ui-parts";

type Test = { name: string; run(): void | Promise<void> };
export const runtimePreviewTests: Test[] = [];
const test = (name: string, run: Test["run"]) => runtimePreviewTests.push({ name, run });
const png = readFileSync("examples/star-sea-login/assets/status_dot.png");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const ref: SliceResourceRef = { path: "ui/login/img_bg.png", source: { documentId: "psd1", layerId: "layer1" } };
const description: SliceResourceDescription = { path: ref.path, width: 10, height: 10, nineGrid: null, source: { documentId: "psd1", psdName: "背景.psd", sourceHash: "a".repeat(64) }, layerId: "layer1", layerName: "背景", shared: false };
const image: GameFlowNode = { id: "image001", name: "背景", type: "image", frame: { x: 5, y: 6, width: 100, height: 50 }, sliceResource: ref };
const page = (...nodes: GameFlowNode[]): GameFlowPage => ({ id: "page0001", name: "预览", kind: "screen", frame: { x: 0, y: 0, width: 400, height: 400 }, nodes });
function exportedFixture() {
  const record = { name: "img_bg", file: "img_bg.png", source: description.source, layerId: description.layerId, layerName: description.layerName, shared: false, width: 10, height: 10, nineGrid: null, sha256: hash(png) };
  const files = new Map<string, Uint8Array>([[ref.path, png], ["ui/login/gameflow-resources.json", Buffer.from(JSON.stringify({ schema: "gameflow.resources", version: 1, resources: [record] }))]]);
  return { files, record, io: { read: async (path: string) => files.get(path) ?? null, hash: async (bytes: Uint8Array) => hash(bytes), encode: (bytes: Uint8Array) => Buffer.from(bytes).toString("base64") } };
}
test("slice references are portable namespaced PNG paths and reject traversal or absolute paths", () => {
  for (const value of ["img_bg.png", "中文/ui/img_bg.png", ref.path]) assert.equal(isSliceResourcePath(value), true, value);
  for (const value of ["/img_bg.png", "../img_bg.png", "ui/../img_bg.png", "ui//img_bg.png", "c:/img_bg.png", "ui\\img_bg.png", "ui/CON.png", "img_BG.png", "img_bg.jpg", "img_bg.png\n", "con.png", "img_bg.png/other.png"]) assert.equal(isSliceResourcePath(value), value === "img_bg.png/other.png", value);
  assert.equal(isSliceResourceRef(ref), true);
  assert.equal(isSliceResourceRef({ ...ref, source: { documentId: "", layerId: "a" } }), false);
  assert.equal(isSliceResourceRef({ ...ref, absoluteRoot: "c:/assets" }), false);
  assert.notEqual(sliceResourcePath("login", "img_bg"), sliceResourcePath("settings", "img_bg"));
});
test("slice binding survives serialization and rejects non-image nodes and malformed overrides", () => {
  const document = { ...createDefaultGameFlowDocument(), pages: [page(image)], interactions: [] };
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(document)).pages[0].nodes[0].sliceResource, ref);
  assert.equal(validateGameFlowDocument({ ...document, pages: [page({ ...image, type: "text" })] }).ok, false);
  assert.equal(validateGameFlowDocument({ ...document, pages: [page({ ...image, sliceResource: { path: "../bad.png" } })] }).ok, false);
  const converted = convertNodeType(page(image), image.id, "container");
  assert.equal(converted.nodes[0].sliceResource, undefined);
});
test("slice references inherit and override independently in scoped component instances", () => {
  const document = parseGameFlowDocument(readFileSync("sample/canvas-reference-demo.gameflow.json", "utf8"));
  const source = parseGameFlowDocument(readFileSync("sample/shared-components.gameflow.json", "utf8"));
  source.pages[0].nodes.push({ ...image, parentId: source.pages[0].componentRootId });
  const sources: CanvasSources = { "shared-components.gameflow.json": { source: "shared-components.gameflow.json", document: source } };
  const c = composeCanvasPage(document, document.pages[0], sources);
  const ids = [...c.info].filter(([, meta]) => meta.target.path.at(-1)?.nodeId === image.id);
  assert.equal(ids.length, 2);
  const replacement = { path: "ui/login/img_new.png" };
  const next = editCanvasPage(document, document.pages[0].id, sources, p => ({ ...p, nodes: p.nodes.map(n => n.id === ids[0][0] ? { ...n, sliceResource: replacement } : n) }));
  const saved = parseGameFlowDocument(serializeGameFlowDocument(next)), rendered = composeCanvasPage(saved, saved.pages[0], sources);
  assert.deepEqual(rendered.page.nodes.find(n => n.id === ids[0][0])!.sliceResource, replacement);
  assert.deepEqual(rendered.page.nodes.find(n => n.id === ids[1][0])!.sliceResource, ref);
  assert.deepEqual(source.pages[0].nodes.at(-1)!.sliceResource, ref);
  const restored = revertCanvasProperties(saved, ids[0][1].ownerId!, ids[0][1].target, ["sliceResource"]);
  assert.deepEqual(composeCanvasPage(restored, restored.pages[0], sources).page.nodes.find(n => n.id === ids[0][0])!.sliceResource, ref);
});
test("known renamed or disabled sources cannot silently resolve their old disk resource", () => {
  const ready: SliceResourceState<string> = { status: "ready", description, pixels: "old disk image" }, entries = new Map([[ref.path, ready]]);
  assert.equal(resolveSliceResource(ref, entries).status, "ready");
  const renamed = resolveSliceResource(ref, entries, new Map([[sourceKey(ref.source!), "ui/login/img_new.png"]]));
  assert.equal(renamed.status, "error"); if (renamed.status === "error") assert.match(renamed.error, /改名/);
  assert.equal(resolveSliceResource(ref, entries, new Map([[sourceKey(ref.source!), null]])).status, "error");
  assert.equal(resolveSliceResource({ path: ref.path }, entries).status, "ready");
});
test("bound images report missing resources and never render embedded old pixels", () => {
  const node = { ...image, imageData: `data:image/png;base64,${png.toString("base64")}` };
  const markup = renderToStaticMarkup(createElement(NodeView, { page: page(node), node }));
  assert.ok(markup.includes("切图异常")); assert.ok(!markup.includes("data:image/png"));
  const embedded = { ...node, sliceResource: undefined };
  const normal = renderToStaticMarkup(createElement(NodeView, { page: page(embedded), node: embedded }));
  assert.ok(normal.includes("object-fit:fill"));
});
test("resource natural size feeds measured image layout while fixed dimensions remain authored", () => {
  const measured = { ...image, layout: { widthMode: "measured" as const, heightMode: "measured" as const } };
  const sizes = new Map([[ref.path, { width: 17, height: 23 }]]);
  assert.deepEqual(resolvePageLayout(page(measured), sizes).nodes.get(image.id)!.local, { x: 5, y: 6, width: 17, height: 23 });
  assert.deepEqual(resolvePageLayout(page(image), sizes).nodes.get(image.id)!.local, image.frame);
});
test("moving a resource-sized image preserves measured modes and resizing fixes only the edited axis", () => {
  const measured = { ...image, layout: { widthMode: "measured" as const, heightMode: "measured" as const } };
  const sizes = new Map([[ref.path, { width: 17, height: 23 }]]), original = page(measured);
  const moved = editNodeFrame(original, image.id, { x: 15, y: 26, width: 17, height: 23 }, "move", sizes);
  assert.deepEqual(moved.nodes[0].layout, measured.layout);
  assert.deepEqual(resolvePageLayout(moved, sizes).nodes.get(image.id)!.local, { x: 15, y: 26, width: 17, height: 23 });
  const resized = editNodeFrame(moved, image.id, { x: 15, y: 26, width: 31, height: 23 }, "resize", sizes);
  assert.equal(resized.nodes[0].layout!.widthMode, "explicit");
  assert.equal(resized.nodes[0].layout!.heightMode, "measured");
  const updatedSizes = new Map([[ref.path, { width: 41, height: 43 }]]);
  assert.deepEqual(resolvePageLayout(resized, updatedSizes).nodes.get(image.id)!.local, { x: 15, y: 26, width: 31, height: 43 });
  assert.deepEqual(original.nodes[0], measured);
});
test("anchor constraint reparent and copy operations use resource dimensions to preserve visible geometry", () => {
  const measured = { ...image, layout: { widthMode: "measured" as const, heightMode: "measured" as const } };
  const parent: GameFlowNode = { id: "parent01", name: "容器", type: "container", frame: { x: 60, y: 70, width: 200, height: 200 } };
  const sizes = new Map([[ref.path, { width: 17, height: 23 }]]), original = page(measured, parent);
  const before = resolvePageLayout(original, sizes).nodes.get(image.id)!.absolute;
  const anchored = setNodeAnchor(original, image.id, { anchorX: .5, anchorY: .5 }, sizes);
  assert.deepEqual(resolvePageLayout(anchored, sizes).nodes.get(image.id)!.absolute, before);
  const constrained = setNodeConstraint(anchored, image.id, "right", true, sizes);
  assert.deepEqual(resolvePageLayout(constrained, sizes).nodes.get(image.id)!.absolute, before);
  const reparented = reparentNode(constrained, image.id, parent.id, sizes);
  assert.deepEqual(resolvePageLayout(reparented, sizes).nodes.get(image.id)!.absolute, before);
  assert.deepEqual(copyNode(original, image.id, sizes)!.nodes[0].frame, { x: 5, y: 6, width: 17, height: 23 });
});
test("extracting and referencing a measured component retains its resource-sized bounds", () => {
  const root: GameFlowNode = { id: "parent01", name: "容器", type: "container", frame: { x: 60, y: 70, width: 200, height: 200 }, layout: { widthMode: "measured", heightMode: "measured" } };
  const measured = { ...image, parentId: root.id, frame: { ...image.frame, x: 0, y: 0 }, layout: { widthMode: "measured" as const, heightMode: "measured" as const } };
  const sizes = new Map([[ref.path, { width: 17, height: 23 }]]), original = page(root, measured);
  const document = { ...createDefaultGameFlowDocument(), pages: [original], interactions: [] };
  let serial = 0;
  const extracted = extractCanvasComponent(document, original.id, root.id, () => `new${++serial}`, sizes);
  assert.deepEqual(extracted.pages[1].frame, { x: 480, y: 0, width: 17, height: 23 });
  const instance = makeCanvasInstance(document, { ...original, componentRootId: root.id }, "", "instance", sizes);
  assert.deepEqual(instance.frame, { x: 24, y: 24, width: 17, height: 23 });
});
test("nine-grid axes retain leading borders without enlarging tiny target dimensions", () => {
  const grid = { left: 2, right: 2, top: 2, bottom: 2, repeat: false };
  const tiny = nineGridPatches(6, 6, 1, 1, grid);
  assert.deepEqual(tiny, [{ sx: 0, sy: 0, sw: 2, sh: 2, x: 0, y: 0, width: 1, height: 1, repeatX: false, repeatY: false }]);
  const patches = nineGridPatches(6, 6, 9, 7, { ...grid, repeat: true });
  assert.deepEqual(patches[4], { sx: 2, sy: 2, sw: 2, sh: 2, x: 2, y: 2, width: 5, height: 3, repeatX: true, repeatY: true });
  assert.equal(Math.max(...patches.map(p => p.x + p.width)), 9);
  assert.equal(Math.max(...patches.map(p => p.y + p.height)), 7);
});
test("preview checkbox radio and slider states leave design initial values unchanged", () => {
  const checkbox: GameFlowNode = { ...image, id: "check001", type: "checkbox", sliceResource: undefined, widget: { selected: false } };
  const slider: GameFlowNode = { ...image, id: "slider01", type: "slider", sliceResource: undefined, widget: { min: 10, max: 20, value: 12 } };
  const radio = { ...checkbox, id: "radio001", type: "radio" as const }, radio2 = { ...radio, id: "radio002" };
  const group: GameFlowNode = { ...checkbox, id: "group001", type: "radioGroup", widget: { optionNodeIds: [radio.id, radio2.id], selectedIndex: 0 } };
  const authored = page(checkbox, slider, radio, radio2, group), before = JSON.stringify(authored);
  let session = previewControl(authored, checkbox.id); session = previewControl(session, slider.id, 100); session = previewControl(session, radio2.id);
  assert.equal(session.nodes[0].widget!.selected, true); assert.equal(session.nodes[1].widget!.value, 20);
  assert.equal(controlSelected(session, session.nodes[2]), false); assert.equal(controlSelected(session, session.nodes[3]), true);
  assert.equal(JSON.stringify(authored), before);
  assert.equal(previewControl(page({ ...checkbox, widget: { disabled: true } }), checkbox.id).nodes[0].widget!.selected, undefined);
});
test("disk preview verifies provenance PNG bytes dimensions and returns real texture data", async () => {
  const f = exportedFixture(), result = await readExportedSlice(ref.path, f.io);
  assert.equal(result.error, undefined); assert.deepEqual(result.description, description);
  assert.deepEqual(Buffer.from(result.base64!, "base64"), png);
});
test("missing or tampered disk resources produce per-resource errors", async () => {
  const f = exportedFixture(); f.files.delete(ref.path);
  assert.equal((await readExportedSlice(ref.path, f.io)).exists, false);
  const altered = Buffer.from(png); altered[30] ^= 255; f.files.set(ref.path, altered);
  const changed = await readExportedSlice(ref.path, f.io); assert.equal(changed.exists, true); assert.match(changed.error!, /hash/);
  f.files.set(ref.path, png); f.files.delete("ui/login/gameflow-resources.json");
  assert.match((await readExportedSlice(ref.path, f.io)).error!, /来源清单/);
});
test("matching hash cannot disguise invalid PNG dimensions or unsafe resource paths", async () => {
  const f = exportedFixture(), invalid = Buffer.from(png); invalid.writeUInt32BE(11, 16); f.files.set(ref.path, invalid);
  f.record.sha256 = hash(invalid); f.files.set("ui/login/gameflow-resources.json", Buffer.from(JSON.stringify({ schema: "gameflow.resources", version: 1, resources: [f.record] })));
  assert.match((await readExportedSlice(ref.path, f.io)).error!, /尺寸/);
  let reads = 0;
  await readExportedSlice("../secret.png", { ...f.io, read: async () => { reads++; return png; } });
  assert.equal(reads, 0);
});
test("resource protocol rejects traversal duplicate paths and unbounded batches", () => {
  const request = { type: "sliceResources", requestId: "resources-1", paths: [ref.path] };
  assert.equal(isWebviewToHostMessage(request), true);
  for (const paths of [["../bad.png"], [ref.path, ref.path], Array.from({ length: 129 }, (_, i) => `img_${i}.png`)]) assert.equal(isWebviewToHostMessage({ ...request, paths }), false);
});
