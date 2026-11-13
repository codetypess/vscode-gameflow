# Extension Architecture Baseline

Date: 2026-11-13
Status: Baseline for the initial extension scaffold

## Runtime Layers

1. VS Code extension host owns document IO, validation, commands, save/undo integration and Webview lifecycle.
2. React Webview owns presentation and local interaction state. It has no arbitrary filesystem access or extension secrets. Explicit user-selected PSD and sidecar Files are read through the browser File API; writes in VS Code remain host-owned.
3. `shared/` owns dependency-free document contracts, validation and host/Webview messages.
4. Build adapters stay at the boundary: esbuild for the extension host and Vite for the browser Webview.
5. The Webview uses local shadcn/ui component source and design tokens mapped to VS Code theme variables; runtime UI assets must not depend on a CDN.

## Document Rules

- A `*.gameflow.json` `TextDocument` is the initial persisted authority.
- Webview changes are candidate documents; the host validates them before applying a `WorkspaceEdit`.
- Parsing or validation failure must not overwrite source content.
- Document format is versioned. Stable IDs, world coordinates and page-local node coordinates are persisted independently.
- View-only state such as camera position and active tool is not required in the initial persisted document.
- New page/control identities use the shared allocator's 8-character Laya-style format (`[a-z][a-z0-9]{7}`). The editor reserves IDs across the current document and allocations seen during its session, including IDs later removed by delete/undo. Copies receive new IDs and remapped internal references; edits, parsing and serialization preserve existing IDs. The format is a creation policy, not a new validation restriction on saved v1 documents. IDs are scoped to a document/page, not globally unique resource UUIDs.

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
- `shared/psd-binary.ts` bounds PSD v1 parsing and patches only layer `shmd/gflw` metadata. It preserves other tagged data, channels, image resources and composite bytes without reconstructing artwork through a general PSD writer.
- PSD decoding uses pinned `ag-psd` in a bounded, transient Worker, with OffscreenCanvas image encoding and a 30-second timeout. The bundle is inline and the Webview CSP allows `worker-src blob:`; UI assets stay local.
- Host `psdOutput` requests contain a basename, kind, request ID and bounded base64 bytes. The host validates type/size, asks for the output path using the native save dialog, rejects dirty text-document overwrites, and returns a typed result. Webview messages cannot choose arbitrary paths. Browser preview downloads report only that the download was initiated.
- Canonical nine-grid settings are `metadata.slicing.nineGrid`. The original sample's legacy `metadata.slice` is read only when `slicing` is absent; legacy and other unknown fields remain preserved, and new consumers must prefer `slicing`.

## Future Document Evolution

The initial `CustomTextEditorProvider` and full-document edit are intentionally small. A future host session, fine-grained reducer or multi-view synchronization requires a new work-item spec when at least one is needed: concurrent Agent edits, multiple authoritative Webviews, independent history, external-change conflict resolution, or demonstrated whole-document performance problems. The v1 node model allows optional presentation fields (`style`, `imageData`, `hidden`, `locked`) and page background while keeping the TextDocument authoritative; the Webview does not accept remote image URLs or arbitrary commands.
