# Phase 040 Performance Report

## Qualification environment

Qualified on the recorded Phase 040 qualification environment: Windows x64, AMD Ryzen 7 PRO 6850U (16 logical CPUs), 32 GB system memory, Microsoft Edge/Chromium, and ANGLE on AMD Radeon Graphics through Direct3D 11. Final browser measurements requested hardware WebGL and disabled Chromium background/occlusion throttling. DevTools was closed.

## Canonical world

The internal `Phase 040 10K Tilemap Qualification` project contains 10,240 simultaneous populated cells in four Layers: 3,584 Manual, 2,048 direct Auto-Tile, 3,072 weighted Terrain, and 1,536 Auto-Terrain. Coordinates span X -48..56 and Y -18..19. Its Tileset has 32 Tiles from one atlas: 28 Nearest and four Smooth variants, plus None/Full Cell/Custom Rectangle collision metadata (11/11/10). It contains 100 Spawn Markers, 75 ordinary grid Prefab instances, and a reusable 1,000-cell four-Layer Chunk.

## Renderer result

Baseline was not acceptable: it rebuilt per-cell model matrices and issued about one draw per cell every frame. Phase 040 replaced that path with transient, consecutive render-state batch geometry. Authored order is exact, the entity Transform remains a uniform, unchanged geometry and buffers are reused, revision replacement invalidates the cache, and deleted Tilemaps/App destruction release resources. No cache data is serialized.

The canonical mixed-filter 10k world uses three Tilemap batches/draws and submits 10,240 cached cells in the worst-visible case. The post-mutation browser sample used 10,784 cells, three draws, 1,509,760 cache bytes, three rebuilds, and 36 initial/revision buffer uploads. GPU instancing was rejected because static batching satisfies the draw gate with less complexity. View culling and dirty regions were not added because the genuine mostly/all-visible pressure case already passes sustained frame gates.

## Scaling and frame measurements

| Scenario | Median | p95 | p99 | Tilemap draws | Submitted |
|---|---:|---:|---:|---:|---:|
| 1,000 cells | 7.0 ms | 7.1 ms | 361.4 ms* | 1 | 1,000 |
| 2,500 cells | 6.9 ms | 7.1 ms | 7.1 ms | 2 | 2,500 |
| 5,000 cells | 6.9 ms | 7.0 ms | 7.1 ms | 5 | 5,000 |
| 10,240 editor normal/pan | 6.9 ms | 7.0 ms | 7.1 ms | 3 | 10,240 |
| 10,240 editor worst-visible/zoom | 6.9 ms | 7.0 ms | 7.1 ms | 3 | 10,240 |
| 10,240 Playable/pan | 6.9 ms | 7.1 ms | 7.1 ms | 3 | 10,240 |

`*` Windows/Chromium produced isolated RAF scheduling gaps in several independent 60-second contexts, including exact duplicate gaps across unrelated scenarios. These are retained in raw traces. The final main run observed maxima of 479.4 ms editor-normal, 556.0 ms worst-visible, and 514.1 ms Playable while every p99 remained 7.1 ms. The maximum-stall sub-gate is therefore explicitly `ENVIRONMENT_LIMITED`, not silently discarded or represented as a clean pass. No progressive or sustained sub-20-FPS behavior occurred.

## Authoring and persistence

Browser timings on the 10k world:

- Paint 1,000 cells: 0.0 ms reported median/p95 at browser timer resolution; p99 0.1 ms.
- Erase 1,000 cells: 0.0 ms median/p95; p99 0.1 ms.
- Terrain Circle R8 (197 footprint cells): 3.1 ms.
- 500-cell Auto-Tile line: 10.7 ms.
- global weighted Terrain recompute: 27.8 ms.
- global Auto-Tile rule recompute: 12.2 ms.
- 1,000-cell Chunk dry-run: 134.0 ms; commit 3.8 ms; snapshot restore 4.5 ms.
- project serialization: 45.8 ms; parse 2.7 ms; full validation 49.5 ms.
- 10k portable Bundle export: 160.8 ms; verify/plan/materialize import: 108.5 ms; 1,597,739 bytes after the browser mutation sequence.
- 20 fresh editor/project loads: maximum 2.396 s.
- 10 Editable boots: maximum 1.416 s; 2,659,998 bytes.
- 10 Playable boots: maximum 1.637 s; 2,350,522 bytes.
- zero page errors, console errors, or mandatory external requests.

Node repeatability measurements and raw browser traces are preserved in `phase-040-performance.json`, `phase-040-frame-traces.json`, `phase-040-memory.json`, and `qualification/phase-040/`.

## Correctness and scope

The focused suite is 30/30. The deterministic cache/model campaign completed 250,000 mutations with zero mismatches. Save/Load, portable Bundle byte parity, resolved Tile IDs, atlas source rectangles, filtering boundaries, layer order, hybrid Sprite-pass placement, Orthographic/Perspective compatibility, cache cleanup, and Playable authoring-data stripping remain covered by focused and Phase 011–039 regressions.

No GPU instancing, 2D collider component, physics response, trigger system, animated Tile system, world streaming, infinite map, TMX path, Game 29, deployment, DNS change, commit, or push was introduced. Phase 041 was not started.

## Endurance and final gate

The corrected active-browser soak ran for 60.32 minutes across 119 RAF measurement windows and performed 26,894 mutations, 119 save/load cycles, 119 Chunk cycles, 119 Bundle cycles, 11 fresh reloads, six Editable boots, and five Playable boots. It recorded zero semantic mismatches, crashes, page errors, console errors, or external requests. Across its final ten observations RSS stayed between 129,527,808 and 129,798,144 bytes and renderer cache memory remained exactly 1,589,280 bytes. The final ten frame windows remained at approximately 6.9/7.0/7.1 ms p50/p95/p99 with no late >500 ms gap or progressive collapse.

The final integrated regression and packaging campaign passed: 1,759 Phase 011–040 focused assertions, 2,121 total integrated assertions, control stabilization 8/8, collision stabilization across 100,000 deterministic cases, onboarding across 10,000 state transitions, 28/28 game builds, and both public site packages.

**Final verdict: `PHASE_040_TILEMAP_10K_PERFORMANCE_READY`.** Epoch verdict: `EPOCH_04_TILEMAPS_GRIDS_2D_WORLDS_QUALIFIED`. The raw maximum-stall limitation remains disclosed above.
