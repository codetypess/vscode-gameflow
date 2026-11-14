# Constraint Inspector Editing

Status: Done
Date: 2026-11-14
Scope: Prototype constraint input placement, integer editing and geometry-preserving toggles

## 1. Context and Confirmed Requirement

The user marked the diagram's right edge at the top guide and its bottom edge at the horizontal-center guide. They confirmed that the offset inputs should sit beside their corresponding guides: top/centerY/bottom on the right, left/centerX/right below the diagram.

Follow-up requirements: position/size/layout numeric controls display and accept integers. Enabling or disabling constraints must convert the current geometry and keep the control in place.

## 2. Goals

Make each enabled offset's location identify its constraint, while preserving the existing checkbox, numeric edit, unit, lock and parent-managed-axis behavior.

## 3. Non-Goals

No protocol or constraint priority changes. No document-wide migration or additional testing dependencies. A small optional layout field is needed to preserve manual cross-axis coordinates when the last anchor in HBox/VBox is removed.

## 4. Current Behavior and Cause

`ConstraintControl` renders six guides using fixed axis positions but flattens every enabled offset into a separate two-column `.constraint-values` grid below the map. This discards axis/position information at the rendering boundary. Values remain correctly bound to their layout keys, but their placement cannot track the guides.

Browser evidence before changes: with centerX=0 and top=12, diagram bounds were x=557–772, y=307.9–419.9. Both inputs began at y=444.9; horizontal-center input began at x=518 and top input at x=648.5. Thus top was below the diagram and centerX was left of its guide, matching the user's screenshot. Source bindings use the correct `item.key`; the layout solver is not responsible for this presentation mismatch.

Checkboxes previously wrote 0 on enable and null on disable, without inspecting resolved geometry. Enabling therefore snaps a node to an edge/center; disabling restores stale frame values or changes stretch sizing. The conversion belongs in a shared edit operation with access to the page, parent padding and resolved node, rather than in a checkbox's field-only patch. Generic number fields also accepted fractional drafts, and gesture edits retained fractional screen-to-world deltas.

An additional cause exists in flow containers: without cross-axis constraints the solver always applies parent alignment and ignores authored frame coordinates. Writing the current frame alone therefore cannot preserve a manually anchored cross-axis position when the last anchor is removed. Preserve this intent with optional `layout.crossAxisMode` (`aligned` by default, or `explicit` to use the frame on the flow cross axis). Managed main axes remain managed. Reset this override on reparenting, root paste and parent layout-type conversion so those operations retain their existing alignment behavior.

The focused regression failed before this extension: removing an HBox child's top=23 produced y=170 instead of y=23, proving that parent alignment was the remaining source of movement.

## 5. Proposed Behavior

- Keep horizontal checkboxes above and vertical checkboxes on the left.
- Place enabled top/centerY/bottom numeric inputs to the right, with input centers aligned to their horizontal guides.
- Place enabled left/centerX/right numeric inputs below, with input centers aligned to their vertical guides.
- Reserve stable direction slots so toggling one constraint does not move the other fields or diagram.
- Keep full accessible names and hover labels; remove the duplicate visible labels and the former two-column offset list.
- Preserve zero/negative values, Enter/blur commits, Escape restoration, px/% units, disabling and undo/redo through existing Field callbacks.
- Position, size, constraint offsets, Padding, gaps and static scroll controls show integers and round direct input commits. Page/node drag edits round changed positions/sizes to whole pixels. Rendering/layout calculations and automatic coordinate/unit conversions retain the precision needed to preserve geometry; existing documents are not migrated. Focusing/blurring an unchanged rounded display must not overwrite its precise underlying value.
- Toggle constraints using current resolved local bounds and parent content/padding, recalculating every remaining active constraint on that axis. Removing stretch fixes the current dimension as explicit; removing the last constraint writes the current local position into the frame. Keep existing center-priority behavior, inherited locks and managed-axis guards. Automatic percent conversion retains precision so an integer UI display does not cause a toggle to move the node.
- Removing the last HBox/VBox cross-axis anchor switches that child to explicit cross-axis positioning. It keeps the current frame instead of snapping back to parent alignment; subsequent numeric/drag edits remain available. Re-enabling an anchor clears the override. The optional field is validated and serialized with the v2 layout; absent values retain existing parent alignment.
- Fit the normal 280px inspector. At very narrow widths, scroll the diagram locally instead of overlapping inputs or expanding the inspector.

## 6. Design

Use a three-column/three-row map: vertical toggles, SVG, right offsets; horizontal toggles above the SVG and horizontal offsets below it. Derive checkbox and input percentages from the same descriptor positions used by SVG guides (180×112 viewBox). Reuse Field with hidden visual labels and existing ARIA names. Keep the diagram 112px tall and reserve a 48px right field column; a 220px minimum map width provides local scrolling when the inspector shrinks.

Add an opt-in integer mode to Field and a shared `setNodeConstraint` transaction for toggles. ConstraintControl emits a separate toggle callback rather than manufacturing zero/null patches. Direct geometry edits normalize changed coordinates at `editNodeFrame`; automatic inverse constraint offsets remain precise. The optional cross-axis mode is shared by the solver, editor, validator and JSON Schema, with new-parent boundaries clearing it. Pure tests cover toggle conversion and changed-coordinate rounding; browser checks cover integer input and directional layout.

## 7. Implementation Plan

1. Record the confirmed placement and current markup/geometry evidence.
2. Move fields into directional slots and synchronize the editor baseline.
3. Verify geometry and edit behavior in the browser, then run shared tests/build/diff checks.

## 8. Testing Plan

The existing runner tests the shared layout/constraint model in Node; no React DOM interaction harness exists. Add shared edit tests asserting unchanged resolved geometry across enable/disable sequences, percent/padded parents, stretch removal, lock/managed-axis guards and integer drag targets. Cover rendered field placement and integer draft/commit behavior with real browser interactions and DOM geometry rather than a pure test that mirrors CSS.

Browser regression: select a free-parent control with centerX/top enabled, ensure top input centerY equals the top guide and centerX input centerX equals its vertical guide; enable all six and check the equivalent mappings without overlap. Check zero and negative editing, checkbox disable/enable, undo, px/% and parent-managed-axis/locked disabled states. Restore temporary document edits. Check a narrow viewport for local scroll reachability and restore the normal viewport. Run `npm test`, `npm run build` and `git diff --check`.

## 9. Acceptance Criteria

- [x] All six offset inputs appear on the correct side and align within 1 CSS pixel of their guides.
- [x] Enabled fields are individually reachable with full accessible names and no overlap.
- [x] Normal and narrow inspectors fit; narrow map overflow scrolls locally.
- [x] Edits, checkbox toggles, units, disabled states and history retain their existing behavior.
- [x] Direct numeric edits and changed drag coordinates use integers; automatic conversions and unchanged input blur preserve geometry.
- [x] Enabling/disabling constraints preserves current control position and size through converted offsets and frame values.
- [x] Browser regression and existing automated/build checks pass; temporary test geometry is restored.

## 10. Risks and Rollback

The SVG stretches horizontally, so input positions must use its viewBox percentages rather than fixed CSS pixel offsets. Small panels require a local overflow fallback. Reverting map markup/styles restores the prior presentation. Before reverting cross-axis codec support, convert any saved explicit cross-axis frame to an equivalent leading anchor to avoid invalidating new documents or moving their controls.

## 11. Verification

- `npm test`: 102 shared tests passed. Seven focused tests cover all six anchor sequences, padded/percent parents, stretch removal, locks/managed axes, integer edit targets, final flow cross-axis removal and persistence, and mode cleanup/validation at parent boundaries. The flow test failed with the matching y=23→170 symptom before the mode fix.
- `npm run build`: passed TypeScript checks, extension bundling and production Webview build. Vite retains its existing large-chunk advisory. `git diff --check` passed.
- Browser at `?sample=ui-components`: all six directional inputs aligned with their guides with 0 CSS-pixel error. Enabled all six anchors and then removed each one; absolute bounds stayed x=260/y=116/w=60/h=60 throughout. Zero and negative offsets remained visible and correctly associated with their guides.
- Entered top=12.6→13 and W=60.6→61, then undid both edits. Pixel→percent unit conversion, unchanged rounded-input focus/blur and a percent anchor toggle preserved bounds. The 280px panel fit. At a 360px viewport, the local map had clientWidth=134/scrollWidth=220, and focusing the top field scrolled it fully into view at scrollLeft=86. The viewport override was reset.
- Verified all six controls disabled on an inherited-locked node, and only the vertical managed axis disabled for a VBox child. For that child, left=23 resolved to x=59; removing the last anchor kept x=59 and left X editable. A fresh-page run confirmed the new serialized mode was accepted and undo restored the anchor.
- The schema edit left the old browser-preview API closure using its previous validator during hot reload; refreshing loaded the new codec. Free-parent test edits were undone; the flow example's original x=36/y=262/w=128/h=42, no anchors, parent alignment and `btnItem` were restored through the normal parent selector. This normalizes its fallback frame/layout fields in browser preview only; checked-in sample data was not changed by this task. Final selection is 道具图标 1 with centerX=0/top=12 and its original bounds.
- No React DOM component test harness exists. Shared transaction behavior is automated; placement, input drafts, disabled controls and scroll/history interactions were checked in the real browser using the steps above. Final screenshot: `gameflow-constraint-editing.jpg` in the task visualization directory.
