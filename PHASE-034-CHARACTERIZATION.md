# Phase 034 Characterization

Phase 034 advances Tileset assets from v1 to v2 and adds one bounded Tile-owned collision record. Tile ownership means a Wall painted once or 50,000 times shares one semantic definition. Cells remain sparse identity references, and Sprite Assets remain reusable visual resources without physics meaning.

Only None, Full Cell, and one axis-aligned Custom Rectangle are supported. Normalized cell space survives artwork, source-region, PPU, pivot, Texture, and Cell Size edits. Rectangles are deliberately cell-bounded; artwork may overhang while a Tree uses a small trunk footprint.

The Palette provides typed controls, validation, badges, and a cell/art/collision preview. The Tilemap editor provides an active-layer diagnostic overlay. Pure helpers resolve metadata to Tilemap-local rectangles and optional transformed quads. No runtime physics, per-cell metadata, per-layer policy, collider objects, alpha tracing, circles, polygons, triggers, slopes, auto-tiling, terrain, markers, or game 29 were introduced.

Playable export policy remains the existing compact path: authoring Tileset roots may be omitted when no runtime consumer needs them, while required Tile/Sprite/Texture art closure remains unchanged. Editable export retains the complete v2 records and editor controls.
