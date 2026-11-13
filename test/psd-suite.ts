import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPsd } from "ag-psd";
import { parsePsdBinary, patchPsdMetadata } from "../shared/psd-binary";
import { applySidecar, EMPTY_GRID, identityProblems, inheritLayerVisibility, makeSidecar, newLayerIdentity, selectedMergeTree, setGridEdge, validGrid, type PsdAsset, type PsdLayerMeta } from "../shared/psd-meta";
import { isWebviewToHostMessage } from "../shared/protocol";
import { fitPsdCamera, placePsdPanels, zoomPsdCamera } from "../webview/psd/canvas-layout";
import { isCanvasDrag, makePixelMask, maskContains, pickPsdLayer, psdPoint } from "../webview/psd/layer-hit-test";

const sample = () => new Uint8Array(readFileSync(resolve("examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd")));
function asset(): PsdAsset {
  const parsed = parsePsdBinary(sample());
  return { name: "login.psd", sourceHash: "fixture-sha", documentId: (parsed.layers[0].metadata as PsdLayerMeta).documentId, hasEmbeddedIdentity: true, width: parsed.width, height: parsed.height, preview: "", layers: parsed.layers.map(r => ({ key: r.key, nativeId: r.nativeId, parentKey: r.parentKey, name: r.name, group: !!r.divider, left: r.left, top: r.top, width: r.width, height: r.height, hidden: r.hidden, identityOrigin: "embedded", metadata: r.metadata as PsdLayerMeta, config: { enabled: false, name: r.name, nineGrid: null } })) };
}
export const psdTests: { name: string; run: () => void | Promise<void> }[] = [
  { name: "PSD picking follows stacking order and passes through transparent pixels", async run() {
    const original = asset(), base = original.layers.find(l => !l.group)!;
    const front = { ...base, key: 1, parentKey: null, left: 10, top: 20, width: 2, height: 2, image: "front" };
    const back = { ...front, key: 2, image: "back" };
    const source = { ...original, layers: [front, back] };
    const rgba = new Uint8ClampedArray(16); rgba[7] = 255;
    const mask = makePixelMask(rgba, 2, 2);
    const hasPixel = async (layer: { key: number }, x: number, y: number) => layer.key === 2 || maskContains(mask, x, y);
    assert.equal(await pickPsdLayer(source, { x: 11.2, y: 20.2 }, hasPixel), 1);
    assert.equal(await pickPsdLayer(source, { x: 10.2, y: 20.2 }, hasPixel), 2);
    assert.equal(await pickPsdLayer(source, { x: 12, y: 20 }, hasPixel), null);
    assert.equal(await pickPsdLayer(source, { x: -1, y: 20 }, hasPixel), null);
    assert.equal(maskContains(mask, -1, 0), false);
    assert.equal(maskContains(mask, 2, 0), false);
    assert.equal(front.config.enabled, base.config.enabled);
  } },
  { name: "PSD picking ignores groups and inherited hidden layers while text uses its full bounds", async run() {
    const original = asset(), base = original.layers.find(l => !l.group)!;
    const group = { ...base, key: 1, parentKey: null, left: 0, top: 0, width: 20, height: 20, group: true, hidden: true, image: "group" };
    const child = { ...group, key: 2, parentKey: 1, group: false, hidden: false };
    const text = { ...group, key: 3, group: false, hidden: false, text: true };
    const source = { ...original, layers: inheritLayerVisibility([group, child, text]) };
    assert.equal(await pickPsdLayer(source, { x: 5, y: 5 }, async () => false), 3);
    assert.equal(await pickPsdLayer({ ...source, layers: source.layers.slice(0, 2) }, { x: 5, y: 5 }, async () => true), null);
    assert.equal(await pickPsdLayer({ ...source, layers: [{ ...text, image: undefined }] }, { x: 5, y: 5 }, async () => true), null);
  } },
  { name: "PSD click tolerance is screen-based and selection coordinates follow pan and zoom", run() {
    assert.equal(isCanvasDrag({ x: 10, y: 10 }, { x: 14, y: 10 }), false);
    assert.equal(isCanvasDrag({ x: 10, y: 10 }, { x: 14, y: 11 }), true);
    for (const zoom of [.05, .5, 1, 8]) {
      const camera = { x: -140, y: 60, zoom }, expected = { x: 123, y: 246 };
      const point = psdPoint({ x: camera.x + expected.x * zoom, y: camera.y + expected.y * zoom }, camera);
      assert.ok(Math.abs(point.x - expected.x) < 1e-8 && Math.abs(point.y - expected.y) < 1e-8);
    }
  } },
  { name: "PSD zoom preserves the world point under the cursor and respects zoom limits", run() {
    const camera = { x: 240, y: -30, zoom: .8 }, point = { x: 650, y: 420 };
    for (const requested of [.001, .2, 1, 12]) {
      const next = zoomPsdCamera(camera, point, requested);
      assert.ok(next.zoom >= .05 && next.zoom <= 8);
      assert.ok(Math.abs((point.x - camera.x) / camera.zoom - (point.x - next.x) / next.zoom) < 1e-8);
      assert.ok(Math.abs((point.y - camera.y) / camera.zoom - (point.y - next.y) / next.zoom) < 1e-8);
    }
  } },
  { name: "PSD panels follow both edges without scaling their controls", run() {
    const viewport = { width: 1800, height: 1100 }, image = { width: 960, height: 640 }, heights = { left: 500, right: 420 };
    const camera = fitPsdCamera(viewport, image), before = placePsdPanels(viewport, image, camera, heights);
    assert.equal(camera.zoom, 1);
    assert.equal(before.left.width, 278); assert.equal(before.right.width, before.left.width);
    assert.equal(camera.x - before.left.left - before.left.width, 16);
    assert.equal(before.right.left - camera.x - image.width, 16);
    assert.equal(before.left.top, camera.y); assert.equal(before.right.top, camera.y);
    const moved = placePsdPanels(viewport, image, { ...camera, x: camera.x + 20, y: camera.y + 30 }, heights);
    assert.equal(moved.left.left - before.left.left, 20); assert.equal(moved.right.left - before.right.left, 20);
    assert.equal(moved.left.top - before.left.top, 30); assert.equal(moved.right.top - before.right.top, 30);
    const zoomed = placePsdPanels(viewport, image, { ...camera, zoom: .5 }, heights);
    assert.equal(zoomed.left.width, before.left.width); assert.equal(zoomed.right.width, before.right.width);
    assert.equal(zoomed.right.left, camera.x + image.width * .5 + 16);
  } },
  { name: "PSD panels remain visible and disjoint across extreme pan, zoom and viewport sizes", run() {
    for (const viewport of [{ width: 2200, height: 1200 }, { width: 900, height: 600 }, { width: 360, height: 240 }]) {
      for (const x of [-5000, 0, 400, 5000]) for (const y of [-3000, 0, 300, 3000]) for (const zoom of [.05, 1, 8]) {
        const heights = { left: 650, right: 780 };
        const panels = placePsdPanels(viewport, { width: 960, height: 640 }, { x, y, zoom }, heights);
        assert.equal(panels.left.width, panels.right.width);
        for (const side of ["left", "right"] as const) {
          const p = panels[side];
          assert.ok(p.left >= 0 && p.left + p.width <= viewport.width + 1e-8);
          assert.ok(p.top >= 0 && p.top + Math.min(heights[side], p.maxHeight) <= viewport.height);
        }
        assert.ok(panels.left.left + panels.left.width < panels.right.left);
      }
    }
  } },
  { name: "nine-grid bounds preserve a positive center and support zero margins", run() {
    assert.equal(validGrid(EMPTY_GRID, 1, 1), true);
    let grid = setGridEdge(EMPTY_GRID, "left", 80, 100, 40);
    grid = setGridEdge(grid, "right", 50, 100, 40);
    assert.equal(grid.right, 19); assert.equal(grid.left, 80);
    grid = setGridEdge(grid, "top", 100, 100, 40); assert.equal(grid.top, 39);
    assert.equal(setGridEdge(grid, "bottom", -5, 100, 40).bottom, 0);
    assert.equal(validGrid({ ...grid, bottom: 1 }, 100, 40), false);
    assert.equal(validGrid({ ...EMPTY_GRID, left: NaN }, 100, 40), false);
  } },
  { name: "PSD metadata patch preserves all non-GameFlow blocks and original pixel/composite bytes", run() {
    const input = sample(), before = parsePsdBinary(input), button = before.layers.find(r => r.nativeId === 111)!;
    const metadata = { ...button.metadata as PsdLayerMeta, slicing: { enabled: true, name: "button", nineGrid: { top: 8, right: 15, bottom: 9, left: 16, repeat: true } } };
    const output = patchPsdMetadata(input, new Map([[button.key, metadata]])), after = parsePsdBinary(output);
    assert.deepEqual(after.layers.find(r => r.nativeId === 111)!.metadata, metadata);
    assert.deepEqual(output.subarray(0, after.maskLengthAt), input.subarray(0, before.maskLengthAt));
    assert.deepEqual(output.subarray(after.recordsEnd, after.infoEnd), input.subarray(before.recordsEnd, before.infoEnd));
    assert.deepEqual(output.subarray(after.infoEnd, after.maskEnd), input.subarray(before.infoEnd, before.maskEnd));
    assert.deepEqual(output.subarray(after.maskEnd), input.subarray(before.maskEnd));
    for (const old of before.records) {
      const next = after.records.find(r => r.key === old.key)!;
      assert.deepEqual(next.blocks.filter(b => b.key !== "shmd").map(b => output.subarray(b.start, b.end)), old.blocks.filter(b => b.key !== "shmd").map(b => input.subarray(b.start, b.end)));
    }
    const independent = readPsd(output, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
    assert.equal(independent.width, 960); assert.equal(independent.children?.[0].name, "登录页面");
    assert.deepEqual(sample(), input);
  } },
  { name: "PSD patch preserves opaque metadata items and is stable on repeat saves", run() {
    const input = sample(), initial = parsePsdBinary(input), target = initial.layers.find(l => l.nativeId === 111)!;
    const block = target.blocks.find(b => b.key === "shmd")!;
    input.set(new TextEncoder().encode("zzzz"), block.start + 20);
    const before = parsePsdBinary(input), opaque = before.layers.find(l => l.nativeId === 111)!.blocks.find(b => b.key === "shmd")!.items![0].bytes;
    const meta = { ...target.metadata as PsdLayerMeta, customNote: "保留未知字段" };
    const out = patchPsdMetadata(input, new Map([[target.key, meta]])), parsed = parsePsdBinary(out);
    const items = parsed.layers.find(l => l.nativeId === 111)!.blocks.find(b => b.key === "shmd")!.items!;
    assert.deepEqual(items.find(i => i.key === "zzzz")!.bytes, opaque);
    assert.deepEqual(parsed.layers.find(l => l.nativeId === 111)!.metadata, meta);
    assert.deepEqual(patchPsdMetadata(out, new Map([[target.key, meta]])), out);
  } },
  { name: "PSD malformed lengths and unsupported formats fail before decoding", run() {
    assert.throws(() => parsePsdBinary(sample().subarray(0, 80)), /不完整|无效/);
    const psb = sample(); psb[5] = 2; assert.throws(() => parsePsdBinary(psb), /PSB/);
    const big = sample(); new DataView(big.buffer).setUint32(18, 5000); assert.throws(() => parsePsdBinary(big), /尺寸/);
    assert.throws(() => patchPsdMetadata(sample(), new Map([[9999, {}]])), /不存在/);
  } },
  { name: "sidecars round-trip slice settings and reject wrong lineage, duplicates and invalid grids", run() {
    const original = asset(), button = original.layers.find(l => l.nativeId === 111)!;
    button.config = { enabled: true, name: "primary-button", nineGrid: { top: 10, right: 14, bottom: 14, left: 16, repeat: true } };
    button.metadata.customFlag = "keep";
    const meta = makeSidecar(original), restored = applySidecar(asset(), JSON.parse(JSON.stringify(meta)));
    assert.deepEqual(restored.layers.find(l => l.nativeId === 111)!.config, button.config);
    assert.equal(restored.layers.find(l => l.nativeId === 111)!.metadata.customFlag, "keep");
    assert.throws(() => applySidecar(asset(), { ...meta, documentId: "other" }), /谱系/);
    assert.throws(() => applySidecar(asset(), { ...meta, layers: [...meta.layers, meta.layers[0]] }), /重复/);
    const bad = structuredClone(meta); bad.layers.find(l => l.nativeId === 111)!.config.nineGrid!.left = 500;
    assert.throws(() => applySidecar(asset(), bad), /九宫格/);
  } },
  { name: "sidecar restores generated identities only for exactly the same source bytes", run() {
    const original = asset(); original.hasEmbeddedIdentity = false;
    original.layers = original.layers.map(l => ({ ...l, identityOrigin: "new" }));
    const meta = makeSidecar(original), reopened = structuredClone(original);
    reopened.documentId = "new-import-session";
    reopened.layers.forEach((l, i) => { l.metadata.documentId = reopened.documentId; l.metadata.layerId = "generated" + i; });
    const restored = applySidecar(reopened, meta);
    assert.equal(restored.documentId, original.documentId);
    assert.deepEqual(restored.layers.map(l => l.metadata.layerId), original.layers.map(l => l.metadata.layerId));
    reopened.sourceHash = "changed";
    assert.throws(() => applySidecar(reopened, meta), /谱系/);
  } },
  { name: "duplicate repair allocates an identity for only the selected copy", run() {
    const original = asset(), copy = structuredClone(original.layers[1]); copy.key = 999; copy.nativeId = 999; original.layers.push(copy);
    assert.deepEqual(identityProblems(original), [copy.metadata.layerId]);
    assert.throws(() => makeSidecar(original), /重复 ID/);
    const repaired = newLayerIdentity(original, copy.key);
    assert.equal(identityProblems(repaired).length, 0);
    assert.equal(repaired.layers[1].metadata.layerId, original.layers[1].metadata.layerId);
    assert.notEqual(repaired.layers.at(-1)!.metadata.layerId, copy.metadata.layerId);
    const restored = applySidecar(original, makeSidecar(repaired));
    assert.deepEqual(restored.layers.map(l => l.metadata.layerId), repaired.layers.map(l => l.metadata.layerId));
    assert.throws(() => applySidecar({ ...original, sourceHash: "changed" }, makeSidecar(repaired)), /重复 ID/);
  } },
  { name: "partial sidecars cannot create mixed document lineages", run() {
    const original = asset(), meta = makeSidecar(original);
    original.hasEmbeddedIdentity = false;
    original.documentId = "reopened";
    original.layers.forEach(l => { l.metadata = { ...l.metadata, documentId: "reopened" }; });
    assert.throws(() => applySidecar(original, { ...meta, layers: meta.layers.slice(1) }), /混合谱系/);
  } },
  { name: "merge selections retain ancestors, source choice and inherited hidden state", run() {
    const a = asset(), b = structuredClone(a), button = a.layers.find(l => l.nativeId === 111)!;
    a.layers.forEach(l => { if (!l.group) l.image = "image-a"; });
    b.layers.forEach(l => { if (!l.group) l.image = "image-b"; });
    const parent = b.layers.find(l => l.key === button.parentKey)!;
    parent.hidden = true;
    b.layers = inheritLayerVisibility([...b.layers].reverse()).reverse();
    assert.equal(b.layers.find(l => l.key === button.key)!.hidden, true);
    assert.equal(a.layers.find(l => l.key === button.key)!.hidden, false);
    const result = selectedMergeTree({ A: a, B: b }, { [button.metadata.documentId + ":" + button.metadata.layerId]: "B" })!;
    assert.equal(result.layers.filter(l => !l.group).length, 1);
    const selected = result.layers.find(l => !l.group)!;
    assert.equal(selected.image, "image-b"); assert.equal(selected.hidden, true);
    assert.equal(result.layers.find(l => l.key === selected.parentKey)!.metadata.layerId, parent.metadata.layerId);
    for (const l of result.layers) assert.ok(l.parentKey === null || result.layers.some(p => p.key === l.parentKey && p.group));
  } },
  { name: "PSD output protocol accepts basenames and rejects paths and device names", run() {
    const request = { type: "psdOutput", requestId: "test", name: "login.meta.json", kind: "meta", base64: "e30=" };
    assert.equal(isWebviewToHostMessage(request), true);
    for (const name of ["../login.meta.json", "C:\\login.meta.json", "CON.meta.json", "login.txt"]) assert.equal(isWebviewToHostMessage({ ...request, name }), false);
    assert.equal(isWebviewToHostMessage({ ...request, base64: "???" }), false);
  } },
];
