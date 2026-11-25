import { isImageSlot, IMAGE_SLOT_FIELDS, type ImageSlot } from "./image-slots";
import { allocateElementId, ELEMENT_ID_SCHEME, reserveDocumentElementIds } from "./element-id";
import { canHaveChildren, COMPONENT_TYPES, PAGE_ROOT_TYPES } from "./ui-components";
import { validateRootLayout, validateUIConfig } from "./ui-config";
import type { ConstraintLayout, NodeLayout, WidgetProps } from "./ui-config";
import { variableNameError } from "./node-variable";
import { validSyncBase, type SyncBase, type SyncNode } from "./page-sync";
import { exportDirectoryError } from "./export-directory";
import { isSliceResourceRef, type SliceResourceRef } from "./slice-resources";
import { validateControlReferences } from "./ui-parts";
import { validateNodeTransform, type NodeTransform } from "./ui-transform";
import { isCanvasProperty, readProperty, targetKey, ownedCanvasNodes, validCanvasTarget, writeProperty, type CanvasInstanceEdits } from "./canvas-instance-data";
export type { NodeTransform } from "./ui-transform";
export type { ConstraintLayout, NodeLayout, WidgetProps } from "./ui-config";

export const GAMEFLOW_SCHEMA_VERSION = 5 as const;
export const CANVAS_INSTANCE_LAYOUT_KEYS: readonly string[] = ["left", "right", "centerX", "top", "bottom", "centerY", "layoutUnit", "widthMode", "heightMode", "crossAxisMode", "positionOffsetX", "positionOffsetY"];

export interface CanvasReference {
  /** Relative to the containing GameFlow file; empty means the same file. */
  source: string;
  documentId: string;
  pageId: string;
}

export function isCanvasReferenceSource(value: unknown): value is string {
  return typeof value === "string" && value.length <= 512 && (value === "" ||
    (!value.startsWith("/") &&
      !/[\\:*?"<>|#\x00-\x1f]/.test(value) && /\.gameflow\.json$/i.test(value)));
}

export type RequirementStatus = "confirmed" | "inferred" | "question";
export type PageKind = "screen" | "modal";
export type PageRootType = "UIStack" | "UITop" | "UIScene" | "UIBox";
export type NodeType =
  | "container"
  | "rectangle"
  | "text"
  | "button"
  | "image"
  | "list"
  | "input" | "hbox" | "vbox" | "grid" | "panel" | "checkbox" | "radio" | "radioGroup" | "progress" | "slider" | "combo";

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameFlowRequirement {
  id: string;
  text: string;
  status: RequirementStatus;
  source: string;
}

export interface GameFlowNode {
  id: string;
  name: string;
  variableName?: string;
  type: NodeType;
  frame: Frame;
  parentId?: string;
  text?: string;
  style?: NodeStyle;
  imageData?: string;
  image?: ImageSlot | null;
  normalSkin?: ImageSlot | null;
  selectedSkin?: ImageSlot | null;
  disabledSkin?: ImageSlot | null;
  sliceResource?: SliceResourceRef;
  hidden?: boolean;
  locked?: boolean;
  exportEnabled?: boolean;
  layout?: NodeLayout;
  widget?: WidgetProps;
  transform?: NodeTransform;
  cellPrefab?: CanvasReference | { uuid: string };
  prefab?: CanvasReference;
  instanceEdits?: CanvasInstanceEdits;
}

export interface NodeStyle {
  fill?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
}

export interface PagePsdBinding { source: string; documentId: string }
export function isPagePsdSource(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !value.startsWith("/") && !/[\\:*?"<>|#\x00-\x1f]/.test(value) && /\.psd$/i.test(value);
}
export function isPagePsdBinding(value: unknown): value is PagePsdBinding {
  return isRecord(value) && Object.keys(value).every(key => key === "source" || key === "documentId") && isPagePsdSource(value.source) && typeof value.documentId === "string" && value.documentId.trim().length > 0 && value.documentId.length <= 128;
}

export interface GameFlowPage {
  /** Explicit art source, relative to this GameFlow file. */
  artPsd?: PagePsdBinding;
  psdSync?: SyncBase;
  prefabSync?: {version:1; documentId:string; pageId:string; target:string; nodes:SyncNode[]};
  id: string;
  name: string;
  /** Optional authored name for future Prefab generation, independent of the display name. */
  exportName?: string;
  kind: PageKind;
  rootType?: PageRootType;
  frame: Frame;
  nodes: GameFlowNode[];
  background?: string;
  layout?: ConstraintLayout;
  /** Explicit editable root for a component extracted from a UIBox subtree. */
  componentRootId?: string;
}

export function isColor(value: unknown): value is string {
  return typeof value === "string" && /^(#[0-9a-f]{6}|transparent)$/i.test(value);
}

export function isImageData(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 7_000_000 ||
    !/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(value)) return false;
  const encoded = value.slice(value.indexOf(",") + 1);
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return encoded.length % 4 === 0 && encoded.length / 4 * 3 - padding <= 5 * 1024 * 1024;
}

export interface GameFlowInteraction {
  id: string;
  fromPageId: string;
  toPageId: string;
  trigger: string;
}

export interface GameFlowDocument {
  schemaVersion: 1 | 2 | 3 | 4 | typeof GAMEFLOW_SCHEMA_VERSION;
  elementIdScheme?: typeof ELEMENT_ID_SCHEME;
  documentId: string;
  title: string;
  /** Shared relative path under each user's locally configured export roots. */
  exportDirectory?: string;
  requirements: GameFlowRequirement[];
  pages: GameFlowPage[];
  interactions: GameFlowInteraction[];
}

export type ValidationResult =
  | { ok: true; document: GameFlowDocument }
  | { ok: false; errors: string[] };

const REQUIREMENT_STATUSES: readonly RequirementStatus[] = [
  "confirmed",
  "inferred",
  "question"
];
const PAGE_KINDS: readonly PageKind[] = ["screen", "modal"];
const NODE_TYPES: readonly NodeType[] = COMPONENT_TYPES;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateString(
  value: unknown,
  path: string,
  errors: string[]
): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
    return false;
  }
  return true;
}

function validateFrame(value: unknown, path: string, errors: string[]): value is Frame {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }

  let valid = true;
  for (const key of ["x", "y", "width", "height"] as const) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      errors.push(`${path}.${key} must be a finite number`);
      valid = false;
    }
  }
  if (typeof value.width === "number" && value.width <= 0) {
    errors.push(`${path}.width must be greater than zero`);
    valid = false;
  }
  if (typeof value.height === "number" && value.height <= 0) {
    errors.push(`${path}.height must be greater than zero`);
    valid = false;
  }
  return valid;
}

function validateRequirement(
  value: unknown,
  path: string,
  errors: string[]
): value is GameFlowRequirement {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  const idValid = validateString(value.id, `${path}.id`, errors);
  const textValid = validateString(value.text, `${path}.text`, errors);
  const sourceValid = validateString(value.source, `${path}.source`, errors);
  const statusValid = REQUIREMENT_STATUSES.includes(value.status as RequirementStatus);
  if (!statusValid) {
    errors.push(`${path}.status must be confirmed, inferred, or question`);
  }
  return idValid && textValid && sourceValid && statusValid;
}

function validateNode(
  value: unknown,
  path: string,
  errors: string[], depth = 0
): value is GameFlowNode {
  if (depth > 24) { errors.push(`${path} nesting exceeds 24 levels`); return false; }
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  const idValid = validateString(value.id, `${path}.id`, errors);
  const nameValid = validateString(value.name, `${path}.name`, errors);
  const typeValid = NODE_TYPES.includes(value.type as NodeType);
  if (!typeValid) {
    errors.push(`${path}.type is not a supported node type`);
  }
  const frameValid = validateFrame(value.frame, `${path}.frame`, errors);
  let optionalValid = true;
  if (value.instanceEdits !== undefined) {
    const edits = value.instanceEdits;
    if (!value.prefab || !isRecord(edits) || Object.keys(edits).some(k => !["overrides", "additions"].includes(k)) || !Array.isArray(edits.overrides) || !Array.isArray(edits.additions) || edits.overrides.length > 5000 || edits.additions.length > 5000) {
      errors.push(`${path}.instanceEdits must contain bounded overrides and additions on a reference`); optionalValid = false;
    } else {
      const targets = new Set<string>();
      for (const [i, patch] of edits.overrides.entries()) {
        const at = `${path}.instanceEdits.overrides[${i}]`;
        if (!isRecord(patch) || Object.keys(patch).some(k => !["target", "set", "unset"].includes(k)) || !validCanvasTarget(patch.target) || !isRecord(patch.set) || !Array.isArray(patch.unset) || patch.unset.some(k => typeof k !== "string" || !isCanvasProperty(k) || k === "name" || k.startsWith("frame.")) || Object.keys(patch.set).some(k => !isCanvasProperty(k) || (patch.unset as unknown[]).includes(k))) {
          errors.push(`${at} has invalid target or property paths`); optionalValid = false; continue;
        }
        const key = targetKey(patch.target);
        if (targets.has(key)) { errors.push(`${at} duplicates an override target`); optionalValid = false; } targets.add(key);
        if (!patch.target.path.length && [...Object.keys(patch.set), ...patch.unset].some(field => ["name", "variableName", "hidden", "exportEnabled", "style.opacity"].includes(field) || field.startsWith("frame.") || field.startsWith("transform.") || field.startsWith("layout.") && CANVAS_INSTANCE_LAYOUT_KEYS.includes(field.slice(7)))) {
          errors.push(`${at} contains an independently owned root property`); optionalValid = false;
        }
        // Validate values independently of external source availability. Full target compatibility is composed later.
        for (const [field, v] of Object.entries(patch.set)) {
          if (["widget.skinNodeId", "widget.textLabelNodeId"].includes(field) && isRecord(v) && Object.keys(v).length === 1 && validCanvasTarget(v.canvasTarget)) continue;
          if (field === "widget.optionNodeIds" && Array.isArray(v) && v.length <= 1000 && v.every(item => item === null || isRecord(item) && Object.keys(item).length === 1 && validCanvasTarget(item.canvasTarget))) continue;
          if (["widget.skinNodeId", "widget.optionNodeIds", "widget.textLabelNodeId"].includes(field) && v !== null) { errors.push(`${at}.set.${field} must use scoped canvas targets`); optionalValid = false; continue; }
          const test = writeProperty({ id: "validate", name: "validate", type: "container", frame: { x: 0, y: 0, width: 1, height: 1 } }, field, v);
          if (field === "cellPrefab" || field === "layout.scrollType") test.type = "list";
          if (["sliceResource", "image"].includes(field)) test.type = "image";
          if (["normalSkin", "selectedSkin", "disabledSkin"].includes(field)) test.type = "button";
          if (field.startsWith("widget.")) test.type = field === "widget.optionNodeIds" ? "radioGroup" : field === "widget.skinNodeId" ? "slider" : field === "widget.textLabelNodeId" ? "combo" : field === "widget.mode" ? "progress" : "text";
          if (field.startsWith("widget.") && typeof v === "number" && Number.isFinite(v)) {
            if (field === "widget.min") test.widget = {min:v,max:v+1,value:v};
            if (field === "widget.max") test.widget = {min:v-1,max:v,value:v};
            if (field === "widget.value") test.widget = {min:v-1,max:v+1,value:v};
            if (field === "widget.selectedIndex" && v >= 0 && v < 1000) test.widget = {selectedIndex:v,options:Array(v+1).fill("")};
          }
          optionalValid = validateNode(test, `${at}.set`, errors) && optionalValid;
        }
      }
      for (const [i, addition] of edits.additions.entries()) {
        const at = `${path}.instanceEdits.additions[${i}]`;
        if (!isRecord(addition) || Object.keys(addition).some(k => !["node", "parent", "before", "references"].includes(k)) || !validCanvasTarget(addition.parent) || (addition.before !== undefined && !validCanvasTarget(addition.before)) || !isRecord(addition.node) || addition.node.parentId !== undefined) {
          errors.push(`${at} has invalid addition or parent`); optionalValid = false; continue;
        }
        optionalValid = validateNode(addition.node, `${at}.node`, errors, depth + 1) && optionalValid;
        if (typeof readProperty(addition.node,"widget.skinNodeId") === "string" || typeof readProperty(addition.node,"widget.textLabelNodeId") === "string" || Array.isArray(readProperty(addition.node,"widget.optionNodeIds")) && (readProperty(addition.node,"widget.optionNodeIds") as unknown[]).some(id=>id!==null)) { errors.push(`${at} control references must use scoped targets`); optionalValid = false; }
        if (isRecord(addition.references) && Object.keys(addition.references).some(field=>readProperty(addition.node,field)!==undefined)) {errors.push(`${at} duplicates a scoped control reference`); optionalValid=false;}
        if (addition.references !== undefined && (!isRecord(addition.references) || Object.entries(addition.references).some(([k,v]) => (["widget.skinNodeId", "widget.textLabelNodeId"].includes(k) ? !validCanvasTarget(v) : k === "widget.optionNodeIds" ? !(Array.isArray(v) && v.length <= 1000 && v.every(item => item === null || validCanvasTarget(item))) : true)))) { errors.push(`${at}.references is invalid`); optionalValid = false; }
      }
    }
  }
  if (value.cellPrefab !== undefined) {
    const ref = value.cellPrefab;
    const valid = isRecord(ref) && (Object.keys(ref).length === 1 && typeof ref.uuid === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(ref.uuid)
      || Object.keys(ref).length === 3 && isCanvasReferenceSource(ref.source) && typeof ref.documentId === "string" && !!ref.documentId && typeof ref.pageId === "string" && !!ref.pageId);
    if (value.type !== "list" || !valid) { errors.push(path + ".cellPrefab 列表项模板引用无效"); optionalValid = false; }
  }
  if (value.prefab !== undefined) {
    if (!isRecord(value.prefab) || !isCanvasReferenceSource(value.prefab.source)) {
      errors.push(`${path}.prefab.source must be empty or a relative .gameflow.json path`);
      optionalValid = false;
    } else {
      if (Object.keys(value.prefab).some(key => !["source", "documentId", "pageId"].includes(key))) { errors.push(`${path}.prefab has unsupported fields`); optionalValid = false; }
      optionalValid = validateString(value.prefab.documentId, `${path}.prefab.documentId`, errors) && optionalValid;
      optionalValid = validateString(value.prefab.pageId, `${path}.prefab.pageId`, errors) && optionalValid;
    }
    if (value.type !== "container") { errors.push(`${path}.prefab requires a container instance`); optionalValid = false; }
    if (value.text !== undefined || value.imageData !== undefined || value.sliceResource !== undefined || IMAGE_SLOT_FIELDS.some(field => value[field] !== undefined) || value.widget !== undefined) {
      errors.push(`${path}.prefab content belongs to the source`); optionalValid = false;
    }
    if (isRecord(value.style) && Object.keys(value.style).some(key => key !== "opacity")) {
      errors.push(`${path}.prefab appearance belongs to the source`); optionalValid = false;
    }
    if (isRecord(value.layout) && (value.layout.widthMode === "measured" || value.layout.heightMode === "measured")) {
      errors.push(`${path}.prefab dimensions must be explicit or constrained`); optionalValid = false;
    }
    if (isRecord(value.layout) && Object.keys(value.layout).some(key => !CANVAS_INSTANCE_LAYOUT_KEYS.includes(key))) {
      errors.push(`${path}.prefab content layout belongs to the source`); optionalValid = false;
    }
  }
  if (value.variableName !== undefined) {
    const issue = variableNameError(value.variableName);
    if (issue) { errors.push(`${path}.variableName: ${issue}`); optionalValid = false; }
  }
  if (value.parentId !== undefined) {
    optionalValid = validateString(value.parentId, `${path}.parentId`, errors) && optionalValid;
  }
  if (value.text !== undefined && typeof value.text !== "string") {
    errors.push(`${path}.text must be a string when provided`);
    optionalValid = false;
  }
  for (const key of ["hidden", "locked", "exportEnabled"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      errors.push(`${path}.${key} must be a boolean`);
      optionalValid = false;
    }
  }
  if (value.imageData !== undefined && !isImageData(value.imageData)) {
    errors.push(`${path}.imageData must be a raster image data URI under 5 MB`);
    optionalValid = false;
  }
  if (value.sliceResource !== undefined && (value.type !== "image" || !isSliceResourceRef(value.sliceResource))) {
    errors.push(`${path}.sliceResource requires an image and a valid relative PNG resource reference`);
    optionalValid = false;
  }
  for (const field of IMAGE_SLOT_FIELDS) {
    if (value[field] !== undefined && (!isImageSlot(value[field]) || (field === "image" ? value.type !== "image" : value.type !== "button"))) {
      errors.push(path + "." + field + " requires an image resource slot on the matching node type"); optionalValid = false;
    }
  }
  if (value.style !== undefined) {
    if (!isRecord(value.style)) {
      errors.push(`${path}.style must be an object`);
      optionalValid = false;
    } else {
      const style = value.style;
      for (const key of ["italic", "underline", "strikethrough"] as const) {
        if (style[key] !== undefined && typeof style[key] !== "boolean") {
          errors.push(`${path}.style.${key} must be a boolean`);
          optionalValid = false;
        }
      }
      for (const key of ["fill", "color", "borderColor"] as const) {
        if (style[key] !== undefined && !isColor(style[key])) {
          errors.push(`${path}.style.${key} must be a hex color or transparent`);
          optionalValid = false;
        }
      }
      for (const key of ["borderWidth", "radius", "fontSize", "fontWeight", "opacity"] as const) {
        const number = style[key];
        if (number !== undefined && (typeof number !== "number" || !Number.isFinite(number) || number < 0 ||
          (key === "opacity" && number > 1) || (key === "fontSize" && number < 1))) {
          errors.push(`${path}.style.${key} is out of range`);
          optionalValid = false;
        }
      }
      if (style.textAlign !== undefined && !["left", "center", "right"].includes(String(style.textAlign))) {
        errors.push(`${path}.style.textAlign is invalid`);
        optionalValid = false;
      }
    }
  }
  const configValid = validateUIConfig(value, path, errors);
  const transformValid = validateNodeTransform(value.transform, `${path}.transform`, errors);
  return idValid && nameValid && typeValid && frameValid && optionalValid && configValid && transformValid;
}

function validatePage(
  value: unknown,
  path: string,
  errors: string[]
): value is GameFlowPage {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  const idValid = validateString(value.id, `${path}.id`, errors);
  const nameValid = validateString(value.name, `${path}.name`, errors);
  const kindValid = PAGE_KINDS.includes(value.kind as PageKind);
  if (!kindValid) {
    errors.push(`${path}.kind must be screen or modal`);
  }
  const rootTypeValid = value.rootType === undefined || PAGE_ROOT_TYPES.includes(value.rootType as PageRootType);
  if (!rootTypeValid) errors.push(`${path}.rootType must be UIStack, UITop, UIScene, or UIBox`);
  const exportNameValid = value.exportName === undefined || validateString(value.exportName, `${path}.exportName`, errors);
  const artPsdValid = value.artPsd === undefined || isPagePsdBinding(value.artPsd);
  if (!artPsdValid) errors.push(`${path}.artPsd must contain a relative PSD source and documentId`);
  const syncValid = value.psdSync === undefined || validSyncBase(value.psdSync);
  if (!syncValid) errors.push(`${path}.psdSync 同步基线无效`);
  const prefab = value.prefabSync;
  if (prefab !== undefined && !(isRecord(prefab) && typeof prefab.target==="string" && prefab.target.endsWith(".lh") && !exportDirectoryError(prefab.target) && validSyncBase({...prefab,psdId:prefab.target}))) {
    errors.push(`${path}.prefabSync 同步记录无效`); return false;
  }
  const layoutValid = validateRootLayout(value.layout, `${path}.layout`, errors);
  const componentValid = value.componentRootId === undefined || validateString(value.componentRootId, `${path}.componentRootId`, errors);
  const frameValid = validateFrame(value.frame, `${path}.frame`, errors);
  const backgroundValid = value.background === undefined || isColor(value.background);
  if (!backgroundValid) errors.push(`${path}.background must be a hex color or transparent`);
  const nodes = value.nodes;
  let nodesValid = true;
  if (!Array.isArray(nodes)) {
    errors.push(`${path}.nodes must be an array`);
    nodesValid = false;
  } else {
    const variableNames = new Map<string, number>();
    nodes.forEach((node, index) => {
      nodesValid = validateNode(node, `${path}.nodes[${index}]`, errors) && nodesValid;
      if (isRecord(node) && typeof node.variableName === "string") {
        const first = variableNames.get(node.variableName);
        if (first !== undefined) {
          errors.push(`${path}.nodes[${index}].variableName duplicates ${node.variableName} first used at ${path}.nodes[${first}].variableName`);
          nodesValid = false;
        } else variableNames.set(node.variableName, index);
      }
    });
  }
  return syncValid && artPsdValid && idValid && nameValid && kindValid && rootTypeValid && exportNameValid && layoutValid && componentValid && frameValid && nodesValid && backgroundValid;
}

function validateInteraction(
  value: unknown,
  path: string,
  errors: string[]
): value is GameFlowInteraction {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  return (
    validateString(value.id, `${path}.id`, errors) &&
    validateString(value.fromPageId, `${path}.fromPageId`, errors) &&
    validateString(value.toPageId, `${path}.toPageId`, errors) &&
    validateString(value.trigger, `${path}.trigger`, errors)
  );
}

function validateUniqueIds(
  values: readonly { id: string }[],
  path: string,
  errors: string[]
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value.id)) {
      errors.push(`${path}[${index}].id duplicates ${value.id}`);
    }
    seen.add(value.id);
  });
}

function validateElementIds(pages: readonly GameFlowPage[], errors: string[]): void {
  const firstPathById = new Map<string, string>();
  const check = (id: string, path: string): void => {
    const firstPath = firstPathById.get(id);
    if (firstPath !== undefined) {
      errors.push(`${path} duplicates element ID ${id} first used at ${firstPath}`);
    } else {
      firstPathById.set(id, path);
    }
  };
  pages.forEach((page, pageIndex) => {
    check(page.id, `pages[${pageIndex}].id`);
    ownedCanvasNodes(page.nodes).forEach((node, nodeIndex) => {
      check(node.id, `pages[${pageIndex}].nodes[${nodeIndex}].id`);
    });
  });
}

export function validateGameFlowDocument(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["document must be an object"] };
  }

  if (![1, 2, 3, 4, GAMEFLOW_SCHEMA_VERSION].includes(value.schemaVersion as number)) {
    errors.push(`schemaVersion must be 1, 2, 3 or ${GAMEFLOW_SCHEMA_VERSION}`);
  }
  if (value.elementIdScheme !== undefined && value.elementIdScheme !== ELEMENT_ID_SCHEME) {
    errors.push(`elementIdScheme must be ${ELEMENT_ID_SCHEME}`);
  }
  validateString(value.documentId, "documentId", errors);
  validateString(value.title, "title", errors);
  const directoryIssue = exportDirectoryError(value.exportDirectory);
  if (directoryIssue) errors.push(`exportDirectory: ${directoryIssue}`);

  const requirementsValue = value.requirements;
  let requirementsValid = true;
  if (!Array.isArray(requirementsValue)) {
    errors.push("requirements must be an array");
    requirementsValid = false;
  } else {
    requirementsValue.forEach((requirement, index) => {
      requirementsValid =
        validateRequirement(requirement, `requirements[${index}]`, errors) &&
        requirementsValid;
    });
  }

  const pagesValue = value.pages;
  let pagesValid = true;
  if (!Array.isArray(pagesValue)) {
    errors.push("pages must be an array");
    pagesValid = false;
  } else {
    pagesValue.forEach((page, index) => {
      pagesValid = validatePage(page, `pages[${index}]`, errors) && pagesValid;
    });
  }

  const interactionsValue = value.interactions;
  let interactionsValid = true;
  if (!Array.isArray(interactionsValue)) {
    errors.push("interactions must be an array");
    interactionsValid = false;
  } else {
    interactionsValue.forEach((interaction, index) => {
      interactionsValid =
        validateInteraction(interaction, `interactions[${index}]`, errors) &&
        interactionsValid;
    });
  }

  if (requirementsValid && pagesValid && interactionsValid) {
    const requirements = value.requirements as GameFlowRequirement[];
    const pages = value.pages as GameFlowPage[];
    const interactions = value.interactions as GameFlowInteraction[];
    validateUniqueIds(requirements, "requirements", errors);
    validateElementIds(pages, errors);
    validateUniqueIds(interactions, "interactions", errors);

    const pageIds = new Set(pages.map((page) => page.id));
    for (const interaction of interactions) {
      if (!pageIds.has(interaction.fromPageId)) {
        errors.push(`interaction ${interaction.id} references missing source page`);
      }
      if (!pageIds.has(interaction.toPageId)) {
        errors.push(`interaction ${interaction.id} references missing target page`);
      }
    }
    for (const page of pages) {
      if (page.componentRootId !== undefined && Number(value.schemaVersion) < 4) errors.push(`page ${page.id} componentRootId requires schemaVersion 4`);
      validateControlReferences(page, errors);
      if (value.schemaVersion === 1 && page.rootType !== undefined) {
        errors.push(`page ${page.id} rootType requires schemaVersion 2`);
      }
      if (value.schemaVersion === 1 && page.layout !== undefined) errors.push(`page ${page.id} layout requires schemaVersion 2`);
      if (value.schemaVersion === 1 && page.exportName !== undefined) errors.push(`page ${page.id} exportName requires schemaVersion 2`);
      const nodeIds = new Set(page.nodes.map((node) => node.id));
      for (const node of page.nodes) {
        if (node.prefab && Number(value.schemaVersion) < 4) errors.push(`node ${node.id} prefab requires schemaVersion 4`);
        if (node.instanceEdits && Number(value.schemaVersion) < 5) errors.push(`node ${node.id} instanceEdits requires schemaVersion 5`);
        if (Number(value.schemaVersion) < 3 && (node.type === "radioGroup" || node.widget?.skinNodeId !== undefined || node.widget?.optionNodeIds !== undefined)) errors.push(`node ${node.id} control references require schemaVersion 3`);
        if (value.schemaVersion === 1 && (node.transform !== undefined || node.variableName !== undefined || node.layout || node.widget || !["container", "rectangle", "text", "button", "image", "list", "input"].includes(node.type))) {
          errors.push(`node ${node.id} UI configuration requires schemaVersion 2`);
        }
        if (node.parentId !== undefined && !nodeIds.has(node.parentId)) {
          errors.push(`node ${node.id} references missing parent ${node.parentId}`);
        }
        if (node.parentId === node.id) {
          errors.push(`node ${node.id} cannot be its own parent`);
        }
        const visited = new Set([node.id]);
        let ancestor = node.parentId;
        while (ancestor && nodeIds.has(ancestor)) {
          if (visited.has(ancestor)) {
            errors.push(`node ${node.id} has a cyclic parent relationship`);
            break;
          }
          visited.add(ancestor);
          const parent = page.nodes.find((item) => item.id === ancestor)!;
          if (!canHaveChildren(parent) && !(parent.type === "list" && !parent.cellPrefab)) {
            errors.push(`node ${node.id} parent must support children`);
            break;
          }
          ancestor = parent.parentId;
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, document: value as unknown as GameFlowDocument };
}

export class GameFlowValidationError extends Error {
  public constructor(public readonly errors: string[]) {
    super(errors.join("; "));
    this.name = "GameFlowValidationError";
  }
}

export function parseGameFlowDocument(source: string): GameFlowDocument {
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GameFlowValidationError([`Invalid JSON: ${message}`]);
  }

  const result = validateGameFlowDocument(value);
  if (!result.ok) {
    throw new GameFlowValidationError(result.errors);
  }
  return result.document;
}

export function serializeGameFlowDocument(document: GameFlowDocument): string {
  const result = validateGameFlowDocument(document);
  if (!result.ok) {
    throw new GameFlowValidationError(result.errors);
  }
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function createDefaultGameFlowDocument(
  documentId = "gameflow-backpack"
): GameFlowDocument {
  const document: GameFlowDocument = {
    schemaVersion: GAMEFLOW_SCHEMA_VERSION,
    documentId,
    title: "背包系统 UI 规划",
    requirements: [
      {
        id: "requirement-browse-items",
        text: "玩家可以在背包中查看道具，并打开道具详情。",
        status: "confirmed",
        source: "策划需求"
      },
      {
        id: "requirement-item-filter",
        text: "背包支持按道具类型筛选。",
        status: "inferred",
        source: "AI 分析"
      },
      {
        id: "requirement-capacity",
        text: "背包容量不足时是否需要扩容入口？",
        status: "question",
        source: "待策划确认"
      }
    ],
    pages: [
      {
        id: "page-main-menu",
        name: "主菜单",
        kind: "screen",
        frame: { x: 80, y: 120, width: 320, height: 180 },
        nodes: [
          {
            id: "node-main-title",
            name: "游戏标题",
            type: "text",
            text: "冒险物语",
            frame: { x: 28, y: 24, width: 180, height: 32 }
          },
          {
            id: "node-backpack-button",
            name: "背包按钮",
            type: "button",
            normalSkin: { builtin: "button/gray" },
            frame: { x: 24, y: 112, width: 92, height: 40 }
          },
          { id: "node-backpack-label", name: "按钮文案", type: "text", parentId: "node-backpack-button", text: "背包", frame: { x: 0, y: 10, width: 92, height: 20 }, style: { textAlign: "center" } }
        ]
      },
      {
        id: "page-backpack",
        name: "背包",
        kind: "screen",
        frame: { x: 500, y: 80, width: 360, height: 240 },
        nodes: [
          {
            id: "node-backpack-header",
            name: "页头",
            type: "container",
            frame: { x: 20, y: 18, width: 320, height: 44 }
          },
          {
            id: "node-backpack-title",
            name: "标题",
            type: "text",
            parentId: "node-backpack-header",
            text: "背包",
            frame: { x: 16, y: 8, width: 80, height: 28 }
          },
          {
            id: "node-item-list",
            name: "道具列表",
            type: "list",
            frame: { x: 20, y: 78, width: 320, height: 138 }
          }
        ]
      },
      {
        id: "page-item-detail",
        name: "道具详情",
        kind: "modal",
        frame: { x: 960, y: 130, width: 280, height: 190 },
        nodes: [
          {
            id: "node-item-image",
            name: "道具图标",
            type: "image",
            image: { builtin: "icon/potion" },
            frame: { x: 20, y: 24, width: 72, height: 72 }
          },
          {
            id: "node-item-name",
            name: "道具名称",
            type: "text",
            text: "生命药水",
            frame: { x: 108, y: 26, width: 140, height: 28 }
          },
          {
            id: "node-use-button",
            name: "使用按钮",
            type: "button",
            normalSkin: { builtin: "button/green" },
            frame: { x: 168, y: 132, width: 80, height: 36 }
          },
          { id: "node-use-label", name: "按钮文案", type: "text", parentId: "node-use-button", text: "使用", frame: { x: 0, y: 8, width: 80, height: 20 }, style: { textAlign: "center" } }
        ]
      }
    ],
    interactions: [
      {
        id: "interaction-open-backpack",
        fromPageId: "page-main-menu",
        toPageId: "page-backpack",
        trigger: "点击背包按钮"
      },
      {
        id: "interaction-open-item-detail",
        fromPageId: "page-backpack",
        toPageId: "page-item-detail",
        trigger: "点击道具格"
      }
    ]
  };
  const reserved = new Set<string>();
  reserveDocumentElementIds(document, reserved);
  const pageIds = new Map(document.pages.map((page) => [page.id, allocateElementId(reserved)]));
  return {
    ...document,
    elementIdScheme: ELEMENT_ID_SCHEME,
    pages: document.pages.map((page) => {
      const nodeIds = new Map(page.nodes.map((node) => [node.id, allocateElementId(reserved)]));
      return {
        ...page,
        id: pageIds.get(page.id)!,
        nodes: page.nodes.map((node) => ({ ...node, id: nodeIds.get(node.id)!,
          ...(node.parentId ? { parentId: nodeIds.get(node.parentId)! } : {}) }))
      };
    }),
    interactions: document.interactions.map((interaction) => ({ ...interaction,
      fromPageId: pageIds.get(interaction.fromPageId)!, toPageId: pageIds.get(interaction.toPageId)! }))
  };
}
