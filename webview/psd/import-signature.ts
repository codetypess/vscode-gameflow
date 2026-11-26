import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { stringFingerprint } from "../../shared/string-fingerprint";

/** Compare visual properties across import, save/reopen and ID remapping. */
export function importSignature(page: Pick<GameFlowPage, "frame" | "nodes" | "layout">, images = new Map<string, string>()) {
  const indices = new Map(page.nodes.map((node, index) => [node.id, index]));
  const nodes = page.nodes.map(node => {
    const { id, parentId, name, locked, variableName, exportEnabled, imageData, ...appearance } = node;
    let pixels;
    if (imageData) {
      pixels = images.get(imageData);
      if (!pixels) {
        pixels = stringFingerprint(imageData);
        images.set(imageData, pixels);
      }
    }
    return [parentId ? indices.get(parentId) : null, pixels, appearance];
  });
  const canonical = (_key: string, value: unknown) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value;
  return stringFingerprint(JSON.stringify([page.frame.width, page.frame.height, page.layout, nodes], canonical));
}

export function importedNodes(layers: { node: Omit<GameFlowNode, "id" | "parentId">; parent: number | null }[], ids: string[]): GameFlowNode[] {
  return layers.map(({ node, parent }, i) => {
    if (parent === null) return { ...node, id: ids[i] };
    const { x, y } = layers[parent].node.frame;
    return { ...node, id: ids[i], parentId: ids[parent], frame: { ...node.frame, x: node.frame.x - x, y: node.frame.y - y } };
  });
}
