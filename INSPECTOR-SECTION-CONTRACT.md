# Digital Opus Inspector Section Contract

## Structure

A reusable component section declares:

- stable component `id` and creator-facing `label`;
- category and optional icon;
- concise section help;
- an ordered field-descriptor list;
- current component values;
- reference-option, Undo, change, and validation callbacks;
- optional section disabled state.

The mounted section renders one recognizable component block with title, category, help, fields, local issues, and owning-schema issues. The `field-editor-section` / `schema-component-section` classes and category treatment distinguish component data from base Object identity, Transform, and advanced/raw controls without changing the Inspector theme.

Collapsing is intentionally left to the Inspector's existing section/container behavior. The reusable component sections are small and nested in established Inspector slots; adding an independent collapse state in Phase 006 would duplicate navigation state and exceed the bounded migration.

## Ownership and lifecycle

The section owns presentation and field interaction only. The component schema remains authoritative for defaults, normalization, eligibility, migration, target application, serialization, and semantic validation. Phase 003 remains authoritative for reference options and project-level issue collection.

The lifecycle is:

1. The owning Inspector selects an eligible schema and ensures its component record.
2. Schema fields are sorted by declared order and receive defaults from the schema.
3. The section mounts generic controls and renders current modified/issue state.
4. First focus records one Undo snapshot for that deliberate editing gesture.
5. Valid input updates the component and its compatibility/runtime target; invalid temporary input does not corrupt the model.
6. Semantic issues render inline and continue to flow to Project Validation.
7. Reset travels through the same component update path.

Re-rendering an Inspector creates a fresh section and interaction state. No section-global mutable registry or bespoke element ID is required.

## Phase 006 migration

The representative bounded migration is the complete Phase 002 proof set:

- Health: two required number fields;
- Trigger Volume: boolean and enum fields;
- Particle Emitter: required number and bounded integer fields.

These exercise three real runtime adapters and retain Save/Load, Undo/Redo, duplicate/prefab component copying, editable/playable export, and legacy compatibility. Point Light, Player, AI State Machine, Equipment, Terrain, and other bespoke Inspector panels are intentionally unchanged.

## Extension rule

A later component should be declarative unless it has a proven interaction that cannot fit this contract. Transform-specific gizmo synchronization, timelines, graph canvases, terrain painting, and similarly specialized direct-manipulation tools remain valid specialized sections; they must not force primitive value fields back into bespoke parsing and Undo wiring.
