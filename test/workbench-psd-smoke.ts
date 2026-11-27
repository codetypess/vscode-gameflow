import * as vscode from "vscode";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { GameFlowEditorProvider } from "../src/gameflow-editor-provider";
import type { PsdEditorProvider } from "../src/psd-editor-provider";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument } from "../shared/model";
import { makePsdDraft } from "../shared/psd-draft";

async function until(predicate: () => boolean, label: string) {
  const end = Date.now() + 20000;
  while (!predicate()) { if (Date.now() > end) throw new Error(`Timeout: ${label}`); await new Promise(resolve => setTimeout(resolve, 50)); }
}
export async function workbenchChecks(api: { workbench: GameFlowEditorProvider; psd: PsdEditorProvider }, root: string, directory: string): Promise<string[]> {
  const checks: string[] = [], cancellation = new vscode.CancellationTokenSource();
  const file = join(directory, "工作台.gameflow.json"), psdFile = join(directory, "工作台切图.psd"), meta = join(directory, "工作台切图.meta.json");
  const original = readFileSync(join(root, "examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd"));
  const canvasText = serializeGameFlowDocument(createDefaultGameFlowDocument("workbench-native"));
  writeFileSync(file, canvasText); writeFileSync(psdFile, original);
  const uri = vscode.Uri.file(file), psdUri = vscode.Uri.file(psdFile);
  const tab = () => vscode.window.tabGroups.all.flatMap(group => group.tabs).find(item => item.input instanceof vscode.TabInputCustom && item.input.uri.toString() === uri.toString());
  await vscode.commands.executeCommand("vscode.openWith", uri, "gameflow.canvasEditor", { preview: false });
  await until(() => !!api.workbench.documents.get(uri.toString())?.panels.size, "workbench initialization");
  let doc = api.workbench.documents.get(uri.toString())!;
  const tabsBefore = vscode.window.tabGroups.all.flatMap(group => group.tabs).length;
  const panel = [...doc.panels][0], sent: { type: string }[] = [];
  const originalPost = panel.webview.postMessage;
  panel.webview.postMessage = message => { sent.push(message); return originalPost.call(panel.webview, message); };
  await vscode.commands.executeCommand("gameflow.openPsd", psdUri);
  await until(() => !!doc.currentPsd?.announced, "embedded PSD initialization");
  assert.equal(vscode.window.tabGroups.all.flatMap(group => group.tabs).length, tabsBefore);
  assert.equal(vscode.window.tabGroups.all.flatMap(group => group.tabs).some(item => item.input instanceof vscode.TabInputCustom && item.input.uri.toString() === psdUri.toString()), false);
  await until(() => !!tab()?.isDirty, "embedded PSD marks workbench dirty");
  assert.equal(sent.filter(message => message.type === "psdEditorReveal").length, 1);
  assert.equal(doc.getText(), canvasText); assert.equal(readFileSync(file, "utf8"), canvasText);
  assert.equal(parseGameFlowDocument(doc.getText()).pages.some(page => page.artPsd), false);
  checks.push("PSD opens inside current workbench without a new tab", "PSD edits protect the native workbench tab", "opening unrelated PSD reveals slices without binding or saving the prototype");
  await vscode.commands.executeCommand("workbench.action.files.save");
  await until(() => existsSync(meta) && !tab()?.isDirty, "workbench saves embedded PSD");
  assert.equal(readFileSync(file, "utf8"), canvasText); assert.deepEqual(readFileSync(psdFile), original);
  checks.push("native workbench save writes sidecar without changing prototype or PSD");
  let psd = doc.currentPsd!;
  sent.length = 0; const loadedVersion = psd.model.version;
  await api.workbench.openPsd(doc, psdUri);
  assert.equal(sent.filter(message => message.type === "psdEditorReveal").length, 1);
  assert.equal(sent.some(message => message.type === "psdEditorInit"), false);
  assert.equal(psd.model.version, loadedVersion);
  sent.length = 0; await api.psd.initialize(psd, panel);
  assert.equal(sent.some(message => message.type === "psdEditorInit"), true);
  assert.equal(sent.some(message => message.type === "psdEditorReveal"), false);
  panel.webview.postMessage = originalPost;
  assert.equal(doc.getText(), canvasText); assert.equal(readFileSync(file, "utf8"), canvasText);
  checks.push("same PSD open only reveals while restoration initialization keeps workspace selection and prototype content");
  const saved = makePsdDraft(psd.model.asset), draft = structuredClone(saved); draft.layers[0].config.exportName = "embedded_saved";
  await api.psd.edit(psd, draft, psd.model.version);
  await until(() => !!tab()?.isDirty, "workbench edit dirty");
  await vscode.commands.executeCommand("undo"); await until(() => psd.model.asset.layers[0].config.exportName !== "embedded_saved", "workbench undo PSD");
  await vscode.commands.executeCommand("redo"); await until(() => psd.model.asset.layers[0].config.exportName === "embedded_saved", "workbench redo PSD");
  checks.push("embedded PSD uses native workbench undo and redo");
  const canvas = parseGameFlowDocument(doc.getText());
  await api.workbench.apply(doc, [{ document: doc, version: doc.version, text: serializeGameFlowDocument({ ...canvas, title: "统一工作台", exportDirectory: "ui/workbench" }) }]);
  await vscode.commands.executeCommand("undo"); await until(() => JSON.parse(doc.getText()).title === canvas.title, "workbench prototype undo");
  assert.equal(parseGameFlowDocument(doc.getText()).exportDirectory, undefined);
  await vscode.commands.executeCommand("redo"); await until(() => JSON.parse(doc.getText()).title === "统一工作台", "workbench prototype redo");
  assert.equal(parseGameFlowDocument(doc.getText()).exportDirectory, "ui/workbench");
  checks.push("prototype edits retain native undo and redo in unified workbench");
  unlinkSync(file);
  await vscode.commands.executeCommand("workbench.action.files.save");
  try { await until(() => !tab()?.isDirty, "aggregate save"); }
  catch (error) { throw new Error(`${error}; ${JSON.stringify({ nativeDirty: tab()?.isDirty, canvasDirty: doc.canvasDirty, psdDirty: psd.model.dirty, disposed: doc.disposed, replaced: api.workbench.documents.get(uri.toString()) !== doc, psdError: psd.error, text: doc.getText().slice(0, 150), baseline: doc.baseline.slice(0, 150), flushes: doc.flushes.size, psdFlushes: psd.flushes.size })}`); }
  assert.equal(JSON.parse(readFileSync(file, "utf8")).title, "统一工作台");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).exportDirectory, "ui/workbench");
  assert.equal(JSON.parse(readFileSync(meta, "utf8")).layers[0].config.exportName, "embedded_saved");
  checks.push("one native save persists prototype and PSD independently");
  const restored = doc.getText();
  assert.equal(readFileSync(file, "utf8"), restored);
  assert.equal(doc.dirty, false);
  checks.push("native save recreates the deleted canvas and updates its baseline");
  const edited = serializeGameFlowDocument({ ...parseGameFlowDocument(restored), title: "覆盖外部修改" });
  await api.workbench.apply(doc, [{ document: doc, version: doc.version, text: edited }]);
  const previousMeta = readFileSync(meta, "utf8");
  const pendingPsd = makePsdDraft(psd.model.asset);
  pendingPsd.layers[0].config.shared = !pendingPsd.layers[0].config.shared;
  await api.psd.edit(psd, pendingPsd, psd.model.version);
  writeFileSync(file, canvasText);
  let answer: () => string | undefined = () => undefined;
  const prompt = mock.method(vscode.window, "showWarningMessage", async (message: string, options: vscode.MessageOptions, overwrite: string) => {
    assert.ok(message.includes("工作台.gameflow.json"));
    assert.equal(options.modal, true);
    assert.equal(overwrite, "覆盖保存");
    return answer();
  });
  try {
    await assert.rejects(api.workbench.saveCustomDocument(doc, cancellation.token), vscode.CancellationError);
    assert.equal(prompt.mock.callCount(), 1);
    assert.equal(readFileSync(file, "utf8"), canvasText);
    assert.equal(readFileSync(meta, "utf8"), previousMeta);
    assert.equal(psd.model.dirty, true);
    assert.equal(JSON.parse(readFileSync(doc.cache.fsPath, "utf8")).text, edited);
    assert.equal(doc.getText(), edited);
    assert.equal(doc.canvasDirty, true);
    assert.equal(tab()?.isDirty, true);
    checks.push("cancelling canvas overwrite retains disk, recoverable draft and dirty tab");

    const newer = canvasText + "\n";
    answer = () => {
      writeFileSync(file, newer);
      answer = () => undefined;
      return "覆盖保存";
    };
    await assert.rejects(api.workbench.saveCustomDocument(doc, cancellation.token), vscode.CancellationError);
    assert.equal(prompt.mock.callCount(), 3);
    assert.equal(readFileSync(file, "utf8"), newer);
    checks.push("another external edit while the overwrite prompt is open requires a new decision");

    answer = () => "覆盖保存";
    await vscode.commands.executeCommand("workbench.action.files.save");
    await until(() => !tab()?.isDirty && readFileSync(file, "utf8") === edited, "confirmed overwrite");
    assert.equal(doc.dirty, false);
    assert.equal(existsSync(doc.cache.fsPath), false);
    const subsequent = serializeGameFlowDocument({ ...parseGameFlowDocument(edited), title: "继续编辑" });
    await api.workbench.apply(doc, [{ document: doc, version: doc.version, text: subsequent }]);
    await vscode.commands.executeCommand("workbench.action.files.save");
    await until(() => !tab()?.isDirty && readFileSync(file, "utf8") === subsequent, "ordinary save after overwrite");
    assert.equal(prompt.mock.callCount(), 4);
    checks.push("confirmed native overwrite clears dirty and subsequent edits save without prompting");

    const matching = serializeGameFlowDocument({ ...parseGameFlowDocument(subsequent), title: "再次保存" });
    await api.workbench.apply(doc, [{ document: doc, version: doc.version, text: matching }]);
    writeFileSync(file, matching);
    await vscode.commands.executeCommand("workbench.action.files.save");
    await until(() => !tab()?.isDirty && !doc.dirty, "matching external save");
    assert.equal(readFileSync(file, "utf8"), matching);
    assert.equal(prompt.mock.callCount(), 4);
    checks.push("matching disk and canvas edits finish saving without an overwrite prompt");
  } finally { prompt.mock.restore(); }
  const next = makePsdDraft(psd.model.asset); next.layers[0].config.exportName = "recover_embedded";
  await api.psd.edit(psd, next, psd.model.version);
  const backup = await api.workbench.backupCustomDocument(doc, { destination: vscode.Uri.file(join(directory, "workbench-backup.json")) }, cancellation.token);
  await vscode.commands.executeCommand("workbench.action.files.revert");
  await until(() => !tab()?.isDirty && !doc.dirty && psd.model.asset.layers[0].config.exportName === "embedded_saved", "native workbench discard");
  await doc.enqueue(async () => {});
  assert.equal(psd.model.asset.layers[0].config.exportName, "embedded_saved");
  assert.equal(existsSync(doc.cache.fsPath), false);
  checks.push("native workbench discard restores PSD and clears draft");
  await vscode.window.tabGroups.close(tab()!); await until(() => doc.disposed, "close workbench");
  const recovered = await api.workbench.openCustomDocument(uri, { backupId: backup.id, untitledDocumentData: undefined }, cancellation.token);
  assert.equal(recovered.currentPsd!.model.asset.layers[0].config.exportName, "recover_embedded");
  assert.equal(recovered.dirty, true); assert.equal(JSON.parse(recovered.getText()).title, "再次保存");
  assert.equal(parseGameFlowDocument(recovered.getText()).exportDirectory, "ui/workbench");
  await api.workbench.revertCustomDocument(recovered, cancellation.token); recovered.dispose(); await backup.delete();
  checks.push("workbench hot-exit backup restores embedded PSD and prototype");
  await vscode.commands.executeCommand("vscode.openWith", uri, "gameflow.canvasEditor", { preview: false });
  await until(() => !!api.workbench.documents.get(uri.toString())?.currentPsd?.panels.size, "reopen workbench PSD");
  doc = api.workbench.documents.get(uri.toString())!; psd = doc.currentPsd!;
  assert.equal(parseGameFlowDocument(doc.getText()).exportDirectory, "ui/workbench");
  checks.push("per-file export directory uses native history save backup and reopen");
  assert.equal(psd.model.asset.layers[0].config.exportName, "embedded_saved");
  assert.equal(parseGameFlowDocument(doc.getText()).pages.some(page => page.artPsd), false);
  assert.equal(doc.canvasDirty, false); assert.equal(doc.getText(), readFileSync(file, "utf8"));
  checks.push("reopening workbench restores last PSD in the same tab without creating page bindings or changing the prototype");
  const conflict = makePsdDraft(psd.model.asset); conflict.layers[0].config.exportName = "must_not_overwrite";
  await api.psd.edit(psd, conflict, psd.model.version);
  const originalMeta = readFileSync(meta, "utf8"); writeFileSync(meta, originalMeta + "\n");
  await assert.rejects(api.workbench.saveCustomDocument(doc, cancellation.token), /外部修改/);
  assert.equal(psd.model.dirty, true); assert.equal(tab()?.isDirty, true);
  await vscode.commands.executeCommand("workbench.action.files.revert"); await until(() => !tab()?.isDirty && !doc.dirty, "discard after failed save");
  await doc.enqueue(async () => {});
  checks.push("failed embedded PSD save retains native dirty and external data");
  await vscode.window.tabGroups.close(tab()!); await until(() => doc.disposed, "close final workbench");
  cancellation.dispose();
  return checks;
}

/** Optional visible fixture: the computer-use tool clicks the actual tab × and dialog buttons. */
export async function closeUiChecks(api: { workbench: GameFlowEditorProvider; psd: PsdEditorProvider }, root: string, directory: string): Promise<string[]> {
  const file = join(directory, "关闭保护验收.gameflow.json"), source = join(directory, "关闭验收.psd"), meta = join(directory, "关闭验收.meta.json");
  writeFileSync(file, serializeGameFlowDocument(createDefaultGameFlowDocument("close-ui")));
  writeFileSync(source, readFileSync(join(root, "examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd")));
  const uri = vscode.Uri.file(file), status = process.env.GAMEFLOW_PSD_TEST_REPORT! + ".close-ui.json";
  const announce = (stage: string) => writeFileSync(status, JSON.stringify({ stage, file, source, meta }));
  const open = async () => {
    await vscode.commands.executeCommand("vscode.openWith", uri, "gameflow.canvasEditor", { preview: false });
    await until(() => !!api.workbench.documents.get(uri.toString())?.panels.size, "visible close fixture");
    return api.workbench.documents.get(uri.toString())!;
  };
  const waitClosed = async (doc: { disposed: boolean }) => {
    const end = Date.now() + 180000;
    while (!doc.disposed) { if (Date.now() > end) throw new Error("Manual close fixture timed out"); await new Promise(resolve => setTimeout(resolve, 100)); }
  };
  let doc = await open(); await api.workbench.openPsd(doc, vscode.Uri.file(source));
  await vscode.commands.executeCommand("workbench.action.files.save");
  await until(() => !doc.dirty, "visible fixture initial save");
  const draft = makePsdDraft(doc.currentPsd!.model.asset);
  const layer = doc.currentPsd!.model.asset.layers.find(item => !!item.config.nineGrid)!;
  draft.layers.find(item => item.key === layer.key)!.config.exportName = "close_keep_then_save";
  await api.psd.edit(doc.currentPsd!, draft, doc.currentPsd!.model.version);
  announce("cancel_then_save"); await waitClosed(doc);
  assert.equal(JSON.parse(readFileSync(meta, "utf8")).layers.find((item: { sourceKey: number }) => item.sourceKey === layer.key).config.exportName, "close_keep_then_save");
  doc = await open(); await until(() => !!doc.currentPsd?.panels.size, "visible reopen PSD");
  const discarded = makePsdDraft(doc.currentPsd!.model.asset); discarded.layers.find(item => item.key === layer.key)!.config.exportName = "close_discard_this";
  await api.psd.edit(doc.currentPsd!, discarded, doc.currentPsd!.model.version);
  announce("discard"); await waitClosed(doc); await doc.enqueue(async () => {});
  assert.equal(JSON.parse(readFileSync(meta, "utf8")).layers.find((item: { sourceKey: number }) => item.sourceKey === layer.key).config.exportName, "close_keep_then_save");
  announce("complete");
  return ["native tab close Save and Don't Save verified through visible UI"];
}
