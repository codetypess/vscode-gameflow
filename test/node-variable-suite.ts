import assert from "node:assert/strict";
import type { GameFlowDocument, GameFlowPage } from "../shared/model";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument } from "../shared/model";
import { isWebviewToHostMessage, type WebviewToHostMessage } from "../shared/protocol";
import { duplicateNode, duplicatePage } from "../shared/editor-ops";
import { copyNode, pasteNode } from "../shared/node-clipboard";
import { convertNodeType } from "../shared/ui-edit";
import { migrateDocumentElementIds } from "../shared/document-id-migration";
import { nodeVariableNameError, variableNameError, VARIABLE_NAME_PATTERN, VARIABLE_RESERVED_WORDS } from "../shared/node-variable";
import { DocumentSession } from "../webview/document-session";
import schema from "../schemas/gameflow.schema.json";

export const nodeVariableTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => nodeVariableTests.push({ name, run });
const frame = { x: 10, y: 20, width: 200, height: 60 };
const fixture = (): GameFlowDocument => ({ ...createDefaultGameFlowDocument(), interactions: [], pages: [{
  id: "page0001", name: "页面", kind: "screen", frame, nodes: [
    { id: "root0001", name: "底栏", type: "container", frame, variableName: "bottomBar" },
    { id: "text0001", name: "标题", type: "text", parentId: "root0001", frame, variableName: "caption" }
  ]
}] });

test("node variables use legal portable bindings and agree with JSON Schema including reserved words", () => {
  assert.equal(schema.$defs.variableName.pattern, VARIABLE_NAME_PATTERN);
  assert.deepEqual(schema.$defs.variableName.not.enum, [...VARIABLE_RESERVED_WORDS]);
  const pattern = new RegExp(schema.$defs.variableName.pattern);
  for (const name of ["bottomBar", "_", "$", "$button1", "UI2", "type", "constructor", "__proto__"]) {
    assert.equal(variableNameError(name), null, name); assert.ok(pattern.test(name));
  }
  for (const name of ["", "9abc", "a-b", "a b", "a.b", "name\n", "name\r\n", "名称", "foo\\u0030", ...VARIABLE_RESERVED_WORDS]) {
    assert.ok(variableNameError(name), name);
    assert.ok(!pattern.test(name) || schema.$defs.variableName.not.enum.some((word) => word === name));
  }
  for (const name of [null, {}, [], 42, false]) assert.ok(variableNameError(name));
});

test("variables round-trip independently of display names and optional legacy fields remain absent", () => {
  const source = fixture();
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(source)), source);
  assert.ok(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: source }));
  const legacy = { ...source, schemaVersion: 1 as const, pages: source.pages.map((page) => ({ ...page, nodes: page.nodes.map(({ variableName: _, ...node }) => node) })) };
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(legacy)), legacy);
  assert.ok(legacy.pages[0].nodes.every((node) => !Object.hasOwn(node, "variableName")));
});

test("invalid variables and same-page conflicts are rejected at codec and edit boundaries", () => {
  for (const variableName of ["", "1bar", "class", "has space", "foo\n", null, 7, {}]) {
    const source = fixture();
    (source.pages[0].nodes[0] as unknown as Record<string, unknown>).variableName = variableName;
    const result = validateGameFlowDocument(source);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.some((error) => error.includes("pages[0].nodes[0].variableName")));
    assert.throws(() => serializeGameFlowDocument(source));
    assert.throws(() => parseGameFlowDocument(JSON.stringify(source)));
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: source }), false);
  }
  const source = fixture();
  source.pages[0].nodes[1].variableName = "bottomBar";
  const result = validateGameFlowDocument(source);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((error) => error.includes("nodes[1].variableName") && error.includes("nodes[0].variableName")));
  assert.ok(nodeVariableNameError(source.pages[0], "text0001", "bottomBar"));
  assert.equal(nodeVariableNameError(source.pages[0], "root0001", "bottomBar"), "当前页面已有同名变量");
  source.pages[0].nodes[1].variableName = "BottomBar";
  assert.equal(validateGameFlowDocument(source).ok, true);
  assert.equal(nodeVariableNameError(source.pages[0], "root0001", "bottomBar"), null);
  assert.equal(nodeVariableNameError(source.pages[0], "root0001", ""), null);
  assert.equal(validateGameFlowDocument({ ...source, schemaVersion: 1 }).ok, false);
});

test("variable identity survives display rename, conversion, page copy and element ID migration", () => {
  const source = fixture(), page = source.pages[0];
  page.nodes[0].name = "新的中文名称";
  const converted = convertNodeType(page, "root0001", "hbox");
  assert.equal(converted.nodes[0].variableName, "bottomBar"); assert.equal(converted.nodes[0].id, "root0001");
  let serial = 0;
  const copiedPage = duplicatePage(page, () => `copy${++serial}`);
  assert.deepEqual(copiedPage.nodes.map((node) => node.variableName), ["bottomBar", "caption"]);
  assert.equal(validateGameFlowDocument({ ...source, pages: [page, copiedPage] }).ok, true);
  delete source.elementIdScheme;
  const migrated = migrateDocumentElementIds(source);
  assert.notEqual(migrated.pages[0].nodes[0].id, "root0001");
  assert.equal(migrated.pages[0].nodes[0].variableName, "bottomBar");
  assert.equal(migrated.pages[0].nodes[0].name, "新的中文名称");
});

test("duplicate and paste allocate available subtree variables without changing the original snapshot", () => {
  const source = fixture(), page = source.pages[0];
  page.nodes.push({ id: "spare001", name: "其他", type: "text", frame, variableName: "bottomBar2" });
  const before = structuredClone(page), snapshot = copyNode(page, "root0001")!;
  let serial = 0;
  const copied = duplicateNode(page, "root0001", () => `copy${++serial}`);
  assert.equal(copied.page.nodes.find((node) => node.id === copied.id)!.variableName, "bottomBar3");
  assert.equal(copied.page.nodes.find((node) => node.parentId === copied.id)!.variableName, "caption2");
  const pasted = pasteNode(copied.page, snapshot, () => `copy${++serial}`);
  assert.equal(pasted.page.nodes.find((node) => node.id === pasted.id)!.variableName, "bottomBar4");
  assert.equal(pasted.page.nodes.find((node) => node.parentId === pasted.id)!.variableName, "caption3");
  assert.equal(validateGameFlowDocument({ ...source, pages: [pasted.page] }).ok, true);
  const other: GameFlowPage = { ...page, id: "other001", nodes: [] };
  const across = pasteNode(other, snapshot, () => `copy${++serial}`);
  assert.deepEqual(across.page.nodes.map((node) => node.variableName), ["bottomBar", "caption"]);
  assert.equal(validateGameFlowDocument({ ...source, pages: [page, across.page] }).ok, true);
  assert.deepEqual(page, before); assert.equal(snapshot.nodes[0].variableName, "bottomBar");
});

test("adding a variable upgrades v1 in one undoable edit and clearing removes the serialized field", () => {
  const original = fixture();
  original.schemaVersion = 1;
  for (const node of original.pages[0].nodes) delete node.variableName;
  const messages: WebviewToHostMessage[] = [];
  const session = new DocumentSession((message) => messages.push(message), () => {});
  session.receive({ type: "init", document: original, documentVersion: 1, resourceName: "test", dirty: false });
  session.edit((document) => ({ ...document, pages: document.pages.map((page) => ({ ...page, nodes: page.nodes.map((node, i) => i === 0 ? { ...node, variableName: "bottomBar" } : node) })) }));
  const changed = session.state.document!;
  assert.equal(changed.schemaVersion, 2); assert.equal(changed.pages[0].nodes[0].variableName, "bottomBar");
  assert.equal(changed.pages[0].nodes[0].id, "root0001"); assert.equal(changed.pages[0].nodes[0].name, "底栏");
  assert.equal(messages.length, 1); assert.ok(isWebviewToHostMessage(messages[0]));
  session.receive({ type: "documentChanged", document: changed, documentVersion: 2, dirty: true });
  session.command("undo");
  session.receive({ type: "documentChanged", document: original, documentVersion: 3, dirty: false });
  session.receive({ type: "commandCompleted", action: "undo" });
  assert.deepEqual(session.state.document, original);
  session.command("redo");
  session.receive({ type: "documentChanged", document: changed, documentVersion: 4, dirty: true });
  session.receive({ type: "commandCompleted", action: "redo" });
  assert.deepEqual(session.state.document, changed);
  session.edit((document) => ({ ...document, pages: document.pages.map((page) => ({ ...page, nodes: page.nodes.map((node) => ({ ...node, variableName: undefined })) })) }));
  assert.equal(serializeGameFlowDocument(session.state.document!).includes("variableName"), false);
});
