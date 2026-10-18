# Phase 015 Characterization — Sprite Authoring Before Direct Manipulation

## Baseline

- Commit: `f1dc3516b585ebf5aa868006792c1dc1b9039da9` (`main`)
- Working tree at start: 287 existing modified/untracked paths; preserved in place.
- Engine build: 159,879 bytes raw / 41,277 bytes gzip.
- Demo export: 177,773 bytes.
- Integrated suite: 498/498 checks passed.
- Focused suites: Phase 011 26/26, Phase 012 36/36, Phase 013 38/38, Phase 014 36/36.
- Games catalog: 28/28 valid, 115.4 MB packaged.

## Existing behavior

- Sprite picking already intersects the Sprite Renderer rectangle in the entity's oriented plane. Width, Height, normalized Pivot, world rotation, Transform Scale, and the hierarchy-resolved transform all participate in hit testing.
- The selected-object visualization does not match that picking model. Sprites receive the same small ground-level cube marker used for 3D objects, so a selected Sprite's visible authored rectangle is not shown.
- Width and Height are editable only as numeric Sprite Renderer fields. Viewport Scale handles edit Transform Scale, which is correctly separate data, but there is no direct Width/Height gesture.
- Pivot X/Y are numeric fields. Nine Inspector presets and Sprite Asset pivot/natural-size conveniences exist, but there is no viewport pivot control.
- `Use Source Aspect` is a one-shot Inspector action. There is no optional aspect constraint for resize gestures.
- Sprite Renderer numeric edits update the runtime renderer immediately. There is no direct-manipulation overlay to keep synchronized.
- The generic transform gizmo supports multi-selection. A bounded single-Sprite direct-manipulation mode has not yet been characterized or implemented.
- Existing transform snapping owns position/rotation/scale increments. There is no second Sprite-specific snapping system.

## Material gap selected for Phase 015

Keep the existing Sprite Renderer component as the only owner of Width, Height, Pivot, appearance, and sorting. Add an editor-only projected frame plus resize/pivot handles for exactly one selected Sprite. Resize edits Width/Height; the existing Transform Scale gizmo continues to edit Transform Scale. One pointer gesture must create one Undo entry, and no handle/session state may enter project serialization.

