import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applySidecar, defaultAtlasName, makeSidecar } from "../shared/psd-meta";
import { applyPsdDraft, draftStamp, isPsdDraft, makePsdDraft } from "../shared/psd-draft";
import { parsePsdBinary, patchPsdMetadata } from "../shared/psd-binary";
import { createPsdStructure } from "../shared/psd-structure";
import { defaultExportName, effectiveExportName } from "../shared/psd-export";
import { isPsdEditorRequest } from "../shared/psd-editor-protocol";
import { bytesHash, PsdDocumentModel } from "../src/psd-document-model";
import { sliceGenerationStamp } from "../webview/psd/slice-render";
import { normalizeAtlasName } from "../shared/psd-naming";

const bytes = readFileSync("examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd");
const structure = (name = "登录页面.psd") => createPsdStructure(parsePsdBinary(bytes), name, bytesHash(bytes));
export const psdAtlasTests = [
  { name: "PSD atlas defaults stay derived and are never inserted into saved configuration", run() {
    const asset = structure(), sidecar = makeSidecar(asset), draft = makePsdDraft(asset);
    assert.equal(defaultAtlasName(asset.name), "dlym");
    assert.equal(defaultAtlasName("Login.UI.PSD"), "login_ui");
    for (const value of [asset, sidecar, draft]) assert.equal(Object.hasOwn(value, "atlasName"), false);
    assert.ok(sidecar.layers.every(l => !Object.hasOwn(l.metadata, "atlasName")));
    assert.equal(defaultExportName(asset.name, "按钮底图", asset.atlasName), "btn_dlym_andt");
    assert.equal(defaultExportName("Other.psd", "按钮底图"), "btn_other_andt");
  } },
  { name: "PSD atlas override roundtrips through sidecar and embedded metadata without changing pixels", run() {
    const asset = structure(); asset.atlasName = "Common";
    const meta = makeSidecar(asset);
    assert.equal(meta.atlasName, "common"); assert.ok(meta.layers.every(l => l.metadata.atlasName === "common"));
    assert.equal(applySidecar(structure(), JSON.parse(JSON.stringify(meta))).atlasName, "common");
    const patched = patchPsdMetadata(bytes, new Map(meta.layers.map(l => [l.sourceKey, l.metadata])));
    const raw = parsePsdBinary(patched), embedded = createPsdStructure(raw, "Renamed.psd", bytesHash(patched));
    assert.equal(embedded.atlasName, "common");
    assert.equal(defaultExportName(embedded.name, "按钮底图", embedded.atlasName), "btn_common_andt");
    assert.deepEqual(patched.subarray(raw.recordsEnd), new Uint8Array(bytes.subarray(parsePsdBinary(bytes).recordsEnd)));
    delete embedded.atlasName;
    const cleared = makeSidecar(embedded);
    assert.equal(Object.hasOwn(cleared, "atlasName"), false);
    assert.ok(cleared.layers.every(l => !Object.hasOwn(l.metadata, "atlasName")));
    const clearedBytes = patchPsdMetadata(patched, new Map(cleared.layers.map(l => [l.sourceKey, l.metadata])));
    assert.equal(createPsdStructure(parsePsdBinary(clearedBytes), "Renamed.psd", bytesHash(clearedBytes)).atlasName, undefined);
    assert.equal(applySidecar({ ...structure(), atlasName: "Old" }, makeSidecar(structure())).atlasName, undefined);
  } },
  { name: "PSD atlas participates in draft recovery, native history and saved reload", async run() {
    const asset = structure(), model = new PsdDocumentModel(asset, null), before = model.baseline;
    const next = { ...before, atlasName: "Common" };
    assert.equal(isPsdEditorRequest({ type: "psdEditorEdit", requestId: "atlas", baseVersion: 1, draft: next }), true);
    model.update(next, model.version); assert.equal(model.dirty, true);
    const recovered = applyPsdDraft(structure(), JSON.parse(JSON.stringify(makePsdDraft(model.asset))), true);
    assert.equal(recovered.atlasName, "common"); assert.notEqual(draftStamp(asset), draftStamp(recovered));
    model.restore(before); assert.equal(model.dirty, false); assert.equal(model.asset.atlasName, undefined);
    model.restore(next); assert.equal(model.asset.atlasName, "common");
    let saved: Uint8Array | null = null;
    await model.save({ readSource: async () => bytes, readConfig: async () => null, writeConfig: async value => { saved = value; } });
    assert.equal(model.dirty, false);
    assert.equal(applySidecar(structure(), JSON.parse(new TextDecoder().decode(saved!))).atlasName, "common");
    assert.equal(applyPsdDraft(model.asset, before).atlasName, undefined);
  } },
  { name: "PSD atlas validation rejects malformed configuration and ambiguous embedded names", run() {
    const asset = structure(), draft = makePsdDraft(asset), meta = makeSidecar(asset);
    for (const atlasName of [null, 42, "", "   ", "___-!", "a".repeat(121), "ﬀ".repeat(61)]) {
      assert.equal(isPsdDraft({ ...draft, atlasName }), false);
      assert.throws(() => applySidecar(asset, { ...meta, atlasName }), /图集名/);
    }
    for (const atlasName of ["Common", "公共资源", "a".repeat(120)]) assert.equal(isPsdDraft({ ...draft, atlasName }), true);
    const raw = parsePsdBinary(bytes);
    raw.layers[0].metadata = { ...asset.layers[0].metadata, atlasName: "One" };
    raw.layers[1].metadata = { ...asset.layers[1].metadata, atlasName: "Two" };
    assert.throws(() => createPsdStructure(raw, asset.name, asset.sourceHash), /多个不同的图集名/);
    raw.layers[1].metadata = { ...asset.layers[1].metadata, atlasName: 42 };
    assert.throws(() => createPsdStructure(raw, asset.name, asset.sourceHash), /图集名格式/);
  } },
  { name: "PSD atlas names share lowercase, separator and pinyin normalization with placeholders and exports", run() {
    for (const [input, expected] of [
      ["Common UI", "common_ui"], ["公共资源", "ggzy"], ["登录_按钮", "dl_an"],
      ["  Common__UI--02  ", "common_ui_02"], ["公共 UI-02", "gg_ui_02"], ["ＵＩ＿０２", "ui_02"]
    ]) {
      assert.equal(normalizeAtlasName(input), expected);
      assert.equal(normalizeAtlasName(expected), expected);
      assert.equal(defaultAtlasName(input + ".PSD"), expected);
      assert.equal(defaultExportName("Other.psd", "按钮底图", input), `btn_${expected}_andt`);
    }
    for (const input of [undefined, "", "   ", "__!-"]) assert.equal(normalizeAtlasName(input), undefined);
  } },
  { name: "PSD legacy atlas names normalize during configuration, draft and embedded reload", run() {
    const asset = structure(), legacy = { ...makeSidecar(asset), atlasName: "公共 UI-02" };
    const restored = applySidecar(asset, legacy);
    assert.equal(restored.atlasName, "gg_ui_02");
    assert.equal(makePsdDraft({ ...asset, atlasName: "公共 UI-02" }).atlasName, "gg_ui_02");
    assert.equal(applyPsdDraft(asset, { ...makePsdDraft(asset), atlasName: "公共 UI-02" }).atlasName, "gg_ui_02");
    const raw = parsePsdBinary(bytes);
    raw.layers[0].metadata = { ...asset.layers[0].metadata, atlasName: "公共 UI-02" };
    raw.layers[1].metadata = { ...asset.layers[1].metadata, atlasName: "gg_ui_02" };
    const embedded = createPsdStructure(raw, asset.name, asset.sourceHash);
    assert.equal(embedded.atlasName, "gg_ui_02");
    assert.ok(makeSidecar(embedded).layers.every(l => l.metadata.atlasName === "gg_ui_02"));
    const model = new PsdDocumentModel(restored, null);
    assert.equal(model.update({ ...makePsdDraft(restored), atlasName: "公共 UI-02" }, model.version), false);
    assert.equal(model.dirty, false);
  } },
  { name: "PSD atlas edits invalidate generated resource paths while explicit names retain priority", run() {
    const original = structure(), edited = { ...original, atlasName: "Common" };
    assert.notEqual(sliceGenerationStamp(original), sliceGenerationStamp(edited));
    for (const layer of edited.layers.filter(l => !l.group)) {
      assert.equal(effectiveExportName(edited, layer), defaultExportName(edited.name, layer.name, "Common"));
      const sharedLayer = { ...layer, config: { ...layer.config, shared: true } };
      assert.equal(effectiveExportName(edited, sharedLayer), defaultExportName(edited.name, layer.name, undefined, true));
      assert.equal(effectiveExportName(edited, sharedLayer), effectiveExportName(original, sharedLayer));
    }
    const layer = edited.layers.find(l => !l.group)!;
    const sharedAsset = { ...edited, layers: edited.layers.map(l => l.key === layer.key ? { ...l, config: { ...l.config, shared: true } } : l) };
    assert.notEqual(sliceGenerationStamp(edited), sliceGenerationStamp(sharedAsset));
    assert.equal(effectiveExportName(edited, { ...layer, config: { ...layer.config, exportName: "CUSTOM" } }), "custom");
    assert.equal(effectiveExportName(edited, { ...layer, config: { ...layer.config, exportName: "" } }), defaultExportName(edited.name, layer.name, "Common"));
  } }
];
