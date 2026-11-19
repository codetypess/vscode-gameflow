import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Images, X } from "lucide-react";
import type { GameFlowNode } from "../../shared/model";
import { BUILTIN_CATEGORIES, BUILTIN_IMAGES, builtinImage, type ImageSlot, type ImageSlotField } from "../../shared/image-slots";
import { Button } from "../components/ui/button";
import { useOverrideAttributes } from "./override-properties";
import { SliceBindingField } from "../runtime/binding-field";

export function ImageSlotField({ node, field, label, disabled, onChange, onPsd }: { node: GameFlowNode; field: ImageSlotField; label: string; disabled: boolean; onChange(slot: ImageSlot | null): void; onPsd(): void }) {
  const override = useOverrideAttributes(label, [field]);
  const slot = node[field], image = slot?.builtin ? builtinImage(slot.builtin) : undefined;
  const [open, setOpen] = useState(false), [artOpen, setArtOpen] = useState(false);
  return <section {...override} className="image-slot-field" data-image-slot={field}>
    <div className="property-section-title">{label}</div>
    <div className="image-slot-row"><button className="image-slot-value" type="button" disabled={disabled} aria-label={"选择" + label} onClick={() => setOpen(true)}>
      {image ? <img src={image.dataUri} alt="" /> : <Images size={22} />}<span>{image?.name ?? "未设置图片"}</span>
    </button><Button size="icon" variant="ghost" disabled={disabled || !slot} aria-label={"清空" + label} onClick={() => onChange(null)}><X size={14} /></Button></div>
    <button className="image-slot-art-toggle" type="button" aria-expanded={artOpen} onClick={() => setArtOpen(!artOpen)}>{slot?.art ? "已绑定美术：" + slot.art.path : "美术 PSD 绑定"}</button>
    {artOpen ? <SliceBindingField overrideField={field} node={{ ...node, type: "image", sliceResource: slot?.art }} disabled={disabled} onPsd={onPsd} onChange={art => onChange(art || slot?.builtin ? { ...(slot?.builtin ? { builtin: slot.builtin } : {}), ...(art ? { art } : {}) } : null)} /> : null}
    {open && !disabled ? <ImagePicker initial={image?.category} onClose={() => setOpen(false)} onSelect={builtin => { onChange({ ...slot, builtin }); setOpen(false); }} /> : null}
  </section>;
}
function ImagePicker({ initial, onSelect, onClose }: { initial?: string; onSelect(id: string): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState(initial ?? "按钮"), [query, setQuery] = useState("");
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  const images = BUILTIN_IMAGES.filter(image => image.category === category && (!query || (image.name + image.id).toLowerCase().includes(query.toLowerCase())));
  return createPortal(<dialog ref={dialog} className="builtin-image-picker" aria-label="内置图片资源" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <header><strong>内置图片资源</strong><Button size="icon" variant="ghost" aria-label="关闭图片资源" onClick={onClose}><X size={17} /></Button></header>
    <nav aria-label="图片分类">{BUILTIN_CATEGORIES.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</nav>
    <input className="builtin-image-search" aria-label="搜索内置图片" placeholder="搜索图片…" value={query} onChange={event => setQuery(event.target.value)} />
    <div className="builtin-image-grid">{images.map(image => <button type="button" key={image.id} title={image.name + (image.nineGrid ? " · 九宫格" : "")} onClick={() => onSelect(image.id)}><span><img src={image.dataUri} alt="" /></span><small>{image.name}</small></button>)}{!images.length ? <p>没有匹配的图片</p> : null}</div>
  </dialog>, document.body);
}
