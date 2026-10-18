# Phase 034 Tile Collision Integration Seam

Phase 033 adds no collision or physics data. A future Phase 034 may attach stable collision metadata to Tiles or their owning Tileset and derive collision from each Tilemap Layer's stable cell identity. The multi-layer model already exposes the required tuple: Tilemap ID + Layer ID + X + Y + Tile ID.

Phase 034 must define collision-shape ownership, layer participation, one-way/trigger semantics, generated-body lifecycle, editing UI, migration, validation, export, and runtime performance without turning visual layers into scene objects. It must not overload Phase 033's authoring `locked` flag; lock remains cell-edit protection only. No collider, solid flag, physics body, trigger, or generation behavior is implemented by this seam.

Stable Tile IDs and Layer cells also leave clean future seams for Phase 035 auto-tiling and Phase 036 terrain brushes, but no neighbor rules, masks, weights, biomes, or procedural behavior are present.
