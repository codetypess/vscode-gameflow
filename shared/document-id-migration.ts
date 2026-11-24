import { remapCanvasEdits, rekeyCanvasTargets } from "./canvas-instance-data";
import { allocateElementId, ELEMENT_ID_SCHEME, reserveDocumentElementIds } from "./element-id";
import { GameFlowValidationError, validateGameFlowDocument, type GameFlowDocument } from "./model";
import { remapControlReferences } from "./ui-parts";

/** Rekey legacy prototype elements together with every modeled identity reference. */
export function migrateDocumentElementIds(
  document: GameFlowDocument,
  candidate?: () => string
): GameFlowDocument {
  const validation = validateGameFlowDocument(document);
  if (!validation.ok) throw new GameFlowValidationError(validation.errors);
  if (document.elementIdScheme === ELEMENT_ID_SCHEME) return document;

  const reserved = new Set<string>();
  reserveDocumentElementIds(document, reserved);
  const replacements = new Map<string, string>();
  // Snapshot the set: allocation adds entries to it immediately.
  for (const id of [...reserved]) {
    replacements.set(id, allocateElementId(reserved, candidate));
  }

  const remap = (id: string) => replacements.get(id) ?? id;
  return {
    ...document,
    elementIdScheme: ELEMENT_ID_SCHEME,
    pages: document.pages.map(page => ({
      ...page,
      id: remap(page.id),
      ...(page.componentRootId ? { componentRootId: remap(page.componentRootId) } : {}),
      nodes: page.nodes.map(node => rekeyCanvasTargets(remapCanvasEdits(remapControlReferences({
        ...node,
        id: remap(node.id),
        ...(node.cellPrefab && "source" in node.cellPrefab && !node.cellPrefab.source && node.cellPrefab.documentId === document.documentId ? {cellPrefab:{...node.cellPrefab,pageId:remap(node.cellPrefab.pageId)}} : {}),
        ...(node.prefab?.source === "" && node.prefab.documentId === document.documentId ? { prefab: { ...node.prefab, pageId: remap(node.prefab.pageId) } } : {}),
        ...(node.parentId !== undefined ? { parentId: remap(node.parentId) } : {})
      }, replacements), replacements), document.documentId, replacements))
    })),
    interactions: document.interactions.map(interaction => ({
      ...interaction,
      fromPageId: remap(interaction.fromPageId),
      toPageId: remap(interaction.toPageId)
    }))
  };
}
