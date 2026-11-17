import { pinyin } from "pinyin-pro";
import { identityProblems, sliceRegion, validConfig, validGrid, type NineGrid, type PsdAsset } from "./psd-meta";

export const RESOURCE_MANIFEST = "gameflow-resources.json";
export const MAX_EXPORT_BYTES = 48 * 1024 * 1024;
export interface ExportSource { documentId: string; psdName: string; sourceHash: string }
export interface SliceExport {
  name: string; layerId: string; layerName: string; shared: boolean;
  width: number; height: number; nineGrid: NineGrid | null; base64: string;
}
export interface SliceExportBatch { source: ExportSource; items: SliceExport[] }
export interface ResourceRecord {
  name: string; file: string; source: ExportSource; layerId: string; layerName: string;
  shared: boolean; width: number; height: number; nineGrid: NineGrid | null; sha256: string;
}
export interface ResourceManifest { schema: "gameflow.resources"; version: 1; resources: ResourceRecord[] }
export interface ExportIssue { keys: number[]; message: string }
export interface ResourceConflict { name: string; message: string }
export class SliceExportConflict extends Error {
  constructor(public readonly conflicts: ResourceConflict[]) { super(conflicts.map(c => c.message).join("\n")); this.name = "SliceExportConflict"; }
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown, max = 512): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const sourceValid = (v: unknown): v is ExportSource => record(v) && text(v.documentId, 128) && text(v.psdName) && !/[\\/]/.test(v.psdName) && /\.psd$/i.test(v.psdName) && hash(v.sourceHash);

/** Chinese syllable initials, with existing ASCII words/numbers retained. */
function initials(value: string): string {
  return pinyin(value.normalize("NFKC"), { pattern: "first", toneType: "none", type: "array", nonZh: "consecutive" })
    .join("").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
export function defaultExportName(psdName: string, layerName: string, shared = false): string {
  const prefix = layerName.includes("按钮") ? "btn" : "img", layer = initials(layerName);
  if (!layer) return "";
  if (shared) return `${prefix}_${layer}`;
  const psd = initials(psdName.replace(/\.psd$/i, ""));
  return psd ? `${prefix}_${psd}_${layer}` : "";
}
export function exportNameError(value: string): string | null {
  if (!/^[a-zA-Z0-9_]{1,120}$/.test(value)) return "导出名称须为 1–120 位英文字母、数字或下划线，不含扩展名。";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) return "导出名称不能使用系统保留名称。";
  return null;
}
export function effectiveExportName(asset: Pick<PsdAsset, "name">, layer: PsdAsset["layers"][number]): string {
  return (layer.config.exportName || defaultExportName(asset.name, layer.name, layer.config.shared)).toLowerCase();
}
export const layerNameKey = (name: string) => name.trim().normalize("NFC");

export function sliceExportIssues(asset: PsdAsset): ExportIssue[] {
  const issues: ExportIssue[] = [], layers = asset.layers.filter(l => l.config.enabled);
  const identities = identityProblems(asset);
  for (const l of layers) {
    const name = effectiveExportName(asset, l), error = exportNameError(name);
    if (error) issues.push({ keys: [l.key], message: `${l.name}：${error}` });
    if (l.group || !l.image || l.limitation) issues.push({ keys: [l.key], message: `${l.name}：当前图层无法独立导出。` });
    if (identities.includes(l.metadata.layerId)) issues.push({ keys: [l.key], message: `${l.name}：图层 ID 重复，请先分配新身份。` });
    if (!validConfig(l.config, l.width, l.height)) issues.push({ keys: [l.key], message: `${l.name}：切图区域或九宫格范围无效。` });
  }
  for (const [label, keyOf] of [["同名图层", (l: typeof layers[number]) => layerNameKey(l.name)], ["导出名称", (l: typeof layers[number]) => effectiveExportName(asset, l)]] as const) {
    const groups = new Map<string, typeof layers>();
    for (const l of layers) { const key = keyOf(l); groups.set(key, [...groups.get(key) ?? [], l]); }
    for (const [key, items] of groups) if (items.length > 1) issues.push({ keys: items.map(l => l.key), message: `${label}“${key}”重复导出：${items.map(l => `${l.name}（${l.nativeId ?? l.key}）`).join("、")}。请只保留一个导出来源。` });
  }
  return issues;
}

export function makeSliceExportBatch(asset: PsdAsset, renderedImages?: ReadonlyMap<number, string>): SliceExportBatch {
  const issues = sliceExportIssues(asset); if (issues.length) throw new Error(issues.map(i => i.message).join("\n"));
  const batch: SliceExportBatch = {
    source: { documentId: asset.documentId, psdName: asset.name, sourceHash: asset.sourceHash },
    items: asset.layers.filter(l => l.config.enabled).map(l => {
      if (l.config.region && !renderedImages?.has(l.key)) throw new Error(`${l.name}：需先生成自定义区域的 PNG 切图。`);
      const image = l.config.region ? renderedImages!.get(l.key) : l.image;
      if (!image?.startsWith("data:image/png;base64,")) throw new Error(`${l.name}：没有有效的 PNG 切图。`);
      const { width, height } = sliceRegion(l);
      return { name: effectiveExportName(asset, l), layerId: l.metadata.layerId, layerName: l.name, shared: l.config.shared === true, width, height, nineGrid: l.config.nineGrid, base64: image.slice("data:image/png;base64,".length) };
    })
  };
  if (!isSliceExportBatch(batch)) throw new Error("没有可导出的图片，或切图总数据超过 48 MB / 配置无效。");
  return batch;
}

function validItem(v: unknown): v is SliceExport {
  return record(v) && text(v.name, 120) && v.name === v.name.toLowerCase() && !exportNameError(v.name) && text(v.layerId, 128) && text(v.layerName) && typeof v.shared === "boolean" &&
    Number.isInteger(v.width) && Number(v.width) > 0 && Number(v.width) <= 4096 && Number.isInteger(v.height) && Number(v.height) > 0 && Number(v.height) <= 4096 && Number(v.width) * Number(v.height) <= 8_000_000 &&
    (v.nineGrid === null || validGrid(v.nineGrid, Number(v.width), Number(v.height)));
}
export function isSliceExportBatch(v: unknown): v is SliceExportBatch {
  if (!record(v) || !sourceValid(v.source) || !Array.isArray(v.items) || !v.items.length || v.items.length > 128) return false;
  let size = 0;
  for (const item of v.items) {
    if (!validItem(item) || typeof item.base64 !== "string" || !item.base64.length || item.base64.length % 4 !== 0 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(item.base64)) return false;
    size += item.base64.length * .75; if (size > MAX_EXPORT_BYTES) return false;
  }
  return new Set(v.items.map(i => i.name)).size === v.items.length && new Set(v.items.map(i => layerNameKey(i.layerName))).size === v.items.length && new Set(v.items.map(i => i.layerId)).size === v.items.length;
}
export function parseResourceManifest(raw: unknown): ResourceManifest {
  if (!record(raw) || raw.schema !== "gameflow.resources" || raw.version !== 1 || !Array.isArray(raw.resources) || raw.resources.length > 10000) throw new Error("导出目录来源清单格式无效。");
  const names = new Set<string>();
  for (const r of raw.resources) {
    if (!record(r) || !sourceValid(r.source) || !hash(r.sha256) || !validItem(r) || (r as Record<string, unknown>).file !== `${r.name}.png` || names.has(r.name)) throw new Error("导出目录来源清单含无效或重复资源。");
    names.add(r.name);
  }
  return raw as unknown as ResourceManifest;
}

/** Validate the whole batch before any writes, using the latest directory snapshot. */
export function planSliceExport(batch: SliceExportBatch, manifest: ResourceManifest, files: string[], generatedHashes: Map<string, string>): ResourceManifest {
  if (!isSliceExportBatch(batch)) throw new Error("无效的切图导出请求。");
  parseResourceManifest(manifest);
  const errors: ResourceConflict[] = [], records = new Map(manifest.resources.map(r => [r.name, r]));
  for (const item of batch.items) {
    const previous = records.get(item.name), target = `${item.name}.png`, matches = files.filter(f => f.toLowerCase() === target);
    const conflict = (message: string) => errors.push({ name: item.name, message: `${target}：${message}` });
    if (matches.length > 1 || matches.some(f => f !== target)) conflict("目录中存在大小写冲突文件。");
    if (matches.length && !previous && !item.shared) conflict("已有文件没有来源记录，当前图层未标记为共享资源。");
    if (previous && previous.source.documentId !== batch.source.documentId && !item.shared) conflict(`由 ${previous.source.psdName} 导出，当前图层未标记为共享资源。`);
    const sha256 = generatedHashes.get(item.name); if (!hash(sha256)) conflict("切图数据未通过校验。");
    records.set(item.name, { name: item.name, file: target, source: { ...batch.source }, layerId: item.layerId, layerName: item.layerName, shared: item.shared, width: item.width, height: item.height, nineGrid: item.nineGrid, sha256: sha256! });
  }
  if (errors.length) throw new SliceExportConflict(errors);
  return { schema: "gameflow.resources", version: 1, resources: [...records.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}
