import { useEffect, useRef, useState } from "react";
import { Input } from "../components/ui/input";

export function Field({ label, ariaLabel, value, onCommit, type = "text", min, max, integer = false, disabled = false, validate }: {
  label: string; value: string | number; onCommit: (value: string) => void;
  ariaLabel?: string;
  type?: string; min?: number; max?: number; integer?: boolean; disabled?: boolean; validate?: (value: string) => boolean;
}) {
  const displayed = integer ? String(Math.round(Number(value))) : String(value);
  const [draft, setDraft] = useState(displayed);
  const edited = useRef(false);
  useEffect(() => { setDraft(displayed); edited.current = false; }, [displayed]);
  const commit = () => {
    if (type === "number" && (draft.trim() === "" || !Number.isFinite(Number(draft)))) { setDraft(displayed); edited.current = false; return; }
    let next = draft;
    if (type === "number") next = String(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, integer ? Math.round(Number(draft)) : Number(draft))));
    if (validate && !validate(next)) { setDraft(displayed); edited.current = false; return; }
    const changed = (integer ? edited.current : true) && next !== String(value);
    edited.current = false;
    setDraft(next);
    if (changed) onCommit(next);
  };
  return <label className="property-field" title={ariaLabel}><span>{label}</span><Input aria-label={ariaLabel ?? label} type={type} value={draft} min={min} max={max} step={integer ? 1 : undefined} disabled={disabled}
    onChange={(event) => { edited.current = true; setDraft(event.target.value); }} onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(displayed); edited.current = false; event.stopPropagation(); } }} /></label>;
}

export function ColorField({ label, value, onCommit, disabled = false }: { label: string; value: string; onCommit: (value: string) => void; disabled?: boolean }) {
  return <div className="color-field"><Field label={label} value={value} disabled={disabled} validate={(next) => /^(#[0-9a-f]{6}|transparent)$/i.test(next)}
    onCommit={(next) => { if (/^(#[0-9a-f]{6}|transparent)$/i.test(next)) onCommit(next); }} />
    <input type="color" aria-label={`${label}取色器`} disabled={disabled} value={value === "transparent" ? "#ffffff" : value}
      onChange={(event) => onCommit(event.target.value)} />
  </div>;
}
