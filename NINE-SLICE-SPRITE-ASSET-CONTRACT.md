# Nine-Slice Sprite Asset Contract

Sprite Asset v4 owns optional `nineSlice` metadata: `{ left, right, top, bottom }`. Values are finite, non-negative source pixels relative to the effective Sprite Asset region: `sourceRect` when present, otherwise the full Texture. Zero is valid. Historical assets normalize to `nineSlice: null`; changing the Texture, source region, or PPU never silently rescales guides.

Left plus Right must not exceed region width; Top plus Bottom must not exceed region height. Missing source dimensions preserve the record and produce a separate warning. Duplicating an asset deep-copies guides while retaining the ordinary shared Texture reference.
