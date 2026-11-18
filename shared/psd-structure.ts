import { allocateElementId } from "./element-id";
import type { ParsedPsd } from "./psd-binary";
import { inheritLayerVisibility, validAtlasName, validConfig, validIndependentDirectory, type PsdAsset, type PsdLayerMeta, type SliceConfig } from "./psd-meta";
import { normalizeAtlasName } from "./psd-naming";

function metadata(value: unknown): PsdLayerMeta | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("GameFlow 图层元数据格式损坏。");
  const m = value as PsdLayerMeta;
  if (!validAtlasName(m.atlasName)) throw new Error("GameFlow 图集名格式无效。");
  if (!validIndependentDirectory(m.independentDirectory)) throw new Error("GameFlow 独立目录设置无效。");
  if (m.namespace !== "com.codetypes.gameflow" || m.version !== 1 || typeof m.documentId !== "string" || !m.documentId || m.documentId.length > 128 || typeof m.layerId !== "string" || !m.layerId || m.layerId.length > 128) throw new Error("GameFlow 元数据版本或身份格式不支持。");
  return m.atlasName === undefined ? m : { ...m, atlasName: normalizeAtlasName(m.atlasName) };
}

/** Shared identity/configuration construction; pixel decoding is presentation-only. */
export function createPsdStructure(raw: ParsedPsd, name: string, sourceHash: string): PsdAsset {
  const existing = raw.layers.map(r => metadata(r.metadata));
  const atlasNames = new Set(existing.flatMap(m => m?.atlasName === undefined ? [] : [m.atlasName]));
  if (atlasNames.size > 1) throw new Error("此 PSD 含多个不同的图集名，请先统一配置。");
  const atlasName = atlasNames.values().next().value;
  const directories = new Set(existing.flatMap(m => m?.independentDirectory === undefined ? [] : [m.independentDirectory]));
  if (directories.size > 1) throw new Error("此 PSD 含不同的独立目录设置，请先统一配置。");
  const independentDirectory = directories.has(true);
  const documentIds = new Set(existing.filter(Boolean).map(m => m!.documentId));
  if (documentIds.size > 1) throw new Error("此 PSD 含多个文档谱系，请先处理跨文档身份。");
  const documentId = documentIds.values().next().value ?? crypto.randomUUID();
  const reserved = new Set(existing.filter(Boolean).map(m => m!.layerId));
  const layers = raw.layers.map((r, i) => {
    const embedded = existing[i];
    const m: PsdLayerMeta = embedded ?? { namespace: "com.codetypes.gameflow", version: 1, documentId, layerId: allocateElementId(reserved) };
    let config: SliceConfig = { enabled: false, name: r.name, nineGrid: null };
    if (m.slicing !== undefined) {
      if (!validConfig(m.slicing, r.width, r.height)) throw new Error(`${r.name} 的切图配置无效或超出当前图片。`);
      config = m.slicing;
    } else if (m.slice && typeof m.slice === "object") {
      const candidate = { enabled: true, name: r.name, nineGrid: { ...m.slice, repeat: false } };
      if (validConfig(candidate, r.width, r.height)) config = candidate;
    }
    return { key: r.key, nativeId: r.nativeId, parentKey: r.parentKey, name: r.name, group: r.divider === 1 || r.divider === 2, left: r.left, top: r.top, width: r.width, height: r.height, hidden: r.hidden, identityOrigin: embedded ? "embedded" as const : "new" as const, metadata: m, config };
  });
  return { name, ...(atlasName === undefined ? {} : { atlasName }), ...(independentDirectory ? { independentDirectory: true } : {}), sourceHash, documentId, hasEmbeddedIdentity: !!documentIds.size, width: raw.width, height: raw.height, layers: inheritLayerVisibility(layers), preview: "" };
}
