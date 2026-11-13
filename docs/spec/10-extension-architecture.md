# Extension Architecture Baseline

Date: 2026-11-12
Status: Baseline for the initial extension scaffold

## Runtime Layers

1. VS Code extension host owns document IO, validation, commands, save/undo integration and Webview lifecycle.
2. React Webview owns presentation and local interaction state. It never accesses the filesystem or extension secrets.
3. `shared/` owns dependency-free document contracts, validation and host/Webview messages.
4. Build adapters stay at the boundary: esbuild for the extension host and Vite for the browser Webview.
5. The Webview uses local shadcn/ui component source and design tokens mapped to VS Code theme variables; runtime UI assets must not depend on a CDN.

## Document Rules

- A `*.gameflow.json` `TextDocument` is the initial persisted authority.
- Webview changes are candidate documents; the host validates them before applying a `WorkspaceEdit`.
- Parsing or validation failure must not overwrite source content.
- Document format is versioned. Stable IDs, world coordinates and page-local node coordinates are persisted independently.
- View-only state such as camera position and active tool is not required in the initial persisted document.

## Protocol Rules

- Raw messages use discriminated unions shared by host and Webview.
- Webview first sends `ready`; host answers with `init` or `documentError`.
- Accepted edits produce normal TextDocument changes, and the host then broadcasts a fresh `documentChanged` snapshot.
- Webview keeps one candidate edit in flight and replaces a queued candidate with the latest state. Save/undo/redo are serialized after the edit acknowledgement and complete with an explicit fixed action message; duplicate document snapshots are not command acknowledgements.
- The protocol contains no arbitrary command execution or filesystem path supplied by Webview.

## Evolution Boundary

The initial `CustomTextEditorProvider` and full-document edit are intentionally small. A future host session, fine-grained reducer or multi-view synchronization requires a new work-item spec when at least one is needed: concurrent Agent edits, multiple authoritative Webviews, independent history, external-change conflict resolution, or demonstrated whole-document performance problems. The v1 node model allows optional presentation fields (`style`, `imageData`, `hidden`, `locked`) and page background while keeping the TextDocument authoritative; the Webview does not accept remote image URLs or arbitrary commands.
