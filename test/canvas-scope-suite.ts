import assert from "node:assert/strict";
import type { GameFlowNode, GameFlowPage } from "../shared/model";
import { makeComponent, removeNode, reparentNode } from "../shared/editor-ops";
import { resolvePageLayout } from "../shared/ui-layout";
import { mapPoint } from "../shared/ui-transform";
import { canvasContextTarget, canvasHitNode, canvasPasteTarget, canvasPlacementPoint, canvasScopePath, placeCanvasComponent, reconcileCanvasScope } from "../webview/lib/canvas-scope";
import { copyNode, pasteNode } from "../shared/node-clipboard";

export const canvasScopeTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => canvasScopeTests.push({ name, run });
const node = (id: string, type: GameFlowNode["type"], parentId?: string): GameFlowNode => ({ id, name: id, type, ...(parentId ? { parentId } : {}), frame: { x: 40, y: 30, width: 200, height: 80 } });
const page = (...nodes: GameFlowNode[]): GameFlowPage => ({ id: "page", name: "设置", kind: "screen", frame: { x: 0, y: 0, width: 640, height: 500 }, nodes });
const ids = (path: GameFlowNode[]) => path.map(item => item.id);

test("canvas context target follows scoped and direct picking and preserves selected group members", () => {
  const p=page(node("group","container"),node("nested","container","group"),node("label","text","nested"),node("other","text"));
  assert.equal(canvasContextTarget(p,null,"label",[]).id,"group");
  assert.equal(canvasContextTarget(p,null,"label",[],true).id,"label");
  assert.equal(canvasContextTarget(p,"group","label",["label","other"]).id,"label");
  assert.equal(canvasContextTarget(p,"group","other",[]).id,null,"out-of-scope artwork behaves as background");
  assert.deepEqual(canvasContextTarget(p,"nested",undefined,["label"]),{id:null,backgroundParentId:"nested"});
  assert.deepEqual(canvasContextTarget({...p,componentRootId:"group"},null,undefined,[]),{id:null,backgroundParentId:"group"});
});

test("context insertion keeps clicked parent coordinates and inserts after the chosen sibling", () => {
  const parent={...node("group","container"),transform:{scaleX:2,scaleY:2},layout:{scrollX:12,scrollY:8}};
  const p=page(parent,node("first","text","group"),node("last","text","group"));
  const point={x:160,y:110},local=canvasPlacementPoint(p,"group",point)!;
  const added=placeCanvasComponent(p,"group","text",point,()=>"added","first");
  assert.equal(added.id,"added");
  assert.deepEqual(added.page.nodes.filter(node=>node.parentId==="group").map(node=>node.id),["first","added","last"]);
  const positioned=added.page.nodes.find(node=>node.id==="added")!;
  const geometry=resolvePageLayout(added.page).nodes.get("added")!;
  const center=mapPoint(geometry.matrix,{x:positioned.frame.width/2,y:positioned.frame.height/2});
  assert.ok(Math.abs(center.x-point.x)<1 && Math.abs(center.y-point.y)<1);
  assert.ok(local.x>0 && local.y>0);
  const locked={...p,nodes:p.nodes.map(node=>node.id==="group" ? {...node,locked:true} : node)};
  assert.equal(placeCanvasComponent(locked,"group","text",point,()=>"blocked","first").id,null);
});

test("canvas picks composite controls before their parts, one editing level at a time", () => {
  let serial = 0;
  const parts = makeComponent("slider", "volume", 100, 100, () => `part${++serial}`);
  parts[0].parentId = "settings";
  const p = page(node("settings", "container"), ...parts);
  for (const part of parts) {
    assert.equal(canvasHitNode(p, null, part.id)?.id, "settings");
    assert.equal(canvasHitNode(p, "settings", part.id)?.id, "volume");
  }
  for (const part of parts.slice(1)) assert.equal(canvasHitNode(p, "volume", part.id)?.id, part.id);
  assert.deepEqual(ids(canvasScopePath(p, "volume")), ["settings", "volume"]);
});

test("scope background, other branches and blank space cannot select nodes outside the scope", () => {
  const p = page(node("a", "container"), node("b", "button"), node("a1", "text", "a"), node("b1", "text", "b"), node("empty", "button"));
  for (const id of ["a", "b", "b1", "missing", undefined]) assert.equal(canvasHitNode(p, "a", id), null);
  assert.equal(canvasHitNode(p, "a", "a1")?.id, "a1");
  assert.deepEqual(canvasScopePath(p, null), []);
  assert.deepEqual(canvasScopePath(p, "a1"), []);
  assert.deepEqual(ids(canvasScopePath(p, "empty")), ["empty"], "empty/button containers are editable scopes");
});

test("direct selection reaches nested composite parts while scoped selection remains the default", () => {
  let serial = 0;
  const parts = makeComponent("slider", "volume", 100, 100, () => `part${++serial}`);
  parts[0].parentId = "settings";
  const p = page(node("settings", "container"), ...parts);
  for (const part of parts.slice(1)) {
    assert.equal(canvasHitNode(p, null, part.id)?.id, "settings");
    assert.equal(canvasHitNode(p, null, part.id, false)?.id, "settings");
    const picked = canvasHitNode(p, null, part.id, true)!;
    assert.equal(picked.id, part.id);
    assert.deepEqual(ids(reconcileCanvasScope(p, [], picked.id).path), ["settings", "volume"]);
  }
});

test("direct selection can leave the current branch and select container backgrounds", () => {
  const p = page(node("a", "container"), node("b", "button"), node("a1", "text", "a"), node("b1", "text", "b"));
  assert.equal(canvasHitNode(p, "a", "b1"), null);
  const picked = canvasHitNode(p, "a", "b1", true)!;
  assert.equal(picked.id, "b1");
  assert.deepEqual(ids(reconcileCanvasScope(p, ["a"], picked.id).path), ["b"]);
  assert.equal(canvasHitNode(p, "b", "a1", true)?.id, "a1");
  assert.equal(canvasHitNode(p, "a", "a", true)?.id, "a");
  for (const id of [undefined, "missing", p.id]) assert.equal(canvasHitNode(p, "a", id, true), null);
});

test("direct selection excludes inherited hidden nodes and keeps locked nodes inspectable", () => {
  const p = page({ ...node("hidden", "container"), hidden: true }, node("hidden-child", "text", "hidden"), { ...node("leaf", "image"), hidden: true }, { ...node("locked", "button"), locked: true }, node("locked-child", "text", "locked"));
  for (const id of ["hidden", "hidden-child", "leaf"]) assert.equal(canvasHitNode(p, null, id, true), null);
  assert.equal(canvasHitNode(p, null, "locked-child", true)?.id, "locked-child");
  assert.equal(canvasHitNode(p, null, "locked", true)?.id, "locked");
});

test("tree selection jumps straight to a nested node's parent scope and follows reparenting", () => {
  const p = page(node("group", "container"), node("button", "button", "group"), node("label", "text", "button"), node("other", "container"));
  const direct = reconcileCanvasScope(p, [], "label");
  assert.deepEqual(ids(direct.path), ["group", "button"]);
  assert.equal(direct.selectedId, "label");
  const moved = reparentNode(p, "label", "other");
  assert.deepEqual(ids(reconcileCanvasScope(moved, ["group", "button"], "label").path), ["other"]);
  const movedScope = reparentNode(p, "button", "other");
  assert.deepEqual(ids(reconcileCanvasScope(movedScope, ["group", "button"], null).path), ["other", "button"]);
});

test("deleted scopes retreat to the nearest surviving ancestor and history leaves valid paths", () => {
  const p = page(node("a", "container"), node("b", "button", "a"), node("label", "text", "b"));
  const removed = removeNode(p, "b");
  const after = reconcileCanvasScope(removed, ["a", "b"], "label");
  assert.deepEqual(ids(after.path), ["a"]); assert.equal(after.selectedId, null);
  assert.deepEqual(ids(reconcileCanvasScope(p, ids(after.path), null).path), ["a"], "undo does not unexpectedly drill in again");
  assert.deepEqual(reconcileCanvasScope(removeNode(p, "a"), ["a", "b"], "label"), { path: [], selectedId: null });
  const converted = page(node("a", "container"), node("b", "text", "a"));
  assert.deepEqual(ids(reconcileCanvasScope(converted, ["a", "b"], null).path), ["a"]);
});

test("placement in a transformed scrolling scope uses child-local coordinates", () => {
  const outer = { ...node("outer", "container"), transform: { scaleX: -1.2, scaleY: .8, rotation: 15 }, layout: { scrollX: 7, scrollY: -4 } };
  const inner = { ...node("inner", "button", "outer"), transform: { anchorX: .5, anchorY: .25, skewX: 20 }, layout: { scrollX: 13, scrollY: 9 } };
  const p = page(outer, inner);
  const point = mapPoint(resolvePageLayout(p).nodes.get(inner.id)!.matrix, { x: 87, y: 41 });
  const local = canvasPlacementPoint(p, inner.id, point)!;
  assert.ok(Math.abs(local.x - 100) < 1e-8); assert.ok(Math.abs(local.y - 50) < 1e-8);
  const result = placeCanvasComponent(p, inner.id, "text", point, () => "new-label");
  const added = result.page.nodes.find(item => item.id === result.id)!;
  assert.equal(added.parentId, inner.id);
  assert.equal(added.frame.x + added.frame.width / 2, 100);
  assert.equal(added.frame.y + added.frame.height / 2, 50);
});

test("placing a composite in the active scope keeps all generated parts under its root", () => {
  let serial = 0;
  const result = placeCanvasComponent(page(node("button", "button")), "button", "slider", { x: 100, y: 70 }, () => `new${++serial}`);
  const root = result.page.nodes.find(item => item.id === result.id)!;
  assert.equal(root.parentId, "button");
  assert.equal(result.page.nodes.filter(item => item.parentId === root.id).length, 3);
  assert.ok(result.page.nodes.some(item => item.id === root.widget?.skinNodeId && item.parentId === root.id));
  const atRoot = placeCanvasComponent(result.page, null, "image", { x: 300, y: 200 }, () => "root-image");
  assert.equal(atRoot.page.nodes.find(item => item.id === atRoot.id)?.parentId, undefined);
});

test("invalid, inherited locked and singular scopes reject placement without allocating IDs", () => {
  const p = page({ ...node("locked", "container"), locked: true }, node("button", "button", "locked"), node("leaf", "image"), { ...node("flat", "container"), transform: { scaleX: 0 } });
  for (const scope of ["locked", "button", "leaf", "flat", "missing"]) {
    const result = placeCanvasComponent(p, scope, "slider", { x: 40, y: 50 }, () => { throw new Error("must not allocate"); });
    assert.equal(result.page, p); assert.equal(result.id, null);
  }
});

test("paste with no selection uses the active scope while selected containers and leaves retain explicit targets", () => {
  const p = page(node("button", "button"), node("label", "text", "button"), node("image", "image"));
  const target = canvasPasteTarget(p, "button", null);
  const pasted = pasteNode(p, copyNode(p, "image")!, () => "new-image", target.parentId, target.afterId);
  assert.equal(pasted.page.nodes.find(item => item.id === pasted.id)?.parentId, "button");
  assert.deepEqual(canvasPasteTarget(p, null, null), { parentId: undefined });
  assert.deepEqual(canvasPasteTarget(p, null, "button"), { parentId: "button" });
  assert.deepEqual(canvasPasteTarget(p, "button", "label"), { parentId: "button", afterId: "label" });
  assert.deepEqual(canvasPasteTarget(p, null, "image"), { parentId: undefined, afterId: "image" });
});
