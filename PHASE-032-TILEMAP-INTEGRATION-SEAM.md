# Phase 032 Tilemap Integration Seam

Phase 032 may consume the Phase 031 foundation through stable Tileset Asset ID, explicit world-unit Cell Width/Height, stable Tileset-local Tile ID, typed Tile-to-Sprite Asset reference, the editor-only `activeTilesetId` / `activeTileId` selection seam, bounded `getTilesetById` / `getTileById` helpers, structured validation, and existing dependency traversal.

The Phase 032 Tilemap/Grid owns scene identity, grid origin/orientation/dimensions, cells, paint/erase interaction, layer behavior if in scope, renderer data, and runtime export roots. Cells must reference `(tilesetId, tileId)` rather than names or array positions. They must not copy Sprite Assets, Texture bytes, or atlas rectangles.

Cell footprint comes from the Tileset's explicit Cell Size; artwork bounds come from the referenced Sprite Asset's source rectangle and Pixels Per Unit. Overhanging art therefore does not change grid geometry. The current Sprite Asset pivot remains authoritative artwork metadata and is not mutated by Tileset authoring. Phase 032 should define one canonical placement rule—for example, align the Sprite pivot to a documented cell anchor—before rendering, and must preserve a distinction between the cell footprint and artwork bounds.

Tile rotation/flip flags, animated Tiles, tint, custom properties, collision, auto-tiling, terrain/biome connectivity, weights, and spawn metadata are not present in Tileset v1 and must not be inferred. Later phases own those contracts.

This document defines an integration seam only. Phase 032 is ready to begin but was not implemented by Phase 031.
