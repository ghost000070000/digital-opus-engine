# Tilemap Chunk Capture Contract

Create Chunk from Region uses a two-corner rectangular Tilemap-local selection. Drag direction is normalized, including negative source coordinates. The rectangle becomes a zero-based Chunk footprint whose bottom-left Cell is `(0,0)`; empty positions stay sparse holes while width and height preserve the footprint.

Creators explicitly select any subset of Tile Layers. Hidden and locked Layers are capturable because capture is read-only. Source order and creator-facing Layer names are retained, but source Layer IDs are replaced by stable Chunk-local IDs. Spawn Marker inclusion defaults off; when enabled, in-bounds markers become relative templates with local IDs, names, integer coordinates, and optional Prefab references.

Manual, direct Auto-Tile, weighted Terrain, and Auto-Terrain identities are retained. Chunk-local preview recomputes semantics with outside-of-bounds neighbors disconnected. Empty captures are rejected. The UI states that ordinary scene objects are excluded.
