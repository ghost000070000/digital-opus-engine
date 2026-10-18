# Terrain Brush Contract

Terrain Brushes are stable Tileset-local authoring records in Tileset v4. Full identity is Tileset ID plus Brush ID; names are non-empty, case-insensitively unique labels and may change without rewriting cells.

Exactly two modes exist: `weighted-tiles` with signed 32-bit Seed and `{tileId,weight}` variants, and `auto-tile` with one stable Auto-Tile Set reference. Connected Brushes delegate Rules and membership to the Phase 035 authority; they never copy Rules.

Painting stores `terrainBrushId` and a resolved `tileId`; connected Terrain also stores `autoTileSetId`. Manual painting clears both semantic IDs. Direct Auto-Tile painting clears Terrain ownership. Deleting a used Brush retains stored output and missing semantic identity for validation and repair. Repair can convert cells to Manual or reassign them explicitly. Terrain never creates scene objects, spawn markers, physics, biome simulation, or runtime logic.
