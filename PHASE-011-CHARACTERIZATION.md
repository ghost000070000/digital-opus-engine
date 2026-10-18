# Phase 011 Characterization

The focused suite is `tests/phase-011-sprite.test.js`. It protects explicit Sprite identity; schema ownership and fields; typed Texture filtering; size, pivot, tint, visibility, and layer normalization; deterministic rendering order; pivot-aware selection; Transform and hierarchy participation; duplicate and snapshot independence; scene/prefab/level record paths; missing-reference validation; dependency inclusion; export path reuse; placeholder behavior; and Billboard separation.

Browser dogfood evidence is recorded in `phase-011-dogfood.json`, with four visual captures emitted in the Phase 011 task. The proof scene uses normal editor controls and covers four Sprites, overlap, pivots, tint, rotation, hierarchy, Save/Load, Duplicate, Undo/Redo, Prefab, validation, and Playable Export.
