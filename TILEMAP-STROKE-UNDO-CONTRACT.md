# Tilemap Stroke and Undo Contract

One pointer-down/drag/up gesture is one undoable stroke. The editor captures a snapshot only when the gesture first changes a cell; no-op strokes add no history entry. All interpolated cells belong to the same transaction. Undo and Redo restore scene records and Tilesets through the existing shared snapshot history. Pointer-up, window blur, Escape, tool exit, selection change, load, and mode changes terminate transient stroke state.
