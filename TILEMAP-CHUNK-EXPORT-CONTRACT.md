# Tilemap Chunk Export Contract

Editable Save and export retain all Tilemap Chunk Assets and the dependency closure needed for future stamping: Tilesets, referenced Tiles, Auto-Tile Sets, Terrain Brushes, marker Prefabs, and their transitive Sprite/Texture data.

Playable export writes materialized Tilemap Cells and Spawn Marker runtime metadata, strips every Tilemap Chunk Asset, strips semantic authoring fields from Cells, and prunes dependencies referenced only by unused Chunks. It contains no Chunk loader, renderer, stamp API, metadata, or runtime solver. Stamping followed by Chunk deletion must produce the same Playable world as retaining the Chunk.
