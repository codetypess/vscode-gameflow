import { useEffect, useRef, useState } from "react";
import { Input } from "../components/ui/input";
import { Slider } from "../components/ui/slider";
import { ColorEditSession } from "../lib/color-edit";
import { useOverrideAttributes } from "./override-properties";

export function Field({ label, ariaLabel, value, onCommit, type = "text", min, max, integer = false, precision, step, disabled = false, readOnly = false, validate }: {
  label: string; value: string | number; onCommit: (value: string) => void;
  ariaLabel?: string;
  type?: string; min?: number; max?: number; integer?: boolean; precision?: number; step?: number; disabled?: boolean; readOnly?: boolean; validate?: (value: string) => boolean;
}) {
  const override = useOverrideAttributes(ariaLabel ?? label);
  const displayed = integer ? String(Math.round(Number(value))) : precision !== undefined ? String(Number(Number(value).toFixed(precision))) : String(value);
  const [draft, setDraft] = useState(displayed);
  const edited = useRef(false);
  useEffect(() => { setDraft(displayed); edited.current = false; }, [displayed]);
  const commit = () => {
    if (readOnly) return;
    if (type === "number" && (draft.trim() === "" || !Number.isFinite(Number(draft)))) { setDraft(displayed); edited.current = false; return; }
    let next = draft;
    if (type === "number") next = String(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, integer ? Math.round(Number(draft)) : precision !== undefined ? Number(Number(draft).toFixed(precision)) : Number(draft))));
    if (validate && !validate(next)) { setDraft(displayed); edited.current = false; return; }
    const changed = (integer || precision !== undefined ? edited.current : true) && next !== String(value);
    edited.current = false;
    setDraft(precision !== undefined ? String(Number(Number(next).toFixed(precision))) : next);
    if (changed) onCommit(next);
  };
  return <label className="property-field" {...override}><span>{label}</span><Input aria-label={ariaLabel ?? label} type={type} value={draft} min={min} max={max} step={integer ? 1 : step ?? (precision !== undefined ? 10 ** -precision : undefined)} disabled={disabled} readOnly={readOnly}
    onFocus={(event) => { if (type === "number") event.currentTarget.select(); }}
    onChange={(event) => { edited.current = true; setDraft(event.target.value); }} onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(displayed); edited.current = false; event.stopPropagation(); } }} /></label>;
}

export interface NumericProperty {
  axis: string; ariaLabel: string; value: number; onCommit: (value: number) => void;
  disabled?: boolean; readOnly?: boolean; min?: number; max?: number;
}

/** Shared compact vector/scalar row with the same draft, commit and cancellation rules as Field. */
export function NumericPropertyRow({ label, fields, disabled, integer, precision }: {
  label: string; fields: readonly NumericProperty[]; disabled?: boolean; integer?: boolean; precision?: number;
}) {
  const override = useOverrideAttributes(label);
  return <div className="numeric-property-row" {...override} role="group" aria-label={label}><span>{label}</span>
    <div className="numeric-property-values" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))` }}>
      {fields.map(field => <Field key={field.ariaLabel} label={field.axis} ariaLabel={field.ariaLabel} type="number" value={field.value} integer={integer} precision={precision} min={field.min} max={field.max} disabled={disabled || field.disabled} readOnly={field.readOnly} onCommit={value => field.onCommit(Number(value))} />)}
    </div>
  </div>;
}

export function SliderPropertyRow({ label, value, onCommit, min = 0, max = 1, step = 0.01, precision = 2, disabled = false }: {
  label: string; value: number; onCommit: (value: number) => void;
  min?: number; max?: number; step?: number; precision?: number; disabled?: boolean;
}) {
  const override = useOverrideAttributes(label);
  return <div className="slider-property-row" {...override} role="group" aria-label={label}><span>{label}</span>
    <Slider aria-label={`${label}滑块`} value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([next]) => onCommit(next)} />
    <Field label="" ariaLabel={label} type="number" value={value} min={min} max={max} step={step} precision={precision} disabled={disabled} onCommit={next => onCommit(Number(next))} />
  </div>;
}

export function ReadOnlyPropertyRow({ label, fields }: {
  label: string; fields: readonly { axis: string; ariaLabel: string; value: string }[];
}) {
  return <div className="numeric-property-row size-source" role="group" aria-label={label}><span>{label}</span>
    <div className="numeric-property-values" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))` }}>
      {fields.map(field => <label className="property-field" key={field.ariaLabel} title={`${field.ariaLabel}：${field.value}`}><span>{field.axis}</span><Input aria-label={field.ariaLabel} value={field.value} readOnly /></label>)}
    </div>
  </div>;
}

export function ColorField({ label, value, onCommit, onPreview, disabled = false }: {
  label: string; value: string; onCommit: (value: string) => void; onPreview: (value: string | null) => void; disabled?: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const session = useRef(new ColorEditSession());
  const [draft, setDraft] = useState<string | null>(null);
  const finish = () => {
    if (!session.current.active) return;
    const next = disabled ? (session.current.cancel(), null) : session.current.finish(value);
    setDraft(null); onPreview(null);
    if (next !== null) onCommit(next);
  };
  const latest = useRef(finish); latest.current = finish;
  useEffect(() => {
    const element = picker.current!;
    const change = () => latest.current();
    // React's value tracking can suppress the final change after the input previews.
    element.addEventListener("change", change);
    return () => { element.removeEventListener("change", change); latest.current(); };
  }, []);
  useEffect(() => {
    if (!session.current.active) return;
    session.current.cancel(); setDraft(null); onPreview(null);
  }, [value, disabled]);
  const displayed = draft ?? value;
  return <div className="color-field"><Field label={label} value={displayed} disabled={disabled} validate={(next) => /^(#[0-9a-f]{6}|transparent)$/i.test(next)}
    onCommit={(next) => { if (/^(#[0-9a-f]{6}|transparent)$/i.test(next)) onCommit(next); }} />
    <input ref={picker} type="color" aria-label={`${label}取色器`} disabled={disabled} value={displayed === "transparent" ? "#ffffff" : displayed}
      onPointerDown={() => session.current.begin(value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") session.current.begin(value); }}
      onInput={(event) => { const next = event.currentTarget.value; session.current.update(next, value); setDraft(next); onPreview(next); }}
      onChange={() => { /* Native change above ends the edit; input only previews. */ }} onBlur={finish} />
  </div>;
}
