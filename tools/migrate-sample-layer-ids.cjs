// Explicit, one-time asset migration. Preview by default; pass --write to persist.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gameflow-layer-ids-'));
let shared;
try {
  const output = path.join(temporary, 'shared.cjs');
  require('esbuild').buildSync({ stdin: { contents: 'export * from "./shared/psd-binary"; export * from "./shared/element-id"; export * from "./shared/model";', resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', outfile: output });
  shared = require(output);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const parseJson = (file, text) => {
  const parsed = ts.parseConfigFileTextToJson(file, text.replace(/^\uFEFF/, ''));
  assert.equal(parsed.error, undefined, `Invalid JSON/JSONC: ${file}`);
  return parsed.config;
};
const files = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'engine', 'plugins', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.(psd|json|js|cjs|md|html|ls|lh|meta)$/i.test(file)) files.push(file);
  }
}
for (const directory of ['sample', 'examples']) collect(path.join(root, directory));
const reserved = new Set(), legacy = new Set(), psds = [], texts = [];
function inspect(value) {
  if (typeof value === 'string') reserved.add(value);
  else if (value && typeof value === 'object') {
    if (typeof value.layerId === 'string' && uuid.test(value.layerId)) legacy.add(value.layerId);
    for (const child of Object.values(value)) inspect(child);
  }
}
for (const file of files) {
  const bytes = fs.readFileSync(file);
  if (/\.psd$/i.test(file)) {
    const parsed = shared.parsePsdBinary(bytes);
    for (const layer of parsed.layers) inspect(layer.metadata);
    psds.push({ file, bytes, parsed });
  } else {
    const text = bytes.toString('utf8');
    if (/\.json$/i.test(file)) inspect(parseJson(file, text));
    for (const id of text.match(/\b[a-z0-9]{8}\b/g) ?? []) reserved.add(id);
    texts.push({ file, text });
  }
}
const mapping = new Map([...legacy].sort().map(id => [id, shared.allocateElementId(reserved)]));
const replacements = new Map(mapping), changes = [];
const replace = text => {
  for (const [before, after] of replacements) text = text.replaceAll(before, after);
  return text;
};
for (const { file, bytes, parsed } of psds) {
  const updates = new Map();
  for (const layer of parsed.layers) {
    if (!layer.metadata) continue;
    const before = JSON.stringify(layer.metadata), after = replace(before);
    if (after !== before) updates.set(layer.key, JSON.parse(after));
  }
  if (!updates.size) continue;
  const patched = Buffer.from(shared.patchPsdMetadata(bytes, updates));
  const next = shared.parsePsdBinary(patched);
  assert.equal(next.layers.length, parsed.layers.length);
  for (const layer of next.layers) {
    if (updates.has(layer.key)) assert.deepEqual(layer.metadata, updates.get(layer.key));
  }
  // Channel data and merged preview must be byte-identical after metadata edits.
  assert.deepEqual(patched.subarray(next.recordsEnd, next.infoEnd), bytes.subarray(parsed.recordsEnd, parsed.infoEnd));
  assert.deepEqual(patched.subarray(next.infoEnd), bytes.subarray(parsed.infoEnd));
  for (let i = 0; i < parsed.records.length; i++) {
    const a = parsed.records[i], b = next.records[i];
    for (const key of ['name', 'nativeId', 'parentKey', 'left', 'top', 'width', 'height', 'hidden', 'divider']) assert.deepEqual(b[key], a[key]);
    assert.deepEqual(patched.subarray(b.start, b.extraLengthAt), bytes.subarray(a.start, a.extraLengthAt));
    const blocks = (source, record) => record.blocks.filter(block => block.key !== 'shmd').map(block => source.subarray(block.start, block.end));
    assert.deepEqual(blocks(patched, b), blocks(bytes, a));
  }
  replacements.set(hash(bytes), hash(patched));
  changes.push({ file, bytes: patched });
}
for (const { file, text } of texts) {
  const updated = replace(text);
  if (updated === text) continue;
  if (/\.json$/i.test(file)) {
    const data = parseJson(file, updated);
    if (/\.gameflow\.json$/i.test(file)) {
      const validation = shared.validateGameFlowDocument(data);
      assert.equal(validation.ok, true, JSON.stringify(validation.errors));
    }
  }
  changes.push({ file, bytes: Buffer.from(updated) });
}
const report = { layerIds: Object.fromEntries(mapping), sourceHashes: Object.fromEntries([...replacements].filter(([key]) => !mapping.has(key))), files: changes.map(change => path.relative(root, change.file)) };
if (process.argv.includes('--write')) {
  for (const change of changes) fs.writeFileSync(change.file, change.bytes);
  if (changes.length) fs.writeFileSync(path.join(root, 'docs/spec/existing-psd-layer-id-migration-report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'write' : 'preview', ...report }, null, 2));
