# Tileset Dependency Contract

The only Phase 031 dependency edge is `Tileset Tile.spriteAssetId -> Sprite Asset.id`. Existing Sprite Asset dependency resolution continues from Sprite Asset to Texture. The reference index labels the source Tileset and local Tile so usage messages and validation navigation remain creator-readable.

Editable authoring packages retain Tilesets plus the referenced Sprite Assets and Textures. A shared Sprite/Texture is emitted once regardless of how many Tiles or Tilesets reference it. No Texture bytes, atlas source rectangles, pivots, filtering state, or transparency state are copied into Tiles.

Playable packages do not treat authoring-only Tilesets as runtime roots because Phase 031 introduces no Tilemap renderer or runtime Tileset consumer. They prune unused Tilesets and their otherwise-unused Sprite/Texture dependencies. A Sprite placed directly in the Scene remains an independent runtime root and keeps exactly its Sprite Asset and Texture while unrelated Tileset content is pruned.

Deletion is non-cascading. Deleting a Sprite Asset with Tile users produces a named dependency warning; confirmation can leave repairable broken Tile references. Deleting a Tile or Tileset never deletes shared downstream assets.
