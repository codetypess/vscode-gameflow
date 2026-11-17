import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applySidecar, centerSliceRegion, makeSidecar, moveSliceContent, sliceRegion, validConfig, validSliceRegion } from "../shared/psd-meta";
import { createPsdStructure } from "../shared/psd-structure";
import { parsePsdBinary, patchPsdMetadata } from "../shared/psd-binary";
import { applyPsdDraft, makePsdDraft } from "../shared/psd-draft";
import { makeSliceExportBatch, sliceExportIssues } from "../shared/psd-export";
import { isPsdEditorRequest } from "../shared/psd-editor-protocol";
import { bytesHash, PsdDocumentModel } from "../src/psd-document-model";

const bytes = readFileSync("examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd");
const structure = () => createPsdStructure(parsePsdBinary(bytes), "sample.psd", bytesHash(bytes));
const region = { x: -41, y: -11, width: 300, height: 100 };
const png = "data:image/png;base64," + readFileSync("examples/star-sea-login/assets/status_dot.png").toString("base64");
function byKey<T extends { key: number }>(layers: T[], key: number): T { const layer = layers.find(l => l.key === key); assert.ok(layer); return layer; }
export const psdRegionTests = [
  { name: "PSD region is optional and legacy reads keep original geometry without inserting defaults", run() {
    const a = structure(), l = a.layers.find(l => !l.group)!;
    const before = JSON.stringify(l.config);
    assert.deepEqual(sliceRegion(l), { x: 0, y: 0, width: l.width, height: l.height });
    assert.equal(JSON.stringify(l.config), before);
    assert.equal(validConfig(l.config, l.width, l.height), true);
    const restored = applySidecar(structure(), JSON.parse(JSON.stringify(makeSidecar(a))));
    assert.equal(Object.hasOwn(byKey(restored.layers, l.key).config, "region"), false);
  } },
  { name: "PSD region accepts transparent padding and cropping while rejecting invalid bounded geometry", run() {
    assert.equal(validSliceRegion(region), true);
    assert.equal(validSliceRegion({ x: 5, y: 10, width: 1, height: 1 }), true);
    for (const patch of [{ width: 0 }, { width: -1 }, { height: 4097 }, { width: 300.5 }, { x: Infinity }, { y: NaN }, { x: -4097 }, { y: 4097 }, { x: "0" }, { width: 4096, height: 4096 }]) {
      assert.equal(validSliceRegion({ ...region, ...patch }), false, JSON.stringify(patch));
    }
    assert.equal(validSliceRegion(null), false);
    assert.equal(validSliceRegion({ x: 0, y: 0, width: 4096 }), false);
  } },
  { name: "PSD content centering and drag deltas preserve exact pixel size and integer positions", run() {
    assert.deepEqual(centerSliceRegion({ x: 0, y: 0, width: 300, height: 100 }, { width: 217, height: 77 }), region);
    assert.deepEqual(moveSliceContent(region, 1, 0), { ...region, x: -42 });
    assert.deepEqual(moveSliceContent(region, 0, -10), { ...region, y: -1 });
    assert.deepEqual(moveSliceContent(region, 4.6, -3.4), { ...region, x: -46, y: -8 });
    assert.deepEqual(moveSliceContent(region, 10000, -10000), { ...region, x: -4096, y: 4096 });
    const crop = centerSliceRegion({ ...region, width: 100, height: 50 }, { width: 217, height: 77 });
    assert.deepEqual(crop, { x: 59, y: 14, width: 100, height: 50 });
  } },
  { name: "PSD nine-grid uses export bounds and resetting too-small original bounds is rejected", run() {
    const config = { enabled: true, name: "sample", region, nineGrid: { top: 30, bottom: 30, left: 100, right: 100, repeat: false } };
    assert.equal(validConfig(config, 10, 10), true);
    assert.equal(validConfig({ ...config, region: undefined }, 10, 10), false);
    assert.equal(validConfig({ ...config, region: { ...region, width: 200 } }, 500, 500), false);
    assert.equal(validConfig({ ...config, region: null }, 500, 500), false);
  } },
  { name: "PSD region roundtrips through sidecar, embedded metadata and recovery draft without changing pixels", run() {
    const a = structure(), l = a.layers.find(l => !l.group)!;
    l.config.region = { ...region }; l.config.nineGrid = { top: 3, right: 4, bottom: 5, left: 6, repeat: true };
    const meta = makeSidecar(a);
    const restored = applySidecar(structure(), JSON.parse(JSON.stringify(meta)));
    assert.deepEqual(byKey(restored.layers, l.key).config, l.config);
    const patched = patchPsdMetadata(bytes, new Map(meta.layers.map(item => [item.sourceKey, item.metadata])));
    const embedded = createPsdStructure(parsePsdBinary(patched), a.name, bytesHash(patched));
    assert.deepEqual(byKey(embedded.layers, l.key).config, l.config);
    assert.deepEqual(embedded.layers.map(({ left, top, width, height }) => ({ left, top, width, height })), a.layers.map(({ left, top, width, height }) => ({ left, top, width, height })));
    const source = parsePsdBinary(bytes), target = parsePsdBinary(patched);
    assert.deepEqual(patched.subarray(target.recordsEnd), new Uint8Array(bytes.subarray(source.recordsEnd)));
    const draft = makePsdDraft(a);
    assert.deepEqual(byKey(applyPsdDraft(structure(), JSON.parse(JSON.stringify(draft))).layers, l.key).config, l.config);
    assert.equal(isPsdEditorRequest({ type: "psdEditorEdit", requestId: "region", baseVersion: 1, draft }), true);
    byKey(draft.layers, l.key).config.region!.width = 0;
    assert.equal(isPsdEditorRequest({ type: "psdEditorEdit", requestId: "region", baseVersion: 1, draft }), false);
    assert.throws(() => applyPsdDraft(structure(), draft), /无效/);
  } },
  { name: "PSD region participates in native dirty/save/history and survives saved reload", async run() {
    const a = structure(), l = a.layers.find(l => !l.group)!, model = new PsdDocumentModel(a, null);
    const before = model.baseline, next = structuredClone(before); byKey(next.layers, l.key).config.region = { ...region };
    model.update(next, model.version); assert.equal(model.dirty, true);
    model.restore(before); assert.equal(model.dirty, false); assert.equal(byKey(model.asset.layers, l.key).config.region, undefined);
    model.restore(next); assert.deepEqual(byKey(model.asset.layers, l.key).config.region, region);
    let saved: Uint8Array | null = null;
    await model.save({ readSource: async () => bytes, readConfig: async () => null, writeConfig: async value => { saved = value; } });
    assert.equal(model.dirty, false);
    assert.deepEqual(byKey(applySidecar(structure(), JSON.parse(new TextDecoder().decode(saved!))).layers, l.key).config.region, region);
  } },
  { name: "PSD export requires rendered region PNGs and records effective dimensions with nine-grid", run() {
    const a = structure(); for (const l of a.layers) l.config.enabled = false;
    const l = a.layers.find(l => !l.group)!; l.config.enabled = true; l.image = png;
    const original = makeSliceExportBatch(a).items[0]; assert.equal(original.width, l.width); assert.equal(original.height, l.height);
    l.config.region = { ...region }; l.config.nineGrid = { top: 30, right: 100, bottom: 30, left: 100, repeat: false };
    assert.equal(sliceExportIssues(a).length, 0);
    assert.throws(() => makeSliceExportBatch(a), /需先生成自定义区域/);
    const item = makeSliceExportBatch(a, new Map([[l.key, png]])).items[0];
    assert.equal(item.width, 300); assert.equal(item.height, 100); assert.deepEqual(item.nineGrid, l.config.nineGrid);
    assert.equal(l.width, original.width); assert.equal(l.image, png);
    l.config.region = { ...region, width: 200 };
    assert.ok(sliceExportIssues(a).some(issue => issue.keys.includes(l.key) && /区域或九宫格/.test(issue.message)));
    assert.throws(() => makeSliceExportBatch(a, new Map([[l.key, png]])), /区域或九宫格/);
  } }
];
