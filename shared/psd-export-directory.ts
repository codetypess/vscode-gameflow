import { isSliceExportBatch, MAX_EXPORT_BYTES, parseResourceManifest, planSliceExport, RESOURCE_MANIFEST, sliceExportPath, type ResourceManifest, type SliceExportBatch } from "./psd-export";
import { mergeLayaMeta } from "./laya-meta";

export interface ResourceDirectory {
  list(folder?: string): Promise<string[]>;
  mkdir(folder: string): Promise<void>;
  read(name: string): Promise<Uint8Array | null>;
  write(name: string, bytes: Uint8Array): Promise<void>;
  remove(name: string): Promise<void>;
}
export interface ExportCodec { decode(base64: string): Uint8Array; hash(bytes: Uint8Array): Promise<string> }

export function validatePng(bytes: Uint8Array, width: number, height: number): void {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 33 || signature.some((v, i) => bytes[i] !== v) || view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR" || view.getUint32(16) !== width || view.getUint32(20) !== height) throw new Error("切图 PNG 数据或尺寸无效。");
}

/** The directory adapter owns permissions; this function plans and commits one bounded batch. */
export async function exportSlicesToDirectory(directory: ResourceDirectory, batch: SliceExportBatch, codec: ExportCodec): Promise<number> {
  if (!isSliceExportBatch(batch)) throw new Error("无效的切图导出请求。");
  const parents = [...new Set(batch.items.map(item => {
    const path = sliceExportPath(batch, item);
    return path.slice(0, path.lastIndexOf("/"));
  }))];
  const folders = [...new Set(["builtin", "shared", "unclassified", ...(batch.directory ? [batch.directory] : []), ...parents])];
  const snapshot = async () => {
    const root = await directory.list();
    const listed = parents.some(folder => folder.startsWith("builtin/")) ? [...new Set(["builtin", ...parents])] : parents;
    const children = await Promise.all(listed.map(async folder =>
      (await directory.list(folder)).map(name => folder + "/" + name)));
    const names = [...root, ...children.flat()];
    for (const folder of folders) if (names.some(name => name.toLowerCase() === folder && name !== folder)) throw new Error(folder + " 目录存在大小写冲突。");
    return names;
  };
  const files = await snapshot();
  if (files.some(f => f.toLowerCase() === RESOURCE_MANIFEST && f !== RESOURCE_MANIFEST)) throw new Error("来源清单存在大小写冲突。");
  const originalManifest = await directory.read(RESOURCE_MANIFEST);
  if (originalManifest && originalManifest.length > 8 * 1024 * 1024) throw new Error("导出目录来源清单超过 8 MB。");
  const manifest: ResourceManifest = originalManifest ? parseResourceManifest(JSON.parse(new TextDecoder().decode(originalManifest))) : { schema: "gameflow.resources", version: 2, resources: [] };
  const outputs = new Map<string, Uint8Array>(), backups = new Map<string, Uint8Array | null>();
  const generatedHashes = new Map<string, string>();
  let backupSize = 0;
  for (const item of batch.items) {
    const bytes = codec.decode(item.base64); validatePng(bytes, item.width, item.height);
    const file = sliceExportPath(batch, item), previous = await directory.read(file);
    if (previous) {
      backupSize += previous.length; if (backupSize > MAX_EXPORT_BYTES) throw new Error("待替换图片总大小超过 48 MB。");
    }
    const hash = await codec.hash(bytes);
    generatedHashes.set(file, hash);
    backups.set(file, previous);
    const metaPath = file + ".meta";
    if (files.some(name => name.toLowerCase() === metaPath && name !== metaPath)) throw new Error(metaPath + " 存在大小写冲突。");
    const oldMeta = await directory.read(metaPath);
    backupSize += oldMeta?.length ?? 0;
    if (backupSize > MAX_EXPORT_BYTES) throw new Error("待替换文件总大小超过 48 MB。");
    backups.set(metaPath, oldMeta);
    const meta = mergeLayaMeta(file, oldMeta, item.nineGrid);
    if (meta.bytes) outputs.set(metaPath, meta.bytes);
    if (item.builtin && previous) {
      if (await codec.hash(previous) !== hash) throw new Error(file + " 已有不同内容，无法复用内置资源。");
    } else outputs.set(file, bytes);
  }
  const next = planSliceExport(batch, manifest, files, generatedHashes);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(next, null, 2) + "\n");
  if (manifestBytes.length > 8 * 1024 * 1024) throw new Error("生成的来源清单超过 8 MB。");
  backups.set(RESOURCE_MANIFEST, originalManifest); outputs.set(RESOURCE_MANIFEST, manifestBytes);
  // Recheck every target after planning, before the first mutation.
  for (const [name, before] of backups) {
    const current = await directory.read(name);
    if ((current === null) !== (before === null) || current && before && await codec.hash(current) !== await codec.hash(before)) throw new Error(`${name} 在检查期间被修改，请重新导出。`);
  }
  const targets = new Set([...backups.keys(), ...folders]);
  const relevantNames = (names: string[]) => names.filter(name => targets.has(name.toLowerCase())).sort();
  if (JSON.stringify(relevantNames(files)) !== JSON.stringify(relevantNames(await snapshot()))) throw new Error("导出目录的目标文件在检查期间有增删或改名，请重新导出。");
  const touched: string[] = [];
  try {
    for (const folder of folders) await directory.mkdir(folder);
    for (const [name, bytes] of outputs) { touched.push(name); await directory.write(name, bytes); }
  } catch (error) {
    const failed: string[] = [];
    for (const name of touched.reverse()) {
      try { const before = backups.get(name); if (before) await directory.write(name, before); else await directory.remove(name); }
      catch { failed.push(name); }
    }
    throw new Error(`导出失败：${error instanceof Error ? error.message : String(error)}${failed.length ? `。以下文件未能恢复：${failed.join("、")}` : "。已恢复本次写入。"}`);
  }
  return batch.items.length;
}
