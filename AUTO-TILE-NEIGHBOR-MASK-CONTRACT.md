# Auto-Tile Neighbor Mask Contract

Bits are fixed: N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128. Four-way strips every diagonal and has exactly 16 masks.

Eight-way uses gated corners: NE requires N+E, SE requires S+E, SW requires S+W, and NW requires N+W. Canonicalizing every raw byte produces exactly 47 unique masks. Noncanonical authored rules are invalid rather than silently reinterpreted.

Cells connect only when they occupy the same Tilemap, same Layer, and carry the same valid `autoTileSetId`. Manual cells, other Sets, other Layers, and other Tilemaps never connect. Coordinates use N=(x,y+1), E=(x+1,y), S=(x,y-1), W=(x-1,y), including across negative coordinates.
