import { customAlphabet } from "nanoid";
import type { GameFlowDocument } from "./model";

export const ELEMENT_ID_SCHEME = "nanoid-8" as const;
const ELEMENT_ID = /^[a-z0-9]{8}$/;
const createElementId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

/** Reserve immediately so a batch of copied nodes cannot reuse an ID. */
export function allocateElementId(
  reserved: Set<string>,
  candidate: () => string = createElementId
): string {
  for (let attempt = 0; attempt < 128; attempt++) {
    const id = candidate();
    if (!ELEMENT_ID.test(id)) throw new Error("Element ID generator must produce an 8-character lowercase alphanumeric Nano ID");
    if (reserved.has(id)) continue;
    reserved.add(id);
    return id;
  }
  throw new Error("Unable to allocate a unique element ID after 128 attempts");
}

/** Include every page, not just the currently edited page. Existing IDs are never rewritten. */
export function reserveDocumentElementIds(document: GameFlowDocument, reserved: Set<string>): void {
  for (const page of document.pages) {
    reserved.add(page.id);
    for (const node of page.nodes) reserved.add(node.id);
  }
}
