import { exportDirectoryError } from "./export-directory";
import { exportNameError, parseResourceManifest, RESOURCE_MANIFEST, type ExportSource } from "./psd-export";
import type { NineGrid } from "./psd-meta";

export interface SliceResourceRef {
  /** Portable path relative to the user's resource root, including .png. */
  path: string;
  /** Provenance hint for diagnostics; the path remains the resource identity. */
  source?: { documentId: string; layerId: string };
}
export interface SliceResourceDescription {
  path: string; width: number; height: number; nineGrid: NineGrid | null;
  source: ExportSource; layerId: string; layerName: string; shared: boolean;
}
export type SliceResourceState<T> =
  | { status: "loading"; description?: SliceResourceDescription }
  | { status: "error"; error: string; description?: SliceResourceDescription }
  | { status: "ready"; description: SliceResourceDescription; pixels: T };
export interface ExportedSliceResult {
  path: string; exists: boolean; description?: SliceResourceDescription; base64?: string; error?: string;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function isSliceResourcePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 640 || !value.endsWith(".png")) return false;
  const slash = value.lastIndexOf("/"), name = value.slice(slash + 1, -4);
  return !exportNameError(name) && name === name.toLowerCase() &&
    !exportDirectoryError(slash < 0 ? undefined : value.slice(0, slash)) && !value.startsWith("/");
}
export function isSliceResourceRef(value: unknown): value is SliceResourceRef {
  const identityText = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 128;
  return record(value) && Object.keys(value).every(k => ["path", "source"].includes(k)) && isSliceResourcePath(value.path) &&
    (value.source === undefined || record(value.source) && Object.keys(value.source).length === 2 && identityText(value.source.documentId) && identityText(value.source.layerId));
}
export function sliceResourcePath(directory: string | undefined, name: string): string {
  const path = `${directory ? `${directory}/` : ""}${name}.png`;
  if (!isSliceResourcePath(path)) throw new Error("切图资源路径无效。");
  return path;
}
export function sourceKey(source: { documentId: string; layerId: string }): string { return JSON.stringify([source.documentId, source.layerId]); }

/** A known source changing its name/selection must not fall back to its old disk file. */
export function resolveSliceResource<T>(ref: SliceResourceRef, resources: ReadonlyMap<string, SliceResourceState<T>>, sources: ReadonlyMap<string, string | null> = new Map()): SliceResourceState<T> {
  if (ref.source && sources.has(sourceKey(ref.source))) {
    const current = sources.get(sourceKey(ref.source));
    if (current !== ref.path) return { status: "error", error: current ? `资源已改名或移动为 ${current}，请更新绑定。` : "来源图层已删除或取消导出，请重新选择切图。" };
  }
  return resources.get(ref.path) ?? { status: "error", error: `缺少资源 ${ref.path}，请打开来源 PSD 或检查资源根目录。` };
}

/** Host/browser adapters share provenance, hash and PNG-dimension validation. No writes. */
export async function readExportedSlice(path: string, io: {
  read(path: string): Promise<Uint8Array | null>;
  hash(bytes: Uint8Array): Promise<string>;
  encode(bytes: Uint8Array): string;
}): Promise<ExportedSliceResult> {
  let exists = false;
  try {
    if (!isSliceResourcePath(path)) throw new Error("资源必须是根目录内的相对 PNG 路径。");
    const bytes = await io.read(path); exists = bytes !== null;
    if (!bytes) throw new Error("资源文件不存在。");
    const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    const manifestBytes = await io.read(directory + RESOURCE_MANIFEST);
    if (!manifestBytes) throw new Error("资源缺少来源清单，请重新导出。");
    const manifest = parseResourceManifest(JSON.parse(new TextDecoder().decode(manifestBytes)));
    const item = manifest.resources.find(r => directory + r.file === path);
    if (!item) throw new Error("资源未登记在来源清单中，请重新导出。");
    if (await io.hash(bytes) !== item.sha256) throw new Error("图片与来源清单的 hash 不一致，请重新导出。");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 24 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a || view.getUint32(12) !== 0x49484452 ||
        view.getUint32(16) !== item.width || view.getUint32(20) !== item.height) throw new Error("PNG 尺寸与资源描述不一致或图片已损坏。");
    return { path, exists, description: { path, width: item.width, height: item.height, nineGrid: item.nineGrid,
      source: item.source, layerId: item.layerId, layerName: item.layerName, shared: item.shared }, base64: io.encode(bytes) };
  } catch (error) { return { path, exists, error: error instanceof Error ? error.message : String(error) }; }
}
