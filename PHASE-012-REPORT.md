# Phase 012 Report

## Verdict

`PHASE_012_SPRITE_ASSET_READY`

Phase 012 adds reusable Sprite artwork without duplicating image bytes or starting Phase 013. The record, renderer compatibility, UI workflow, validation, dependency closure, tests, and creator dogfood are described in `SPRITE-ASSET-CONTRACT.md`, `SPRITE-ASSET-WORKFLOW.md`, `PHASE-012-CHARACTERIZATION.md`, and `phase-012-dogfood.json`.

## Outcome

- Sprite is a first-class Phase 003 registered asset with stable ID, editable label, version 1, typed `sourceTexture`, normalized pivot, and default PPU 100.
- Texture exclusively owns local image data, decoding, and GPU texture state.
- Source dimensions are derived through the existing decoder and persisted on Texture records; natural size is pixels divided by PPU.
- Existing Assets UI now supports registry-derived type filtering plus Sprite search/folders/tags, preview, reusable-field Inspector, Place, Duplicate, and warning-based Delete.
- **Create Sprite** derives metadata from an existing Texture. **Import as Sprite** safely composes the existing importer.
- Sprite Renderer version 2 prefers `spriteAssetRef`, retains direct `sourceTexture`, and preserves Phase 011 appearance and per-instance Width/Height.
- Export closure is Sprite object → Sprite Asset → Texture → image payload through the registry hook. Unused pairs are pruned.
- Missing Sprite assets and missing source Textures remain visible, diagnosable, and repairable.
- Sprite Prefabs retain stable asset references. Cross-project absence is diagnosed rather than silently reassigned.
- Asset operations retain the existing Asset Library's non-Undo boundary; scene assignment and instance changes remain undoable.
- Billboard and all direct Texture users remain unchanged.
- Mandatory Phase 011 dogfood passed through the normal UI: direct Texture assignment, Save/Load, Play, editable/playable export, explicit conversion, field preservation, separate source/natural dimensions, validation, and browser console.

## Scope and grade

Sprites / 2D remains grade B. Reusable artwork is now a complete common path, but named sorting layers, orthographic/pixel-perfect camera, Sprite animation/slicing, Tilemaps, and 2D collision/physics remain absent. Phase 013 is ready to own sorting architecture; it has not been started.

## Verification

Baseline: HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`, 266 pre-existing dirty entries, engine 159,647 bytes / 41,212 gzip, integrated 388/388, Phase 011 26/26, games 28/28 at 114.3 MB.

Final: engine 159,647 bytes / 41,212 gzip (unchanged); Phase 011 26/26; Phase 012 36/36; integrated 424/424; games 28/28 at 114.9 MB; Engine site and Games site builds passed; editor package 1,389 KB (baseline 1,367 KB, +22 KB). Capability totals remain A=5, B=32, C=18, D=1, N/A=1. The revised-contract baseline had 272 dirty entries and the working tree ended with 273 because the exact required `SPRITE-ASSET-WORKFLOW.md` output was added while all unrelated work remained preserved; no reset, clean, discard, commit, push, deploy, DNS action, or game #29 occurred.
