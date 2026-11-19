import {
  type GameFlowDocument,
  validateGameFlowDocument
} from "./model";
import type { PagePsdRequest, PagePsdResult } from "./page-psd-protocol";
import { isPagePsdBinding } from "./model";
import { isCanvasReferenceSource } from "./model";
import type { CanvasSources } from "./canvas-references";
import type { CanvasApplyRequest } from "./canvas-instances";
import { validCanvasTarget, validCanvasSelections, isCanvasProperty } from "./canvas-instance-data";
import { isSliceExportBatch, type ResourceConflict, type SliceExportBatch } from "./psd-export";
import { isWorkbenchSettingsRequest, type WorkbenchSettingsRequest, type WorkbenchSettingsResult } from "./workbench-settings";
import { isSliceResourcePath, type ExportedSliceResult } from "./slice-resources";

import { isPrefabExportBatch, type PrefabExportBatch } from "./prefab-export";

export type WebviewToHostMessage =
  | PagePsdRequest
  | { type: "prefabExport"; requestId: string; batch: PrefabExportBatch }
  | WorkbenchSettingsRequest
  | { type: "sliceResources"; requestId: string; paths: string[] }
  | { type: "workbenchFlushed"; requestId: string }
  | { type: "openPsdEditor" }
  | { type: "psdResourceExport"; requestId: string; action: "choose" | "export"; batch?: SliceExportBatch }
  | { type: "ready" }
  | { type: "history"; action: "undo" | "redo" }
  | { type: "save" }
  | { type: "applyCanvasOverrides"; requestId: string; baseVersion: number; request: CanvasApplyRequest; expectedSources: Record<string, string> }
  | { type: "chooseCanvasSource" }
  | { type: "openCanvasSource"; source: string }
  | { type: "psdOutput"; requestId: string; name: string; kind: "psd" | "meta"; base64: string }
  | {
      type: "replaceDocument";
      baseVersion: number;
      document: GameFlowDocument;
    };

export type HostToWebviewMessage =
  | PagePsdResult
  | { type: "pagePsdChanged"; documentId: string }
  | { type: "prefabExportResult"; requestId: string; count?: number; error?: string }
  | WorkbenchSettingsResult
  | { type: "sliceResourcesResult"; requestId: string; resources: ExportedSliceResult[] }
  | { type: "workbenchFlush"; requestId: string }
  | { type: "psdResourceExportResult"; requestId: string; directory?: string; count?: number; cancelled?: boolean; error?: string; conflicts?: ResourceConflict[] }
  | { type: "canvasSources"; sources: CanvasSources; pickedSource?: string; error?: string }
  | { type: "psdOutputResult"; requestId: string; saved: boolean; error?: string }
  | { type: "commandCompleted"; action: "save" | "undo" | "redo" | "applyCanvas"; requestId?: string }
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
  if (value.type === "pagePsd") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80 && typeof value.pageId === "string" && value.pageId.length > 0 && value.pageId.length <= 128 && (value.expected === undefined || isPagePsdBinding(value.expected)) && (value.action === "choose" || value.action === "load" && isPagePsdBinding(value.expected) || value.action === "generate" && typeof value.name === "string" && /^[^\\/:*?"<>|\x00-\x1f]{1,156}\.psd$/i.test(value.name) && !value.name.includes("..") && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value.name) && typeof value.base64 === "string" && value.base64.length > 0 && value.base64.length <= 44_739_244 && value.base64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value.base64));
  if (value.type === "workbenchSettings") return isWorkbenchSettingsRequest(value);
  if (value.type === "sliceResources") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80 &&
    Array.isArray(value.paths) && value.paths.length <= 128 && value.paths.every(isSliceResourcePath) && new Set(value.paths).size === value.paths.length;
  if (value.type === "prefabExport") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80 && isPrefabExportBatch(value.batch);
  if (value.type === "ready") {
    return true;
  }
  if (value.type === "workbenchFlushed") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80;
  if (value.type === "save" || value.type === "openPsdEditor") return true;
  if (value.type === "psdResourceExport") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80 && (value.action === "choose" ? value.batch === undefined : value.action === "export" && isSliceExportBatch(value.batch));
  if (value.type === "applyCanvasOverrides") {
    const request = value.request;
    if (isRecord(request) && request.selections !== undefined && (!validCanvasSelections(request.selections) || request.target !== undefined || request.fields !== undefined)) return false;
    return typeof value.requestId === "string" && value.requestId.length <= 80 && Number.isInteger(value.baseVersion) && isRecord(request) && typeof request.pageId === "string" && typeof request.ownerId === "string" && (request.target === undefined || validCanvasTarget(request.target)) && (request.fields === undefined || Array.isArray(request.fields) && request.fields.length <= 200 && request.fields.every(field => typeof field === "string" && isCanvasProperty(field))) && isRecord(value.expectedSources) && Object.keys(value.expectedSources).length <= 64 && Object.entries(value.expectedSources).every(([source, stamp]) => isCanvasReferenceSource(source) && typeof stamp === "string" && stamp.length <= 100);
  }
  if (value.type === "chooseCanvasSource") return true;
  if (value.type === "openCanvasSource") return isCanvasReferenceSource(value.source) && value.source !== "";
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
