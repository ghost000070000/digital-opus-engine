# Sprite / Opaque Depth Contract

Opaque 3D geometry and opaque Billboards render before Sprites and write depth. Sprites keep depth testing enabled, so their authored world Z can be occluded by opaque geometry. Sprite-to-Sprite presentation does not use Z for ordering; it remains Sorting Layer, Order in Layer, then stable Object ID.

The `spritePassRelation` field has no effect while an object is opaque. The authored value remains serialized for a later change back to transparency.
