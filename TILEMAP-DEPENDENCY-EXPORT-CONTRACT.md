# Tilemap Dependency and Export Contract

Editable Save/Export retains the complete Tileset authoring library. Playable Export treats placed Tilemaps as roots, retains their assigned Tilesets, keeps only used Tile records, and follows only those Tiles to Sprite Assets and Textures. Stable IDs are unchanged. Direct Sprite dependencies remain independent. Missing references validate before export and remain diagnosable after round-trip.
