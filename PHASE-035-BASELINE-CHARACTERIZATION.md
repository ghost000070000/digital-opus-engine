# Phase 035 Baseline Characterization

Baseline HEAD was `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`, with a pre-existing dirty worktree preserved. Phase 034 was READY: engine 166,134 bytes / 42,573 gzip, editor package 1,715 KB, Phase 034 86/86, Phase 011-034 1,274/1,274, integrated 1,636/1,636, and public games 28/28.

The pre-change Tileset v2 record was normalized by `createTileset`: stable asset identity, cell size, ordered Tiles, per-Tile Sprite reference and collision metadata. Palette selection used `activeTilesetId`, `activeTileId`, and `tilemapBrushTileId`. Tilemap v2 used one scene object, ordered Layers, and sparse `{x,y,tileId}` cells canonicalized by `canonicalizeTilemapCells`.

Paint and erase flowed through `applyTilemapStrokeCell` to `setTilemapCell` / `eraseTilemapCell`; `tilemapStroke` provided one Undo snapshot and `tilemapStrokeCells` provided gap-free interpolation. `tilemapUsedTileIds` and `collectProjectDependencies` drove closure. Editable `serializeProject` retained full Tilesets; Playable compacted Tilesets to resolved used Tiles and their Sprite/Texture closure.

Phase 034 collision stayed Tile-owned and was resolved through each cell's Tile ID. No runtime or per-cell collision duplication existed.
