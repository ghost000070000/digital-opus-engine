# Sprite / Transparent 3D Contract

Transparent Meshes and Billboards choose a relationship to the complete Sprite pass: `behind-sprites` or `in-front-of-sprites`. Both bands keep depth testing on and depth writes off. Within each band, objects sort by active-camera distance, farthest first, with stable Object ID as the deterministic exact-depth tie-break.

The setting never enters Sprite data. Sprite animation clips, states, events, direction, flip, tint, opacity, parallax, and nine-slice composition are independent. Nine-slice cells remain contiguous inside a single Sprite entity draw.
