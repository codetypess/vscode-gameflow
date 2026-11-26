import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePsdBinary } from "../shared/psd-binary";
import { createPsdStructure } from "../shared/psd-structure";
import { bytesHash } from "../src/psd-document-model";

export function pagePsdFixture(root = ".") {
  const source = "login.psd";
  const bytes = readFileSync(join(root, "examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd"));
  const asset = createPsdStructure(parsePsdBinary(bytes), source, bytesHash(bytes));
  return { bytes, asset, binding: { source, documentId: asset.documentId } };
}
