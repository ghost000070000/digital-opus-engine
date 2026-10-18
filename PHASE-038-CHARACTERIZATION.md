# Phase 038 Characterization

Phase 038 extends the established authoring plumbing instead of adding runtime architecture. Tilemap v4 remains the scene owner of ordered sparse Layers and Spawn Markers. The registered Asset system now includes `tilemap-chunk` v1. The editor owns capture/stamp interaction, library cards, snapshot history, Save/Load, validation focus, and export policy.

The decisive boundary is materialization. Chunks contain selected Tilemap Layers and optional marker templates, never ordinary objects. Capture normalizes a rectangular source region into relative coordinates and semantic Chunk-local preview data. Stamp maps every local Layer explicitly, plans against a clone, resolves Terrain in destination coordinates, recomputes Auto-Tile topology across the new boundary, creates fresh markers, and commits the exact plan in one history step.

Rejected alternatives were live-linked Chunk instances, name-as-identity Layer mapping, cross-Tileset conversion, destructive replace-rectangle holes, ordinary-object capture, nested Chunks, runtime stamping, and external interchange. Those would weaken determinism or cross Phase 039/040 boundaries.
