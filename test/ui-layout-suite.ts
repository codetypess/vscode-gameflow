import assert from "node:assert/strict";
import type { GameFlowNode, GameFlowPage } from "../shared/model";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument } from "../shared/model";
import { absoluteFrame, duplicateNode, duplicatePage, makeComponent, reparentNode } from "../shared/editor-ops";
import { resolvePageLayout } from "../shared/ui-layout";
import { canConvertNodeType, changeContainerType, convertNodeType, editNodeFrame, setNodeConstraint } from "../shared/ui-edit";
import { copyNode, pasteNode } from "../shared/node-clipboard";
import { COMPONENT_TYPES, PAGE_ROOT_TYPES, pageRootType } from "../shared/ui-components";
import { isWebviewToHostMessage } from "../shared/protocol";
import type { WebviewToHostMessage } from "../shared/protocol";
import { DocumentSession } from "../webview/document-session";
import componentSample from "../sample/ui-components.gameflow.json";
import { canvasPanelMetrics, placeCanvasPanels } from "../webview/lib/canvas-panels";
import { canvasDotGrid } from "../webview/lib/canvas-grid";
import { searchLayers } from "../webview/lib/layer-search";
export const uiLayoutTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => uiLayoutTests.push({ name, run });
const node = (id: string, patch: Partial<GameFlowNode> = {}): GameFlowNode => ({ id, type: "rectangle", name: id, frame: { x: 10, y: 20, width: 50, height: 30 }, ...patch });
const page = (...nodes: GameFlowNode[]): GameFlowPage => ({ id: "p", kind: "screen", name: "page", frame: { x: 80, y: 90, width: 400, height: 600 }, nodes });
const local = (p: GameFlowPage, id: string) => resolvePageLayout(p).nodes.get(id)!.local;

test("layer search matches names, optional variables, IDs and component aliases without case or surrounding whitespace", () => {
  const source = page(node("ab12cd34", { type: "hbox", name: "标题横排" }), node("zz99yy88", { type: "text", name: "道具名称", variableName: "btnItem", parentId: "ab12cd34" }));
  const before = structuredClone(source);
  for (const query of ["标题", " AB12CD34 ", "横排容器", " hBoX ", "UIHBOX"]) {
    assert.deepEqual([...searchLayers(source, query).matches], ["ab12cd34"]);
  }
  for (const query of ["名称", "UILabel", "btnItem", " BTNITEM ", "iTeM"]) {
    assert.deepEqual([...searchLayers(source, query).matches], ["zz99yy88"]);
  }
  assert.deepEqual(source, before);
});

test("layer search retains ancestor paths for hidden locked matches without unrelated siblings or children", () => {
  const source = page(node("hit", { type: "panel", name: "唯一匹配", variableName: "btnHiddenItem", parentId: "branch", hidden: true, locked: true }),
    node("root", { type: "container" }), node("sibling", { parentId: "root" }),
    node("branch", { type: "container", parentId: "root" }), node("child", { parentId: "hit" }));
  for (const query of ["唯一匹配", " hIDDeN "]) {
    const result = searchLayers(source, query);
    assert.deepEqual([...result.matches], ["hit"]);
    assert.deepEqual([...result.visible].sort(), ["branch", "hit", "root"]);
    assert.equal(result.visible.has("sibling"), false); assert.equal(result.visible.has("child"), false);
  }
});

test("empty layer searches restore all nodes and unmatched terms return an empty result", () => {
  const source = page(node("root", { type: "container" }), node("child", { parentId: "root" }));
  for (const query of ["", "   \t "]) {
    const result = searchLayers(source, query);
    assert.deepEqual([...result.matches], ["root", "child"]);
    assert.deepEqual([...result.visible], ["root", "child"]);
  }
  const result = searchLayers(source, "不存在的图层");
  assert.equal(result.matches.size, 0); assert.equal(result.visible.size, 0);
  assert.equal(searchLayers(page(), "anything").visible.size, 0);
});

test("node clipboard snapshots resolved subtree geometry and isolates nested data", () => {
  const source = page(node("parent", { type: "container", frame: { x: 0, y: 0, width: 300, height: 200 } }),
    node("root", { type: "panel", parentId: "parent", locked: true, layout: { left: 10, right: 20 } }),
    node("child", { type: "combo", parentId: "root", widget: { options: ["one", "two"] } }));
  const snapshot = copyNode(source, "root")!;
  assert.equal(snapshot.nodes[0].frame.width, local(source, "root").width);
  source.nodes[1].layout!.left = 40;
  source.nodes[2].widget!.options![0] = "changed";
  assert.equal(snapshot.nodes[0].layout!.left, 10);
  assert.deepEqual(snapshot.nodes[1].widget!.options, ["one", "two"]);
  assert.equal(copyNode(source, "missing"), null);
});

test("paste remaps the full subtree across pages, orders siblings and clears root constraints", () => {
  const source = page(node("box", { type: "panel", layout: { left: 0, top: 0 } }),
    node("child", { type: "combo", parentId: "box", widget: { options: ["one", "two"] }, layout: { right: 0 } }));
  const snapshot = copyNode(source, "box")!;
  const target = page(node("dest", { type: "container" }), node("anchor", { parentId: "dest" }), node("last", { parentId: "dest" }));
  let serial = 0;
  const result = pasteNode(target, snapshot, () => `new${++serial}`, "dest", "anchor");
  const root = result.page.nodes.find((n) => n.id === result.id)!;
  assert.equal(root.parentId, "dest");
  assert.equal(root.frame.x, snapshot.nodes[0].frame.x + 16);
  assert.equal(root.frame.width, snapshot.nodes[0].frame.width);
  assert.equal(root.layout!.left, null); assert.equal(root.layout!.widthMode, "explicit");
  assert.deepEqual(result.page.nodes.filter((n) => n.parentId === "dest").map((n) => n.id), ["anchor", root.id, "last"]);
  const child = result.page.nodes.find((n) => n.parentId === root.id)!;
  assert.notEqual(child.id, "child"); assert.equal(child.layout!.right, 0);
  child.widget!.options![0] = "edited";
  assert.equal(snapshot.nodes[1].widget!.options![0], "one");
  const again = pasteNode(target, snapshot, () => `new${++serial}`);
  assert.notEqual(again.id, result.id);
  assert.equal(again.page.nodes.find((n) => n.id === again.id)!.parentId, undefined);
  assert.deepEqual(validateGameFlowDocument({ ...createDefaultGameFlowDocument(), pages: [result.page], interactions: [] }).ok, true);
});

test("paste rejects locked, leaf, missing or mismatched destinations before allocating IDs", () => {
  const snapshot = copyNode(page(node("copy")), "copy")!;
  const target = page(node("locked", { type: "container", locked: true }), node("nested", { type: "container", parentId: "locked" }), node("leaf", { type: "text" }), node("other"));
  for (const [parentId, afterId] of [["locked"], ["nested"], ["leaf"], ["missing"], [undefined, "missing"], ["nested", "other"]]) {
    const result = pasteNode(target, snapshot, () => { throw new Error("should not allocate"); }, parentId, afterId);
    assert.equal(result.page, target); assert.equal(result.id, null);
  }
});

test("node type conversion preserves identity and content, normalizes flow and protects children", () => {
  const source = page(node("box", { type: "panel", text: "keep", style: { fill: "#112233" } }), node("child", { type: "text", parentId: "box", layout: { left: 0, right: 0 } }));
  assert.equal(convertNodeType(source, "box", "text"), source);
  const converted = convertNodeType(source, "box", "hbox");
  assert.equal(converted.nodes[0].id, "box"); assert.equal(converted.nodes[0].name, "box");
  assert.equal(converted.nodes[0].text, "keep"); assert.deepEqual(converted.nodes[0].style, source.nodes[0].style);
  assert.equal(converted.nodes[1].id, "child"); assert.equal(converted.nodes[1].parentId, "box");
  assert.equal(converted.nodes[1].layout!.left, null); assert.equal(converted.nodes[1].layout!.right, null);
  assert.equal(canConvertNodeType(converted, "box", "hbox"), false);
  for (const blocked of [page({ ...source.nodes[0], locked: true }), page(source.nodes[0], { ...source.nodes[1], locked: true })]) {
    assert.equal(convertNodeType(blocked, "box", "grid"), blocked);
  }
  const leaf = page(node("label", { type: "text", parentId: undefined, text: "caption" }));
  const slider = convertNodeType(leaf, "label", "slider");
  assert.deepEqual(slider.nodes[0].widget, { min: 0, max: 100, value: 60 });
  assert.equal(slider.nodes[0].text, "caption");
  assert.deepEqual(local(slider, "label"), local(leaf, "label"));
  assert.equal(validateGameFlowDocument({ ...createDefaultGameFlowDocument(), pages: [slider], interactions: [] }).ok, true);
});

test("canvas dots keep a bounded density and repeat when zoom doubles or halves", () => {
  for (let i = 0; i <= 500; i++) {
    const zoom = .05 * (8 / .05) ** (i / 500);
    const grid = canvasDotGrid({ x: -347.25, y: 285.5, zoom });
    assert.ok(grid.spacing >= 24 && grid.spacing < 48, `unexpected spacing at zoom ${zoom}`);
    for (const factor of [.5, 2]) {
      const repeated = canvasDotGrid({ x: -347.25, y: 285.5, zoom: zoom * factor });
      assert.ok(Math.abs(repeated.spacing - grid.spacing) < 1e-9);
      assert.ok(Math.abs(repeated.x - grid.x) < 1e-9);
      assert.ok(Math.abs(repeated.y - grid.y) < 1e-9);
    }
  }
  for (const zoom of [.0625, .125, .25, .5, 1, 2, 4, 8]) {
    assert.equal(canvasDotGrid({ x: 0, y: 0, zoom }).spacing, 24);
  }
  assert.equal(canvasDotGrid({ x: 0, y: 0, zoom: 1.5 }).spacing, 36);
});

test("canvas dots stay anchored at world zero across zoom boundaries and negative pans", () => {
  const onGrid = (screen: number, tileStart: number, spacing: number) => {
    const index = (screen - tileStart - spacing / 2) / spacing;
    assert.ok(Math.abs(index - Math.round(index)) < 1e-7);
  };
  for (const boundary of [.125, .25, .5, 1, 2, 4, 8]) {
    for (const zoom of [boundary * (1 - 1e-8), boundary, boundary * (1 + 1e-8)]) {
      for (const position of [-1e6, -53.75, 0, 47.5, 1e6]) {
        const camera = { x: position, y: -position, zoom }, before = { ...camera };
        const grid = canvasDotGrid(camera);
        assert.ok(Math.abs(grid.x) <= grid.spacing / 2 && Math.abs(grid.y) <= grid.spacing / 2);
        onGrid(camera.x, grid.x, grid.spacing);
        onGrid(camera.y, grid.y, grid.spacing);
        // A coarse intersection remains a dot on either side of a level transition.
        onGrid(camera.x + 48 / boundary * zoom, grid.x, grid.spacing);
        const panned = canvasDotGrid({ ...camera, x: camera.x + 7.25, y: camera.y - 3.75 });
        onGrid(camera.x + 7.25, panned.x, panned.spacing);
        onGrid(camera.y - 3.75, panned.y, panned.spacing);
        assert.deepEqual(camera, before);
      }
    }
  }
});

test("all concrete page roots round-trip and pass the document protocol", () => {
  const doc = createDefaultGameFlowDocument();
  for (const rootType of PAGE_ROOT_TYPES) {
    const candidate = { ...doc, pages: doc.pages.map((p) => ({ ...p, rootType })) };
    assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(candidate)), candidate);
    assert.ok(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: candidate }));
    assert.deepEqual(candidate.pages.map((p) => p.kind), doc.pages.map((p) => p.kind));
  }
});
test("legacy pages default to UIStack without adding fields or changing their version", () => {
  for (const schemaVersion of [1, 2] as const) {
    const doc = { ...createDefaultGameFlowDocument(), schemaVersion };
    const source = serializeGameFlowDocument(doc), parsed = parseGameFlowDocument(source);
    for (const p of parsed.pages) {
      assert.equal(pageRootType(p), "UIStack");
      assert.equal(Object.hasOwn(p, "rootType"), false);
    }
    assert.equal(serializeGameFlowDocument(parsed), source);
  }
});
test("page roots reject base classes, malformed values and v1 fields at the protocol boundary", () => {
  const doc = createDefaultGameFlowDocument();
  for (const rootType of ["UIView", "unknown", "", null, ["UIStack"], {}, 1]) {
    const candidate = { ...doc, pages: doc.pages.map((p) => ({ ...p, rootType })) };
    assert.equal(validateGameFlowDocument(candidate).ok, false);
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: candidate }), false);
  }
  for (const rootType of PAGE_ROOT_TYPES) {
    assert.equal(validateGameFlowDocument({ ...doc, schemaVersion: 1, pages: doc.pages.map((p) => ({ ...p, rootType })) }).ok, false);
  }
});
test("page copies preserve root class and presentation while remapping the full hierarchy", () => {
  const original = page(node("box", { type: "container" }), node("child", { parentId: "box" }));
  let serial = 0;
  for (const rootType of PAGE_ROOT_TYPES) {
    const source = { ...original, rootType, kind: "modal" as const };
    const copied = duplicatePage(source, () => `copy${++serial}`);
    assert.equal(copied.rootType, rootType); assert.equal(copied.kind, "modal");
    assert.notEqual(copied.id, source.id);
    assert.notEqual(copied.nodes[0].id, source.nodes[0].id);
    assert.equal(copied.nodes[1].parentId, copied.nodes[0].id);
    assert.equal(source.nodes[1].parentId, "box");
  }
});
test("editing a legacy page root upgrades in one transaction and accepts undo and redo snapshots", () => {
  const doc = { ...createDefaultGameFlowDocument(), schemaVersion: 1 as const };
  const messages: WebviewToHostMessage[] = [];
  const session = new DocumentSession((message) => messages.push(message), () => {});
  session.receive({ type: "init", document: doc, documentVersion: 1, resourceName: "test", dirty: false });
  session.edit((d) => ({ ...d, pages: d.pages.map((p, i) => i === 0 ? { ...p, rootType: "UIScene" } : p) }));
  const changed = session.state.document!;
  assert.equal(changed.schemaVersion, 2); assert.equal(changed.pages[0].rootType, "UIScene");
  const { rootType: _, ...unchanged } = changed.pages[0];
  assert.deepEqual(unchanged, doc.pages[0]);
  assert.equal(messages.length, 1); assert.ok(isWebviewToHostMessage(messages[0]));
  session.receive({ type: "documentChanged", document: changed, documentVersion: 2, dirty: true });
  session.command("undo");
  session.receive({ type: "documentChanged", document: doc, documentVersion: 3, dirty: false });
  session.receive({ type: "commandCompleted", action: "undo" });
  assert.deepEqual(session.state.document, doc);
  session.command("redo");
  session.receive({ type: "documentChanged", document: changed, documentVersion: 4, dirty: true });
  session.receive({ type: "commandCompleted", action: "redo" });
  assert.deepEqual(session.state.document, changed);
});

test("prototype panels keep their configured widths and top alignment when content height changes", () => {
  const viewport = { width: 1800, height: 1100 }, content = { x: 500, y: 150, width: 600 };
  const options = { leftWidth: 280, rightWidth: 280, footer: 76, minFollowHeight: 400 }, heights = { left: 280, right: 600 };
  const before = placeCanvasPanels(viewport, content, heights, options);
  assert.equal(before.left.left + before.left.width + 16, content.x);
  assert.equal(before.right.left, content.x + content.width + 16);
  assert.equal(before.left.top, 150); assert.equal(before.right.top, 150);
  const moved = placeCanvasPanels(viewport, { ...content, x: 540, y: 180, width: 300 }, heights, options);
  assert.equal(moved.left.left, before.left.left + 40); assert.equal(moved.right.left, 856);
  assert.equal(moved.left.width, 280); assert.equal(moved.right.width, 280);
  assert.equal(moved.left.top, 180);
  const expanded = placeCanvasPanels(viewport, { ...content, y: 800 }, heights, options);
  const collapsed = placeCanvasPanels(viewport, { ...content, y: 800 }, { ...heights, right: 34 }, options);
  assert.equal(expanded.right.top + 400, viewport.height - 76 - 12);
  assert.equal(collapsed.right.top, expanded.right.top);
  assert.equal(expanded.right.maxHeight, 400);
  assert.equal(expanded.left.top, expanded.right.top);
});
test("top-following panels stop at 400 available pixels and resume when content moves back up", () => {
  const viewport = { width: 1280, height: 900 }, options = { leftWidth: 280, rightWidth: 280, footer: 76, minFollowHeight: 400 };
  const heights = { left: 180, right: 1200 }, content = { x: 400, y: 200, width: 400 };
  const aligned = placeCanvasPanels(viewport, content, heights, options);
  assert.equal(aligned.right.top, 200); assert.equal(aligned.right.maxHeight, 612);
  for (const y of [412, 500, 5000]) {
    const stopped = placeCanvasPanels(viewport, { ...content, y }, heights, options);
    assert.equal(stopped.right.top, 412); assert.equal(stopped.right.maxHeight, 400);
  }
  assert.deepEqual(placeCanvasPanels(viewport, content, heights, options), aligned);
  const short = placeCanvasPanels({ width: 360, height: 260 }, content, heights, { ...options, footer: 0 });
  assert.equal(short.right.top, 12); assert.equal(short.right.maxHeight, 236);
  assert.equal(short.left.width, short.right.width);
});
test("prototype panels stay in view and clear the toolbar with one or both panels present", () => {
  for (const viewport of [{ width: 1800, height: 1000 }, { width: 720, height: 480 }, { width: 320, height: 240 }]) {
    for (const leftWidth of [0, 280]) for (const rightWidth of [0, 280]) {
      const options = { leftWidth, rightWidth, footer: 76, minFollowHeight: 400 }, m = canvasPanelMetrics(viewport, options);
      for (const x of [-5000, 600, 5000]) for (const y of [-5000, 100, 5000]) {
        const placed = placeCanvasPanels(viewport, { x, y, width: 1500 }, { left: 400, right: 1200 }, options);
        for (const side of ["left", "right"] as const) {
          if (!options[side === "left" ? "leftWidth" : "rightWidth"]) continue;
          const p = placed[side];
          assert.ok(p.left >= m.margin && p.left + p.width <= viewport.width - m.margin + 1e-8);
          assert.ok(p.top >= m.margin && p.top + Math.min(side === "left" ? 400 : 1200, p.maxHeight) <= viewport.height - m.footer - m.margin + 1e-8);
        }
        if (leftWidth && rightWidth) assert.ok(placed.left.left + placed.left.width + m.gap <= placed.right.left + 1e-8);
        if (!leftWidth && rightWidth && x === -5000) assert.equal(placed.right.left, m.margin);
      }
    }
  }
});

test("the UI sample opens with valid layout and remains valid when its page width grows", () => {
  const doc = parseGameFlowDocument(JSON.stringify(componentSample));
  for (const p of doc.pages) {
    assert.deepEqual(resolvePageLayout(p).issues, []);
    assert.deepEqual(resolvePageLayout({ ...p, frame: { ...p.frame, width: p.frame.width + 200 } }).issues, []);
  }
});

test("v1 documents retain original identities and frames until the first edit upgrades atomically", () => {
  const doc = { ...createDefaultGameFlowDocument(), schemaVersion: 1 as const };
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(doc)), doc);
  const session = new DocumentSession(() => {}, () => {});
  session.receive({ type: "init", document: doc, documentVersion: 1, resourceName: "test", dirty: false });
  session.edit((d) => d); assert.equal(session.state.document!.schemaVersion, 1);
  session.edit((d) => ({ ...d, title: "updated" }));
  assert.equal(session.state.document!.schemaVersion, 2);
  assert.deepEqual(session.state.document!.pages, doc.pages);
});
test("all UI component factories round-trip including children and independent button labels", () => {
  let id = 0;
  const nodes = COMPONENT_TYPES.flatMap((type) => makeComponent(type, `node${++id}`, 100, 100, () => `node${++id}`));
  const doc = { ...createDefaultGameFlowDocument(), pages: [page(...nodes)], interactions: [] };
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(doc)), doc);
  const button = nodes.find((n) => n.type === "button")!;
  assert.equal(button.text, undefined);
  assert.equal(nodes.find((n) => n.parentId === button.id)!.type, "text");
  assert.equal(resolvePageLayout(doc.pages[0]).issues.length, 0);
});
test("UI configuration rejects invalid fields, ranges, fractional grid counts and legacy v2 payloads", () => {
  const doc = { ...createDefaultGameFlowDocument(), pages: [page(node("n"))], interactions: [] };
  for (const patch of [{ layout: { left: "10" } }, { layout: { left: Infinity } }, { layout: { wrapCount: 1.5 } }, { layout: { paddingTop: -1 } }, { widget: { value: 2 } }, { widget: { min: 2, max: 1 } }, { widget: { selected: 1 } }, { widget: { options: [1] } }, { widget: { unknown: true } }]) {
    assert.equal(validateGameFlowDocument({ ...doc, pages: [page({ ...node("n"), ...patch } as GameFlowNode)] }).ok, false);
  }
  assert.equal(validateGameFlowDocument({ ...doc, schemaVersion: 1, pages: [page(node("n", { layout: { left: 0 } }))] }).ok, false);
});
test("constraints honor parent padding, null, zero, center priority and stretched dimensions", () => {
  const box = node("box", { type: "container", frame: { x: 40, y: 60, width: 300, height: 200 }, layout: { paddingLeft: 10, paddingRight: 20, paddingTop: 5, paddingBottom: 15 } });
  const n = node("n", { parentId: "box", layout: { left: 0, right: 30, centerX: 10, top: null, bottom: 0 } });
  const p = page(box, n), geometry = resolvePageLayout(p);
  assert.deepEqual(local(p, "n"), { x: 35, y: 155, width: 240, height: 30 });
  assert.equal(geometry.nodes.get("n")!.widthSource, "stretch");
  assert.deepEqual(absoluteFrame(p, n), { x: 75, y: 215, width: 240, height: 30 });
});
test("constraint toggles preserve current bounds through all anchors and padded parents", () => {
  const source = page(node("box", { type: "container", frame: { x: 20, y: 30, width: 301, height: 201 }, layout: { paddingLeft: 7, paddingRight: 11, paddingTop: 5, paddingBottom: 9 } }),
    node("n", { parentId: "box", frame: { x: 29, y: 38, width: 61, height: 43 } }));
  const snapshot = structuredClone(source), before = local(source, "n");
  let current = source;
  for (const enabled of [true, false]) for (const key of ["left", "right", "centerX", "top", "bottom", "centerY"] as const) {
    current = setNodeConstraint(current, "n", key, enabled);
    const after = local(current, "n");
    for (const field of ["x", "y", "width", "height"] as const) assert.ok(Math.abs(after[field] - before[field]) < 1e-8, `${key}: ${field}`);
    assert.equal(current.nodes[1].id, "n");
  }
  assert.deepEqual(source, snapshot);
});
test("percent anchor conversions retain geometry instead of rounding inverse offsets", () => {
  let current = page(node("box", { type: "container", frame: { x: 0, y: 0, width: 503, height: 307 }, layout: { paddingLeft: 13, paddingRight: 17, paddingTop: 5, paddingBottom: 9 } }),
    node("n", { parentId: "box", frame: { x: 37, y: 41, width: 81, height: 63 }, layout: { layoutUnit: "percent" } }));
  const before = local(current, "n");
  for (const enabled of [true, false]) for (const key of ["centerX", "right", "left", "centerY", "bottom", "top"] as const) {
    current = setNodeConstraint(current, "n", key, enabled);
    const after = local(current, "n");
    for (const field of ["x", "y", "width", "height"] as const) assert.ok(Math.abs(after[field] - before[field]) < 1e-8, `${key}: ${field}`);
  }
});
test("removing stretch freezes resolved size and removing the last anchor keeps the current frame", () => {
  let current = page(node("n", { frame: { x: -99, y: -77, width: 20, height: 30 }, layout: { left: 10, right: 20, top: 12, bottom: 21, widthMode: "measured", heightMode: "measured" } }));
  const before = local(current, "n");
  for (const key of ["left", "right", "top", "bottom"] as const) current = setNodeConstraint(current, "n", key, false);
  assert.deepEqual(local(current, "n"), before);
  assert.deepEqual(current.nodes[0].frame, before);
  assert.equal(current.nodes[0].layout!.widthMode, "explicit"); assert.equal(current.nodes[0].layout!.heightMode, "explicit");
});
test("constraint conversion respects inherited locks, managed axes and no-op toggles", () => {
  const source = page(node("box", { type: "hbox" }), node("n", { parentId: "box", layout: { top: 12 } }), node("locked", { locked: true }));
  assert.equal(setNodeConstraint(source, "n", "left", true), source);
  assert.equal(setNodeConstraint(source, "n", "top", true), source);
  assert.equal(setNodeConstraint(source, "locked", "top", true), source);
  const inherited = { ...source, nodes: source.nodes.map(n => n.id === "box" ? { ...n, locked: true } : n) };
  assert.equal(setNodeConstraint(inherited, "n", "bottom", true), inherited);
});
test("removing a final flow cross-axis anchor preserves its position instead of restoring parent alignment", () => {
  for (const type of ["hbox", "vbox"] as const) {
    const axis = type === "hbox" ? "y" : "x", anchor = type === "hbox" ? "top" : "left";
    const source = page(node("box", { type, frame: { x: 0, y: 0, width: 300, height: 200 }, layout: { align: "right", valign: "bottom" } }),
      node("n", { parentId: "box", layout: { [anchor]: 23 } }), node("sibling", { parentId: "box" }));
    const before = local(source, "n"), siblingBefore = local(source, "sibling");
    const cleared = setNodeConstraint(source, "n", anchor, false);
    assert.deepEqual(local(cleared, "n"), before);
    assert.deepEqual(local(cleared, "sibling"), siblingBefore);
    const moved = editNodeFrame(cleared, "n", { ...before, [axis]: before[axis] + 7 }, "move");
    assert.equal(local(moved, "n")[axis], before[axis] + 7);
    const doc = { ...createDefaultGameFlowDocument(), schemaVersion: 2 as const, pages: [moved], interactions: [] };
    assert.deepEqual(local(parseGameFlowDocument(serializeGameFlowDocument(doc)).pages[0], "n"), local(moved, "n"));
    const enabled = setNodeConstraint(moved, "n", anchor, true);
    assert.deepEqual(local(enabled, "n"), local(moved, "n"));
    assert.equal(enabled.nodes[1].layout?.crossAxisMode, undefined);
  }
});
test("manual flow cross-axis positioning resets at new parent boundaries and rejects invalid modes", () => {
  const source = page(node("box", { type: "hbox" }), node("target", { type: "vbox" }),
    node("n", { parentId: "box", layout: { crossAxisMode: "explicit" } }));
  assert.equal(reparentNode(source, "n", "target").nodes[2].layout?.crossAxisMode, undefined);
  assert.equal(changeContainerType(source, "box", "vbox").nodes[2].layout?.crossAxisMode, undefined);
  const pasted = pasteNode(source, copyNode(source, "n")!, () => "copy", "target");
  assert.equal(pasted.page.nodes.find(n => n.id === pasted.id)?.layout?.crossAxisMode, undefined);
  const doc = { ...createDefaultGameFlowDocument(), schemaVersion: 2 as const, pages: [source], interactions: [] };
  assert.equal(validateGameFlowDocument(doc).ok, true);
  assert.equal(validateGameFlowDocument({ ...doc, pages: [page(node("n", { layout: { crossAxisMode: "bad" as "explicit" } }))] }).ok, false);
});
test("direct geometry edits round changed coordinates while inverse percent offsets preserve the target", () => {
  const legacy = page(node("n", { frame: { x: 1.25, y: 2.75, width: 7.2, height: 8.1 } }));
  const moved = editNodeFrame(legacy, "n", { ...local(legacy, "n"), x: 19.6 }, "move");
  assert.deepEqual(moved.nodes[0].frame, { x: 20, y: 2.75, width: 7.2, height: 8.1 });
  const resized = editNodeFrame(moved, "n", { ...local(moved, "n"), width: 12.6, height: 13.2 });
  assert.equal(resized.nodes[0].frame.width, 13); assert.equal(resized.nodes[0].frame.height, 13);
  const source = page(node("n", { layout: { left: 10, right: 10, centerY: 0, layoutUnit: "percent" } }));
  source.frame.width = 401;
  const initial = local(source, "n"), target = editNodeFrame(source, "n", { ...initial, x: initial.x + 1.7 }, "move");
  assert.equal(local(target, "n").x, Math.round(initial.x + 1.7));
  assert.ok(Math.abs(local(target, "n").width - initial.width) < 1e-8);
});
test("percent constraints use 10 for ten percent of parent content and respond to parent resize", () => {
  const box = node("box", { type: "container", frame: { x: 0, y: 0, width: 300, height: 200 }, layout: { paddingLeft: 20, paddingRight: 20 } });
  const n = node("n", { parentId: "box", layout: { left: 10, right: 10, centerY: 0, layoutUnit: "percent" } });
  assert.deepEqual(local(page(box, n), "n"), { x: 46, y: 85, width: 208, height: 30 });
  assert.equal(local(page({ ...box, frame: { ...box.frame, width: 500 } }, n), "n").width, 368);
});
test("relative position rounds without rounding size and free legacy coordinates remain untouched", () => {
  const p = page(node("n", { layout: { left: 0.2, right: 0.3, centerY: 0.2 } }), node("legacy", { frame: { x: 1.25, y: 2.75, width: 7.2, height: 8.1 } }));
  assert.equal(local(p, "n").width, 399.5); assert.equal(local(p, "n").x, 0);
  assert.deepEqual(local(p, "legacy"), p.nodes[1].frame);
});
test("HBox lays out all children including hidden nodes, with padding, negative gap and cross alignment", () => {
  const box = node("box", { type: "hbox", frame: { x: 0, y: 0, width: 300, height: 120 }, layout: { gap: -10, paddingLeft: 10, paddingRight: 10, paddingTop: 10, paddingBottom: 10, align: "center", valign: "middle" } });
  const p = page(box, node("a", { parentId: "box", hidden: true }), node("b", { parentId: "box", frame: { x: 0, y: 0, width: 80, height: 40 } }));
  assert.deepEqual(local(p, "a"), { x: 90, y: 45, width: 50, height: 30 });
  assert.deepEqual(local(p, "b"), { x: 130, y: 40, width: 80, height: 40 });
});
test("VBox justify ignores configured gap and uses cross-axis constraints before alignment", () => {
  const p = page(node("box", { type: "vbox", frame: { x: 0, y: 0, width: 300, height: 200 }, layout: { gap: 999, valign: "justify", align: "right" } }), node("a", { parentId: "box", layout: { left: 5 } }), node("b", { parentId: "box" }));
  assert.equal(local(p, "a").x, 5); assert.equal(local(p, "a").y, 0);
  assert.equal(local(p, "b").x, 250); assert.equal(local(p, "b").y, 170);
});
test("Grid uses maximum cell size, direction, wrap count and whole-grid alignment", () => {
  const box = node("box", { type: "grid", frame: { x: 0, y: 0, width: 300, height: 200 }, layout: { wrapCount: 2, gapX: 10, gapY: 5, align: "center", valign: "middle" } });
  const p = page(box, node("a", { parentId: "box" }), node("b", { parentId: "box", frame: { x: 0, y: 0, width: 70, height: 40 } }), node("c", { parentId: "box" }));
  assert.deepEqual(local(p, "a"), { x: 75, y: 57.5, width: 50, height: 30 });
  assert.equal(local(p, "b").x, 155); assert.equal(local(p, "c").y, 102.5);
  const vertical = { ...p, nodes: [{ ...box, layout: { ...box.layout, direction: "vertical" as const } }, ...p.nodes.slice(1)] };
  assert.equal(local(vertical, "b").x, 75); assert.equal(local(vertical, "b").y, 102.5);
});
test("nested content measurements propagate from children and justify excludes gaps from measurement", () => {
  const outer = node("outer", { type: "container", layout: { widthMode: "measured", heightMode: "measured", paddingLeft: 5, paddingRight: 5 } });
  const inner = node("inner", { type: "hbox", parentId: "outer", layout: { widthMode: "measured", heightMode: "measured", align: "justify", gap: 99 } });
  const p = page(outer, inner, node("a", { parentId: "inner" }), node("b", { parentId: "inner" }));
  assert.equal(local(p, "inner").width, 100); assert.equal(local(p, "outer").width, 120);
  assert.equal(local(p, "outer").height, 50);
});
test("auto text height responds to content and wrapping without persisting computed frames", () => {
  const n = node("label", { type: "text", text: "中文中文中文", frame: { x: 0, y: 0, width: 32, height: 30 }, style: { fontSize: 16 }, widget: { wordWrap: true }, layout: { heightMode: "measured" } });
  const p = page(n); assert.equal(local(p, n.id).height, 3 * 16 * 1.35);
  assert.equal(n.frame.height, 30);
});
test("measurement dependencies, flow constraints and negative stretch produce actionable bounded diagnostics", () => {
  for (const type of ["container", "hbox", "vbox", "grid"] as const) {
    const p = page(node("box", { type, layout: { widthMode: "measured", heightMode: "measured" } }), node("child", { parentId: "box", layout: { right: 0, bottom: 0 } }));
    assert.ok(resolvePageLayout(p).issues.length > 0);
    assert.ok(Number.isFinite(local(p, "child").x));
  }
  assert.ok(resolvePageLayout(page(node("bad", { layout: { left: 500, right: 0 } }))).issues.some((i) => i.nodeId === "bad"));
});
test("nested clipping intersects bounds and panel scroll moves descendants without changing authored coordinates", () => {
  const p = page(node("outer", { type: "panel", frame: { x: 10, y: 10, width: 100, height: 100 }, layout: { scrollX: 20, clipContent: true } }), node("inner", { parentId: "outer", type: "panel", frame: { x: 60, y: 60, width: 100, height: 100 } }), node("child", { parentId: "inner" }));
  const child = resolvePageLayout(p).nodes.get("child")!;
  assert.deepEqual(child.clip, { x: 50, y: 70, width: 60, height: 40 });
  assert.equal(child.absolute.x, 60); assert.equal(child.local.x, 10);
});
test("dragging and resizing constrained nodes update percent offsets and survive re-resolution", () => {
  const p = page(node("n", { layout: { left: 10, right: 10, centerY: 0, layoutUnit: "percent" } }));
  const initial = local(p, "n"), target = { ...initial, x: initial.x + 20, y: initial.y + 30 };
  const moved = editNodeFrame(p, "n", target, "move");
  assert.deepEqual(local(moved, "n"), target);
  assert.equal(moved.nodes[0].layout!.left, 15); assert.equal(moved.nodes[0].layout!.right, 5);
  const resized = { ...target, width: target.width - 40, height: target.height + 10 };
  assert.deepEqual(local(editNodeFrame(moved, "n", resized), "n"), resized);
});
test("flow drag and keyboard reorder siblings instead of authoring ineffective coordinates", () => {
  const p = page(node("box", { type: "hbox", frame: { x: 0, y: 0, width: 300, height: 100 }, layout: { gap: 10 } }), node("a", { parentId: "box" }), node("b", { parentId: "box" }), node("c", { parentId: "box" }));
  const target = { ...local(p, "a"), x: 120 };
  const moved = editNodeFrame(p, "a", target, "move");
  assert.deepEqual(moved.nodes.filter((n) => n.parentId === "box").map((n) => n.id), ["b", "c", "a"]);
  assert.equal(moved.nodes.find((n) => n.id === "a")!.frame.x, 10);
  const nudged = editNodeFrame(p, "a", { ...local(p, "a"), x: 1 }, "nudge");
  assert.deepEqual(nudged.nodes.filter((n) => n.parentId === "box").map((n) => n.id), ["b", "a", "c"]);
});
test("reparenting freezes resolved dimensions and retains visual position in a scrolled free parent", () => {
  const p = page(node("from", { type: "container", frame: { x: 100, y: 50, width: 200, height: 100 } }), node("to", { type: "panel", frame: { x: 20, y: 30, width: 400, height: 400 }, layout: { scrollX: 15, scrollY: 10 } }), node("child", { parentId: "from", layout: { left: 0, right: 0, centerY: 0 } }));
  const before = absoluteFrame(p, p.nodes[2]); const changed = reparentNode(p, "child", "to");
  assert.deepEqual(absoluteFrame(changed, changed.nodes[2]), before);
  assert.equal(changed.nodes[2].id, "child"); assert.equal(changed.nodes[2].layout!.left, null);
});
test("switching container layout clears prohibited child constraints and preserves IDs", () => {
  const p = page(node("box", { type: "container" }), node("child", { parentId: "box", layout: { left: 0, right: 0, centerY: 0 } }));
  const changed = changeContainerType(p, "box", "hbox");
  assert.equal(changed.nodes[1].layout!.left, null); assert.equal(changed.nodes[1].layout!.right, null);
  assert.equal(changed.nodes[1].layout!.centerY, 0);
  assert.equal(resolvePageLayout(changed).issues.length, 0);
});
test("duplicating components deep copies configuration and remaps only internal identities", () => {
  let id = 0; const nodes = makeComponent("button", "root", 100, 100, () => `n${++id}`);
  nodes[0].widget = { options: ["a", "b"], selectedIndex: 0 };
  const p = page(...nodes), copy = duplicateNode(p, "root", () => `n${++id}`);
  const duplicate = copy.page.nodes.find((n) => n.id === copy.id)!;
  duplicate.widget!.options![0] = "changed";
  assert.equal(nodes[0].widget.options![0], "a");
  const child = copy.page.nodes.find((n) => n.parentId === copy.id)!;
  child.layout!.left = 10; assert.equal(nodes[1].layout!.left, 0);
  assert.notEqual(child.id, nodes[1].id);
});
test("locked nodes and locked parent containers reject layout edits and reparenting", () => {
  const n = node("n", { locked: true }), p = page(n, node("box", { type: "hbox", locked: true }));
  assert.equal(editNodeFrame(p, "n", { ...n.frame, x: 99 }), p);
  assert.equal(reparentNode(p, "n", "box"), p);
  assert.equal(changeContainerType(p, "box", "vbox"), p);
});

test("cross-axis nudges adjust constraints without also changing flow order", () => {
  const p = page(node("box", { type: "vbox" }), node("a", { parentId: "box", layout: { left: 0 } }), node("b", { parentId: "box" }));
  const changed = editNodeFrame(p, "a", { ...local(p, "a"), x: 1 }, "nudge");
  assert.deepEqual(changed.nodes.map((n) => n.id), ["box", "a", "b"]);
  assert.equal(changed.nodes[1].layout!.left, 1);
});
test("layout conversion freezes previous stretched size even when content sizing was enabled", () => {
  const p = page(node("box", { type: "container" }), node("a", { parentId: "box", layout: { widthMode: "measured", left: 0, right: 0 } }));
  assert.equal(local(changeContainerType(p, "box", "hbox"), "a").width, 50);
});
test("UI enum validation rejects arrays and prototype property names without throwing", () => {
  const doc = { ...createDefaultGameFlowDocument(), interactions: [] };
  for (const layout of [{ direction: ["horizontal"] }, { toString: true }]) assert.equal(validateGameFlowDocument({ ...doc, pages: [page(node("a", { layout: layout as never }))] }).ok, false);
});
