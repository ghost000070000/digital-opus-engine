# Phase 036 Baseline Characterization

Captured before the Phase 036 schema mutation on 2026-09-16.

## Repository state

- Required incoming verdict: `PHASE_035_AUTO_TILING_READY`.
- Baseline HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`.
- The checkout was already dirty (501 short-status entries). Phase 036 preserves it; no reset, clean, restore, commit, push, deploy, or catalog expansion is authorized.
- Baseline engine: 166,134 bytes, 42,573 gzip bytes, 22 sources.
- Baseline focused Phase 035: 104/104; Phase 011-035: 1,378/1,378; integrated: 1,740/1,740; public games: 28/28.

## Phase 035 architecture

- Tilesets normalize to schema v3 with stable local Tile IDs, ordered Tile records, `cellSize`, and Tileset-local `autoTileSets`.
- Auto-Tile Sets own stable IDs, names, four/eight-way neighbor mode, Default Tile and canonical mask Rules. Rule output is resolved from semantic Set membership, never inferred from Tile artwork.
- Tilemaps normalize to v3. Historical flat `cells` migrate to a default Layer; Layers own stable IDs, names, visibility, locking and sparse canonical cells.
- Manual cells store `{x,y,tileId}`. Auto-managed cells additionally store `autoTileSetId`; `tileId` is the resolved render/collision output.
- A WeakMap-backed per-Tilemap/per-Layer cache maps integer coordinate keys to cells and array positions. Mutations invalidate or update that cache.
- Manual Paint, direct Auto-Tile Paint and Erase are separate helpers. Auto mutations recompute the changed cell plus its bounded eight-neighbor area; full recompute and project-wide Set recompute are also available.
- Editor brush state is explicit (`manual-tile` or `auto-tile`) and the viewport stroke uses Phase 032 integer-line interpolation with one snapshot Undo per drag.
- Canonical Save sorts sparse cells by Y then X. Editable export retains authoring records; Playable compaction strips Auto-Tile definitions and semantic IDs after retaining resolved Tile IDs.
- Usage indexing aggregates Set use by Tilemap and Layer. Validation aggregates missing Set references and navigation can focus either the exact Set or representative cell.

## Phase 036 mutation boundary

Phase 036 advances Tileset to v4 and adds Tileset-local Terrain Brushes plus optional `terrainBrushId` on Tilemap cells. Tilemap stays v3 because the sparse cell envelope is backward-compatible. The runtime engine remains unchanged: authoring resolves Terrain into ordinary `tileId` values. Phase 037 object/spawn markers are explicitly excluded.
