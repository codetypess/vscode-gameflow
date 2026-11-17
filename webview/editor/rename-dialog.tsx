import { useState } from "react";
import { Button } from "../components/ui/button";

export function RenameDialog({ name, kind, onRename, onClose }: { name: string; kind: "节点" | "画板"; onRename: (name: string) => void; onClose: () => void }) {
  const [value,setValue] = useState(name);
  return <div className="canvas-apply-backdrop" onPointerDown={event=>{event.stopPropagation();if(event.target===event.currentTarget)onClose();}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();}} onKeyDown={event=>{
    event.stopPropagation();
    if(event.key==="Escape"){event.preventDefault();onClose();}
    if(event.key==="Tab"){
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input, button:not([disabled])'));
      const next=event.shiftKey ? controls.at(-1) : controls[0];
      if(document.activeElement===(event.shiftKey ? controls[0] : controls.at(-1))){event.preventDefault();next?.focus();}
    }
  }}>
    <form role="dialog" aria-modal="true" aria-label={`重命名${kind}`} className="canvas-apply-dialog canvas-rename-dialog floating-panel" onSubmit={event=>{event.preventDefault();if(value.trim()){onRename(value.trim());onClose();}}}>
      <strong>重命名{kind}</strong>
      <input autoFocus aria-label={`${kind}名称`} value={value} onFocus={event=>event.currentTarget.select()} onChange={event=>setValue(event.target.value)} />
      <div className="reference-override-actions"><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit" disabled={!value.trim()}>确定</Button></div>
    </form>
  </div>;
}
