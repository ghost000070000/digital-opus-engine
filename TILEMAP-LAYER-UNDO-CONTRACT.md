# Tilemap Layer Undo Contract

The existing editor snapshot stack is the single history authority. Add, Duplicate, Rename, Reorder, Visibility, Lock, Delete, Clear Layer, and Clear All each capture one pre-change snapshot. Delete restoration therefore recovers the exact Layer ID, name, canonical position, flags, and cells.

Paint and Erase still capture one snapshot at the first semantic mutation of a pointer stroke. The stroke captures stable Layer ID, not array index, and resolves it for every cell. Rename or reorder cannot redirect it. Switching active layer, toggling visibility or lock, deleting a layer, blur, or pointer-up finalizes the current transaction before another operation begins. No-op repaint/erase captures no history.

Undo/Redo restores canonical Tilemap records through the shared Save/Load instantiation path, rebuilding transient indexes and selecting a deterministic usable active layer when the prior transient selection no longer exists.
