# Sprite Prefab and Serialization Contract

## Canonical scene record

A Sprite is an explicit `kind: "sprite"` scene object. Its ordinary item record owns identity, name, Transform, hierarchy, behaviors, group membership, linked-prefab identity, and prefab parameter overrides. `components.sprite-renderer` owns versioned Sprite appearance and geometry:

- `spriteAssetRef` (preferred shared Sprite Asset identity)
- `sourceTexture` (Phase 011 compatibility fallback)
- `width`, `height`
- `pivotX`, `pivotY`
- `tint`, `opacity`, `visible`
- `sortingLayerRef`, `orderInLayer`

Viewport handles, aspect-lock state, selection, gizmos, decoded image objects, and renderer caches never enter the record.

## Determinism and migration

Known current records normalize through the component schema, which emits declared fields in schema order and preserves safe extension fields deterministically. A serialize → deserialize → serialize cycle is stable for relevant Sprite data.

- Version 1: direct Texture remains in `sourceTexture`; integer `layer` becomes Default `sortingLayerRef` plus `orderInLayer`.
- Version 2: `spriteAssetRef` remains stable; old `layer` migrates the same way.
- Version 3: stable Sorting Layer ID and Order in Layer are already canonical.
- Version 4: bounded per-instance opacity is canonical; older known versions default to fully opaque.
- Newer versions: data is preserved inertly and validation emits a creator-visible warning. It is not destructively downgraded.

Migration is load-time normalization. Existing project files are not mass rewritten.

## Prefabs and instances

Save as Prefab calls the shared `serializeItemRecord` path. Sprite has no alternate prefab serializer. Placement and linked update call the same `instantiateSpriteRecord` used by scene loading.

Each instance receives independent Transform, component data, size, pivot, tint, sorting, and prefab parameter objects. Instances share the referenced Sprite Asset by stable ID. Sprite Asset metadata is stored once in the project asset collection; its Texture payload is referenced by stable Texture ID.

Linked update follows the existing generic bounded model: replace the instance with a fresh copy of the current prefab, preserve the instance name/tags/variables and prefab parameter overrides that the generic workflow supports, and do not perform per-field override diff/merge.

## Dependencies and failure behavior

The export closure is:

`Sprite instance → linked Prefab (when linked) → Sprite Asset → Texture`

Missing references are never silently substituted or name-matched. Missing Sorting Layers retain their stable ID and render with the Phase 013 fallback order until repaired. Project Validation reports the object or prefab, component/field, missing reference type, offending value, and repair context. Missing Sprite Assets, missing source Textures, missing Sorting Layers, and newer unsupported Sprite Renderer versions leave the project loadable.

## Portability boundary

Whole-project Save/Load and Editable Export are the supported portable containers. A prefab copied without its project-level Sprite Asset, Texture, or Sorting Layer keeps dangling stable IDs and validates after import. Phase 016 does not add a cross-project asset package manager, universal prefab variants, or a new clipboard format.
