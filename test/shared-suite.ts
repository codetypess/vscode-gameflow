import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GameFlowValidationError,
  createDefaultGameFlowDocument,
  parseGameFlowDocument,
  serializeGameFlowDocument,
  validateGameFlowDocument
} from "../shared/model";
import { isWebviewToHostMessage } from "../shared/protocol";
import { absoluteFrame, duplicateNode, duplicatePage, inheritedFlag, insertNode, makeNode, moveNode, removeNode, removePage, reparentNode, resizeFrame } from "../shared/editor-ops";
import type { GameFlowDocument, GameFlowPage } from "../shared/model";
import type { WebviewToHostMessage } from "../shared/protocol";
import { DocumentSession } from "../webview/document-session";
import { allocateElementId, reserveDocumentElementIds } from "../shared/element-id";
import { migrateDocumentElementIds } from "../shared/document-id-migration";
import { psdTests } from "./psd-suite";
import { uiLayoutTests } from "./ui-layout-suite";
import { nodeVariableTests } from "./node-variable-suite";

type TestCase = { name: string; run: () => void | Promise<void> };
const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

test("default document is valid and includes the sample flow", () => {
  const document = createDefaultGameFlowDocument();
  const result = validateGameFlowDocument(document);
  assert.equal(result.ok, true);
  assert.deepEqual(
    document.pages.map((page) => page.name),
    ["主菜单", "背包", "道具详情"]
  );
  assert.equal(document.interactions.length, 2);
});

test("serialization round-trips a valid document", () => {
  const document = createDefaultGameFlowDocument("round-trip");
  const source = serializeGameFlowDocument(document);
  assert.ok(source.endsWith("\n"));
  assert.deepEqual(parseGameFlowDocument(source), document);
});

test("new documents use unique Nano IDs for pages and nodes with intact references", () => {
  const document = createDefaultGameFlowDocument();
  const ids = document.pages.flatMap((page) => [page.id, ...page.nodes.map((node) => node.id)]);
  assert.ok(ids.every((id) => /^[a-z0-9]{8}$/.test(id)));
  assert.equal(document.elementIdScheme, "nanoid-8");
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(validateGameFlowDocument(document).ok, true);
  assert.equal(document.pages[1].nodes[1].parentId, document.pages[1].nodes[0].id);
  assert.equal(document.interactions[0].fromPageId, document.pages[0].id);
  assert.equal(document.interactions[0].toPageId, document.pages[1].id);
});

test("Nano ID allocation reserves all pages and each new ID, with bounded collision retries", () => {
  const document = createDefaultGameFlowDocument();
  const reserved = new Set<string>();
  reserveDocumentElementIds(document, reserved);
  const occupied = "aaaaaaaa", available = "0123abcd";
  const candidates = [document.pages[2].id, document.pages[0].nodes[0].id, occupied, available];
  // Reserve a known value as well, independently of random document IDs.
  reserved.add(occupied); reserved.delete(available);
  assert.equal(allocateElementId(reserved, () => candidates.shift()!), available);
  assert.ok(reserved.has(available));
  let attempts = 0;
  assert.throws(() => allocateElementId(reserved, () => { attempts++; return available; }), /128 attempts/);
  assert.equal(attempts, 128);
  for (const invalid of ["A0000003", "a".repeat(7), "a".repeat(9), "a_-aaaaa", "/".repeat(8)]) {
    assert.throws(() => allocateElementId(reserved, () => invalid), /8-character lowercase alphanumeric Nano ID/);
    assert.ok(!reserved.has(invalid));
  }
});

function identityDocument(): GameFlowDocument {
  return {
    schemaVersion: 2, documentId: "identity-check", title: "Identity check", requirements: [], interactions: [],
    pages: ["first", "second"].map(name => ({
      id: `page-${name}`, name: "同名页面", kind: "screen", frame: { x: 0, y: 0, width: 300, height: 200 },
      nodes: [{ id: `node-${name}`, name: "同名控件", type: "text", frame: { x: 10, y: 20, width: 50, height: 30 } }]
    }))
  };
}

test("page and node IDs share one document-wide identity space in v1 and v2", () => {
  const cases: { name: string; change: (d: GameFlowDocument) => void; paths: string[] }[] = [
    { name: "cross-page node", change: d => { d.pages[1].nodes[0].id = d.pages[0].nodes[0].id; }, paths: ["pages[0].nodes[0].id", "pages[1].nodes[0].id"] },
    { name: "node and its root", change: d => { d.pages[0].nodes[0].id = d.pages[0].id; }, paths: ["pages[0].id", "pages[0].nodes[0].id"] },
    { name: "node and later root", change: d => { d.pages[1].id = d.pages[0].nodes[0].id; }, paths: ["pages[0].nodes[0].id", "pages[1].id"] },
    { name: "root and later node", change: d => { d.pages[1].nodes[0].id = d.pages[0].id; }, paths: ["pages[0].id", "pages[1].nodes[0].id"] },
    { name: "duplicate roots", change: d => { d.pages[1].id = d.pages[0].id; }, paths: ["pages[0].id", "pages[1].id"] },
    { name: "duplicate siblings", change: d => { d.pages[0].nodes.push(structuredClone(d.pages[0].nodes[0])); }, paths: ["pages[0].nodes[0].id", "pages[0].nodes[1].id"] }
  ];
  for (const schemaVersion of [1, 2] as const) for (const scenario of cases) {
    const doc = { ...identityDocument(), schemaVersion };
    scenario.change(doc);
    const before = JSON.stringify(doc), result = validateGameFlowDocument(doc);
    assert.equal(result.ok, false, `${scenario.name} must be rejected in v${schemaVersion}`);
    if (!result.ok) assert.ok(result.errors.some(error => scenario.paths.every(path => error.includes(path))), `${scenario.name} must identify both conflicting paths`);
    assert.equal(JSON.stringify(doc), before, "validation must not silently renumber identities");
  }
});

test("ambiguous element identities cannot cross parsing, serialization or edit-message boundaries", () => {
  const doc = identityDocument(); doc.pages[1].nodes[0].id = doc.pages[0].nodes[0].id;
  const source = JSON.stringify(doc);
  assert.throws(() => parseGameFlowDocument(source), GameFlowValidationError);
  assert.throws(() => serializeGameFlowDocument(doc), GameFlowValidationError);
  assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: doc }), false);
  assert.equal(JSON.stringify(doc), source);
});

test("unique legacy IDs and duplicate display names round-trip without identity normalization", () => {
  for (const schemaVersion of [1, 2] as const) {
    const doc = { ...identityDocument(), schemaVersion };
    doc.pages[0].nodes[0].id = "a56b983a-34ae-4d75-abbd-99af17b39204";
    const restored = parseGameFlowDocument(serializeGameFlowDocument(doc));
    assert.deepEqual(restored, doc);
    assert.ok(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: restored }));
  }
});

test("checked-in samples retain valid unique element identities", () => {
  for (const name of ["backpack", "ui-components"]) {
    const source = readFileSync(`sample/${name}.gameflow.json`, "utf8");
    const document = parseGameFlowDocument(source);
    assert.equal(document.elementIdScheme, "nanoid-8");
    assert.ok(document.pages.flatMap(page => [page.id, ...page.nodes.map(node => node.id)]).every(id => /^[a-z0-9]{8}$/.test(id)));
    assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(document)), JSON.parse(source));
  }
});

test("legacy prototype IDs migrate atomically with parent and navigation references in v1/v2", () => {
  for (const schemaVersion of [1, 2] as const) {
    const document = { ...identityDocument(), schemaVersion };
    document.pages[0].id = "u0000001";
    document.pages[0].nodes = [
      { id: "u0000002", name: "容器", type: "container", frame: { x: 10, y: 20, width: 100, height: 100 } },
      { id: "legacy-long-node-id", name: "文字", type: "text", frame: { x: 30, y: 40, width: 50, height: 20 }, parentId: "u0000002", text: "u0000002" }
    ];
    document.interactions = [{ id: "navigation", fromPageId: "u0000001", toPageId: document.pages[1].id, trigger: "click" }];
    const original = structuredClone(document);
    const ids = ["u0000001", "0aaaaaaa", "0aaaaaaa", "bbbbbbbb", "cccccccc", "dddddddd", "eeeeeeee"];
    const migrated = migrateDocumentElementIds(document, () => ids.shift()!);
    const expected: GameFlowDocument = { ...structuredClone(original), elementIdScheme: "nanoid-8" };
    expected.pages[0].id = "0aaaaaaa";
    expected.pages[0].nodes[0].id = "bbbbbbbb";
    expected.pages[0].nodes[1].id = "cccccccc";
    expected.pages[0].nodes[1].parentId = "bbbbbbbb";
    expected.pages[1].id = "dddddddd";
    expected.pages[1].nodes[0].id = "eeeeeeee";
    expected.interactions[0].fromPageId = "0aaaaaaa";
    expected.interactions[0].toPageId = "dddddddd";
    assert.deepEqual(document, original, "migration must not mutate its input");
    assert.deepEqual(migrated, expected, "only element IDs and modeled references change");
    assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(migrated)), expected);
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: migrated }), true);
    assert.equal(migrateDocumentElementIds(migrated, () => { throw new Error("must not reallocate"); }), migrated);
    assert.equal(ids.length, 0);
  }
});

test("identity migration rejects ambiguous documents and unsupported schemes before allocation", () => {
  const duplicate = identityDocument();
  duplicate.pages[1].nodes[0].id = duplicate.pages[0].nodes[0].id;
  for (const document of [duplicate, { ...identityDocument(), elementIdScheme: "future" } as unknown as GameFlowDocument]) {
    const original = structuredClone(document);
    let allocations = 0;
    assert.throws(() => migrateDocumentElementIds(document, () => { allocations++; return "aaaaaaaa"; }), GameFlowValidationError);
    assert.equal(allocations, 0);
    assert.deepEqual(document, original);
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document }), false);
  }
});

test("invalid JSON and invalid schema are rejected", () => {
  assert.throws(() => parseGameFlowDocument("{"), GameFlowValidationError);

  const document = createDefaultGameFlowDocument();
  const invalid = { ...document, schemaVersion: 99 };
  const result = validateGameFlowDocument(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.includes("schemaVersion")));
  }
});

test("dangling page and parent references are rejected", () => {
  const document = createDefaultGameFlowDocument();
  const invalid = structuredClone(document);
  invalid.interactions[0].toPageId = "missing-page";
  invalid.pages[0].nodes[0].parentId = "missing-parent";

  const result = validateGameFlowDocument(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.includes("target page")));
    assert.ok(result.errors.some((error) => error.includes("missing parent")));
  }
});

test("rectangle nodes are valid and unknown node types are rejected", () => {
  const document = createDefaultGameFlowDocument();
  document.pages[0].nodes.push({
    id: "node-rectangle",
    name: "矩形",
    type: "rectangle",
    frame: { x: 20, y: 70, width: 120, height: 60 }
  });
  assert.equal(validateGameFlowDocument(document).ok, true);

  const invalid = structuredClone(document) as unknown as {
    pages: Array<{ nodes: Array<{ type: unknown }> }>;
  };
  invalid.pages[0].nodes[0].type = "triangle";
  assert.equal(validateGameFlowDocument(invalid).ok, false);
});

test("protocol guard accepts only validated edit messages", () => {
  const document = createDefaultGameFlowDocument();
  assert.equal(isWebviewToHostMessage({ type: "ready" }), true);
  assert.equal(
    isWebviewToHostMessage({
      type: "replaceDocument",
      baseVersion: 3,
      document
    }),
    true
  );
  assert.equal(
    isWebviewToHostMessage({
      type: "replaceDocument",
      baseVersion: "3",
      document
    }),
    false
  );
  assert.equal(isWebviewToHostMessage({ type: "runCommand", command: "rm" }), false);
});

function nestedPage(): GameFlowPage {
  return { id: "page", name: "Nested", kind: "screen", frame: { x: 400, y: 500, width: 600, height: 400 }, nodes: [
    { ...makeNode("container", "a", 0, 0), frame: { x: 50, y: 60, width: 300, height: 200 } },
    { ...makeNode("container", "b", 0, 0), parentId: "a", frame: { x: 10, y: 20, width: 100, height: 80 } },
    { ...makeNode("text", "c", 0, 0), parentId: "b", frame: { x: 5, y: 8, width: 60, height: 24 } },
    { ...makeNode("rectangle", "d", 0, 0), frame: { x: 380, y: 100, width: 180, height: 180 } }
  ] };
}

test("copies get new Nano IDs while existing identities survive editing and serialization", () => {
  const document = createDefaultGameFlowDocument();
  const source = nestedPage();
  source.nodes[2].id = "a56b983a-34ae-4d75-abbd-99af17b39204";
  const originalIds = source.nodes.map((node) => node.id);
  document.pages.push(source);
  const reserved = new Set<string>();
  reserveDocumentElementIds(document, reserved);
  const makeId = () => allocateElementId(reserved);
  const copied = duplicateNode(source, "b", makeId);
  const pageCopy = duplicatePage(source, makeId);
  const newNodes = copied.page.nodes.slice(source.nodes.length);
  const generatedIds = [...newNodes.map((node) => node.id), pageCopy.id, ...pageCopy.nodes.map((node) => node.id)];
  assert.ok(generatedIds.every((id) => /^[a-z0-9]{8}$/.test(id)));
  assert.equal(new Set(generatedIds).size, generatedIds.length);
  assert.ok(generatedIds.every((id) => !originalIds.includes(id)));
  assert.equal(newNodes[1].parentId, newNodes[0].id);
  assert.equal(pageCopy.nodes[2].parentId, pageCopy.nodes[1].id);
  const moved = reparentNode(source, source.nodes[2].id, "d");
  moved.nodes[2] = { ...moved.nodes[2], name: "改名后的文字", text: "新的文字" };
  document.pages[document.pages.length - 1] = moved;
  const restored = parseGameFlowDocument(serializeGameFlowDocument(document));
  assert.deepEqual(restored.pages.at(-1)!.nodes.map((node) => node.id), originalIds);
  assert.equal(restored.pages.at(-1)!.nodes[2].parentId, "d");
});

test("consecutive subtree and page copies skip collisions and retain reservations after undo", () => {
  const document = identityDocument();
  const source = document.pages[0];
  source.id = "page0001";
  source.nodes = [
    makeNode("container", "node0001", 0, 0),
    { ...makeNode("text", "node0002", 0, 0), parentId: "node0001" }
  ];
  document.pages[1].id = "page0002";
  document.pages[1].nodes[0].id = "node0003";
  const original = structuredClone(document);
  const reserved = new Set<string>();
  reserveDocumentElementIds(document, reserved);
  const candidates = [
    "page0002", "node0003", "aaaaaaaa", "aaaaaaaa", "bbbbbbbb",
    "bbbbbbbb", "cccccccc", "dddddddd", "eeeeeeee",
    "aaaaaaaa", "eeeeeeee", "ffffffff", "gggggggg"
  ];
  const makeId = () => allocateElementId(reserved, () => candidates.shift()!);
  const subtreeCopy = duplicateNode(source, "node0001", makeId);
  const pageCopy = duplicatePage(source, makeId);
  document.pages[0] = subtreeCopy.page;
  document.pages.push(pageCopy);
  assert.equal(validateGameFlowDocument(document).ok, true);
  assert.equal(subtreeCopy.id, "aaaaaaaa");
  assert.equal(subtreeCopy.page.nodes.at(-1)!.parentId, subtreeCopy.id);
  assert.equal(pageCopy.nodes[1].parentId, pageCopy.nodes[0].id);
  assert.deepEqual(source, original.pages[0]);

  // Restoring the pre-copy document does not clear the editor session's reservations.
  const restored = structuredClone(original);
  reserveDocumentElementIds(restored, reserved);
  const afterUndo = duplicateNode(restored.pages[0], "node0001", makeId);
  restored.pages[0] = afterUndo.page;
  assert.equal(afterUndo.id, "ffffffff");
  assert.equal(afterUndo.page.nodes.at(-1)!.parentId, afterUndo.id);
  assert.equal(validateGameFlowDocument(restored).ok, true);
  assert.equal(candidates.length, 0);
});

test("nested coordinates and inherited flags follow ancestors, independently of page position", () => {
  const page = nestedPage();
  assert.deepEqual(absoluteFrame(page, page.nodes[2]), { x: 65, y: 88, width: 60, height: 24 });
  page.nodes[0].frame.x += 30;
  assert.equal(absoluteFrame(page, page.nodes[2]).x, 95);
  page.nodes[0].hidden = true; page.nodes[0].locked = true;
  assert.equal(inheritedFlag(page, page.nodes[2], "hidden"), true);
  assert.equal(inheritedFlag(page, page.nodes[2], "locked"), true);
  assert.equal(inheritedFlag(page, page.nodes[3], "locked"), false);
});

test("reparent preserves visual position and rejects cycles, missing and non-container parents", () => {
  const page = nestedPage();
  const before = absoluteFrame(page, page.nodes[2]);
  const moved = reparentNode(page, "c", "d");
  assert.deepEqual(absoluteFrame(moved, moved.nodes[2]), before);
  assert.equal(moved.nodes[2].parentId, "d");
  const root = reparentNode(moved, "c");
  assert.equal(root.nodes[2].parentId, undefined);
  assert.deepEqual(root.nodes[2].frame, before);
  assert.equal(reparentNode(page, "a", "b"), page);
  assert.equal(reparentNode(page, "a", "c"), page);
  assert.equal(reparentNode(page, "b", "missing"), page);
  assert.equal(reparentNode(page, "d", "c"), page);
});

test("subtree duplicate remaps parents and offsets only the root; delete removes the whole subtree", () => {
  const page = nestedPage(); let serial = 0;
  const result = duplicateNode(page, "b", () => `copy-${++serial}`);
  const copies = result.page.nodes.filter((node) => node.id.startsWith("copy-"));
  assert.equal(copies.length, 2);
  assert.equal(copies[0].id, result.id);
  assert.equal(copies[0].parentId, "a");
  assert.equal(copies[0].frame.x, page.nodes[1].frame.x + 16);
  assert.equal(copies[1].parentId, copies[0].id);
  assert.deepEqual(copies[1].frame, page.nodes[2].frame);
  const removed = removeNode(result.page, "a");
  assert.deepEqual(removed.nodes.map((node) => node.id), ["d"]);
  assert.equal(page.nodes.length, 4);
});

test("page copy uses fresh IDs and deletion cleans related navigation links", () => {
  const document = createDefaultGameFlowDocument(); let serial = 0;
  const page = nestedPage();
  const copy = duplicatePage(page, () => `new-${++serial}`);
  assert.notEqual(copy.id, page.id);
  assert.equal(copy.nodes[2].parentId, copy.nodes[1].id);
  assert.ok(copy.nodes.every((node) => !page.nodes.some((source) => source.id === node.id)));
  const id = document.pages[1].id;
  const next = removePage(document, id);
  assert.ok(!next.pages.some((entry) => entry.id === id));
  assert.ok(!next.interactions.some((edge) => edge.fromPageId === id || edge.toPageId === id));
});

test("resize keeps opposite edges fixed and clamps at a positive minimum", () => {
  const frame = { x: 50, y: 70, width: 100, height: 80 };
  assert.deepEqual(resizeFrame(frame, "nw", 200, 200), { x: 142, y: 142, width: 8, height: 8 });
  assert.deepEqual(resizeFrame(frame, "se", 20, 30), { x: 50, y: 70, width: 120, height: 110 });
  assert.deepEqual(resizeFrame(frame, "w", -10, 100), { x: 40, y: 70, width: 110, height: 80 });
});

test("control appearance and raster images validate while malformed style and hierarchy are rejected", () => {
  const document = createDefaultGameFlowDocument();
  const node = makeNode("text", "transparent-text", 10, 10);
  assert.equal(node.style?.fill, "transparent"); assert.equal(node.style?.borderWidth, 0);
  document.pages[0].nodes.push(node);
  const image = makeNode("image", "raster", 20, 20);
  image.imageData = "data:image/png;base64,aGVsbG8=";
  document.pages[0].nodes.push(image);
  assert.equal(validateGameFlowDocument(document).ok, true);
  node.style!.opacity = 2;
  assert.equal(validateGameFlowDocument(document).ok, false);
  node.style!.opacity = 1; image.imageData = "data:image/svg+xml;base64,PHN2Zz4=";
  assert.equal(validateGameFlowDocument(document).ok, false);
  delete image.imageData; node.parentId = image.id;
  assert.equal(validateGameFlowDocument(document).ok, false);
  const page = nestedPage(); page.nodes[0].parentId = "b";
  document.pages = [page]; document.interactions = [];
  assert.equal(validateGameFlowDocument(document).ok, false);
});

test("layer insertion adds local children or adjacent siblings and rejects locked or invalid parents", () => {
  const page = nestedPage();
  const node = makeNode("button", "new", 50, 40);
  const child = insertNode(page, node, "b");
  assert.equal(child.nodes.at(-1)?.parentId, "b");
  assert.deepEqual(child.nodes.at(-1)?.frame, node.frame);
  const sibling = insertNode(page, node, "a", "b");
  assert.deepEqual(sibling.nodes.map((entry) => entry.id), ["a", "b", "c", "new", "d"]);
  assert.equal(sibling.nodes[3].parentId, "a");
  assert.equal(page.nodes.length, 4);
  assert.equal(insertNode(page, node, "c"), page);
  assert.equal(insertNode(page, node, "missing"), page);
  assert.equal(insertNode(page, node, "b", "d"), page);
  assert.equal(insertNode(child, node), child);
  page.nodes[0].locked = true;
  assert.equal(insertNode(page, node, "b"), page);
});

test("layer drag sorts whole subtrees before or after siblings without changing coordinates", () => {
  const page = nestedPage();
  const after = moveNode(page, "a", { targetId: "d", position: "after" });
  assert.deepEqual(after.nodes.map((node) => node.id), ["d", "a", "b", "c"]);
  assert.deepEqual(after.nodes.find((node) => node.id === "c")?.frame, page.nodes[2].frame);
  const before = moveNode(after, "a", { targetId: "d", position: "before" });
  assert.deepEqual(before, page);
  assert.equal(moveNode(page, "a", { targetId: "d", position: "before" }), page);
  assert.deepEqual(page.nodes.map((node) => node.id), ["a", "b", "c", "d"]);
});

test("layer drag into or out of containers preserves all descendant page-space positions", () => {
  const page = nestedPage();
  const before = new Map(page.nodes.map((node) => [node.id, absoluteFrame(page, node)]));
  const moved = moveNode(page, "b", { targetId: "d", position: "inside" });
  assert.equal(moved.nodes.find((node) => node.id === "b")?.parentId, "d");
  for (const node of moved.nodes) assert.deepEqual(absoluteFrame(moved, node), before.get(node.id));
  const root = moveNode(moved, "b", { position: "inside" });
  assert.equal(root.nodes.find((node) => node.id === "b")?.parentId, undefined);
  assert.deepEqual(root.nodes.filter((node) => !node.parentId).map((node) => node.id), ["a", "d", "b"]);
  assert.equal(root.nodes.find((node) => node.id === "c")?.parentId, "b");
  for (const node of root.nodes) assert.deepEqual(absoluteFrame(root, node), before.get(node.id));
});

test("layer drag rejects self, descendants, invalid destinations and inherited locks", () => {
  const page = nestedPage();
  assert.equal(moveNode(page, "a", { targetId: "a", position: "before" }), page);
  assert.equal(moveNode(page, "a", { targetId: "b", position: "inside" }), page);
  assert.equal(moveNode(page, "b", { targetId: "c", position: "after" }), page);
  assert.equal(moveNode(page, "d", { targetId: "c", position: "inside" }), page);
  assert.equal(moveNode(page, "b", { targetId: "missing", position: "inside" }), page);
  page.nodes[0].locked = true;
  assert.equal(moveNode(page, "c", { targetId: "d", position: "before" }), page);
  assert.equal(moveNode(page, "d", { targetId: "b", position: "inside" }), page);
  assert.equal(moveNode(page, "d", { targetId: "c", position: "before" }), page);
});

test("layer drag respects semantic sibling order even in interleaved persisted arrays", () => {
  const page = nestedPage();
  page.nodes = [page.nodes[0], page.nodes[3], page.nodes[1], page.nodes[2]];
  assert.equal(moveNode(page, "a", { targetId: "d", position: "before" }), page);
  const moved = moveNode(page, "b", { targetId: "a", position: "after" });
  assert.deepEqual(moved.nodes.filter((node) => !node.parentId).map((node) => node.id), ["a", "b", "d"]);
  assert.equal(moved.nodes.find((node) => node.id === "c")?.parentId, "b");
  assert.deepEqual(absoluteFrame(moved, moved.nodes.find((node) => node.id === "c")!), absoluteFrame(page, page.nodes[3]));
  const fresh = makeNode("text", "new", 0, 0);
  const inserted = insertNode(page, fresh, undefined, "a");
  assert.deepEqual(inserted.nodes.filter((node) => !node.parentId).map((node) => node.id), ["a", "new", "d"]);
  const extra = insertNode(page, fresh);
  const after = moveNode(extra, "new", { targetId: "a", position: "after" });
  assert.deepEqual(after.nodes.filter((node) => !node.parentId).map((node) => node.id), ["a", "new", "d"]);
});

test("history protocol allows fixed undo/redo and save only", () => {
  assert.equal(isWebviewToHostMessage({ type: "history", action: "undo" }), true);
  assert.equal(isWebviewToHostMessage({ type: "history", action: "redo" }), true);
  assert.equal(isWebviewToHostMessage({ type: "save" }), true);
  assert.equal(isWebviewToHostMessage({ type: "history", action: "workbench.action.files.openFile" }), false);
});

function sessionFixture() {
  const sent: WebviewToHostMessage[] = [];
  const session = new DocumentSession((message) => sent.push(message), () => {});
  const document = createDefaultGameFlowDocument();
  session.receive({ type: "init", document, documentVersion: 3, resourceName: "test", dirty: false });
  const snapshot = (document: GameFlowDocument, version: number, dirty = true) => session.receive({ type: "documentChanged", document, documentVersion: version, dirty });
  return { session, sent, document, snapshot };
}

test("editor initialization migrates legacy IDs once in a save-ordered, undoable transaction", () => {
  const sent: WebviewToHostMessage[] = [];
  const session = new DocumentSession(message => sent.push(message), () => {});
  const document = { ...identityDocument(), schemaVersion: 1 as const };
  session.receive({ type: "init", document, documentVersion: 1, resourceName: "legacy", dirty: false });
  assert.equal(sent.length, 1);
  const migration = sent[0];
  assert.equal(migration.type, "replaceDocument");
  if (migration.type !== "replaceDocument") throw new Error("expected identity migration transaction");
  assert.equal(migration.baseVersion, 1);
  assert.equal(migration.document.schemaVersion, 2);
  assert.equal(validateGameFlowDocument(migration.document).ok, true);
  assert.equal(session.state.dirty, true);
  assert.equal(session.state.pending, true);
  session.command("save");
  assert.equal(sent.length, 1, "save must wait for migration acknowledgement");
  session.receive({ type: "documentChanged", document: migration.document, documentVersion: 2, dirty: true });
  assert.deepEqual(sent[1], { type: "save" });
  session.receive({ type: "documentChanged", document: migration.document, documentVersion: 2, dirty: false });
  session.receive({ type: "commandCompleted", action: "save" });
  assert.equal(session.state.pending, false);
  assert.equal(session.state.dirty, false);

  session.command("undo");
  session.receive({ type: "documentChanged", document, documentVersion: 3, dirty: true });
  session.receive({ type: "commandCompleted", action: "undo" });
  session.receive({ type: "init", document, documentVersion: 3, resourceName: "legacy", dirty: true });
  assert.equal(sent.length, 3, "undo and repeated init must not automatically rekey again");
  assert.deepEqual(session.state.document, document);
  session.command("redo");
  session.receive({ type: "documentChanged", document: migration.document, documentVersion: 4, dirty: false });
  session.receive({ type: "commandCompleted", action: "redo" });
  assert.deepEqual(session.state.document, migration.document);

  const reloaded: WebviewToHostMessage[] = [];
  const reopened = new DocumentSession(message => reloaded.push(message), () => {});
  reopened.receive({ type: "init", document: migration.document, documentVersion: 1, resourceName: "saved", dirty: false });
  assert.equal(reloaded.length, 0, "reopening migrated content must not create a new transaction");
  assert.deepEqual(reopened.state.document, migration.document);
});

test("rapid edits wait for acknowledgement and preserve the newest candidate through duplicate snapshots", () => {
  const { session, sent, document, snapshot } = sessionFixture();
  session.edit((doc) => ({ ...doc, title: "A" }));
  session.edit((doc) => ({ ...doc, title: "B" }));
  session.edit((doc) => ({ ...doc, title: "C" }));
  assert.equal(sent.length, 1);
  snapshot({ ...document, title: "A" }, 4);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[1], { type: "replaceDocument", baseVersion: 4, document: { ...document, title: "C" } });
  snapshot({ ...document, title: "A" }, 4);
  assert.equal(session.state.document?.title, "C");
  assert.equal(session.state.pending, true);
  snapshot({ ...document, title: "C" }, 5);
  assert.equal(session.state.document?.title, "C");
  assert.equal(session.state.pending, false);
});

test("edits returning to the acknowledged content do not wait forever for a no-op transaction", () => {
  const { session, sent, document, snapshot } = sessionFixture();
  session.edit((doc) => ({ ...doc, title: "A" }));
  session.edit((doc) => ({ ...doc, title: "B" }));
  session.edit((doc) => ({ ...doc, title: "A" }));
  snapshot({ ...document, title: "A" }, 4);
  assert.equal(sent.length, 1);
  assert.equal(session.state.pending, false);
});

test("save waits for edits and history completes explicitly before subsequent edits replay", () => {
  const { session, sent, document, snapshot } = sessionFixture();
  session.edit((doc) => ({ ...doc, title: "A" }));
  session.command("save");
  assert.equal(sent.length, 1);
  snapshot({ ...document, title: "A" }, 4);
  assert.deepEqual(sent[1], { type: "save" });
  snapshot({ ...document, title: "A" }, 4, false);
  assert.equal(session.state.pending, true);
  session.receive({ type: "commandCompleted", action: "save" });
  assert.equal(session.state.pending, false);
  session.command("undo");
  session.edit((doc) => ({ ...doc, title: `${doc.title} after undo` }));
  snapshot(document, 5);
  assert.equal(sent.length, 3);
  session.receive({ type: "commandCompleted", action: "undo" });
  assert.equal(session.state.document?.title, `${document.title} after undo`);
  assert.equal(sent.length, 4);
  assert.equal((sent[3] as { baseVersion: number }).baseVersion, 5);
});

test("invalid source blocks editing and a rejected transaction reloads host authority", () => {
  const { session, sent, document } = sessionFixture();
  session.receive({ type: "documentError", message: "Invalid JSON", details: [] });
  session.edit((doc) => ({ ...doc, title: "must not overwrite damaged source" }));
  assert.equal(sent.length, 0); assert.equal(session.state.document, null);
  session.receive({ type: "init", document, documentVersion: 10, resourceName: "test", dirty: false });
  session.edit((doc) => ({ ...doc, title: "candidate" }));
  session.receive({ type: "updateRejected", currentVersion: 11, reason: "external change" });
  assert.deepEqual(sent.at(-1), { type: "ready" });
  session.receive({ type: "init", document: { ...document, title: "external" }, documentVersion: 11, resourceName: "test", dirty: true });
  assert.equal((session.state.document as GameFlowDocument | null)?.title, "external"); assert.equal(session.state.pending, false);
});

tests.push(...psdTests);
tests.push(...uiLayoutTests);
tests.push(...nodeVariableTests);
export const testsCompleted = (async () => {
  let failed = 0;
  for (const item of tests) {
    try {
      await item.run();
      console.log(`PASS ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${item.name}`);
      console.error(error);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log(`\n${tests.length} shared tests passed.`);
  }
})();
