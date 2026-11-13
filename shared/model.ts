import { allocateElementId, reserveDocumentElementIds } from "./element-id";
import { canHaveChildren, COMPONENT_TYPES, PAGE_ROOT_TYPES } from "./ui-components";
import { validateUIConfig } from "./ui-config";
import type { NodeLayout, WidgetProps } from "./ui-config";
export type { NodeLayout, WidgetProps } from "./ui-config";

export const GAMEFLOW_SCHEMA_VERSION = 2 as const;

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
  | "input" | "hbox" | "vbox" | "grid" | "panel" | "checkbox" | "radio" | "progress" | "slider" | "combo";

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
  type: NodeType;
  frame: Frame;
  parentId?: string;
  text?: string;
  style?: NodeStyle;
  imageData?: string;
  hidden?: boolean;
  locked?: boolean;
  layout?: NodeLayout;
  widget?: WidgetProps;
}

export interface NodeStyle {
  fill?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
}

export interface GameFlowPage {
  id: string;
  name: string;
  kind: PageKind;
  rootType?: PageRootType;
  frame: Frame;
  nodes: GameFlowNode[];
  background?: string;
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
  schemaVersion: 1 | typeof GAMEFLOW_SCHEMA_VERSION;
  documentId: string;
  title: string;
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
  errors: string[]
): value is GameFlowNode {
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
  if (value.parentId !== undefined) {
    optionalValid = validateString(value.parentId, `${path}.parentId`, errors) && optionalValid;
  }
  if (value.text !== undefined && typeof value.text !== "string") {
    errors.push(`${path}.text must be a string when provided`);
    optionalValid = false;
  }
  for (const key of ["hidden", "locked"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      errors.push(`${path}.${key} must be a boolean`);
      optionalValid = false;
    }
  }
  if (value.imageData !== undefined && !isImageData(value.imageData)) {
    errors.push(`${path}.imageData must be a raster image data URI under 5 MB`);
    optionalValid = false;
  }
  if (value.style !== undefined) {
    if (!isRecord(value.style)) {
      errors.push(`${path}.style must be an object`);
      optionalValid = false;
    } else {
      const style = value.style;
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
  return idValid && nameValid && typeValid && frameValid && optionalValid && configValid;
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
  const frameValid = validateFrame(value.frame, `${path}.frame`, errors);
  const backgroundValid = value.background === undefined || isColor(value.background);
  if (!backgroundValid) errors.push(`${path}.background must be a hex color or transparent`);
  const nodes = value.nodes;
  let nodesValid = true;
  if (!Array.isArray(nodes)) {
    errors.push(`${path}.nodes must be an array`);
    nodesValid = false;
  } else {
    nodes.forEach((node, index) => {
      nodesValid = validateNode(node, `${path}.nodes[${index}]`, errors) && nodesValid;
    });
  }
  return idValid && nameValid && kindValid && rootTypeValid && frameValid && nodesValid && backgroundValid;
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
    page.nodes.forEach((node, nodeIndex) => {
      check(node.id, `pages[${pageIndex}].nodes[${nodeIndex}].id`);
    });
  });
}

export function validateGameFlowDocument(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["document must be an object"] };
  }

  if (value.schemaVersion !== 1 && value.schemaVersion !== GAMEFLOW_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be 1 or ${GAMEFLOW_SCHEMA_VERSION}`);
  }
  validateString(value.documentId, "documentId", errors);
  validateString(value.title, "title", errors);

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
      if (value.schemaVersion === 1 && page.rootType !== undefined) {
        errors.push(`page ${page.id} rootType requires schemaVersion 2`);
      }
      const nodeIds = new Set(page.nodes.map((node) => node.id));
      for (const node of page.nodes) {
        if (value.schemaVersion === 1 && (node.layout || node.widget || !["container", "rectangle", "text", "button", "image", "list", "input"].includes(node.type))) {
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
          if (!canHaveChildren(parent)) {
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
            text: "背包",
            frame: { x: 24, y: 112, width: 92, height: 40 }
          }
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
            text: "使用",
            frame: { x: 168, y: 132, width: 80, height: 36 }
          }
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
