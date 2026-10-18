# Phase 017 Characterization

## Pre-change Texture behavior

- Texture import/decode owned one data URL, one decoded image, and one WebGL texture per Texture Asset.
- Upload flipped Y, uploaded straight RGBA, generated mipmaps, used `LINEAR_MIPMAP_LINEAR` minification and `LINEAR` magnification, and wrapped with `REPEAT` on both axes.
- Sprite tint used the entity RGB multiplier. Source alpha was sampled and multiplied by the entity alpha uniform under standard source-alpha blending.
- Sprite ordering was independent of material state: named layer order, integer Order in Layer, then stable Object ID, with depth testing on and depth writes off.

## Root issue

Sampling state lived only on the shared WebGL texture. Mutating that object to satisfy a Sprite Asset would make every other user of the same Texture inherit the latest choice. Copying the Texture or image bytes per Sprite Asset would avoid the state collision but violate the established asset-ownership contract.

## Chosen boundary

WebGL2 sampler objects separate sampling parameters from image storage. The renderer now caches exactly two samplers and chooses between them per entity draw. Sprite Assets own the choice, while Textures retain image/upload ownership. Smooth matches the historical path; Pixel uses base-level nearest-neighbor sampling. No per-frame sampler or texture allocation occurs.

Opacity was added because the shader and entity alpha path already existed, source alpha already composed correctly, and a 0–1 field is a small coherent Sprite presentation control. Cutout/alpha-test and multiple blend modes were not added: the current Sprite pass and acceptance evidence did not justify the extra render-state, ordering, serialization, and creator-language surface.

## Compatibility characterization

- Sprite Asset v1/missing `filtering` becomes v2 Smooth.
- Sprite Renderer v1–v3/missing `opacity` becomes v4 opacity 1.
- Direct-Texture Sprites, Meshes, and Billboards retain the Smooth fallback.
- PPU, pivot, natural size, direct manipulation, named sorting, duplication, prefab linkage, missing-reference behavior, and export dependency closure are unchanged.
- Future unsupported component versions remain loadable/inert under the existing schema policy.

## Dogfood record

The interactive normal editor loaded the saved Phase 014 hybrid project. Existing Sprite Assets appeared as v2 with Smooth sampling. A transparent Sprite Asset was duplicated without copying its Texture, the duplicate changed to Pixel / Nearest, and an instance was placed at natural size. Instance opacity changed to 0.4. Project Validation passed; Play/Stop succeeded; the project saved as `phase-017-sprite-material-dogfood`; reload preserved Pixel / Nearest and opacity 0.4; Editable and Playable export actions both completed.

The repeatable headless normal-editor audit then imported the generated 16×16 `tests/fixtures/phase-017-pixel-art.png`, created Pixel and Smooth Sprite Assets sharing one Texture, placed both at 3×3 world units, and asserted distinct runtime sampler choices with the identical live Texture handle. It also imported the transparent PNG, persisted opacity 0.35 through a Prefab and Save/Load, ran validation and Play/Stop, inspected both exported HTML files, and captured `phase-017-filtering-proof.png`. Results are in `phase-017-dogfood.json`.

The fixtures are intentionally small, transparent, and hard-edged enough to expose nearest-versus-linear reconstruction when scaled. This is functional dogfood, not an art-quality judgment or a pixel-perfect camera claim.
