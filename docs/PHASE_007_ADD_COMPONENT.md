# Phase 007 — Searchable Add Component

## Outcome

The Inspector now exposes an obvious `Add Component` action for every single selected object. It opens a compact searchable dialog whose content comes directly from the authoritative Phase 002 schema registry. There is no separate component catalog and no per-component Add button.

`PHASE_007_SEARCHABLE_ADD_COMPONENT_READY`

## Discovery contract

`OpusAuthoring.discoverComponents(target, query)` walks the registry's existing stable order (`schema.inspector.order`, then schema ID), retains only schemas explicitly marked `addable: true`, applies the existing eligibility predicate, and token-matches normalized query text against display name, stable ID, and category. Empty search groups results by their live schema categories. Incompatible schemas are omitted because they cannot produce a useful action for the current target.

Every result uses schema-owned `displayName`, `category`, optional `icon`, and `help`. Internal IDs remain searchable for advanced use but do not dominate the result presentation.

## Addability and multiplicity

Addability is explicit and inspectable:

- schema `addable` defaults to `false`, keeping internal or automatically managed schemas out of the creator picker;
- production creator components opt in with `addable: true`;
- current component records are keyed once by schema ID, so the supported `multiplicity` is explicitly `single`;
- a present singleton appears disabled with `Already added.` for a matching search and cannot be added again;
- unsupported multiple-instance declarations fail during registration rather than silently changing serialization shape.

When every compatible component is present, empty search says `All available components are already on this object.` A query with no result says `No matching components.` A target with no compatible schemas gets its own accurate empty state.

## Add transaction

`OpusAuthoring.addComponent(target, schemaId, options)` is the authoritative transaction entry point. It rechecks schema existence, explicit addability, live eligibility, and singleton presence before mutation. Only a valid action invokes `onBeforeChange` once, then delegates component construction to `ensureComponent`, which creates the versioned record from schema defaults and runs the existing runtime/compatibility adapter. It returns the existing schema validation result and invokes one completion callback.

The editor supplies `pushUndo` as `onBeforeChange`, so one click/Enter creates one history snapshot—not one per default field. That same history snapshot removes the component on Undo and restores it on Redo. The existing Undo history remains the project's dirty-state signal.

## Inspector and validation integration

After addition, the Inspector is rerendered without changing the selected object. Registered components that do not have an older hand-placed mount slot receive a generic `data-schema-slot` automatically. Phase 006 then renders their declared primitive fields; Phase 003 supplies typed-reference options and project validation. Valid defaults generate no synthetic warnings.

Focus moves to the new component section after addition without focusing a field, which preserves the one-entry Add transaction. Cancelling returns focus to the Add Component button.

## Keyboard and responsive behavior

- Enter or Space on Add Component opens the dialog.
- Search receives focus immediately and typing filters synchronously.
- Arrow Down/Up changes the active enabled result.
- Enter from search adds the active result.
- Escape cancels without mutation and restores opener focus.
- Tab/Shift+Tab traverse and remain within the modal surface.

The dialog exposes dialog, combobox, listbox, option, expanded, selected, active-descendant, and disabled semantics. It has one vertical result scroll region and viewport-based maximum dimensions. Browser characterization passed at 1366×768 and 1920×1080.

## Persistence and runtime parity

No Add-Component-specific storage exists. Added records flow through the existing component serializer and therefore retain parity across scene snapshots, Save/Load, duplicate, prefab payload/instance reconstruction, editable export, playable export, and existing runtime adapters.

## Adding a new schema component

1. Register the schema with `addable: true`, creator-facing metadata, eligibility, defaults, and fields.
2. Retain `multiplicity: 'single'` for the current component-bag format; omit addability for internal/managed schemas.
3. Supply a runtime adapter only if the capability needs runtime behavior.

Primitive Inspector UI, search results, keyboard behavior, validation, Undo, persistence, and export are generic. A test-only fixture proves this route with string, number, enum, Vec2, and object-reference fields. A Sprite-shaped architecture fixture proves asset reference, pivot/size Vec2, tint, sorting layer, and integer order require no picker or primitive-control changes; Sprite itself is not implemented.

## Known limitations

- The live production registry currently contains Health, Trigger Volume, and Particle Emitter. Eligibility correctly means Health is attachable to an ordinary cube; Trigger Volume and Particle Emitter remain tied to their existing compatible object kinds/presets.
- Legacy capabilities that are not registered schemas, including Behaviors, remain in their existing conditional Inspector surfaces.
- There is no generic safe Remove Component UI. Immediate Undo removes a newly added component correctly; a broader removal lifecycle is intentionally deferred rather than improvised here.
- Multi-object/bulk Add, presets, dependencies, favorites, recents, marketplace/package behavior, and user-authored schemas are outside Phase 007.
