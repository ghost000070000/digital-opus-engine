# Phase 037 Object Marker Integration

Phase 037 implements two deliberately separate workflows on a selected Tilemap grid.

- **Place Object** resolves a chosen existing Prefab, computes the clicked cell center from the current Tileset cell size and the Tilemap's resolved world basis, then calls the normal Prefab instantiation and `addPlaced` paths. The result is an ordinary root-level scene object with one Undo boundary and no continuing Tilemap/grid binding.
- **Spawn Marker** authors a Tilemap-local version-1 marker record: `{id,name,x,y,prefabRef}`. Markers are not Layer cells, do not occupy Tiles, and survive Layer hide, lock, clear, reorder, duplication, and deletion. A Prefab reference is metadata only and never instantiates automatically.

Terrain and Auto-Tile provenance remain visual-cell concerns. They do not create markers or objects. Phase 038 chunk/prefab reuse, automatic spawn systems, scatter, TMX, physics, and per-cell custom properties remain outside this implementation.
