import { initializeCanvas, writePsdUint8Array, type Layer, type Psd } from "ag-psd";
import type { GameFlowDocument, GameFlowNode, GameFlowPage } from "../../shared/model";
import { PSD_SLOT_MARKERS } from "../../shared/psd-slot-markers";
import { builtinImage } from "../../shared/image-slots";
import { builtinLayerGrid, builtinOrigin } from "../../shared/psd-builtin";
import { nodeSlots, resourceUuid } from "../../shared/prefab-export";
import { parsePsdBinary, patchPsdMetadata } from "../../shared/psd-binary";
import type { PsdLayerMeta } from "../../shared/psd-meta";
import { resolvePageLayout } from "../../shared/ui-layout";
import { controlHidden } from "../../shared/ui-parts";
import { layoutLabel } from "../../shared/label-text";
import { loadSliceImage } from "../psd/slice-render";
import { paintSlice } from "./paint-slice";
import { imageRenderSize } from "../../shared/image-rendering";

export async function generatePrototypePsd(document:GameFlowDocument,page:GameFlowPage):Promise<Uint8Array>{
  if(page.frame.width>4096||page.frame.height>4096||page.frame.width*page.frame.height>8_000_000)throw new Error("生成 PSD 支持 4096 边长、800 万像素以内的画布。");
  initializeCanvas((w,h)=>{const c=window.document.createElement("canvas");c.width=w;c.height=h;return c;},(w,h)=>new ImageData(w,h));
  const layout=resolvePageLayout(page);if(layout.issues.length)throw new Error(layout.issues.map(i=>i.message).join("；"));
  const documentId=resourceUuid(document.documentId+":"+page.id+":psd"), metadata=new Map<number,PsdLayerMeta>();let nativeId=0;
  const makeCanvas=(width:number,height:number)=>{const c=window.document.createElement("canvas");c.width=Math.max(1,Math.ceil(width));c.height=Math.max(1,Math.ceil(height));return c;};
  const composite=makeCanvas(page.frame.width,page.frame.height),compositeContext=composite.getContext("2d")!;
  const meta=(nodeId:string,slot?:string):PsdLayerMeta=>({namespace:"com.codetypes.gameflow",version:1,documentId,layerId:resourceUuid(page.id+":"+nodeId+":"+(slot??"node")),prototype:{documentId:document.documentId,pageId:page.id,nodeId,...(slot?{slot}:{})}});
  const withMeta=(layer:Layer,m:PsdLayerMeta)=>{layer.id=++nativeId;metadata.set(layer.id,m);return layer;};
  const raster=async(node:GameFlowNode,slot:ReturnType<typeof nodeSlots>[number],name:string):Promise<Layer|null>=>{
    const [field,value]=slot;if(!value?.builtin)return null;const builtin=builtinImage(value.builtin);if(!builtin)throw new Error(node.name+" 的内置图片不存在。");
    const geometry=layout.nodes.get(node.id)!;const local=geometry.local;
    // Fill resources are authored at full size. Progress only changes how the runtime displays them.
    const {width}=imageRenderSize(page,node,layout);
    const source=window.document.createElement("canvas");paintSlice(source,await loadSliceImage(builtin.dataUri),builtin,width,local.height,node.widget?.imageFit??"fill");
    const m=meta(node.id,field);m.slicing={enabled:true,name,nineGrid:builtinLayerGrid(builtin.nineGrid,source.width,source.height)};
    const pixels = source.getContext("2d")!.getImageData(0, 0, source.width, source.height);
    m.builtinOrigin = await builtinOrigin(builtin, width, local.height, pixels.data);
    const layer=withMeta({name,left:Math.round(geometry.matrix[4]),top:Math.round(geometry.matrix[5]),imageData:pixels,hidden:node.hidden||field==="selectedSkin"||field==="disabledSkin"||controlHidden(page,node)},m);
    if(!layer.hidden){compositeContext.save();compositeContext.transform(...geometry.matrix);compositeContext.globalAlpha=node.style?.opacity??1;compositeContext.drawImage(source,0,0,width,local.height);compositeContext.restore();}
    return layer;
  };
  const label=(node:GameFlowNode):Layer=>{
    const g=layout.nodes.get(node.id)!,c=makeCanvas(g.local.width,g.local.height),ctx=c.getContext("2d")!,style=node.style??{},widget=node.widget??{};
    const parent=page.nodes.find(n=>n.type==="combo"&&n.widget?.textLabelNodeId===node.id),content=parent?{...node,text:parent.widget?.options?.[parent.widget?.selectedIndex??-1]??""}:node;
    const measure=(text:string,s:{fontSize:number;fontWeight:number;italic:boolean},scale:number)=>{ctx.font=(s.italic?"italic ":"")+s.fontWeight+" "+s.fontSize*scale+"px Microsoft YaHei, sans-serif";return{width:ctx.measureText(text).width,height:s.fontSize*scale*1.35};};
    const textLayout=layoutLabel(content,g.local.width,g.local.height,measure),offsetY=(g.local.height-textLayout.height)*(widget.valign==="middle"?.5:widget.valign==="bottom"?1:0);
    ctx.textBaseline="middle";
    for(const line of textLayout.lines)for(const piece of line.pieces){if(!("text" in piece.run))continue;const s=piece.run.style,scale=textLayout.scale;measure("",s,scale);ctx.fillStyle=s.color;const x=(g.local.width-line.width)*(style.textAlign==="center"?.5:style.textAlign==="right"?1:0)-line.offsetX+piece.x,y=offsetY+line.y+line.height/2;if(piece.glyphs)for(const glyph of piece.glyphs)ctx.fillText(glyph.text,x+glyph.x,y);else ctx.fillText(piece.run.text,x,y);}
    const hidden=controlHidden(page,node);
    if(!hidden){compositeContext.save();compositeContext.transform(...g.matrix);compositeContext.globalAlpha=style.opacity??1;compositeContext.drawImage(c,0,0);compositeContext.restore();}
    return withMeta({name:node.name,left:Math.round(g.matrix[4]),top:Math.round(g.matrix[5]),canvas:c,hidden,text:{text:content.text??"",transform:[...g.matrix.slice(0,4),g.matrix[4],g.matrix[5]+(style.fontSize??14)],style:{font:{name:"MicrosoftYaHei"},fontSize:style.fontSize??14,fillColor:{r:parseInt((style.color??"#333333").slice(1,3),16)||0,g:parseInt((style.color??"#333333").slice(3,5),16)||0,b:parseInt((style.color??"#333333").slice(5,7),16)||0}},paragraphStyle:{justification:style.textAlign??"left"}}},meta(node.id));
  };
  const build=async(node:GameFlowNode):Promise<Layer>=>{
    if(node.type==="text"||node.type==="input")return label(node);
    if(node.type==="image")return await raster(node,nodeSlots(node)[0],node.name)??withMeta({name:node.name,children:[]},meta(node.id));
    const children:Layer[]=[];
    if(node.type==="button")for(const slot of nodeSlots(node)){const layer=await raster(node,slot,PSD_SLOT_MARKERS[slot[0]]);if(layer)children.push(layer);}
    for(const child of page.nodes.filter(child=>child.parentId===node.id))children.push(await build(child));
    return withMeta({name:node.name,opened:true,children,hidden:node.hidden},meta(node.id));
  };
  const children:Layer[]=[];for(const node of page.nodes.filter(n=>!n.parentId))children.push(await build(node));
  if(nativeId>128)throw new Error("当前 PSD 读取器支持最多 128 个图层及分组，请减少节点或分页面生成。");
  const psd:Psd={width:composite.width,height:composite.height,canvas:composite,children};
  const bytes=writePsdUint8Array(psd,{generateThumbnail:false,invalidateTextLayers:false}),raw=parsePsdBinary(bytes);
  return patchPsdMetadata(bytes,new Map(raw.layers.filter(layer=>layer.nativeId!==null&&metadata.has(layer.nativeId)).map(layer=>[layer.key,metadata.get(layer.nativeId!)!])));
}
