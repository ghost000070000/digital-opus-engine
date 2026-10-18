# Nine-Slice Authoring Contract

The Sprite Asset Inspector owns Enable, Left, Right, Top, Bottom, Clear, source-region dimensions, and a visible four-guide overlay. Guides begin at zero. Phase 026 uses numeric editing rather than draggable guide lines because the existing preview already reserves dragging for source-region move/resize; this keeps the two coordinate-editing gestures unambiguous.

Sprite Renderer exposes Simple and Nine-Slice. Placement remains conservatively Simple even when an asset has guides. Width/Height, viewport resize handles, aspect lock, Use Natural Size, selection, and picking retain the outer rectangle. Validation focuses asset errors on `nineSlice` and renderer fallback errors on `renderMode`. Save/Load, duplication, Prefabs, levels, and exports use existing shared serialization paths.
