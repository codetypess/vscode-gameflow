# Extension Architecture Baseline

Date: 2026-11-14
Status: Baseline for the initial extension scaffold

## Runtime Layers

1. VS Code extension host owns document IO, validation, commands, save/undo integration and Webview lifecycle.
2. React Webview owns presentation and local interaction state. It has no arbitrary filesystem access or extension secrets. Explicit user-selected PSD and sidecar Files are read through the browser File API; writes in VS Code remain host-owned.
3. `shared/` owns document contracts, validation, ID allocation and host/Webview messages. Secure Nano ID is its runtime package dependency for identity generation.
4. Build adapters stay at the boundary: esbuild for the extension host and Vite for the browser Webview.
5. The Webview uses local shadcn/ui component source and design tokens mapped to VS Code theme variables; runtime UI assets must not depend on a CDN.

## Document Rules

- A `*.gameflow.json` `TextDocument` is the initial persisted authority.
- Webview changes are candidate documents; the host validates them before applying a `WorkspaceEdit`.
- Parsing or validation failure must not overwrite source content.
- Document format is versioned. Stable IDs, world coordinates and page-local node coordinates are persisted independently.
- Optional v2 `page.rootType` identifies UIStack, UITop, UIScene or a standalone UIBox component board. Missing values are interpreted as UIStack without normalizing saved content. Root type is independent of `kind` (screen/modal); v1 rejects explicit rootType, and the existing first-edit upgrade preserves IDs and supports undo.
- Optional v2 `node.variableName` is independent of display name and identity. Shared validation enforces portable ASCII JS/TS binding syntax, excludes reserved/strict binding words and rejects case-sensitive duplicate variables per page with both paths. JSON Schema mirrors syntax/reserved words and rejects the field in v1; normal editor transactions upgrade v1 on the first variable edit. Subtree duplicate/paste allocates available variable names in the target page, while page copies retain their own scope. No runtime bindings or generated code are implied by the stored field.
- View-only state such as camera position and active tool is not required in the initial persisted document.
- Prototype and PSD slice canvases share `CanvasDots` and `webview/lib/canvas-grid.ts`. Dot spacing cycles between 24px inclusive and 48px exclusive at power-of-two zoom levels, with constant screen-space dot size and bounded background offsets anchored at world zero. Grid geometry is decorative and never changes authored coordinates, snapping or saved data.
- Prototype and PSD panels share `webview/lib/canvas-panels.ts` for screen-space anchoring and viewport limits. The prototype observes viewport, panel and bottom-control bounds; its panels follow the current page, independently of node selection. Panel geometry never enters document transactions or undo history.
- Prototype panels opt into `minFollowHeight: 400`: top follows the page while available height shrinks, then stops to retain 400px (bounded by the viewport). Both widths are 280px before responsive shrinking. PSD omits the option and retains its existing measured-height placement.
- New page/control identities use secure Nano ID `customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)`, matching Laya's length while permitting numeric first characters. The editor reserves IDs across the current document and allocations seen during its session, including IDs later removed by delete/undo. Copies receive new IDs and remapped internal references. All page and node IDs share one document-wide namespace: shared validation rejects duplicates and reports both JSON paths without renumbering, protecting parsing, serialization and edit messages. Cross-document identity includes documentId plus element ID; pageId can locate the owning page. Eight-character IDs are not globally unique resource UUIDs.
- The optional v1/v2 `elementIdScheme` accepts only `"nanoid-8"`. New documents and migrated samples carry it. On the first valid editor init, DocumentSession calls the validated shared migration helper for an unmarked document: reserve old identities, allocate all page/control IDs, rewrite parentId and page-navigation endpoints, and add the marker. It submits one normal `edit` transaction, including the existing v1-to-v2 first-edit upgrade. Host acknowledgement/save ordering and undo apply as usual; repeated init, snapshots and undo in that session do not rerun migration. A marked document is a no-op on reload. Codec functions remain pure and retain legacy identities; only the migration transaction changes them. Document/requirement/interaction IDs are unchanged, and unsupported markers or ambiguous inputs fail validation before allocation.

## Protocol Rules

- Raw messages use discriminated unions shared by host and Webview.
- Webview first sends `ready`; host answers with `init` or `documentError`.
- Accepted edits produce normal TextDocument changes, and the host then broadcasts a fresh `documentChanged` snapshot.
- Webview keeps one candidate edit in flight and replaces a queued candidate with the latest state. Save/undo/redo are serialized after the edit acknowledgement and complete with an explicit fixed action message; duplicate document snapshots are not command acknowledgements.
- The protocol contains no arbitrary command execution or filesystem path supplied by Webview.

## PSD Session Boundary

- PSD sessions are separate from the prototype TextDocument and never replace its JSON authority. Both PSD workspaces remain mounted while switching modes; they do not persist imported bytes across Webview reloads.
- The slice canvas owns its view-only camera. Side panels use screen-space bounds derived from the PSD camera and measured viewport/panel sizes; they are not part of the scaled artwork. Hidden zero-size observations are ignored, and panel actions do not start canvas gestures. Camera changes never dirty PSD metadata or enter configuration undo history.
- Canvas picking maps screen coordinates through the camera and respects the decoded top-to-bottom layer order. Text-layer classification and lazily cached one-bit PNG alpha masks are transient view data, excluded from sidecars and PSD patches. A request counter prevents deferred pixel decoding from replacing a newer selection or gesture.
- `shared/psd-meta.ts` owns slice settings, identity checks, sidecar import/export and manual merge selection trees. Raw source hashes permit restoring identities only for the exact same imported bytes; changed files match scoped metadata IDs.
- Newly assigned/repaired GameFlow PSD layer identities use the same eight-character Nano ID allocator. Existing embedded PSD identities and native numeric IDs are not subject to prototype document migration.
- `shared/psd-binary.ts` bounds PSD v1 parsing and patches only layer `shmd/gflw` metadata. It preserves other tagged data, channels, image resources and composite bytes without reconstructing artwork through a general PSD writer.
- PSD decoding uses pinned `ag-psd` in a bounded, transient Worker, with OffscreenCanvas image encoding and a 30-second timeout. The bundle is inline and the Webview CSP allows `worker-src blob:`; UI assets stay local.
- Host `psdOutput` requests contain a basename, kind, request ID and bounded base64 bytes. The host validates type/size, asks for the output path using the native save dialog, rejects dirty text-document overwrites, and returns a typed result. Webview messages cannot choose arbitrary paths. Browser preview downloads report only that the download was initiated.
- Canonical nine-grid settings are `metadata.slicing.nineGrid`. The original sample's legacy `metadata.slice` is read only when `slicing` is absent; legacy and other unknown fields remain preserved, and new consumers must prefer `slicing`.

## Future Document Evolution

原型 UI 文档已演进至 schemaVersion 2：新增类型化 layout/widget 字段，兼容读取 v1，首次有效编辑由 DocumentSession 在原事务升级，不改写已有 ID。布局解算、编辑意图与字段验证分别由 shared/ui-layout.ts、ui-edit.ts、ui-config.ts 负责；DOM 只呈现解算几何。计算结果不是第二份文档权威。详细规则见 [11-prototype-ui-layout.md](11-prototype-ui-layout.md)。

The initial `CustomTextEditorProvider` and full-document edit are intentionally small. A future host session, fine-grained reducer or multi-view synchronization requires a new work-item spec when at least one is needed: concurrent Agent edits, multiple authoritative Webviews, independent history, external-change conflict resolution, or demonstrated whole-document performance problems. The v1 node model allows optional presentation fields (`style`, `imageData`, `hidden`, `locked`) and page background while keeping the TextDocument authoritative; the Webview does not accept remote image URLs or arbitrary commands.
