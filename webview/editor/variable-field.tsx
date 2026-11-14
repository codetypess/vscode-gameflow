import { useEffect, useId, useState } from "react";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { nodeVariableNameError } from "../../shared/node-variable";
import { Input } from "../components/ui/input";

export function VariableField({ page, node, disabled, onCommit }: {
  page: GameFlowPage; node: GameFlowNode; disabled: boolean; onCommit: (value: string | undefined) => void;
}) {
  const value = node.variableName ?? "";
  const [draft, setDraft] = useState(value);
  const errorId = useId();
  useEffect(() => setDraft(value), [value]);
  const normalized = draft.trim();
  const error = nodeVariableNameError(page, node.id, normalized);
  const commit = () => {
    if (disabled || error) return;
    setDraft(normalized);
    if (normalized !== value) onCommit(normalized || undefined);
  };
  return <div className="variable-field">
    <label className="property-field"><span>变量</span><Input aria-label="变量" value={draft} placeholder="例如 bottomBar" autoComplete="off" spellCheck={false}
      disabled={disabled} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
      onChange={(event) => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDraft(value); }
      }} /></label>
    {error ? <p className="property-error" role="alert" id={errorId}>{error}</p> : null}
  </div>;
}
