# Auto-Tile Set Contract

Auto-Tile Sets are ordered, Tileset-local authoring records in Tileset v3. Each owns a stable local `id`, creator-facing case-insensitively unique `name`, `neighborMode` (`four-way` or `eight-way`), required `defaultTileId`, and deterministic `rules` containing only `{ mask, tileId }`.

Names may change without changing identity. Tile references resolve only inside the owning Tileset. Sparse rule coverage is valid because any unmapped mask uses the Default Tile. Duplicate masks, missing output Tiles, unsupported modes, and missing defaults are validation errors. The record contains no weights, priorities, random choices, terrain data, or scripts.

Auto-Tile Sets are authoring-time data. They select a resolved Tile for each managed cell; they do not create a gameplay API or runtime solver.
