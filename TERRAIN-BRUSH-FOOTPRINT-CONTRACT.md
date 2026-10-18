# Terrain Brush Footprint Contract

Footprint shape and radius are transient editor tool state, not project or Brush data.

- 1 Cell targets only the center.
- Square radius R targets every offset where both axes are in `[-R,R]`.
- Circle radius R targets integer offsets satisfying `dx² + dy² <= R²`.
- Radius is clamped to 1 through 8.

Hover exposes every affected cell. Dragging interpolates centers with the Phase 032 integer-line algorithm, unions overlapping footprints by coordinate, and makes one continuous drag one Undo transaction. Erase uses the same footprint. Connected Terrain applies membership in a batch and recomputes the unique dirty neighborhood. Only the active visible unlocked Layer is mutated; negative coordinates are ordinary cells.
