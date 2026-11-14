# Canvas Selection Reveals Layer

Status: Done
Date: 2026-11-14
Scope: Prototype canvas selection → current-page layer tree viewport

## 1. Context

Selecting a prototype control should make its corresponding layer row visible. The existing PSD canvas already supports this behavior; the prototype tree currently only synchronizes selection styling.

## 2. Goals

- Reveal a canvas-selected node in the left tree, expanding all collapsed ancestors.
- Support clicking the same node again after manually scrolling or collapsing its path.
- Scroll only as far as needed inside the tree; preserve canvas camera, focus and document state.

## 3. Non-Goals

No document/protocol changes, canvas hit-testing changes, tree navigation redesign or persistent scroll preferences.

## 4. Current Behavior and Root Cause

Browser reproduction at `http://127.0.0.1:5173/?sample=ui-components`: select the bottom-bar tree row to scroll down, hide the inspector so the canvas target is unobstructed, then click canvas node `ls7fv28t` (道具图标 6). The inspector and tree `aria-selected` both change to that ID, but tree `scrollTop` stays 1272.5. Its selected row remains at screen y=6.8–34.8 while the tree viewport is y=435.3–704.0. Correct IDs/highlight rule out a model-selection mismatch.

`App.startGesture` calls `selectNode`, which updates the selected ID. `LayerTree` uses that ID only for highlight/ARIA and owns collapse/scroll state without a selection-reveal handler. Thus the view boundary never expands the path or scrolls the selected row. Watching selected ID alone would also miss repeated picks of the same node.

## 5. Proposed Behavior

- Each direct canvas node pick requests a tree reveal, even when the selected ID is unchanged. Resize handles and canvas pan do not request reveals.
- Expand only the selected node's ancestor path, retaining unrelated collapsed branches.
- If a search excludes the target, clear that search so the target can be revealed. If it includes the target, retain the search and expand the filtered path. Typing/clearing search by itself still preserves selection.
- Once rendered, reveal the complete row using the smallest vertical tree scroll. An already visible row leaves scroll unchanged. Consume the request so subsequent edits, manual scrolling and collapsing do not pull the tree back.

## 6. Design

Use an ephemeral canvas-pick sequence in App, passed to LayerTree alongside the authoritative selected ID. LayerTree handles pending sequences in a layout effect: resolve filtering, expand ancestors, then measure the rendered row against its scroll container. Each state transition completes through React's normal layout lifecycle, without timers, DOM focus or `scrollIntoView` affecting outer containers. No edit/history transaction is created.

## 7. Implementation Plan

1. Record the confirmed reproduction and reveal contract (complete).
2. Add the canvas request and tree reveal lifecycle; update editor baseline.
3. Verify offscreen, collapsed, repeated, already-visible, filtering and ordinary scrolling behavior, then run existing checks.

## 8. Testing Plan

The repository runner bundles shared/model tests for Node and has no React DOM/component interaction harness. The root cause is UI wiring and post-expansion layout, so pure helper assertions would not reproduce it. Use actual browser interaction regression with DOM geometry checks; do not add a test-only DOM framework for this change.

Manual/browser regression: on the sample backpack page, scroll to the bottom bar, click an offscreen tree node's canvas representation and check selected ID and row bounds; scroll away and repeat the same canvas pick; collapse multiple ancestors and pick again; repeat with a search that includes/excludes the target. Check visible-row clicks retain scroll, manual collapse/scroll remains usable, blank/pan does not reveal, camera style and node/document counts stay unchanged. Run `npm test`, `npm run build` and `git diff --check`.

## 9. Acceptance Criteria

- [x] Canvas-selected row is rendered and fully inside the tree viewport.
- [x] Nested collapsed ancestors open; unrelated branches retain their state.
- [x] Same-ID repeat picks reveal again; already-visible picks do not jump.
- [x] Filtered and ordinary trees follow the stated search behavior.
- [x] Reveal leaves focus, camera, document/history and ordinary manual scrolling unaffected.
- [x] Existing tests, build and whitespace checks pass; browser regression evidence is recorded.

### Verification Results

- `npm test`: all 95 existing shared tests passed. `npm run build`: TypeScript checks and production builds passed; the existing Vite bundle-size advisory remains.
- Browser interaction regression used visible sample 道具图标 2 (`k9qob8wz`) at 30% canvas zoom. Starting at tree scroll 1222, a canvas pick revealed its row at the tree viewport top (y=384.8), scroll 508. Scrolling back down to 1222 and clicking the same icon returned to 508; a further already-visible click stayed at 508.
- Collapsed 道具 2, 道具网格 and 内容区 together, plus unrelated 标题横排. Canvas selection reopened all three ancestors and showed the selected row; 标题横排 stayed collapsed.
- Search `道具图标` remained active while its collapsed target path reopened. Search `标题` excluded the selected row; clicking the same canvas icon cleared it and revealed the row. Typing the query itself did not change the canvas selection.
- Manual scrolling stayed in place until another canvas pick. Resize-handle click, hand-tool click and blank-canvas click left tree scroll at 1166; blank click cleared selection. Canvas transform stayed `translate(205.631px, 235.799px) scale(0.298598)` throughout these interactions, node count stayed 54, and save status remained 已存于浏览器. Focus stayed on the prior zoom/tree control or body rather than jumping to the revealed row.
- UI regression was verified through real browser interactions and DOM bounds, not an automated component suite; the missing component harness and repeatable steps are documented in section 8.

## 10. Risks and Rollback

Expanding ancestors requires another React commit before row measurement; pending requests must survive that commit and be consumed afterward. A search may deliberately disappear when it excludes a canvas-picked control. Rollback removes only the ephemeral request and tree layout effect, leaving document data untouched.
