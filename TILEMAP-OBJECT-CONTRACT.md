# Tilemap Object Contract

Phase 032 adds one `kind: "tilemap"`, version 1 scene object. It owns one Transform, one Tileset reference, one sparse Cell list, one Sprite Sorting Layer reference, and one integer Order in Layer. Cells are data, never scene objects. Tilemap supports ordinary scene selection, hierarchy transforms, duplicate, delete, level duplication, Undo/Redo, Save/Load, and export.

Out of scope: multiple cell layers, collision, auto-tiling, terrain rules, animated Tiles, per-cell properties, object/spawn cells, chunk authoring, and Tilemap prefabs.
