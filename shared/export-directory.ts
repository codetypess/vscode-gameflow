const reserved = "(?:[cC][oO][nN]|[pP][rR][nN]|[aA][uU][xX]|[nN][uU][lL]|[cC][oO][mM][1-9]|[lL][pP][tT][1-9])";
const segment = `(?!(?:\\.{1,2}|${reserved}(?:\\.[^/]*)?)(?:/|$))[^/\\\\:*?"<>|\\x00-\\x1f]+(?<![ .])`;
/** Canonical portable relative path, shared with the JSON Schema. */
export const EXPORT_DIRECTORY_PATTERN = `^(?:${segment})(?:/(?:${segment}))*$(?![\\s\\S])`;
const validDirectory = new RegExp(EXPORT_DIRECTORY_PATTERN);

export function normalizeExportDirectory(value: string): string | undefined {
  return value.trim().replace(/\\/g, "/") || undefined;
}
export function exportDirectoryError(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length > 512 || !validDirectory.test(value)) return "请输入根目录下的相对目录，如 ui/login；不能包含绝对路径、.. 或无效文件夹名称。";
  return null;
}
export function exportDirectorySegments(value?: string): string[] {
  const issue = exportDirectoryError(value);
  if (issue) throw new Error(issue);
  return value ? value.split("/") : [];
}
export function exportDestination(root: string | undefined, directory?: string): string | undefined {
  if (!root) return undefined;
  return directory ? `${root.replace(/[\\/]+$/, "")}/${directory}` : root;
}
