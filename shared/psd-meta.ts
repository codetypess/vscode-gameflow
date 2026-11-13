import { allocateElementId } from "./element-id";

export type NineGrid = { top: number; right: number; bottom: number; left: number; repeat: boolean };
export type SliceConfig = { enabled: boolean; name: string; nineGrid: NineGrid | null };
export type PsdLayerMeta = Record<string, unknown> & { namespace: "com.codetypes.gameflow"; version: 1; documentId: string; layerId: string; slicing?: SliceConfig };
export type PsdLayer = { key: number; nativeId: number | null; parentKey: number | null; name: string; group: boolean; left: number; top: number; width: number; height: number; hidden: boolean; identityOrigin: "embedded" | "new"; metadata: PsdLayerMeta; config: SliceConfig; image?: string; text?: boolean; limitation?: string };
export type PsdAsset = { name: string; sourceHash: string; documentId: string; hasEmbeddedIdentity: boolean; width: number; height: number; layers: PsdLayer[]; preview: string };
export type PsdSidecar = { schema: "gameflow.psd-meta"; version: 1; documentId: string; source: { name: string; sha256: string; width: number; height: number }; layers: { id: string; sourceKey: number; nativeId: number | null; name: string; config: SliceConfig; metadata: PsdLayerMeta }[] };
export const EMPTY_GRID: NineGrid = { top: 0, right: 0, bottom: 0, left: 0, repeat: false };
export const sidecarName = (name: string) => name.replace(/\.psd$/i, "") + ".meta.json";
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function validGrid(value: unknown, width: number, height: number): value is NineGrid {
  if (!record(value) || typeof value.repeat !== "boolean") return false;
  for (const k of ["top", "right", "bottom", "left"] as const) if (!Number.isInteger(value[k]) || (value[k] as number) < 0) return false;
  return (value.left as number) + (value.right as number) < width && (value.top as number) + (value.bottom as number) < height;
}
export function setGridEdge(grid: NineGrid, edge: "top" | "right" | "bottom" | "left", value: number, width: number, height: number): NineGrid {
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" } as const;
  const limit = (edge === "left" || edge === "right" ? width : height) - grid[opposite[edge]] - 1;
  return { ...grid, [edge]: Math.max(0, Math.min(Math.max(0, limit), Math.round(Number.isFinite(value) ? value : 0))) };
}
export function validConfig(value: unknown, width: number, height: number): value is SliceConfig {
  return record(value) && typeof value.enabled === "boolean" && typeof value.name === "string" && value.name.length <= 120 && (value.nineGrid === null || validGrid(value.nineGrid, width, height));
}
export function identityProblems(asset: PsdAsset): string[] {
  const counts = new Map<string, number>();
  for (const l of asset.layers) counts.set(l.metadata.layerId, (counts.get(l.metadata.layerId) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([id]) => id);
}
export function newLayerIdentity(asset: PsdAsset, key: number): PsdAsset {
  const ids = new Set(asset.layers.map(l => l.metadata.layerId));
  const id = allocateElementId(ids);
  return { ...asset, layers: asset.layers.map(l => l.key === key ? { ...l, metadata: { ...l.metadata, layerId: id } } : l) };
}
export function inheritLayerVisibility(layers: PsdLayer[]): PsdLayer[] {
  const byKey = new Map(layers.map(l => [l.key, l]));
  return layers.map(layer => {
    let hidden = layer.hidden, parentKey = layer.parentKey;
    const visited = new Set([layer.key]);
    while (parentKey !== null) {
      if (visited.has(parentKey)) throw new Error("图层父子关系循环。");
      visited.add(parentKey);
      const parent = byKey.get(parentKey); if (!parent) throw new Error("图层父分组不存在。");
      hidden ||= parent.hidden; parentKey = parent.parentKey;
    }
    return hidden === layer.hidden ? layer : { ...layer, hidden };
  });
}
export function selectedMergeTree(sources: { A: PsdAsset | null; B: PsdAsset | null }, choices: Record<string, "A" | "B">): PsdAsset | null {
  const base = sources.A ?? sources.B; if (!base) return null;
  const identity = (l: PsdLayer) => l.metadata.documentId + ":" + l.metadata.layerId;
  const items = new Map<string, { layer: PsdLayer; parent: string | null }>();
  const ordering = new Map<string, number>();
  for (const side of ["A", "B"] as const) {
    const source = sources[side]; if (!source) continue;
    const byKey = new Map(source.layers.map(l => [l.key, l]));
    for (const l of source.layers) if (!ordering.has(identity(l))) ordering.set(identity(l), ordering.size);
    const add = (layer: PsdLayer, seen = new Set<number>()) => {
      if (seen.has(layer.key)) throw new Error("图层父子关系循环。"); seen.add(layer.key);
      const parent = layer.parentKey === null ? null : byKey.get(layer.parentKey);
      if (parent) add(parent, seen);
      if (!items.has(identity(layer))) items.set(identity(layer), { layer, parent: parent ? identity(parent) : null });
    };
    source.layers.filter(l => !l.group && !!l.image && !l.limitation && choices[identity(l)] === side).forEach(l => add(l));
  }
  const layers: PsdLayer[] = [];
  const append = (parent: string | null, parentKey: number | null) => {
    for (const [id, item] of [...items].filter(([, i]) => i.parent === parent).sort(([a], [b]) => ordering.get(a)! - ordering.get(b)!)) {
      const key = layers.length; layers.push({ ...item.layer, key, parentKey }); append(id, key);
    }
  };
  append(null, null);
  return { ...base, name: "手动选择结果", layers };
}
export function makeSidecar(asset: PsdAsset): PsdSidecar {
  if (identityProblems(asset).length) throw new Error("存在重复 ID，请选中副本并点击“作为新节点”后保存。");
  for (const l of asset.layers) if (!validConfig(l.config, l.width, l.height)) throw new Error(`${l.name} 的九宫格范围无效，请重新编辑。`);
  return { schema: "gameflow.psd-meta", version: 1, documentId: asset.documentId, source: { name: asset.name, sha256: asset.sourceHash, width: asset.width, height: asset.height }, layers: asset.layers.map(l => ({ id: l.metadata.layerId, sourceKey: l.key, nativeId: l.nativeId, name: l.name, config: l.config, metadata: { ...l.metadata, slicing: l.config } })) };
}
export function applySidecar(asset: PsdAsset, raw: unknown): PsdAsset {
  if (!record(raw) || raw.schema !== "gameflow.psd-meta" || raw.version !== 1 || !record(raw.source) || !Array.isArray(raw.layers)) throw new Error("不是支持的 GameFlow PSD 配置（版本 1）。");
  const exactSource = raw.source.sha256 === asset.sourceHash;
  if (typeof raw.documentId !== "string" || !raw.documentId || (!(!asset.hasEmbeddedIdentity && exactSource) && raw.documentId !== asset.documentId)) throw new Error("配置属于另一个 PSD 文档谱系，不能覆盖当前配置。");
  const imported = new Map<string, Record<string, unknown>>();
  const sourceKeys = new Set<number>();
  for (const item of raw.layers) {
    if (!record(item) || typeof item.id !== "string" || !item.id || item.id.length > 128 || imported.has(item.id) || !record(item.metadata) || item.metadata.layerId !== item.id || item.metadata.documentId !== raw.documentId || item.metadata.namespace !== "com.codetypes.gameflow" || item.metadata.version !== 1) throw new Error("配置含重复 ID 或无效身份元数据。");
    if (!Number.isInteger(item.sourceKey) || sourceKeys.has(item.sourceKey as number)) throw new Error("配置中的源图层位置无效或重复。");
    sourceKeys.add(item.sourceKey as number);
    imported.set(item.id, item);
  }
  if (!exactSource && identityProblems(asset).length) throw new Error("请先解决 PSD 中的重复 ID，再读取配置。");
  const consumed = new Set<string>();
  const layers = asset.layers.map(l => {
    const item = exactSource ? [...imported.values()].find(i => i.sourceKey === l.key && i.nativeId === l.nativeId) : imported.get(l.metadata.layerId); if (!item) return l;
    consumed.add(item.id as string);
    if (!validConfig(item.config, l.width, l.height)) throw new Error(`${l.name} 的九宫格超出当前图片，请重新编辑配置。`);
    return { ...l, config: item.config, metadata: { ...l.metadata, ...item.metadata as PsdLayerMeta, slicing: item.config } };
  });
  if ([...imported.keys()].some(id => !consumed.has(id))) throw new Error("配置包含当前 PSD 不存在的图层 ID，请使用对应版本的 PSD。");
  const result = { ...asset, documentId: raw.documentId, layers };
  if (layers.some(l => l.metadata.documentId !== result.documentId) || identityProblems(result).length) throw new Error("配置未完整恢复身份，存在混合谱系或重复 ID。");
  return result;
}
