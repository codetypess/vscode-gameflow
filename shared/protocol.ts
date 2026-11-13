import {
  type GameFlowDocument,
  validateGameFlowDocument
} from "./model";

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "history"; action: "undo" | "redo" }
  | { type: "save" }
  | {
      type: "replaceDocument";
      baseVersion: number;
      document: GameFlowDocument;
    };

export type HostToWebviewMessage =
  | { type: "commandCompleted"; action: "save" | "undo" | "redo" }
  | {
      type: "init";
      document: GameFlowDocument;
      documentVersion: number;
      resourceName: string;
      dirty: boolean;
    }
  | {
      type: "documentChanged";
      document: GameFlowDocument;
      documentVersion: number;
      dirty: boolean;
    }
  | { type: "documentError"; message: string; details: string[] }
  | {
      type: "updateRejected";
      reason: string;
      currentVersion: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isWebviewToHostMessage(
  value: unknown
): value is WebviewToHostMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }
  if (value.type === "ready") {
    return true;
  }
  if (value.type === "save") return true;
  if (value.type === "history") return value.action === "undo" || value.action === "redo";
  if (value.type === "replaceDocument") {
    return (
      typeof value.baseVersion === "number" &&
      Number.isInteger(value.baseVersion) &&
      validateGameFlowDocument(value.document).ok
    );
  }
  return false;
}
