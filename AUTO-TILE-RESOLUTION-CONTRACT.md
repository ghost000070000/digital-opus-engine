# Auto-Tile Resolution Contract

Resolution is deterministic: same Set plus same Tilemap Layer produces a canonical neighbor mask; an exact valid Rule selects its Tile, otherwise the valid Default Tile does. A broken Rule falls back to Default. A broken or missing Set preserves the stored output.

Ordinary membership mutations recompute the changed cell and its eight-cell superset neighborhood. Four-way resolution ignores diagonals. Output changes never alter membership, so recursion is unnecessary. `recomputeAutoTilemap` and `recomputeAutoTileSetUsage` are the full reference paths for load normalization, rule edits, tests, and fuzz comparison.

Rules serialize by numeric mask and cells by Y then X. Resolution is independent of visibility, locking, transforms, cell size, artwork, and collision metadata.
