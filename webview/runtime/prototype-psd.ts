import { initializeCanvas, writePsdUint8Array, type Layer, type LinkedFile } from "ag-psd";
import { CANVAS_INSTANCE_LAYOUT_KEYS, type GameFlowDocument, type GameFlowNode, type GameFlowPage } from "../../shared/model";
import { descendants } from "../../shared/editor-ops";
import { allocateElementId } from "../../shared/element-id";
import { prototypeLayerRef } from "../../shared/psd-prototype";
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
import { embedPsdGroup, placeComponentPsd, type ComponentPsd } from "./psd-smart-object";
import { mapPoint } from "../../shared/ui-transform";
import { cellKey, resolveCellPage } from "../../shared/list-cell";
import type { CanvasSources } from "../../shared/canvas-references";
import { placeListCells, type PsdCellTemplate } from "./psd-list-cells";
import { componentPsdFileName } from "../../shared/page-psd";
import type { PsdComponentInstance } from "../../shared/page-sync";

interface PrototypePsdOptions {
  reserved?: Iterable<string>;
  previous?: readonly PsdLayerMeta[];
  sources?: CanvasSources;
  referenceDocument?: GameFlowDocument;
}

export async function generatePrototypePsd(document: GameFlowDocument, page: GameFlowPage,
  components: ReadonlyMap<string,PsdComponentInstance> = new Map(), options: PrototypePsdOptions = {},
  componentPsds?: ReadonlyMap<string, ComponentPsd>): Promise<Uint8Array> {
  const { composite, children, linkedFiles, metadata } = await renderPrototypePsd(document, page, components, options, componentPsds);
  const bytes = writePsdUint8Array({ width: composite.width, height: composite.height, canvas: composite, children, linkedFiles },
    { generateThumbnail: false, invalidateTextLayers: false });
  const raw = parsePsdBinary(bytes);
  return patchPsdMetadata(bytes, new Map(raw.layers.filter(layer => layer.nativeId !== null && metadata.has(layer.nativeId)).map(layer => [layer.key, metadata.get(layer.nativeId!)!])));
}

async function renderPrototypePsd(document: GameFlowDocument, page: GameFlowPage, components: ReadonlyMap<string,PsdComponentInstance>,
  options: PrototypePsdOptions, componentPsds?: ReadonlyMap<string, ComponentPsd>,
  templates = new Map<string, PsdCellTemplate>(), trail: string[] = []): Promise<{
  composite: HTMLCanvasElement; children: Layer[]; linkedFiles: LinkedFile[]; metadata: Map<number,PsdLayerMeta>;
}> {
  if(page.frame.width>4096||page.frame.height>4096||page.frame.width*page.frame.height>8_000_000)throw new Error("生成 PSD 支持 4096 边长、800 万像素以内的画布。");
  initializeCanvas((w,h)=>{const c=window.document.createElement("canvas");c.width=w;c.height=h;return c;},(w,h)=>new ImageData(w,h));
  const layout=resolvePageLayout(page);if(layout.issues.length)throw new Error(layout.issues.map(i=>i.message).join("；"));
  const documentId=resourceUuid(document.documentId+":"+page.id+":psd"), metadata=new Map<number,PsdLayerMeta>();let nativeId=0;
  const reserved = new Set(options.reserved);
  const previous = new Map<string, string | undefined>();
  const reused = new Set<string>();
  const layerKey = (nodeId: string, slot?: string) => JSON.stringify([nodeId, slot]);
  for (const layer of options.previous ?? []) {
    reserved.add(layer.layerId);
    if (layer.documentId !== documentId) continue;
    const ref = layer.prototype;
    const key = typeof layer.listNodeId === "string" && Number.isInteger(layer.listCellIndex)
      ? layerKey(layer.listNodeId, "cell:" + layer.listCellIndex)
      : prototypeLayerRef(ref) && ref.documentId === document.documentId && ref.pageId === page.id ? layerKey(ref.nodeId, ref.slot) : undefined;
    if (!key) continue;
    previous.set(key, previous.has(key) ? undefined : layer.layerId);
  }
  const linkedFiles = new Map<string, LinkedFile>();
  const makeCanvas=(width:number,height:number)=>{const c=window.document.createElement("canvas");c.width=Math.max(1,Math.ceil(width));c.height=Math.max(1,Math.ceil(height));return c;};
  const composite=makeCanvas(page.frame.width,page.frame.height),compositeContext=composite.getContext("2d")!;
  const identity = (key: string): PsdLayerMeta => {
    const oldId = previous.get(key);
    const layerId = oldId && !reused.has(oldId) ? oldId : allocateElementId(reserved);
    reused.add(layerId);
    return { namespace: "com.codetypes.gameflow", version: 1, documentId, layerId };
  };
  const meta = (nodeId: string, slot?: string): PsdLayerMeta => ({ ...identity(layerKey(nodeId, slot)),
    prototype: { documentId: document.documentId, pageId: page.id, nodeId, ...(slot ? { slot } : {}) } });
  const withMeta=(layer:Layer,m:PsdLayerMeta)=>{
    if (nativeId >= 128) throw new Error("当前支持最多 128 个图层/分组。");
    layer.id=++nativeId;metadata.set(layer.id,m);return layer;
  };
  const references = { referenceDocument: options.referenceDocument ?? document, sources: options.sources ?? {} };
  const renderList = async (node: GameFlowNode, children: Layer[]) => {
    const ref = node.cellPrefab!;
    if ("uuid" in ref) throw new Error("未定位到列表项模板 " + ref.uuid);
    const key = cellKey(ref);
    if (trail.includes(key)) throw new Error("列表项模板循环引用：" + node.name);
    let template = templates.get(key);
    if (!template) {
      const target = resolveCellPage(references.referenceDocument, references.sources, ref);
      if (!target.page.nodes.length) return;
      const nested = await renderPrototypePsd(target.document, target.page, new Map(), references, undefined, templates, [...trail, key]);
      const bitmap = nested.composite;
      const data = writePsdUint8Array({ width: bitmap.width, height: bitmap.height, canvas: bitmap,
        children: nested.children, linkedFiles: nested.linkedFiles }, { generateThumbnail: false, invalidateTextLayers: false });
      const file: LinkedFile = { id: crypto.randomUUID(), name: componentPsdFileName(target.page.name), type: "8BPS", data };
      template = { page: target.page, bitmap, file };
      templates.set(key, template);
    }
    const { file } = template;
    placeListCells(node, layout.nodes.get(node.id)!, template, compositeContext, controlHidden(page, node), (layer, index) => {
      linkedFiles.set(file.id, file);
      children.push(withMeta(layer, { ...identity(layerKey(node.id, "cell:" + index)), listNodeId: node.id, listCellIndex: index }));
    });
  };
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
    const component = components.get(node.id);
    if (component) {
      const geometry = layout.nodes.get(node.id)!;
      const frame = { x: 0, y: 0, width: geometry.local.width, height: geometry.local.height };
      const source = componentPsds?.get(node.id);
      if (source) {
        const corners = [{ x: 0, y: 0 }, { x: frame.width, y: 0 },
          { x: frame.width, y: frame.height }, { x: 0, y: frame.height }];
        const transform = corners.map(point => mapPoint(geometry.matrix, point)).flatMap(point => [point.x, point.y]);
        const { layer, file } = await placeComponentPsd(source, transform, node.name);
        linkedFiles.set(file.id, file);
        layer.hidden = controlHidden(page, node);
        if (!layer.hidden) compositeContext.drawImage(layer.canvas!, layer.left!, layer.top!);
        return withMeta(layer, { ...meta(node.id), componentSmartObject: true, componentSource: source.origin });
      }
      const ids = descendants(page, node.id);
      const rootLayout = Object.fromEntries(Object.entries(node.layout ?? {}).filter(([key]) => !CANVAS_INSTANCE_LAYOUT_KEYS.includes(key)));
      const nodes = page.nodes.filter(child => ids.has(child.id)).map(child => child === node
        ? { ...node, parentId: undefined, frame, transform: undefined, layout: rootLayout, hidden: false }
        : child);
      const nested = await renderPrototypePsd(document, { ...page, frame, layout: undefined, nodes }, new Map(), references, undefined, templates, trail);
      const group = { name: node.name, children: nested.children[0]?.children ?? nested.children, hidden: controlHidden(page, node) };
      const { layer, file } = await embedPsdGroup(group, component.key, componentPsdFileName(component.sourceName), frame,
        { matrix: geometry.matrix, composite: nested.composite, linkedFiles: nested.linkedFiles });
      if (!linkedFiles.has(file.id)) linkedFiles.set(file.id, file);
      if (!layer.hidden) compositeContext.drawImage(layer.canvas!, layer.left!, layer.top!);
      return withMeta(layer, { ...meta(node.id), componentSmartObject: true });
    }
    if(node.type==="text"||node.type==="input")return label(node);
    if(node.type==="image") {
      return await raster(node, ["image", node.image === undefined ? { builtin: "image/default" } : node.image], node.name)
        ?? withMeta({name:node.name,children:[]},meta(node.id));
    }
    const children:Layer[]=[];
    if(node.type==="list" && node.cellPrefab) await renderList(node, children);
    if(node.type==="button")for(const slot of nodeSlots(node)){const layer=await raster(node,slot,PSD_SLOT_MARKERS[slot[0]]);if(layer)children.push(layer);}
    for(const child of page.nodes.filter(child=>child.parentId===node.id))children.push(await build(child));
    const group = meta(node.id);
    if (node.type === "list" && node.cellPrefab) group.listCellsGenerated = true;
    return withMeta({name:node.name,opened:true,children,hidden:node.hidden},group);
  };
  const children:Layer[]=[];for(const node of page.nodes.filter(n=>!n.parentId))children.push(await build(node));
  return { composite, children, linkedFiles: [...linkedFiles.values()], metadata };
}
