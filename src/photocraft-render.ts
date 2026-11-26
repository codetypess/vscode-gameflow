import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { parsePsdBinary } from "../shared/psd-binary";

// A version-16 action descriptor starts with its Unicode name, class ID and item count.
// Insert a transparent background into older artboard descriptors that omit the default white.
function transparentArtboard(copy: Buffer, start: number, end: number) {
  const key = Buffer.from("artboardBackgroundType");
  const field = Buffer.alloc(4 + key.length + 8);
  field.writeUInt32BE(key.length);
  key.copy(field, 4);
  field.write("long", 4 + key.length, "ascii");
  field.writeUInt32BE(3, field.length - 4);
  const size = copy.readUInt32BE(start + 8);
  const data = copy.subarray(start + 12, start + 12 + size);
  const existing = data.indexOf(field.subarray(0, -4));
  if (existing >= 0 && existing + field.length <= data.length) {
    data.writeUInt32BE(3, existing + field.length - 4);
    return;
  }
  if (data.readUInt32BE(0) !== 16) throw new Error("画板背景描述版本无法解析。");
  const classOffset = 8 + 2 * data.readUInt32BE(4);
  const countOffset = classOffset + 4 + (data.readUInt32BE(classOffset) || 4);
  const position = start + 12 + countOffset + 4;
  if (position > end) throw new Error("画板背景描述长度无效。");
  data.writeUInt32BE(data.readUInt32BE(countOffset) + 1, countOffset);
  copy.writeUInt32BE(size + field.length, start + 8);
  return { position, field };
}

/** Isolate on a disposable snapshot. Keep layer planes, masks, styles, order and original coordinates. */
export function isolateSlice(bytes: Uint8Array, keys: number[]) {
  const doc = parsePsdBinary(bytes);
  const byKey = new Map(doc.layers.map(layer => [layer.key, layer]));
  const roots = new Set(keys), ancestors = new Set<number>();
  for (const key of roots) {
    const layer = byKey.get(key);
    if (!layer) throw new Error("切图引用的源图层已变化。");
    let parent = layer.parentKey;
    while (parent !== null) {
      ancestors.add(parent);
      parent = byKey.get(parent)!.parentKey;
    }
  }
  const included = new Set<number>(), copy = Buffer.from(bytes);
  const inserts: { position: number; field: Buffer }[] = [];
  for (const layer of doc.layers) {
    const explicit = roots.has(layer.key), ancestor = ancestors.has(layer.key);
    const child = layer.parentKey !== null && included.has(layer.parentKey) && !layer.hidden;
    if (explicit || child) included.add(layer.key);
    const flags = layer.extraLengthAt - 2;
    if (explicit || ancestor || child) copy[flags] &= ~2;
    else copy[flags] |= 2;
    // Keep the artboard clipping rectangle when rendering isolated descendants.
    if (ancestor && !included.has(layer.key)) {
      for (const block of layer.blocks) {
        if (!["artb", "artd", "abdd"].includes(block.key)) continue;
        const insert = transparentArtboard(copy, block.start, block.end);
        if (insert) {
          inserts.push(insert);
          for (const offset of [layer.extraLengthAt, doc.infoStart - 4, doc.maskLengthAt]) {
            copy.writeUInt32BE(copy.readUInt32BE(offset) + insert.field.length, offset);
          }
        }
      }
    }
  }
  if (!inserts.length) return copy;
  const parts: Buffer[] = [];
  let previous = 0;
  for (const insert of inserts.sort((a, b) => a.position - b.position)) {
    parts.push(copy.subarray(previous, insert.position), insert.field);
    previous = insert.position;
  }
  return Buffer.concat([...parts, copy.subarray(previous)]);
}

const run = promisify(execFile);
function defaultExecutable() {
  if (process.platform === "win32") {
    for (const root of [process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs"), process.env.ProgramFiles]) {
      if (!root) continue;
      const path = join(root, "ArtCraft", "PhotoCraft", "photocraft-cli.exe");
      if (existsSync(path)) return path;
    }
  }
  return "photocraft-cli";
}
export async function renderPhotoCraft(bytes: Uint8Array, keys: number[], executable: string): Promise<string> {
  if (executable && !isAbsolute(executable)) throw new Error("gameflow.photoCraftCliPath 须为可执行文件的绝对路径。");
  const snapshot = isolateSlice(bytes, keys);
  const dir = await mkdtemp(join(tmpdir(), "gameflow-slice-"));
  try {
    await writeFile(join(dir, "source.psd"), snapshot);
    await run(executable || defaultExecutable(), ["run", "source.psd", "--no-gpu", "--out", "slice.png"], {
      cwd: dir, windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024
    });
    const png = join(dir, "slice.png");
    if ((await stat(png)).size > 48 * 1024 * 1024) throw new Error("PhotoCraft 渲染结果超过 48 MB。");
    return "data:image/png;base64," + (await readFile(png)).toString("base64");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("未找到 PhotoCraft CLI。请在 VS Code 设置 gameflow.photoCraftCliPath 中指定 photocraft-cli 的绝对路径，或将其加入 PATH。");
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
