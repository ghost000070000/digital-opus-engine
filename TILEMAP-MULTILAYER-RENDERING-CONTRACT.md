# Tilemap Multi-Layer Rendering Contract

One Tilemap contributes one sortable Sprite-pass entity. Visible layers are flattened in canonical bottom-to-top order; each layer's cells use deterministic row-major traversal. Hidden layers emit no cell descriptors. Locked visible layers render normally. Empty layers are safe.

All internal layer cells remain contiguous inside the Tilemap's existing Sorting Layer / Order in Layer / stable Object ID slot. Ordinary Sprites cannot interleave between Tilemap layers. Opaque depth, both bounded transparent hybrid bands, Orthographic and Perspective cameras, natural Sprite sizing, atlas UVs, filtering, missing-art placeholders, and the single Tilemap Transform retain their Phase 029–032 behavior.

Layer descriptors are transient and create no scene entity, Texture duplicate, DOM node, or timer per layer or cell. The renderer continues to issue the existing per-cell draw loop inside the one Tilemap entity.
