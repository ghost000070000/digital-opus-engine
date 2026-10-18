# Phase 018 Characterization

## Pre-change behavior

Sprite Assets selected an entire source Texture. Runtime UVs remained the mesh defaults, natural size always used the full Texture, and cards showed the whole image. A sprite sheet could only be reused by duplicating/cropping external image files or by instance UV fields that were not Sprite Asset metadata.

## Implemented boundary

Sprite Asset v3 adds an optional top-left-origin pixel rectangle. Old records canonicalize to null/full image with unchanged rendering. One registry-owned dependency still leads from every Sprite Asset to its one Texture. Natural size, previews, validation, duplication, persistence, and runtime UVs now resolve the region through shared helpers.

The inspector provides numeric Source Region fields, the source dimensions and region natural size, a cropped thumbnail, a full-atlas drag/resize editor, Use Full Image, and a regular grid slicer with margins and spacing. Bulk creation inherits pivot, PPU, filtering, folder, and tags; names and IDs are deterministic/non-overwriting.

## Orientation and filtering

The authoritative conversion handles the engine's flipped WebGL upload. Focused tests cover top-left, top-right, bottom-left, bottom-right, and center selections. Nearest uses exact region bounds. Smooth uses a half-texel inset for ordinary base-level use; atlas-aware mipmaps are deliberately not implemented, so extreme Smooth minification may bleed when the source lacks gutters.

## Normal-editor dogfood

At `http://127.0.0.1:8872/editor/index.html`, the normal editor imported the generated 128×128, 4×4 atlas fixture. The slicer previewed and created 16 named 32×32 Sprite Assets sharing one Texture. Six grid regions and a seventh atlas-backed Sprite were placed. A manual 40×24 region was authored at X=48/Y=12, changed to pivot 0.25/0.75, PPU 20, and Pixel / Nearest. It was duplicated; the duplicate changed independently to X=80 while the original remained X=48. The visual editor then dragged the original to X=60/Y=28 and resized it to 57×37 with numeric synchronization.

An atlas-backed Sprite Prefab named `AtlasCellPrefab` was created. Project Validation passed. Save/Load preserved all 18 Sprite Assets, the seven placed Sprites, the shared Texture, and Prefab. Play/Stop, Editable Export, and Playable Export all completed. Browser console errors/warnings were empty. Evidence is summarized in `phase-018-dogfood.json`.

## Scope

No animation clip, frame playback, packing, runtime atlas generation, Tilemap, orthographic camera, 2D physics, or game #29 was added. Sprites / 2D remains grade B.

