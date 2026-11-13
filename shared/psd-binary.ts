/** Restricted PSD v1 parser and surgical metadata patcher. Never re-encodes art content. */
export type MetadataItem = { key: string; bytes: Uint8Array; data: Uint8Array };
type Block = { key: string; start: number; end: number; items?: MetadataItem[] };
export type PsdRecord = { key: number; start: number; extraLengthAt: number; extraStart: number; tagsStart: number; tagsEnd: number; end: number; blocks: Block[]; nativeId: number | null; name: string; divider: number; left: number; top: number; width: number; height: number; hidden: boolean; metadata: unknown; parentKey: number | null };
export type ParsedPsd = { width: number; height: number; records: PsdRecord[]; layers: PsdRecord[]; maskLengthAt: number; maskEnd: number; infoStart: number; infoEnd: number; recordsEnd: number };
const utf8 = new TextDecoder("utf-8", { fatal: true });
const concat = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0)); let p = 0; for (const b of parts) { out.set(b, p); p += b.length; } return out; };
const u32bytes = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
const text = (s: string) => new TextEncoder().encode(s);

export function parsePsdBinary(bytes: Uint8Array): ParsedPsd {
  if (bytes.length > 32 * 1024 * 1024) throw new Error("当前支持不超过 32 MB 的 PSD。");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let p = 0;
  const need = (n: number, end = bytes.length) => { if (!Number.isSafeInteger(n) || n < 0 || p + n > end) throw new Error("PSD 区块长度无效或文件不完整。"); };
  const skip = (n: number) => { need(n); p += n; };
  const u16 = () => { need(2); const n = v.getUint16(p); p += 2; return n; };
  const u32 = () => { need(4); const n = v.getUint32(p); p += 4; return n; };
  const i32 = () => { need(4); const n = v.getInt32(p); p += 4; return n; };
  const ascii = (n: number) => { need(n); const s = String.fromCharCode(...bytes.subarray(p, p + n)); p += n; return s; };
  if (ascii(4) !== "8BPS" || u16() !== 1) throw new Error("当前支持标准 PSD，暂不支持 PSB。");
  skip(6); u16(); const height = u32(), width = u32();
  if (u16() !== 8 || u16() !== 3) throw new Error("当前支持 8 位 RGB PSD。");
  if (!width || !height || width > 4096 || height > 4096 || width * height > 8_000_000) throw new Error("PSD 尺寸超出当前预览范围（4096 边长 / 800 万像素）。");
  skip(u32()); skip(u32());
  const maskLengthAt = p, maskLength = u32(); need(maskLength); const maskEnd = p + maskLength;
  const infoLength = u32(); need(infoLength, maskEnd); const infoStart = p, infoEnd = p + infoLength;
  if (!infoLength) throw new Error("PSD 没有可编辑图层信息。");
  const rawCount = u16(), count = Math.abs(rawCount > 32767 ? rawCount - 65536 : rawCount);
  if (count > 256) throw new Error("当前支持不超过 128 个图层及其分组标记。");
  const records: PsdRecord[] = []; let pixels = width * height;
  for (let key = 0; key < count; key++) {
    need(18, infoEnd); const start = p, top = i32(), left = i32(), bottom = i32(), right = i32();
    const w = right - left, h = bottom - top;
    if (w < 0 || h < 0 || w > 4096 || h > 4096 || (pixels += w * h) > 24_000_000) throw new Error("图层累计像素超出当前解码预算。");
    skip(u16() * 6); if (ascii(4) !== "8BIM") throw new Error("无效图层签名。"); skip(5); need(3); skip(1); const hidden = !!(bytes[p] & 2); skip(2);
    const extraLengthAt = p, extraLength = u32(); need(extraLength, infoEnd); const extraStart = p, end = p + extraLength;
    skip(u32()); skip(u32()); need(1, end); const n = bytes[p++]; let name = ascii(n); skip((4 - (n + 1) % 4) % 4);
    const tagsStart = p; const blocks: Block[] = []; let nativeId: number | null = null, divider = 0, metadata: unknown = undefined;
    while (p + 12 <= end) {
      const blockStart = p, signature = ascii(4), blockKey = ascii(4), length = u32();
      if (signature !== "8BIM") throw new Error("该 PSD 的扩展区块暂不支持安全写回。");
      need(length, end); const blockEnd = p + length; let items: MetadataItem[] | undefined;
      if (blockKey === "luni") { const size = u32(); need(size * 2, blockEnd); name = ""; for (let i = 0; i < size; i++) name += String.fromCharCode(u16()); name = name.replace(/\0+$/, ""); }
      if (blockKey === "lyid") { need(4, blockEnd); nativeId = u32(); }
      if (blockKey === "lsct" || blockKey === "lsdk") { need(4, blockEnd); divider = u32(); }
      if (blockKey === "shmd") {
        need(4, blockEnd); const itemCount = u32(); items = [];
        for (let i = 0; i < itemCount; i++) {
          need(16, blockEnd); const itemStart = p, signature = ascii(4), itemKey = ascii(4); skip(4); const size = u32(); need(size, blockEnd);
          if (signature !== "8BIM" && signature !== "8ELE") throw new Error("PSD 元数据签名不支持。");
          const data = bytes.subarray(p, p + size); skip(size);
          if (itemKey === "gflw") { if (metadata !== undefined) throw new Error("同一图层有多份 GameFlow 元数据。"); metadata = JSON.parse(utf8.decode(data).trim()); }
          items.push({ key: itemKey, bytes: bytes.subarray(itemStart, p), data });
        }
        // Padded zeros are harmless; nonzero unknown tail cannot be safely rewritten.
        if (bytes.subarray(p, blockEnd).some(b => b !== 0)) throw new Error("PSD 元数据存在未识别尾部，已停止写入。");
      }
      p = blockEnd; if (length % 2) { need(1, end); p++; }
      blocks.push({ key: blockKey, start: blockStart, end: p, items });
    }
    records.push({ key, start, extraLengthAt, extraStart, tagsStart, tagsEnd: p, end, blocks, nativeId, name, divider, left, top, width: w, height: h, hidden, metadata, parentKey: null }); p = end;
  }
  const recordsEnd = p, layers: PsdRecord[] = [], stack: number[] = [];
  for (const r of [...records].reverse()) {
    if (r.divider === 3) { stack.pop(); continue; }
    r.parentKey = stack.at(-1) ?? null; layers.push(r);
    if (r.divider === 1 || r.divider === 2) stack.push(r.key);
  }
  if (layers.length > 128) throw new Error("当前支持最多 128 个图层/分组。");
  return { width, height, records, layers, maskLengthAt, maskEnd, infoStart, infoEnd, recordsEnd };
}

export function patchPsdMetadata(source: Uint8Array, updates: Map<number, unknown>): Uint8Array {
  const doc = parsePsdBinary(source);
  if ([...updates.keys()].some(key => !doc.layers.some(r => r.key === key))) throw new Error("元数据引用了不存在的 PSD 图层。");
  const patched = doc.records.map(r => {
    if (!updates.has(r.key)) return source.subarray(r.start, r.end);
    let json = text(JSON.stringify(updates.get(r.key))); if (json.length > 65536) throw new Error("单层元数据过大。");
    const padding = new Uint8Array((4 - json.length % 4) % 4).fill(32); json = concat([json, padding]);
    const item = concat([text("8BIMgflw"), new Uint8Array([1, 0, 0, 0]), u32bytes(json.length), json]);
    const oldItems = r.blocks.flatMap(b => b.items ?? []).filter(i => i.key !== "gflw").map(i => i.bytes);
    const data = concat([u32bytes(oldItems.length + 1), ...oldItems, item]);
    const shmd = concat([text("8BIMshmd"), u32bytes(data.length), data, new Uint8Array(data.length % 2)]);
    const extra = concat([source.subarray(r.extraStart, r.tagsStart), ...r.blocks.filter(b => b.key !== "shmd").map(b => source.subarray(b.start, b.end)), shmd, source.subarray(r.tagsEnd, r.end)]);
    return concat([source.subarray(r.start, r.extraLengthAt), u32bytes(extra.length), extra]);
  });
  const info = concat([source.subarray(doc.infoStart, doc.infoStart + 2), ...patched, source.subarray(doc.recordsEnd, doc.infoEnd)]);
  const mask = concat([u32bytes(info.length), info, source.subarray(doc.infoEnd, doc.maskEnd)]);
  return concat([source.subarray(0, doc.maskLengthAt), u32bytes(mask.length), mask, source.subarray(doc.maskEnd)]);
}
