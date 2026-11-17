# Canvas Component References

Status: Done
Date: 2026-11-17
Scope: reusable canvas components and linked instances within and across GameFlow files

## 1. Context

Nodes currently belong to one page and cannot be reused by reference. The user requests Laya-prefab-like ownership: saving a node to the canvas leaves a linked instance, source edits update references, and another module's canvas can supply a reference.

## 2. Goals

- Save an eligible UIBox subtree as an editable canvas component in one undo transaction, preserving an instance at its original position.
- Insert references to local canvas pages and pages in another `.gameflow.json` file.
- Resolve nested references, update from source edits, and show actionable missing/invalid/cyclic-source diagnostics.
- Preserve source identity, independent instance placement, ordinary history, save/reload and atomic selection.

## 3. Non-Goals

Laya `.lh`/`.ls` import/export, instance child overrides, automatic path repair after moving files, and unrestricted child editing inside an instance are outside this change.

## 4. Current Behavior

Canvas roots permit UIStack, UITop, UIScene and UIBox. Of the ordinary node types only `container` maps to one of those roots (UIBox). Existing documents use schema v1/v2/v3; the host owns document persistence and history.

## 5. Proposed Behavior

The layer context menu offers “存到画布” for one unlocked ordinary UIBox. Other node types receive a disabled action with the type restriction. Saving creates a UIBox board containing a cloned subtree and replaces the original subtree with one atomic linked instance retaining the original root ID and placement. Cross-boundary control bindings block extraction with a specific explanation.

The insertion menu lists the current file's canvas components/pages and offers “引用其他画布…”. A chosen source file supplies a page picker. All legal canvas root types can be referenced. Instances can move, resize, transform, rename, hide, lock and duplicate; their content and appearance are edited at the source. Inspector displays source and a source-navigation action. Missing sources preserve the instance and show an error placeholder. Direct selection also selects the whole instance.

Extracted component boards keep one UIBox root: page-level insertion/paste defaults inside that root, tree moves cannot move descendants outside it, and copying the root creates content inside the existing root. Root placement, dimensions and transforms are instance overrides; source child geometry, root appearance and content layout synchronize. Choosing a legacy external file completes the existing identity migration in an unsaved, undoable source edit before allocating references.

## 6. Design

- Schema v4 adds optional page `componentRootId` and node `prefab: { source, documentId, pageId }`. Empty `source` means the containing file; external sources are relative `.gameflow.json` paths. Runtime and JSON-schema validation agree; v1/v2/v3 remain readable.
- Extracted component boards contain an explicit ordinary UIBox root. Normal pages use a synthetic root when referenced. References own geometry/identity and source content stays authoritative. Instance dimensions override root dimensions, so source constraints/layout adapt to the instance.
- References store no descendant cache. A pure bounded projection expands definitions into temporary render nodes, remaps internal control IDs and maps every projected hit back to the owning real instance. Projection IDs never persist. Reference nodes cannot receive children or editing scopes.
- Source keys resolve relative to the referencing file, including nested dependencies. Source identity is checked against `documentId` and `pageId`. Cycles, depth and expansion limits yield diagnostics instead of recursion failures.
- Host dependency loading uses open text documents (including unsaved edits) before disk. File and text changes refresh the dependency closure; async epochs prevent stale results. The source registry is separate from authoritative document snapshots. Open-source navigation selects the source file in the custom editor.
- Browser preview imports user-selected file snapshots and persists imported sources locally; it explicitly describes reimporting for disk changes. Arbitrary filesystem reads/watch are host-only.
- Duplication and legacy ID migration remap component root metadata and same-document page targets where needed. Copying a reference preserves its target.
- Page identities use the existing secure 8-character lowercase-alphanumeric Nano ID allocator. A reference's `pageId` is exactly its source page's `id`, shared by every instance of that page. The two cross-module samples also use generated Nano IDs for their pages and matching cross-file targets.

## 7. Implementation Plan

1. Add model/schema, extraction, path resolution and bounded projection; exit with deterministic model tests.
2. Add protocol and host dependency loading/selection/navigation plus browser import fallback; exit with type checks and resolver tests.
3. Connect menu, inspector and rendering; exit with browser interaction checks.
4. Synchronize baselines and acceptance results.

## 8. Testing Plan

Focused tests cover legal extraction, forbidden types/locks/boundary bindings, identity and geometry preservation, reference-only persistence, nested local/external projection, source updates, missing/identity/cycle failures, internal control bindings, duplication/migration and protocol/session isolation. Run the existing full suite and production build. Browser checks cover extraction, editing the source, insertion, atomic selection, history and cross-file import. Record any unavailable Extension Host validation explicitly.

## 9. Acceptance Criteria

- Saving a UIBox creates an editable board and linked original in one transaction; non-canvas node types cannot be saved.
- Local and cross-file page references render source content, including nested dependencies, with independent placement.
- Source edits refresh instances; broken references remain selectable and display a reason.
- Instances have no editable projected descendants, even in direct selection.
- Save/reload and undo/redo preserve references and identities; v1/v2/v3 parsing remains compatible.
- Full tests and production build pass; concrete UI checks are recorded.

## 10. Risks and Rollback

Relative paths break when files move and are reported visibly. Expansion is bounded to avoid runaway graphs. Browser imports are snapshots and require reimport to follow disk edits. Schema v4 documents require this editor version; removing reference-bearing edits through history restores ordinary content before extraction.

## 11. Validation Results

- `npm test`: 200 tests passed. Coverage includes transformed/anchored/measured extraction, source ownership/layout updates, root-preserving editing, real sample dependencies, nested/cyclic/missing references, identity migration, bounds, protocol isolation and history.
- Host-controller tests use a VS Code adapter to verify dirty source TextDocuments, clean-file deletion/recreation, invalid JSON recovery, relative file selection/navigation, legacy source migration, stale async reads and disposal. A real Extension Host window was not manually exercised; these tests and browser checks do not claim that evidence.
- `npm run build`: type checks and production extension/Webview builds passed. Existing Vite bundle-size advisory remains.
- Browser at the authorized `http://127.0.0.1:5176/`: UIBox “存到画布” preserved original content/position, single undo/redo restored the subtree/instance, source navigation and text edits updated the original instance, insertion produced a second linked instance, and direct selection on projected text selected the owning instance. External File selection listed the shared module board, insertion displayed its content/source path without diagnostics, and save/reload restored both local and cross-file instances. Browser warning/error log was empty.
- Evidence: `canvas-cross-file-reference.jpg` in the task visualization directory. The browser source import is a snapshot; filesystem watching is exercised by host-controller tests.
