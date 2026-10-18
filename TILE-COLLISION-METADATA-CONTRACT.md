# Tile Collision Metadata Contract

Tileset v2 owns collision intent on each Tile. Sprite Assets, Tilemap cells, Tilemap layers, Textures, and source rectangles do not own it. Historical Tiles without the field normalize to `{ "mode": "none" }`; new Tiles use the same default.

The only Phase 034 modes are `none`, `full-cell`, and `custom-rect`. Full Cell means normalized bounds 0,0 through 1,1 without a redundant stored rectangle. Custom Rectangle stores finite `minX`, `minY`, `maxX`, and `maxY`; all values remain within 0..1 and each minimum must be less than its maximum. Invalid or unknown authoring data validates at the Tile and resolves safely to None.

Coordinates are normalized to the Tile grid cell: X runs left to right and Y bottom to top. They do not depend on Texture pixels, Sprite source rectangles, pivot, PPU, alpha, or artwork footprint. Cell Size scales the derived local rectangle without rewriting metadata. Phase 034 creates no collider, rigid body, contact, trigger, one-way platform, slope, or response behavior.
