# Tilemap Rendering Contract

A Tilemap is one sortable Sprite-pass entity. Its sparse cells render contiguously in canonical row-major order using each Tile's Sprite Asset, source region, filtering, pixels-per-unit natural art size, and shared Texture. Cell occupancy follows Tileset cell size; art may overhang without changing occupancy. Transform, Sprite Sorting Layer, Order in Layer, depth testing, and stable Object ID determine the Tilemap batch's placement and ordering.

The renderer does not create cell entities or regroup cells by Texture when that could change transparent overlap ordering. Missing dependencies use a visible magenta placeholder.
