# Sprite Sorting Layer Contract

Phase 013 defines one deterministic project-level presentation order for Sprite Renderer instances. It does not add animation, Tilemaps, camera modes, or 2D physics.

## Project registry

`spriteSortingLayers` is an ordered array of bounded records:

```json
{ "id": "sprite-layer-3", "name": "Actors", "order": 3 }
```

- `id` is stable identity and is serialized in Sprite Renderer component records.
- `name` is editable presentation. Names are non-empty and unique case-insensitively.
- `order` is explicit, unique, integer, contiguous project order. Lower layers draw first/behind.
- `sprite-layer-default` is always present as `Default`; it cannot be renamed or deleted.
- New IDs are generated from the project registry and are not derived from a display name.

Project settings expose add, rename, move up/down, and delete. Renaming preserves every reference. Reordering immediately refreshes resolved runtime layer order. Deleting a referenced layer reports the exact number of affected Sprites and proceeds only after explicit confirmation, reassigning those component references to Default. Project-layer management follows the existing project-settings non-Undo boundary.

## Sprite Renderer schema

Sprite Renderer version 3 owns two instance fields:

- `sortingLayerRef`: required typed `sortingLayerRef`, storing the stable project-layer ID.
- `orderInLayer`: required integer, with negative, zero, and positive values allowed.

The Sprite Asset remains reusable artwork only and never owns instance sorting. Component edits use the existing reusable Inspector field callbacks and therefore remain ordinary object Undo/Redo edits.

## Runtime ordering

Every rendered Sprite receives a resolved tuple:

1. project `layer.order` (a missing reference falls back to Default for runtime continuity);
2. component `orderInLayer`;
3. persisted stable Object ID, compared lexically.

That tuple is the complete Sprite-to-Sprite order. It never depends on creation/insertion order, camera distance, frame timing, array stability, or Transform Z. Transform Z remains spatial position. Transparent Sprite blending and disabled depth writes remain unchanged from Phase 011; Phase 013 only makes Sprite submission order explicit.

## Persistence and references

The project registry and component fields survive Save/Load, Project JSON, Prefabs, Level duplication, Editable Game export, and Playable Game export. A cross-project Prefab keeps its stable layer ID; if the destination project lacks it, validation reports a focused missing reference rather than silently replacing it.

Validation covers missing Default, invalid/duplicate IDs, empty/duplicate names, invalid/duplicate order, missing `sortingLayerRef`, and non-integer `orderInLayer`.
