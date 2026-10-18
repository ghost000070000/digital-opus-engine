# Phase 035 Characterization

Tileset advances to v3 with ordered `autoTileSets`; historical records normalize to an empty list. Tilemap advances to v3; historical cells remain manual, while managed cells add only `autoTileSetId`. Explicit Set identity is necessary because the same output Tile may be manual or shared by several Sets. `tileId` remains the resolved cache used by existing rendering, artwork, filtering, and Phase 034 collision.

Connectivity is same-Tilemap and same-Layer because Layers and Tilemaps are independent authoring spaces. Manual Tiles never connect because manual placement means “draw exactly this Tile,” not “join this connectivity family.” Four-way provides the complete 16-mask road/pipe model; gated eight-way provides the conventional 47-mask blob topology without arbitrary diagonal states.

Local mutations retile a bounded neighborhood; Rule/Default/mode edits traverse all users. A full deterministic recompute is retained as load normalization and qualification reference. Playable content strips authoring membership and rules and renders resolved Tiles, keeping runtime engine growth and per-frame work at zero.

Phase 036 may select these Sets from Terrain/Biome tools, but Phase 035 intentionally contains no terrain metadata, weighting, randomness, procedural generation, object markers, physics, or runtime Auto-Tile API.
