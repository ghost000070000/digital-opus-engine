# Phase 036 Terrain Brush Integration Seam

A later Terrain/Biome brush may select an existing Tileset-local Auto-Tile Set and submit ordinary `paintAutoTileCell` operations. It must not change Set identity, mask bits, gated-corner rules, same-Layer membership, manual override semantics, or authoring-time resolution.

Phase 035 adds no terrain or biome fields, weighting, procedural generation, object markers, or runtime terrain system. Phase 036 should treat Auto-Tile Sets as a bounded output-selection target and preserve the current resolver and export boundary.
