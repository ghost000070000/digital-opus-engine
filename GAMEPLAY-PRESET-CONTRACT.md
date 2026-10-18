# Gameplay Preset Contract

Phase 008 defines a Gameplay Preset as a deterministic creator-facing recipe that configures existing authoring primitives. A preset may write Components, Behaviors, object fields, AI settings, references, and animation clips. It must not introduce a parallel runtime object or a hidden gameplay interpreter.

## Registry contract

The authoritative registry is `editor/src/00-gameplay-presets.js`. Every registration declares:

- a stable lowercase `id`, creator-facing `displayName`, `category`, and concise `description`;
- a positive integer `version`;
- explicit `eligibility`;
- typed `parameters` with defaults and optional bounds/options;
- a deterministic `detect(target)` function for repeat application;
- an `apply(target, parameters, adapter)` recipe;
- a `validate(target, parameters)` hook;
- optional preview metadata such as an icon.

Duplicate IDs, incomplete metadata, unsupported parameter types, and malformed enums are rejected at registration. Discovery reads this registry directly and matches tokenized search against name, ID, category, and description.

## Parameter contract

Phase 008 supports `boolean`, `number`, `integer`, `string`, and bounded `enum` parameters. Parameters normalize before validation and mutation. Numeric bounds clamp deterministically; invalid enums fall back to their declared default. Recipes receive only normalized values.

This is intentionally smaller than the Inspector field vocabulary. Object and asset references can be added later when a proven preset needs them; Phase 008 does not invent a general expression or arbitrary JSON-path language.

## Application and ownership

The editor supplies a narrow adapter for ordinary authoring operations: upsert a Behavior, upsert an animation clip, add/update a schema Component, configure AI, tags, visuals, or object flags. Registry code has no DOM, scene renderer, physics, persistence, or runtime-action implementation.

One successful `registry.apply` invokes one `onBeforeChange` callback. The editor maps that callback to one `pushUndo()` snapshot. Eligibility and parameter errors occur before the callback.

Preset-created Behaviors carry a small `sourcePreset` provenance field. It is normal serialized authoring metadata, not a runtime object or lock. It lets reapplication update only the recipe's own behavior while preserving creator-authored behaviors—even another Behavior using the same action. Creators can still edit, reorder, or delete the output normally. Animation clips use stable recipe-owned names; Components retain their normal schema identity.

## Repeat application

`inspect` returns `APPLY` for a new setup and `UPDATE` for detected output. The browser labels the action accordingly. Reapplication updates the recipe-owned Behavior/clip/Component instead of appending duplicates. Unrelated authoring data is retained.

Phase 008 does not provide a permanent live link to a preset. After application, the output is ordinary project data. Updating is an explicit creator action, not automatic synchronization.

## Persistence and validation

Preset output uses existing scene serialization, component serialization, Behavior cloning, Prefab, Duplicate, Undo/Redo, project Save/Load, Project Validation, and editable/playable export paths. There is no Preset Prefab format.

Validation runs before application through the preset hook and immediately afterward through existing Project Validation. Runtime behavior remains owned by existing Actions, AI, animation, collision, health, and spawn systems.

## Browser interaction

For one selected scene object, the Inspector presents **Apply Gameplay Preset** adjacent to **Add Component**. The dialog provides search, categories, descriptions, parameter controls, an explicit Apply/Update action, keyboard traversal, Escape cancellation/focus restoration, and a responsive bounded layout.

## Extension checklist

To add a preset:

1. prove every required primitive already works independently;
2. register one complete definition in the authoritative registry;
3. keep the recipe deterministic and adapter-only;
4. declare approachable parameters with safe defaults;
5. implement semantic/provenance-based repeat detection;
6. preserve unrelated data and use ordinary visible output;
7. cover search, eligibility, application, repeat application, Undo, Save/Load, Prefab, and export;
8. dogfood the role in Microsoft Edge before adding it to the catalog.

