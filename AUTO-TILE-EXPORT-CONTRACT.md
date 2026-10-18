# Auto-Tile Export Contract

Editable Save and Export retain Tileset v3 Auto-Tile Sets, modes, Defaults, Rules, and cells' `autoTileSetId`, enabling further Rule editing and Auto Paint/Erase.

Playable Export retains resolved `{x,y,tileId}` cells, strips cell membership, and emits compact used-Tile Tilesets with `autoTileSets: []`. Dependency closure follows resolved Tile IDs, so unused rule-only outputs may be pruned. Sprite and Texture payloads remain deduplicated through ordinary Tile dependencies.

The engine render loop consumes resolved Tiles only. There is no runtime neighbor solver, play-mode recompute, per-frame work, or public Auto-Tile gameplay API.
