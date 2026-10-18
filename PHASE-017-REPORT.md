# Phase 017 Report

## Outcome

Sprite Assets now choose Smooth or Pixel / Nearest sampling independently even when they share one source Texture. Sprite instances now expose bounded opacity while preserving source alpha, deterministic sorting, and the existing hybrid 2D/3D pass contract.

## Implementation

- Advanced Sprite Asset records to version 2 with a validated `filtering` field and historical Smooth migration default.
- Added clear Sampling choices to the Sprite Asset Inspector and immediate resynchronization of placed instances.
- Added two cached WebGL2 sampler objects to the renderer. Draws bind the sampler selected by the resolved Sprite Asset without mutating or duplicating the shared Texture.
- Advanced Sprite Renderer to version 4 with a clamped 0–1 `opacity` field that maps to the existing entity/shader alpha path.
- Kept direct Texture Sprites, Meshes, and Billboards on the historical Smooth fallback.
- Added `tests/phase-017-sprite-material.test.js`, a reproducible 16×16 pixel-art fixture/generator, and updated Phase 011–016 compatibility expectations for the additive schema versions.

## Scope decisions

The phase adds only Smooth, Pixel / Nearest, and opacity. Source alpha already works and remains authoritative. Alpha cutout/test was not needed to prove the requested path, and a blend-mode zoo would have expanded ordering and portability semantics without evidence. Texture wrap, atlas regions, animation, lighting, orthographic/pixel-perfect cameras, Tilemaps, and 2D physics remain outside Phase 017.

## Verification

- Baseline standard build/tests before implementation: passed, 574/574.
- Focused Phase 011–017 suites after implementation: passed; Phase 017 adds 30 checks.
- Normal-editor dogfood: Smooth migration, generated pixel-art import, shared-Texture duplication, simultaneous Pixel / Nearest and Smooth placement, identical live Texture-handle proof, transparent PNG, opacity, Prefab, validation, Play/Stop, Save/Load, both export tiers, and visual capture passed. See `phase-017-dogfood.json` and `phase-017-filtering-proof.png`.
- Final integrated build/tests: passed, 604/604.
- Games: 28/28 built, 116.0 MB.
- Engine site: 28/28 examples, path/link checks passed, 217.2 MB.
- Games site: 28/28 built, path/link checks passed, 137.5 MB.
- Browser console after dogfood: no errors or warnings.
- No deployment was performed.

## Capability assessment

Sprites / 2D remains grade B. Sampling and opacity materially improve the common Sprite presentation path, but pixel-perfect/orthographic cameras, Sprite sheet animation, Tilemaps, and 2D collision/physics remain absent. Pixels Per Unit remains size conversion rather than a pixel-perfect rendering guarantee.

## Verdict

`PHASE_017_SPRITE_PRESENTATION_READY`
