import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applySidecar, makeSidecar } from "../shared/psd-meta";
import { applyPsdDraft, isPsdDraft, makePsdDraft } from "../shared/psd-draft";
import { parsePsdBinary, patchPsdMetadata } from "../shared/psd-binary";
import { createPsdStructure } from "../shared/psd-structure";
import { effectiveExportName, psdExportDirectory, psdSliceDirectory, makeSliceExportBatch, isSliceExportBatch, sliceExportIssues } from "../shared/psd-export";
import { bytesHash, PsdDocumentModel } from "../src/psd-document-model";
import { sliceGenerationStamp } from "../webview/psd/slice-render";

const bytes = readFileSync("examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd");
const structure = () => createPsdStructure(parsePsdBinary(bytes), "登录页面.psd", bytesHash(bytes));
export const psdIndependentDirectoryTests = [
  { name: "PSD independent directory uses root atlas folders while shared resources keep their category", run() {
    const asset = structure();
    for (const value of [asset, makeSidecar(asset), makePsdDraft(asset)]) assert.equal(Object.hasOwn(value, "independentDirectory"), false);
    assert.equal(psdExportDirectory(asset), undefined);
    assert.equal(psdSliceDirectory(asset), "unclassified");
    asset.independentDirectory = true;
    assert.equal(psdExportDirectory(asset), "dlym");
    asset.atlasName = "公共 UI";
    assert.equal(psdExportDirectory(asset), "gg_ui");
    const layer = asset.layers.find(l => l.name === "按钮底图")!;
    layer.config.shared = true;
    assert.equal(psdSliceDirectory(asset, true), "shared");
    assert.equal(effectiveExportName(asset, layer), "btn_andt");
    layer.config.exportName = "CUSTOM";
    assert.equal(effectiveExportName(asset, layer), "custom");
    const enabledStamp = sliceGenerationStamp(asset);
    delete asset.independentDirectory;
    assert.notEqual(sliceGenerationStamp(asset), enabledStamp);
    assert.equal(psdSliceDirectory(asset), "unclassified");
    assert.equal(asset.atlasName, "公共 UI");
  } },
  { name: "PSD independent directory persists in sidecars and embedded copies and clears stale mirrors", run() {
    const asset = { ...structure(), independentDirectory: true }, sidecar = makeSidecar(asset);
    assert.equal(sidecar.independentDirectory, true);
    assert.ok(sidecar.layers.every(l => l.metadata.independentDirectory === true));
    assert.equal(applySidecar(structure(), sidecar).independentDirectory, true);
    const patched = patchPsdMetadata(bytes, new Map(sidecar.layers.map(l => [l.sourceKey, l.metadata])));
    const raw = parsePsdBinary(patched), embedded = createPsdStructure(raw, asset.name, bytesHash(patched));
    assert.equal(embedded.independentDirectory, true);
    assert.deepEqual(patched.subarray(raw.recordsEnd), new Uint8Array(bytes.subarray(parsePsdBinary(bytes).recordsEnd)));
    delete embedded.independentDirectory;
    const cleared = makeSidecar(embedded);
    assert.equal(Object.hasOwn(cleared, "independentDirectory"), false);
    assert.ok(cleared.layers.every(l => !Object.hasOwn(l.metadata, "independentDirectory")));
    const clearedBytes = patchPsdMetadata(patched, new Map(cleared.layers.map(l => [l.sourceKey, l.metadata])));
    assert.equal(createPsdStructure(parsePsdBinary(clearedBytes), asset.name, bytesHash(clearedBytes)).independentDirectory, undefined);
    assert.equal(applySidecar(asset, makeSidecar(structure())).independentDirectory, undefined);
    assert.equal(Object.hasOwn(makePsdDraft({ ...asset, independentDirectory: false }), "independentDirectory"), false);
  } },
  { name: "PSD independent directory participates in native history draft recovery and saved reload", async run() {
    const asset = structure(), model = new PsdDocumentModel(asset, null), before = model.baseline;
    const next = { ...before, independentDirectory: true, atlasName: "Common UI" };
    model.update(next, model.version); assert.equal(model.dirty, true);
    const restored = applyPsdDraft(structure(), JSON.parse(JSON.stringify(makePsdDraft(model.asset))), true);
    assert.equal(psdExportDirectory(restored), "common_ui");
    model.restore(before); assert.equal(model.asset.independentDirectory, undefined); assert.equal(model.dirty, false);
    model.restore(next); assert.equal(model.asset.independentDirectory, true);
    let saved: Uint8Array | null = null;
    await model.save({ readSource: async () => bytes, readConfig: async () => null, writeConfig: async value => { saved = value; } });
    assert.equal(model.dirty, false);
    const reloaded = applySidecar(structure(), JSON.parse(new TextDecoder().decode(saved!)));
    assert.equal(reloaded.independentDirectory, true); assert.equal(psdExportDirectory(reloaded), "common_ui");
    assert.equal(applyPsdDraft(reloaded, before).independentDirectory, undefined);
  } },
  { name: "PSD independent directory rejects malformed flags conflicting metadata and unsafe output folders", run() {
    const asset = structure(), draft = makePsdDraft(asset), sidecar = makeSidecar(asset);
    for (const independentDirectory of [null, 1, "true", {}, []]) {
      assert.equal(isPsdDraft({ ...draft, independentDirectory }), false);
      assert.throws(() => applySidecar(asset, { ...sidecar, independentDirectory }), /独立目录/);
      const raw = parsePsdBinary(bytes);
      raw.layers[0].metadata = { ...asset.layers[0].metadata, independentDirectory };
      assert.throws(() => createPsdStructure(raw, asset.name, asset.sourceHash), /独立目录/);
    }
    const raw = parsePsdBinary(bytes);
    raw.layers[0].metadata = { ...asset.layers[0].metadata, independentDirectory: true };
    raw.layers[1].metadata = { ...asset.layers[1].metadata, independentDirectory: false };
    assert.throws(() => createPsdStructure(raw, asset.name, asset.sourceHash), /不同的独立目录/);
    for (const atlasName of ["CON", "nul", "LPT1"]) {
      const invalid = { ...asset, atlasName, independentDirectory: true };
      assert.throws(() => psdExportDirectory(invalid), /独立目录/);
      assert.ok(sliceExportIssues(invalid).some(i => i.message.includes("独立目录")));
      assert.equal(psdExportDirectory({ ...invalid, independentDirectory: false }), undefined);
    }
    for (const atlasName of ["builtin", "SHARED", "Unclassified", "ｓｈａｒｅｄ"]) {
      const invalid = { ...asset, atlasName };
      assert.throws(() => psdExportDirectory(invalid), /保留目录名/);
      assert.throws(() => makeSidecar(invalid), /图集名/);
      assert.equal(isPsdDraft({ ...draft, atlasName }), false);
      assert.throws(() => applySidecar(asset, { ...sidecar, atlasName }), /图集名/);
      const raw = parsePsdBinary(bytes); raw.layers[0].metadata = { ...asset.layers[0].metadata, atlasName };
      assert.throws(() => createPsdStructure(raw, asset.name, asset.sourceHash), /图集名/);
      assert.ok(sliceExportIssues(invalid).some(i => i.message.includes("保留目录名")));
    }
    assert.throws(() => psdExportDirectory({ ...asset, name: "Shared.psd" }), /保留目录名/);
    assert.equal(psdExportDirectory({ ...asset, name: "Shared.psd", atlasName: "Common", independentDirectory: true }), "common");
    const batch = { source: { documentId: asset.documentId, psdName: asset.name, sourceHash: asset.sourceHash }, items: [{ name: "img_common_tb", layerId: "test-layer", layerName: "图标", shared: false, width: 10, height: 10, nineGrid: null, base64: readFileSync("examples/star-sea-login/assets/status_dot.png").toString("base64") }] };
    for (const directory of ["shared", "builtin", "unclassified", "../outside", "ui/login", "Common", "con", "a".repeat(121)]) assert.equal(isSliceExportBatch({ ...batch, directory }), false);

  } }
];
