# Phase 013 Characterization

The dependency-free suite is `tests/phase-013-sprite-sorting.test.js` and is integrated into `tests/run-tests.js`.

It covers 38 checks across:

- Reserved Default identity, deterministic registry creation/normalization, stable generated IDs, bounded records, explicit contiguous reordering, unique names/IDs/orders, and protected controls.
- Referenced and unused deletion confirmation, exact reference counting, explicit Default reassignment, and project-settings non-Undo documentation.
- Sprite Renderer version 3, typed Sorting Layer reference, integer Order in Layer, removal of creator-facing legacy Layer, and v1/v2 migration with negative and positive values.
- Missing-reference preservation, focused validation, runtime Default fallback, and current serialization without legacy fields.
- The exact runtime tuple: layer order, Order in Layer, stable Object ID; no Transform Z, camera distance, insertion order, or frame-timing dependency.
- Transparent Sprite/depth behavior, Sprite Asset separation, Billboard separation, Prefabs, cross-project Prefabs, Level duplication, Save/Load, Undo callbacks, and shared exports.
- A 300-Sprite stress sequence shuffled repeatedly to prove identical stable output, plus explicit Phase 014 absence.

Browser dogfood uses normal editor controls on a migrated Phase 011 project. It creates Background, World, Actors, Effects, Foreground, and Temporary layers; configures nine overlapping Sprites including negative/positive values and an exact tie; verifies immediate reorder and restore; renames Characters to Actors without changing `sprite-layer-3`; and exercises the referenced-layer safe-delete path, Save/Load, validation, Play, and both HTML export tiers.
