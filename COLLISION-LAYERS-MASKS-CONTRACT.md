# Collision Layers and Masks — Phase 049

Project `collisionLayers` is an ordered registry of `{id,name,order}` records, bounded to 32 including the reserved `collision-layer-default` / Default record. IDs, not names or row positions, own semantics. Rename and reorder never rewrite filter memberships. Names are nonempty, trimmed, case-insensitively unique; Default cannot be renamed or deleted.

Box Collider 2D, Circle Collider 2D, and Trigger Collider 2D schema v2 each own `collisionLayerRef`, `collisionMaskMode` (`all` or `custom`), and `collisionMaskRefs`. Every Tilemap v6 Layer owns the same fields. Body, Character, and Moving Platform components do not own a second filter. A v1 collider or v1–v5 Tilemap migrates explicitly to Default / All / an empty reference array. Current-schema missing references remain repairable errors; they are not silently replaced.

An actual geometry pair interacts if both primary IDs are uniquely present in the registry and each mask accepts the other's primary ID. All accepts existing and future layers. Custom accepts only listed existing identities; empty Custom accepts nothing. Missing primary references fail closed. Missing mask references cannot accept geometry and produce validation issues. Object tags, rendering layers, visibility, and Inspector lock state do not define this predicate.

Filtering precedes AABB/narrowphase work and uses actual Box/Circle/Trigger/Tile geometry, not an object-wide approximation. Accepted physical pairs preserve Static/Kinematic and Character response; accepted Trigger pairs preserve object-pair-deduplicated Enter/Stay/Exit. Changing a mask clears stale support or Trigger membership on the next tick. Restoring eligibility produces a new Enter. Slopes, steps, one-way surfaces, moving support, and rider clearance use this same rule.

The Project tab exposes Add, explicit Rename (or Enter in the name field), reorder, usage counts, replacement selection, and confirmed Delete. Referenced primary assignments require an explicit surviving replacement. Delete removes only memberships in the deleted ID and is one existing Undo transaction across current/off-scene objects and Prefabs. The Inspector offers named Layer selection, All/Custom, searchable checkboxes, Select All, Clear All, defaults, and validation.

Persistence and packaging share project/component/Tilemap serialization. Editable and Playable exports embed the filter runtime before collider/body/trigger consumers. Tilemap Bundles collect required IDs, including marker Prefab dependencies, remap colliding nonreserved IDs structurally, and never merge semantic identity by display name. Default retains its reserved identity.

This is not a global collision matrix, Dynamic physics, gravity, a general input/jump/drop-through controller, or a universal physics debug overlay. Ordinary Kinematic/Kinematic response and Trigger-vs-Trigger targeting remain outside scope.
