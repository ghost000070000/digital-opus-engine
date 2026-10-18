# Phase 021 Characterization

Phase 021 adds a bounded Sprite-frame content and playback layer without changing the qualified static Sprite, Billboard, or skinned-animation models.

## Characterized boundaries

| Area | Characterized result |
|---|---|
| Asset identity | Registry type `sprite-animation`, stable ID, version 1, rename-safe references |
| Frame data | Ordered `{ spriteAsset, durationMs }` only; 100 ms default |
| Validation | Empty, bad duration, missing/wrong Sprite Asset, and missing clip are structured errors |
| Runtime | Engine-delta update, multi-frame catch-up, bad-delta safety, play-once final hold |
| Source resolution | Active frame → Sprite Asset → Texture/sourceRect/filtering; static source remains fallback |
| Presentation | Geometry, instance pivot, Transform, tint, opacity, visibility, and sorting stay unchanged |
| Instances | Shared clip data with independent transient state, including duplicate and Prefab instances |
| Persistence | Project format 6 saves clips and authored options but not elapsed playback state |
| Dependency graph | Used clip frames close over only their Sprite Assets and shared Textures; unused content prunes |
| Export | Editable and Playable tiers use the same editor/runtime source path |
| Regression boundary | Static Sprite remains optional-animation; Billboard and 3D/skinned clips remain separate |

`tests/phase-021-sprite-animation-clips.test.js` contains 46 focused checks, including nonuniform 80/160/300 ms timing, a large-delta multi-frame crossing, three independently advanced instances, and a 100-instance shared-clip sanity case. Phase 011–021 focused coverage is 395 checks.

The browser dogfood additionally used four explicit atlas cells at 800/900/1600/3000 ms, five Sprite instances, and an animated Sprite Prefab. The Inspector-mount failure found during the run was traced to a misspelled shared formatting helper and repaired before the clean pass.
