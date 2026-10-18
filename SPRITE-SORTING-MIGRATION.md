# Sprite Sorting Migration

Phase 013 advances Sprite Renderer from version 2 to version 3 and project format from version 4 to version 5.

## Legacy component mapping

For Sprite Renderer version 1 or 2, the legacy integer `layer` field maps as follows:

```text
sortingLayerRef = "sprite-layer-default"
orderInLayer    = legacy layer (or 0 when absent/invalid)
```

The legacy `layer` property is then removed. This preserves the old numeric relative order while moving every old Sprite into the guaranteed Default layer. Both negative and positive values are retained as integers.

Projects without a registry receive exactly one deterministic Default record: `{ id: "sprite-layer-default", name: "Default", order: 0 }`. Existing valid registry IDs are preserved and normalized into explicit contiguous order.

## Compatibility rules

- Current serialization writes only `sortingLayerRef` and `orderInLayer`; it never emits legacy `layer`.
- Missing layer references remain stored so a creator can repair them. Validation identifies the affected Sprite and missing stable ID; runtime rendering temporarily resolves it to Default.
- Phase 011 direct-Texture compatibility and Phase 012 Sprite Asset references are unaffected.
- Prefabs and duplicated Levels use the shared component record path, so the same migration and validation apply everywhere.
- No Phase 014 behavior is introduced.
