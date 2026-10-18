# Tile Collision to Collider 2D Seam

Tile collision metadata remains Tile-owned semantic intent. Phase 041 does not materialize per-cell Collider Components or scan Tilemaps. A later integration may resolve visible/active cells into the same immutable world-shape vocabulary and reuse the pure overlap API, while preserving layer order, custom-rectangle cell coordinates, batching, and Tilemap performance. It must not mutate Tile assets or create one scene object per cell.

