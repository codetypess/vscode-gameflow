import { allocateElementId } from "./element-id";
import { atlasNameError, normalizeAtlasName } from "./psd-naming";
export { defaultAtlasName } from "./psd-naming";

export type NineGrid = { top: number; right: number; bottom: number; left: number; repeat: boolean };
export type SliceRegion = { x: number; y: number; width: number; height: number };
export type SliceConfig = { enabled: boolean; name: string; variableName?: string; /** Legacy variable override. */ exportName?: string; shared?: boolean; region?: SliceRegion; nineGrid: NineGrid | null; additionalLayerIds?: string[] };
export type PsdLayerMeta = Record<string, unknown> & { namespace: "com.codetypes.gameflow"; version: 1; documentId: string; layerId: string; atlasName?: string; independentDirectory?: boolean; slicing?: SliceConfig };
export type BuiltinSlice = { id: string; width: number; height: number };
export type PsdEmbeddedLayer = { key: number; name: string; kind: "group" | "image" | "text" | "smartObject"; children: PsdEmbeddedLayer[] };
export interface PsdComponentSource {
  documentId: string;
  pageId: string;
  psdId: string;
  sourceHash: string;
  embeddedHash: string;
}
export function psdComponentSource(value: unknown): PsdComponentSource | undefined {
  if (!record(value)) return;
  const { documentId, pageId, psdId, sourceHash, embeddedHash } = value;
  if (typeof documentId === "string" && typeof pageId === "string" && typeof psdId === "string" &&
      typeof sourceHash === "string" && typeof embeddedHash === "string" &&
      /^[a-f0-9]{64}$/.test(sourceHash) && /^[a-f0-9]{64}$/.test(embeddedHash))
    return { documentId, pageId, psdId, sourceHash, embeddedHash };
}
export type PsdLayer = { key: number; nativeId: number | null; parentKey: number | null; name: string; group: boolean; left: number; top: number; width: number; height: number; hidden: boolean; identityOrigin: "embedded" | "new"; metadata: PsdLayerMeta; config: SliceConfig; image?: string; text?: boolean; textContent?: string; limitation?: string; verifiedBuiltin?: BuiltinSlice; smartObject?: { contents?: PsdEmbeddedLayer[]; hash?: string } };
export type PsdAsset = { sourceUri?: string; name: string; atlasName?: string; independentDirectory?: boolean; sourceHash: string; documentId: string; hasEmbeddedIdentity: boolean; width: number; height: number; layers: PsdLayer[]; preview: string };
export type PsdSidecar = { schema: "gameflow.psd-meta"; version: 1; documentId: string; atlasName?: string; independentDirectory?: boolean; source: { name: string; sha256: string; width: number; height: number }; layers: { id: string; sourceKey: number; nativeId: number | null; name: string; config: SliceConfig; metadata: PsdLayerMeta }[] };
export const EMPTY_GRID: NineGrid = { top: 0, right: 0, bottom: 0, left: 0, repeat: false };
export const sidecarName = (name: string) => name.replace(/\.psd$/i, "") + ".meta.json";
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function validAtlasName(value: unknown): value is string | undefined {
  if (value === undefined) return true;
  if (typeof value !== "string" || value.length > 120) return false;
  const canonical = normalizeAtlasName(value);
  return canonical !== undefined && canonical.length <= 120 && !atlasNameError(canonical);
}
export const validIndependentDirectory = (value: unknown): value is boolean | undefined => value === undefined || typeof value === "boolean";
/** The document value is authoritative; clear stale embedded values when reverting to the default. */
export function sliceLayerMetadata(asset: Pick<PsdAsset, "atlasName" | "independentDirectory">, layer: Pick<PsdLayer, "metadata" | "config">): PsdLayerMeta {
  const metadata = { ...layer.metadata, slicing: layer.config };
  const atlasName = normalizeAtlasName(asset.atlasName);
  if (atlasName === undefined) delete metadata.atlasName;
  else metadata.atlasName = atlasName;
  if (asset.independentDirectory) metadata.independentDirectory = true;
  else delete metadata.independentDirectory;
  return metadata;
}

export const MAX_SLICE_SIZE = 4096;
export function validSliceRegion(value: unknown): value is SliceRegion {
  return record(value) && [value.x, value.y, value.width, value.height].every(Number.isInteger) &&
    Math.abs(Number(value.x)) <= MAX_SLICE_SIZE && Math.abs(Number(value.y)) <= MAX_SLICE_SIZE &&
    Number(value.width) > 0 && Number(value.width) <= MAX_SLICE_SIZE && Number(value.height) > 0 && Number(value.height) <= MAX_SLICE_SIZE &&
    Number(value.width) * Number(value.height) <= 8_000_000;
}
export function sliceRegion(layer: Pick<PsdLayer, "config" | "width" | "height">): SliceRegion {
  return layer.config.region ?? { x: 0, y: 0, width: layer.width, height: layer.height };
}
export function centerSliceRegion(region: SliceRegion, content: { width: number; height: number }): SliceRegion {
  return { ...region, x: -Math.floor((region.width - content.width) / 2), y: -Math.floor((region.height - content.height) / 2) };
}
/** Moving content right/down moves the source-space export rectangle left/up. */
export function moveSliceContent(region: SliceRegion, dx: number, dy: number): SliceRegion {
  const clamp = (n: number) => Math.max(-MAX_SLICE_SIZE, Math.min(MAX_SLICE_SIZE, n));
  return { ...region, x: clamp(region.x - Math.round(dx)), y: clamp(region.y - Math.round(dy)) };
}
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
  if (!record(value) || (value.region !== undefined && !validSliceRegion(value.region))) return false;
  const ids = value.additionalLayerIds;
  if (ids !== undefined && (!Array.isArray(ids) || ids.length > 127 || new Set(ids).size !== ids.length ||
    !ids.every(id => typeof id === "string" && id.length > 0 && id.length <= 128))) return false;
  const region = value.region as SliceRegion | undefined;
  return typeof value.enabled === "boolean" && typeof value.name === "string" && value.name.length <= 120 && (value.variableName === undefined || typeof value.variableName === "string" && value.variableName.length <= 120) && (value.exportName === undefined || typeof value.exportName === "string" && value.exportName.length <= 120) && (value.shared === undefined || typeof value.shared === "boolean") && (value.nineGrid === null || validGrid(value.nineGrid, region?.width ?? width, region?.height ?? height));
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
  if (!validIndependentDirectory(asset.independentDirectory)) throw new Error("独立目录设置无效。");
  if (!validAtlasName(asset.atlasName)) throw new Error("图集名须为 1–120 个字符，留空时使用 PSD 文件名。");
  if (identityProblems(asset).length) throw new Error("存在重复 ID，请选中副本并点击“作为新节点”后保存。");
  for (const l of asset.layers) if (!validConfig(l.config, l.width, l.height)) throw new Error(`${l.name} 的切图区域或九宫格范围无效，请重新编辑。`);
  const atlasName = normalizeAtlasName(asset.atlasName);
  return { schema: "gameflow.psd-meta", version: 1, documentId: asset.documentId, ...(atlasName === undefined ? {} : { atlasName }), ...(asset.independentDirectory ? { independentDirectory: true } : {}), source: { name: asset.name, sha256: asset.sourceHash, width: asset.width, height: asset.height }, layers: asset.layers.map(l => ({ id: l.metadata.layerId, sourceKey: l.key, nativeId: l.nativeId, name: l.name, config: l.config, metadata: sliceLayerMetadata(asset, l) })) };
}
export function applySidecar(asset: PsdAsset, raw: unknown): PsdAsset {
  if (!record(raw) || raw.schema !== "gameflow.psd-meta" || raw.version !== 1 || !record(raw.source) || !Array.isArray(raw.layers)) throw new Error("不是支持的 GameFlow PSD 配置（版本 1）。");
  if (!validAtlasName(raw.atlasName)) throw new Error("配置中的图集名无效。");
  if (!validIndependentDirectory(raw.independentDirectory)) throw new Error("配置中的独立目录设置无效。");
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
    if (!validConfig(item.config, l.width, l.height)) throw new Error(`${l.name} 的切图区域或九宫格无效，请重新编辑配置。`);
    return { ...l, config: item.config, metadata: { ...l.metadata, ...item.metadata as PsdLayerMeta, slicing: item.config } };
  });
  if ([...imported.keys()].some(id => !consumed.has(id))) throw new Error("配置包含当前 PSD 不存在的图层 ID，请使用对应版本的 PSD。");
  const result = { ...asset, documentId: raw.documentId, layers };
  if (raw.atlasName === undefined) delete result.atlasName;
  else result.atlasName = normalizeAtlasName(raw.atlasName);
  if (raw.independentDirectory) result.independentDirectory = true;
  else delete result.independentDirectory;
  if (layers.some(l => l.metadata.documentId !== result.documentId) || identityProblems(result).length) throw new Error("配置未完整恢复身份，存在混合谱系或重复 ID。");
  return result;
}
