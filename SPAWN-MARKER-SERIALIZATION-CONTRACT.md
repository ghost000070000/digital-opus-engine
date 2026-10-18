# Spawn Marker Serialization Contract

Tilemap v4 Save, load, Undo snapshots, duplication, level duplication, Editable Export, and Playable Export preserve canonical marker records. Older Tilemaps migrate with `spawnMarkers: []`.

Playable pruning removes Tile authoring provenance as before but retains top-level marker metadata and marker-linked Prefabs. Runtime derived world positions are never serialized; they are computed from current transform and cell size.
