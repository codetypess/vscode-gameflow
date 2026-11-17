import { GAMEFLOW_SCHEMA_VERSION } from "../shared/model";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createControlParts, duplicateNode, duplicatePage, inheritedFlag, makeComponent, removeNode, reparentNode } from "../shared/editor-ops";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type GameFlowNode, type GameFlowPage } from "../shared/model";
import { copyNode, pasteNode } from "../shared/node-clipboard";
import { migrateDocumentElementIds } from "../shared/document-id-migration";
import { convertNodeType, editNodeFrame, setNodeAnchor, setNodeConstraint } from "../shared/ui-edit";
import { resolvePageLayout } from "../shared/ui-layout";
import { controlSelected, setControlSelection, setRadioOptions } from "../shared/ui-parts";
import { NodeView } from "../webview/editor/node-view";
import { DocumentSession } from "../webview/document-session";
import type { WebviewToHostMessage } from "../shared/protocol";

export const uiPartsTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => uiPartsTests.push({ name, run });
let sequence = 0;
const id = () => `part${++sequence}`;
const page = (...nodes: GameFlowNode[]): GameFlowPage => ({ id: "page", name: "Parts", kind: "screen", frame: { x: 0, y: 0, width: 400, height: 700 }, nodes });
const doc = (p: GameFlowPage) => ({ ...createDefaultGameFlowDocument(), pages: [p], interactions: [] });
const assertValid = (p: GameFlowPage) => { const result = validateGameFlowDocument(doc(p)); assert.ok(result.ok, result.ok ? "" : result.errors.join("\n")); };
const draw = (p: GameFlowPage, node: GameFlowNode) => renderToStaticMarkup(createElement(NodeView, { page: p, node }));
const control = (type: "slider" | "checkbox" | "radio" | "radioGroup") => page(...makeComponent(type, "root", 100, 100, id));

test("buttons need no label and deleting explicit text never renders the control name", () => {
  const nodes = makeComponent("button", "button", 0, 0, id);
  assert.equal(nodes.length, 1); assert.equal(nodes[0].text, undefined);
  let p = page(...nodes); assertValid(p); assert.ok(!draw(p, nodes[0]).includes("node-content"));
  const label: GameFlowNode = { id: id(), name: "Label", type: "text", text: "确认", parentId: "button", frame: { x: 0, y: 0, width: 50, height: 20 } };
  p = page(...nodes, label); assertValid(p); assert.ok(draw(p, label).includes("确认"));
  p = removeNode(p, label.id); assertValid(p); assert.ok(!draw(p, nodes[0]).includes("node-content"));
  assert.ok(draw(p, { ...nodes[0], text: "历史文案" }).includes("历史文案"));
});

test("control templates contain real parts, skin references and independent optional labels", () => {
  for (const type of ["slider", "checkbox", "radio"] as const) {
    const p = control(type), root = p.nodes[0];
    assertValid(p); assert.equal(p.nodes.length, 4); assert.equal(root.text, undefined);
    assert.equal(p.nodes.find(n => n.id === root.widget!.skinNodeId)!.parentId, root.id);
    assert.ok(!draw(p, root).includes("widget-choice")); assert.ok(!draw(p, root).includes("widget-slider"));
    const label = p.nodes.find(n => n.type === "text")!;
    assertValid(removeNode(p, label.id));
  }
});

test("control codec rejects dangling, indirect and wrong-type references and v2 control fields", () => {
  const p = control("slider"), root = p.nodes[0], skin = p.nodes[2];
  const invalid = (nodes: GameFlowNode[]) => assert.equal(validateGameFlowDocument(doc(page(...nodes))).ok, false);
  invalid([{ ...root, widget: { skinNodeId: "missing" } }, ...p.nodes.slice(1)]);
  invalid(p.nodes.map(n => n.id === skin.id ? { ...n, parentId: p.nodes[1].id } : n));
  invalid(p.nodes.map(n => n.id === skin.id ? { ...n, layout: { left: 0 } } : n));
  invalid(p.nodes.map(n => n.id === root.id ? { ...n, type: "button" } : n));
  invalid(p.nodes.map(n => n.id === root.id ? { ...n, widget: { ...n.widget, optionNodeIds: [] } } : n));
  assert.equal(validateGameFlowDocument({ ...doc(p), schemaVersion: 2 }).ok, false);
  assert.equal(validateGameFlowDocument({ ...doc(control("radioGroup")), schemaVersion: 2 }).ok, false);
  assert.equal(parseGameFlowDocument(serializeGameFlowDocument(doc(p))).pages[0].nodes[0].widget!.skinNodeId, skin.id);
});

test("skin references survive subtree/page copying, paste and document identity migration", () => {
  const p = control("slider"), sourceSkin = p.nodes[0].widget!.skinNodeId;
  for (const copy of [duplicateNode(p, "root", id), pasteNode(p, copyNode(p, "root")!, id)]) {
    assertValid(copy.page);
    const root = copy.page.nodes.find(n => n.id === copy.id)!;
    assert.notEqual(root.widget!.skinNodeId, sourceSkin);
    assert.equal(copy.page.nodes.find(n => n.id === root.widget!.skinNodeId)!.parentId, root.id);
  }
  const copied = duplicatePage(p, id); assertValid(copied);
  const migrated = migrateDocumentElementIds({ ...doc(p), elementIdScheme: undefined });
  assert.equal(validateGameFlowDocument(migrated).ok, true);
  assert.equal(migrated.pages[0].nodes[0].widget!.skinNodeId, migrated.pages[0].nodes[2].id);
});

test("deleting and reparenting a skin detaches its reference atomically and respects owner locks", () => {
  const p = control("checkbox"), skinId = p.nodes[0].widget!.skinNodeId!;
  for (const changed of [removeNode(p, skinId), reparentNode(p, skinId)]) {
    assertValid(changed); assert.equal(changed.nodes[0].widget!.skinNodeId, null);
  }
  assert.equal(p.nodes[0].widget!.skinNodeId, skinId);
  const locked = { ...p, nodes: p.nodes.map((n, i) => i === 0 ? { ...n, locked: true } : n) };
  assert.equal(removeNode(locked, skinId), locked);
  const converted = convertNodeType(p, "root", "slider");
  assertValid(converted); assert.equal(converted.nodes[0].widget!.skinNodeId, null);
  const plain = convertNodeType(p, "root", "container"); assertValid(plain); assert.equal(plain.nodes[0].widget?.skinNodeId, undefined);
});

test("check and radio skins derive visibility without hiding siblings or altering stored flags", () => {
  for (const type of ["checkbox", "radio"] as const) {
    const p = control(type), skin = p.nodes[2];
    assert.equal(inheritedFlag(p, skin, "hidden"), true);
    assert.equal(inheritedFlag(p, p.nodes[1], "hidden"), false);
    const selected = setControlSelection(p, "root", true);
    assert.equal(inheritedFlag(selected, skin, "hidden"), false);
    assert.equal(skin.hidden, undefined); assert.equal(p.nodes[0].widget!.selected, undefined);
    const disabled = { ...selected, nodes: selected.nodes.map(n => n.id === "root" ? { ...n, widget: { ...n.widget, disabled: true } } : n) };
    assert.ok(!draw(disabled, skin).includes("opacity:0.45"));
  }
});

test("slider derives transformed thumb travel in both directions and keeps authored frames", () => {
  const p = control("slider"), skin = p.nodes[2];
  p.nodes[0].frame = { x: 0, y: 0, width: 200, height: 100 };
  skin.frame = { x: 999, y: -999, width: 40, height: 20 };
  skin.transform = { anchorX: .5, anchorY: .5, rotation: 90, scaleX: 2 };
  const snapshot = structuredClone(skin);
  for (const direction of ["horizontal", "vertical"] as const) for (const value of [0, 50, 100]) {
    p.nodes[0].widget = { ...p.nodes[0].widget, direction, value };
    const result = resolvePageLayout(p); assert.deepEqual(result.issues, []);
    const bounds = result.nodes.get(skin.id)!.absolute;
    assert.ok(Math.abs(bounds.width - 20) < 1e-8); assert.ok(Math.abs(bounds.height - 80) < 1e-8);
    assert.ok(Math.abs(bounds.x - (direction === "horizontal" ? 180 * value / 100 : 90)) < 1e-8);
    assert.ok(Math.abs(bounds.y - (direction === "vertical" ? 20 * value / 100 : 10)) < 1e-8);
  }
  assert.deepEqual(skin, snapshot);
  p.nodes[0].frame.height = 10;
  assert.ok(Math.abs(resolvePageLayout(p).nodes.get(skin.id)!.absolute.y) < 1e-8);
});

test("slider measured bounds ignore thumb movement and prevent direct position/constraint edits", () => {
  const p = control("slider"); p.nodes = [p.nodes[0], p.nodes[2]];
  p.nodes[0].layout = { widthMode: "measured", heightMode: "measured" };
  const skin = p.nodes[1]; skin.frame.x = 900; skin.frame.y = 800;
  const g = resolvePageLayout(p); assert.deepEqual(g.issues, []);
  assert.equal(g.nodes.get("root")!.local.width, 24); assert.equal(g.nodes.get("root")!.local.height, 24);
  assert.equal(setNodeConstraint(p, skin.id, "centerX", true), p);
  assert.equal(editNodeFrame(p, skin.id, { ...skin.frame, x: 1 }, "move"), p);
  const resized = editNodeFrame(p, skin.id, { ...skin.frame, width: 50, height: 40 });
  assert.equal(resized.nodes[1].frame.width, 50); assert.equal(resized.nodes[1].frame.x, 900);
  const anchored = setNodeAnchor(resized, skin.id, { anchorX: .5 });
  assert.equal(anchored.nodes[1].layout?.positionOffsetX, undefined); assertValid(anchored);
});

test("radio group membership is independent of display tree and selection follows options ordering", () => {
  let p = control("radioGroup"); const group = p.nodes[0], [a, b] = group.widget!.optionNodeIds! as string[];
  assertValid(p); p = setControlSelection(p, a, true);
  assert.equal(controlSelected(p, p.nodes.find(n => n.id === a)!), true);
  assert.equal(controlSelected(p, p.nodes.find(n => n.id === b)!), false);
  p = setControlSelection(p, b, true); assert.equal(p.nodes[0].widget!.selectedIndex, 1);
  p = setRadioOptions(p, group.id, [b, null, a]); assert.equal(p.nodes[0].widget!.selectedIndex, 0);
  p = reparentNode(p, b); assert.equal(p.nodes[0].widget!.optionNodeIds![0], b); assertValid(p);
  const detached = setRadioOptions(p, group.id, [null, null, a]);
  assert.equal(detached.nodes.find(n => n.id === b)!.widget!.selected, true);
  assert.equal(detached.nodes[0].widget!.selectedIndex, -1);
  p = removeNode(p, b); assert.deepEqual(p.nodes[0].widget!.optionNodeIds, [null, null, a]); assert.equal(p.nodes[0].widget!.selectedIndex, -1); assertValid(p);
});

test("radio groups reject duplicate/cross-group/empty selections and copies never capture external members", () => {
  const p = control("radioGroup"), options = p.nodes[0].widget!.optionNodeIds!;
  assert.equal(setRadioOptions(p, "root", [options[0], options[0]]), p);
  const other: GameFlowNode = { ...p.nodes[0], id: "other", widget: { optionNodeIds: [options[0]], selectedIndex: -1 } };
  assert.equal(validateGameFlowDocument(doc(page(...p.nodes, other))).ok, false);
  assert.equal(validateGameFlowDocument(doc(page({ ...p.nodes[0], widget: { optionNodeIds: [null], selectedIndex: 0 } }, ...p.nodes.slice(1)))).ok, false);
  let selected = setControlSelection(p, options[0]!, true);
  selected = reparentNode(selected, options[0]!);
  const copy = duplicateNode(selected, "root", id); assertValid(copy.page);
  const copied = copy.page.nodes.find(n => n.id === copy.id)!;
  assert.equal(copied.widget!.optionNodeIds![0], null); assert.equal(copied.widget!.selectedIndex, -1);
  const radioCopy = duplicateNode(selected, options[0]!, id); assertValid(radioCopy.page);
  assert.equal(radioCopy.page.nodes.find(n => n.id === radioCopy.id)!.widget!.selected, true);
});

test("legacy controls gain parts only explicitly and v2 edits upgrade in the undoable document transaction", () => {
  const old: GameFlowNode = { id: "old", name: "协议", type: "checkbox", text: "我同意", frame: { x: 30, y: 40, width: 200, height: 32 }, widget: { selected: true } };
  const p = page(old), source = { ...doc(p), schemaVersion: 2 as const };
  assert.equal(parseGameFlowDocument(serializeGameFlowDocument(source)).schemaVersion, 2);
  const changed = createControlParts(p, "old", id);
  assert.equal(changed.nodes[0].id, "old"); assert.deepEqual(changed.nodes[0].frame, old.frame);
  assert.equal(changed.nodes[0].text, undefined); assert.equal(changed.nodes[3].text, "我同意");
  assert.equal(changed.nodes[0].widget!.selected, true); assertValid(changed);
  const sent: WebviewToHostMessage[] = [], session = new DocumentSession(message => sent.push(message), () => {});
  session.receive({ type: "init", document: source, resourceName: "test", dirty: false, documentVersion: 1 });
  session.edit(d => ({ ...d, pages: [changed] }));
  assert.equal(session.state.document!.schemaVersion, GAMEFLOW_SCHEMA_VERSION);
  assert.ok(sent.some(message => message.type === "replaceDocument"));
});

test("type conversion initializes an empty radio group and releases selected members when removing the group behavior", () => {
  const combo = page(...makeComponent("combo", "combo", 0, 0, id));
  const converted = convertNodeType(combo, "combo", "radioGroup");
  assertValid(converted); assert.deepEqual(converted.nodes[0].widget!.optionNodeIds, []); assert.equal(converted.nodes[0].widget!.selectedIndex, -1);
  let p = control("radioGroup"); const member = p.nodes[0].widget!.optionNodeIds![0]!;
  p = setControlSelection(p, member, true);
  const plain = convertNodeType(p, "root", "container");
  assertValid(plain); assert.equal(plain.nodes.find(node => node.id === member)!.widget!.selected, true);
});

test("skin visibility ownership preserves stored flags and propagates through a composite skin", () => {
  let p = control("checkbox"); const skinId = p.nodes[0].widget!.skinNodeId!;
  p = { ...p, nodes: p.nodes.map(node => node.id === skinId ? { ...node, type: "container", hidden: true } : node) };
  const child: GameFlowNode = { id: id(), name: "图标", type: "image", parentId: skinId, frame: { x: 0, y: 0, width: 5, height: 5 } };
  p.nodes.push(child); assertValid(p);
  assert.equal(inheritedFlag(p, child, "hidden"), true);
  p = setControlSelection(p, "root", true);
  assert.equal(inheritedFlag(p, child, "hidden"), false);
  assert.equal(p.nodes.find(node => node.id === skinId)!.hidden, true);
  p = { ...p, nodes: p.nodes.map(node => node.id === "root" ? { ...node, widget: { ...node.widget, skinNodeId: null } } : node) };
  assert.equal(inheritedFlag(p, child, "hidden"), true);
});
