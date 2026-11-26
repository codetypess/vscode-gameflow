import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ResourceMode } from "../../shared/image-slots";
import type { GameFlowPage } from "../../shared/model";
import type { PsdAsset } from "../../shared/psd-meta";
import type { PsdPaint } from "../../shared/psd-paint";
import { stringFingerprint } from "../../shared/string-fingerprint";
import { readImportSource } from "../psd/import-source";
import { isBrowserPreview } from "../vscode-api";
import { ImportedImageCorrections, ImportedPaint } from "./psd-paint";

export function ImportedPageSurface({ page, source, mode, blocked, children }: {
  page: GameFlowPage; source?: PsdAsset; mode: ResourceMode; blocked: boolean; children: ReactNode;
}) {
  const embedded = page.psdImportPreview;
  const legacy = !!embedded && !page.nodes.some(n => n.psdPaint);
  const key = JSON.stringify([page.id, embedded?.signature, embedded?.filename ?? page.name]);
  const [sibling, setSibling] = useState<{ key: string; asset?: PsdAsset }>();
  useEffect(() => {
    if (source || !legacy || isBrowserPreview || mode === "prefab") return;
    let active = true;
    void readImportSource(page.id).then(asset => { if (active) setSibling({ key, asset }); }, () => {});
    return () => { active = false; };
  }, [key, source, legacy, mode]);
  const candidate = source ?? (sibling?.key === key ? sibling.asset : undefined);
  const asset = !embedded || candidate?.importSignature === embedded.signature || candidate?.legacyImportSignature === embedded.signature ? candidate : undefined;
  const art = useMemo(() => {
    const parts = new Map<string, PsdPaint>(), corrections = new Map<string, string>();
    if (mode === "prefab") return { parts, corrections };
    const flags = asset?.importFlags;
    // Legacy files have no per-node PSD keys. Require the original tree, including sibling order.
    const aligned = flags?.length === page.nodes.length && flags.every((f,i) => f.name === page.nodes[i].name);
    for (const [i, node] of page.nodes.entries()) {
      const part = node.psdPaint ?? (aligned ? flags[i].paint : undefined);
      if (part) parts.set(node.id, part);
    }
    for (const c of asset?.importCorrections ?? []) {
      const n = page.nodes[c.index];
      if (n?.name === c.name && n.imageData && stringFingerprint(n.imageData) === c.original) corrections.set(n.id, c.image);
    }
    return { parts, corrections };
  }, [page.nodes, asset, mode]);
  const checkerboard = (!!embedded || !!asset?.importSignature) && (!page.background || page.background === "transparent") && mode !== "prefab";
  return <div className={`page-surface${blocked ? " page-art-blocked" : ""}${checkerboard ? " checkerboard" : ""}`}
    data-psd-components={art.parts.size || undefined} style={checkerboard ? undefined : {background: page.background ?? "#ffffff"}}>
    <ImportedPaint.Provider value={art.parts}><ImportedImageCorrections.Provider value={art.corrections}>
      {children}
    </ImportedImageCorrections.Provider></ImportedPaint.Provider>
  </div>;
}
