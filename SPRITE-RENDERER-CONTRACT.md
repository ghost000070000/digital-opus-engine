# Sprite Renderer Contract

`sprite-renderer` is a version-1, automatically owned, non-addable authoring component registered as **Sprite Renderer**. Its bounded fields are Texture Asset reference, Width, Height, Pivot X/Y, Tint, Visible, and integer Layer. The generic schema Inspector and typed asset picker edit these fields.

Width and Height are positive finite world units. Pivot values are normalized to 0–1. Tint multiplies RGB while texture alpha and entity alpha keep the existing source-alpha blend semantics. Sprites are always unlit.

The runtime draws opaque and transparent meshes first, then Sprites in a distinct pass. Sprites sort by integer layer ascending; ties use monotonic creation order ascending. Depth testing remains enabled against opaque 3D geometry, while Sprite depth writes are disabled. This guarantees deterministic Sprite-to-Sprite layers but does not claim a complete ordering contract against transparent Meshes.

A missing referenced Texture is preserved, reported by Project Validation, and rendered through a safe placeholder. Dependency collection follows the typed reference and embeds used textures without changing unused-asset pruning.
