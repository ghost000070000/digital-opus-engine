# Sprite Material Presentation Contract

## Ownership

A Sprite Asset owns reusable sampling intent. A Sprite Renderer owns per-instance tint, opacity, visibility, geometry, and sorting. The source Texture remains the only owner of encoded image bytes, decoded image state, and its WebGL texture handle.

Two Sprite Assets may reference the same Texture while selecting different sampling modes. This does not clone the data URL, decoded image, upload, or GPU texture. The renderer selects one of two cached WebGL2 sampler objects when drawing each entity.

## Bounded controls

- **Sampling: Smooth** stores `filtering: "linear"` on the Sprite Asset. It uses `LINEAR_MIPMAP_LINEAR` minification and `LINEAR` magnification, matching the historical Texture upload behavior.
- **Sampling: Pixel / Nearest** stores `filtering: "nearest"`. It uses `NEAREST` for minification and magnification so scaled texels retain hard transitions. It deliberately samples the base level instead of mipmaps.
- **Opacity** stores a finite value from 0 through 1 on the Sprite Renderer. It defaults to 1 and multiplies source texture alpha through the existing `u_alpha` path.
- **Tint** remains the per-instance RGB multiplier. **Visible** remains the render enable switch.

No blend-mode selector, cutout threshold, premultiplied-alpha switch, texture wrap UI, texture-space transform UI, Sprite lighting model, or material-asset abstraction is part of this contract.

## Runtime interaction

Sprite order remains Sorting Layer order, then Order in Layer, then stable Object ID. The Sprite pass remains depth tested with depth writes disabled. Sampling never changes pivot, Pixels Per Unit, natural-size math, Transform orientation, or sort order. Source image alpha remains intact and is multiplied by per-instance opacity under standard `SRC_ALPHA`, `ONE_MINUS_SRC_ALPHA` blending.

Direct-Texture legacy Sprites, Meshes, and Billboards have no Sprite Asset sampling metadata and therefore take the Smooth fallback. Ordinary Texture upload orientation, mipmap generation, and wrap behavior remain unchanged.

## Persistence and failure behavior

Sprite Asset version 3 persists `filtering` plus the optional Phase 018 `sourceRect`. Version 1/2 or missing-field records normalize to `linear` and full-image source, preserving their former appearance. Sprite Renderer version 4 persists `opacity`; older known versions normalize to opacity 1. Unknown filtering presented directly to validation is an error, while normal creation/load adapters reduce input to the two supported values.

Missing source Textures remain stable, repairable references. Their Sprite Asset filtering metadata is preserved through normal project records, duplication, prefab references, dependency closure, Save/Load, and Editable/Playable export.
