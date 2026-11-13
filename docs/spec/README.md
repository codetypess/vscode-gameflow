# Spec Index

## Purpose

`docs/spec/` is the repository's Specification-Driven Development entrypoint. It contains two kinds of documents:

- Numbered files: long-lived baseline specs that describe what the system should remain
- Non-numbered kebab-case files: work-item specs that describe one concrete change and how it will be verified

The complete workflow is defined in [../spec-driven-development.md](../spec-driven-development.md).

## Current Baseline

The repository now includes a runnable VS Code extension scaffold and a low-fidelity game UI prototype editor. The baseline records the document authority, host/Webview boundary, infinite canvas, page-only layer tree and VS Code-themed floating properties; Agent integration and automatic planning-document analysis remain future work.

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

## Active Work Items

The completed [layer-tree-context-drag.md](layer-tree-context-drag.md) records context creation/deletion and subtree drag sorting/reparenting in the page layer tree; its lasting rules are incorporated in the product baseline.

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
