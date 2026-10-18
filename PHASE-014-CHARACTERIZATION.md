# Phase 014 Characterization

## Pre-change Billboard audit

This characterization was recorded before changing shared renderer or hierarchy behavior.

### Sprite

- Serialized as an explicit kind "sprite" record.
- Uses the dedicated spriteMesh and spriteRenderer component.
- References a first-class Sprite Asset through spriteAssetId.
- Stores authored size, pivot, tint, visibility, named sorting-layer reference, and order-in-layer.
- Keeps the authored Transform orientation. It has no camera-facing update path.
- Participates in the hierarchy system as a normal transform child.
- Renders in the dedicated Sprite pass after opaque and transparent 3D passes.
- Sprite ordering is deterministic: named layer, order-in-layer, then stable object ID.
- Sprite depth writes are disabled, while depth testing remains enabled.

### Billboard

- Serialized through the legacy generic entity record as kind "cube", mesh "billboard", and isBillboard true.
- Uses the vertical XY billboardMesh, not spriteMesh and not spriteRenderer.
- Uses generic textureAssetId, color, alpha, emissive, UV, and Unlit material fields.
- Supports billboardMode "full" and "cylindrical"; full is the default and may be omitted by serialization.
- Full facing derives yaw and pitch from the vector from the Billboard world position to the camera.
- Cylindrical facing removes the vertical component before deriving orientation, preserving an upright Y axis.
- Participates in ordinary 3D rendering: opaque Billboards are depth-writing opaque entities; alpha Billboards are camera-distance-sorted transparent entities with depth writes disabled.
- Is lit by default and becomes unlit only when the generic material Unlit option is enabled.
- Uses generic mesh ray picking and generic hierarchy, duplicate, prefab, save/load, and export paths.

### Hybrid pass order

1. Opaque 3D entities, including opaque Billboards, with depth test and depth writes enabled.
2. Transparent 3D entities, including transparent Billboards, sorted far-to-near, with depth test enabled and depth writes disabled.
3. Sprites, sorted by named Sprite Sorting Layer, order-in-layer, and stable object ID, with depth test enabled and depth writes disabled.

Consequences:

- A nearer opaque mesh or opaque Billboard can occlude a Sprite.
- Sprite sorting does not bypass opaque depth.
- Transparent meshes and Billboards draw before Sprites; Sprites can therefore overlay them where opaque depth permits.
- Billboard/Billboard alpha overlap uses ordinary 3D distance sorting, not Sprite Sorting Layers.

### Pre-change gaps found

- The Palette entries were visually distinct, but the Billboard entry lacked concise semantic help.
- The Scene tree labeled Billboards as generic Models rather than Billboards.
- Inspector sections did not state the Sprite-versus-Billboard semantic boundary.
- The Billboard update callback ran before hierarchy composition. A parented Billboard could therefore have its camera-facing world quaternion overwritten by its parent/local hierarchy quaternion in the same frame.
- The shipped 28-game corpus contains no Billboard records. Phase 014 therefore uses a frozen legacy Billboard fixture plus dedicated editor dogfood instead of claiming an in-corpus comparison.

### Compatibility baseline

- Git HEAD: f1dc3516b585ebf5aa868006792c1dc1b9039da9
- Branch: main
- Dirty paths before Phase 014: 279
- Engine bundle: 159,879 bytes raw / 41,277 bytes gzip
- Demo bundle: 177,773 bytes raw
- Integrated suite: 462 / 462 passing
- Phase 011: 26 passing
- Phase 012: 36 passing
- Phase 013: 38 passing
- Shipped games: 28 / 28 present, 115.3 MB
- Phase 013 packaged editor baseline: 1,403 KB

## Post-change verification

- Palette, Scene tree, Inspector, and Help now state the boundary directly.
- A dedicated normal-editor project named phase-014-hybrid-dogfood was created, saved, reloaded, played, and exported through both Editable and Playable paths.
- The project contains six authored Sprites plus a duplicate, two real lightweight Sprite Assets (including an RGBA transparency fixture), four named layers including Default, full and cylindrical Billboards plus a duplicate, opaque and transparent 3D geometry, a Point Light, Sprite-to-Sprite parenting, Sprite-to-generic-Mesh parenting, and Billboard-to-Cube parenting.
- Camera angle A used the normal player/chase view. Camera angle B used an authored fixed Camera at [10,5,10], aimed at the opaque scene object and activated with the existing On Start -> Change Camera behavior.
- Visual inspection confirmed opaque occlusion, transparent 3D overlap, layered Sprite overlap, stable authored Sprite planes, camera-readable Billboards, and perspective foreshortening.
- Browser diagnostics reported zero warnings or errors.
- The focused Phase 014 suite passes 36 / 36.
- The strict follow-up dogfood imported `tests/fixtures/phase-014-transparent-sprite.png` through **Import as Sprite**, placed `Transparent Alpha Sprite`, and verified real texture-alpha transparency without adding a Sprite Material-opacity control.
- `Transparent Alpha Sprite` is parented to generic `Transparent Mesh`; that parent runs both **On Start -> Move To (Tween)** and **On Start -> Rotate To (Tween)**. Both behaviors and the child relationship survived Save/Load and editor Play.
- Editable and Playable exports were repeated after these dogfood additions; both completed successfully.
