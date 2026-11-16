export const hasFileDrag = (data: { types: readonly string[] }) => data.types.includes("Files");

export function droppedPsd<T extends { name: string }>(files: ArrayLike<T>): T {
  if (files.length !== 1) throw new Error("请每次拖入一个 PSD 文件。");
  const file = files[0];
  if (!/\.psd$/i.test(file.name)) throw new Error("请拖入 .psd 文件。");
  return file;
}
