# Phase 036 Characterization

Phase 036 advances Tileset v3 to v4 with `terrainBrushes`; historical Tilesets normalize to an empty list. Tilemap stays v3 because optional semantic cell fields are backward compatible.

Weighted Brushes resolve by documented FNV-1a over Brush ID, Layer ID, coordinate, and Seed with variants sorted by Tile ID. Tilemap ID is intentionally excluded so whole-object duplication retaining local Layer IDs preserves appearance under recompute. An individually duplicated Layer has a new ID: copied outputs initially match, while a future Brush recompute may yield a different deterministic pattern.

Connected Brushes delegate to Phase 035 rather than duplicating masks or Rules. Footprints are bounded transient tool state. Save/load and Editable preserve authoring semantics; Playable strips them and consumes only resolved Tiles. Rejected alternatives include runtime randomness, name inference, a hidden biome grid, procedural noise, scatter, object spawning, chunk assets, interchange importers, physics, and Phase 040 performance claims.

Phase 037 remains the explicit object/spawn-marker boundary.
