import type { GameFlowNode } from "../../shared/model";
import { createContext, useContext, useState, type ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { readProperty } from "../../shared/canvas-instance-data";
import type { CanvasNodeInfo } from "../../shared/canvas-instances";

export interface OverrideActions {
  meta: CanvasNodeInfo; current?: GameFlowNode; applyIssue?: (fields?:string[])=>string|undefined; disabled: boolean; applyReason?: string; targetName?: string; targetSource?: string;
  onRevert: (fields?: string[]) => void; onApply: (fields?: string[]) => void;
}
const labels: Record<string, string> = {
  "名称":"name", "变量":"variableName", "文字内容":"text", "字号":"style.fontSize", "文字颜色":"style.color", "填充":"style.fill", "描边":"style.borderColor", "描边宽度":"style.borderWidth", "圆角":"style.radius", "不透明度":"style.opacity",
  "位置":"frame.x frame.y", "X":"frame.x", "Y":"frame.y", "尺寸":"frame.width frame.height", "W":"frame.width", "H":"frame.height",
  "锚点":"transform.anchorX transform.anchorY", "锚点 X":"transform.anchorX", "锚点 Y":"transform.anchorY", "缩放":"transform.scaleX transform.scaleY", "缩放 X":"transform.scaleX", "缩放 Y":"transform.scaleY", "倾斜":"transform.skewX transform.skewY", "倾斜 X":"transform.skewX", "倾斜 Y":"transform.skewY", "旋转":"transform.rotation", "旋转角度":"transform.rotation",
  "约束单位":"layout.layoutUnit", "左":"layout.left", "右":"layout.right", "水平居中":"layout.centerX", "上":"layout.top", "下":"layout.bottom", "垂直居中":"layout.centerY", "间距":"layout.gap layout.gapX layout.gapY", "水平间距":"layout.gapX", "垂直间距":"layout.gapY", "排列方向":"layout.direction", "每行数量":"layout.wrapCount", "每列数量":"layout.wrapCount", "裁剪超出内容":"layout.clipContent", "滚动":"layout.scrollX layout.scrollY", "滚动 X":"layout.scrollX", "滚动 Y":"layout.scrollY",
  "禁用状态":"widget.disabled", "最小值":"widget.min", "最大值":"widget.max", "当前值":"widget.value", "控件方向":"widget.direction", "占位文字":"widget.placeholder", "最大字数（0不限）":"widget.maxChars", "密码显示":"widget.password", "选项（用 | 分隔）":"widget.options", "当前选项":"widget.selectedIndex", "单选组当前选项":"widget.selectedIndex", "自动换行":"widget.wordWrap", "文字溢出":"widget.overflow", "图片填充":"widget.imageFit", "滑块节点":"widget.skinNodeId", "选中标记":"widget.skinNodeId", "选中状态":"widget.selected",
  "文字样式":"style.fontWeight style.italic style.underline style.strikethrough", "文字对齐":"style.textAlign widget.valign", "内边距":"layout.paddingTop layout.paddingBottom layout.paddingLeft layout.paddingRight", "上内边距":"layout.paddingTop", "下内边距":"layout.paddingBottom", "左内边距":"layout.paddingLeft", "右内边距":"layout.paddingRight"
};
const propertyLabels: Record<string,string> = {
  ...Object.fromEntries(Object.entries(labels).filter(([,path])=>!path.includes(" ")).map(([label,path])=>[path,label])),
  "frame.x":"位置 X", "frame.y":"位置 Y", "frame.width":"宽度", "frame.height":"高度", "hidden":"隐藏", "imageData":"图片",
  "style.fontWeight":"加粗", "style.italic":"斜体", "style.underline":"下划线", "style.strikethrough":"删除线", "style.textAlign":"文字水平对齐",
  "layout.widthMode":"宽度来源", "layout.heightMode":"高度来源", "layout.crossAxisMode":"交叉轴尺寸", "layout.positionOffsetX":"位置偏移 X", "layout.positionOffsetY":"位置偏移 Y", "layout.align":"水平对齐", "layout.valign":"垂直对齐",
  "layout.left":"左偏移", "layout.right":"右偏移", "layout.centerX":"水平居中偏移", "layout.top":"上偏移", "layout.bottom":"下偏移", "layout.centerY":"垂直居中偏移",
  "layout.scrollX":"滚动 X", "layout.scrollY":"滚动 Y", "widget.optionNodeIds":"选项节点", "widget.valign":"文字垂直对齐"
};
export const canvasPropertyLabel = (field: string) => propertyLabels[field] ?? field;
const Context = createContext<{ actions: OverrideActions; open: (x:number,y:number,fields:string[],label:string)=>void }|null>(null);
export function useOverrideAttributes(label:string, paths?:string[]) {
  const context=useContext(Context), fields=paths??labels[label.replace(/偏移$|约束$/, "").replace(/^内边距([上下左右])$/, "$1内边距")]?.split(" ")??[], changed=fields.filter(field=>context?.actions.meta.overrides.includes(field));
  return {
    "data-override-fields": changed.length?changed.join(" "):undefined,
    title: changed.length?`本地覆盖：${changed.map(field=>`${field}；本地值 ${JSON.stringify(readProperty(context!.actions.current,field))??"未设置"}；源值 ${JSON.stringify(readProperty(context!.actions.meta.base,field))??"未设置"}`).join("；")} · ${context!.actions.targetName ?? "源组件"} / ${context!.actions.targetSource || "当前文件"} · 右键还原或应用到源`:undefined,
    onContextMenu:(event:React.MouseEvent)=>{if(!context||!fields.length)return;event.preventDefault();event.stopPropagation();context.open(event.clientX,event.clientY,fields,label);},
    onKeyDown:(event:React.KeyboardEvent)=>{if(!context||!fields.length||!(event.key==="ContextMenu"||event.shiftKey&&event.key==="F10"))return;event.preventDefault();event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();context.open(rect.left,rect.bottom,fields,label);}
  };
}
export function canvasOverrideDependencies(fields:string[],overrides:string[]) {
  const result=new Set(fields.filter(field=>overrides.includes(field)));
  const axes=[["frame.x","frame.width","layout.left","layout.right","layout.centerX","layout.widthMode","layout.positionOffsetX","transform.anchorX"],["frame.y","frame.height","layout.top","layout.bottom","layout.centerY","layout.heightMode","layout.positionOffsetY","transform.anchorY"]];
  for(const axis of axes)if(fields.some(field=>axis.includes(field))||fields.includes("layout.layoutUnit"))for(const field of axis)if(overrides.includes(field))result.add(field);
  if(fields.some(field=>["widget.min","widget.max","widget.value"].includes(field)))for(const field of ["widget.min","widget.max","widget.value"])if(overrides.includes(field))result.add(field);
  return [...result];
}
export function CanvasPropertyProvider({actions,children}:{actions?:OverrideActions;children:ReactNode}) {
  const[menu,setMenu]=useState<{x:number;y:number;fields:string[];label:string}|null>(null);
  if(!actions)return <>{children}</>;
  const fields=canvasOverrideDependencies(menu?.fields??[],actions.meta.overrides),disabled=actions.disabled||!fields.length;
  const fieldIssue=menu ? actions.applyReason ?? (fields.length ? actions.applyIssue?.(fields) : undefined) : undefined;
  const nodeIssue=menu ? actions.applyReason ?? (actions.meta.overrides.length ? actions.applyIssue?.() : undefined) : undefined;
  return <Context.Provider value={{actions,open:(x,y,fields,label)=>setMenu({x,y,fields,label})}}>{children}
    <Menu.Root open={!!menu} modal={false} onOpenChange={open=>{if(!open)setMenu(null);}}>
      <Menu.Trigger tabIndex={-1} aria-hidden="true" className="layer-menu-anchor" style={{left:menu?.x??0,top:menu?.y??0}} />
      <Menu.Portal><Menu.Content className="layer-context-menu property-override-menu" aria-label="属性覆盖菜单" sideOffset={0} collisionPadding={8} onContextMenu={event=>event.preventDefault()} onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
        <Menu.Label className="menu-heading">{menu?.label} · 本地覆盖</Menu.Label>
        {fields.length?<div className="menu-hint">{fields.join("、")}</div>:null}
        <Menu.Item disabled={disabled} onSelect={()=>actions.onRevert(fields)}>还原此属性为源值{fields.length>(menu?.fields.length??0)?"（含关联字段）":""}</Menu.Item>
        <Menu.Item disabled={disabled||!!fieldIssue} onSelect={()=>actions.onApply(fields)}>应用此属性到源组件{actions.targetName?`「${actions.targetName}」`:""}{fields.length>(menu?.fields.length??0)?"（含关联字段）":""}</Menu.Item>
        <div className="menu-hint">{actions.targetSource||"当前文件"}{fieldIssue?` · ${fieldIssue}`:" · 其他未覆盖实例将同步"}</div>
        <Menu.Separator className="layer-menu-separator" />
        <Menu.Item disabled={actions.disabled||!actions.meta.overrides.length} onSelect={()=>actions.onRevert()}>还原该节点全部覆盖</Menu.Item>
        <Menu.Item disabled={actions.disabled||!actions.meta.overrides.length||!!nodeIssue} title={nodeIssue} onSelect={()=>actions.onApply()}>应用该节点全部覆盖到源</Menu.Item>
      </Menu.Content></Menu.Portal>
    </Menu.Root>
  </Context.Provider>;
}
