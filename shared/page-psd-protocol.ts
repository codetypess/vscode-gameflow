import { isCanvasReferenceSource, isPagePsdBinding, type PagePsdBinding } from "./model";
import type { PsdDraft } from "./psd-draft";
export type ComponentPage = { canvas: string; documentId: string; pageId: string };
export type ComponentPsdCheck = ComponentPage & { binding: PagePsdBinding; hash: string };
export type ComponentPsdOutput = ComponentPage & { name: string; base64: string };
export type ComponentPsdBinding = ComponentPage & { binding: PagePsdBinding };
export type PagePsdRequest = { type: "pagePsd"; requestId: string; pageId: string; action: "choose" | "load" | "slice" | "review" | "generate" | "syncCopy"; reviewStamp?: string; sourceHash?: string; expected?: PagePsdBinding; name?: string; base64?: string; component?: ComponentPage; componentChecks?: ComponentPsdCheck[]; componentOutputs?: ComponentPsdOutput[] };
export type PagePsdResult = { type: "pagePsdResult"; requestId: string; sourceUri?: string; source?: string; name?: string; base64?: string; draft?: PsdDraft; cancelled?: boolean; error?: string; componentBindings?: ComponentPsdBinding[] };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 128;
const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const validPsdFilename = (value: unknown): value is string => typeof value === "string" &&
  /^[^\\/:*?"<>|\x00-\x1f]{1,156}\.psd$/i.test(value) && !value.includes("..") &&
  !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
export const validPsdBase64 = (value: unknown): value is string => typeof value === "string" &&
  value.length > 0 && value.length <= 44_739_244 && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
const componentPage = (value: unknown): value is ComponentPage & Record<string, unknown> =>
  record(value) && isCanvasReferenceSource(value.canvas) && id(value.documentId) && id(value.pageId);
export function validComponentPsdFields(request: Record<string, unknown>) {
  const { action, component, componentChecks, componentOutputs } = request;
  return (component === undefined || action === "review" && componentPage(component) && component.pageId === request.pageId) &&
    (componentChecks === undefined || (action === "generate" || action === "syncCopy") &&
      Array.isArray(componentChecks) && componentChecks.length <= 128 &&
      componentChecks.every(check => componentPage(check) && isPagePsdBinding(check.binding) && hash(check.hash))) &&
    (componentOutputs === undefined || action === "generate" && Array.isArray(componentOutputs) && componentOutputs.length <= 128 &&
      componentOutputs.every(item => componentPage(item) && validPsdFilename(item.name) && validPsdBase64(item.base64)) &&
      componentOutputs.reduce((total, item) => total + item.base64.length, 0) <= 44_739_244);
}
