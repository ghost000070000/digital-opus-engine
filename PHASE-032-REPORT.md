# Phase 032 — Tilemap Paint / Erase Qualification

## Verdict

`PHASE_032_TILEMAP_PAINT_ERASE_READY`

Run ID: `phase-032-20260916-115829`  
Baseline: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`  
Dirty worktree: 441 baseline entries preserved; no reset, clean, discard, commit, push, deploy, DNS, global configuration, dependency download, or public-catalog expansion.

## Delivered architecture

Tilemap v1 is one normal transformed scene object with one sparse logical cell plane. It references one stable Tileset ID and stores canonical `{x,y,tileId}` records. Coordinates are safe integers, negative placement uses `floor`, duplicate corrupt inputs normalize last-input-wins, and deterministic serialization sorts by `y` then `x`. A transient indexed map provides constant-time lookup, replace, and erase; occupied bounds derive from the sparse records. Duplicate Object and Level paths deep-reconstruct the record, while hierarchy, Transform, Save/Load, and shared history use the existing scene seams.

Tileset Cell Size controls cell spacing. Sprite Asset natural size controls art footprint, so rectangular, smaller, and overhanging art is not stretched to the cell. Cell attachment is always the cell center; arbitrary Sprite pivot does not shift grid attachment. Tilemap Transform moves, rotates, and scales the complete cell plane.

The renderer keeps one Tilemap Entity and emits transient cell descriptors contiguously inside the Sprite pass. It creates no object, Texture, timer, or DOM node per runtime cell. Each Tile resolves through stable Tile ID to Sprite Asset, Texture, source rectangle, Pixels Per Unit size, and Pixel/Smooth filtering. Missing Tile/Sprite/Texture state renders a magenta placeholder. The whole Tilemap occupies one sorting tuple; internal cells draw in canonical row-major order without Texture regrouping. Existing opaque-depth, transparent-band, Orthographic, Perspective, and transformed-scene behavior is reused.

## Creator workflow and history

Objects → Tilemap creates and selects an empty object. The Inspector exposes name, Transform, Tileset, count/bounds, Sorting Layer, Order in Layer, Paint, Erase, Open Palette, Clear All, Duplicate, and Delete. Changing a populated Tileset requires confirmation and clears incompatible cells. Deleting Tiles/Tilesets warns, preserves repairable stable references, and validation aggregates missing IDs rather than spamming every cell.

Paint and Erase are explicit viewport modes with grid, origin, hover cell, coordinate readout, brush preview, Palette integration, and Exit Tile Editing. The transformed plane is ray-picked in both camera projections; world-to-cell is `floor(local / cellSize)`. Single paint, replacement, same-Tile no-op, Bresenham drag interpolation, diagonal strokes, continuous erase, pointer capture, interruption cleanup, and modifier/right-button camera navigation are bounded in the implementation and focused suite. The first semantic stroke mutation takes one Undo snapshot, so a long stroke is one Undo step; no-op hover/repaint takes none. Undo/Redo, Clear All Undo, immediate Save, and immediate Export share the normal project history/state paths.

## Persistence, dependency closure, and exports

Editable export retains the complete Tileset authoring surface. Playable export treats Tilemaps as runtime dependency roots and retains only used Tiles plus their Sprite Assets and deduplicated shared Textures. Both preserve stable IDs and canonical cells. The final browser export audit booted the exact generated HTML files unchanged through localhost:

- Editable: 1,728,143 bytes, one Tileset, three Tiles, six cells, editor toggle present, validation clean.
- Playable: 1,728,181 bytes, one Tileset, three used Tiles, three Sprite Assets, one shared Texture, six cells, editor toggle absent.
- Both rendered six runtime cell descriptors with cell parity, no missing art, no page/console errors, and zero mandatory external requests.

## Dogfood and stress evidence

Normal visible controls were used to import the Phase 031 atlas fixture, create a Tileset, add a Tile, place and assign a Tilemap, Paint, Erase, Undo, Redo, validate, export both tiers, enter Play, and activate a normal 2D Camera. The visible Inspector showed one occupied negative-y cell (`0,-2`), Erase returned it to zero, Undo returned to zero after repaint, and Redo restored one. Project Validation reported no structured issues. The automated browser fixture separately proved one object, six positive/negative cells, six runtime descriptors, clean authoring validation, and both export boots. The canonical browser fixture is intentionally compact; mutation, rename/reorder, Sprite-ref change, break/repair, Transform, replacement, long strokes, 1,000/2,500/100,000-cell behavior, persistence, pruning, and deterministic serialization are covered by focused/static/model gates rather than claimed as separate visible screenshots.

Deterministic fuzz used xorshift32 seeds 1–10, 100,000 model actions per seed, for 1,000,000 total Paint/replace/Erase actions. Every seed checked indexed lookup, reference-map parity, canonical serialization, JSON reload, and deterministic reserialization. All passed.

The fresh post-reboot detached endurance retry completed uninterrupted and passed: 7,200.009 seconds, 1,038,134 serialize/reload/history/Tileset cycles, 2,076,268,000 Paint/Erase actions, four isolated browser cycles, four isolated export cycles, zero recorded failures, and a 95,449,504-byte peak JS heap. The final heartbeat was written at 7,200.008 seconds and the final report recorded `PASS`. The earlier 6,000.007-second interrupted attempt remains preserved as excluded historical evidence and was not counted toward this qualifying duration.

## Regression and build evidence

- Phase 032 focused closure rerun: 52/52.
- Phase 011–031 pre-final sweep: 1,051/1,051.
- Baseline integrated: 1,413/1,413; final integrated: 1,465/1,465.
- Final engine bundle: 166,134 bytes / 42,573 gzip / 22 sources (baseline 164,608 / 42,346; delta +1,526 / +227).
- Final delivery demo: 184,028 bytes.
- Public games: 28/28, 123.0 MB; catalog remains exactly 28.
- Engine site: editor 1,684 KB, 28/28 examples, 224.4 MB total, path/link checks passed.
- Games site: 28/28, 144.5 MB total, path/link checks passed.
- One transient Windows `UNKNOWN` write lock on `dist/opus-engine.js` was recorded; the unchanged bounded retry passed.
- Closure reruns passed: Phase 032 static audit, authoring-friction registry check (24 records; 19 open canonical), capability dashboard check (57 capabilities; A=5, B=33, C=18, D=0, N/A=1), and `git diff --check` (line-ending warnings only).

## Capability and remaining boundary

Tilemaps advance from D to B because the common path is now discoverable, direct, validated, persistent, runtime-rendered, and supported in both export tiers. This is evidence-based rather than an automatic phase upgrade. Sprites / 2D remains B. AFR-0002 is resolved for the original absent tile-based authoring path; it is not a claim that later advanced systems exist.

The hard boundary remains: no second Tilemap layer, Tile collision/2D physics, auto-tiling, terrain/biome rules, spawn/object cells, animated Tiles, per-cell property bags, chunk/prefab system, interchange, GPU instancing, or public game 29. Phase 033 is only a written multi-layer integration seam and was not implemented. The Phase 032 duration gate is closed; this report does not authorize or implement Phase 033.
