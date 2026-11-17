import { AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Bold, Italic, Underline, Strikethrough } from "lucide-react";
import type { NodeStyle, WidgetProps } from "../../shared/model";
import { useOverrideAttributes } from "./override-properties";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";

export function TextControls({ style, valign, disabled, onStyle, onVertical }: {
  style: Required<NodeStyle>; valign: NonNullable<WidgetProps["valign"]>; disabled: boolean;
  onStyle: (patch: Partial<NodeStyle>) => void; onVertical: (value: NonNullable<WidgetProps["valign"]>) => void;
}) {
  const styleOverride=useOverrideAttributes("文字样式"), alignOverride=useOverrideAttributes("文字对齐");
  const formats = [
    { label: "加粗", Icon: Bold, active: style.fontWeight >= 600, toggle: () => onStyle({ fontWeight: style.fontWeight >= 600 ? 400 : 700 }) },
    { label: "斜体", Icon: Italic, active: style.italic, toggle: () => onStyle({ italic: !style.italic }) },
    { label: "下划线", Icon: Underline, active: style.underline, toggle: () => onStyle({ underline: !style.underline }) },
    { label: "删除线", Icon: Strikethrough, active: style.strikethrough, toggle: () => onStyle({ strikethrough: !style.strikethrough }) }
  ];
  return <>
    <div {...styleOverride} className="text-format-row"><span>样式</span><div className="text-format-actions text-style-actions" role="group" aria-label="文字样式">
      {formats.map(({ label, Icon, active, toggle }) => <Tooltip key={label}><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={label} aria-pressed={active} disabled={disabled} onClick={toggle}><Icon size={15} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>)}
    </div></div>
    <div {...alignOverride} className="text-format-row"><span>对齐</span><div className="text-format-actions">
      <div className="text-format-axis" role="group" aria-label="文字水平对齐">
        {([["left", "左对齐", AlignLeft], ["center", "水平居中", AlignCenter], ["right", "右对齐", AlignRight]] as const).map(([value, label, Icon]) => <Tooltip key={value}><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={label} aria-pressed={style.textAlign === value} disabled={disabled} onClick={() => onStyle({ textAlign: value })}><Icon size={15} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>)}
      </div>
      <div className="text-format-axis" role="group" aria-label="文字垂直对齐">
        {([["top", "顶部对齐", AlignVerticalJustifyStart], ["middle", "垂直居中", AlignVerticalJustifyCenter], ["bottom", "底部对齐", AlignVerticalJustifyEnd]] as const).map(([value, label, Icon]) => <Tooltip key={value}><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={label} aria-pressed={valign === value} disabled={disabled} onClick={() => onVertical(value)}><Icon size={15} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>)}
      </div>
    </div></div>
  </>;
}
