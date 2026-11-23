import { Fragment, type ReactNode } from "react";
import { Component } from "lucide-react";
import type { GameFlowPage } from "../../shared/model";
import type { Change, SyncNode } from "../../shared/page-sync";
import { pageRootType } from "../../shared/ui-components";
import { LayerRoot, LayerRow, NodeIcon } from "./layer-row";

export const changeSymbols = { add: "+", delete: "−", edit: "~" };

function SyncChangeMarker({ kind }: { kind?: Change["kind"] }) {
  return <b className="sync-change sync-change-slot" data-kind={kind} aria-hidden="true">
    {kind ? changeSymbols[kind] : null}
  </b>;
}

interface SyncTreeProps {
  page: GameFlowPage;
  nodes: Iterable<SyncNode>;
  changes: Change[];
  loading?: boolean;
  expanded: ReadonlySet<string>;
  selected: string;
  selectedComponent?: number | null;
  components?: ReadonlyMap<string, readonly { name: string }[]>;
  onToggle: (id: string) => void;
  onSelect: (id: string, component?: number) => void;
}

export function SyncTree({ page, nodes, changes, loading, expanded, selected, selectedComponent, components, onToggle, onSelect }: SyncTreeProps) {
  const allNodes=[...nodes],root=allNodes.find(node=>node.root);
  const children = new Map<string, SyncNode[]>();
  for (const node of allNodes) {
    if(node.root) continue;
    const siblings = children.get(node.parent);
    if (siblings) siblings.push(node);
    else children.set(node.parent, [node]);
  }
  const changeByNode = new Map<string, Change>();
  for (const change of changes) {
    for (const id of change.members) if (!changeByNode.has(id)) changeByNode.set(id, change);
  }
  const rootKind = changeByNode.get(root?.id ?? "")?.kind;

  function rows(parent: string, depth: number): ReactNode {
    return <>
      {children.get(parent)?.map(node => {
        const branch = children.has(node.id) || !!components?.get(node.id)?.length;
        const open = branch && expanded.has(node.id);
        const active = selected === node.id && selectedComponent == null;
        const kind = changeByNode.get(node.id)?.kind;
        return <Fragment key={node.id}>
          <LayerRow name={node.name} depth={depth} selected={active} expanded={branch ? open : undefined} onToggle={() => onToggle(node.id)}>
            <button type="button" className="layer-name" aria-pressed={active} title={node.name} onClick={() => onSelect(node.id)}>
              <NodeIcon type={node.type} />
              <span>{node.name}</span>
              <SyncChangeMarker kind={kind} />
              {node.variable && <code className="layer-variable" title={node.variable}>{node.variable}</code>}
            </button>
          </LayerRow>
          {open && <div role="group">{rows(node.id, depth + 1)}</div>}
        </Fragment>;
      })}
      {components?.get(parent)?.map((entry, index) => {
        const active = selected === parent && selectedComponent === index;
        return <LayerRow key={index} name={entry.name} depth={depth} selected={active}>
          <button type="button" className="layer-name" aria-pressed={active} title={entry.name} onClick={() => onSelect(parent, index)}>
            <Component size={14} /><span>{entry.name}</span><SyncChangeMarker /><small className="layer-variable">仅预制体</small>
          </button>
        </LayerRow>;
      })}
    </>;
  }

  return <nav aria-label="完整节点树">
    <div className="sync-tree-heading"><strong>节点树　{loading ? "…" : changes.length} 项差异</strong>
      <div className="sync-legend"><b data-kind="add">+ 新增</b><b data-kind="delete">− 删除</b><b data-kind="edit">~ 修改</b></div>
    </div>
    <LayerRoot name={page.name} rootType={pageRootType(page)} marker={<SyncChangeMarker kind={rootKind} />}
      className={selected===(root?.id??"") && selectedComponent == null ? "is-selected" : undefined}
      aria-expanded={expanded.has("")} onClick={() => { onToggle(""); onSelect(root?.id??""); }} />
    {expanded.has("") && <div role="tree" aria-label={page.name} className="layer-tree">{rows("", 0)}</div>}
  </nav>;
}
