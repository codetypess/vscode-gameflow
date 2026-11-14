# Spec Index

## Purpose

`docs/spec/` is the repository's Specification-Driven Development entrypoint. It contains two kinds of documents:

- Numbered files: long-lived baseline specs that describe what the system should remain
- Non-numbered kebab-case files: work-item specs that describe one concrete change and how it will be verified

The complete workflow is defined in [../spec-driven-development.md](../spec-driven-development.md).

## Current Baseline

The repository now includes a runnable VS Code extension scaffold, a low-fidelity game UI prototype editor, PSD slice/nine-grid configuration and manual PSD selection previews. The baseline records document authority, the host/Webview boundary, canvas and layer editing, PSD metadata-only output and VS Code-themed controls; Agent integration, automatic planning-document analysis, complete PSD merging and Laya image export remain future work.

When the first non-trivial work item establishes a lasting rule, create the smallest relevant numbered baseline spec and add it to the baseline map below. Suggested numbers are conventions, not requirements:

| Number | Typical subject |
| --- | --- |
| `01` | Product scope and non-goals |
| `02` | Acceptance scenarios |
| `10` | Architecture and ownership boundaries |
| `11+` | Domain model, runtime, protocol, persistence, or editor semantics |
| `90` | Long-lived implementation constraints or sequencing |

## Baseline Map

| Spec | Subject |
| --- | --- |
| [01-product-workspace.md](01-product-workspace.md) | Planning workspace, infinite canvas, page groups and editing scope |
| [10-extension-architecture.md](10-extension-architecture.md) | Extension host, Webview, shared contracts, document authority and evolution boundary |
| [11-prototype-ui-layout.md](11-prototype-ui-layout.md) | Prototype UI components, shared layout geometry, edit semantics and v1/v2 persistence |

## Active Work Items

- [prototype-layaui-prefab-psd.md](prototype-layaui-prefab-psd.md) — Draft：原型布局与 LayaUI 对齐、新建/增量更新已有 Prefab、字段管理与冲突协调、PSD 导出/关联对照及美术回流；未替代当前实现基线。
- [psd-three-way-merge.md](psd-three-way-merge.md) — Draft：左侧两份 PSD 的图层树/预览、右侧合并结果；共同基础版本、逐节点采用、PSD 依赖和结果输出。

The completed [workspace-modes-psd-slicing.md](workspace-modes-psd-slicing.md) records three compact icon modes, real PSD import, slice/nine-grid configuration, same-name sidecars, metadata-only PSD copies and manual selection preview trees. Build, 35 shared tests, browser interactions and independent PSD output parsing passed. Extension Host/Photoshop validation and full merge/export delivery remain separate follow-ups.

The completed [prototype-ui-layout.md](prototype-ui-layout.md) adds 16 prototype components, shared LayaUI constraint/container layout, flow reorder and constraint-aware editing, plus v2 persistence preserving existing v1 identities. Build, 64 tests and browser editing checks passed; engine rendering, runtime binding and Prefab export remain follow-ups.

The completed [prototype-following-panels.md](prototype-following-panels.md) anchors prototype layer/properties panels to page edges using the shared PSD placement algorithm. It follows pan/zoom, clamps within the viewport and clears measured bottom controls. Build, 66 tests and browser pan/zoom, collapse, mode-switch, overview and narrow-window checks passed.

The completed [page-root-types.md](page-root-types.md) adds UIStack/UITop/UIScene page roots, standalone UIBox boards, editable root identity and component class labels. [prototype-panel-top-alignment.md](prototype-panel-top-alignment.md) sets prototype layer/properties widths to 280px each with content-top alignment and a 400px available-height threshold, plus compact visibility/lock spacing; the later adjustments passed 95 tests, build and browser checks. [prototype-layout-controls.md](prototype-layout-controls.md) adds checkbox constraint diagrams, read-only size sources, compact Padding and alignment icon groups. Initial build, 72 tests and browser creation, save/reload, layout editing and responsive checks passed.

The completed [psd-following-panels.md](psd-following-panels.md) adds wheel zoom and drag pan to the slice canvas, with equally wide layer/properties panels following the PSD while remaining inside the viewport. Build, 38 shared tests and browser interaction/resize checks passed.

The completed [psd-canvas-selection.md](psd-canvas-selection.md) adds direct canvas picking with transparent-pixel pass-through, synchronized tree/properties and separate click/drag gestures. Build, 41 shared tests and real PSD browser selection checks passed.

The completed [nanoid-element-ids.md](nanoid-element-ids.md) replaces handwritten generation with secure Nano ID: eight lowercase letters/digits, numeric first characters allowed. Existing prototype documents migrate page/control IDs and their references once, with a persisted scheme marker and normal undo/save ordering. All 82 tests, the production build and browser save/reload checks passed. It supersedes the generation and legacy-preservation policy in [stable-node-ids.md](stable-node-ids.md); uniqueness and stable identity after migration remain baseline rules.

The completed [document-element-id-uniqueness.md](document-element-id-uniqueness.md) closes cross-page and page/node collision gaps with document-wide identity validation for v1/v2, actionable conflict locations and rejection at parsing, serialization and edit-message boundaries. All 77 tests and the production build passed, including controlled copy collisions, retained session reservations and both checked-in samples.

The completed [compact-insert-menu.md](compact-insert-menu.md) shows all insert choices in two compact columns at common desktop sizes, with scrolling only when space is limited. [cyclic-canvas-grid.md](cyclic-canvas-grid.md) shares a world-anchored, density-cycling dot grid between prototype and PSD slice canvases. Build, 79 tests and browser menu/zoom/pan checks passed.

The completed [psd-metadata-sample.md](psd-metadata-sample.md) records a standalone layered PSD fixture, an offline inspector and two art-return checks: ordinary edits preserve metadata, duplication repeats IDs, and the tested layer merge loses metadata. The Draft PSD design now treats merged layers as new objects and manages identity from metadata only; production integration and broader compatibility remain unimplemented.

The completed [layer-tree-context-drag.md](layer-tree-context-drag.md) records context creation/deletion and subtree drag sorting/reparenting in the page layer tree; its lasting rules are incorporated in the product baseline.

The completed [layer-insert-submenu.md](layer-insert-submenu.md) groups 15 creation/type-conversion choices in submenus and adds Copy, Paste, Rename and Duplicate to the layer context menu. Rectangle remains readable but is no longer offered for creation. Replace Prefab is visibly unavailable pending asset integration. The 86 shared tests, production build and browser editing/undo/locking/menu checks passed.

The completed [layer-tree-search.md](layer-tree-search.md) adds current-page layer filtering by name, variable, type or ID, with ancestor paths, match counts, clear/Escape and preserved ordinary expansion state. The variable extension passed all 95 shared tests, production build and browser matching/selection/clear checks; earlier search/collapse/context-menu checks also passed.

The completed [node-variable-names.md](node-variable-names.md) adds optional v2 node variables below the renamed display-name field and shows saved variables beside node names in the layer tree. Shared validation checks binding syntax, reserved words and per-page conflicts; subtree copies allocate available variable names. All 95 shared tests, production build and browser validation/history/copy/lock/save-reload/label checks passed.

The completed [canvas-layer-selection-reveal.md](canvas-layer-selection-reveal.md) reveals canvas-selected prototype controls in the layer tree, expanding ancestors and minimally scrolling even for repeated picks of the same node. Search is retained when it includes the target and cleared otherwise. The 95 shared tests, production build and browser offscreen/collapse/repeat/filter/scroll regression checks passed; component automation remains unavailable.

The completed [constraint-offset-placement.md](constraint-offset-placement.md) aligns constraint inputs with their diagram guides, uses integer direct editing for geometry/layout fields, and converts anchor toggles from current geometry to preserve position and size. Final flow cross-axis removal preserves manual coordinates through optional v2 `crossAxisMode`; new-parent operations reset it. All 102 shared tests, production build and browser placement/toggle/unit/input/lock/history/narrow-panel checks passed; DOM component automation remains unavailable.

The completed [simplified-prototype-editor.md](simplified-prototype-editor.md), [extension-scaffold.md](extension-scaffold.md), [canvas-insert-toolbar.md](canvas-insert-toolbar.md), [canvas-navigation-inputs.md](canvas-navigation-inputs.md), [infinite-canvas-prototype.md](infinite-canvas-prototype.md) and [canvas-bottom-toolbar.md](canvas-bottom-toolbar.md) record implementation and prototype checks; their lasting rules are incorporated in the numbered baseline specs.

Add active work items as direct children of this directory using lowercase kebab-case names, for example:

- `docs/spec/editor-selection-regression.md`
- `docs/spec/save-lifecycle-regression.md`

Remove completed work items from this list after their lasting decisions have been incorporated into the relevant baseline specs. Git history remains the audit trail.

## Source Of Truth

When sources disagree, use this order unless a work-item explicitly documents a temporary transition:

1. The active work-item spec
2. The affected baseline spec
3. Stable contracts and public interfaces
4. Current implementation

Do not silently accept code as the intended behavior when it conflicts with a spec. Resolve the disagreement by updating either the implementation or the spec and record the decision.

## Reading Order

For non-trivial work:

1. Read [../spec-driven-development.md](../spec-driven-development.md).
2. Read this index and the affected numbered baseline specs, if any.
3. Create or update `docs/spec/<short-slug>.md`.
4. Fix the behavior, design, tests, and acceptance criteria before broad implementation.
5. Keep the work-item synchronized while implementation changes.
6. Update affected baseline specs when the result becomes a lasting rule.

For bug fixes, establish and record the root cause before patching. For tiny mechanical changes, a work-item spec is optional; add one if the scope expands.
