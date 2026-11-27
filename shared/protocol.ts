import {
  type GameFlowDocument,
  validateGameFlowDocument
} from "./model";
import { validComponentPsdFields, validPsdBase64, validPsdFilename, type PagePsdRequest, type PagePsdResult } from "./page-psd-protocol";
import { isPagePsdBinding } from "./model";
import { isCanvasReferenceSource } from "./model";
import type { CanvasSources } from "./canvas-references";
import type { CanvasApplyRequest } from "./canvas-instances";
import { validCanvasTarget, validCanvasSelections, isCanvasProperty } from "./canvas-instance-data";
import { isSliceExportBatch, type ResourceConflict, type SliceExportBatch } from "./psd-export";
import { isWorkbenchSettingsRequest, type WorkbenchSettingsRequest, type WorkbenchSettingsResult } from "./workbench-settings";
import { isSliceResourcePath, type ExportedSliceResult } from "./slice-resources";

import { isPrefabExportBatch, validPrefabTarget, type ImageMetaTarget, type PrefabExportBatch, type PrefabTarget, type PrefabSnapshot, type PrefabWriteGuard } from "./prefab-export";
import { validGrid } from "./psd-meta";
import { isPanelWidthMessage, type PanelWidthMessage } from "./panel-width";
import { isExtensionUpdateRequest, type ExtensionUpdateRequest, type ExtensionUpdateMessage } from "./extension-update";

export type OutputKind = "psd" | "meta" | "png";
export const MAX_OUTPUT_BASE64_LENGTH = 48 * 1024 * 1024;

export type WebviewToHostMessage =
  | PanelWidthMessage
  | ExtensionUpdateRequest
  | { type: "psdRenderSlice" | "psdRenderVisibility"; requestId: string; sourceHash: string; keys: number[]; base64?: string }
  | { type: "psdImportSource"; requestId: string; pageId: string }
  | PagePsdRequest
  | { type:"prefabInspect";requestId:string;target:PrefabTarget;images?:ImageMetaTarget[] }
  | { type:"prefabCommit";requestId:string;batch:PrefabExportBatch;guard:PrefabWriteGuard;root:string;baseVersion:number;document:GameFlowDocument }
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
  | { type: "psdOutput"; requestId: string; name: string; kind: OutputKind; base64: string }
  | {
      type: "replaceDocument";
      baseVersion: number;
      document: GameFlowDocument;
    };

export type HostToWebviewMessage =
  | ExtensionUpdateMessage
  | { type: "psdImportSourceResult"; requestId: string; base64?: string; name?: string }
  | { type: "psdRenderSliceResult" | "psdRenderVisibilityResult"; requestId: string; image?: string; error?: string }
  | PagePsdResult
  | {type:"prefabInspectResult";requestId:string;snapshot?:PrefabSnapshot;error?:string}
  | { type: "pagePsdChanged"; documentId: string }
  | { type: "pagePsdChanged"; sources: string[] }
  | { type: "prefabExportResult"; requestId: string; count?: number; error?: string }
  | WorkbenchSettingsResult
  | { type: "sliceResourcesResult"; requestId: string; resources: ExportedSliceResult[] }
  | { type: "sliceResourcesChanged"; directory: string }
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
  if (value.type === "extensionUpdateReady" || value.type === "installExtensionUpdate") return isExtensionUpdateRequest(value);
  if (value.type === "psdImportSource") return typeof value.requestId === "string" && value.requestId.length <= 80 &&
    typeof value.pageId === "string" && value.pageId.length > 0 && value.pageId.length <= 128;
  if (value.type === "psdRenderSlice" || value.type === "psdRenderVisibility") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80 &&
    typeof value.sourceHash === "string" && /^[a-f0-9]{64}$/.test(value.sourceHash) &&
    (value.base64 === undefined || value.type === "psdRenderSlice" && validPsdBase64(value.base64)) &&
    Array.isArray(value.keys) && value.keys.length > 0 && value.keys.length <= (value.type === "psdRenderSlice" ? 1 : 128) &&
    value.keys.every(key => Number.isInteger(key) && key >= 0 && key < 256) && new Set(value.keys).size === value.keys.length;
  if (value.type === "pagePsd") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80 && typeof value.pageId === "string" && value.pageId.length > 0 && value.pageId.length <= 128 && (value.expected === undefined || isPagePsdBinding(value.expected)) && (value.action === "choose" || (value.action === "load" || value.action === "slice" || value.action === "review") && isPagePsdBinding(value.expected) || (value.action === "generate" || value.action === "syncCopy" && isPagePsdBinding(value.expected) && typeof value.reviewStamp === "string" && /^[a-f0-9]{64}$/.test(value.reviewStamp) && typeof value.sourceHash === "string" && /^[a-f0-9]{64}$/.test(value.sourceHash)) && validPsdFilename(value.name) && validPsdBase64(value.base64)) && validComponentPsdFields(value);
  if (value.type === "workbenchSettings") return isWorkbenchSettingsRequest(value);
  if (value.type === "panelWidth") return isPanelWidthMessage(value);
  if (value.type === "sliceResources") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80 &&
    Array.isArray(value.paths) && value.paths.length <= 128 && value.paths.every(isSliceResourcePath) && new Set(value.paths).size === value.paths.length;
  if (value.type === "prefabExport") return typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 80 && isPrefabExportBatch(value.batch);
  if (value.type==="prefabInspect" || value.type==="prefabCommit") {
    if(typeof value.requestId!=="string" || !value.requestId || value.requestId.length>80) return false;
    if(value.type==="prefabInspect") return validPrefabTarget(value.target) && (value.images===undefined ||
      Array.isArray(value.images) && value.images.length<=512 && value.images.every(image=>isRecord(image) && isSliceResourcePath(image.path) && (image.nineGrid===null || validGrid(image.nineGrid,4096,4096)) && (image.sha256===undefined || typeof image.sha256==="string" && /^[a-f0-9]{64}$/.test(image.sha256))));
    const g=value.guard;
    return typeof value.root==="string" && Number.isInteger(value.baseVersion) && isRecord(g) && (g.hash===null || typeof g.hash==="string" && /^[a-f0-9]{64}$/.test(g.hash)) &&
      (g.source===undefined || g.source==="psd" || g.source==="prefab") && typeof g.writePrefab==="boolean" && Array.isArray(g.added) && g.added.every(id=>typeof id==="string") && isPrefabExportBatch(value.batch) && validateGameFlowDocument(value.document).ok;
  }
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
    if (typeof value.name !== "string" || !value.name || value.name.length > 160 ||
        /[\\/:*?"<>|\x00-\x1f]/.test(value.name) || value.name.includes("..") ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value.name)) return false;
    const suffix = value.kind === "psd" ? ".psd" : value.kind === "meta" ? ".meta.json" : value.kind === "png" ? ".png" : undefined;
    return !!suffix && value.name.toLowerCase().endsWith(suffix) &&
      typeof value.requestId === "string" && value.requestId.length <= 80 &&
      typeof value.base64 === "string" && value.base64.length > 0 && value.base64.length <= MAX_OUTPUT_BASE64_LENGTH &&
      value.base64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value.base64) &&
      (value.kind !== "png" || value.base64.startsWith("iVBORw0KGgoAAAANSUhEU"));
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
