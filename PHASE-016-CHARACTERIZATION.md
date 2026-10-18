# Phase 016 Characterization

## Existing behavior retained

- Prefab saving already used `serializeItemRecord` for a single Sprite or an assembly.
- Prefab placement already dispatched Sprite records to `instantiateSpriteRecord`.
- Component normalization already migrated v1/v2 Sprite Renderer data to v3, preserved future versions inertly, and deep-copied component records.
- Sprite Asset duplication already produced independent metadata with a shared Texture reference.
- Level duplication already deep-cloned records and remapped object/hierarchy identities.
- Export dependency discovery already followed a used Sprite Asset to its Texture and recursively inspected included prefab records.
- Editable and Playable exports already embedded the same serialized project and editor/runtime implementation.

## Defects found and corrected

1. `serializeSpriteRecord` omitted `sourcePrefabName` and `prefabParams`; `instantiateSpriteRecord` therefore could not restore them. A linked Sprite still looked correct but lost linked authoring semantics, and its prefab could be omitted by pruning.
2. The Sprite branch of dependency collection did not retain a linked prefab by name.
3. Project Validation inspected components in level objects but not components stored only inside prefab definitions.
4. Validation presentation lacked explicit prefab and component-field repair context.
5. The Sprite Inspector did not expose the generic linked-prefab update/unlink controls, and Save as Prefab did not link the source Sprite instance.

## Generic prefab semantics

Update From Prefab is manual and replaces/reinstantiates the linked root. It is not a universal variant system and does not track arbitrary per-field overrides. Existing supported carry-forward behavior—name, tags, variables, and declared prefab parameter overrides—remains unchanged. Sprite Renderer fields participate because the replacement is reconstructed through the shared component record path.

## Cross-project characterization

The supported transfer unit is a saved/imported project or Editable Export. A manually transferred prefab record does not embed Sprite Asset, Texture, or Sorting Layer metadata. Missing dependencies remain stable dangling IDs and are reported; Sorting Layers are not matched by name. This is intentionally repairable rather than silently substituted.

## Stress characterization

The focused suite constructs 100 Sprite records referencing two Sprite Asset IDs. Instance component records remain independent, asset metadata is not duplicated inside instances, and the serialized record set stays compact. This is a sanity qualification, not a performance benchmark.
