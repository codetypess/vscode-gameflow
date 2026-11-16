import assert from "node:assert/strict";
import type { GameFlowNode, GameFlowPage } from "../shared/model";
import { nodeReferencePath, nodeReferenceRows, referenceUnavailableReason } from "../webview/lib/node-reference";
import { setRadioOptions, validateControlReferences } from "../shared/ui-parts";

export const nodeReferenceTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => nodeReferenceTests.push({ name, run });
const node = (id: string, type: GameFlowNode["type"], parentId?: string): GameFlowNode => ({ id, name: id, type, ...(parentId ? { parentId } : {}), frame: { x: 0, y: 0, width: 20, height: 20 } });
const page = (...nodes: GameFlowNode[]): GameFlowPage => ({ id: "page", name: "设置", kind: "screen", frame: { x: 0, y: 0, width: 400, height: 500 }, nodes });

test("skin picker eligibility agrees with direct-child and slider-constraint validation", () => {
  const owner = node("slider", "slider"), thumb = node("thumb", "image", owner.id);
  const track = { ...node("track", "image", owner.id), layout: { left: 0 } };
  const nested = node("nested", "image", thumb.id), sibling = node("sibling", "image");
  const p = page(owner, thumb, track, nested, sibling);
  for (const id of [null, thumb.id, track.id, nested.id, sibling.id, "missing"]) {
    const errors: string[] = [];
    validateControlReferences({ ...p, nodes: p.nodes.map(n => n === owner ? { ...n, widget: { skinNodeId: id } } : n) }, errors);
    assert.equal(!referenceUnavailableReason(p, owner, "skin", thumb.id, id), errors.length === 0, String(id));
  }
  const checkbox = { ...owner, type: "checkbox" as const };
  assert.equal(referenceUnavailableReason(page(checkbox, track), checkbox, "skin", null, track.id), undefined);
  assert.match(referenceUnavailableReason(p, { ...owner, locked: true }, "skin", thumb.id, null)!, /锁定/);
});

test("radio picker preserves current members and rejects duplicate or foreign-group membership", () => {
  const first = node("first", "radio"), second = node("second", "radio"), third = node("third", "radio"), free = node("free", "radio");
  const group = { ...node("group", "radioGroup"), widget: { optionNodeIds: [first.id, second.id], selectedIndex: 0 } };
  const other = { ...node("other", "radioGroup"), widget: { optionNodeIds: [third.id], selectedIndex: -1 } };
  const image = node("image", "image"), p = page(group, other, first, second, third, free, image);
  for (const id of [null, first.id, free.id, second.id, third.id, image.id]) {
    const next = setRadioOptions(p, group.id, [id, second.id]);
    assert.equal(!referenceUnavailableReason(p, group, "radioOption", first.id, id), next !== p, String(id));
  }
  assert.match(referenceUnavailableReason(p, group, "radioOption", first.id, second.id)!, /其他选项/);
  assert.match(referenceUnavailableReason(p, group, "radioOption", first.id, third.id)!, /other/);
});

test("locked radio membership cannot be cleared while an empty slot can still choose another radio", () => {
  const parent = { ...node("parent", "container"), locked: true }, radio = node("radio", "radio", parent.id);
  const free = node("free", "radio"), group = { ...node("group", "radioGroup"), widget: { optionNodeIds: [radio.id, null], selectedIndex: 0 } };
  const p = page(group, parent, radio, free);
  assert.match(referenceUnavailableReason(p, group, "radioOption", radio.id, null)!, /锁定/);
  assert.equal(setRadioOptions(p, group.id, [null, null]), p);
  assert.equal(referenceUnavailableReason(p, group, "radioOption", radio.id, radio.id), undefined);
  assert.equal(referenceUnavailableReason(p, group, "radioOption", null, free.id), undefined);
  const cleared = setRadioOptions(page(group, { ...radio, parentId: undefined }), group.id, [null, null]);
  assert.deepEqual(cleared.nodes[0].widget?.optionNodeIds, [null, null]);
  assert.equal(cleared.nodes.length, 2);
});

test("reference tree preserves hierarchy and sibling order for interleaved node arrays", () => {
  const p = page(node("a", "container"), node("b", "container"), node("a1", "image", "a"), node("b1", "image", "b"), node("a2", "image", "a"));
  const rows = nodeReferenceRows(p, "", new Set());
  assert.deepEqual(rows.map(r => [r.node.id, r.depth]), [["a", 0], ["a1", 1], ["a2", 1], ["b", 0], ["b1", 1]]);
  assert.deepEqual(rows.filter(r => r.depth === 1).map(r => [r.position, r.size]), [[1, 2], [2, 2], [1, 1]]);
  assert.deepEqual(nodeReferenceRows(p, "", new Set(["a"])).map(r => r.node.id), ["a", "b", "b1"]);
  assert.equal(rows[0].expanded, true);
});

test("picker search retains only matches and ancestor paths including hidden nodes", () => {
  const a = node("a", "container"), b = node("b", "container");
  const match = { ...node("target", "radio", a.id), variableName: "choice", hidden: true };
  const p = page(a, b, match, node("unrelated", "image", a.id));
  for (const query of [" TARGET ", "choice", "UIRadio", "单选框"]) {
    assert.deepEqual(nodeReferenceRows(p, query, new Set()).map(r => r.node.id), ["a", "target"]);
  }
  assert.deepEqual(nodeReferenceRows(p, "not-found", new Set()), []);
  assert.equal(nodeReferenceRows(p, "target", new Set(["a"]))[0].hasChildren, true);
});

test("reference paths distinguish equal names in separate containers", () => {
  const a = node("音量", "slider"), b = node("亮度", "slider");
  const p = page(a, b, { ...node("first-thumb", "image", a.id), name: "滑块" }, { ...node("second-thumb", "image", b.id), name: "滑块" });
  assert.equal(nodeReferencePath(p, "first-thumb"), "设置 / 音量 / 滑块");
  assert.equal(nodeReferencePath(p, "second-thumb"), "设置 / 亮度 / 滑块");
});
