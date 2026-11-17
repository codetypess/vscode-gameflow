import * as vscode from "vscode";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PsdEditorProvider } from "../src/psd-editor-provider";
import { WorkbenchSettingsController } from "../src/workbench-settings-controller";
import { PsdExportController } from "../src/psd-export-controller";
import { EXPORT_SETTINGS_KEY, LEGACY_RESOURCE_DIRECTORY_KEY } from "../shared/workbench-settings";
import { RESOURCE_MANIFEST, makeSliceExportBatch } from "../shared/psd-export";
import type { PsdAsset } from "../shared/psd-meta";

export async function settingsChecks(api: { psd: PsdEditorProvider }, root: string, directory: string): Promise<string[]> {
  const checks: string[] = [], settings = api.psd.settings;
  const resources = settings.directory("resources"), prefabs = settings.directory("prefabs");
  const first = vscode.Uri.file(join(directory, "resources-a")), second = vscode.Uri.file(join(directory, "resources-b")), prefab = vscode.Uri.file(join(directory, "prefabs"));
  for (const folder of [first, second, prefab]) mkdirSync(folder.fsPath);
  const source = vscode.Uri.file(join(directory, "settings-source.psd"));
  const exporter = new PsdExportController(settings, { uri: source });
  const asset: PsdAsset = { name: "设置验证.psd", sourceHash: "a".repeat(64), documentId: "settings-psd", hasEmbeddedIdentity: true, width: 10, height: 10, preview: "", layers: [{ key: 0, nativeId: 0, parentKey: null, name: "图标", group: false, left: 0, top: 0, width: 10, height: 10, hidden: false, identityOrigin: "embedded", metadata: { namespace: "com.codetypes.gameflow", version: 1, documentId: "settings-psd", layerId: "settings-layer" }, config: { enabled: true, name: "图标", nineGrid: null }, image: `data:image/png;base64,${readFileSync(join(root, "examples/star-sea-login/assets/status_dot.png")).toString("base64")}` }] };
  const batch = makeSliceExportBatch(asset), filename = batch.items[0].name + ".png";
  try {
    await settings.set("resources");
    await assert.rejects(exporter.export(batch), /工作台设置/);
    await Promise.all([settings.set("resources", first), settings.set("prefabs", prefab)]);
    assert.equal(settings.directory("resources")?.toString(), first.toString());
    assert.equal(settings.directory("prefabs")?.toString(), prefab.toString());
    assert.equal(await exporter.export(batch), 1);
    assert.ok(existsSync(join(first.fsPath, filename))); assert.ok(existsSync(join(first.fsPath, RESOURCE_MANIFEST)));
    await settings.set("resources", second);
    assert.equal(await exporter.export(batch), 1);
    assert.ok(existsSync(join(second.fsPath, filename))); assert.ok(existsSync(join(second.fsPath, RESOURCE_MANIFEST)));
    assert.equal(settings.directory("prefabs")?.toString(), prefab.toString());
    assert.equal(existsSync(source.fsPath), false); assert.equal(existsSync(source.fsPath.replace(/\.psd$/, ".meta.json")), false);
    checks.push("workspace settings keep resource and prefab directories independent", "existing exporter uses changed resource directory and writes PNG plus provenance", "missing directory rejects export without touching source documents");
    const values = new Map<string, unknown>([[LEGACY_RESOURCE_DIRECTORY_KEY, first.toString()]]);
    const context = { workspaceState: { keys: () => [...values.keys()], get: (key: string, fallback?: unknown) => values.has(key) ? values.get(key) : fallback, update: async (key: string, value: unknown) => { values.set(key, value); } } } as Pick<vscode.ExtensionContext, "workspaceState">;
    const controller = new WorkbenchSettingsController(context, async () => undefined);
    const received: unknown[] = [];
    const listener = controller.attach({ webview: { postMessage: async (value: unknown) => { received.push(value); return true; }, onDidReceiveMessage: () => new vscode.Disposable(() => {}) } } as unknown as vscode.WebviewPanel, source);
    assert.equal(controller.directory("resources")?.toString(), first.toString());
    assert.equal(await controller.choose("resources", source), false);
    assert.equal(values.has(EXPORT_SETTINGS_KEY), false);
    await controller.set("prefabs", prefab);
    assert.ok(received.some((value: any) => value.settings.prefabDirectory === prefab.fsPath));
    const reopened = new WorkbenchSettingsController(context);
    assert.equal(reopened.directory("resources")?.toString(), first.toString());
    assert.equal(reopened.directory("prefabs")?.toString(), prefab.toString());
    await reopened.set("resources");
    assert.equal(controller.directory("resources"), undefined);
    await assert.rejects(reopened.set("resources", vscode.Uri.file(join(first.fsPath, filename))), /文件夹/);
    assert.equal(reopened.directory("resources"), undefined);
    listener.dispose(); controller.dispose(); reopened.dispose();
    checks.push("settings persist through controller recreation and legacy migration", "folder picker cancellation preserves configuration and broadcasts changes", "invalid directory rejected without restoring cleared legacy path");
  } finally {
    await settings.set("resources", resources); await settings.set("prefabs", prefabs);
  }
  return checks;
}
