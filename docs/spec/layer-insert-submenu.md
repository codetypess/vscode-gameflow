# Layer Context Menu and Insert Submenu

Status: Done
Date: 2026-11-14
Scope: Add contextual layer editing commands and fold component choices into submenus

## 1. Context

The layer context menu currently lists all 16 component types above Delete, making a simple right-click menu nearly the height of the viewport. The user requested moving that list into a second-level menu.

The follow-up reference requests Copy, Paste, Rename, Duplicate, Delete, Convert Node Type and Replace Prefab in the first level, and removal of the redundant Rectangle insertion choice.

## 2. Goals

- Show contextual editing commands and one Add entry in the first level.
- Put 15 component choices in the Add and Convert submenus, retaining their labels/icons and insertion semantics.
- Support pointer, keyboard, viewport collision handling and existing locked-node rules.
- Implement session-local subtree copy/paste, inline rename and safe type conversion through normal undoable document edits.

## 3. Non-Goals

No new document schema, host protocol, system clipboard format or Prefab asset pipeline. Remove Rectangle from all creation/type-conversion choices; keep reading/rendering legacy rectangle nodes. New static list cells use Panel instead. Existing tree drag behavior is unchanged.

## 4. Current Behavior

`LayerMenu` uses a Popover with handwritten menu-key handling and a flat component list. Containers add children, ordinary controls add siblings, and the root/empty tree adds root controls. Delete acts on the right-clicked subtree. Parent locking disables insertion and inherited locking disables deletion.

## 5. Proposed Behavior

The first level shows a compact parent/page context label, `添加子节点` / `添加同级节点` / `添加节点` with a submenu arrow, and Delete when a node is targeted. The Add entry opens the component list on hover, click or ArrowRight. ArrowLeft returns from the submenu; Escape/outside click dismisses the menu, restores tree focus and preserves selection. Selecting a component closes both levels and uses the existing insertion callback. Locked actions remain disabled.

For a node, show Copy, Paste, Rename, Duplicate, Delete, Add, Convert Node Type and disabled Replace Prefab, separated into groups. Root/blank offers Paste and Add only. Copy captures a deep subtree snapshot without editing the document, including on locked nodes. Paste uses the same destination as Add (container children, ordinary-node siblings, or page root); it generates fresh reserved IDs, remaps parents, preserves child data and inserts after a targeted sibling. Its root uses the copied resolved local frame offset by 16px, with fixed size and cleared parent constraints. Clipboard is local to the editor session and can be pasted across pages. Empty clipboard/locked destination disables Paste. Ctrl/Cmd+C/V and existing Ctrl/Cmd+D work outside fields; F2 renames in the tree. Rename commits a trimmed non-empty name on Enter/blur, Escape cancels. Duplicate/Delete/Rename/Convert remain disabled on inherited locks. Duplicate also requires an unlocked destination parent.

Convert preserves ID/name/parent/style/content and child IDs; it reuses existing container-layout normalization, initializes target widget defaults and preserves existing widget fields. Converting a node with children to a leaf is disabled, as is conversion with a locked direct child. The current type is marked and disabled. No descendants are silently removed. Replace Prefab is disabled with a visible `未接入` note and explanatory title because no Prefab association/assets exist yet.

## 6. Design

Use Radix DropdownMenu primitives for controlled root visibility and a real Sub/SubTrigger/SubContent menu. Anchor the root to the existing right-click coordinates, restore focus through the existing callback, and retain menu-role isolation from canvas shortcuts. Use VS Code-themed local CSS for both levels; the submenu can flip to the left at the viewport edge and scroll when height is limited. This supersedes the old Popover-specific implementation choice in `layer-tree-context-drag.md`.

## 7. Implementation Plan

1. Add the Radix menu primitive and replace the flat menu with its add submenu.
2. Update scoped menu styles and the product baseline.
3. Build, run the existing suite and verify the browser interactions.

## 8. Testing Plan

Add focused shared-operation tests for copy snapshot isolation, subtree parent remapping, paste destination/locking/ordering, safe conversion and legacy rectangle compatibility. Run `npm test` plus `npm run build`. Verify compact menus, 15 choices without Rectangle, keyboard/back/escape, insertion/duplicate/paste/rename/conversion with undo, locked entries, and viewport placement in the browser.

## 9. Acceptance Criteria

- The first-level context menu exposes the requested editing commands and contextual Add/Convert submenus, without a flat component list or Rectangle creation entry.
- Pointer/keyboard submenu activation and dismissal work; selecting a component invokes the existing scope-correct insertion.
- Existing node locking, selection/focus and history behavior remain intact.
- Build, shared tests and browser checks pass; baseline and verification notes reflect the result.

## 10. Risks and Rollback

Submenu portals can interact with canvas keyboard/pointer handlers, so retain `[role=menu]` shortcut isolation and stop pointer bubbling. Revert the view and menu dependency to restore the flat list; no authored document migration is involved.

## 11. Verification

- `npm test`: all 86 shared tests passed, including snapshot isolation, parent/ID remapping, destination locking and safe conversion.
- `npm run build`: TypeScript, extension and Webview production build passed; Vite retains its existing bundle-size advisory.
- Browser at 877×852: 15 submenu choices without Rectangle, Add sibling insertion, Copy/Paste, Duplicate, inline rename/Enter/F2/Escape, type conversion with stable ID, undo, inherited lock disabling and child-preserving conversion checks passed. ArrowLeft/Right and Escape restored the tree focus without clearing selection. The root and submenu remained within the viewport near the tree bottom.
- Copy/Paste shortcuts are wired, but the browser automation intercepts clipboard key combinations; browser evidence for those operations uses their menu entries. Extension Host verification remains separate.
