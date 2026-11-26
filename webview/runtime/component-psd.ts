import { composeCanvasPage, type CanvasComposition } from "../../shared/canvas-instances";
import type { CanvasSources } from "../../shared/canvas-references";
import { type GameFlowDocument, type GameFlowPage } from "../../shared/model";
import { type ComponentPage, type ComponentPsdCheck, type ComponentPsdOutput } from "../../shared/page-psd-protocol";
import { psdComponentInstances } from "../../shared/page-sync";
import { resourceUuid } from "../../shared/prefab-export";
import { pagePsdFileName } from "../../shared/page-psd";
import { encodePsd, requestPsd, sourceBytes } from "./page-psd";
import type { ComponentPsd } from "./psd-smart-object";

export type ComponentPsdTarget = ComponentPage & { document: GameFlowDocument; page: GameFlowPage };

export function componentPsdTargets(document: GameFlowDocument, sources: CanvasSources, composition: CanvasComposition) {
  const targets = new Map<string, ComponentPsdTarget>();
  for (const id of psdComponentInstances(composition).keys()) {
    const instance = composition.info.get(id)!;
    const canvas = instance.source ?? "";
    const owner = canvas ? sources[canvas]?.document : document;
    const page = owner?.pages.find(item => item.id === instance.sourcePageId);
    if (owner && page) targets.set(id, { canvas, documentId: owner.documentId, pageId: page.id, page, document: owner });
  }
  return targets;
}

const targetKey = (target: ComponentPage) => JSON.stringify([target.canvas, target.documentId, target.pageId]);
const reference = ({ canvas, documentId, pageId }: ComponentPage): ComponentPage => ({ canvas, documentId, pageId });

export async function readComponentPsd(target: ComponentPsdTarget, purpose: "generate" | "review" = "review") {
  const binding = target.page.artPsd;
  if (!binding) return;
  const loaded = await requestPsd({ action: "review", pageId: target.pageId, expected: binding, component: reference(target) });
  if (!loaded) {
    if (purpose === "generate") return;
    throw new Error("组件 PSD 源文件不可用：" + binding.source);
  }
  if (loaded.asset.documentId !== binding.documentId) throw new Error("组件 PSD 关联已变化");
  const { sourceHash } = loaded.asset;
  const check: ComponentPsdCheck = { ...reference(target), binding, hash: sourceHash };
  const source: ComponentPsd = { name: loaded.asset.name, embeddedName: pagePsdFileName(target.page.name), bytes: sourceBytes(loaded.asset),
    origin: { documentId: target.documentId, pageId: target.pageId, psdId: binding.documentId, sourceHash, embeddedHash: sourceHash } };
  return { source, check };
}

export async function loadComponentPsds(targets: ReadonlyMap<string, ComponentPsdTarget>) {
  const results = new Map<string, NonNullable<Awaited<ReturnType<typeof readComponentPsd>>>>();
  const errors = new Map<string, string>();
  const reads = new Map<string, ReturnType<typeof readComponentPsd>>();
  for (const [nodeId, target] of targets) {
    const key = targetKey(target);
    if (!reads.has(key)) reads.set(key, readComponentPsd(target));
    try {
      const row = await reads.get(key);
      if (row) results.set(nodeId, row);
    } catch (error) {
      errors.set(nodeId, `${target.page.name}：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { results, errors };
}

export async function prepareComponentPsdGeneration(document: GameFlowDocument, sources: CanvasSources, composition: CanvasComposition) {
  const outputs: ComponentPsdOutput[] = [];
  const checks: ComponentPsdCheck[] = [];
  const generated = new Map<string, ComponentPsd>();
  const { generatePrototypePsd } = await import("./prototype-psd");
  const { psdContentHash } = await import("./psd-smart-object");
  async function collect(composition: CanvasComposition, ancestors: ReadonlySet<string>) {
    if (composition.errors.size) throw new Error([...composition.errors.values()][0]);
    const psds = new Map<string, ComponentPsd>();
    for (const [nodeId, target] of componentPsdTargets(document, sources, composition)) {
      const key = targetKey(target);
      if (ancestors.has(key)) throw new Error("检测到循环画布引用。");
      let source = generated.get(key);
      if (!source) {
        const existing = await readComponentPsd(target, "generate");
        if (existing) {
          source = existing.source;
          checks.push(existing.check);
        } else {
          const projected = composeCanvasPage(document, target.page, sources, target.canvas);
          const nested = await collect(projected, new Set([...ancestors, key]));
          const name = pagePsdFileName(target.page.name);
          const bytes = await generatePrototypePsd(target.document, projected.page, psdComponentInstances(projected), { referenceDocument: document, sources }, nested);
          const sourceHash = await psdContentHash(bytes);
          const psdId = resourceUuid(target.documentId + ":" + target.pageId + ":psd");
          source = { name, embeddedName: name, bytes,
            origin: { documentId: target.documentId, pageId: target.pageId, psdId, sourceHash, embeddedHash: sourceHash } };
          outputs.push({ ...reference(target), name, base64: encodePsd(bytes), missingBinding: target.page.artPsd });
        }
        generated.set(key, source);
      }
      psds.set(nodeId, source);
    }
    return psds;
  }
  const psds = await collect(composition, new Set([targetKey({ canvas: "", documentId: document.documentId, pageId: composition.page.id })]));
  return { psds, outputs, checks };
}
