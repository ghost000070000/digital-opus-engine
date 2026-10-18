# Tilemap Layer Contract

A Tilemap remains one scene object with one Transform, one Tileset reference, one Sorting Layer, and one Order in Layer. Its version-2 `layers[]` array is canonical bottom-to-top authored order. Each layer contains exactly stable Tilemap-local `id`, unique non-empty `name`, boolean `visible`, boolean `locked`, and sparse `cells[]`.

Layer identity is the owning Tilemap object ID plus Layer ID; names and array positions are not identity. Whole-Tilemap duplication may retain local Layer IDs because the owner identity changes. Layer duplication creates a new local ID and a deep copy. All layers share the Tilemap cell size and Tileset.

At least one layer is mandatory. New Tilemaps contain `tilemap-layer-default` / `Layer 1`, visible and unlocked. Add Layer inserts immediately above the active layer. Duplicate Layer inserts immediately above its source. Delete cannot remove the last layer.

The same `(x,y)` may exist in multiple layers. Cell identity is Tilemap ID + Layer ID + X + Y. Per-layer transient indexes provide constant-time lookup without entering serialized data. Cells serialize canonically by Y then X while layer sequence remains authored order.
