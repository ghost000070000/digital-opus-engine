# Sprite Filtering Contract

## Sampler semantics

| Creator choice | Stored value | MIN filter | MAG filter | Mip sampling |
|---|---|---|---|---|
| Smooth | `linear` | `LINEAR_MIPMAP_LINEAR` | `LINEAR` | enabled |
| Pixel / Nearest | `nearest` | `NEAREST` | `NEAREST` | disabled |

Texture wrap remains `REPEAT` on both cached samplers to preserve the engine's existing low-level Texture behavior. Phase 018 atlas regions are computed centrally from creator-facing pixel rectangles; wrapping remains hidden because bounded Sprite regions do not expose normalized UV authoring.

## Shared-Texture isolation

Filtering is not written back onto the WebGL texture object at draw time. The renderer uploads each Texture once, creates the Smooth and Pixel samplers once, binds the selected sampler to texture unit zero for a draw, and unbinds it after rendering. Therefore a Smooth Sprite and Pixel Sprite can alternate draws while sharing one Texture handle without state leakage or duplicated image bytes.

## Compatibility

Historical Texture creation generated mipmaps with linear minification/magnification. Consequently, `linear` is the load default for Sprite Asset v1 and missing-field records. Direct Texture users, Meshes, and Billboards also resolve to `linear` unless a future explicit contract says otherwise.

Filtering affects texel reconstruction only. Phase 018 adds a half-texel base-level inset for Smooth regions, while extreme mip minification can still bleed without source gutters. Filtering does not promise pixel-perfect camera projection, integer world placement, or 2D animation.
