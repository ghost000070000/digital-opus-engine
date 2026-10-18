# Phase 018 Report

## Outcome

One source Texture can now back many independent Sprite Assets, each selecting a creator-authored pixel rectangle. Manual and regular-grid workflows, cropped previews, natural size, pivot, sampling, rendering, Prefabs, Save/Load, pruning, and both export tiers all retain the same shared Texture ownership.

## Implementation

- Advanced Sprite Asset records to version 3 with an optional top-left-origin `sourceRect`; v1/v2 and missing-field records migrate to null/full image without visual change.
- Added strict rectangle validation that preserves metadata when the Texture is missing and reports source availability separately from region shape/bounds.
- Centralized region dimensions and pixel-to-WebGL UV conversion in authoring plumbing; editor Play and exported runtimes resolve the same helper through the existing Sprite synchronization path.
- Changed natural-size calculations and cropped thumbnails to use region dimensions while keeping pivot normalized to the region.
- Added numeric Source Region editing, source/region dimensions, full-atlas preview, drag and lower-right resize, Use Full Image, and grid slicing with Cell Width/Height, margin, and spacing.
- Added deterministic collision-safe bulk names and unique IDs. New regions inherit Texture, pivot, PPU, filtering, folder, and tags without image bytes.
- Added a base-level half-texel inset for Smooth explicit regions; Nearest remains exact. Texture-wide mip bleed at extreme Smooth minification is documented rather than hidden.
- Added `tests/phase-018-sprite-atlas.test.js`, a reproducible 4×4 atlas generator/fixture, dogfood evidence, and creator/runtime contracts.

## Compatibility and scope

Full-image Sprite Assets retain their exact historical UV scale/offset. Sprite instances and Prefabs still store only Sprite Asset identity, and the existing registry dependency closure includes one shared Texture once. Direct Texture Sprites, Billboards, Meshes, sorting, opacity, and filtering semantics remain unchanged.

No animation, playback, clip inference, atlas packing, runtime dynamic atlas, Tilemap, orthographic camera, or 2D physics was implemented.

## Verification

- Baseline HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`; branch `main`; unrelated dirty work preserved.
- Baseline engine build passed; baseline integrated suite passed at 604/604; required Phase 017 verdict was present.
- Phase 011–018 focused suites passed; Phase 018 adds 33/33 checks.
- Normal-editor dogfood passed: 4×4 import, 16-cell slice, region placement, arbitrary region, visual drag/resize, pivot, PPU, Smooth/Nearest, independent duplicate, validation, Prefab, Save/Load, Play/Stop, and both export tiers. See `phase-018-dogfood.json`.
- Browser console contained no errors or warnings.
- Final integrated build/tests passed at 637/637.
- Games passed at 28/28, 116.4 MB.
- Engine site passed path/link checks with 28/28 examples; editor package 1444 KB, total 217.6 MB.
- Games site passed path/link checks with 28/28 games, total 138.0 MB.
- No commit, push, deployment, DNS action, or game #29 was performed.

## Capability assessment

Sprites / 2D remains grade B. Reusable atlas regions materially improve breadth and authoring efficiency, but animation, orthographic/pixel-perfect cameras, Tilemaps, and 2D collision/physics remain absent.

## Verdict

`PHASE_018_SPRITE_ATLAS_READY`
