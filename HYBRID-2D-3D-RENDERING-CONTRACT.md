# Hybrid 2D / 3D Rendering Contract

## Authoritative pass order

The renderer partitions visible entities into three deterministic passes:

1. **Opaque 3D** — opaque Meshes and opaque Billboards, depth test enabled, depth writes enabled.
2. **Transparent 3D** — alpha Meshes and alpha Billboards, sorted far-to-near by camera distance, depth test enabled, depth writes disabled.
3. **Sprites** — sorted by Sprite Sorting Layer order, Order in Layer, and stable Object ID, depth test enabled, depth writes disabled.

A Billboard has no Sprite Renderer component, so it can never enter the Sprite pass accidentally.

## Occlusion and overlap

- Opaque 3D geometry remains authoritative in the depth buffer. A nearer wall, Mesh, or opaque Billboard can occlude a Sprite.
- Sprite Sorting Layers do not provide X-ray behavior through opaque geometry.
- Transparent 3D draws before Sprites. A Sprite can draw over a transparent Mesh or alpha Billboard where opaque depth permits.
- Transparent Mesh/Billboard overlap is the existing bounded far-to-near approximation. Intersecting or cyclic transparent geometry is not universally correct.
- Sprite/Sprite overlap is independent of camera distance and Transform Z; it follows the named-layer tuple.
- Opaque Billboard/Billboard overlap follows ordinary depth. Alpha Billboard/Billboard overlap follows transparent 3D distance sorting.

## Perspective and camera-facing behavior

Sprites retain authored world orientation under perspective. They may appear foreshortened or edge-on when the camera moves because they are real stable planes.

Billboards recompute world orientation from their resolved world position to the camera every update:

- Full mode follows pitch and yaw.
- Cylindrical mode ignores vertical camera offset and stays upright.

Hierarchy composition runs first. A parent can carry a Billboard through the world and scale it, after which the Billboard faces the camera in world space.

## Lighting

Sprites are unlit alpha surfaces.

Billboards use the generic 3D material path. They respond to scene lighting unless Unlit is selected, and retain generic color tint, alpha, emissive, and UV controls.

## Intended use cases

- Sprite: 2D characters, UI-like world elements, authored flat art, layer-controlled effects, and hybrid scenes where the plane orientation is meaningful.
- Billboard: foliage impostors, signs, distant effects, markers, and 3D imagery that must remain camera-readable.

## Deliberate limitations

This contract is deterministic but bounded. It does not claim universal order-independent transparency, per-pixel sorting across intersecting transparent surfaces, pixel-perfect projection, or a universal 2D/3D render queue. No renderer rewrite or new public rendering API is part of Phase 014.

