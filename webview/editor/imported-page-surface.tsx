import { createContext, useMemo, type CSSProperties, type ReactNode } from "react";
import type { ResourceMode } from "../../shared/image-slots";
import type { GameFlowPage } from "../../shared/model";
import type { PsdAsset } from "../../shared/psd-meta";
import { importSignature } from "../psd/import-signature";

export const ImportedImageCorrections = createContext<ReadonlyMap<string, string>>(new Map());

export function ImportedPageSurface({ page, source, mode, blocked, scopeCorners, children }: {
  page: GameFlowPage; source?: PsdAsset; mode: ResourceMode; blocked: boolean; scopeCorners?: readonly { x: number; y: number }[]; children: ReactNode;
}) {
  const embedded = page.psdImportPreview;
  const eligible = !blocked && mode !== "prefab" && !!(embedded || source?.importSignature || source?.importCorrections?.length);
  const images = useMemo(() => new Map<string, string>(), [page.id, source?.sourceHash, embedded?.signature]);
  const signature = useMemo(() => {
    if (!eligible) return;
    // Keep only the current page's bitmaps across visual edits.
    const used = new Set(page.nodes.map(n => n.imageData));
    for (const image of images.keys()) if (!used.has(image)) images.delete(image);
    return importSignature(page, images);
  }, [eligible, page.nodes, page.frame.width, page.frame.height, page.layout, images]);
  const composite = signature && (source && (source.importSignature === signature || source.legacyImportSignature === signature) ? source.preview
    : embedded?.signature === signature && (mode === "prototype" || !source) ? embedded.image : undefined);
  const corrections = useMemo(() => {
    const result = new Map<string, string>();
    if (mode === "prefab") return result;
    for (const correction of source?.importCorrections ?? []) {
      const node = page.nodes[correction.index];
      if (node?.name === correction.name && node.imageData && images.get(node.imageData) === correction.original)
        result.set(node.id, correction.image);
    }
    return result;
  }, [source, page.nodes, mode, images, signature]);
  const checkerboard = !!(composite || embedded) && (!page.background || page.background === "transparent");
  const style: CSSProperties & { "--psd-scope-mask"?: string } = checkerboard ? {} : { background: page.background ?? "#ffffff" };
  if (composite && scopeCorners?.length) {
    const points = [...scopeCorners, scopeCorners[0]].map(p => `${p.x}px ${p.y}px`).join(", ");
    style["--psd-scope-mask"] = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${points})`;
  }
  return <div className={`page-surface${blocked ? " page-art-blocked" : ""}${checkerboard ? " checkerboard" : ""}`}
    data-psd-composite={composite ? true : undefined} style={style}>
    {composite && <img className="imported-psd-composite" src={composite} alt="导入 PSD 合成图" draggable={false} />}
    <ImportedImageCorrections.Provider value={corrections}>{children}</ImportedImageCorrections.Provider>
  </div>;
}
