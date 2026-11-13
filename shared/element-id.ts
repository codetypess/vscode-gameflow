import type { GameFlowDocument } from "./model";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const CHARACTERS = `${LETTERS}0123456789`;
const SHORT_ID = /^[a-z][a-z0-9]{7}$/;

/** Matches Laya's default genShortId format; resource UUIDs use a separate identity. */
function randomShortId(): string {
  const values = crypto.getRandomValues(new Uint32Array(8));
  let id = LETTERS[values[0] % LETTERS.length];
  for (let index = 1; index < values.length; index++) {
    id += CHARACTERS[values[index] % CHARACTERS.length];
  }
  return id;
}

/** Reserve immediately so a batch of copied nodes cannot reuse an ID. */
export function allocateElementId(
  reserved: Set<string>,
  candidate: () => string = randomShortId
): string {
  for (let attempt = 0; attempt < 128; attempt++) {
    const id = candidate();
    if (!SHORT_ID.test(id)) throw new Error("Element ID generator must produce an 8-character Laya-style ID");
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
