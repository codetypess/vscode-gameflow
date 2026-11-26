import type { CanvasReference, GameFlowDocument, GameFlowNode, GameFlowPage } from "./model";
import type { CanvasSources } from "./canvas-references";
import { resolveCanvasSource } from "./canvas-references";
import { cellKey, resolveCellPage, resolvePrefabPage } from "./list-cell";
import { referencedCellUuids, planPrefabExport, prefabFileName, resourceUrl, type CellPrefabFile, type ExportImageResolver, type PrefabSnapshot, type PrefabTarget } from "./prefab-export";
import { inspectPrefab, prefabPreviewPage, prefabTarget } from "./prefab-sync";
import { prefabExportNameIssue } from "./prefab-export-name";
import { prefabExportPage } from "./prefab-node-export";
import type { PrefabPlan } from "./prefab-export";

type Snapshot = Pick<PrefabSnapshot, "prefab" | "hash" | "uuid" | "skins" | "metadata">;
type Inspect = (target: PrefabTarget) => Promise<Snapshot>;

function targetOf(document: GameFlowDocument, page: GameFlowPage): PrefabTarget {
  const saved = page.prefabSync?.target;
  if (!saved) return {name:prefabFileName(page), directory:document.exportDirectory};
  const parts = saved.split("/");
  return {name:parts.pop()!, directory:parts.join("/") || undefined};
}

/** Plan missing UIBox files alongside the page. Existing templates are read for preview and identity. */
export async function planListPrefabExport(document: GameFlowDocument, page: GameFlowPage, sources: CanvasSources,
  resolve: (page: GameFlowPage) => ExportImageResolver, inspect: Inspect, target: PrefabTarget, mode: "export" | "pull" = "export",
  bindImages: (doc:GameFlowDocument, page:GameFlowPage) => GameFlowPage = (_doc, page) => page) {
  const refs = new Map<string,CanvasReference>(), uuids = new Map<string,string>();
  const files: CellPrefabFile[] = [], previews = new Map<string,GameFlowPage>();
  const creating = new Set<string>(), owners = new Map([[prefabTarget(target).toLowerCase(), page.id]]);
  const snapshots = new Map<string,Snapshot>();
  const images = new Map<string,Awaited<ReturnType<typeof planPrefabExport>>["batch"]["images"][number]>();
  const missing: Awaited<ReturnType<typeof planPrefabExport>>["missing"] = [];
  async function snapshot(target: PrefabTarget) {
    const path = prefabTarget(target);
    if (!snapshots.has(path)) snapshots.set(path, await inspect(target));
    return snapshots.get(path)!;
  }
  function bind(ref: CanvasReference, uuid: string) {
    const key = cellKey(ref);
    if (refs.has(uuid) && cellKey(refs.get(uuid)!) !== key) throw new Error("多个引用画板具有相同的 Prefab UUID：" + uuid);
    refs.set(uuid,ref); uuids.set(key,uuid);
  }
  function rememberPreview(doc: GameFlowDocument, source: GameFlowPage, ref: CanvasReference, file: PrefabTarget, disk: Snapshot) {
    const review = inspectPrefab(doc,source,prefabTarget(file),disk.prefab!);
    const visual = prefabPreviewPage(review,review.comparison.psd,disk.prefab!,disk.skins);
    previews.set(disk.uuid!,{...visual,background:"transparent"});
    previews.set(cellKey(ref),previews.get(disk.uuid!)!);
  }
  const normalized = (ref: CanvasReference, containing: string): CanvasReference => ({...ref,source:resolveCanvasSource(containing,ref.source)});
  const uuidResolvers = (containing: string) => ({
    cell: (node: GameFlowNode) => uuids.get(cellKey(normalized(node.cellPrefab as CanvasReference,containing)))!,
    prefab: (node: GameFlowNode) => node.prefab ? uuids.get(cellKey(normalized(node.prefab,containing))) : undefined
  });
  async function dependency(input: CanvasReference, cellsOnly: boolean, containing = "") {
    const ref = normalized(input,containing), key = cellKey(ref);
    if (creating.has(key)) throw new Error("Prefab 模板循环引用。");
    const source = cellsOnly ? resolveCellPage(document,sources,ref) : resolvePrefabPage(document,sources,ref);
    if (uuids.has(key)) return;
    const canonical = source.document.pages.find(page => page.id === source.page.id) ?? source.page;
    const file = targetOf(source.document,canonical), path = prefabTarget(file).toLowerCase();
    if (owners.has(path)) throw new Error("引用画板的导出路径冲突：" + path);
    owners.set(path,key);
    const disk = await snapshot(file);
    if (!disk.uuid) throw new Error("无法读取引用模板 UUID：" + path);
    bind(ref,disk.uuid);
    const cell: CellPrefabFile = {...file,uuid:disk.uuid,hash:disk.hash,metaChanged:!disk.prefab || disk.metadata?.prefabMetaChanged};
    files.push(cell);
    if (disk.prefab) {
      rememberPreview(source.document,source.page,ref,file,disk);
      return;
    }
    creating.add(key);
    for (const node of prefabExportPage(canonical).nodes) {
      if (node.cellPrefab && "source" in node.cellPrefab) await dependency(node.cellPrefab,true,source.source);
      if (node.prefab) await dependency(node.prefab,false,source.source);
    }
    const resolvers = uuidResolvers(source.source);
    const exportPage = bindImages(source.document, canonical);
    const plan = await planPrefabExport(source.document,exportPage,resolve(exportPage),resolvers.cell,resolvers.prefab);
    cell.prefab = plan.batch.prefab;
    for (const image of plan.batch.images) images.set(image.path,image);
    missing.push(...plan.missing);
    const skins = Object.fromEntries(plan.batch.images.map(image => [resourceUrl(image.path),image.path]));
    rememberPreview(source.document,source.page,ref,file,{...disk,prefab:cell.prefab,skins});
    creating.delete(key);
  }
  if (mode === "pull") {
    const plan: PrefabPlan = {batch:{...target, prefab:{}, images:[]}, missing:[]};
    return {plan,refs,previews,locateDiskBindings};
  }
  const issue = prefabExportNameIssue(document, page, sources);
  if (issue) throw new Error(issue);
  for (const node of prefabExportPage(page).nodes) {
    if (node.cellPrefab && "source" in node.cellPrefab) await dependency(node.cellPrefab,true);
    if (node.prefab) await dependency(node.prefab,false);
  }
  const resolvers = uuidResolvers("");
  const exportPage = bindImages(document, page);
  const plan = await planPrefabExport(document,exportPage,resolve(exportPage),resolvers.cell,resolvers.prefab);
  for (const image of plan.batch.images) images.set(image.path,image);
  plan.batch.images = [...images.values()]; plan.missing.push(...missing);
  if (files.length) plan.batch.cells = files;
  // The engine may point to a different board than the current prototype.
  async function locateDiskBindings(root: Record<string,unknown>) {
    const wanted = referencedCellUuids(root);
    for (const visual of previews.values()) for (const node of visual.nodes) if (node.cellPrefab && "uuid" in node.cellPrefab) wanted.add(node.cellPrefab.uuid);
    for (const uuid of refs.keys()) wanted.delete(uuid);
    if (!wanted.size) return;
    const candidates = [{source:"",document},...Object.values(sources)].flatMap(entry =>
      entry.document?.pages.filter(p=>p.rootType==="UIBox").map(page=>({source:entry.source,document:entry.document!,page})) ?? []);
    // Each discovered template can itself introduce more prefab references.
    for (let before = -1; before !== refs.size && wanted.size;) {
      before = refs.size;
      for (const candidate of candidates) {
        const file = targetOf(candidate.document,candidate.page), disk = await snapshot(file);
        if (!disk.prefab || !disk.uuid || !wanted.has(disk.uuid) || disk.prefab._$id !== candidate.page.id) continue;
        const ref = {source:candidate.source,documentId:candidate.document.documentId,pageId:candidate.page.id};
        bind(ref,disk.uuid); rememberPreview(candidate.document,candidate.page,ref,file,disk); wanted.delete(disk.uuid);
        for (const nested of referencedCellUuids(disk.prefab)) if (!refs.has(nested)) wanted.add(nested);
        if (!wanted.size) break;
      }
    }
  }
  return {plan,refs,previews,locateDiskBindings};
}
