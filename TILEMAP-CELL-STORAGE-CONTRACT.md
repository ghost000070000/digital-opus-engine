# Tilemap Cell Storage Contract

Cells serialize as a sparse array of `{ x, y, tileId }`. X and Y are signed safe integers. Negative coordinates are valid. Tile IDs are stable local IDs resolved only inside the assigned Tileset. Canonical order is Y then X. One coordinate has at most one effective record; corrupt duplicates validate and normalize deterministically with last input winning. Empty cells are absent.

The WeakMap coordinate index is transient acceleration and never enters project JSON. Missing Tilesets or Tiles remain preserved and repairable; runtime uses visible placeholders instead of throwing.
