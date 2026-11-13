import {
  type GameFlowDocument,
  validateGameFlowDocument
} from "./model";

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "history"; action: "undo" | "redo" }
  | { type: "save" }
  | { type: "psdOutput"; requestId: string; name: string; kind: "psd" | "meta"; base64: string }
  | {
      type: "replaceDocument";
      baseVersion: number;
      document: GameFlowDocument;
    };

export type HostToWebviewMessage =
  | { type: "psdOutputResult"; requestId: string; saved: boolean; error?: string }
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
  if (value.type === "psdOutput") {
    return typeof value.requestId === "string" && value.requestId.length <= 80 && typeof value.name === "string" && value.name.length > 0 && value.name.length <= 160 && !/[\\/:*?"<>|\x00-\x1f]/.test(value.name) && !value.name.includes("..") && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value.name) && (value.kind === "psd" ? /\.psd$/i.test(value.name) : value.kind === "meta" && /\.meta\.json$/i.test(value.name)) && typeof value.base64 === "string" && value.base64.length > 0 && value.base64.length <= 48 * 1024 * 1024 && value.base64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value.base64);
  }
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
