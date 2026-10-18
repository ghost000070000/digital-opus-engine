# Phase 036 Report

## Final verdict

`PHASE_036_TERRAIN_BRUSHES_READY`

Phase 036 was initially blocked only because its first endurance attempt lasted 60.025 seconds. That nonqualifying evidence is preserved verbatim. Fresh run `phase-036-endurance-closure-20260917T105609Z` later completed 21,639.369 continuous seconds against a 21,630-second target, with zero semantic failures, crashes, unresolved failures, or transient write locks. All post-endurance closure checks passed.

## Fresh endurance closure

- Start: `2026-09-17T10:56:09.466Z`
- End: `2026-09-17T16:56:48.829Z`
- Actual duration: 21,639.369 seconds; minimum qualifying duration: 21,600 seconds.
- 40,956 mixed Terrain cycles; 6,593,944 semantic model operations; 723,425,435 independent weighted resolutions; 501,759 Auto-Tile/Terrain resolutions; 40,956 Terrain transitions.
- 1,640 serialize/load/re-normalize cycles and 16,384 Undo/Redo operations.
- 14 isolated browser cycles, 14 Editable export cycles, and 14 Playable export cycles. External requests, console errors, and page errors: zero.
- 37 real heartbeats plus explicit three-hour midpoint and five-hour milestone evidence.
- 41 memory observations. RSS ranged from 42,024,960 to 788,766,720 bytes while the qualification world grew toward its bounded coordinate set; final RSS was 728,678,400 bytes and final heap use was 141,531,200 bytes after garbage collection. This is an acceptable bounded observation, not a formal leak-proof claim.
- Midpoint at 10,808.274 seconds: 22,976 cycles, 3,699,136 model operations, seven browser/export cycles, zero failures, checksum `7d096977`.
- Final-hour milestone at 18,007.312 seconds: 35,057 cycles, 5,644,433 model operations, eleven browser/export cycles, zero failures, checksum `178767db`.
- Worker PID 28356 exited normally. Browser audits owned and cleaned their child processes. Observed closure-owned orphan count: zero.

## Post-endurance closure checks

- Phase 036 focused: 102/102.
- Phase 011-036 focused: 1,480/1,480.
- Integrated: 1,842/1,842.
- Showcase: 15/15; public-site integration: 1/1 with 28 public games.
- Engine build: PASS at 166,134 bytes / 42,573 gzip bytes / 22 sources; Phase 036 engine delta remains 0 bytes.
- Public game build: 28/28. Engine-site and games-site builds, path checks, and broken-link checks: PASS.
- Editor package: 1,786 KB, +36 KB from the 1,750 KB Phase 036 baseline.
- JavaScript syntax, JSON parsing, capability validation, friction validation, and `git diff --check`: PASS. Diff check emitted only the checkout's existing LF-to-CRLF warnings.
- Dirty worktree preserved at the same HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`. No reset, clean, restore, commit, push, deployment, DNS change, catalog expansion, or Game 29.

## Delivered Terrain Brush scope

- Tileset-v4 Weighted and Connected Auto-Tile Terrain Brushes with stable local IDs, canonical FNV-1a coordinate hashing, signed Seeds, bounded integer weights, semantic Terrain cells, validation, repair, project-wide recompute, and deterministic persistence.
- Terrain Palette authoring with exact previews, Manual/Auto/Terrain state, single/square/circle radius 1-8 footprints, interpolated deduplicated strokes, layer isolation, connected-neighbor batching, and one Undo record per drag.
- Editable exports retain authoring semantics. Playable exports strip Terrain and Auto-Tile metadata while preserving resolved visual output.

## Evidence and roadmap

- Full closure evidence: `phase-036-endurance-closure.json`
- Historical endurance index: `phase-036-endurance.json`
- Previous 60.025-second run: `qualification/phase-036/phase-036-endurance-previous-60s.json`
- Current machine state: `qualification/phase-036/full-day-state.json`
- Midpoint/final-hour/heartbeat evidence: `qualification/phase-036/endurance-closure-*.json`

Tilemaps remains Grade B: Phase 036 Terrain authoring is qualified, while object/spawn markers and chunk reuse remain future scope. Phase 037 was untouched except for the previously documented integration seam. Recommended next step: human review may advance to Phase 037 in a separate authorized task; this closure does not implement or prepare Phase 037.
