# Auto-Tile Cell Contract

A manual Tilemap v3 cell is `{x,y,tileId}`. An auto-managed cell is `{x,y,tileId,autoTileSetId}`. The Set ID is semantic membership; `tileId` is the deterministic resolved render and collision output cache. Membership is never inferred from Tile ID, name, art, or collision.

Historical cells remain manual. Painting manually over an auto cell removes `autoTileSetId`; painting an Auto-Tile Set restores membership. If a Set or Default is broken, the stored `tileId` is retained so visible content remains stable while validation exposes the repair need. Converting affected cells to Manual removes only Set identity and preserves the resolved Tile.
