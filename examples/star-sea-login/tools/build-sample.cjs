// Paired sample generator only; this is not the editor's general PSD export path.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const ag = require("ag-psd");
const writer = require("ag-psd/dist/psdWriter.js");
const { infoHandlersMap } = require("ag-psd/dist/additionalInfo.js");
const { readMetadata } = require("../../psd-metadata/metadata-reader.js");
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "../..");
const assetsDir = process.argv[2];
if (!assetsDir) throw new Error("Usage: node examples/star-sea-login/tools/build-sample.cjs <generated assets>");
assert.equal(require("ag-psd/package.json").version, "34.2.0");

// Rebuild this checked-in example directly from its design source.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-login-"));
let shared;
try {
  const out = path.join(temp, "shared.cjs");
  require("esbuild").buildSync({
    stdin: { contents: 'export * from "./shared/model"; export * from "./shared/element-id"; export * from "./shared/ui-layout"; export * from "./shared/ui-components"; export * from "./shared/psd-meta"; export * from "./shared/psd-binary"; export * from "./shared/psd-export";', resolveDir: repo },
    bundle: true, platform: "node", format: "cjs", outfile: out,
  });
  shared = require(out);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

const design = JSON.parse(fs.readFileSync(path.join(root, "design.json"), "utf8"));
const assets = JSON.parse(fs.readFileSync(path.join(assetsDir, "assets.json"), "utf8"));
const identityPath = path.join(root, "identities.json");
const ids = fs.existsSync(identityPath) ? JSON.parse(fs.readFileSync(identityPath, "utf8")) : {
  prototypeDocumentId: randomUUID(), psdDocumentId: randomUUID(), elements: {}, layers: {},
};
const reserved = new Set([...Object.values(ids.elements), ...Object.values(ids.layers)]);
const id = (table, key) => ids[table][key] ?? (ids[table][key] = shared.allocateElementId(reserved));
const pageId = id("elements", "page");
const transparent = { fill: "transparent", borderColor: "transparent", borderWidth: 0, radius: 0, fontWeight: 400 };
const assetOut = path.join(root, "assets");
fs.mkdirSync(assetOut, { recursive: true });
const atlasName = "login";
const startButtonExportName = "start";
const startNormalName = `btn_${atlasName}_${startButtonExportName}_normal`;
const nodes = design.nodes.map(n => {
  const node = {
    id: id("elements", n.key), name: n.name, variableName: n.variableName, type: n.type,
    frame: n.frame, ...(n.parent ? { parentId: id("elements", n.parent) } : {}),
    layout: n.layout, style: { ...transparent },
  };
  if (n.type === "image") {
    const png = fs.readFileSync(path.join(assetsDir, n.key + ".png"));
    fs.writeFileSync(path.join(assetOut, n.key + ".png"), png);
    node.image = { ...n.image, art: { path: "unclassified/" + n.key + ".png", source: { documentId: ids.psdDocumentId, layerId: id("layers", n.key + ".pixels") } } };
    node.widget = { imageFit: "fill" };
  } else if (n.type === "button") {
    node.normalSkin = { ...n.normalSkin, art: { path: `unclassified/${startNormalName}.png`, source: { documentId: ids.psdDocumentId, layerId: id("layers", n.normalAsset + ".pixels") } } };
    fs.copyFileSync(path.join(assetsDir, n.normalAsset + ".png"), path.join(assetOut, n.normalAsset + ".png"));
  } else if (n.type === "text") {
    node.text = n.text;
    node.style = { ...transparent, color: n.color, fontSize: n.fontSize, textAlign: "center" };
    node.widget = { wordWrap: false, overflow: "hidden", valign: "middle" };
  }
  return node;
});
const document = shared.parseGameFlowDocument(JSON.stringify({
  schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: ids.prototypeDocumentId, title: design.name,
  requirements: [{ id: "portrait-login", text: "按参考界面制作750×1334竖版登录页；按钮自身 normalSkin 提供图片，文字由独立 UILabel 子节点提供。", status: "confirmed", source: "用户截图及2026-11-16尺寸要求" }],
  pages: [{ id: pageId, name: "星海远征 · 登录", kind: "screen", rootType: "UIStack", frame: { x: 0, y: 0, width: design.width, height: design.height }, background: design.background, nodes }],
  interactions: [],
}));
const page = document.pages[0], resolved = shared.resolvePageLayout(page);
assert.deepEqual(resolved.issues, []);
for (const definition of design.nodes) {
  const geometry = resolved.nodes.get(id("elements", definition.key));
  assert.deepEqual(geometry.local, definition.frame, `${definition.key}: authored and resolved frames differ`);
  assert.ok(geometry.absolute.x >= 0 && geometry.absolute.y >= 0);
  assert.ok(geometry.absolute.x + geometry.absolute.width <= design.width);
  assert.ok(geometry.absolute.y + geometry.absolute.height <= design.height);
  if (assets[definition.key]) {
    assert.equal(geometry.absolute.x, assets[definition.key].left);
    assert.equal(geometry.absolute.y, assets[definition.key].top);
  }
}
assert.equal(nodes.filter(n => n.type === "text").length, 5);
const button = nodes.find(n => n.type === "button");
assert.equal(button.text, undefined);
assert.deepEqual(nodes.filter(n => n.parentId === button.id).map(n => n.type), ["text"]);
const prototypePath = path.join(repo, "sample/star-sea-login.gameflow.json");
fs.writeFileSync(prototypePath, shared.serializeGameFlowDocument(document));
fs.copyFileSync(prototypePath, path.join(root, "star-sea-login.gameflow.json"));

ag.initializeCanvas(() => { throw new Error("Raster caches are supplied explicitly"); },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }));
// Retain standard shmd entries and append the existing experimental gflw metadata format.
const handler = infoHandlersMap.shmd;
const originalHas = handler.has, originalWrite = handler.write;
handler.has = target => target.gameflowMetadata !== undefined || originalHas(target);
handler.write = (w, target, ...args) => {
  const start = w.offset;
  originalWrite(w, target, ...args);
  if (!target.gameflowMetadata) return;
  w.view.setUint32(start, w.view.getUint32(start) + 1, false);
  let data = Buffer.from(JSON.stringify(target.gameflowMetadata), "utf8");
  data = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 0x20)]);
  writer.writeSignature(w, "8BIM"); writer.writeSignature(w, "gflw");
  writer.writeUint8(w, 1); writer.writeZeros(w, 3);
  writer.writeUint32(w, data.length); writer.writeBytes(w, data);
};
let nativeId = 200;
const bindings = [];
function meta(key, role, extra = {}) {
  return { namespace: "com.codetypes.gameflow", version: 1, documentId: ids.psdDocumentId, layerId: id("layers", key), role, atlasName, ...extra };
}
function prototypeRef(key, layaClass) {
  return { documentId: ids.prototypeDocumentId, pageId, nodeId: id("elements", key), layaClass };
}
function raster(key) {
  const a = assets[key];
  return { left: a.left, top: a.top, imageData: { width: a.width, height: a.height,
    data: new Uint8ClampedArray(fs.readFileSync(path.join(assetsDir, key + ".rgba"))) } };
}
function layer(n) {
  const layaClass = shared.COMPONENTS[n.type].laya;
  const ref = prototypeRef(n.key, layaClass);
  const base = { id: ++nativeId, name: `${n.name} (${layaClass})`, gameflowMetadata: meta(n.key, n.type === "image" ? "asset.export-group" : n.type, { prototype: ref }) };
  const binding = { prototype: ref, psd: { documentId: ids.psdDocumentId, layerId: base.gameflowMetadata.layerId, nativeId: base.id }, name: n.name, frame: resolved.nodes.get(ref.nodeId).absolute };
  bindings.push(binding);
  if (n.type === "image") {
    const pixelId = ++nativeId;
    base.opened = false;
    base.children = [{ id: pixelId, name: `${n.name} · 像素`, ...raster(n.key),
      gameflowMetadata: meta(n.key + ".pixels", "asset.raster", {
        exportGroupId: base.gameflowMetadata.layerId, prototype: { ...ref, slot: "image" },
        slicing: { enabled: true, name: n.key, exportName: n.key, nineGrid: n.nineGrid ?? null },
        ...(n.key === "button_bg" ? { state: "normal" } : {}),
      }) }];
    binding.asset = { path: `assets/${n.key}.png`, rasterLayerId: base.children[0].gameflowMetadata.layerId, nativeId: pixelId, nineGrid: n.nineGrid ?? null };
  } else if (n.type === "button") {
    base.opened = true;
    base.gameflowMetadata.slicing = { enabled: false, name: base.name, exportName: startButtonExportName, nineGrid: null };
    const key = n.normalAsset, definition = design.resources.find(r => r.key === key), pixelId = ++nativeId;
    base.children = [{ id: pixelId, name: "@normal", ...raster(key), gameflowMetadata: meta(key + ".pixels", "asset.raster", { prototype: { ...ref, slot: "normalSkin" }, slicing: { enabled: true, name: "@normal", nineGrid: definition.nineGrid ?? null } }) }, ...design.nodes.filter(child => child.parent === n.key).map(layer)];
    binding.asset = { path: "assets/" + key + ".png", slot: "normalSkin", rasterLayerId: base.children[0].gameflowMetadata.layerId, nativeId: pixelId, nineGrid: definition.nineGrid ?? null };
  } else if (n.type === "text") {
    Object.assign(base, raster(n.key), { text: assets[n.key].text });
  } else {
    base.opened = false;
    base.children = design.nodes.filter(child => child.parent === n.key).map(layer);
  }
  return base;
}
const psdPage = { id: ++nativeId, name: "星海远征 · 登录 (UIStack)", opened: true,
  gameflowMetadata: meta("page", "screen", { prototype: prototypeRef("page", "UIStack") }),
  children: design.nodes.filter(n => !n.parent).map(layer) };
bindings.unshift({ prototype: prototypeRef("page", "UIStack"), psd: { documentId: ids.psdDocumentId, layerId: psdPage.gameflowMetadata.layerId, nativeId: psdPage.id }, name: page.name, frame: page.frame });
const psd = { width: design.width, height: design.height,
  imageData: { width: design.width, height: design.height, data: new Uint8ClampedArray(fs.readFileSync(path.join(assetsDir, "composite.rgba"))) },
  imageResources: { resolutionInfo: { horizontalResolution: 72, horizontalResolutionUnit: "PPI", widthUnit: "Inches", verticalResolution: 72, verticalResolutionUnit: "PPI", heightUnit: "Inches" } },
  children: [psdPage] };
const psdName = "Star-Sea-Login-750x1334.psd";
const psdPath = path.join(root, psdName);
fs.writeFileSync(psdPath, ag.writePsdBuffer(psd, { invalidateTextLayers: false, generateThumbnail: false }));
fs.copyFileSync(path.join(assetsDir, "artwork-preview.png"), path.join(root, "artwork-preview.png"));
const bytes = fs.readFileSync(psdPath);
const parsed = shared.parsePsdBinary(bytes), independent = readMetadata(bytes);
assert.equal(parsed.width, 750); assert.equal(parsed.height, 1334);
assert.equal(parsed.layers.length, 21);
assert.equal(independent.layers.length, 21);
assert.equal(new Set(parsed.layers.map(l => l.metadata.layerId)).size, 21);
for (const record of parsed.layers) {
  assert.deepEqual(record.metadata, independent.layers.find(l => l.metadata.layerId === record.metadata.layerId).metadata);
  assert.equal(record.metadata.documentId, ids.psdDocumentId);
}
const decoded = ag.readPsd(bytes, { useImageData: true });
let textCount = 0, groupCount = 0, rasterCount = 0;
function verify(n, parent) {
  if (n.text) textCount++;
  if (n.children) groupCount++;
  if (n.imageData) rasterCount++;
  if (n.imageData && !n.text) assert.ok((parent.children.length === 1 && parent.name.includes("UIImage")) || (n.name === "@normal" && parent.name.includes("UIButton")));
  (n.children ?? []).forEach(child => verify(child, n));
}
decoded.children.forEach(n => verify(n, null));
assert.equal(textCount, 5); assert.equal(groupCount, 10); assert.equal(rasterCount, 11);
assert.deepEqual(Buffer.from(decoded.imageData.data), Buffer.from(psd.imageData.data));
assert.equal(new Set(bindings.map(b => b.prototype.nodeId)).size, 15);
assert.equal(new Set(bindings.map(b => b.psd.layerId)).size, 15);
for (const binding of bindings) {
  const l = parsed.layers.find(l => l.metadata.layerId === binding.psd.layerId);
  assert.deepEqual(l.metadata.prototype, binding.prototype);
  if (binding.asset) {
    const r = parsed.layers.find(l => l.metadata.layerId === binding.asset.rasterLayerId);
    assert.equal(r.parentKey, l.key);
    assert.ok(shared.validConfig(r.metadata.slicing, r.width, r.height));
    assert.equal(r.metadata.slicing.enabled, true);
  }
}
const hash = createHash("sha256").update(bytes).digest("hex");
const asset = { name: psdName, atlasName, sourceHash: hash, documentId: ids.psdDocumentId, hasEmbeddedIdentity: true,
  width: design.width, height: design.height, preview: "", layers: parsed.layers.map(r => ({
    key: r.key, nativeId: r.nativeId, parentKey: r.parentKey, name: r.name, group: !!r.divider,
    left: r.left, top: r.top, width: r.width, height: r.height, hidden: r.hidden,
    identityOrigin: "embedded", metadata: r.metadata,
    config: r.metadata.slicing ?? { enabled: false, name: r.name, nineGrid: null },
  })) };
assert.equal(shared.effectiveExportName(asset, asset.layers.find(l => l.name === "@normal")), startNormalName);
const sidecar = shared.makeSidecar(asset);
assert.deepEqual(shared.makeSidecar(shared.applySidecar(asset, sidecar)), sidecar);
fs.writeFileSync(path.join(root, "Star-Sea-Login-750x1334.meta.json"), JSON.stringify(sidecar, null, 2) + "\n");
fs.writeFileSync(path.join(root, "prototype-psd-map.json"), JSON.stringify({ schema: "gameflow.sample.prototype-psd-map", version: 1, experimental: true,
  prototype: "star-sea-login.gameflow.json", psd: psdName, psdSha256: hash, bindings }, null, 2) + "\n");
fs.writeFileSync(identityPath, JSON.stringify(ids, null, 2) + "\n");
const report = { width: design.width, height: design.height, prototypeNodes: nodes.length, bindings: bindings.length,
  groups: groupCount, editableTextRecords: textCount, imageExportGroups: 5, rasterLayers: rasterCount - textCount,
  taggedRecords: parsed.layers.length, psdBytes: bytes.length, sourceHash: hash,
  prototypeCodecAndLayout: "passed", metadataIndependentReader: "passed", savedCompositeBytes: "exact match",
  imageGroupsExcludeLabels: "passed", photoshopRoundTrip: "not executed" };
fs.writeFileSync(path.join(root, "verification.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ prototypePath, psdPath, ...report }, null, 2));
