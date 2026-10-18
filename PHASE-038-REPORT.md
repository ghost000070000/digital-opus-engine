# Phase 038 Report — Tilemap Chunk / Prefab Reuse

Final verdict: `PHASE_038_TILEMAP_CHUNK_REUSE_READY`

## Implemented scope

- Registered `tilemap-chunk` version 1 as an authoring Asset with stable identity, one Tileset reference, rectangular bounds, ordered local Layers, sparse semantic Cells, optional Spawn Marker templates, folders/tags, search/filter, preview, inspect, duplicate, and delete.
- Added rectangular capture with reversed-drag and negative-coordinate support, explicit Layer subsets, optional markers, semantic normalization, empty-capture rejection, and ordinary-object exclusion.
- Added bottom-left anchored stamping with explicit distinct Layer mapping, exact-name suggestions, Create New Layer, locked/hidden protection, dry-run plans, overwrite counts, merge-only holes, destination Terrain resolution, Auto-Tile boundary recompute, fresh marker identity, and preview/commit parity.
- Save/Load and Editable retain Chunk Assets. Playable strips Chunk Assets and authoring-only semantics while retaining materialized cells and Spawn Marker runtime metadata.

## Initial state

Functional qualification passed; endurance was pending and the final verdict was intentionally withheld.

- Focused Phase 038: 88/88.
- Deterministic fuzz: 490,968 capture/stamp operations, 108,710 mapping plans, 291,054 semantic cell operations, 20 fixed seeds, 10 deterministic reruns, zero failures.
- Serialization/history: 1,250 cycles and 2,500 Undo/Redo reference operations.
- Browser dogfood: 30 cycles, 3 useful Chunks, 30 stamps, 30 Undo/Redo cycles, 5 Save/Load cycles, 10 Editable and 10 Playable compositions, no page/console/network errors.
- Browser proof: 1,803 materialized Cells, 22 markers, 3 Editable Chunk Assets, zero Playable Chunk Assets.
- Endurance smoke: passed but correctly not counted toward the continuous gate.

The earlier partial run `phase-038-20260919T110507562Z` was superseded when the closure brief required a new closure-specific run and evidence layout. None of its time was counted.

## Closure state

Fresh continuous endurance completed successfully.

- Run ID: `phase-038-endurance-closure-20260919T112921342Z`.
- Start: `2026-09-19T11:29:21.342Z`.
- End: `2026-09-19T14:29:51.561Z`.
- Exact active duration: 10,830.064 seconds; target 10,830 seconds.
- Suspended time counted: zero.
- Capture operations and Chunk normalizations: 3,826,656 each.
- Layer mappings resolved: 5,739,984.
- Dry-run plans, commits, preview/commit comparisons, Undo, Redo, and Save/Load cycles: 3,826,656 each.
- Semantic cell writes: 89,926,416.
- Terrain resolutions: 50,224,860.
- Auto-Tile recomputes: 956,664.
- Marker creations and fresh-ID checks: 2,551,104 each.
- Overwrite plans: 3,746,934; hole-preservation checks: 3,268,602.
- Browser cycles: 9; Editable cycles: 4; Playable cycles: 4.
- Heartbeats: 19.
- Midpoint: PASS at 5,400.089 active seconds.
- Two-hour milestone: PASS at 7,200.048 active seconds.
- Memory observations: 46. RSS ranged 57,044,992–233,869,312 bytes and ended at 232,960,000. Heap used ranged 6,290,576–82,953,064 bytes and ended at 54,488,184. The last ten RSS readings remained between 231,641,088 and 233,590,784 bytes. This is bounded evidence, not a formal leak proof.
- Transient file-lock retries: 0. Semantic mismatches: 0. Crashes: 0. Unresolved failures: 0.
- Source fingerprint: `005bb7157ec842dee6b7e1ea806d5d2268e3da7be859b9714a58bc5f185f537d` at both start and end.

## Post-run qualification

- Phase 038 focused: 89/89. The additional regression covers a real pre-flight defect where an empty target could reuse a marker template ID; target marker IDs now remain fresh.
- Phase 011–038 aggregate: 1,638/1,638.
- Integrated suite: 2,000/2,000.
- Phase 037: 69/69; Phase 036: 102/102; Phase 035: 104/104; Phase 034: 86/86; Phase 033: 85/85; Phase 032: 52/52; Phase 031: 78/78.
- Engine build: PASS, 166,134 bytes and 42,573 gzip bytes across 22 files.
- Public games: 28/28; public catalog remains exactly 28 with no game #29.
- Engine site: PASS, including path safety, 28 game links, 8 home links, and no dogfood route. Editor package: 1,848 KB.
- Games site: 28/28, with path safety and link checks passing.
- Capability validation: PASS, 57 capabilities — A=5, B=33, C=18, D=0, N/A=1.
- Friction validation: PASS, 24 records, 19 open canonical, 1 Critical, 12 High, 2 duplicate observations.
- JavaScript syntax: 202/202 files.
- Phase 038 JSON evidence: PASS.
- `git diff --check`: PASS; only characterized line-ending warnings were emitted.
- Playable/runtime Chunk system: absent. Chunk Assets: zero. Chunk-only dependencies: pruned.
- Dirty worktree: preserved. Baseline HEAD remains `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`.
- Phase-038-owned orphan process count: zero; browser contexts and temporary servers closed.
- Phase 039 implementation: absent and untouched.

Two post-run assertions in Phase 020 and Phase 031 still expected Tilemaps' `lastImprovedPhase` to be 37. They were updated to the already-qualified catalog value 38; this test-only maintenance did not alter product semantics or the endurance fingerprint.

## Boundaries and roadmap

No live Chunk instances, runtime stamping API, ordinary-object capture, nested Chunks, transform variants, cross-Tileset remapping, external interchange, physics work, game #29, deployment, DNS change, commit, push, reset, or clean operation was introduced.

Recommended next phase: Phase 039, only after the human/controller updates the external roadmap. This task did not modify that tracker and did not start Phase 039.
