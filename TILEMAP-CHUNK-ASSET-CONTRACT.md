# Tilemap Chunk Asset Contract

`tilemap-chunk` version 1 is a first-class, project-scoped authoring Asset with a stable Asset ID, creator name, one stable Tileset reference, positive integer width/height, ordered Chunk-local Layers, sparse zero-based Cells, and optional Spawn Marker templates.

A Chunk is reusable source data, not a scene object. A stamp materializes ordinary Tilemap Cells and fresh Spawn Markers. It creates no live Chunk instance or runtime dependency, and later Chunk edits or deletion cannot alter existing stamps. Chunk dependency validation covers its Tileset, Tile IDs, Auto-Tile Sets, Terrain Brushes, and marker Prefabs. Broken stable references are preserved for typed repair.

Ordinary scene objects and grid-placed Prefab instances are never captured. Chunks do not nest and do not store source Tilemap identity or Cell Size; Cell Size remains owned by the referenced Tileset.
