# Default Image Nine-Grid Resource

Status: Done
Date: 2026-11-24
Scope: The built-in `image/default` resource used by prototype, PSD and Prefab flows

## 1. Context

The built-in default image currently has a special renderer that separates its background and icon at runtime. Prefab export also creates size-specific files such as `default_120x480.png` so the placeholder can be rasterized at each layout size. This makes one logical default image produce many files and gives the default resource a different rendering path from other images.

## 2. Goals

- Use one ordinary `builtin/image/default.png` resource for every layout size.
- Mark the resource with a valid nine-grid configuration and carry that configuration through the built-in catalog, PSD metadata, Prefab resource manifest and Laya importer metadata.
- Render the default image through the same nine-grid path as other built-in images.
- Use the original gray-blue landscape icon with the rounded frame, sun and mountain peaks.

## 3. Non-Goals

- Do not add a new document field or runtime protocol.
- Do not generate one default PNG per node or per layout size.
- Do not alter artist PSD resource sizing or the existing nine-grid algorithm.

## 4. Current Behavior

`image/default` is intercepted by `paintBuiltin`, which redraws its background and centered image glyph. Prefab planning creates a size-specific path and asks the resolver to rasterize the glyph at the node's resolved size. The built-in catalog has no nine-grid value for this resource.

## 5. Proposed Behavior

`image/default` is a 64×64 built-in PNG with a 32×28 landscape icon placed 6 pixels from the top and left. The prototype canvas, generated PSD, Prefab export, disk preview and target importer use the same PNG and non-repeating nine-grid metadata.

## 6. Design

- `builtinPath` resolves each built-in by ID. The default resolves to `builtin/image/default.png`.
- Prototype nodes and PSD generation call the ordinary `paintSlice` renderer.
- Prefab planning adds built-in PNG data directly to the image batch. The resolver remains for artist resources only.
- Built-in PSD recognition and export use the catalog dimensions and PNG for `image/default`, even when a generated prototype layer was rasterized at page geometry.
- The 38×34 top-left patch contains the entire landscape. Its edges align with x=38 and y=34 in the source PNG. All stretchable pixels are the solid gray background.
- Small PSD raster layers keep valid local guides with at least one center pixel. Their exported PNG uses the catalog guides.
- A legacy PSD layer can reuse the shared PNG when its original catalog fingerprint, pixel hash, region and guides match. Existing Prefabs can switch a size-specific skin to the shared UUID after its importer, ledger and PNG agree. Old exported files remain available to other Prefabs.

## 7. Implementation Plan

1. Update the generator, PNG asset and catalog entry with the new glyph and nine-grid value.
2. Remove size-specific default paths, rasterization and placeholder planning from shared and Webview export/resource code.
3. Exercise old example data as a compatibility fixture and verify new export metadata.
4. Update the affected baseline specifications and verify type checking, shared tests, production build and default-image browser checks.

## 8. Testing Plan

- Assert `imageSlotRequest` always returns `builtin/image/default.png`, regardless of requested dimensions.
- Assert Prefab planning deduplicates repeated default images into one image batch entry and carries the catalog nine-grid.
- Assert generated PSD and Prefab exports use the catalog PNG and nine-grid metadata.
- Assert disk resource loading and importer metadata use the shared default path.
- Run `npm run check`, `npm test`, `npm run build` and the default-image browser check.

Compare the whole rendered bitmap with the original landscape glyph at its top-left inset for square, wide and portrait controls. The browser round trip includes fractional and narrow layers, the original Star Sea PSD and disk Prefab preview.

## 9. Acceptance Criteria

- No generated or planned path contains a `default_<width>x<height>.png` suffix.
- A page with multiple default images of different sizes exports one `builtin/image/default.png` resource.
- The default resource has `{ top: 34, right: 0, bottom: 0, left: 38, repeat: false }` in the catalog, manifest and importer metadata.
- Prototype, PSD and Prefab rendering use the ordinary nine-grid renderer and do not invoke the former separated background/icon renderer.
- Existing artist-bound image behavior remains unchanged.

## 10. Risks and Rollback

For controls narrower than 38 pixels or shorter than 34 pixels, the ordinary engine nine-grid compresses the corner along the constrained axis. Earlier generated PSDs carry their original catalog fingerprint and guides.
