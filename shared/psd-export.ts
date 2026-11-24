import { defaultAtlasName, identityProblems, sliceRegion, validConfig, validGrid, type NineGrid, type PsdAsset, type PsdLayer } from "./psd-meta";
import { psdSlotField } from "./psd-slot-markers";
import { atlasNameError, normalizeAtlasName, psdNameInitials } from "./psd-naming";
import { exportDirectoryError } from "./export-directory";
import { builtinImage, builtinPath, BUILTIN_SOURCE } from "./builtin-image";
import { builtinSlice, builtinSliceDescription, sameGrid, validBuiltinSlice } from "./psd-builtin";
import type { BuiltinSlice } from "./psd-meta";

export const RESOURCE_MANIFEST = "image-files.meta.json";
export const LEGACY_RESOURCE_MANIFEST = "gameflow-resources.json";
export const MAX_EXPORT_BYTES = 48 * 1024 * 1024;
export interface ExportSource { documentId: string; psdName: string; sourceHash: string }
export interface SliceProductGeometry {
  width: number; height: number; nineGrid: NineGrid | null;
  logicalSize?: { width: number; height: number };
}
export interface SliceExport extends SliceProductGeometry {
  name: string; layerId: string; layerName: string; shared: boolean;
  builtin?: BuiltinSlice;
  base64: string;
}
export interface SliceExportBatch { source: ExportSource; directory?: string; items: SliceExport[] }
export interface ResourceRecord extends SliceProductGeometry {
  name: string; file: string; source: ExportSource; layerId: string; layerName: string;
  shared: boolean; sha256: string;
}
export interface ResourceManifest { schema: "gameflow.resources"; version: 1 | 2; resources: ResourceRecord[] }
export interface ExportIssue { keys: number[]; message: string }
export interface ResourceConflict { name: string; message: string }
export class SliceExportConflict extends Error {
  constructor(public readonly conflicts: ResourceConflict[]) { super(conflicts.map(c => c.message).join("\n")); this.name = "SliceExportConflict"; }
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown, max = 512): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const sourceValid = (v: unknown): v is ExportSource => record(v) && text(v.documentId, 128) && text(v.psdName) && !/[\\/]/.test(v.psdName) && /\.psd$/i.test(v.psdName) && hash(v.sourceHash);

export function defaultVariableName(layerName: string): string {
  return psdNameInitials(layerName.replace(/\s*\(UI[A-Za-z]+\)\s*$/, ""));
}
export function defaultExportName(psdName: string, layerName: string, atlasName?: string): string {
  const layer = defaultVariableName(layerName);
  const atlas = normalizeAtlasName(atlasName) ?? defaultAtlasName(psdName);
  return atlas && layer ? `${atlas}_${layer}` : "";
}
export function exportNameError(value: string): string | null {
  if (!/^[a-zA-Z0-9_]{1,120}$/.test(value)) return "导出名称须为 1–120 位英文字母、数字或下划线，不含扩展名。";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) return "导出名称不能使用系统保留名称。";
  return null;
}
function markerOwner(asset: PsdAsset, layer: PsdLayer) {
  return psdSlotField(layer.name) && asset.layers.find(parent => parent.group && parent.key === layer.parentKey);
}
export function isLayerVariableNameFixed(asset: PsdAsset, layer: PsdLayer): boolean {
  return !!markerOwner(asset, layer);
}

export function exportLayerName(asset: PsdAsset, layer: PsdLayer): string {
  const owner = markerOwner(asset, layer);
  return owner ? `${owner.name}/${layer.name.trim()}` : layer.name;
}
/** Read old overrides without applying legacy prefix rules to newly entered variables. */
export function layerVariableOverride(asset: PsdAsset, layer: PsdLayer): string {
  if (layer.config.variableName !== undefined) return layer.config.variableName;
  const legacy = layer.config.exportName ?? "";
  const buttonGroup = layer.group && asset.layers.some(child => child.parentKey === layer.key &&
    psdSlotField(child.name) !== undefined && psdSlotField(child.name) !== "image");
  return buttonGroup ? legacy.replace(/^btn_/i, "") : legacy;
}
export function defaultLayerVariableName(asset: PsdAsset, layer: PsdLayer): string {
  const owner = markerOwner(asset, layer);
  if (!owner) return defaultVariableName(layer.name);
  const variable = effectiveVariableName(asset, owner);
  return !variable || psdSlotField(layer.name) === "image" ? variable : `${variable}_${layer.name.trim().slice(1)}`;
}
export function effectiveVariableName(asset: PsdAsset, layer: PsdLayer): string {
  return (!isLayerVariableNameFixed(asset, layer) && layerVariableOverride(asset, layer).toLowerCase()) || defaultLayerVariableName(asset, layer);
}
export function effectiveExportName(asset: PsdAsset, layer: PsdLayer): string {
  const builtin = builtinSlice(layer);
  if (builtin) return builtinPath(builtin.id).split("/").pop()!.slice(0, -4);
  const atlas = normalizeAtlasName(asset.atlasName) ?? defaultAtlasName(asset.name);
  const variable = effectiveVariableName(asset, layer);
  return atlas && variable ? `${atlas}_${variable}` : "";
}
/** The optional independent atlas directory, always directly below the resource root. */
export function psdExportDirectory(asset: Pick<PsdAsset, "name" | "atlasName" | "independentDirectory">): string | undefined {
  const atlas = normalizeAtlasName(asset.atlasName) ?? defaultAtlasName(asset.name);
  const reserved = atlasNameError(atlas); if (reserved) throw new Error(reserved);
  if (!asset.independentDirectory) return undefined;
  if (!atlas || !validAtlasDirectory(atlas)) throw new Error("图集名不能用作独立目录，请使用有效的文件夹名称。");
  return atlas;
}
function validAtlasDirectory(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_]{1,120}$/.test(value) && !atlasNameError(value) && !exportDirectoryError(value);
}
export function sliceExportPath(batch: Pick<SliceExportBatch, "directory">, item: Pick<SliceExport, "name" | "shared" | "builtin">): string {
  if (item.builtin) return builtinPath(item.builtin.id);
  return `${item.shared ? "shared" : batch.directory ?? "unclassified"}/${item.name}.png`;
}
export function psdLayerPath(asset: PsdAsset, layer: PsdLayer) {
  const builtin = builtinSlice(layer);
  return builtin ? builtinPath(builtin.id) : `${psdSliceDirectory(asset, layer.config.shared)}/${effectiveExportName(asset, layer)}.png`;
}
export function psdSliceDirectory(asset: Pick<PsdAsset, "name" | "atlasName" | "independentDirectory">, shared = false): string {
  const atlas = psdExportDirectory(asset);
  return shared ? "shared" : atlas ?? "unclassified";
}
export const layerNameKey = (name: string) => name.trim().normalize("NFC");

export function sliceExportIssues(asset: PsdAsset): ExportIssue[] {
  const issues: ExportIssue[] = [], layers = asset.layers.filter(l => l.config.enabled);
  let directory = "unclassified";
  try { directory = psdExportDirectory(asset) ?? directory; } catch (error) { issues.push({ keys: layers.map(l => l.key), message: error instanceof Error ? error.message : String(error) }); }
  const identities = identityProblems(asset);
  for (const l of layers) {
    const name = effectiveExportName(asset, l), error = exportNameError(name);
    if (error) issues.push({ keys: [l.key], message: `${l.name}：${error}` });
    if (!l.image || l.limitation) issues.push({ keys: [l.key], message: `${l.name}：当前图层无法独立导出。` });
    if (identities.includes(l.metadata.layerId)) issues.push({ keys: [l.key], message: `${l.name}：图层 ID 重复，请先分配新身份。` });
    if (!validConfig(l.config, l.width, l.height)) issues.push({ keys: [l.key], message: `${l.name}：切图区域或九宫格范围无效。` });
  }
  for (const [label, keyOf] of [["同名图层", (l: typeof layers[number]) => layerNameKey(exportLayerName(asset, l))], ["导出名称", (l: typeof layers[number]) => `${l.config.shared ? "shared" : directory}/${effectiveExportName(asset, l)}`]] as const) {
    const groups = new Map<string, typeof layers>();
    for (const l of layers.filter(l => !builtinSlice(l))) { const key = keyOf(l); groups.set(key, [...groups.get(key) ?? [], l]); }
    for (const [key, items] of groups) if (items.length > 1) issues.push({ keys: items.map(l => l.key), message: `${label}“${key}”重复导出：${items.map(l => `${l.name}（${l.nativeId ?? l.key}）`).join("、")}。请只保留一个导出来源。` });
  }
  return issues;
}

export function makeSliceExportBatch(asset: PsdAsset, products?: ReadonlyMap<number, { image: string; geometry: SliceProductGeometry }>): SliceExportBatch {
  const issues = sliceExportIssues(asset); if (issues.length) throw new Error(issues.map(i => i.message).join("\n"));
  const directory = psdExportDirectory(asset);
  const builtinPaths = new Set<string>();
  const uniqueLayers = asset.layers.filter(layer => {
    if (!layer.config.enabled) return false;
    if (!builtinSlice(layer)) return true;
    const path = psdLayerPath(asset, layer);
    if (builtinPaths.has(path)) return false;
    builtinPaths.add(path);
    return true;
  });
  const batch: SliceExportBatch = {
    source: { documentId: asset.documentId, psdName: asset.name, sourceHash: asset.sourceHash },
    ...(directory ? { directory } : {}),
    items: uniqueLayers.map(l => {
      const product = products?.get(l.key);
      const builtin = builtinSlice(l);
      if (builtin) {
        const description = builtinSliceDescription(builtin);
        const image = builtinImage(builtin.id)!.dataUri;
        return { builtin, name: effectiveExportName(asset, l), layerId: description.layerId, layerName: description.layerName,
          shared: true, width: description.width, height: description.height, nineGrid: description.nineGrid, base64: image.split(",")[1] };
      }
      if (l.config.region && !product) throw new Error(`${l.name}：需先生成自定义区域的 PNG 切图。`);
      const image = product?.image ?? l.image;
      if (!image?.startsWith("data:image/png;base64,")) throw new Error(`${l.name}：没有有效的 PNG 切图。`);
      const { width, height } = sliceRegion(l);
      const geometry = product?.geometry ?? { width, height, nineGrid: l.config.nineGrid };
      return { name: effectiveExportName(asset, l), layerId: l.metadata.layerId, layerName: exportLayerName(asset, l), shared: l.config.shared === true,
        width: geometry.width, height: geometry.height, nineGrid: geometry.nineGrid,
        ...(geometry.logicalSize && { logicalSize: geometry.logicalSize }), base64: image.slice("data:image/png;base64,".length) };
    })
  };
  if (!isSliceExportBatch(batch)) throw new Error("没有可导出的图片，或切图总数据超过 48 MB / 配置无效。");
  return batch;
}

const validSize = (v: Record<string, unknown>) => Number.isInteger(v.width) && Number(v.width) > 0 && Number(v.width) <= 4096 &&
  Number.isInteger(v.height) && Number(v.height) > 0 && Number(v.height) <= 4096 && Number(v.width) * Number(v.height) <= 8_000_000;

function validItem(v: unknown): v is SliceExport {
  return record(v) && text(v.name, 120) && v.name === v.name.toLowerCase() && !exportNameError(v.name) && text(v.layerId, 128) && text(v.layerName) && typeof v.shared === "boolean" &&
    validSize(v) && (v.nineGrid === null || validGrid(v.nineGrid, Number(v.width), Number(v.height))) &&
    (v.logicalSize === undefined || v.nineGrid !== null && record(v.logicalSize) && validSize(v.logicalSize) &&
      Number(v.logicalSize.width) >= Number(v.width) && Number(v.logicalSize.height) >= Number(v.height));
}
export function isSliceExportBatch(v: unknown): v is SliceExportBatch {
  if (!record(v) || !sourceValid(v.source) || (v.directory !== undefined && !validAtlasDirectory(v.directory)) || !Array.isArray(v.items) || !v.items.length || v.items.length > 128) return false;
  let size = 0;
  for (const item of v.items) {
    if (!validItem(item) || typeof item.base64 !== "string" || !item.base64.length || item.base64.length % 4 !== 0 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(item.base64)) return false;
    if (item.builtin !== undefined) {
      if (!validBuiltinSlice(item.builtin)) return false;
      const expected = builtinSliceDescription(item.builtin);
      if (item.name + ".png" !== expected.path.split("/").pop() || item.layerId !== expected.layerId || item.layerName !== expected.layerName ||
          item.width !== expected.width || item.height !== expected.height || !sameGrid(item.nineGrid, expected.nineGrid) || !item.shared || item.logicalSize ||
          item.base64 !== builtinImage(item.builtin.id)!.dataUri.split(",")[1]) return false;
    }
    size += item.base64.length * .75; if (size > MAX_EXPORT_BYTES) return false;
  }
  const art = v.items.filter(i => !i.builtin);
  return new Set(v.items.map(i => sliceExportPath(v as unknown as SliceExportBatch, i))).size === v.items.length && new Set(art.map(i => layerNameKey(i.layerName))).size === art.length && new Set(art.map(i => i.layerId)).size === art.length;
}
function validResourceFile(file: unknown, name: string): boolean {
  if (file === name + ".png") return true;
  if (typeof file !== "string" || file.length > 640 || !file.endsWith("/" + name + ".png")) return false;
  const directory = file.slice(0, file.lastIndexOf("/"));
  return !!directory && !exportDirectoryError(directory);
}
export function parseResourceManifest(raw: unknown): ResourceManifest {
  if (!record(raw) || raw.schema !== "gameflow.resources" || (raw.version !== 1 && raw.version !== 2) || !Array.isArray(raw.resources) || raw.resources.length > 10000) throw new Error("导出目录来源清单格式无效。");
  const files = new Set<string>();
  for (const r of raw.resources) {
    if (!record(r) || !sourceValid(r.source) || !hash(r.sha256) || !validItem(r) ||
        !(raw.version === 1 ? r.file === r.name + ".png" : validResourceFile(r.file, r.name)) || files.has(String(r.file).toLowerCase())) throw new Error("导出目录来源清单含无效或重复资源。");
    files.add(String(r.file).toLowerCase());
  }
  return raw as unknown as ResourceManifest;
}

/** Validate the whole batch before any writes, using root-relative file identities. */
export function planSliceExport(batch: SliceExportBatch, manifest: ResourceManifest, files: string[], generatedHashes: Map<string, string>): ResourceManifest {
  if (!isSliceExportBatch(batch)) throw new Error("无效的切图导出请求。");
  parseResourceManifest(manifest);
  const errors: ResourceConflict[] = [], records = new Map(manifest.resources.map(r => [r.file, r]));
  for (const item of batch.items) {
    const target = sliceExportPath(batch, item), previous = records.get(target), matches = files.filter(f => f.toLowerCase() === target);
    const conflict = (message: string) => errors.push({ name: item.name, message: target + "：" + message });
    if (matches.length > 1 || matches.some(f => f !== target) || [...records.keys()].some(f => f !== target && f.toLowerCase() === target)) conflict("目录中存在大小写冲突文件。");
    if (matches.length && !previous && !item.shared) conflict("已有文件没有来源记录，当前图层未标记为共享资源。");
    if (previous && previous.source.documentId !== batch.source.documentId && !item.shared) conflict("由 " + previous.source.psdName + " 导出，当前图层未标记为共享资源。");
    const sha256 = generatedHashes.get(target); if (!hash(sha256)) conflict("切图数据未通过校验。");
    records.set(target, { name: item.name, file: target, source: { ...(item.builtin ? BUILTIN_SOURCE : batch.source) }, layerId: item.layerId, layerName: item.layerName, shared: item.shared, width: item.width, height: item.height, nineGrid: item.nineGrid,
      ...(item.logicalSize && { logicalSize: item.logicalSize }), sha256: sha256! });
  }
  if (errors.length) throw new SliceExportConflict(errors);
  return parseResourceManifest({ schema: "gameflow.resources", version: 2, resources: [...records.values()].sort((a, b) => a.file.localeCompare(b.file)) });
}
