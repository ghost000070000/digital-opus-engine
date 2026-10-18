# Tilemap Bundle Root Semantics Contract

A Tilemap bundle creates exactly one detached Tilemap object. It does not carry the source scene-object ID, parent, group, or child-local transform. Export blocks parented roots so local/world ambiguity cannot silently change placement. Position, scale, quaternion/yaw, sorting, Layer order/state, Cells, and marker coordinates remain authored values.

A Chunk bundle creates exactly one Tilemap Chunk Asset. The Chunk carries no live link to a source map and no source-map ID. Its width/height, ordered local Layers, sparse Cells, semantic ownership fields, marker templates, Tileset link, folder, and tags survive. Importing it never stamps a Tilemap automatically.

Neither root kind captures neighboring ordinary scene objects. Grid-placed Prefab instances are ordinary scene objects and stay excluded; Spawn Markers are Tilemap-local metadata and stay included.
