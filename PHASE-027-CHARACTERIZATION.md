# Phase 027 Characterization

## Camera behavior

- The current runtime camera exposes an eye position plus a transient `shakeOffset`. Parallax samples `eye - shakeOffset`, so shake continues to move the whole rendered scene without depth-layer shearing.
- The active authored camera preset ID is the camera identity. The session default camera has a stable synthetic identity. Identity changes recapture the reference at the new camera's current position, preventing an artificial switch jump.
- Fresh Play captures after player spawn. Stop and level changes discard the old reference. Rotation is projection behavior only and is not part of parallax math.

## Rendering boundary

- `Entity.spriteRenderOffset` is transient render state. Simple Sprite and Nine-Slice model matrices consume it; authored `Entity.position` and serialized Transform remain unchanged.
- Hierarchy resolves first. Parallax does not propagate from a parent; every Sprite resolves its own optional layer.
- Sorting tuple, authored Z, depth testing, Sprite Asset choice, animation timing/state/events, direction, flip, tint, opacity, pivot, and dimensions stay independent.
- Billboard and Mesh remain outside the Sprite Renderer eligibility boundary.

## Compatibility and limits

- Sprite Renderer schema is v9; v8 and earlier migrate with `parallaxLayerRef: null`.
- No layer and missing layer both render safely as factor `1,1`; only a missing non-null ID validates as an error.
- Sprites / 2D remains B and Animation remains C. Orthographic/pixel-oriented cameras, hardened 2D/3D hybrid rules, Tilemaps, 2D physics/collision, dedicated 2D controllers, infinite backgrounds, and UI Canvas remain future work.

