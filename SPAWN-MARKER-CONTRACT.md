# Spawn Marker Contract

Tilemap schema version 4 owns `spawnMarkers[]`. Each version-1 record has exactly `id`, `name`, safe-integer `x`, safe-integer `y`, and nullable string `prefabRef`.

IDs are stable and Tilemap-local. Names are required; authoring prefers case-insensitive uniqueness. Coordinates may be positive or negative. Markers are independent of every Tile Layer, painted Tile occupancy, collision metadata, Auto-Tile identity, and Terrain Brush provenance.

The optional Prefab reference describes intent only. It does not create an object, timer, physics body, or runtime spawner. Missing Prefabs remain visible and repairable through validation.
