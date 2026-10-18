# Nine-Slice Rendering Contract

Nine-slice is `renderMode: "nine-slice"` on Sprite Renderer v8, not a new scene kind. The renderer resolves the current static or animated Sprite Asset and emits up to nine contiguous quad draws for the same Entity, Texture, sampler, sorting identity, depth state, tint, opacity, visibility, Transform, and outer pivot.

Natural border thickness is guide pixels divided by PPU. Center and edges stretch; when the target is too small, the two borders on that axis compress proportionally and the center collapses to zero. Degenerate cells are skipped. Flip X/Y, including directional XOR mirrors, reverses UVs and swaps asymmetric border geometry. Invalid or absent guides use the existing Simple Sprite draw without crashing.

Atlas UVs are split from one shared coordinate grid. Smooth filtering keeps the Phase 018 half-texel protection only at outer sourceRect edges; internal boundaries share exact coordinates. Pixel filtering uses exact boundaries. No Texture, sampler, scene object, or Sprite Asset is created per cell.
