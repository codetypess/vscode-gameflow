import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { CanvasNodeInfo } from "../../shared/canvas-instances";
import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { OverridePanel, type CanvasOverrideManager } from "./override-panel";

export function ReferenceBar({ meta, name, error, manager, onOpenSource }: {
  meta: CanvasNodeInfo; name?: string; error?: string; manager?: CanvasOverrideManager; onOpenSource: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = manager?.groups.reduce((total,group)=>total+group.fields.length,0) ?? 0;
  const sourceName = name ?? "源组件";
  const description = `${sourceName}\n${meta.source || "当前文件"}\n${meta.inherited ? "源组件节点，修改保存在当前实例" : meta.localId ? "本地附加节点，保存在当前实例" : "引用实例，位置和尺寸独立保存"}`;
  return <div className="canvas-reference-section">
    <div className="canvas-reference-bar" aria-label="组件引用">
      <button type="button" className="canvas-reference-link" title={description} aria-label={`打开源组件：${sourceName}`} onClick={onOpenSource}>{sourceName}</button>
      <Button size="sm" variant="outline" className="canvas-reference-edit" title={`编辑源组件：${sourceName}`} aria-label="编辑源组件" onClick={onOpenSource}>编辑</Button>
      {manager ? <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button size="sm" variant="outline" className="canvas-reference-overrides" title={count ? `当前实例有 ${count} 项属性覆盖` : "暂无属性覆盖"}>
          <span>覆盖属性</span>{count ? <span className="layer-override-dot" aria-hidden="true">●</span> : null}<ChevronDown size={12} aria-hidden="true" />
        </Button></PopoverTrigger>
        <PopoverContent className="floating-panel workbench-dialog canvas-overrides-panel" aria-label="覆盖属性" side="bottom" align="end" sideOffset={3} collisionPadding={8}
          onContextMenu={event=>event.preventDefault()} onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
          <OverridePanel manager={manager} sourceName={sourceName} onClose={()=>setOpen(false)} />
        </PopoverContent>
      </Popover> : null}
    </div>
    {error ? <p className="canvas-reference-error" role="status" title={error}><AlertTriangle size={12} aria-hidden="true"/><span>源组件异常</span></p> : null}
  </div>;
}
