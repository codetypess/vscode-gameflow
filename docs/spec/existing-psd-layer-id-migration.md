# Existing PSD Layer ID Migration

Status: Done
Date: 2026-11-24
Scope: One-time migration of checked-in sample/example GameFlow PSD layer UUIDs

## Context and goal

New GameFlow layer identities use eight lowercase alphanumeric Nano IDs, but the
login sample retains embedded UUID layer IDs. Migrate those existing identities
and every matching sample reference together, preserving document IDs, native PSD
IDs, artwork, configuration and already valid layer IDs.

## Design and implementation

Collect UUID layer identities from sample/example PSD GameFlow metadata and JSON
`layerId` fields. Allocate collision-free replacements with the shared allocator.
Patch PSD metadata using the binary metadata patcher; never re-encode pixels.
Replace matching identities throughout sample/example text references and refresh
any matching SHA-256 source fingerprints. This is an explicit asset migration;
ordinary editor load/save continues preserving external legacy identities.

## Verification and acceptance

- All migrated PSD identities match `[a-z0-9]{8}` and retain their references.
- PSD layer counts, native IDs, bounds and pixel payloads remain unchanged.
- Source fingerprints match the patched files; JSON remains parseable.
- A second migration is a no-op; shared tests and type checks pass.

## Risks and rollback

Untracked external references to the old sample IDs require the same mapping.
Store the old/new mapping in the migration report. Revert only this migration's
asset changes to roll back; retain unrelated working-tree edits.

## Results

- Migrated 15 UUID layer identities in the sample and example login PSDs, with
  matching sample GameFlow references and sidecar identities updated (four files).
- Refreshed both PSD SHA-256 fingerprints wherever present in scanned assets.
- Pixel payloads, merged previews, non-metadata blocks, native IDs and geometry
  passed byte/structure comparisons before writing. GameFlow validation passed.
- Repeat preview returned zero legacy identities and zero changes.
- `npm test`: 391 shared tests passed. `npm run check`: passed.
- Exact identity and fingerprint mapping is recorded in
  [existing-psd-layer-id-migration-report.json](existing-psd-layer-id-migration-report.json).
