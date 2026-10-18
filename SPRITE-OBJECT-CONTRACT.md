# Sprite Object Contract

Phase 011 introduces `kind: "sprite"` as a distinct scene identity. It is not a Cube marker and is not migrated from or synchronized with Billboard.

The Transform origin is the Sprite pivot. Local X is width, local Y is height, and local +Z is the front normal. The existing world Transform and hierarchy supply translation, quaternion rotation, and scale; no second 2D Transform exists.

New Sprites are 1×1 world unit, centered at pivot `[0.5, 0.5]`, white, visible, on layer 0, and have no Texture. The missing/no-source state renders a magenta placeholder and remains selectable. Normalized pivot uses `[0,0]` for bottom-left and `[1,1]` for top-right.

Serialization, Undo/Redo, level duplication, Prefabs, Editable Export, and Playable Export use the same ordinary scene record and component paths. Billboard remains the existing camera-facing `kind: "cube"` compatibility object.
