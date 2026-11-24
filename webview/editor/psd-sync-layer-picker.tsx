import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileImage, Folder } from "lucide-react";
import type { Comparison } from "../../shared/page-sync";
import type { PsdLayer } from "../../shared/psd-meta";
import { prototypeLayerRef } from "../../shared/psd-prototype";
import { psdSlotField } from "../../shared/psd-slot-markers";
import { COMPONENTS } from "../../shared/ui-components";

interface LayerOption {
  layer: PsdLayer;
  path: string;
  selectable: boolean;
  children: LayerOption[];
}

function pairingTree(layers: PsdLayer[], comparison: Comparison, documentId: string, pageId: string) {
  const layersByParent = new Map<number | null, PsdLayer[]>();
  for (const layer of layers) {
    const siblings = layersByParent.get(layer.parentKey);
    if (siblings) siblings.push(layer);
    else layersByParent.set(layer.parentKey, [layer]);
  }
  const matched = new Map(comparison.psd.map(node => [node.layer, node]));
  const prototypeIds = new Set(comparison.proto.map(node => node.id));

  function branch(parent: number | null, ancestors: string[]): LayerOption[] {
    return (layersByParent.get(parent) ?? []).flatMap(layer => {
      if (psdSlotField(layer.name)) return [];
      const ref = prototypeLayerRef(layer.metadata.prototype) ? layer.metadata.prototype : undefined;
      if (ref && (ref.documentId !== documentId || ref.pageId !== pageId || ref.slot && ref.slot !== "image")) return [];
      const pageGroup = ref?.nodeId === pageId && layer.group;
      const target = matched.get(layer.metadata.layerId);
      const selectable = !pageGroup && (!target || !prototypeIds.has(target.id));
      const path = [...ancestors, layer.name];
      const children = layer.group && (pageGroup || target && COMPONENTS[target.type].children) ? branch(layer.key, path) : [];
      return selectable || children.length ? [{ layer, path: path.join(" / "), selectable, children }] : [];
    });
  }
  return branch(null, []);
}

export function PsdSyncLayerPicker({ layers, comparison, documentId, pageId, disabled, onConfirm }: {
  layers: PsdLayer[];
  comparison: Comparison;
  documentId: string;
  pageId: string;
  disabled: boolean;
  onConfirm: (layerId: string) => void;
}) {
  const tree = useMemo(() => pairingTree(layers, comparison, documentId, pageId), [layers, comparison, documentId, pageId]);
  const pickerId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, select] = useState<LayerOption>();
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  function close() {
    setOpen(false);
    select(undefined);
    trigger.current?.focus();
  }

  function renderBranch(options: LayerOption[]) {
    return <ul>{options.map(option => {
      const { layer, children, selectable, path } = option;
      const expanded = children.length > 0 && !collapsed.has(layer.key);
      const Icon = layer.group ? Folder : FileImage;
      return <li key={layer.key}>
        <div className="psd-sync-layer-row">
          {children.length > 0 ? <button type="button" className="psd-sync-layer-toggle" aria-expanded={expanded} aria-label={(expanded ? "折叠 " : "展开 ") + path}
            onClick={() => setCollapsed(current => {
              const next = new Set(current);
              if (next.has(layer.key)) next.delete(layer.key);
              else next.add(layer.key);
              return next;
            })}>{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button> : <span className="psd-sync-layer-toggle" />}
          {selectable ?
            <button type="button" className="psd-sync-layer-name" aria-pressed={selected?.layer.key === layer.key} aria-label={path} title={path} onClick={() => select(option)}>
              <Icon size={14} aria-hidden="true" /><span>{layer.name}</span>
            </button> :
            <span className="psd-sync-layer-name" title={path}><Icon size={14} aria-hidden="true" /><span>{layer.name}</span></span>}
        </div>
        {expanded && renderBranch(children)}
      </li>;
    })}</ul>;
  }

  return <fieldset disabled={disabled} className="psd-sync-layer-picker">
    <legend>对应已有 PSD 图层</legend>
    <button type="button" ref={trigger} aria-expanded={open} aria-controls={pickerId}
      onClick={() => open ? close() : setOpen(true)}>选择图层</button>
    <div id={pickerId} hidden={!open}>
      {tree.length ? <div className="psd-sync-layer-options" role="group" aria-label="可关联的 PSD 图层">{renderBranch(tree)}</div> :
        <p>没有可关联的图层</p>}
      {selected && <p className="psd-sync-layer-path" aria-live="polite">{selected.path}</p>}
      <button type="button" disabled={!selected} onClick={() => {
        if (selected) onConfirm(selected.layer.metadata.layerId);
        close();
      }}>确认关联</button>
      <button type="button" onClick={close}>取消</button>
    </div>
  </fieldset>;
}
