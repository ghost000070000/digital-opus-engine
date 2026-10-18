# Spawn Marker Runtime Contract

`window.getTilemapSpawnMarkers(tilemapId)` returns a frozen list of frozen marker views. Each view contains authored identity, name, cell coordinates, nullable Prefab identity/information, and a frozen derived world position.

World position is evaluated from the current Tileset cell size and the Tilemap Entity's current resolved transform basis, so parent/hierarchy motion is reflected at query time. Runtime queries do not mutate authored records, render editor overlays, instantiate Prefabs, schedule timers, or create physics.
