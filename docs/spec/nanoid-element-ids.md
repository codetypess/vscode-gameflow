# Nano ID Element Identities

Status: Done
Date: 2026-11-14
Scope: Nano ID generation and migration of existing prototype page/control identities

## 1. Context

The user requested replacing the handwritten generator with Nano ID, migrating existing IDs, matching Laya's eight-character length, and using lowercase letters/digits with no first-letter restriction. The current shared allocator serves prototype pages/controls and newly assigned GameFlow PSD layer identities. Both prototype samples and browser-local saved documents contain legacy IDs with the same syntax as the target format, so syntax alone cannot identify completed migration.

## 2. Goals

- Use secure `nanoid.customAlphabet` for 8 characters matching `[a-z0-9]{8}`, including numeric first characters.
- Convert existing prototype page/control IDs and their references, including the checked-in samples and browser-saved documents.
- Keep migrated identities stable through editing, save/reload and history; retain document-wide uniqueness and collision retries.

## 3. Non-Goals

- No changes to documentId, requirement IDs, interaction IDs, resource UUIDs or PSD native numeric IDs.
- Do not rewrite embedded identities in external PSD files or the historical PSD metadata fixture.
- No Prefab exporter or schema-version bump. The optional `elementIdScheme: "nanoid-8"` marker records completed migration within v1/v2.

## 4. Current Behavior

`shared/element-id.ts` manually samples random integers into `[a-z][a-z0-9]{7}`. An occupied-ID set and 128 bounded retries prevent duplicate allocations. Document validation rejects duplicate page/control IDs. Reading/serializing is currently identity-preserving, and DocumentSession submits validated full-document transactions to the host.

## 5. Proposed Behavior

New allocations use `customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)`. All eight positions can be a lowercase letter or digit. The same shared generator also supplies newly allocated PSD layer IDs; existing embedded PSD IDs remain opaque and retain their identity.

On the first valid editor initialization, prototype documents without `elementIdScheme: "nanoid-8"` migrate all page/control IDs in one normal undoable document transaction, including legacy IDs that already have eight characters. The browser preview persists the accepted transaction to its existing storage key. VS Code marks the document dirty and persists it through normal save. Parsing/serialization remain pure and accept old valid IDs, allowing undo and invalid-source protection. Subsequent snapshots, acknowledgements, undo and refresh responses in the same session do not trigger another migration.

The migration reserves all original IDs, allocates fresh IDs for every element, rewrites node.parentId and interaction.fromPageId/toPageId, writes the scheme marker, and preserves all unrelated fields. Validated duplicate identities and unsupported scheme markers fail before allocation. Re-running migration on a marked document is a no-op. Newly created documents have the marker immediately. Checked-in `.gameflow.json` samples are migrated with the same helper.

## 6. Design

- Keep `allocateElementId` and its reserved-set API; replace its default source with secure Nano ID customAlphabet and validate generated candidates against `[a-z0-9]{8}`.
- Add a shared document migration helper with an injectable candidate source for deterministic collision tests. Reserve all original IDs before generating replacements.
- Invoke migration once in DocumentSession after the first valid init, through `edit`, so the host remains the persisted authority and history/save ordering remains intact. The existing v1 first-edit upgrade applies atomically to this transaction.
- Match Laya's eight-character length without adopting its first-letter restriction; future Prefab mapping must validate the target format/scope and retain explicit mappings where needed.

## 7. Implementation Plan

1. Add Nano ID and replace generation; exit when all creation/copy paths use it.
2. Implement/test reference-preserving migration and session integration; migrate samples.
3. Update the product/architecture baseline and superseded design references.
4. Run the shared suite and production build, then verify the existing browser preview displays migrated IDs and retains them after reload.

## 8. Testing Plan

- New document and copy IDs match the new format, remain unique and have intact references.
- Deterministic collisions skip occupied values, reserve immediately and fail after 128 attempts.
- Unmarked v1/v2 documents migrate without mutation, including preexisting eight-character IDs; preserve unrelated content, remap parents/page navigation, survive serialization/protocol validation and are idempotent using the marker.
- Duplicate documents fail before migration; session migration waits for acknowledgement before save and respects undo/reinit without repeated migration.
- Both samples contain only migrated page/control IDs; newly repaired PSD identities round-trip through sidecars and PSD metadata without rewriting other layers.
- `npm test`, `npm run build`, and browser save/reload inspection.

## 9. Acceptance Criteria

- Handwritten random generation is removed in favor of the secure Nano ID dependency.
- Existing sample and browser prototype IDs are migrated, references remain valid and reload does not change the migrated IDs.
- Existing IDs are changed only by the explicit migration transaction; ordinary parse/edit/history/save operations preserve identity.
- All checks pass and baseline docs describe Nano ID plus the one-time migration.

## 10. Risks and Rollback

Rekeying legacy prototype IDs invalidates any external ad hoc references to them. No production PSD/Prefab binding is currently implemented; external PSD identities are outside this migration. The transaction is undoable, and checked-in sample changes can be reverted. Keep the dependency lockfile and browser/Node bundles verified together because Nano ID is used in both runtimes. Do not roll back by automatically shortening already migrated IDs.

## Verification

- `npm test`: all 82 shared tests passed. Coverage includes lowercase/digit-only generation, numeric first characters, collisions/retry exhaustion, all-element legacy migration in v1/v2, intact hierarchy/navigation, unsupported markers, pure codec round-trips and session save/undo/redo/reload behavior.
- `npm run build`: host/Webview type checks and production bundles passed. The existing Vite bundle-size advisory remains.
- Migrated 11 elements in `sample/backpack.gameflow.json` and 68 in `sample/ui-components.gameflow.json`, updating modeled references while preserving sample content/formatting.
- Existing browser preview migrated its locally saved prototype. The previously shown title control now has ID `1mv5mzry`, demonstrating numeric-first support; save/reload retained exactly the same ID and the existing hierarchy/layout.
- Browser verification covers the real Webview UI and its local persistence adapter. A real Extension Host migration/save session was not manually exercised; transaction ordering is covered by the shared DocumentSession tests.
