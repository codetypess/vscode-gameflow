import { DialogHeading } from "../components/dialog-heading";
import { useEffect, useRef, useState } from "react";
import { Box, FolderOpen } from "lucide-react";
import type { GameFlowDocument } from "../../shared/model";
import type { CanvasSources } from "../../shared/canvas-references";
import { pageRootType } from "../../shared/ui-components";
import { postHostMessage, isBrowserPreview } from "../vscode-api";
import { Button } from "../components/ui/button";

export function CanvasReferencePicker({ document, sources, source, currentPageId, cellsOnly = false, replacedChildren = 0, onSource, onPick, onClear, onClose }: {
  document: GameFlowDocument; sources: CanvasSources; source: string; currentPageId?: string; cellsOnly?: boolean; replacedChildren?: number;
  onSource: (source: string) => void; onPick: (source: string, id: string) => void; onClear?: () => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const focus = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const trigger = window.document.activeElement;
    focus.current?.focus();
    return () => { if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  const entry = source ? sources[source] : { document, error: undefined };
  const title = cellsOnly ? "选择渲染项" : "引用画布组件";
  const pages = entry?.document?.pages.filter(page => !cellsOnly || page.rootType === "UIBox") ?? [];
  return <div className="canvas-reference-backdrop" onPointerDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="floating-panel workbench-dialog canvas-reference-picker" onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input, select"));
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <DialogHeading heading={title} closeLabel="关闭画布引用选择" onClose={onClose} />
      <div className="canvas-reference-picker-body">
        {replacedChildren > 0 && <p className="property-hint">选择渲染项会替换此列表中现有的 {replacedChildren} 个子节点，可通过撤销恢复。</p>}
        <label className="property-field"><span>来源</span><select aria-label="画布引用来源" value={source} onChange={event => { onSource(event.target.value); setQuery(""); }}><option value="">当前文件</option>{Object.keys(sources).map(key => <option value={key} key={key}>{key}</option>)}</select></label>
        <Button variant="outline" size="sm" onClick={() => postHostMessage({ type: "chooseCanvasSource" })}><FolderOpen size={14} />引用其他画布…</Button>
        {onClear && <Button variant="ghost" size="sm" onClick={onClear}>清除绑定</Button>}
        {isBrowserPreview ? <p className="property-hint">浏览器使用导入的文件快照；源文件修改后请重新导入。VS Code 中会自动同步。</p> : null}
        <input ref={focus} aria-label="搜索画布组件" placeholder="搜索画布名称" value={query} onChange={event => setQuery(event.target.value)} />
        {entry?.error ? <p className="layout-diagnostics" role="status">{entry.error}</p> : null}
        <div className="canvas-reference-options">{pages.filter(page => page.name.toLowerCase().includes(query.toLowerCase())).map(page => <button key={page.id} disabled={source === "" && page.id === currentPageId} onClick={() => onPick(source, page.id)}><Box size={17} /><span>{page.name}<small>{pageRootType(page)} · {page.id}{source === "" && page.id === currentPageId ? " · 当前画布" : ""}</small></span></button>)}</div>
        {!pages.length ? <p className="property-hint">没有可引用的画布。</p> : null}
      </div>
    </section>
  </div>;
}
