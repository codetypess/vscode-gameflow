import { findCanvasTarget, type CanvasSources } from "./canvas-references";
import type { GameFlowDocument, GameFlowPage } from "./model";

/** Supplying the source registry also checks the prototype's referenced boards. */
export function prefabExportNameIssue(document: GameFlowDocument, page: GameFlowPage, sources?: CanvasSources): string | undefined {
  const missing: string[] = [];
  const visited = new Set<GameFlowPage>();
  function visit(board: GameFlowPage, source: string) {
    if (visited.has(board)) return;
    visited.add(board);
    if (!board.exportName?.trim()) {
      const owner = source ? sources?.[source]?.document : document;
      const duplicate = owner?.pages.some(other => other.id !== board.id && other.name === board.name);
      const location = [source, duplicate ? board.id : ""].filter(Boolean).join(" · ");
      missing.push(`「${board.name}」${location ? `（${location}）` : ""}`);
    }
    if (!sources) return;
    for (const node of board.nodes) {
      for (const ref of [node.prefab, node.cellPrefab]) {
        if (!ref || !("source" in ref)) continue;
        const target = findCanvasTarget(document, sources, ref, source);
        if (target.page) visit(target.page, target.key);
      }
    }
  }
  visit(page, "");
  if (missing.length) return `原型${missing.join("、")}未设置导出名称。请在页面属性中填写后再导出预制体。`;
}
