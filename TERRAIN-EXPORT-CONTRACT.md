# Terrain Export Contract

Editable export retains Tileset v4 Terrain Brushes, Seeds, variants, weights, Auto-Tile references, semantic cells, source Tiles, Sprite Assets, Textures, and the complete editor implementation.

Playable export is resolved data. It retains compact `{x,y,tileId}` cells and only dependencies reached from used Tile IDs. It strips Terrain Brush definitions, `terrainBrushId`, Auto-Tile definitions, `autoTileSetId`, Seeds, weights, Rules, and unused authoring candidates. The runtime engine performs no weighted hash, Terrain recompute, or Auto-Tile solve. Local artifacts require no external network request.
