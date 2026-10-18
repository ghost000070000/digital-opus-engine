# Sprite Direct-Manipulation Contract

## Authoritative state

The Sprite Renderer component remains the sole owner of `width`, `height`, `pivotX`, and `pivotY`. Transform position, quaternion, and scale remain ordinary Transform state. The viewport frame, handles, aspect-lock toggle, and active pointer gesture are editor-only projections and are never serialized.

## Selected frame

For exactly one selected Sprite in Edit mode, the editor computes the local rectangle:

- left = `-pivotX * width`
- right = `(1 - pivotX) * width`
- bottom = `-pivotY * height`
- top = `(1 - pivotY) * height`

Each corner is transformed with the hierarchy-resolved entity position, right/up axes, and Transform Scale, then projected through the active camera. The frame therefore follows Width/Height, Pivot, full rotation, Scale, and parent transforms. The old generic cube ground marker is hidden for Sprites.

## Resize interaction

Eight frame handles edit Sprite Renderer Width/Height. They do not edit Transform Scale. Cursor motion is resolved against the Sprite's projected local X/Y axes, keeping steep-angle interaction bounded; a fully edge-on/degenerate projection refuses the gesture with guidance to orbit the camera.

The Transform origin is fixed during Width/Height editing. Resize therefore expands or contracts geometry around the current pivot. An edge coincident with the pivot is pinned on that axis, because moving it would require an undocumented Transform-position change; use the opposite handle to resize that axis.

If the editor's existing Snap toggle is enabled, Sprite dimensions reuse its Scale increment. No second 2D snapping engine exists. One pointer gesture captures one Undo snapshot on its first movement, regardless of pointermove count.

## Aspect handling

`Lock Aspect Ratio (current size)` is temporary editor-session state. A resize gesture captures the Sprite's current Width/Height ratio at gesture start and preserves it. `Use Source Aspect` remains an explicit one-shot convenience. Neither permanently binds an instance to its source image.

## Pivot interaction

The yellow pivot handle edits normalized `pivotX`/`pivotY`, clamped to `[0,1]`. The chosen model is **fixed Transform origin**: moving Pivot changes where artwork lies around the existing world Transform position. Transform position never changes silently. `Move Pivot Without Moving Artwork` is intentionally deferred because the fundamental contract is clearer without a second mode.

The nine presets—Center, Bottom Center, Top Center, Left Center, Right Center, Bottom Left, Bottom Right, Top Left, and Top Right—write the same two pivot fields and are individually Undoable.

## Inspector and synchronization

The existing reusable fields are presented under Source, Geometry, Appearance, and Sorting. Presentation does not duplicate ownership. Numeric edits update the projected overlay immediately; viewport gestures update the same live Inspector controls immediately and rerender the Inspector at gesture completion.

`Use Natural Size` sets per-instance Width/Height to source pixels divided by Sprite Asset PPU and creates one Undo entry.

## Boundaries

- Direct Sprite manipulation is visible only for one selected Sprite. Existing generic multi-selection and Transform gizmos are unchanged.
- Transform Scale remains available separately through the generic Inspector/gizmo.
- Prefab, duplicate, Save/Load, Undo/Redo, Editable Export, and Playable Export continue through ordinary Sprite records.
- No Sprite animation, atlas slicing, orthographic camera, Tilemap, 2D physics, filtering expansion, 2D Transform replacement, or advanced Sprite multi-selection system is introduced.

