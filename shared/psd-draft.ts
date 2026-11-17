import { validConfig, type PsdAsset, type PsdLayerMeta, type SliceConfig } from "./psd-meta";

export interface PsdDraft {
  sourceHash: string;
  documentId: string;
  layers: { key: number; config: SliceConfig; metadata: PsdLayerMeta }[];
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function makePsdDraft(asset: PsdAsset): PsdDraft {
  return structuredClone({ sourceHash: asset.sourceHash, documentId: asset.documentId, layers: asset.layers.map(l => ({ key: l.key, config: l.config, metadata: { ...l.metadata, slicing: l.config } })) });
}
export function isPsdDraft(value: unknown): value is PsdDraft {
  if (!object(value) || typeof value.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceHash) || typeof value.documentId !== "string" || !value.documentId || value.documentId.length > 128 || !Array.isArray(value.layers) || value.layers.length > 128) return false;
  const keys = new Set<number>();
  for (const l of value.layers) {
    if (!object(l) || !Number.isSafeInteger(l.key) || Number(l.key) < 0 || keys.has(l.key as number) || !object(l.metadata) || l.metadata.namespace !== "com.codetypes.gameflow" || l.metadata.version !== 1 || l.metadata.documentId !== value.documentId || typeof l.metadata.layerId !== "string" || !l.metadata.layerId || l.metadata.layerId.length > 128 || !validConfig(l.config, 4097, 4097)) return false;
    keys.add(l.key as number);
  }
  return JSON.stringify(value).length <= 1024 * 1024;
}
/** Drafts intentionally preserve duplicate identities so unfinished repairs remain recoverable. */
export function applyPsdDraft(asset: PsdAsset, value: unknown, restoring = false): PsdAsset {
  if (!isPsdDraft(value) || value.sourceHash !== asset.sourceHash || value.layers.length !== asset.layers.length) throw new Error("PSD 草稿格式无效或源文件已变化。");
  if (value.documentId !== asset.documentId && (!restoring || asset.hasEmbeddedIdentity)) throw new Error("PSD 草稿属于其他文档。");
  const layers = asset.layers.map(l => {
    const update = value.layers.find(item => item.key === l.key);
    if (!update || !validConfig(update.config, l.width, l.height)) throw new Error(`${l.name} 的草稿配置无效。`);
    return { ...l, config: structuredClone(update.config), metadata: structuredClone(update.metadata) };
  });
  return { ...asset, documentId: value.documentId, layers };
}
export const draftStamp = (asset: PsdAsset) => JSON.stringify(makePsdDraft(asset));
