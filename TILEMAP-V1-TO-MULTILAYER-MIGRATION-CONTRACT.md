# Tilemap v1 to Multi-Layer Migration Contract

Version-1 Tilemaps read their historical top-level `cells[]` into one deterministic layer:

- ID: `tilemap-layer-default`
- Name: `Layer 1`
- Visible: `true`
- Locked: `false`
- Cells: the same valid `{x,y,tileId}` semantics, canonically ordered

The ID is stable across repeated loads; migration uses no randomness. Transform, Tileset, Sorting Layer, Order in Layer, negative coordinates, broken-but-repairable Tile IDs, and visual draw sequence are retained. A non-enumerable in-memory `cells` compatibility alias supports bounded old helper callers, but JSON serialization excludes it.

Canonical Save, duplication, and both export tiers emit version 2 with `layers[]` only. They never emit top-level `cells` beside layers. The preserved fixture `tests/fixtures/phase-032-tilemap-v1.json` remains version 1 for regression coverage.
