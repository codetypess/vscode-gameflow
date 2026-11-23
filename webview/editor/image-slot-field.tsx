import { DialogHeading } from "../components/dialog-heading";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SquareMousePointer, X } from "lucide-react";
import type { GameFlowNode } from "../../shared/model";
import { BUILTIN_CATEGORIES, BUILTIN_IMAGES, builtinImage, type ImageSlot, type ImageSlotField } from "../../shared/image-slots";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useOverrideAttributes } from "./override-properties";
import { useSliceResources } from "../runtime/resource-context";
import { PSD_SLOT_MARKERS } from "../../shared/psd-slot-markers";

export function ImageSlotField({ node, field, label, disabled, onChange }: { node: GameFlowNode; field: ImageSlotField; label: string; disabled: boolean; onChange(slot: ImageSlot | null): void }) {
  const override = useOverrideAttributes(label, [field]);
  const { mode } = useSliceResources();
  const slot = node[field] ?? (field === "image" && node.image === undefined && node.sliceResource ? { art: node.sliceResource } : null), image = slot?.builtin ? builtinImage(slot.builtin) : undefined;
  const [open, setOpen] = useState(false);
  if (mode === "art" || mode === "prefab") {
    const path = slot?.art?.path;
    const name = path?.split("/").pop()?.replace(/\.png$/, "");
    return <section className="image-slot-field" data-image-slot={field}>
      <label className="property-field"><span>{label}</span><input readOnly value={name ?? (slot?.builtin ? "未匹配 PSD 切图" : "无 (Image)")} title={path ?? `${node.name}/${PSD_SLOT_MARKERS[field]}`} /></label>
    </section>;
  }
  return <section {...override} className="image-slot-field" data-image-slot={field}>
    <div className="property-field image-slot-row"><span>{label}</span><div className="image-slot-control" data-disabled={disabled || undefined} data-filled={!!slot?.builtin || undefined}>
      <button className="image-slot-value" type="button" disabled={disabled} aria-label={"选择" + label} title={image?.name ?? "无 (Image)"} onClick={() => setOpen(true)}>
        {image ? <img src={image.dataUri} alt="" /> : null}<span>{image?.name ?? "无 (Image)"}</span><SquareMousePointer className="image-slot-browse" size={14} aria-hidden="true" />
      </button>
      <button className="image-slot-clear" type="button" disabled={disabled || !slot?.builtin} aria-label={"清空" + label} title={"清空" + label} onClick={() => onChange(slot?.art ? { art: slot.art } : null)}><X size={12} /></button>
    </div></div>
    {open && !disabled ? <ImagePicker initial={image?.category} onClose={() => setOpen(false)} onSelect={builtin => { onChange({ ...slot, builtin }); setOpen(false); }} /> : null}
  </section>;
}
function ImagePicker({ initial, onSelect, onClose }: { initial?: string; onSelect(id: string): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState(initial ?? "按钮"), [query, setQuery] = useState("");
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  const images = BUILTIN_IMAGES.filter(image => image.category === category && (!query || (image.name + image.id).toLowerCase().includes(query.toLowerCase())));
  return createPortal(<dialog ref={dialog} className="floating-panel workbench-dialog psd-dialog builtin-image-picker" aria-label="内置图片资源" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <DialogHeading heading="内置图片资源" closeLabel="关闭图片资源" onClose={onClose} />
    <div className="builtin-image-picker-body">
      <nav aria-label="图片分类">{BUILTIN_CATEGORIES.map(item => <Button type="button" variant="ghost" size="sm" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}</nav>
      <Input className="builtin-image-search" aria-label="搜索内置图片" placeholder="搜索图片…" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="builtin-image-grid">{images.map(image => <button type="button" key={image.id} title={image.name + (image.nineGrid ? " · 九宫格" : "")} onClick={() => onSelect(image.id)}><span className="checkerboard"><img src={image.dataUri} alt="" /></span><small>{image.name}</small></button>)}{!images.length ? <p className="builtin-image-empty" role="status">没有匹配的图片</p> : null}</div>
    </div>
  </dialog>, document.body);
}
