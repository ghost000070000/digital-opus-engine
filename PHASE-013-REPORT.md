# Phase 013 Report

## Verdict

`PHASE_013_SPRITE_SORTING_READY`

Phase 013 adds deterministic named Sprite Sorting Layers without starting Phase 014. The architecture, migration, characterization, and creator evidence are in `SPRITE-SORTING-LAYER-CONTRACT.md`, `SPRITE-SORTING-MIGRATION.md`, `PHASE-013-CHARACTERIZATION.md`, and `phase-013-dogfood.json`.

## Outcome

- Project-owned layers have stable IDs, editable unique names, explicit contiguous order, and a protected Default.
- Sprite Renderer version 3 stores a typed stable layer reference plus integer Order in Layer; old numeric Layer migrates to Default plus Order in Layer.
- Runtime ordering is exactly layer order, Order in Layer, then persisted Object ID. Transform Z stays spatial; transparent depth behavior is unchanged.
- Project UI supports add, rename, reorder, and guarded delete. Referenced deletion reports an exact count and only reassigns to Default after confirmation.
- Save/Load, Project JSON, Prefabs, Level duplication, validation, and Editable/Playable exports retain the registry and component references.
- Missing cross-project references remain diagnosable and repairable instead of being silently rewritten.
- The focused 38-test suite includes 300 randomized insertion-order records and proves identical output.
- Normal-editor dogfood migrated a Phase 011 project, built the required layered scene, verified reorder/rename/delete semantics, saved/reloaded it, validated, played, exported, and found no browser errors or warnings.

## Scope and grade

Sprites / 2D remains grade B. Named deterministic stacking is now a no-code common path. Orthographic/pixel-perfect camera modes, animation/slicing, Tilemaps, 2D collision/physics, and a complete Sprite-versus-transparent-Mesh overlap contract remain future work. Phase 014 was not started.

## Verification

Baseline: HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`, 273 pre-existing dirty entries at the Phase 013 implementation boundary; 28/28 games at 114.9 MB; prior integrated 424/424; Phase 011 26/26; Phase 012 36/36.

Final: engine 159,879 bytes / 41,277 gzip (+232 / +65); Phase 011 26/26; Phase 012 36/36; Phase 013 38/38; integrated 462/462; games 28/28 at 115.3 MB; Engine site and Games site builds passed; editor package 1,403 KB (Phase 012 baseline 1,389 KB, +14 KB). Capability totals remain A=5, B=32, C=18, D=1, N/A=1. The working tree remains intentionally dirty and all unrelated changes were preserved; no reset, clean, discard, commit, push, deploy, DNS action, game #29, or Phase 014 implementation occurred.

Performance sanity: the project layer-order map is resolved when layer data changes or records are applied, then cached on each Sprite entity. The existing per-frame Sprite-list sort compares three scalar/string keys. No GPU batching or later rendering system was added.
