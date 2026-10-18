# Tilemap Bundle Asset Closure Contract

Closure begins at the Tilemap or Chunk root and its one Tileset. The complete Tileset is included: every Tile, Sprite Asset reference, collision record, Auto-Tile Set/rule/default, Terrain Brush/variant/seed, cell size, folders, and tags. Each required Sprite pulls its Texture. Spawn Markers pull Prefabs by stable name; Prefabs are scanned recursively through structural reference fields for nested Prefabs, sprites, textures, meshes, audio, animations, and sorting layers.

Texture and audio bytes are removed from dependency records and placed in `content.blobs` as `{id, mimeType, sha256, base64}`. `id` is `sha256-<digest>`, so identical bytes deduplicate even when several Assets reference them. Import hydrates those bytes back to local data URLs without network access.

Free-form strings are never treated as references and are never rewritten. Scripts inside imported Prefabs remain data and force the editor trust gate to untrusted.
