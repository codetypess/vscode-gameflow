import { DialogHeading } from "../components/dialog-heading";
import { useState } from "react";
import { sameTarget, targetKey, type CanvasPropertySelection, type CanvasTarget } from "../../shared/canvas-instance-data";
import { Button } from "../components/ui/button";
import { canvasOverrideDependencies } from "./override-properties";

export interface CanvasOverrideGroup {
  target: CanvasTarget; name: string; path: string;
  fields: { path: string; label: string; localValue: unknown; sourceValue: unknown; unset: boolean }[];
}
export interface CanvasOverrideManager {
  groups: CanvasOverrideGroup[]; initialTarget: CanvasTarget;
  sourceName?: string; sourcePath?: string;
  disabled: boolean; applyReason?: string; applyIssue: (selection: CanvasPropertySelection[]) => string | undefined;
  onRevert: (selection: CanvasPropertySelection[]) => void; onApply: (selection: CanvasPropertySelection[]) => void;
}
const fieldKey = (target: CanvasTarget, field: string) => `${targetKey(target)}\0${field}`;
function valueText(value: unknown) {
  if (value === undefined) return "未设置";
  if (value === null) return "空";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} 个成员` : "节点引用";
  if (typeof value === "string" && value.startsWith("data:image/")) return "图片";
  return String(value) || "空文本";
}
function Check({ checked, mixed, label, disabled, onChange }: { checked: boolean; mixed?: boolean; label: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <input type="checkbox" checked={checked} aria-checked={mixed ? "mixed" : checked} aria-label={label} disabled={disabled} ref={element=>{if(element)element.indeterminate=!!mixed;}} onChange={event=>onChange(event.target.checked)} />;
}

export function OverridePanel({ manager, sourceName, onClose }: { manager: CanvasOverrideManager; sourceName: string; onClose: () => void }) {
  const { groups } = manager;
  const [activeKey,setActiveKey] = useState(()=>targetKey(groups.find(group=>sameTarget(group.target,manager.initialTarget))?.target ?? groups[0]?.target ?? manager.initialTarget));
  const [selected,setSelected] = useState(()=>new Set(groups.flatMap(group=>group.fields.map(field=>fieldKey(group.target,field.path)))));
  const active=groups.find(group=>targetKey(group.target)===activeKey) ?? groups[0];
  const selections=groups.flatMap(group=>{const fields=group.fields.filter(field=>selected.has(fieldKey(group.target,field.path))).map(field=>field.path);return fields.length ? [{target:group.target,fields}] : [];});
  const count=selections.reduce((total,item)=>total+item.fields.length,0),total=groups.reduce((total,group)=>total+group.fields.length,0);
  const reason=manager.applyReason ?? (count ? manager.applyIssue(selections) : undefined);
  const toggle=(group: CanvasOverrideGroup, fields: string[], checked: boolean)=>setSelected(previous=>{
    const next=new Set(previous);
    for(const field of canvasOverrideDependencies(fields,group.fields.map(field=>field.path))){const key=fieldKey(group.target,field);if(checked)next.add(key);else next.delete(key);}
    return next;
  });
  return <>
    <DialogHeading heading="覆盖属性" onClose={onClose}><span title={`${manager.sourceName ?? sourceName}\n${manager.sourcePath || "当前文件"}`}>{manager.sourceName ?? sourceName}</span></DialogHeading>
    <div className="override-panel-columns">
      <nav className="override-node-list" aria-label="覆盖节点">
        <label className="override-select-all"><Check label="全选属性覆盖" checked={total>0 && count===total} mixed={count>0 && count<total} disabled={!total || manager.disabled} onChange={checked=>setSelected(new Set(checked ? groups.flatMap(group=>group.fields.map(field=>fieldKey(group.target,field.path))) : []))}/><span>全部节点</span><small>{total}</small></label>
        {groups.map(group=>{
          const checked=group.fields.filter(field=>selected.has(fieldKey(group.target,field.path))).length;
          return <div className={`override-node-row${active===group ? " is-active" : ""}`} key={targetKey(group.target)}>
            <Check label={`选择节点 ${group.name} 的覆盖`} checked={checked===group.fields.length} mixed={checked>0 && checked<group.fields.length} disabled={manager.disabled} onChange={checked=>toggle(group,group.fields.map(field=>field.path),checked)}/>
            <button type="button" aria-pressed={active===group} title={group.path} onClick={()=>setActiveKey(targetKey(group.target))}><span>{group.name}</span><small>{group.fields.length}</small></button>
          </div>;
        })}
      </nav>
      <section className="override-property-list" aria-label="属性覆盖列表">
        {active ? <><strong className="override-property-heading" title={active.path}>{active.name}</strong>{active.fields.map(field=>{
          const coupled=canvasOverrideDependencies([field.path],active.fields.map(field=>field.path)).length>1;
          const from=valueText(field.sourceValue),to=field.unset ? "未设置" : valueText(field.localValue);
          return <label className="override-property-row" key={field.path}>
            <Check label={field.label} checked={selected.has(fieldKey(active.target,field.path))} disabled={manager.disabled} onChange={checked=>toggle(active,[field.path],checked)}/>
            <span><span className="override-property-name">{field.label}{coupled ? <small title="关联布局或范围属性会一起选择">关联</small> : null}</span><span className="override-property-values" title={`源值：${from}\n本地值：${to}`}><span>{from}</span><span aria-hidden="true">→</span><span>{to}</span></span></span>
          </label>;
        })}</> : <p className="override-panel-empty">暂无属性覆盖</p>}
      </section>
    </div>
    {reason ? <p className="override-panel-reason" role="status">{reason}</p> : null}
    <footer className="override-panel-footer"><span>已选 {count} 项</span><Button size="sm" variant="outline" disabled={manager.disabled || !count} onClick={()=>manager.onRevert(selections)}>还原所选</Button><Button size="sm" disabled={manager.disabled || !count || !!reason} onClick={()=>manager.onApply(selections)}>应用所选</Button></footer>
  </>;
}
