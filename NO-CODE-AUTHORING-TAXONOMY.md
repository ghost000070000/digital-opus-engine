# No-Code Authoring Taxonomy

## Canonical concepts

| Concept | Definition | Boundary |
|---|---|---|
| Object | An entity placed in a scene. | A scene identity and transform; capabilities belong in Components or Behaviors. |
| Component | Reusable capability and data attached to an eligible Object. | A noun such as Health or Collider; it is not an Event or a precomposed gameplay role. |
| Event | Something that happened and can start logic. | Produces no result value; examples begin with On, such as On Start and On Trigger Enter. |
| Condition | A question that returns true or false. | Observes state; it does not cause the state change it tests. |
| Action | An operation requested by logic. | A verb-led command such as Play Sound, Set Flag, or Switch Level. |
| Behavior | A creator-friendly local reaction made from an Event, optional Conditions, and Actions. | Best for compact Object-local reactions; complex branching belongs in a Visual Graph. |
| Variable | Named state owned by a project, Object, or system. | Stores a value; it is not communication by itself. |
| Signal | A named communication event for reusable, decoupled logic. | Terminology is reserved now; full Signal authoring is not implemented in Phase 005. |
| Preset | A reusable composition configuring Components, Behaviors, and settings for a gameplay role. | A Collectible or Sliding Door; not a new primitive capability. |
| Template | A larger starting structure for a project, level, or genre. | Broader than an Object-level Preset. |
| Sequence | Ordered or time-based presentation and gameplay steps. | Linear/timed orchestration; branching state logic belongs in a Visual Graph. |
| Visual Graph | A graph for complex branching and state orchestration. | Does not replace spatial editing, Components, or short local Behaviors. |
| Custom Script | The advanced code escape hatch. | For logic outside the curated vocabulary, not the default solution for missing no-code concepts. |

## Relationship

An Object owns Components and may own Behaviors. A Behavior starts with an Event, optionally evaluates Conditions, and requests Actions. Variables hold state; Signals will provide named decoupled communication. Presets compose Object-level capabilities, while Templates create larger starting structures. Sequences handle ordered/time-based work; Visual Graph handles complex branching; Custom Script remains the explicit advanced boundary.

## Shared categories

`Object`, `Transform`, `Gameplay`, `State`, `Inventory`, `Combat`, `Audio`, `Visual`, `Camera`, `UI`, `Level`, `Save`, and `Advanced` are the only Phase 005 categories. They are reusable by future Add Component, Action, Condition, and Preset pickers.

## Metadata contract

Canonical types expose a stable ID, display label, category, concise help, and aliases where historical names exist. Conditions additionally use a scoped metadata ID because the same historical serialized ID may have different surface-specific meaning; the serialized ID itself is preserved. Action fields continue to come from `ACTION_TYPES`. Runtime execution is not owned by this taxonomy.

Current component metadata covers the three registered schemas: `health` / Health, `trigger` / Trigger Volume, and `particle-emitter` / Particle Emitter. Sprite Renderer, Collider, AI, Camera, and Inventory remain taxonomy examples, not newly implemented Components.
