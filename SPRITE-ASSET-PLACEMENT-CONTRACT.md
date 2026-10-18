# Sprite Asset Placement Contract

## Creator workflow

A Sprite Asset row is a placeable source in every normal Assets-library presentation: the root view, Sprite type filtering, search results, and folder/tag-filtered results all render and wire the same row. Dragging begins only after six CSS pixels of pointer travel. A shorter press/release inspects the asset. The row's **Place** button and the command-palette **Place Sprite** action arm the same typed placement path for keyboard and trackpad users; the next viewport click commits it and Escape cancels.

## Typed identity boundary

The internal payload is exactly a Sprite Asset type plus its stable asset ID. It contains no Texture bytes, Sprite metadata snapshot, or display-name identity. The editor resolves that ID against the current Sprite Asset library only when a successful drop commits. Texture, Mesh, Audio, and Prefab concepts keep their existing behavior; a Texture is never implicitly converted into a Sprite.

## Perspective viewport rule

Placement reuses `screenToGroundPoint`, the same camera ray and Y=0 ground plane used by Palette placement. Pointer X/Z map to that intersection; when Snap is enabled, the existing one-world-unit position increment is applied by the shared placement dispatcher. A Sprite's Transform pivot is then set to the canonical Y=1 height used by the existing Palette Sprite entry. The new object has default rotation and scale, remains an authored plane, and never auto-faces the camera. As with other Palette objects, it is created at the scene root.

## Commit data

One successful commit creates one ordinary `kind: "sprite"` object through the normal Sprite record instantiator and `addPlaced` path. It receives a unique Object ID, a collision-safe display name (`Hero`, `Hero 2`, ...), and an automatically-owned Sprite Renderer with:

- the stable Sprite Asset reference;
- initial Width/Height copied from full-image or atlas-region natural size (1×1 placeholder when the Texture is unavailable);
- initial pivot copied from the Sprite Asset;
- white tint, opacity 1, and visible true;
- Default Sorting Layer and Order in Layer 0.

The instance does not copy Texture identity, `sourceRect`, PPU, filtering, or image bytes. Source Texture, source region, and filtering continue to resolve live through the Sprite Asset. Width/Height and pivot are copied only at creation and remain editable instance overrides thereafter. Asset rename therefore cannot break the reference or rename existing objects, and object rename cannot alter the asset.

## Preview, selection, history, and repair

During drag, the ghost uses the asset's existing cropped region preview and a translucent cursor-following presentation; the viewport displays a drop indicator. No scene object, dependency, or Undo entry exists until commit. Outside release, pointer cancellation, invalid ray, stale/missing Sprite Asset ID, or Escape clears all transient state and commits nothing.

A successful drop calls `pushUndo` once, creates exactly one object, selects it, opens the Inspector, and exposes existing move/rotate/scale and direct Sprite resize/pivot tools. Undo/Redo uses the ordinary serialized-scene snapshot model, so identity, transform, renderer fields, and dangling stable references restore without placement-specific provenance. A Sprite Asset with a missing source Texture remains placeable as the established placeholder and Project Validation continues to report the repairable dependency error.

## Explicit non-goals

This contract adds no orthographic or pixel-perfect camera, screen-space placement, animation, Tilemap, 2D physics/controller, bulk placement, generic Asset placement rewrite, Prefab substitution, or Sprite-specific transform mode.
