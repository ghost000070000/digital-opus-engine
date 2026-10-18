# Tilemap Chunk Semantic Resolution Contract

Manual Cells use their stored Tile. Direct Auto-Tile Cells retain Auto-Tile Set identity. Weighted Terrain Cells retain Terrain Brush identity. Auto-Terrain retains both Brush and Auto-Tile Set identity.

The Chunk's stored semantic `tileId` is a resolved preview cache, not destination truth. During planning, weighted Terrain resolves from target Layer ID and destination coordinates. Auto-Tile and Auto-Terrain membership is materialized in one batch, then the canonical destination resolver recomputes the target topology, including existing compatible Cells outside the stamp and old membership removed by overwrite. Adjacent stamps therefore connect, while weighted variation follows a continuous deterministic destination-coordinate pattern.

Rule and Brush changes recompute Chunk-local authoring previews. Runtime consumes only materialized Tilemap Cells; it has no Chunk solver.
