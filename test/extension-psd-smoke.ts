import * as vscode from "vscode";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PsdEditorProvider, PsdDocument } from "../src/psd-editor-provider";
import { makePsdDraft } from "../shared/psd-draft";
import { parsePsdBinary, patchPsdMetadata } from "../shared/psd-binary";

async function until(predicate: () => boolean, label: string) {
  const end = Date.now() + 20000;
  while (!predicate()) { if (Date.now() > end) throw new Error(`Timeout: ${label}`); await new Promise(resolve => setTimeout(resolve, 100)); }
}
export async function run() {
  const root = process.env.GAMEFLOW_PSD_TEST_ROOT!, report = process.env.GAMEFLOW_PSD_TEST_REPORT!;
  const directory = mkdtempSync(join(tmpdir(), "gameflow-native-psd-")), checks: string[] = [];
  const cancel = new vscode.CancellationTokenSource();
  let doc: PsdDocument | undefined;
  try {
    const file = join(directory, "生命周期.psd"), meta = join(directory, "生命周期.meta.json");
    const original = readFileSync(join(root, "examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd"));
    writeFileSync(file, original);
    const uri = vscode.Uri.file(file);
    const api = await vscode.extensions.getExtension<{ psd: PsdEditorProvider }>("codetypes.vscode-gameflow")!.activate();
    await api.psd.open(uri);
    await until(() => !!api.psd.documents.get(uri.toString())?.announced, "PSD editor initialization");
    doc = api.psd.documents.get(uri.toString())!;
    const tab = () => vscode.window.tabGroups.all.flatMap(group => group.tabs).find(t => t.input instanceof vscode.TabInputCustom && t.input.uri.toString() === uri.toString());
    await until(() => !!tab()?.isDirty, "native initial dirty");
    // Saving via the actual workbench invokes provider flush/save and clears the tab.
    await vscode.commands.executeCommand("workbench.action.files.save");
    await until(() => existsSync(meta) && !tab()?.isDirty, "native save completion");
    checks.push("native configuration save", "initial identity persistence");
    const before = makePsdDraft(doc.model.asset), edited = structuredClone(before);
    edited.layers[0].config.exportName = "native_saved"; edited.layers[0].config.shared = true;
    await api.psd.edit(doc, edited, doc.model.version);
    await until(() => !!tab()?.isDirty, "native metadata dirty"); checks.push("native dirty tab");
    await vscode.commands.executeCommand("undo");
    await until(() => doc!.model.asset.layers[0].config.exportName !== "native_saved", "native undo");
    await vscode.commands.executeCommand("redo");
    await until(() => doc!.model.asset.layers[0].config.exportName === "native_saved", "native redo");
    checks.push("native undo/redo");
    await until(() => doc!.backup === "saved", "automatic draft backup");
    const backupUri = vscode.Uri.file(join(directory, "backup.json"));
    const backup = await api.psd.backupCustomDocument(doc, { destination: backupUri }, cancel.token);
    const savedBackup = readFileSync(backupUri.fsPath, "utf8"); assert.equal(JSON.parse(savedBackup).draft.layers[0].config.exportName, "native_saved");
    checks.push("automatic draft checkpoint", "VS Code backup callback");
    await vscode.commands.executeCommand("workbench.action.files.save");
    await until(() => !tab()?.isDirty, "native save edited config");
    assert.equal(JSON.parse(readFileSync(meta, "utf8")).layers[0].config.exportName, "native_saved");
    assert.deepEqual(readFileSync(file), original); checks.push("source PSD remains byte-identical");
    await vscode.window.tabGroups.close(tab()!);
    await until(() => doc!.disposed, "native close disposes PSD document");
    await api.psd.open(uri); await until(() => !!api.psd.documents.get(uri.toString()) && api.psd.documents.get(uri.toString()) !== doc, "reopen PSD");
    doc = api.psd.documents.get(uri.toString())!;
    assert.equal(doc.model.asset.layers[0].config.exportName, "native_saved"); assert.equal(doc.model.asset.layers[0].config.shared, true);
    assert.equal(doc.model.dirty, false); checks.push("automatic sidecar reopen");
    await vscode.window.tabGroups.close(tab()!); await until(() => doc!.disposed, "close clean reopened PSD");
    // Recovery exercises the real provider without attaching another editable view.
    writeFileSync(backupUri.fsPath, savedBackup);
    const recovered = await api.psd.openCustomDocument(uri, { backupId: backup.id, untitledDocumentData: undefined }, cancel.token);
    assert.equal(recovered.model.asset.layers[0].config.exportName, "native_saved"); assert.equal(recovered.model.dirty, true);
    checks.push("backup restoration preserves unsaved state");
    await assert.rejects(api.psd.saveCustomDocument(recovered, cancel.token), /外部修改/);
    assert.equal(recovered.model.dirty, true); checks.push("external sidecar conflict retains dirty state");
    await api.psd.revertCustomDocument(recovered, cancel.token); assert.equal(recovered.model.dirty, false);
    assert.equal(existsSync(join(recovered.cache.fsPath, "draft.json")), false); checks.push("discard removes recovery draft");
    const copyUri = vscode.Uri.file(join(directory, "另存副本.psd"));
    await api.psd.saveCustomDocumentAs(recovered, copyUri, cancel.token);
    const copy = await api.psd.openCustomDocument(copyUri, { backupId: undefined, untitledDocumentData: undefined }, cancel.token);
    assert.equal(copy.model.dirty, false); assert.equal(copy.model.asset.layers[0].config.exportName, "native_saved");
    assert.equal(existsSync(join(directory, "另存副本.meta.json")), true); copy.dispose(); checks.push("save-as writes matching PSD and sidecar");
    recovered.dispose(); await backup.delete();
    const records = parsePsdBinary(original).layers;
    writeFileSync(file, patchPsdMetadata(original, new Map([[records[1].key, records[0].metadata]])));
    const repairable = await api.psd.openCustomDocument(uri, { backupId: undefined, untitledDocumentData: undefined }, cancel.token);
    assert.match(repairable.configReadIssue!, /重复 ID/);
    await assert.rejects(api.psd.saveCustomDocument(repairable, cancel.token), /重复 ID/);
    assert.equal(JSON.parse(readFileSync(meta, "utf8")).layers[0].config.exportName, "native_saved");
    repairable.dispose(); checks.push("incompatible sidecar preserves editable identity repair and original config");
    writeFileSync(report, JSON.stringify({ ok: true, directory, checks }, null, 2));
  } catch (error) { writeFileSync(report, JSON.stringify({ ok: false, directory, checks, error: String(error), stack: error instanceof Error ? error.stack : undefined }, null, 2)); throw error; }
  finally { cancel.dispose(); }
}
