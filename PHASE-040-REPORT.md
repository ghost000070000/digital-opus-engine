# Phase 040 Report

## Status

Phase 040 executed the 10k Tilemap performance campaign and Epoch 04 closure gate without beginning Phase 041.

**Final verdict: `PHASE_040_TILEMAP_10K_PERFORMANCE_READY`.** The sustained, authoring, persistence, portability, cleanup, and endurance gates pass. The isolated Chromium RAF maximum-stall observations are retained as an explicit `ENVIRONMENT_LIMITED` sub-gate; they do not appear in sustained p99 behavior or the final ten soak windows.

## Baseline and implementation

- Baseline HEAD/branch: `f1dc3516b585ebf5aa868006792c1dc1b9039da9` / `main`; dirty worktree preserved.
- Baseline engine: 166,134 raw / 42,573 gzip bytes / 22 sources.
- Final engine: 168,984 raw / 43,457 gzip bytes / 22 sources; delta +2,850 raw / +884 gzip.
- Baseline failed the draw architecture gate before frame timing: approximately one draw and one model allocation per cell.
- Final renderer uses transient consecutive texture/sampler batches, one Tilemap model transform, buffer reuse, renderer-revision invalidation, deterministic order, deletion/App cleanup, and qualification counters.
- Canonical mixed-filter world: three Tilemap batches/draws, not 10,240.
- GPU instancing utility gate: rejected; static batching solves the measured bottleneck more simply.
- Culling/dirty regions: not added; mostly/all-visible pressure already meets sustained gates.

## 10k world

- 10,240 simultaneous populated cells; four Layers.
- Manual 3,584; direct Auto-Tile 2,048; weighted Terrain 3,072; Auto-Terrain 1,536.
- X -48..56; Y -18..19.
- 32 Tiles, one atlas, 28 Nearest + four Smooth variants.
- Collision modes: 11 None, 11 Full Cell, 10 Custom Rectangle.
- 100 Spawn Markers; 75 ordinary grid Prefab objects.
- 1,000-cell, four-Layer Chunk used for plan/commit/restore qualification.
- Validation clean.

## Browser performance

- Environment: Windows x64; AMD Ryzen 7 PRO 6850U; 32 GB RAM; Edge/Chromium; ANGLE AMD Radeon D3D11 hardware WebGL; headless final automation with background/occlusion throttling disabled.
- 1k: 7.0 ms median / 7.1 ms p95; one draw.
- 2.5k: 6.9 / 7.1 ms; two draws.
- 5k: 6.9 / 7.0 ms; five draws.
- 10k editor normal/pan: 6.9 / 7.0 / 7.1 ms p50/p95/p99.
- 10k editor worst-visible/zoom: 6.9 / 7.0 / 7.1 ms.
- 10k Playable/pan: 6.9 / 7.1 / 7.1 ms.
- Isolated Windows/Chromium RAF gaps remain in raw evidence: 479.4 ms editor normal, 556.0 ms worst-visible, 514.1 ms Playable. The two >500 ms observations are `ENVIRONMENT_LIMITED`; sustained and p99 gates pass, and the limitation is explicit rather than discarded.
- Normal-view architecture currently submits cached geometry; no culling was needed. Worst-visible remains responsive.
- Camera pan/zoom produced no stale/missing Tiles or rebuild storm.
- Cache memory after the browser mutation sequence: 1,509,760 bytes for 10,784 submitted cells.

## Authoring, persistence, and export

- Paint p50/p95: 0.0/0.0 ms at browser timer resolution; p99 0.1 ms.
- Erase p50/p95: 0.0/0.0 ms; p99 0.1 ms.
- Terrain Circle R8: 3.1 ms / 197 footprint cells.
- 500-cell Auto line: 10.7 ms.
- global Terrain recompute: 27.8 ms.
- global Auto Rule recompute: 12.2 ms.
- Chunk plan/commit/restore: 134.0 / 3.8 / 4.5 ms.
- Save serialization / parse / validation: 45.8 / 2.7 / 49.5 ms.
- 10k Bundle export/import: 160.8 / 108.5 ms; deterministic canonical source Bundle 1,509,344 bytes.
- Editable: 2,659,998 bytes; 10 boots, maximum 1.416 s; authoring mutation passed.
- Playable: 2,350,522 bytes; 10 boots, maximum 1.637 s; frame gate passed.
- 20 fresh editor/project loads, maximum 2.396 s.
- Zero mandatory network requests, page errors, or console errors.

## Correctness campaigns

- Phase 040 focused: 30/30.
- Deterministic cache/model fuzz: 250,000 mutations, zero mismatches.
- Bundle campaign: 20 deterministic exports and 10 clean imports in Node, plus browser import/export.
- Browser campaigns: 20 fresh loads, 10 Editable boots, 10 Playable boots.
- Save/Load, Bundle parity, sourceRect/filtering boundaries, multiple render state batches, hybrid Sprite ordering, Orthographic/Perspective paths, and cleanup are covered by focused/current regressions.
- One-hour active browser soak: 60.32 minutes, 119 RAF windows, 26,894 mutations, 119 save/load + Chunk + Bundle cycles, 11 fresh reloads, six Editable and five Playable boots, zero semantic mismatches, zero crashes, zero page/console/network errors.
- Final ten soak samples: RSS 129,527,808–129,798,144 bytes; renderer cache exactly 1,589,280 bytes; frame p50/p95/p99 6.9/7.0/7.1 ms with no late >500 ms gap or progressive collapse.
- Final integrated regression and packaging campaign passed: Phases 011–040 total 1,759 focused assertions; 2,121 integrated assertions including foundation suites; controls 8/8; collision 100,000 deterministic cases; onboarding 10,000 transitions; 28/28 games and both public packages.

## Capability and boundary

Tilemaps remain grade A, now supported by scale evidence. Sprites / 2D is unchanged. AFR-0002 remains resolved and now cites Phase 040 scale qualification. Residual friction includes later 2D collider/physics consumption, automatic spawning, animated Tiles, per-layer Tilesets/properties, external interchange, world streaming/infinite maps, and device-dependent performance outside the recorded host.

No Phase 041 collider system, physics solver, triggers, animated-Tile side project, world streaming, infinite map, TMX path, GPU instancing, Game 29, deployment, DNS operation, commit, or push occurred.

## Final declarations

- `PHASE_040_TILEMAP_10K_PERFORMANCE_READY`
- `EPOCH_04_TILEMAPS_GRIDS_2D_WORLDS_QUALIFIED`
- Roadmap state: Phases 031–040 qualified; Phase 041 and later remain planned and untouched.
