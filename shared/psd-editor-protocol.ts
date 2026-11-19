import { isPsdDraft, type PsdDraft } from "./psd-draft";

export type PsdEditorRequest =
  | { type: "psdEditorReady" }
  | { type: "psdEditorFlushed"; requestId: string }
  | { type: "psdEditorEdit"; requestId: string; baseVersion: number; draft: PsdDraft }
  | { type: "psdEditorCommand"; requestId: string; action: "save" | "undo" | "redo" | "copy" };
export interface PsdEditorState {
  type: "psdEditorState"; version: number; draft: PsdDraft; dirty: boolean;
  backup: "pending" | "saved" | "error" | "none"; error?: string; warning?: string;
  requestId?: string; rejected?: boolean;
}
export type PsdEditorMessage = PsdEditorState
  | { type: "psdEditorReveal" }
  | { type: "psdEditorFlush"; requestId: string }
  | { type: "psdEditorInit"; name: string; base64: string; state: PsdEditorState; configPath: string; notice?: string }
  | { type: "psdEditorCommandResult"; requestId: string; error?: string };
export function isPsdEditorRequest(value: unknown): value is PsdEditorRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.type === "psdEditorReady") return true;
  if (typeof v.requestId !== "string" || !v.requestId || v.requestId.length > 80) return false;
  if (v.type === "psdEditorFlushed") return true;
  if (v.type === "psdEditorEdit") return Number.isSafeInteger(v.baseVersion) && Number(v.baseVersion) > 0 && isPsdDraft(v.draft);
  return v.type === "psdEditorCommand" && ["save", "undo", "redo", "copy"].includes(String(v.action));
}
