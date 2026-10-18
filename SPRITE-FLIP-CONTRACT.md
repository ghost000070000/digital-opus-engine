# Sprite Flip Contract

Sprite Renderer v7 owns `flipX` and `flipY` booleans. Both default to `false` during migration, so historical output is unchanged. Flip is presentation data: it reverses the selected UV endpoints while leaving Transform, geometry, Width, Height, pivot, hierarchy, and selection bounds unchanged.

`spriteSourceUV` remains the sole source-region and half-texel calculation. `applySpriteUVFlip` then reverses U and/or V inside those exact endpoints. Full-image, atlas, Smooth, Pixel / Nearest, static, and animated Sprites therefore share one implementation and no Texture is recreated.

Directional mirroring composes with instance Flip by XOR: `effectiveFlipX = flipX XOR mirrorX` and likewise for Y. Negative Transform Scale is not synchronized with either field.
