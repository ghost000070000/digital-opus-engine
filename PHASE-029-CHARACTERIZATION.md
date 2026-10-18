# Phase 029 Characterization

## Starting state

The Phase 028 renderer already partitioned renderable entities into opaque 3D, transparent 3D/Billboards, and Sprites. Opaque objects wrote depth. Transparent objects sorted farthest-first by camera distance, disabled depth writes, and rendered immediately before Sprites. Sprites then sorted by Sorting Layer, Order in Layer, and stable Object ID with depth testing retained and depth writes disabled.

Therefore `behind-sprites` is the exact historical behavior and safe migration default. Billboard facing already occurred independently in the editor bridge. Perspective and orthographic cameras already shared the same renderer path. Nine-slice already emitted all cells inside one Sprite draw.

## Gap

Authors could not place a transparent Mesh or Billboard after the Sprite pass. Equal-distance transparent objects had no explicit stable-ID tie-break. There was no authoring field, validation, help, or portable persistence for the relationship.

## Chosen boundary

Phase 029 adds one two-value relation for transparent non-Sprite objects and splits the historical transparent pass into two bands. It does not add arbitrary interleaving, per-Sprite transparent relations, order-independent transparency, or a new asset dependency.
