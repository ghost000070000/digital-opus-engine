# Tilemap Chunk Layer Mapping Contract

Chunk Layer IDs are stable only inside their Chunk Asset. Tilemap Layer IDs are stable only inside their Tilemap. No Layer name or ID is treated as cross-Tilemap identity.

A one-Layer Chunk suggests the active target Layer. An exact, unique name match may be suggested for convenience. Ambiguous names remain unmapped. Each Chunk Layer must map explicitly to a different target Layer or Create New Layer. Duplicate target mappings, missing Layers, locked Layers, and hidden Layers are blocking errors. Mapping invalidates if its target disappears or becomes incompatible and is not serialized into either Chunk or Tilemap.
