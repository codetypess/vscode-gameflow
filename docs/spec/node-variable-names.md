# Node Variable Names

Status: Done
Date: 2026-11-14
Scope: Optional program variable names in the inspector and layer tree

## 1. Context

The user requested renaming the inspector's `控件名称` label to `名称` and adding a `变量` field below it, containing a legal program variable name. Nodes currently have only a display name and stable ID.

## 2. Goals

Persist an optional editable variable name, validate it at UI/document boundaries and keep it independent of display name and identity.

## 3. Non-Goals

No generated code, Prefab export, automatic transliteration, page-root variable fields or backfilling existing documents.

## 4. Current Behavior

Inspector display-name edits use normal host transactions. v2 node fields are shared by the codec, protocol and JSON Schema. Duplicate/Paste clone whole subtrees; page copies have a separate page scope.

## 5. Proposed Behavior

- For controls, display `名称`, then `变量`, then geometry. Page properties retain `页面名称`.
- Store optional v2 node `variableName`; blank input removes it. Existing nodes start blank without migrations or ID changes.
- Use a portable ASCII JavaScript/TypeScript binding-name subset: `[A-Za-z_$][A-Za-z0-9_$]*`, excluding ECMAScript/strict-mode reserved words, literals, `await`, `yield`, `eval` and `arguments`. Contextual TS keywords that are valid bindings remain legal. Trim UI input before committing.
- Reject duplicate variable names within a page, case-sensitively; allow the same name in separate pages. Show validation feedback beside invalid drafts; do not commit invalid input. Enter/blur commits valid changes, Escape restores the saved value. Inherited locks disable editing.
- Renaming, moving, converting and ID migration preserve the variable. Duplicate/Paste reserve existing names and append `2`, `3`, etc. on conflict for each copied node. Page copies preserve names in their new scope. Generated controls start without variables.
- Save/reload, undo/redo and first-edit v1-to-v2 upgrading use existing document transactions. Raw v1 payloads containing this v2 field are rejected.
- In the layer tree, a saved variable appears beside the node's display name as a compact monospace label, for example `任务道具  btnItem`. Nodes without variables show only their display name. Long names/variables truncate within the row and expose full values in hover text; selection, collapse and visibility/lock controls retain their behavior. Variable edits, clearing and undo/redo update the label through the shared document state.

## 6. Design

Use a shared variable-name validator and allocation helper. Apply syntax and per-page uniqueness validation in the shared model, mirror syntax/reserved words and v2 gating in JSON Schema. A dedicated inspector field maintains invalid drafts and accessible inline feedback without changing other property fields.

## 7. Implementation Plan

1. Add model/schema validation and collision-safe copy/paste handling.
2. Add the renamed label and variable input with validation feedback.
3. Add focused boundary/history/copy tests, synchronize baselines and verify the browser.

## 8. Testing Plan

Cover legal/invalid/reserved identifiers, schema agreement, same-page versus cross-page uniqueness, codec/protocol rejection, optional legacy fields, variable-preserving operations, copy/paste collision naming and v1 edit/undo. Browser-check placement, valid/invalid/duplicate input, clearing, Escape, locks and save/reload. Check tree labels with/without variables, live edits/clear/undo, long text and narrow rows. This display-only extension uses browser interaction checks because the repository has no React DOM test harness. Run tests, production build and diff checks.

## 9. Acceptance Criteria

The node inspector shows `名称` with `变量` directly below. Saved variables also appear beside their node names in the layer tree and disappear when cleared. Only valid unique names reach persisted documents; blank clears the optional field. Existing identity and editing/history behavior remain intact. Tests, build and browser checks pass.

## 10. Risks and Rollback

Copying a bound node could create duplicate declarations, so all subtree-copy entrypoints allocate available names. The field is optional and v2-only. Reverting removes UI/validation support; authored documents with variables must remove the optional field to use older JSON Schema.

## 11. Verification

- `npm test`: all 95 shared tests passed, covering identifier/schema agreement, invalid/reserved names, per-page conflicts, codec/protocol rejection, optional legacy data, identity-preserving edits/migration, subtree-copy allocation and v1 upgrade/undo/clear.
- `npm run build`: TypeScript, extension and Webview production build passed; the existing Vite bundle-size advisory remains.
- Browser: `名称` and `变量` appear consecutively above geometry. Numeric/punctuation input, reserved `class` and an existing same-page variable show inline feedback and do not commit; Escape restores the saved value. Valid `bottomBar` survives undo/redo and save/reload while the display name and ID `7cmkyrnp` stay unchanged. A subtree duplicate receives `bottomBar2`. Locking disables both fields. Clearing, undo/redo and reload restore the optional empty state.
- Test-only copies, locks and variable values were reverted; the final preview retains 54 controls and an empty variable field with an example placeholder. Screenshot: `gameflow-node-variable.jpg`. Real Extension Host testing remains separate from browser preview evidence.

### Layer Tree Variable Labels

- `npm test`: 95 shared tests passed. `npm run build`: TypeScript and production builds passed; `git diff --check` passed.
- Browser: the user's existing 任务道具 variable `btnItem` appears beside its name, and clicking the label selects that node in the inspector. Unbound 道具图标 5 has no label. Long variable text truncates with ellipsis and exposes the full variable in hover text, without row overflow. Editing updates the label; clearing removes it; undo restores `btnItem`.
- At a 360px viewport, the row still fits without horizontal overflow and the variable stays before visibility/lock controls. Restored the default viewport and original `btnItem` value after temporary edit/clear checks. Screenshot: `gameflow-layer-variable.jpg`. Display behavior was verified through browser interactions; no automated component harness was added for this markup/style change.
