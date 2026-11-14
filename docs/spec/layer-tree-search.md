# Layer Tree Search

Status: Done
Date: 2026-11-14
Scope: Search the current page's prototype layer tree

## 1. Context

The user requested a search field between the layer heading and the page root. Large trees currently require scrolling and expanding branches manually.

## 2. Goals

Provide immediate name/variable/type/ID filtering, retain hierarchy context and keep matching nodes reachable inside collapsed branches.

## 3. Non-Goals

No canvas filtering, document changes, cross-page search or new dependencies.

## 4. Current Behavior

The layer tree renders every node subject to its local collapsed state. Selection, editing and dragging use stable IDs; there is no search UI.

## 5. Proposed Behavior

- Add a compact search field below the heading with a search icon, placeholder `搜索名称、变量、类型或 ID`, and an accessible clear button.
- Match case-insensitive substrings against node name, optional saved variable name, stable ID, internal type, Chinese component label or Laya class. Trim surrounding whitespace. Hidden and locked nodes remain searchable. Nodes without variables remain searchable by their other fields. Variable search follows the same match/ancestor/count/clear behavior; it does not alter the case-sensitive uniqueness rules for saved variables.
- Show direct matches and their ancestor paths, preserving sibling order and the page root. Unrelated descendants/branches are omitted. Matching paths initially expand, even if the ordinary tree is collapsed.
- Keep separate search-time expansion state so clearing restores the normal tree's collapsed state. Show matched/total counts; show `没有匹配的图层` for zero matches.
- Filtering does not change selection, canvas content, document history or persistent data. Search results retain node selection, rename, visibility/locking and context menus. Disable tree dragging while filtering to avoid ambiguous placement among omitted siblings, with a footer explanation.
- Clear button or Escape clears the query and retains input focus/selection. Typing in search must not trigger editor shortcuts. The field stays above the scrolling tree.

## 6. Design

A pure Webview helper derives matching/visible ID sets from the current page. `LayerTree` owns transient query and search-collapse state. Rendering uses existing node IDs, indentation, operations and ordering; no document/protocol fields are added.

## 7. Implementation Plan

1. Add filtering helper and compact search UI with hierarchy/collapse handling.
2. Cover hierarchy and matching behavior, update baselines.
3. Run tests/build and verify real browser interactions and keyboard isolation.

## 8. Testing Plan

Focused helper tests verify case-insensitive name/variable/ID/type matching, variable-only substring hits, optional variables, ancestor retention without unrelated descendants, hidden/locked nodes and whitespace/empty queries. Browser checks cover variable-only queries and updated placeholder, collapsed ancestors, selection/context menu, no matches, clear/Escape, shortcut isolation and fixed placement above scrolling content. Run `npm test`, `npm run build` and `git diff --check`.

## 9. Acceptance Criteria

The requested search field filters the tree immediately, shows matching paths and counts, and clears back to the original expansion state. Search does not edit the document or alter selection by itself. Build, tests and browser checks pass.

## 10. Risks and Rollback

Filtering hides siblings, so dragging is disabled until search clears. Separate expansion sets prevent a search from rewriting ordinary tree expansion. Revert the helper/UI and related styling to remove the feature; authored documents need no migration.

## 11. Verification

- `npm test`: all 89 shared tests passed, including matching aliases, case/whitespace normalization, ancestor paths, hidden/locked matches and empty results.
- `npm run build`: TypeScript, extension and Webview production build passed; the existing Vite bundle-size advisory remains.
- Browser at 877×852: searched by Chinese name, uppercase Laya class and uppercase ID; verified correct match counts and ancestor paths. A collapsed ancestor expanded during search and stayed collapsed after clearing. No-results text, clear-button focus, Escape without clearing selection, context menu actions and Backspace input isolation passed. The search field stayed at the same vertical position while the tree scrolled 636.5px.
- Search preserved the selected node and document content. Final preview shows `道具图标 6` with one match and its three ancestors. Screenshot saved as `gameflow-layer-search.jpg`.

### Variable Search Extension

- Updated the existing helper cases to cover full/partial variable names, case and surrounding whitespace, missing variables and hidden/locked variable-only matches with ancestor paths. All 95 shared tests, production build and diff checks passed.
- Browser: ` BTNITEM ` and `iTeM` both match only the existing `btnItem` variable (1/54), showing 任务道具 under 内容区 / 分类竖排. Search and Escape retain the original selection and camera; Escape restores the full 54-node tree. The placeholder includes 变量. Final search preview uses `btnItem`; no document data was edited. Screenshot: `gameflow-variable-search.jpg`.
