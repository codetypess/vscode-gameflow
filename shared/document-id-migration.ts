import { allocateElementId, ELEMENT_ID_SCHEME, reserveDocumentElementIds } from "./element-id";
import { GameFlowValidationError, validateGameFlowDocument, type GameFlowDocument } from "./model";

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
      nodes: page.nodes.map(node => ({
        ...node,
        id: remap(node.id),
        ...(node.parentId !== undefined ? { parentId: remap(node.parentId) } : {})
      }))
    })),
    interactions: document.interactions.map(interaction => ({
      ...interaction,
      fromPageId: remap(interaction.fromPageId),
      toPageId: remap(interaction.toPageId)
    }))
  };
}
