import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Box, Check, ChevronDown, ChevronRight, SquareMousePointer, Search, X } from "lucide-react";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { COMPONENTS, pageRootType } from "../../shared/ui-components";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { nodeReferencePath, nodeReferenceRows, referenceUnavailableReason, type NodeReferenceKind } from "../lib/node-reference";
import { NodeIcon } from "./layer-tree";

interface ReferenceProps {
  page: GameFlowPage; owner: GameFlowNode; kind: NodeReferenceKind;
  label: string; value: string | null; disabled: boolean;
  onChange: (id: string | null) => void;
}

export function NodeReferenceField(props: ReferenceProps) {
  const { page, owner, kind, label, value, disabled, onChange } = props;
  const [open, setOpen] = useState(false);
  const target = page.nodes.find(node => node.id === value);
  const clearReason = referenceUnavailableReason(page, owner, kind, value, null);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div className="node-reference-field" onKeyDown={event => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    event.preventDefault(); event.stopPropagation();
    if (!disabled && value && !clearReason) onChange(null);
  }}>
    <button type="button" className="node-reference-value" aria-label={label} disabled={disabled}
      title={`${target ? nodeReferencePath(page, target.id) : "未绑定"}\n双击或按 Enter 选择；Delete / Backspace 清空${clearReason ? `\n${clearReason}` : ""}`}
      onDoubleClick={() => setOpen(true)} onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setOpen(true); }
      }}>
      {target ? <NodeIcon type={target.type} /> : <Box size={13} />}<span>{target?.name ?? "未绑定"}</span>
    </button>
    <button type="button" className="node-reference-pick" aria-label={`选择${label}`} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} title="打开节点树选择" onClick={() => setOpen(true)}><SquareMousePointer size={15} /></button>
    {open ? <NodeReferenceDialog {...props} onClose={() => setOpen(false)} /> : null}
  </div>;
}

function NodeReferenceDialog({ page, owner, kind, label, value, disabled, onChange, onClose }: ReferenceProps & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), tree = useRef<HTMLDivElement>(null);
  const titleId = useId(), contextId = useId();
  const [draftId, setDraftId] = useState(value);
  const [focusedId, setFocusedId] = useState<string | null>(value);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchCollapsed, setSearchCollapsed] = useState<Set<string>>(new Set());
  const filtering = !!query.trim(), activeCollapsed = filtering ? searchCollapsed : collapsed;
  const setActiveCollapsed = filtering ? setSearchCollapsed : setCollapsed;
  const rows = nodeReferenceRows(page, query, activeCollapsed);
  const unavailable = (id: string | null) => referenceUnavailableReason(page, owner, kind, value, id);
  const draft = page.nodes.find(node => node.id === draftId), focused = page.nodes.find(node => node.id === focusedId);
  const reason = unavailable(draftId);
  useEffect(() => {
    const element = dialog.current!, previous = document.activeElement as HTMLElement | null;
    element.showModal();
    tree.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const toggle = (id: string) => setActiveCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const focusRow = (id: string | null) => {
    setFocusedId(id);
    tree.current?.querySelector<HTMLElement>(`[data-reference-id="${CSS.escape(id ?? "")}"]`)?.focus();
  };
  const choose = (id: string | null) => { if (!unavailable(id)) setDraftId(id); };
  const commit = (id: string | null) => {
    if (disabled || unavailable(id)) return;
    if (id !== value) onChange(id);
    onClose();
  };
  const treeKey = (event: KeyboardEvent, id: string | null) => {
    const index = rows.findIndex(row => row.node.id === id), row = rows[index];
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowDown") focusRow(rows[Math.min(index + 1, rows.length - 1)]?.node.id ?? null);
    else if (event.key === "ArrowUp") focusRow(index > 0 ? rows[index - 1].node.id : null);
    else if (event.key === "Home") focusRow(null);
    else if (event.key === "End") focusRow(rows.at(-1)?.node.id ?? null);
    else if (event.key === "ArrowRight" && row?.hasChildren) { if (!row.expanded) toggle(row.node.id); else focusRow(rows[index + 1]?.node.id ?? id); }
    else if (event.key === "ArrowLeft" && row) { if (row.expanded) toggle(row.node.id); else focusRow(row.node.parentId ?? null); }
    else if (event.key === " ") choose(id);
    else if (event.key === "Enter") commit(id);
  };
  return createPortal(<dialog ref={dialog} className="node-picker" aria-labelledby={titleId} aria-describedby={contextId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const index = targets.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length]?.focus();
      }
    }} onKeyUp={event => event.stopPropagation()}>
    <div className="node-picker-content">
      <header className="node-picker-heading"><h2 id={titleId}>选择节点</h2><Button variant="ghost" size="icon" aria-label="关闭节点选择" onClick={onClose}><X size={16} /></Button></header>
      <div className="node-picker-context" id={contextId}><span>正在为 <strong>{owner.name}</strong> 的 <strong>{label}</strong> 选择</span><small title={nodeReferencePath(page, owner.id)}>{nodeReferencePath(page, owner.id)} · {COMPONENTS[owner.type].laya}</small></div>
      <div className="node-picker-search"><Search size={15} /><input autoFocus type="search" aria-label="搜索可绑定节点" placeholder="搜索名称、变量、类型或 ID" value={query}
        onChange={event => { setQuery(event.target.value); setSearchCollapsed(new Set()); setFocusedId(null); }} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); focusRow(rows[0]?.node.id ?? null); } }} />
        {query ? <button type="button" aria-label="清除节点搜索" onClick={() => { setQuery(""); setSearchCollapsed(new Set()); }}><X size={14} /></button> : null}
      </div>
      <div className="node-picker-page"><Box size={14} /><strong>{page.name}</strong><small>{pageRootType(page)}</small></div>
      <div ref={tree} className="node-picker-tree" role="tree" aria-label="可绑定节点树">
        <div role="treeitem" aria-level={1} aria-posinset={1} aria-setsize={rows.filter(row => row.depth === 0).length + 1} aria-selected={draftId === null} aria-disabled={!!unavailable(null)} data-reference-id="" tabIndex={focusedId === null ? 0 : -1}
          className={cn("node-picker-row", draftId === null && "is-selected")} onFocus={() => setFocusedId(null)} onClick={() => { focusRow(null); choose(null); }} onDoubleClick={() => commit(null)} onKeyDown={event => treeKey(event, null)}>
          <span className="node-picker-expander" /><X size={14} /><span className="node-picker-name">不绑定</span>{value === null ? <span className="node-picker-badge">当前绑定</span> : null}{draftId === null ? <Check size={14} /> : null}
        </div>
        {rows.map(row => {
          const { node, depth, hasChildren, expanded } = row, invalid = unavailable(node.id);
          return <div key={node.id} role="treeitem" aria-level={depth + 1} aria-posinset={row.position + (depth === 0 ? 1 : 0)} aria-setsize={row.size + (depth === 0 ? 1 : 0)} aria-expanded={hasChildren ? expanded : undefined} aria-selected={draftId === node.id} aria-disabled={!!invalid}
            data-reference-id={node.id} tabIndex={focusedId === node.id ? 0 : -1} className={cn("node-picker-row", draftId === node.id && "is-selected")}
            style={{ paddingLeft: 8 + depth * 18 }} title={`${nodeReferencePath(page, node.id)}\n${node.id}${invalid ? `\n${invalid}` : ""}`}
            onFocus={() => setFocusedId(node.id)} onClick={() => { focusRow(node.id); choose(node.id); }} onDoubleClick={() => commit(node.id)} onKeyDown={event => treeKey(event, node.id)}>
            {hasChildren ? <button type="button" tabIndex={-1} aria-disabled={false} className="node-picker-expander" aria-label={`${expanded ? "折叠" : "展开"}${node.name}`} onClick={event => { event.stopPropagation(); toggle(node.id); }} onDoubleClick={event => event.stopPropagation()}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button> : <span className="node-picker-expander" />}
            <NodeIcon type={node.type} /><span className="node-picker-name">{node.name}</span>
            {node.id === owner.id ? <span className="node-picker-badge is-owner">正在设置</span> : null}{node.id === value ? <span className="node-picker-badge">当前绑定</span> : null}{draftId === node.id ? <Check size={14} /> : null}
            <small className="node-picker-type">{COMPONENTS[node.type].laya}</small>
          </div>;
        })}
        {filtering && !rows.length ? <p className="node-picker-empty" role="status">没有匹配的节点</p> : null}
      </div>
      <div className="node-picker-selection" aria-live="polite"><span>待选择：<strong>{draft?.name ?? (draftId ? "节点已不存在" : "不绑定")}</strong></span>
        {draft ? <><small>{nodeReferencePath(page, draft.id)}</small><code>{draft.id} · {COMPONENTS[draft.type].laya}</code></> : null}
        {focused && unavailable(focused.id) ? <p>{focused.name}：{unavailable(focused.id)}</p> : reason ? <p>{reason}</p> : <p>{kind === "skin" ? "选择控件的直接子节点；灰色节点不可绑定。" : "选择同页的单选框；已用于其他选项的节点不可绑定。"}</p>}
      </div>
      <footer className="node-picker-footer"><span>双击或 Enter 确认 · Esc 取消</span><Button variant="ghost" size="sm" onClick={onClose}>取消</Button><Button size="sm" disabled={disabled || !!reason} onClick={() => commit(draftId)}>确认选择</Button></footer>
    </div>
  </dialog>, document.body);
}
