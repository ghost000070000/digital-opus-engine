# Terrain Cell Semantics Contract

The Tilemap v3 sparse cell envelope remains backward compatible:

- Manual: `{x,y,tileId}`
- Direct Auto-Tile: `{x,y,tileId,autoTileSetId}`
- Weighted Terrain: `{x,y,tileId,terrainBrushId}`
- Connected Terrain: `{x,y,tileId,terrainBrushId,autoTileSetId}`

`tileId` is always the resolved rendering and collision output. `terrainBrushId` is stable authoring provenance; it is never inferred from artwork or Tile name. `autoTileSetId` remains connectivity identity. Historical cells gain no invented semantics. Missing Brushes preserve `tileId`, aggregate validation by Tilemap Layer and missing ID, and do not recompute until explicitly repaired.
