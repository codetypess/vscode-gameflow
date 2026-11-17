import assert from "node:assert/strict";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type GameFlowDocument } from "../shared/model";
import { isWebviewToHostMessage } from "../shared/protocol";
import { PAGE_ROOT_TYPES } from "../shared/ui-components";
import { duplicatePage } from "../shared/editor-ops";
import { editCanvasPage } from "../shared/canvas-instances";

export const pageExportNameTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => pageExportNameTests.push({ name, run });
const fixture = (): GameFlowDocument => ({ ...createDefaultGameFlowDocument(), interactions: [], pages: [{
  id: "page0001", name: "主菜单", kind: "screen", frame: { x: 0, y: 0, width: 750, height: 1334 }, nodes: []
}] });

test("page export names roundtrip independently for every root type and supported format", () => {
  for (const schemaVersion of [2, 3, 4, 5] as const) for (const rootType of PAGE_ROOT_TYPES) {
    const document = fixture();
    document.schemaVersion = schemaVersion;
    document.pages[0].rootType = rootType;
    document.pages[0].exportName = "MainMenu";
    const saved = parseGameFlowDocument(serializeGameFlowDocument(document));
    assert.deepEqual(saved, document);
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: saved }), true);
    saved.pages[0].name = "改名后的页面";
    assert.equal(saved.pages[0].exportName, "MainMenu");
    let serial = 0;
    const copy = duplicatePage(saved.pages[0], () => `copy000${++serial}`);
    assert.equal(copy.exportName, "MainMenu");
    assert.notEqual(copy.id, saved.pages[0].id);
  }
});

test("legacy pages stay unset and invalid or v1 export names fail document and message boundaries", () => {
  const legacy = fixture(); legacy.schemaVersion = 1;
  const parsed = parseGameFlowDocument(serializeGameFlowDocument(legacy));
  assert.deepEqual(parsed, legacy);
  assert.equal(Object.hasOwn(parsed.pages[0], "exportName"), false);
  for (const value of [null, 42, false, [], {}, "", " \t "]) {
    const document = fixture();
    (document.pages[0] as unknown as Record<string, unknown>).exportName = value;
    const result = validateGameFlowDocument(document);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.startsWith("pages[0].exportName")));
    assert.throws(() => parseGameFlowDocument(JSON.stringify(document)));
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document }), false);
  }
  legacy.pages[0].exportName = "MainMenu";
  assert.throws(() => parseGameFlowDocument(JSON.stringify(legacy)), /exportName requires schemaVersion 2/);
  assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: legacy }), false);
});

test("canvas page edits set and clear export metadata without changing page identity or geometry", () => {
  const original = fixture(), page = original.pages[0];
  const named = editCanvasPage(original, page.id, {}, item => ({ ...item, exportName: "MainMenu" }));
  assert.deepEqual(named.pages[0], { ...page, exportName: "MainMenu" });
  assert.deepEqual(original, fixture());
  const renamed = editCanvasPage(named, page.id, {}, item => ({ ...item, name: "设置界面", rootType: "UITop" }));
  assert.equal(renamed.pages[0].exportName, "MainMenu");
  const cleared = editCanvasPage(renamed, page.id, {}, item => ({ ...item, exportName: undefined }));
  const reloaded = parseGameFlowDocument(serializeGameFlowDocument(cleared));
  assert.equal(Object.hasOwn(reloaded.pages[0], "exportName"), false);
  assert.equal(named.pages[0].exportName, "MainMenu");
  assert.equal(reloaded.pages[0].id, page.id);
  assert.deepEqual(reloaded.pages[0].frame, page.frame);
});
