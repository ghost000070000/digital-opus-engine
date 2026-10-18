# Phase 038 Baseline Characterization

Recorded before Phase 038 mutation on 2026-09-19.

## Qualified baseline

- Required predecessor verdict: `PHASE_037_TILE_OBJECTS_SPAWN_MARKERS_READY`.
- Baseline HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`.
- Branch: `main`.
- The checkout is intentionally dirty and is preserved in place.
- Engine build: 166,134 bytes / 42,573 gzip bytes / 22 source files.
- Integrated suite: 1,911 passed, 0 failed.
- Phase 037 focused suite: 69 passed, 0 failed.
- Public games build: 28/28.

## Existing ownership seams

- `editor/src/00-authoring-plumbing.js` owns the registered Asset taxonomy, Tileset v4, Tilemap v4, sparse Layer cells, deterministic Terrain weighting, Auto-Tile recomputation, Spawn Marker identity, validation, and canonical serialization helpers.
- `editor/src/01-editor.js` owns concrete Asset Library panels, project state, snapshot Undo/Redo, project Save/Load, Editable closure, Playable pruning, Tilemap viewport tools, and renderer synchronization.
- Tilemaps own ordered Layers and Spawn Markers. Grid-placed Prefab objects remain ordinary level objects and have no Tilemap ownership.
- Terrain and Auto-Tile cells store semantic IDs plus a resolved `tileId` cache. The canonical resolver already supports full and local recomputation.
- Spawn Markers use Tilemap-local stable IDs, collision-safe names, integer cells, optional Prefab references, and derived world positions.

## Phase 038 decisions

- A Tilemap Chunk is a project-scoped authoring Asset, version 1.
- Capture copies selected sparse Layer content and optionally marker templates into zero-based rectangle-relative coordinates.
- Ordinary scene objects are always excluded and the UI discloses that boundary.
- Stamping materializes cells and fresh markers into the target Tilemap. No Chunk reference remains in the world.
- The fixed anchor is Chunk local `(0,0)`, the bottom-left capture cell.
- Empty Chunk positions are holes and never erase destination content.
- Chunk Layer IDs are local hints; every Layer receives an explicit, distinct destination mapping or a Create New Layer plan.
- The target Tileset stable ID must match. Cross-Tileset remapping is out of scope.
- Semantic cells are re-resolved in destination coordinates, followed by destination Auto-Tile recomputation across stamp boundaries.
- One editor snapshot surrounds a complete stamp, including newly created Layers and markers.
- Editable exports retain Chunks and their dependency closure. Playable exports strip Chunks and prune Chunk-only dependencies.

## Rejected alternatives and boundaries

- No live Chunk instances, nesting, runtime loader, runtime stamping API, streaming, scale, rotation, mirroring, or random Chunk variants.
- No ordinary scene-object capture.
- No external Chunk file, TMX/Tiled/LDtk interchange, or cross-project mapping; those belong to Phase 039.
- No collider generation or physics work.
- No Phase 040 large-world performance claim.
