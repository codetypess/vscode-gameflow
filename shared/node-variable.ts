import type { GameFlowPage } from "./model";

export const VARIABLE_NAME_PATTERN = "^[A-Za-z_$][A-Za-z0-9_$]*$(?![\\s\\S])";
export const VARIABLE_RESERVED_WORDS = [
  "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
  "false", "finally", "for", "function", "if", "implements", "import", "in", "instanceof", "interface", "let", "new", "null", "package", "private",
  "protected", "public", "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield", "eval", "arguments"
] as const;
const identifier = new RegExp(VARIABLE_NAME_PATTERN);
const reserved = new Set<string>(VARIABLE_RESERVED_WORDS);

export function variableNameError(value: unknown): string | null {
  if (typeof value !== "string" || !identifier.test(value)) return "以字母、_ 或 $ 开头，后续可用字母、数字、_、$";
  return reserved.has(value) ? "不能使用程序保留字" : null;
}

/** Empty UI input removes the optional field; names share one page scope. */
export function nodeVariableNameError(page: GameFlowPage, id: string, value: string): string | null {
  if (!value) return null;
  return variableNameError(value) ?? (page.nodes.some((node) => node.id !== id && node.variableName === value) ? "当前页面已有同名变量" : null);
}

export function allocateVariableName(preferred: string, occupied: Set<string>): string {
  let candidate = preferred, suffix = 2;
  while (occupied.has(candidate)) candidate = `${preferred}${suffix++}`;
  occupied.add(candidate);
  return candidate;
}
