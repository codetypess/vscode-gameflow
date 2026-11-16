import assert from "node:assert/strict";
import { createDefaultGameFlowDocument, type GameFlowPage } from "../shared/model";
import type { WebviewToHostMessage } from "../shared/protocol";
import { DocumentSession } from "../webview/document-session";
import { applyColorPreview, ColorEditSession, type ColorPreview } from "../webview/lib/color-edit";

export const colorEditTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => colorEditTests.push({ name, run });
const page = (): GameFlowPage => ({ id: "page", name: "Color", kind: "screen", frame: { x: 0, y: 0, width: 300, height: 200 }, nodes: [
  { id: "node", name: "Control", type: "container", frame: { x: 10, y: 20, width: 100, height: 50 }, style: { fill: "transparent", borderColor: "#123456", opacity: 0.5 } }
] });

test("continuous color previews create exactly one document edit and one undo/redo step", () => {
  const original = { ...createDefaultGameFlowDocument(), pages: [page()], interactions: [] };
  const sent: WebviewToHostMessage[] = [];
  const session = new DocumentSession(message => sent.push(message), () => {});
  session.receive({ type: "init", document: original, documentVersion: 1, resourceName: "colors", dirty: false });
  const color = new ColorEditSession();
  let preview: ColorPreview;
  color.begin("transparent");
  for (const value of ["#ff0000", "#aaff00", "#aabbcc", "#123abc"]) {
    color.update(value, "transparent");
    preview = { pageId: "page", nodeId: "node", property: "fill", value };
    assert.equal(applyColorPreview(session.state.document!.pages[0], preview).nodes[0].style!.fill, value);
    assert.equal(session.state.document!.pages[0].nodes[0].style!.fill, "transparent");
    assert.equal(sent.length, 0, "intermediate colors must never enter the host history");
  }
  const final = color.finish()!;
  session.edit(document => ({ ...document, pages: document.pages.map(p => applyColorPreview(p, { ...preview!, value: final })) }));
  assert.equal(sent.length, 1);
  const message = sent[0]; assert.equal(message.type, "replaceDocument");
  if (message.type !== "replaceDocument") throw new Error("expected final color edit");
  session.receive({ type: "documentChanged", document: message.document, documentVersion: 2, dirty: true });
  assert.equal(color.finish(), null, "native change followed by blur must not commit twice");
  session.command("undo"); assert.deepEqual(sent[1], { type: "history", action: "undo" });
  session.receive({ type: "documentChanged", document: original, documentVersion: 3, dirty: false });
  session.receive({ type: "commandCompleted", action: "undo" });
  assert.equal(session.state.document!.pages[0].nodes[0].style!.fill, "transparent");
  session.command("redo"); assert.deepEqual(sent[2], { type: "history", action: "redo" });
  session.receive({ type: "documentChanged", document: message.document, documentVersion: 4, dirty: true });
  session.receive({ type: "commandCompleted", action: "redo" });
  assert.equal(session.state.document!.pages[0].nodes[0].style!.fill, "#123abc");
});

test("unchanged and returned-to-original picker sessions create no action", () => {
  const edit = new ColorEditSession();
  edit.begin("transparent"); assert.equal(edit.finish(), null);
  edit.begin("#AaBbCc"); edit.update("#ff0000", "#AaBbCc"); edit.update("#aabbcc", "#AaBbCc");
  assert.equal(edit.finish(), null);
  assert.equal(edit.finish(), null);
});

test("reopening the picker starts a separate action and repeated begin preserves its original color", () => {
  const edit = new ColorEditSession();
  edit.begin("#112233"); edit.update("#ff0000", "#112233");
  edit.begin("#ff0000"); edit.update("#112233", "#ff0000");
  assert.equal(edit.finish(), null, "a repeated opening event must not reset the initial checkpoint");
  edit.update("#123456", "#112233"); assert.equal(edit.finish(), "#123456");
  edit.update("#654321", "#123456"); assert.equal(edit.finish(), "#654321");
});

test("cancelling stale color drafts prevents a later close from overwriting external changes", () => {
  const edit = new ColorEditSession();
  edit.update("#ff0000", "transparent"); edit.cancel();
  assert.equal(edit.finish(), null); assert.equal(edit.active, false);
  edit.update("#00ff00", "#334455"); assert.equal(edit.finish(), "#00ff00");
  edit.update("#abcdef", "#334455");
  assert.equal(edit.finish("#778899"), null, "an external update before effect cleanup must also discard the stale draft");
});

test("color previews change only their intended property without mutating authoritative data", () => {
  const p = page();
  for (const property of ["fill", "borderColor", "color"] as const) {
    const preview = applyColorPreview(p, { pageId: "page", nodeId: "node", property, value: "#abcdef" });
    assert.equal(preview.nodes[0].style![property], "#abcdef");
    assert.equal(preview.nodes[0].style!.opacity, 0.5);
    assert.deepEqual(preview.nodes[0].frame, p.nodes[0].frame);
    assert.deepEqual(p, page());
    assert.equal(applyColorPreview(p, null), p);
  }
  const background = applyColorPreview(p, { pageId: "page", property: "background", value: "#abcdef" });
  assert.equal(background.background, "#abcdef"); assert.equal(background.nodes, p.nodes);
  assert.equal(p.background, undefined);
});

test("color previews ignore other pages, missing nodes and inherited locks", () => {
  const p = page(), preview: ColorPreview = { pageId: "page", nodeId: "node", property: "fill", value: "#abcdef" };
  assert.equal(applyColorPreview(p, { ...preview, pageId: "other" }), p);
  assert.equal(applyColorPreview(p, { ...preview, nodeId: "missing" }), p);
  const locked = { ...p, nodes: [{ ...p.nodes[0], locked: true }] };
  assert.equal(applyColorPreview(locked, preview), locked);
  const child = { ...p.nodes[0], id: "child", parentId: "node" };
  const nested = { ...locked, nodes: [...locked.nodes, child] };
  assert.equal(applyColorPreview(nested, { ...preview, nodeId: "child" }), nested);
});
