import { defaultStyle } from "./editor-ops";
import type { GameFlowNode, GameFlowPage, NodeType } from "./model";
import type { SyncProperties, SyncPropertyValue } from "./page-sync";
import { canHaveChildren } from "./ui-components";
import { CONSTRAINTS, type NodeLayout, type WidgetProps } from "./ui-config";
import type { NodeTransform } from "./ui-transform";

type RecordNode = Record<string, unknown>;
type ResolveRef = (value: unknown) => string | null;

const TRANSFORM_DEFAULTS: Required<NodeTransform> = {anchorX:0,anchorY:0,scaleX:1,scaleY:1,skewX:0,skewY:0,rotation:0};
const TRANSFORM_KEYS = Object.keys(TRANSFORM_DEFAULTS) as (keyof NodeTransform)[];
const NODE_LAYOUT_KEYS = [
  ...CONSTRAINTS,"layoutUnit","widthMode","heightMode","crossAxisMode","positionOffsetX","positionOffsetY",
  "paddingLeft","paddingRight","paddingTop","paddingBottom","gap","gapX","gapY","align","valign","direction","wrapCount","clipContent","scrollX","scrollY"
] as (keyof NodeLayout)[];

export const prefabPropertyNames: Record<string,string> = {
  skin:"图片",normalSkin:"普通图片",selectedSkin:"选中图片",disabledSkin:"禁用图片",
  "page.width":"页面宽度","page.height":"页面高度","page.exportName":"导出名称",
  cellPrefab:"渲染项","layout.scrollType":"滚动方向",
  variableName:"变量",hidden:"隐藏",
  "transform.anchorX":"锚点 X","transform.anchorY":"锚点 Y","transform.scaleX":"缩放 X","transform.scaleY":"缩放 Y",
  "transform.skewX":"倾斜 X","transform.skewY":"倾斜 Y","transform.rotation":"旋转角度",
  "style.opacity":"不透明度","style.fontSize":"字号","style.color":"文字颜色","style.fontWeight":"字重",
  "style.italic":"斜体","style.underline":"下划线","style.strikethrough":"删除线","style.textAlign":"水平对齐",
  "layout.layoutUnit":"约束单位","layout.left":"左约束","layout.right":"右约束","layout.centerX":"水平居中约束",
  "layout.top":"上约束","layout.bottom":"下约束","layout.centerY":"垂直居中约束","layout.widthMode":"宽度模式",
  "layout.heightMode":"高度模式","layout.crossAxisMode":"交叉轴模式","layout.positionOffsetX":"位置偏移 X","layout.positionOffsetY":"位置偏移 Y",
  "layout.paddingLeft":"左内边距","layout.paddingRight":"右内边距","layout.paddingTop":"上内边距","layout.paddingBottom":"下内边距",
  "layout.gap":"间距","layout.gapX":"水平间距","layout.gapY":"垂直间距","layout.align":"水平排列",
  "layout.valign":"垂直排列","layout.direction":"排列方向","layout.wrapCount":"换行数量","layout.clipContent":"裁剪内容",
  "layout.scrollX":"滚动 X","layout.scrollY":"滚动 Y",
  "widget.skinNodeId":"皮肤节点","widget.textLabelNodeId":"选项文字节点","widget.optionNodeIds":"单选组成员",
  "widget.mode":"进度模式","widget.selected":"选中状态","widget.disabled":"禁用状态","widget.min":"最小值",
  "widget.max":"最大值","widget.value":"当前值","widget.direction":"控件方向","widget.placeholder":"占位文字",
  "widget.password":"密码显示","widget.maxChars":"最大字数","widget.options":"选项","widget.selectedIndex":"当前选项",
  "widget.wordWrap":"自动换行","widget.overflow":"文字溢出","widget.valign":"垂直对齐","widget.leading":"行距",
  "widget.letterSpacing":"字距","widget.html":"HTML","widget.ubb":"UBB","widget.templateVars":"模板变量",
  "widget.scrollX":"文字滚动 X","widget.scrollY":"文字滚动 Y","widget.imageFit":"图片填充"
};

const rootPaths = ["layout.layoutUnit",...CONSTRAINTS.map(key=>"layout."+key)];
const constraintDefaults:Record<string,SyncPropertyValue>={layoutUnit:"absolute",left:null,right:null,centerX:null,top:null,bottom:null,centerY:null};
function layoutDefault(type:NodeType,key:keyof NodeLayout):SyncPropertyValue {
  if(Object.hasOwn(constraintDefaults,key)) return constraintDefaults[key];
  if(key==="widthMode" || key==="heightMode") return "explicit";
  if(key==="crossAxisMode") return "aligned";
  if(["align"].includes(key)) return "left";
  if(key==="valign") return "top";
  if(key==="direction") return "horizontal";
  if(key==="wrapCount") return type==="list"?1:2;
  if(key==="clipContent") return type==="panel";
  return 0;
}
function nodeLayoutKeys(node:Pick<GameFlowNode,"type" | "prefab" | "cellPrefab" | "layout">, reference=!!node.prefab) {
  return NODE_LAYOUT_KEYS.filter(key=>!(["paddingLeft","paddingRight","paddingTop","paddingBottom","gap","gapX","gapY","align","valign","direction","wrapCount","clipContent","scrollX","scrollY"] as (keyof NodeLayout)[]).includes(key) || node.type === "list" || !reference && canHaveChildren(node));
}
function widgetDefaults(type:NodeType,side:"prototype"|"prefab"):Partial<Record<keyof WidgetProps,SyncPropertyValue>> {
  const result:Partial<Record<keyof WidgetProps,SyncPropertyValue>>={};
  if(["button","checkbox","radio"].includes(type)) result.selected=false;
  if(["button","input","checkbox","radio","combo"].includes(type)) result.disabled=false;
  if(["checkbox","radio","progress","slider"].includes(type)) result.skinNodeId=null;
  if(type==="progress" || type==="slider") Object.assign(result,{min:0,max:1,value:0},type==="progress"?{mode:"horizontal"}:{direction:"horizontal"});
  if(type==="input") Object.assign(result,{placeholder:"请输入内容",password:false,maxChars:0,valign:"middle"});
  if(type==="combo") Object.assign(result,{options:["选项一","选项二","选项三"],selectedIndex:0,textLabelNodeId:null});
  if(type==="radioGroup") Object.assign(result,{optionNodeIds:[],selectedIndex:-1});
  if(type==="image") result.imageFit="fill";
  if(type==="text") Object.assign(result,{wordWrap:side==="prototype",overflow:"hidden",valign:"top",leading:0,letterSpacing:0,html:false,ubb:false,templateVars:null,scrollX:0,scrollY:0});
  return result;
}
const cloneValue=<T extends SyncPropertyValue>(value:T):T=>value && typeof value==="object"?structuredClone(value):value;
const put=(properties:SyncProperties,path:string,value:SyncPropertyValue)=>{properties[path]=cloneValue(value);};

export function prototypePageProperties(page:GameFlowPage):SyncProperties {
  const properties:SyncProperties={"page.width":page.frame.width,"page.height":page.frame.height,"page.exportName":page.exportName??page.name};
  for(const path of rootPaths) {
    const key=path.slice(7) as keyof NonNullable<GameFlowPage["layout"]>;
    put(properties,path,(page.layout?.[key]??constraintDefaults[key]) as SyncPropertyValue);
  }
  return properties;
}

export function recordPageProperties(page:GameFlowPage,root:RecordNode):SyncProperties {
  const properties:SyncProperties={
    "page.width":typeof root.width==="number"&&Number.isFinite(root.width)?root.width:page.frame.width,
    "page.height":typeof root.height==="number"&&Number.isFinite(root.height)?root.height:page.frame.height,
    "page.exportName":typeof root.name==="string"&&root.name?root.name:page.exportName??page.name
  };
  for(const path of rootPaths) {
    const key=path.slice(7),value=root[key];
    put(properties,path,(key==="layoutUnit"&&(value==="absolute"||value==="percent")?value:CONSTRAINTS.includes(key as never)&&typeof value==="number"&&Number.isFinite(value)?value:constraintDefaults[key]) as SyncPropertyValue);
  }
  return properties;
}

export function prototypeNodeProperties(node:GameFlowNode):SyncProperties {
  const properties:SyncProperties={variableName:node.variableName??"",hidden:node.hidden??false};
  for(const key of TRANSFORM_KEYS) put(properties,"transform."+key,(node.transform?.[key]??TRANSFORM_DEFAULTS[key]) as number);
  put(properties,"style.opacity",node.style?.opacity??1);
  if(node.type==="text" || node.type==="input") {
    const style={...defaultStyle(node.type),...node.style};
    for(const key of ["fontSize","color","italic","underline","strikethrough","textAlign"] as const) put(properties,"style."+key,style[key]);
    put(properties,"style.fontWeight",style.fontWeight>=600?700:400);
  }
  for(const key of nodeLayoutKeys(node)) put(properties,"layout."+key,(node.layout?.[key]??layoutDefault(node.type,key)) as SyncPropertyValue);
  for(const [key,fallback] of Object.entries(widgetDefaults(node.type,"prototype")) as [keyof WidgetProps,SyncPropertyValue][]) put(properties,"widget."+key,(node.widget?.[key]??fallback) as SyncPropertyValue);
  if (node.type === "list") {
    const ref = node.cellPrefab;
    put(properties,"cellPrefab",ref && "source" in ref ? {source:ref.source,documentId:ref.documentId,pageId:ref.pageId} : ref ? {uuid:ref.uuid} : null);
    put(properties,"layout.scrollType",node.layout?.scrollType ?? (node.layout?.direction === "vertical" ? 1 : 2));
  }
  return properties;
}

function enumValue(value:unknown,values:readonly string[],fallback:SyncPropertyValue):SyncPropertyValue {
  return typeof value==="string"&&values.includes(value)?value:fallback;
}
export function recordNodeProperties(type:NodeType,source:RecordNode,resolveRef:ResolveRef):SyncProperties {
  const properties:SyncProperties={
    variableName:source._$var===true&&typeof source.name==="string"?source.name:"",
    hidden:source.visible===false
  };
  for(const key of TRANSFORM_KEYS) put(properties,"transform."+key,typeof source[key]==="number"&&Number.isFinite(source[key])?source[key] as number:TRANSFORM_DEFAULTS[key]);
  put(properties,"style.opacity",typeof source.alpha==="number"&&Number.isFinite(source.alpha)?source.alpha:1);
  if(type==="text" || type==="input") {
    const style=defaultStyle(type);
    put(properties,"style.fontSize",typeof source.fontSize==="number"&&Number.isFinite(source.fontSize)?source.fontSize:style.fontSize);
    put(properties,"style.color",typeof source.color==="string"?source.color:style.color);
    for(const key of ["italic","underline","strikethrough"] as const) put(properties,"style."+key,typeof source[key]==="boolean"?source[key] as boolean:style[key]);
    put(properties,"style.fontWeight",source.bold===true?700:400);
    put(properties,"style.textAlign",enumValue(source.align,["left","center","right"],style.textAlign));
  }
  for(const key of nodeLayoutKeys({type},typeof source._$prefab==="string")) {
    const value=source[key],fallback=layoutDefault(type,key);
    if(CONSTRAINTS.includes(key as never)) put(properties,"layout."+key,typeof value==="number"&&Number.isFinite(value)?value:value===null?null:fallback);
    else if(typeof fallback==="number") put(properties,"layout."+key,typeof value==="number"&&Number.isFinite(value)?value:fallback);
    else if(typeof fallback==="boolean") put(properties,"layout."+key,typeof value==="boolean"?value:fallback);
    else {
      const values:{[key:string]:string[]}={layoutUnit:["absolute","percent"],widthMode:["explicit","measured"],heightMode:["explicit","measured"],crossAxisMode:["aligned","explicit"],align:["left","center","right","justify"],valign:["top","middle","bottom","justify"],direction:["horizontal","vertical"]};
      put(properties,"layout."+key,enumValue(value,values[key]??[],fallback));
    }
  }
  for(const [key,fallback] of Object.entries(widgetDefaults(type,"prefab")) as [keyof WidgetProps,SyncPropertyValue][]) {
    let value:unknown=source[key];
    if(key==="placeholder") value=source.prompt;
    if(key==="password") value=source.type==="password";
    if(key==="options") value=source.labels;
    if(key==="skinNodeId") value=resolveRef(source.skin);
    if(key==="textLabelNodeId") value=resolveRef(source.textLabel);
    if(key==="optionNodeIds") value=Array.isArray(source.options)?source.options.map(resolveRef):fallback;
    const valid=Array.isArray(fallback)?Array.isArray(value):fallback===null?value===null||typeof value==="object":typeof value===typeof fallback;
    put(properties,"widget."+key,(valid?value:fallback) as SyncPropertyValue);
  }
  if (type === "list") {
    const cell = source.cellPrefab as {_$uuid?:string} | null;
    put(properties,"cellPrefab",cell?._$uuid ? {uuid:cell._$uuid} : null);
    put(properties,"layout.scrollType",source.scrollType === 0 || source.scrollType === 1 ? source.scrollType : source.scrollType === 2 ? 2 : source.direction === "vertical" ? 1 : 2);
  }
  return properties;
}

export function applyPageProperty(page:GameFlowPage,path:string,value:SyncPropertyValue):GameFlowPage {
  if(path==="page.width" || path==="page.height") return {...page,frame:{...page.frame,[path.slice(5)]:Number(value)}};
  if(path==="page.exportName") return {...page,exportName:String(value).trim() || undefined};
  if(path.startsWith("layout.")) return {...page,layout:{...page.layout,[path.slice(7)]:value}};
  return page;
}

export function applyNodeProperty(node:GameFlowNode,path:string,value:SyncPropertyValue):GameFlowNode {
  if(path==="cellPrefab") return {...node,cellPrefab:value ? value as GameFlowNode["cellPrefab"] : undefined};
  if(path==="variableName") return {...node,variableName:value?String(value):undefined};
  if(path==="hidden") return {...node,hidden:Boolean(value)};
  const dot=path.indexOf("."),group=path.slice(0,dot),key=path.slice(dot+1);
  if(group==="transform") return {...node,transform:{...node.transform,[key]:value}};
  if(group==="style") return {...node,style:{...node.style,[key]:value}};
  if(group==="layout") return {...node,layout:{...node.layout,[key]:value}};
  if(group==="widget") return {...node,widget:{...node.widget,[key]:cloneValue(value)}};
  return node;
}

export function applyRootRecordProperty(root:RecordNode,path:string,value:SyncPropertyValue) {
  if(path==="page.width" || path==="page.height") root[path.slice(5)]=value;
  else if(path==="page.exportName") root.name=value;
  else if(path.startsWith("layout.")) root[path.slice(7)]=value;
}

export function applyNodeRecordProperty(node:RecordNode,type:NodeType,name:string,path:string,value:SyncPropertyValue,externalId:(id:string)=>string) {
  if(path==="variableName") {
    if(value) {node.name=value;node._$var=true;} else {delete node._$var;node.name=name;}
    return;
  }
  if(path==="hidden") {node.visible=!value;return;}
  const dot=path.indexOf("."),group=path.slice(0,dot),key=path.slice(dot+1);
  if(group==="transform" || group==="layout") {node[key]=cloneValue(value);return;}
  if(group==="style") {
    if(key==="opacity") node.alpha=value;
    else if(key==="fontWeight") node.bold=Number(value)>=600;
    else if(key==="textAlign") node.align=value;
    else node[key]=value;
    return;
  }
  if(group!=="widget") return;
  if(key==="password") node.type=value?"password":"text";
  else if(key==="placeholder") node.prompt=value;
  else if(key==="options" && type==="combo") node.labels=cloneValue(value);
  else if(key==="skinNodeId") {if(value)node.skin={"_$ref":externalId(String(value))};else delete node.skin;}
  else if(key==="textLabelNodeId") {if(value)node.textLabel={"_$ref":externalId(String(value))};else delete node.textLabel;}
  else if(key==="optionNodeIds") node.options=(value as (string|null)[]).map(id=>id?{"_$ref":externalId(id)}:null);
  else node[key]=cloneValue(value);
}

export function sameSyncProperty(left:SyncPropertyValue|undefined,right:SyncPropertyValue|undefined) {
  return JSON.stringify(left)===JSON.stringify(right);
}
