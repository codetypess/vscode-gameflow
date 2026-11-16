import assert from "node:assert/strict";
import type { GameFlowNode, GameFlowPage } from "../shared/model";
import { createDefaultGameFlowDocument, validateGameFlowDocument } from "../shared/model";
import { makeComponent } from "../shared/editor-ops";
import { copySelection, commonSelectionParent, duplicateSelection, moveSelection, removeSelection, selectionRoots, translateSelection } from "../shared/selection-ops";
import { pasteNode } from "../shared/node-clipboard";
import { resolvePageLayout } from "../shared/ui-layout";
import { searchLayers } from "../webview/lib/layer-search";
import { pickSelection, reconcileSelection, singleSelection, visibleLayerOrder } from "../webview/lib/node-selection";

export const nodeSelectionTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => nodeSelectionTests.push({ name, run });
const node = (id: string, parentId?: string, type: GameFlowNode["type"] = "rectangle"): GameFlowNode => ({ id, name: id, type, ...(parentId ? { parentId } : {}), frame: { x: 20, y: 30, width: 40, height: 20 } });
const page = (...nodes: GameFlowNode[]): GameFlowPage => ({ id: "page", name: "Selection", kind: "screen", frame: { x: 0, y: 0, width: 640, height: 480 }, nodes });
const valid = (p: GameFlowPage) => { const result = validateGameFlowDocument({ ...createDefaultGameFlowDocument(), pages: [p], interactions: [] }); assert.ok(result.ok, result.ok ? "" : result.errors.join("\n")); };
const order = ["a", "b", "c", "d", "e"];

test("selection toggles arbitrary nodes once and supports clearing the final node", () => {
  let selection = pickSelection(singleSelection("b"), "d", { toggle: true });
  assert.deepEqual(selection.ids, ["b", "d"]);
  selection = pickSelection(selection, "b", { toggle: true });
  assert.deepEqual(selection.ids, ["d"]); assert.equal(selection.primaryId, "d");
  selection = pickSelection(selection, "d", { toggle: true });
  assert.deepEqual(selection.ids, []); assert.equal(selection.primaryId, null);
});

test("shift ranges keep their anchor, work backwards and append with Ctrl", () => {
  let selection = pickSelection(singleSelection("c"), "e", { range: true, order });
  assert.deepEqual(selection.ids, ["c", "d", "e"]);
  selection = pickSelection(selection, "a", { range: true, order });
  assert.deepEqual(selection.ids, ["a", "b", "c"]); assert.equal(selection.anchorId, "c");
  selection = pickSelection(selection, "e", { range: true, toggle: true, order });
  assert.deepEqual(selection.ids, order);
  assert.deepEqual(pickSelection(singleSelection("hidden"), "b", { range: true, order }).ids, ["b"]);
  assert.deepEqual(pickSelection(singleSelection("hidden"), "b", { range: true, toggle: true, order }).ids, ["b"]);
});

test("range order excludes folded descendants and filtered siblings", () => {
  const p = page(node("a", undefined, "container"), node("a1", "a"), node("a2", "a"), node("b"), node("c"));
  const all = searchLayers(p, "").visible;
  assert.deepEqual(visibleLayerOrder(p, all, new Set(["a"])), ["a", "b", "c"]);
  assert.deepEqual(visibleLayerOrder(p, searchLayers(p, "a2").visible, new Set()), ["a", "a2"]);
  assert.deepEqual(pickSelection(singleSelection("a"), "c", { range: true, order: visibleLayerOrder(p, all, new Set(["a"])) }).ids, ["a", "b", "c"]);
});

test("selection reconciles deletions and preserves a group during pointer drag", () => {
  const selection = { ids: ["a", "b"], primaryId: "b", anchorId: "a" };
  assert.equal(pickSelection(selection, "a", { preserve: true }), selection);
  assert.deepEqual(pickSelection(selection, "a").ids, ["a"]);
  assert.deepEqual(reconcileSelection(page(node("a")), selection), singleSelection("a"));
});

test("common editing scope and selected roots handle nested cross-branch selections", () => {
  const p = page(node("group", undefined, "container"), node("a", "group", "container"), node("a1", "a"), node("b", "group", "container"), node("b1", "b"));
  assert.equal(commonSelectionParent(p, ["a1", "b1"]), "group");
  assert.equal(commonSelectionParent(p, ["a1"]), "a");
  assert.equal(commonSelectionParent(p, ["a", "a1"]), "group");
  assert.deepEqual(selectionRoots(p, ["a1", "b1", "a"]).map(n => n.id), ["a", "b1"]);
});

test("group movement converts page displacement through each parent and moves descendants once", () => {
  const parent = { ...node("parent", undefined, "container"), transform: { scaleX: 2, scaleY: 2 } };
  const p = page(parent, node("child", "parent"), node("peer"));
  const moved = translateSelection(p, ["child", "peer"], 10, 6);
  const before = resolvePageLayout(p), after = resolvePageLayout(moved);
  for (const id of ["child", "peer"]) { assert.equal(after.nodes.get(id)!.matrix[4] - before.nodes.get(id)!.matrix[4], 10); assert.equal(after.nodes.get(id)!.matrix[5] - before.nodes.get(id)!.matrix[5], 6); }
  const both = translateSelection(p, ["parent", "child"], 10, 6);
  assert.deepEqual(both.nodes.find(n => n.id === "child")!.frame, p.nodes[1].frame);
  assert.equal(resolvePageLayout(both).nodes.get("child")!.matrix[4] - before.nodes.get("child")!.matrix[4], 10);
});

test("group flow nudging preserves block order in both directions and at boundaries", () => {
  const p = page(node("row", undefined, "hbox"), ...order.map(id => node(id, "row")));
  const children = (p: GameFlowPage) => p.nodes.filter(n => n.parentId === "row").map(n => n.id);
  assert.deepEqual(children(translateSelection(p, ["b", "c"], 1, 0, "nudge")), ["a", "d", "b", "c", "e"]);
  assert.deepEqual(children(translateSelection(p, ["b", "c"], -1, 0, "nudge")), ["b", "c", "a", "d", "e"]);
  assert.deepEqual(children(translateSelection(p, ["d", "e"], 1, 0, "nudge")), order);
  assert.deepEqual(children(translateSelection(p, ["a", "b"], -1, 0, "nudge")), order);
});

test("rotated flow groups use parent-local direction when ordering a nudge", () => {
  const p = page({ ...node("row", undefined, "hbox"), transform: { rotation: 180 } }, ...order.map(id => node(id, "row")));
  const moved = translateSelection(p, ["b", "c"], -1, 0, "nudge");
  assert.deepEqual(moved.nodes.filter(n => n.parentId === "row").map(n => n.id), ["a", "d", "b", "c", "e"]);
});

test("group edits reject locked roots, singular parents and controlled Slider parts atomically", () => {
  const locked = page(node("a"), { ...node("b"), locked: true });
  assert.equal(translateSelection(locked, ["a", "b"], 3, 2), locked);
  assert.equal(removeSelection(locked, ["a", "b"]), locked);
  assert.equal(moveSelection(locked, ["a", "b"], { position: "inside" }), locked);
  const singular = page({ ...node("parent", undefined, "container"), transform: { scaleX: 0 } }, node("child", "parent"), node("peer"));
  assert.equal(translateSelection(singular, ["child", "peer"], 3, 2), singular);
  let seq = 0;
  const slider = page(...makeComponent("slider", "slider", 100, 100, () => `part${++seq}`), node("peer"));
  assert.equal(translateSelection(slider, [slider.nodes[0].widget!.skinNodeId!, "peer"], 3, 2), slider);
});

test("group deletion clears skin and radio references in one transaction", () => {
  let seq = 0;
  const p = page(...makeComponent("checkbox", "check", 100, 100, () => `part${++seq}`), ...makeComponent("radioGroup", "group", 100, 200, () => `part${++seq}`));
  const skin = p.nodes[0].widget!.skinNodeId!, radio = p.nodes.find(n => n.id === "group")!.widget!.optionNodeIds![0]!;
  const next = removeSelection(p, [skin, radio]); valid(next);
  assert.equal(next.nodes.find(n => n.id === "check")!.widget!.skinNodeId, null);
  assert.ok(!next.nodes.find(n => n.id === "group")!.widget!.optionNodeIds!.includes(radio));
  const locked = { ...p, nodes: p.nodes.map(n => n.id === "check" ? { ...n, locked: true } : n) };
  assert.equal(removeSelection(locked, [skin, radio]), locked);
});

test("group reparenting preserves order and geometry, rejects cycles and locked reference owners", () => {
  const p = page(node("a"), node("b"), node("target", undefined, "container"));
  for (const position of ["before", "after", "inside"] as const) {
    const next = moveSelection(p, ["b", "a"], { targetId: "target", position });
    assert.deepEqual(next.nodes.filter(n => ["a", "b"].includes(n.id)).map(n => n.id), ["a", "b"]);
    const old = resolvePageLayout(p), moved = resolvePageLayout(next);
    for (const id of ["a", "b"]) assert.deepEqual(moved.nodes.get(id)!.matrix, old.nodes.get(id)!.matrix);
  }
  assert.equal(moveSelection(p, ["a", "target"], { targetId: "a", position: "inside" }), p);
  let seq = 0;
  // A locked reference owner must prevent an otherwise movable peer from being partially moved.
  const parts = makeComponent("checkbox", "control", 100, 100, () => `part${++seq}`);
  const source = page(...parts.map((n, i) => i ? n : { ...n, locked: true }), node("peer"), node("target", undefined, "container"));
  assert.equal(moveSelection(source, ["peer", parts[0].widget!.skinNodeId!], { targetId: "target", position: "inside" }), source);
  assert.equal(moveSelection(source, ["control"], { position: "inside" }), source);
});

test("group duplicate and paste preserve forest references, identities and parent-child deduplication", () => {
  let seq = 0; const makeId = () => `copy${++seq}`;
  const p = page(...makeComponent("slider", "slider", 100, 100, makeId), ...makeComponent("radioGroup", "group", 100, 200, makeId));
  p.nodes[0].variableName = "volume";
  const selected = ["slider", p.nodes[1].id, "group"];
  const duplicated = duplicateSelection(p, selected, makeId); valid(duplicated.page);
  const pasted = pasteNode(p, copySelection(p, selected)!, makeId); valid(pasted.page);
  for (const result of [{ page: duplicated.page, ids: duplicated.ids }, { page: pasted.page, ids: pasted.ids! }]) {
    assert.equal(result.ids.length, 2); assert.equal(result.page.nodes.length, p.nodes.length * 2);
    assert.equal(new Set(result.page.nodes.map(n => n.id)).size, result.page.nodes.length);
    const slider = result.page.nodes.find(n => n.id === result.ids[0])!, group = result.page.nodes.find(n => n.id === result.ids[1])!;
    assert.notEqual(slider.variableName, "volume");
    assert.equal(result.page.nodes.find(n => n.id === slider.widget!.skinNodeId)!.parentId, slider.id);
    assert.ok(group.widget!.optionNodeIds!.every(id => result.page.nodes.find(n => n.id === id)!.parentId === group.id));
  }
});

test("copying a forest across transformed parents preserves relative positions in its common space", () => {
  const p = page({ ...node("parent", undefined, "container"), transform: { rotation: 90, scaleX: 2, scaleY: 2 } }, node("child", "parent"), { ...node("peer"), frame: { x: 200, y: 100, width: 40, height: 20 } });
  const pasted = pasteNode(p, copySelection(p, ["child", "peer"])!, (() => { let i = 0; return () => `new${++i}`; })());
  const before = resolvePageLayout(p), after = resolvePageLayout(pasted.page);
  for (const [source, id] of ["child", "peer"].map((source, i) => [source, pasted.ids![i]])) {
    const original = before.nodes.get(source)!.matrix, copy = after.nodes.get(id)!.matrix;
    original.forEach((v, i) => assert.ok(Math.abs(copy[i] - v - (i >= 4 ? 16 : 0)) < 1e-8));
  }
});
