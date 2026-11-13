import assert from "node:assert/strict";
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
import { psdTests } from "./psd-suite";

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

test("new documents use unique Laya-style page and node IDs with intact references", () => {
  const document = createDefaultGameFlowDocument();
  const ids = document.pages.flatMap((page) => [page.id, ...page.nodes.map((node) => node.id)]);
  assert.ok(ids.every((id) => /^[a-z][a-z0-9]{7}$/.test(id)));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(validateGameFlowDocument(document).ok, true);
  assert.equal(document.pages[1].nodes[1].parentId, document.pages[1].nodes[0].id);
  assert.equal(document.interactions[0].fromPageId, document.pages[0].id);
  assert.equal(document.interactions[0].toPageId, document.pages[1].id);
});

test("short ID allocation reserves all pages and each new ID, with bounded collision retries", () => {
  const document = createDefaultGameFlowDocument();
  const reserved = new Set<string>();
  reserveDocumentElementIds(document, reserved);
  const candidates = [document.pages[2].id, document.pages[0].nodes[0].id, "aaaaaaaa", "bbbbbbbb"];
  // Reserve a known value as well, independently of random document IDs.
  reserved.add("aaaaaaaa"); reserved.delete("bbbbbbbb");
  assert.equal(allocateElementId(reserved, () => candidates.shift()!), "bbbbbbbb");
  assert.ok(reserved.has("bbbbbbbb"));
  let attempts = 0;
  assert.throws(() => allocateElementId(reserved, () => { attempts++; return "bbbbbbbb"; }), /128 attempts/);
  assert.equal(attempts, 128);
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

test("copies get new short IDs while existing identities survive editing and serialization", () => {
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
  assert.ok(generatedIds.every((id) => /^[a-z][a-z0-9]{7}$/.test(id)));
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
