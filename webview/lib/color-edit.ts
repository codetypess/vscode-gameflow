import type { GameFlowPage } from "../../shared/model";
import { inheritedFlag } from "../../shared/editor-ops";

/** A native picker produces many input events but only one completed color edit. */
export class ColorEditSession {
  private initial: string | null = null;
  private draft = "";
  get active() { return this.initial !== null; }
  begin(value: string) { if (!this.active) { this.initial = value; this.draft = value; } }
  update(value: string, initial: string) { this.begin(initial); this.draft = value; }
  finish(current = this.initial): string | null {
    const changed = this.active && current?.toLowerCase() === this.initial!.toLowerCase() && this.draft.toLowerCase() !== this.initial!.toLowerCase();
    const value = changed ? this.draft : null;
    this.cancel(); return value;
  }
  cancel() { this.initial = null; this.draft = ""; }
}

export interface ColorPreview {
  pageId: string;
  nodeId?: string;
  property: "fill" | "borderColor" | "color" | "background";
  value: string;
}

/** Transient view data never enters document messages or the history stack. */
export function applyColorPreview(page: GameFlowPage, preview: ColorPreview | null): GameFlowPage {
  if (!preview || preview.pageId !== page.id) return page;
  if (preview.property === "background") return { ...page, background: preview.value };
  const node = page.nodes.find(node => node.id === preview.nodeId);
  if (!node || inheritedFlag(page, node, "locked")) return page;
  return { ...page, nodes: page.nodes.map(item => item.id === node.id ? { ...item, style: { ...item.style, [preview.property]: preview.value } } : item) };
}
