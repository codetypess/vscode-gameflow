import { useEffect, useRef, useState } from "react";
import { atlasNameError, defaultAtlasName, normalizeAtlasName } from "../../shared/psd-naming";
import { Input } from "../components/ui/input";

export function AtlasNameInput({ name, value, disabled, onChange, onErrorChange }: {
  name: string; value?: string; disabled: boolean; onChange: (value?: string) => void; onErrorChange?: (error: string | null) => void;
}) {
  const [edit, setEdit] = useState<{ raw: string; canonical?: string } | null>(null);
  const composing = useRef(false);
  const error = atlasNameError(edit ? edit.canonical ?? defaultAtlasName(name) : value ?? defaultAtlasName(name));
  useEffect(() => { onErrorChange?.(error); return () => onErrorChange?.(null); }, [error, onErrorChange]);
  const update = (raw: string) => {
    const canonical = normalizeAtlasName(raw);
    setEdit({ raw, canonical });
    if (!composing.current && !atlasNameError(canonical ?? defaultAtlasName(name)) && canonical !== value) onChange(canonical);
  };
  return <Input aria-label="图集名" value={edit && (composing.current || !!error || edit.canonical === value) ? edit.raw : value ?? ""}
    placeholder={defaultAtlasName(name)} title="小写字母、数字和下划线，中文转拼音首字母；留空使用文件名" maxLength={120} disabled={disabled}
    aria-invalid={!!error} spellCheck={false} autoCapitalize="none" autoCorrect="off"
    onChange={e => update(e.currentTarget.value)} onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={e => { composing.current = false; update(e.currentTarget.value); }}
    onBlur={e => {
      composing.current = false;
      const canonical = normalizeAtlasName(e.currentTarget.value);
      if (atlasNameError(canonical ?? defaultAtlasName(name))) { setEdit({ raw: e.currentTarget.value, canonical }); return; }
      setEdit(null);
      if (canonical !== value) onChange(canonical);
    }}
    onKeyDown={e => { if (e.key === "Enter" && !composing.current && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.blur(); } }} />;
}
