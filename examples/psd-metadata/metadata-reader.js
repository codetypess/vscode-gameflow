/* Read-only PSD v1 layer metadata inspector. No pixels are decoded or files written. */
(function (root) {
  "use strict";
  function readMetadata(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const utf8 = new TextDecoder("utf-8", { fatal: true });
    let p = 0;
    function need(n, end = bytes.length) {
      if (!Number.isSafeInteger(n) || n < 0 || p + n > end) throw new Error("PSD 数据不完整或区块长度无效");
    }
    function skip(n) { need(n); p += n; }
    function u16() { need(2); const n = view.getUint16(p); p += 2; return n; }
    function u32() { need(4); const n = view.getUint32(p); p += 4; return n; }
    function i32() { need(4); const n = view.getInt32(p); p += 4; return n; }
    function ascii(n) { need(n); const s = String.fromCharCode(...bytes.subarray(p, p + n)); p += n; return s; }
    function unicode(end) {
      const length = u32(); need(length * 2, end);
      let value = "";
      for (let i = 0; i < length; i++) value += String.fromCharCode(u16());
      return value.replace(/\0+$/, "");
    }
    if (ascii(4) !== "8BPS" || u16() !== 1) throw new Error("只支持标准 PSD v1，暂不支持 PSB");
    skip(6);
    const channels = u16(), height = u32(), width = u32(), depth = u16(), mode = u16();
    skip(u32()); skip(u32());
    const layerMaskLength = u32(); need(layerMaskLength);
    const layerMaskEnd = p + layerMaskLength;
    if (!layerMaskLength) return { width, height, channels, depth, mode, layers: [] };
    const layerInfoLength = u32(); need(layerInfoLength, layerMaskEnd);
    const layerEnd = p + layerInfoLength;
    if (!layerInfoLength) return { width, height, channels, depth, mode, layers: [] };
    const rawCount = u16(), count = Math.abs(rawCount > 32767 ? rawCount - 65536 : rawCount);
    const records = [];
    for (let i = 0; i < count; i++) {
      need(18, layerEnd);
      const top = i32(), left = i32(), bottom = i32(), right = i32();
      skip(u16() * 6);
      if (ascii(4) !== "8BIM") throw new Error("无效的图层记录签名");
      const blend = ascii(4); skip(4);
      const extraLength = u32(); need(extraLength, layerEnd);
      const extraEnd = p + extraLength;
      skip(u32()); skip(u32());
      need(1, extraEnd);
      const nameLength = bytes[p++];
      let name = ascii(nameLength);
      skip((4 - (nameLength + 1) % 4) % 4);
      const record = { name, nativeId: null, bounds: { left, top, right, bottom }, blend, divider: 0, metadata: null };
      while (p + 12 <= extraEnd) {
        const signature = ascii(4), key = ascii(4), length = u32();
        if (signature !== "8BIM") throw new Error("暂不支持的附加区块签名：" + signature);
        need(length, extraEnd);
        const end = p + length;
        if (key === "luni") record.name = unicode(end);
        else if (key === "lyid") { need(4, end); record.nativeId = u32(); }
        else if (key === "lsct" || key === "lsdk") { need(4, end); record.divider = u32(); }
        else if (key === "shmd") {
          need(4, end);
          const items = u32();
          for (let j = 0; j < items; j++) {
            need(16, end);
            const sig = ascii(4), itemKey = ascii(4), copy = bytes[p]; skip(4);
            const size = u32(); need(size, end);
            if ((sig === "8BIM" || sig === "8ELE") && itemKey === "gflw") {
              if (record.metadata) throw new Error("同一图层存在多个 gflw 元数据项");
              record.metadata = JSON.parse(utf8.decode(bytes.subarray(p, p + size)).trim());
              record.copyOnSheetDuplication = !!copy;
            }
            skip(size);
          }
        }
        p = end;
        // Standard PSD layer additional-info lengths are padded to even bytes.
        if (length % 2) { need(1, extraEnd); p++; }
      }
      p = extraEnd;
      records.push(record);
    }
    const layers = [], parents = [];
    for (const record of records.reverse()) {
      if (record.divider === 3) { parents.pop(); continue; }
      record.depth = parents.length;
      record.path = [...parents, record.name].join(" / ");
      layers.push(record);
      if (record.divider === 1 || record.divider === 2) parents.push(record.name);
    }
    return { width, height, channels, depth, mode, layers };
  }
  function summarize(document, baseline) {
    const counts = new Map();
    for (const layer of document.layers) {
      const id = layer.metadata?.layerId;
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
    const ids = new Set(counts.keys());
    return {
      total: document.layers.length,
      tagged: document.layers.filter(l => l.metadata).length,
      duplicateIds: [...counts].filter(([, n]) => n > 1).map(([id]) => id),
      missingIds: baseline ? baseline.layers.map(l => l.metadata?.layerId).filter(id => id && !ids.has(id)) : [],
    };
  }
  const api = { readMetadata, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GameFlowPsd = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
