# Digital Opus Authoring Schema Contract

## Purpose and boundary

The authoring schema registry is a declaration seam between creator-facing data and the existing runtime. It describes identity, eligibility, fields, Inspector controls, validation, and persistence. It is not a second runtime and does not own transforms, rendering, physics, Actions, AI, or export execution.

Phase 002 deliberately proves this seam with Health, Particle Emitter, and Trigger. Existing Inspector sections and legacy object fields continue to coexist with schema-rendered sections. A broad component migration and the public Add Component browser remain later work.

The implementation is `editor/src/00-authoring-schema.js`. It is a plain browser global (`OpusAuthoring`) and a CommonJS module so the editor, exports, build tooling, and dependency-free tests exercise one contract.

## Registry entry

Each registered schema declares:

| Property | Contract |
|---|---|
| `id` | Stable lowercase component ID; unique in the registry. |
| `displayName` / `category` / `help` | Creator-facing presentation metadata. |
| `version` | Positive integer version of that component record. |
| `eligibility` / `isEligible` | Declarative target kinds or a bounded predicate. |
| `fields` | Ordered field descriptors. |
| `defaults` | Authoring defaults used for missing data. |
| `ownedFields` | Explicit fields the component owns. |
| `inspector` | Group and ordering metadata. |
| `serialization` | Owner ID plus duplicate and prefab policies. |
| `runtimeFields` | Explicit transient keys excluded from persistence. |
| `validate` | Returns structured creator-facing issues. |
| `migrate(record, fromVersion)` | One-version-at-a-time migration hook. |
| `readLegacyRecord` / `readTarget` / `applyTarget` | Compatibility bridge to existing record/runtime ownership. |

The registry rejects duplicate or malformed IDs, unsupported field types, absent eligibility metadata, invalid versions, and owned fields without descriptors.

## Eligibility

The vocabulary supports `scene-object`, `player`, `camera`, `terrain`, `trigger`, `path`, `emitter`, `sprite`, and `any`. Phase 002 attaches only the three proof components. `sprite` is a declarative eligibility value only; no Sprite object or behavior exists yet.

## Field descriptor and renderer

A field declares `key`, `label`, `type`, optional `group` and `order`, plus relevant constraints such as `min`, `max`, `step`, `choices`, `choiceLabels`, and `nullable`. Reference descriptors also expose `referenceType`.

The supported field types are:

- `boolean`, `number`, `integer`, `string`, `color`, `enum`, `vec2`, `vec3`
- `assetRef`, `objectRef`, `levelRef`, `objectiveRef`, `prefabRef`

Controls are checkbox, numeric/text/color input, select, or grouped vector inputs. Numbers are finite, integers are rounded, colors normalize to lowercase `#rrggbb`, enums must use a declared choice, vectors normalize to numeric arrays, and references normalize to a stable string or their declared empty default.

The renderer uses `data-component-field` attributes instead of unique IDs. It renders the component title/help, ordered controls, and structured validation issues. The editor supplies callbacks for an Undo snapshot before the first edit focus, post-change viewport refresh, and reference options. Reference options reuse the existing object, asset, level, objective, and prefab collections; Phase 002 does not introduce a parallel picker framework.

## Validation

Validation returns records shaped as:

```json
{
  "componentId": "health",
  "field": "max",
  "severity": "error",
  "code": "below-minimum",
  "message": "Maximum Health must be at least 0.01."
}
```

Generic constraints and each schema's bounded validation hook share this shape. Phase 002 displays issues within a component section; a full project-wide validation surface belongs to Phase 003.

## Proof schemas

| ID | Eligibility | Owned fields | Existing runtime owner |
|---|---|---|---|
| `health` | scene object | `max`, `current` | `item.health` |
| `particle-emitter` | emitter | `rate`, `spread`, `gravity`, `maxParticles` | `item.options` and emitter handle |
| `trigger` | trigger | `repeat`, `shape` | `isTrigger`, `triggerRepeat`, `triggerShape` |

All three render fields through the shared renderer while retaining their existing runtime behavior and legacy data paths.

## Future Add Component and Sprite use

The internal Add Component contract is `registry.list()` plus eligibility filtering and `ensureComponent(target, schemaId)`. Phase 007 can place a polished discovery UI over that contract without changing component records.

Phase 011 can register a `sprite-renderer` schema eligible for `sprite`, declare fields such as asset reference, pivot (`vec2`), size, color, sorting layer, and order, and supply a small runtime bridge. It can use the existing generic Inspector renderer, validation issue format, component serializer, duplicate/prefab route, and common export composer. Sprite assets and rendering behavior still require their own later runtime and asset work; the authoring seam does not pretend they already exist.

