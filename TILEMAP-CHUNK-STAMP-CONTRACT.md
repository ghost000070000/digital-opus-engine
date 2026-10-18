# Tilemap Chunk Stamp Contract

Stamp Chunk uses the hovered target Cell as the destination of Chunk local `(0,0)`. The footprint is axis-aligned in Tilemap grid coordinates and is not scalable, rotatable, or flippable.

Every Chunk Layer maps to one distinct visible, unlocked target Layer or to Create New Layer. Exact name matching is only a suggestion; mapping is transient editor state and is never stored in the Chunk. New Layers are visible, unlocked, uniquely named, and preserve Chunk Layer order. Cross-Tileset stamps are blocked.

The dry-run plan reports bounds, added Cells, overwritten Cells, neighbor-induced changes, new Layers, fresh Spawn Markers, and validation conflicts without mutation. Commit consumes that exact result. Stored Cells overwrite; sparse holes never erase. Markers receive new target IDs and collision-safe names. One snapshot Undo contains all writes, induced retiles, created Layers, and markers; Redo restores the exact result.
