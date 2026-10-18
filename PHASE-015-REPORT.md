# Phase 015 Report — Sprite Inspector + Viewport Direct Manipulation

## Outcome

Phase 015 adds a real projected Sprite selection frame, eight Width/Height handles, a direct Pivot gizmo, optional current-aspect locking, exact nine-point Pivot presets, and a clear Undoable `Use Natural Size` action. The Inspector now presents the existing Sprite Renderer fields under Source, Geometry, Appearance, and Sorting without changing their schema ownership.

## Implementation

- Added `editor/src/00-sprite-authoring.js`, a bounded renderer-independent math module for Sprite bounds, resize, aspect preservation, Pivot normalization/presets, and natural-size calculation.
- Added an editor-only SVG/DOM viewport overlay projected from hierarchy-resolved Sprite geometry.
- Direct resize writes only Sprite Renderer Width/Height. The generic Transform Scale controls remain separate.
- Direct Pivot uses the fixed-Transform-origin model documented in `SPRITE-DIRECT-MANIPULATION-CONTRACT.md`.
- Reused the existing Snap toggle's Scale increment for dimension snapping.
- Added one-snapshot-per-drag Undo boundaries and immediate numeric/viewport synchronization.
- Added the module to normal editor loading, Editable/Playable export assembly, games packaging, and full engine-site packaging.
- Replaced the materially wrong generic Sprite ground marker with the authored rectangle frame.

## Dogfood

Normal editor controls were used against the local editor on 2026-09-14:

1. Imported `tests/fixtures/phase-014-transparent-sprite.png` with **Import as Sprite**, creating both its Texture and Sprite Asset.
2. Placed the Sprite at natural 0.64 × 0.64 world-unit size and verified the assigned Sprite Asset.
3. Resized Width directly in the viewport to 1.48 while Height remained 0.64; one Undo reverted the gesture and Redo restored it.
4. Enabled Lock Aspect Ratio and resized 0.64 × 0.64 to 0.83 × 0.83.
5. Dragged Pivot directly to approximately `(0.40, 0.63)` and verified Transform position stayed `(-30, 1, -50)`.
6. Applied the Top Left preset and verified exact `(0,1)` fields.
7. Applied Use Natural Size and verified 0.64 × 0.64.
8. Set Tint `#55ffee`, toggled Visible, and set Order in Layer to 4.
9. Set Transform Scale to 5 × 5 × 1 separately from Sprite dimensions.
10. Rotated the Sprite 25° around Z and resized it directly to 1.18 × 1.18 with aspect lock.
11. Parented the rotated Sprite to Crate #2 and verified the projected frame continued following the hierarchy-resolved Sprite.
12. Saved and loaded `phase-015-sprite-authoring-dogfood`; Sprite Asset, natural dimensions, Pivot, Tint, visibility, sorting, and Transform state round-tripped.
13. Saved a normal Sprite prefab named `Phase15 Direct Sprite`.
14. Completed both Editable Game and Playable Game exports; the editor reported success for each.

Dogfood found one real defect during the first aspect-locked pass: ray/plane conversion at a steep camera angle amplified a short drag into thousands of units. The implementation was changed to solve cursor movement against projected Sprite local axes, then the same acceptance path was repeated successfully. A fully degenerate edge-on projection now declines the gesture instead of producing unstable values.

## Verification

- New focused suite: `tests/phase-015-sprite-authoring.test.js` — 41 checks.
- Phase 011: 26/26.
- Phase 012: 36/36.
- Phase 013: 38/38.
- Phase 014: 36/36.
- Standard integrated suite: 539/539 checks passed.
- Engine size baseline remained 159,879 bytes raw / 41,277 bytes gzip; demo remained 177,773 bytes before final packaging.
- Game catalog: 28/28 playable files, 115.8 MB.
- Public games site: 28/28 games, 137.4 MB; path-safety and broken-link checks passed.
- Full engine-site package: 28/28 examples (4 Featured), 217.0 MB; path-safety and broken-link checks passed.

## Deliberate boundaries

- Single selected Sprite only for direct handles; existing generic multi-selection remains unchanged.
- Aspect lock is session-only and not serialized.
- Pivot snapping is deferred; only dimension snapping naturally reuses the existing Scale increment.
- Preserve-artwork pivot mode is deferred.
- No Phase 016 or later rendering/gameplay systems were started.

## Verdict

`PHASE_015_SPRITE_AUTHORING_READY`
