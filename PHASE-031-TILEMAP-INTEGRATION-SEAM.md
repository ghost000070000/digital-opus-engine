# Phase 031 Tilemap Integration Seam

Phase 031 deliberately stops at reusable Tileset and Tile Palette authoring. A future Tilemap/Grid system may reference a Tileset by stable project asset ID and cells by stable Tile ID local to that Tileset. It must not embed Sprite records, Texture bytes, atlas rectangles, or names as identity.

The future system owns world grid dimensions, origin, orientation, layers, sparse/dense cell storage, painting/erasing, renderer batching, collision extraction, and runtime export roots. None of those concerns belongs in the Tileset v1 record.

`cellSize` is descriptive authored world-space intent for future grid consumers. Tile art can differ in source-pixel size, pivot, and Pixels Per Unit; a future renderer must define fit/anchor policy explicitly instead of mutating Sprite Assets or inferring identity from visual dimensions. Tileset v1 remains compatible if later versions add opt-in metadata through versioned migration.

Tile animation, terrain/biome rules, auto-tiling, per-cell transforms, tint, collision shapes, and custom properties remain separate future contracts. Phase 032 may consume this seam but was not started here.
