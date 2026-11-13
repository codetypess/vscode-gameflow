import { useEffect, useState } from "react";
import { Input } from "../components/ui/input";

export function Field({ label, value, onCommit, type = "text", min, max, disabled = false, validate }: {
  label: string; value: string | number; onCommit: (value: string) => void;
  type?: string; min?: number; max?: number; disabled?: boolean; validate?: (value: string) => boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (type === "number" && (draft.trim() === "" || !Number.isFinite(Number(draft)))) { setDraft(String(value)); return; }
    let next = draft;
    if (type === "number") next = String(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Number(draft))));
    if (validate && !validate(next)) { setDraft(String(value)); return; }
    setDraft(next);
    if (next !== String(value)) onCommit(next);
  };
  return <label className="property-field"><span>{label}</span><Input aria-label={label} type={type} value={draft} min={min} max={max} disabled={disabled}
    onChange={(event) => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(String(value)); event.stopPropagation(); } }} /></label>;
}

export function ColorField({ label, value, onCommit, disabled = false }: { label: string; value: string; onCommit: (value: string) => void; disabled?: boolean }) {
  return <div className="color-field"><Field label={label} value={value} disabled={disabled} validate={(next) => /^(#[0-9a-f]{6}|transparent)$/i.test(next)}
    onCommit={(next) => { if (/^(#[0-9a-f]{6}|transparent)$/i.test(next)) onCommit(next); }} />
    <input type="color" aria-label={`${label}取色器`} disabled={disabled} value={value === "transparent" ? "#ffffff" : value}
      onChange={(event) => onCommit(event.target.value)} />
  </div>;
}
