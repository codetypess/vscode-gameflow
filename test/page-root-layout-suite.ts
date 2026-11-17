import { GAMEFLOW_SCHEMA_VERSION } from "../shared/model";
import assert from "node:assert/strict";
import type { ConstraintLayout, GameFlowDocument } from "../shared/model";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument } from "../shared/model";
import { duplicatePage } from "../shared/editor-ops";
import { resolvePageLayout } from "../shared/ui-layout";
import { PAGE_ROOT_TYPES } from "../shared/ui-components";
import { isWebviewToHostMessage, type WebviewToHostMessage } from "../shared/protocol";
import { DocumentSession } from "../webview/document-session";

export const pageRootLayoutTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => pageRootLayoutTests.push({ name, run });
const fixture = (): GameFlowDocument => ({ ...createDefaultGameFlowDocument(), interactions: [], pages: [{
  id: "page0001", name: "主菜单", kind: "screen", frame: { x: -628, y: -463, width: 750, height: 1334 },
  nodes: [{ id: "node0001", name: "内容", type: "container", frame: { x: 20, y: 30, width: 200, height: 100 }, layout: { left: 20, right: 10, top: 30 } },
    { id: "node0002", name: "标题", type: "text", parentId: "node0001", frame: { x: 10, y: 10, width: 100, height: 30 }, layout: { right: 10 } }]
}] });

test("all page roots roundtrip independent constraints including null, zero, fractional and percent values", () => {
  const source = fixture();
  for (const rootType of PAGE_ROOT_TYPES) for (const layout of [
    {}, { left: 0, right: 20, centerX: null, top: -10, bottom: 0, centerY: 5.25 },
    { left: 10, right: null, centerY: 0, layoutUnit: "percent" }
  ] as ConstraintLayout[]) {
    source.pages[0].rootType = rootType; source.pages[0].layout = layout;
    assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(source)), source);
    assert.ok(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: source }));
  }
});

test("root layout rejects node-only fields, malformed objects and nonfinite constraints at all document boundaries", () => {
  for (const layout of [null, [], false, 5, "left", { left: "0" }, { right: Infinity }, { centerX: NaN },
    { layoutUnit: "constructor" }, { layoutUnit: [] }, { layoutUnit: null }, { unknown: 1 }, { paddingLeft: 10 },
    { widthMode: "measured" }, { crossAxisMode: "explicit" }, { positionOffsetX: 10 }, { widget: {} }]) {
    const source = fixture();
    (source.pages[0] as unknown as Record<string, unknown>).layout = layout;
    const result = validateGameFlowDocument(source);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.some(error => error.startsWith("pages[0].layout")));
    assert.throws(() => serializeGameFlowDocument(source));
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: source }), false);
    // JSON cannot represent nonfinite numbers; cover parser rejection with finite invalid payloads.
    const nonfinite = layout && typeof layout === "object" && Object.values(layout).some(value => typeof value === "number" && !Number.isFinite(value));
    if (!nonfinite) assert.throws(() => parseGameFlowDocument(JSON.stringify(source)));
  }
});

test("legacy pages retain absent root constraints and v1 refuses even empty root layout", () => {
  const source = fixture();
  for (const node of source.pages[0].nodes) delete node.layout;
  for (const schemaVersion of [1, 2] as const) {
    source.schemaVersion = schemaVersion;
    const parsed = parseGameFlowDocument(serializeGameFlowDocument(source));
    assert.deepEqual(parsed, source); assert.equal(Object.hasOwn(parsed.pages[0], "layout"), false);
  }
  source.schemaVersion = 1;
  for (const layout of [{}, { left: 0 }]) {
    source.pages[0].layout = layout;
    assert.equal(validateGameFlowDocument(source).ok, false);
    assert.throws(() => parseGameFlowDocument(JSON.stringify(source)), /layout requires schemaVersion 2/);
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: source }), false);
  }
});

test("root constraints preserve canvas placement, design dimensions and all descendant geometry", () => {
  const page = fixture().pages[0], original = structuredClone(page), geometry = resolvePageLayout(page);
  for (const layout of [{ left: 100, right: 200, centerX: -35, top: 20, bottom: 50, centerY: 15 },
    { left: 10, top: 5, right: null, centerY: 0, layoutUnit: "percent" }] as ConstraintLayout[]) {
    const configured = { ...page, layout };
    assert.deepEqual(configured.frame, original.frame);
    assert.deepEqual(resolvePageLayout(configured), geometry);
    assert.deepEqual(configured.nodes, original.nodes);
  }
  assert.deepEqual(page, original);
});

test("page copies preserve root constraints without sharing them and keep the source identities intact", () => {
  const page = fixture().pages[0]; page.rootType = "UIBox"; page.layout = { left: 0, right: 10, centerY: null, layoutUnit: "percent" };
  const original = structuredClone(page); let serial = 0;
  const copy = duplicatePage(page, () => `copy${String(++serial).padStart(4, "0")}`);
  assert.deepEqual(copy.layout, page.layout); assert.notEqual(copy.layout, page.layout);
  assert.equal(copy.rootType, page.rootType); assert.notEqual(copy.id, page.id);
  assert.ok(copy.nodes.every(node => !page.nodes.some(source => source.id === node.id)));
  assert.equal(copy.nodes[1].parentId, copy.nodes[0].id);
  copy.layout!.left = 50;
  assert.deepEqual(page, original);
});

test("root constraint edits upgrade v1 atomically and survive save, undo and redo with stable geometry", () => {
  const original = fixture(); original.schemaVersion = 1;
  for (const node of original.pages[0].nodes) delete node.layout;
  const messages: WebviewToHostMessage[] = [];
  const session = new DocumentSession(message => messages.push(message), () => {});
  session.receive({ type: "init", document: original, documentVersion: 1, resourceName: "test", dirty: false });
  session.edit(document => ({ ...document, pages: document.pages.map(page => ({ ...page, layout: { left: 0, centerY: 0 } })) }));
  const changed = session.state.document!;
  assert.equal(changed.schemaVersion, GAMEFLOW_SCHEMA_VERSION);
  assert.deepEqual(changed.pages[0].frame, original.pages[0].frame);
  assert.deepEqual(changed.pages[0].nodes, original.pages[0].nodes);
  assert.equal(changed.pages[0].id, original.pages[0].id);
  assert.equal(messages.length, 1); assert.ok(isWebviewToHostMessage(messages[0]));
  session.receive({ type: "documentChanged", document: changed, documentVersion: 2, dirty: true });
  session.command("save");
  assert.equal(messages.at(-1)?.type, "save");
  session.receive({ type: "commandCompleted", action: "save" });
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(changed)), changed);
  session.command("undo");
  session.receive({ type: "documentChanged", document: original, documentVersion: 3, dirty: false });
  session.receive({ type: "commandCompleted", action: "undo" });
  assert.deepEqual(session.state.document, original);
  session.command("redo");
  session.receive({ type: "documentChanged", document: changed, documentVersion: 4, dirty: true });
  session.receive({ type: "commandCompleted", action: "redo" });
  assert.deepEqual(session.state.document, changed);
});
