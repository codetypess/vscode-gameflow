// Experimental fixture writer only: pinned ag-psd internal handler extension, not a general PSD rewriter.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { readMetadata, summarize } = require('../metadata-reader.js');
const [dependencyRoot, assetsDir] = process.argv.slice(2);
if (!dependencyRoot || !assetsDir) throw new Error('Usage: node build-sample.cjs <temp node_modules> <generated assets>');
const packageRoot = path.join(dependencyRoot, 'ag-psd');
const ag = require(packageRoot);
const writer = require(path.join(packageRoot, 'dist/psdWriter.js'));
const { infoHandlersMap } = require(path.join(packageRoot, 'dist/additionalInfo.js'));
const version = require(path.join(packageRoot, 'package.json')).version;
assert.equal(version, '34.2.0');
ag.initializeCanvas(() => { throw new Error('Raster data is provided explicitly'); },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }));

// PSD shmd is a list of metadata entries with unique four-byte keys.
// Keep the library's standard entries, then append our experimental gflw entry.
const handler = infoHandlersMap.shmd;
const previousHas = handler.has, previousWrite = handler.write;
handler.has = target => target.gameflowMetadata !== undefined || previousHas(target);
handler.write = (w, target, ...args) => {
  const start = w.offset;
  previousWrite(w, target, ...args);
  if (!target.gameflowMetadata) return;
  w.view.setUint32(start, w.view.getUint32(start) + 1, false);
  let data = Buffer.from(JSON.stringify(target.gameflowMetadata), 'utf8');
  // Include trailing JSON whitespace in its declared length, so entries are four-byte aligned.
  data = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 0x20)]);
  writer.writeSignature(w, '8BIM'); writer.writeSignature(w, 'gflw');
  writer.writeUint8(w, 1); writer.writeZeros(w, 3);
  writer.writeUint32(w, data.length); writer.writeBytes(w, data);
};

const out = path.resolve(__dirname, '..');
const assets = JSON.parse(fs.readFileSync(path.join(assetsDir, 'assets.json'), 'utf8'));
const documentId = 'e123ed86-4302-4e79-b97f-3fcb7cc80911';
let nextNativeId = 100;
function metadata(layerId, role, extra = {}) {
  return { namespace: 'com.codetypes.gameflow', version: 1, documentId, layerId, role, ...extra };
}
function pixels(key) {
  const a = assets.layers[key];
  return { left: a.left, top: a.top, imageData: { width: a.width, height: a.height,
    data: new Uint8ClampedArray(fs.readFileSync(path.join(assetsDir, key + '.rgba'))) }, ...(a.text ? { text: a.text } : {}) };
}
function layer(name, key, id, role, extra = {}) {
  return { name, id: ++nextNativeId, ...pixels(key), gameflowMetadata: metadata(id, role, extra) };
}
function group(name, id, role, children) {
  return { name, id: ++nextNativeId, opened: true, children, gameflowMetadata: metadata(id, role) };
}
// ag-psd children use drawing order: bottom first, top last.
const page = group('登录页面', 'p7k2m9qa', 'screen', [
  group('背景', 'b4n8q2mw', 'background.group', [
    layer('深空渐变', 'background', 'a2m6v9qr', 'background.fill'),
    layer('星点与轨道', 'stars', 's5j3c8nx', 'background.decoration'),
  ]),
  group('标题区', 't8r4w2ka', 'title.group', [
    layer('星海徽记', 'emblem', 'e9u2h6cb', 'title.emblem'),
    layer('游戏标题', 'title', 'g6d1p8ws', 'title.text'),
    layer('副标题', 'subtitle', 'u3f7k2ja', 'title.subtitle'),
  ]),
  group('服务器信息', 'v4r8n3qy', 'server.group', [
    layer('服务器底板', 'server_bg', 'c2k5m9xp', 'server.background'),
    layer('服务器名称', 'server_text', 'n8a3f7kr', 'server.label'),
  ]),
  group('开始按钮', 'k7c2v8mz', 'button', [
    layer('按钮底图', 'button_bg', 'm7k3p2qa', 'button.background', { state: 'normal', slice: { left: 20, top: 20, right: 20, bottom: 20 } }),
    layer('按钮文字', 'button_text', 'l9w4b6ns', 'button.label', { state: 'normal' }),
  ]),
  layer('底部提示', 'footer', 'f5v2d8hc', 'footer.text'),
]);
const psd = {
  width: assets.width, height: assets.height,
  imageData: { width: assets.width, height: assets.height, data: new Uint8ClampedArray(fs.readFileSync(path.join(assetsDir, 'composite.rgba'))) },
  imageResources: { resolutionInfo: { horizontalResolution: 72, horizontalResolutionUnit: 'PPI', widthUnit: 'Inches', verticalResolution: 72, verticalResolutionUnit: 'PPI', heightUnit: 'Inches' } },
  children: [page],
};
const file = path.join(out, 'GameFlow-PSD-Metadata-Sample.psd');
fs.writeFileSync(file, ag.writePsdBuffer(psd, { invalidateTextLayers: false, generateThumbnail: false }));
fs.copyFileSync(path.join(assetsDir, 'preview.png'), path.join(out, 'preview.png'));

// Read the file from disk through a separate, bounded binary parser.
const saved = fs.readFileSync(file);
const parsed = readMetadata(saved);
const summary = summarize(parsed);
assert.equal(parsed.width, 960); assert.equal(parsed.height, 640);
assert.equal(summary.total, 15); assert.equal(summary.tagged, 15);
assert.deepEqual(summary.duplicateIds, []);
const expected = new Map();
function collect(n) { expected.set(n.gameflowMetadata.layerId, n.gameflowMetadata); (n.children || []).forEach(collect); }
collect(page);
for (const l of parsed.layers) {
  assert.match(l.metadata.layerId, /^[a-z][a-z0-9]{7}$/);
  assert.deepEqual(l.metadata, expected.get(l.metadata.layerId));
}
const decoded = ag.readPsd(saved, { useImageData: true });
let textCount = 0, pixelCount = 0;
function count(n) { if (n.text) textCount++; if (n.imageData) pixelCount++; (n.children || []).forEach(count); }
decoded.children.forEach(count);
assert.equal(textCount, 5); assert.equal(pixelCount, 10);
assert.deepEqual(Buffer.from(decoded.imageData.data), Buffer.from(psd.imageData.data));

// The binding manifest is supplemental; the identities above were read from PSD itself.
const manifest = {
  fixtureVersion: 1, writer: `ag-psd@${version} + experimental shmd/gflw entry`,
  metadataLocation: 'Layer record / Additional Layer Information / shmd / 8BIM:gflw / UTF-8 JSON',
  photoshopRoundTrip: 'pending art-team test',
  ...parsed,
  prototypeBindings: [
    { prototypeNodeId: 'h2m5v8za', layerIds: ['p7k2m9qa'] },
    { prototypeNodeId: 'w6r3k9nc', layerIds: ['k7c2v8mz', 'm7k3p2qa', 'l9w4b6ns'] },
  ],
};
fs.writeFileSync(path.join(out, 'expected-metadata.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'baseline-data.js'), 'window.GAMEFLOW_BASELINE = ' + JSON.stringify(parsed) + ';\n');
console.log(JSON.stringify({ file, bytes: saved.length, ...summary, textCount, pixelCount, compositeMatches: true }, null, 2));
