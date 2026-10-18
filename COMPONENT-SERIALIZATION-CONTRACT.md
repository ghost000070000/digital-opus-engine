# Digital Opus Component Serialization Contract

## Record shape

Components are an additive property of an existing placed-item record:

```json
{
  "kind": "cube",
  "health": { "max": 100, "current": 100 },
  "components": {
    "health": {
      "current": 100,
      "max": 100,
      "version": 1
    }
  }
}
```

The `components` object is omitted when empty. Keys are stable schema IDs. Each component carries its own integer `version`. Deterministic serialization recursively sorts object keys while retaining meaningful array order.

Phase 002 does not increment or replace project format version 3: component records are additive inside item records, and old readers continue to rely on unchanged legacy fields. Component versioning is deliberately independent of the project envelope version.

## Ownership and saved data

Every known schema declares `ownedFields`. Its serializer reads the existing authoring/runtime owner through `readTarget`, normalizes owned fields, writes the current component version, and retains safe authoring extensions. It strips:

- schema-declared `runtimeFields`;
- every underscore-prefixed transient/cache field.

This preserves the existing project sanitization boundary instead of serializing arbitrary runtime state. Defaults serialize explicitly for a present component, making a record self-describing. Missing known fields normalize to schema defaults.

## Unknown data policy

- Unknown component IDs are retained as inert data, deterministically serialized, and never applied as runtime behavior.
- Unknown fields on a known, supported component version are retained as authoring extensions.
- Declared runtime fields and underscore-prefixed keys are stripped even when otherwise unknown.
- A known component with a newer unsupported version is retained but not normalized, edited, or applied. Validation returns a structured `newer-version` warning.

This policy avoids silent forward-data loss while preventing unknown data from gaining execution authority.

## Versioning and migration

Absent component versions are treated as version 1 for compatibility. For a supported older version, `applyRecord` invokes `migrate(record, fromVersion)` once per version step until the registered version is reached, then normalizes and applies the record. Phase 002 supplies the hook and characterization coverage; no large migration framework or mass migration is introduced.

## Legacy coexistence

The following remain valid and unchanged: `kind:'cube'`, trigger/waypoint/billboard/ramp flags, AI, collider, variables, Player settings, and every existing project record. The three proof components use compatibility bridges:

- top-level `health` remains serialized and is also represented by `components.health` once loaded/saved through the new editor;
- Trigger flags remain the runtime and legacy representation while `components.trigger` owns authoring values;
- emitter `options` and handle remain runtime owners while `components.particle-emitter` owns its four migrated Inspector fields.

An old project without `components` loads through `readLegacyRecord`. An old exported game remains self-contained and runs its already-embedded runtime without depending on this registry.

## Duplicate, Undo, Prefab, and export routes

- Duplicate calls the shared component serializer and applies a deep copy to the new item. Nested extension data cannot be shared mutably.
- Undo/Redo already snapshots `serializeScene()` and reconstructs with `loadScene()`, so component records use the same valid scene representation.
- Prefab saving already calls `serializeItemRecord()` and prefab instantiation already calls the shared item constructors. There is no component-specific prefab serializer.
- Project Save/Load, Editable Export, and Playable Export all consume the same `serializeProject()` component records.
- Both export tiers embed the same schema module and editor/runtime implementation. Their only behavioral difference remains the playable-only editor-access flag.

The runtime does not require editor-only schema metadata. During load, supported proof records are converted through their compatibility bridges to the existing runtime-owned values.

