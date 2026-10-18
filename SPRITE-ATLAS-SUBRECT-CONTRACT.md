# Sprite Atlas / Sub-Rectangle Contract

## Ownership and schema

A Texture Asset remains the sole owner of image bytes, decode state, and the WebGL texture. Sprite Asset v3 may add one `sourceRect` (`x`, `y`, `width`, `height`) in source-image pixels. `x` grows from the left and `y` grows from the top. A null or absent rectangle means the entire Texture and is the migration result for all older Sprite Assets.

Sprite instances and Prefabs store only `spriteAssetRef`; they never copy region metadata. Any number of Sprite Assets can therefore select different regions of one Texture without duplicating its payload.

## Validation and geometry

Explicit regions require non-negative finite X/Y, positive finite Width/Height, and must fit the decoded or persisted Texture dimensions. If the Texture is missing or its dimensions are unavailable, the rectangle is preserved and the source problem is reported separately. Natural size is region width/PPU by region height/PPU. Pivot remains normalized to that region.

## Rendering

`spriteSourceUV` is the authoritative pixel-to-UV conversion used by the runtime bridge in editor play and both export tiers. Because Texture upload uses `UNPACK_FLIP_Y_WEBGL`, a top-origin rectangle maps its lower UV edge to `1 - (y + height) / textureHeight`.

Nearest regions use exact cell bounds. Smooth explicit regions inset the sampled span by half a texel on each edge, preventing obvious neighboring-cell sampling at ordinary base-level scale. Full-image assets retain historical `[1,1]` scale and `[0,0]` offset exactly.

## Bounded limitation

Smooth minification still uses mipmaps generated for the complete source image. Without gutters or atlas-aware mip generation, extreme minification can mix neighboring cells in lower mip levels. Phase 018 does not add packing, padding, custom mip generation, or runtime atlasing. Pixel / Nearest does not use mip levels and remains exact.

