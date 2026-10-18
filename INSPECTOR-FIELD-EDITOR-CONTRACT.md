# Digital Opus Inspector Field Editor Contract

## Purpose and boundary

`editor/src/00-inspector-fields.js` is the reusable, editor-facing control library for schema-declared values. A new schema field supplies metadata and callbacks; it does not need a custom DOM ID, parser, Undo handler, reference picker, or issue renderer. The library does not own runtime behavior, Transform gizmos, project-wide validation, component discovery, or the Phase 007 Add Component workflow.

The bounded field vocabulary is:

- `boolean`, `integer`, `number`, `string`, `multiline`, `enum`, `color`, `vec2`, and `vec3`;
- `assetRef`, `objectRef`, `levelRef`, `objectiveRef`, and `prefabRef`.

Future Sprite Renderer data can therefore declare an asset reference, pivot/size vectors, tint color, sorting-layer string or enum, and integer order without new control code. This contract does not implement Sprite.

## Descriptor

Every field requires a stable `key` and supported `type`. The reusable descriptor accepts:

| Property | Meaning |
|---|---|
| `label` | Creator-facing name; defaults to `key`. |
| `help` | Concise explanation shown next to the field. |
| `defaultValue` | Canonical Reset target and modified-state comparison value. |
| `required` / `nullable` | Empty-value policy. Optional fields default to nullable. |
| `disabled` / `readOnly` | Native non-editable states with an accessible read-only signal. |
| `min` / `max` / `step` | Numeric and vector-axis constraints. |
| `precision` | Decimal normalization for number/vector values. |
| `choices` / `choiceLabels` | Stable enum values and creator-facing labels. |
| `validate(value)` | Optional field-level structured issues. |
| reference metadata | Phase 003 scope, allowed asset types, nullable/self rules, and other option-service filters. |

`min > max`, missing keys, and unsupported types fail at descriptor creation rather than producing an ambiguous control.

## Value behavior

- Numbers must be finite. Integer values round to a whole number. Valid numeric values clamp to declared bounds and normalize to declared precision.
- An invalid temporary draft is shown inline without replacing the last valid model value. Normalized/clamped text is written back on commit (`change`/blur), avoiding per-keystroke cursor jumps.
- Vec2/Vec3 values use grouped X/Y(/Z) native number controls and the same finite, bound, and precision policy per axis.
- Strings preserve creator text. `multiline` is reserved for genuinely multi-line prose/code-like content and uses a native textarea.
- Enums accept declared stable values only and display declared creator labels.
- Colors normalize to lowercase six-digit hex. One paired editor supplies a native visual picker and editable hex text.
- References display labels while storing stable IDs. Nullable references expose None; required references expose Select. A dangling current ID stays visible as `(Missing) …` and is not silently cleared. Option filtering is delegated to Phase 003's reference service.
- Reset returns a defensive clone of the declared default, updates the model through the same change callback, clears invalid draft UI, and removes modified state.

## Shared interaction contract

`mountSection(container, config)` uses generic `data-field-editor-*` hooks, not per-feature DOM IDs. It supports:

- `onBeforeChange(field)` once per deliberate focus gesture, used for one Undo snapshot across vector axes where practical;
- `onChange(field, value, result)` only when the normalized value actually changes;
- `validate()` for shared field plus owning-schema issues;
- native Tab, Shift+Tab, arrow/select, checkbox, text, number, color, and button keyboard behavior;
- `aria-label` on controls and `aria-live="polite"` issue regions.

Rows use a restrained teal left rule only when their value differs from default and an orange rule for invalid drafts. Reset is visible only when useful. Issue severity classes are `authoring-issue-error`, `authoring-issue-warning`, and `authoring-issue-info`; Project Validation remains the aggregate collector.

## Compatibility

The controls also emit the existing `data-component-field` and vector-axis hooks so the bounded Phase 002 integration retains its established test and automation surface. Schema normalization, serialization, runtime application, prefab copying, and export embedding remain owned by the Phase 002/003 seams.
