import { AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalSpaceBetween, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalSpaceBetween, type LucideIcon } from "lucide-react";
import type { NodeLayout } from "../../shared/model";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { Field } from "./fields";

const CONSTRAINT_CONTROLS = [
  { key: "left", axis: "x", label: "左", short: "左", position: 30 },
  { key: "centerX", axis: "x", label: "水平居中", short: "X", position: 90 },
  { key: "right", axis: "x", label: "右", short: "右", position: 150 },
  { key: "top", axis: "y", label: "上", short: "上", position: 24 },
  { key: "centerY", axis: "y", label: "垂直居中", short: "Y", position: 56 },
  { key: "bottom", axis: "y", label: "下", short: "下", position: 88 }
] as const;

export function ConstraintControl({ layout, disabledX, disabledY, onChange }: {
  layout: NodeLayout; disabledX: boolean; disabledY: boolean; onChange: (patch: Partial<NodeLayout>) => void;
}) {
  const disabled = (axis: "x" | "y") => axis === "x" ? disabledX : disabledY;
  return <div className="constraint-control" role="group" aria-label="布局约束">
    <div className="constraint-title">布局约束<small>{layout.layoutUnit === "percent" ? "%" : "px"}</small></div>
    <div className="constraint-map">
      {(["x", "y"] as const).map(axis => <div key={axis} className={`constraint-toggles constraint-${axis}`}>
        {CONSTRAINT_CONTROLS.filter(item => item.axis === axis).map(item => <label key={item.key} title={`${item.label}约束${disabled(axis) ? "（锁定或由父容器排布）" : ""}`}>
          <input type="checkbox" aria-label={`${item.label}约束`} checked={layout[item.key] != null} disabled={disabled(axis)} onChange={event => onChange({ [item.key]: event.target.checked ? 0 : null })} /><span>{item.short}</span>
        </label>)}
      </div>)}
      <svg className="constraint-diagram" viewBox="0 0 180 112" preserveAspectRatio="none" aria-hidden="true">
        <rect className="constraint-boundary" x="1" y="1" width="178" height="110" />
        <rect className="constraint-child" x="30" y="24" width="120" height="64" />
        {CONSTRAINT_CONTROLS.map(item => <line key={item.key} className={`constraint-guide${layout[item.key] != null ? " is-active" : ""}`} strokeDasharray={item.key.startsWith("center") ? "3 3" : undefined}
          x1={item.axis === "x" ? item.position : 1} y1={item.axis === "y" ? item.position : 1} x2={item.axis === "x" ? item.position : 179} y2={item.axis === "y" ? item.position : 111} />)}
      </svg>
    </div>
    {CONSTRAINT_CONTROLS.some(item => layout[item.key] != null) ? <div className="constraint-values">
      {CONSTRAINT_CONTROLS.filter(item => layout[item.key] != null).map(item => <Field key={item.key} label={`${item.label}偏移`} value={layout[item.key]!} type="number" min={-1e7} max={1e7} disabled={disabled(item.axis)} onCommit={value => onChange({ [item.key]: Number(value) })} />)}
    </div> : null}
    <p className="property-hint">勾选启用，0 为贴边/居中。双边拉伸；居中优先。</p>
  </div>;
}

export function PaddingControl({ layout, disabled, onChange }: { layout: NodeLayout; disabled: boolean; onChange: (patch: Partial<NodeLayout>) => void }) {
  return <div className="padding-control" role="group" aria-label="内边距">
    <span title="内边距（像素）">Padding</span><div className="padding-values">
      {([ ["paddingTop", "U", "上"], ["paddingRight", "R", "右"], ["paddingBottom", "D", "下"], ["paddingLeft", "L", "左"] ] as const).map(([key, short, label]) => <Field key={key} label={short} ariaLabel={`内边距${label}`} type="number" min={0} max={1e7} disabled={disabled} value={layout[key] ?? 0} onCommit={value => onChange({ [key]: Number(value) })} />)}
    </div>
  </div>;
}

const HORIZONTAL: readonly (readonly [NonNullable<NodeLayout["align"]>, string, LucideIcon])[] = [
  ["left", "水平左对齐", AlignHorizontalJustifyStart], ["center", "水平居中对齐", AlignHorizontalJustifyCenter],
  ["right", "水平右对齐", AlignHorizontalJustifyEnd], ["justify", "水平两端分布", AlignHorizontalSpaceBetween]
];
const VERTICAL: readonly (readonly [NonNullable<NodeLayout["valign"]>, string, LucideIcon])[] = [
  ["top", "垂直顶部对齐", AlignVerticalJustifyStart], ["middle", "垂直居中对齐", AlignVerticalJustifyCenter],
  ["bottom", "垂直底部对齐", AlignVerticalJustifyEnd], ["justify", "垂直两端分布", AlignVerticalSpaceBetween]
];
export function ContainerAlignment({ layout, flow, disabled, onChange }: {
  layout: NodeLayout; flow: "hbox" | "vbox" | "grid"; disabled: boolean; onChange: (patch: Partial<NodeLayout>) => void;
}) {
  return <div className="container-alignment"><span>对齐</span><div className="container-alignment-groups">
    {(["x", "y"] as const).map(axis => <div className="container-alignment-axis" role="group" aria-label={axis === "x" ? "水平对齐" : "垂直对齐"} key={axis}>
      {(axis === "x" ? HORIZONTAL : VERTICAL).filter(([value]) => value !== "justify" || flow === (axis === "x" ? "hbox" : "vbox")).map(([value, label, Icon]) => {
        const active = (axis === "x" ? layout.align ?? "left" : layout.valign ?? "top") === value;
        return <Tooltip key={value}><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={label} aria-pressed={active} disabled={disabled} onClick={() => onChange(axis === "x" ? { align: value as NodeLayout["align"] } : { valign: value as NodeLayout["valign"] })}><Icon size={15} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
      })}
    </div>)}
  </div></div>;
}
