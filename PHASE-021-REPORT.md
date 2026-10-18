# Phase 021 Report

## Outcome

Phase 021 establishes reusable frame-based Sprite Animation Clips across the existing Asset Library, Sprite Renderer, shared runtime update, project persistence, Prefabs, validation, and both export tiers. It does not consume Phase 022 timeline, preview, or looping scope.

Baseline was `main` at `f1dc3516b585ebf5aa868006792c1dc1b9039da9` with an intentionally preserved dirty worktree: engine 160,854 bytes / 41,445 gzip, integrated 711/711, Phase 011–020 focused 349/349, games 28/28 at 116.7 MB, and editor package 1,455 KB.

## Implementation

- Registered `sprite-animation` version 1 with ordered Sprite Asset frame references and millisecond durations.
- Added minimal Asset Library and Inspector authoring: create, rename, organize, duplicate, guarded delete, add/remove, Sprite picker, duration, and Move Up/Down.
- Extended Sprite Renderer version 5 with optional `animationClipRef` and default-off `playOnStart`, retaining the static `spriteAssetRef`.
- Added per-instance transient playback helpers and one shared engine-delta update path with bounded catch-up, bad-delta safety, and deterministic final-frame hold.
- Added project-format 6 persistence, typed references, validation/navigation, Prefab/duplicate preservation, and clip → Sprite Asset → Texture export closure/pruning.
- Preserved instance geometry/pivot, Transform, sorting, tint, opacity, visibility, and frame-owned filtering resolution.

## Dogfood

A fresh local editor run imported the 128×128 atlas fixture, sliced sixteen 32×32 Sprite Assets, explicitly authored `Atlas Pulse` from four atlas cells at 800/900/1600/3000 ms, attached it with Play On Start, created five animated Sprite instances including two Prefab instantiations, exercised Play/Stop/restart, saved and reloaded `phase-021-animation-dogfood`, and passed Project Validation with no issues. Editable and Playable export controls completed through the normal UI. The in-app browser did not expose Blob downloads as download events, so shared export construction and closure are additionally locked by focused tests.

Dogfood found one real defect: clip creation listed the asset but failed to mount its Inspector because of a misspelled shared tag formatter. The helper call was corrected and the full authoring path was rerun successfully. No new console error or warning occurred after the repair.

## Verification

- Phase 021 focused suite: 46/46.
- Phase 011–021 focused suites: 395/395.
- Integrated suite: 757/757, including showcase 15/15 and public-site integration 1/1.
- Static Sprite and Billboard regressions pass.
- 100 independently allocated playback states share one immutable four-frame clip without per-frame clip/asset cloning or timer allocation.
- Engine build: 160,854-byte bundle, 41,445 gzip bytes, 22 sources; demo 178,748 bytes (unchanged from baseline).
- Games build: 28/28, 117.3 MB total.
- Engine-site package: 1,476 KB editor, 28/28 examples, 218.5 MB total. The editor grew 21 KB from the 1,455 KB Phase 020 baseline.
- Games-site package: 28/28 reviewed games, 138.8 MB total.
- Capability generator/check: 57 capabilities (A 5, B 32, C 18, D 1, N/A 1). Friction check: 24 records preserved.

## Capability and friction

Animation remains grade C and Sprites / 2D remains grade B. Evidence and explanations now acknowledge the bounded clip workflow; taxonomy and grades were not upgraded. No existing broad friction item was closed. Remaining work includes polished preview/timeline/loop authoring, states/transitions, events, directional variants, orthographic/pixel-perfect camera, Tilemaps, and 2D physics.

## Verdict

`PHASE_021_SPRITE_ANIMATION_CLIPS_READY`
