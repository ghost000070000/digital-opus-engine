# Phase 033 — Multi-Layer Tilemaps Qualification

## Verdict

`PHASE_033_MULTILAYER_TILEMAPS_READY`

Every required Phase 033 gate passed. Phase 034 has not been implemented.

## Baseline

- HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`, 461 pre-existing dirty entries preserved.
- Engine: 166,134 bytes / 42,573 gzip / 22 sources; delivery demo 184,028 bytes.
- Phase 032 focused: 52/52; public games: 28/28, 123.0 MB.

## Implemented result

Tilemap schema version 2 replaces the single top-level cell authority with bottom-to-top `layers[]`. Each Layer owns stable local ID, unique non-empty name, visibility, authoring lock, and sparse canonical cells. Version-1 cells migrate deterministically into `tilemap-layer-default` / `Layer 1`; canonical Save/Export writes no top-level `cells`.

The Inspector displays topmost-first and exposes active selection, Add, immediate rename, Move Up/Down, show/hide, edit lock, Duplicate, Delete with final-layer protection, Clear Layer, and Clear All Layers. Paint/Erase target stable active Layer ID. Hidden or locked active layers explain why editing is disabled. Same coordinates coexist across layers, and erasing one leaves the others intact.

Snapshot history covers layer operations and restores exact identity/order/flags/cells. Strokes retain one Undo boundary and store Layer ID rather than index. Runtime flattens visible layers bottom-to-top inside one contiguous Tilemap Sprite-pass entity. Hidden layers do not render; locked visible layers do. One Tileset, cell size, Transform, Sorting Layer, and Order in Layer remain shared.

Tile usage, removal warnings, validation, Save/Load, Tilemap/Level duplication, Editable Export, and Playable dependency closure now traverse all layers. Hidden-layer dependencies are conservatively retained and deduplicated.

## Current evidence

- Phase 033 focused: 85/85.
- Phase 032 regression: 52/52.
- Phase 011–033 focused: 1,188/1,188 across 23 suites.
- Integrated runner: 1,550/1,550 (the qualified Phase 032 total of 1,465 plus 85 Phase 033 checks).
- Browser/editor/export audit: PASS using normal Import, Layer panel, Paint/Erase, Undo/Redo, validation, and export controls.
- A version-1 browser import migrated three positive/negative cells unchanged into version 2 `tilemap-layer-default`, rendered three cells, and exposed no enumerable top-level cell authority.
- Browser dogfood retained one Tilemap with four stable layers; three layers shared coordinate `(0,0)`; Paint changed Details 2→3, Erase 3→2, Undo 2→3, and Redo 3→2.
- Foreground finished hidden and locked: it retained one authored cell, emitted no runtime cell, and its unique Tile/Sprite/Texture dependency remained in Playable.
- Editable export: 1,747,734 bytes, four layers, seven cells.
- Playable export: 1,747,772 bytes, four layers, seven cells, three Tiles, three Sprite Assets, one Texture.
- Editable/Playable layer parity passed; both exact artifacts booted with no page errors, console errors, or external requests.
- Bounded model cases passed: 5×500, 10×250, 100×10, and 100 empty layers. These are sanity checks, not Phase 040 performance claims.
- Final engine: 166,134 bytes / 42,573 gzip / 22 sources; delta from baseline: 0 / 0.
- Final delivery demo: 184,028 bytes; delta: 0. Layer authoring is editor-side and uses the existing runtime descriptor path.
- Final editor package: 1,702 KB versus the qualified Phase 032 package's 1,684 KB; delta +18 KB.
- Public games: 28/28, 123.5 MB; engine site: 28/28 examples, 224.9 MB; games site: 28/28, 145.0 MB. All path/link checks passed and no game 29 was added.
- Authoring-friction registry check passed (24 records, 19 open canonical); capability catalog check passed (57 capabilities; A=5, B=33, C=18, D=0, N/A=1).
- JavaScript syntax checks and `git diff --check` passed; Git emitted only the repository's existing LF-to-CRLF working-copy warnings.

## Capability and friction

Tilemaps remains grade B. Multi-layer construction, organization, visibility, and editing protection materially improve the common path, but collision/2D physics, auto-tiling, terrain, object markers, chunk reuse, and final large-world performance qualification remain absent. Sprites / 2D remains B. AFR-0002 stays resolved for the qualified common path and now records the multi-layer improvement; no new blocking authoring-friction record was manufactured.

## Hard boundary

No collision metadata, physics, auto-tiling, terrain/biome rules, object/spawn layers, layer opacity/tint/parallax/Transform, per-layer Tileset, universal render-order system, game 29, deployment, DNS change, commit, or push was added. Phase 034 remains a documented integration seam only.

## Roadmap status

Epochs 01–03 remain qualified. In Epoch 04, Phases 031, 032, and 033 are qualified; Phase 034 is the recommended next phase but is not started or authorized by this report. Phases 035–040 remain planned.
