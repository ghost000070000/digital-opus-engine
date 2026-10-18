# Terrain and Auto-Tile Integration Contract

An `auto-tile` Terrain Brush stores only a stable Auto-Tile Set reference. Phase 035 remains the single authority for neighbor modes, canonical masks, Rules, Default output, connectivity, local recompute, and full recompute.

Connected Terrain cells retain both `terrainBrushId` provenance and canonical `autoTileSetId` membership. Cells painted by different Terrain Brushes connect when they reference the same Auto-Tile Set; different Sets never connect. Rules and Set renames preserve Terrain identity. Set reference or mode changes update old and new neighborhoods in one authoring transaction. Broken Sets disable new paint while stored output remains visible and repairable.
