import type { GameFlowPage } from "./model";
import type { PsdEmbeddedLayer } from "./psd-meta";

interface LayerKind { name: string; kind: PsdEmbeddedLayer["kind"] }
interface ComponentLayer extends LayerKind { children: ComponentLayer[] }

export function matchComponentLayers(source: readonly LayerKind[], target: readonly LayerKind[]) {
  const available = new Map<string, number[]>();
  const key = (layer: LayerKind) => JSON.stringify([layer.kind, layer.name]);
  target.forEach((layer, index) => {
    const layerKey = key(layer);
    const bucket = available.get(layerKey);
    if (bucket) bucket.push(index);
    else available.set(layerKey, [index]);
  });
  return source.map(layer => available.get(key(layer))?.shift());
}

export function missingComponentLayers(page: GameFlowPage, rootId: string, contents: PsdEmbeddedLayer[]) {
  function prototypeChildren(parentId: string): ComponentLayer[] {
    return page.nodes.filter(node => node.parentId === parentId).reverse().map(node => {
      if (node.type === "text" || node.type === "input") return { name: node.name, kind: "text", children: [] };
      if (node.type === "image" && node.image?.builtin) return { name: node.name, kind: "image", children: [] };
      return { name: node.name, kind: "group", children: prototypeChildren(node.id) };
    });
  }
  function missing(source: ComponentLayer[], target: PsdEmbeddedLayer[], path: string[]): string[] {
    const matches = matchComponentLayers(source, target);
    return source.flatMap((layer, index) => {
      const layerPath = [...path, layer.name];
      const match = matches[index];
      return match === undefined ? [layerPath.join(" / ")] : missing(layer.children, target[match].children, layerPath);
    });
  }
  return missing(prototypeChildren(rootId), contents, []);
}
