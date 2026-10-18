# Terrain Weighted Variation Contract

Weighted Terrain uses positive integer weights from 1 through 1,000,000. Percentages are derived help, never stored inputs and never required to sum to 100.

Resolution is authoring-only and pure. Valid, existing variants are sorted lexically by stable Tile ID. A 32-bit FNV-1a hash is calculated over `terrainBrushId`, stable Layer ID, integer X, integer Y, and signed 32-bit Seed, separated by NUL characters. The unsigned hash modulo total weight selects a cumulative range. Tilemap object ID, Brush name, Layer name, UI order, pointer frequency, and paint order are excluded.

Changing Seed, weight, a variant Tile, or variant membership recomputes every cell owned by that Brush. Save/load and export refresh valid outputs synchronously. Broken candidates validate and are ignored if another valid candidate exists; zero valid candidates disable new painting and preserve stored cell outputs. No `Math.random`, stored random float, runtime selection, or per-cell candidate table exists.
