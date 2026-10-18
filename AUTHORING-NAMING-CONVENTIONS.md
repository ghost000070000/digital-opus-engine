# Authoring Naming Conventions

## Creator-facing grammar

- Objects and Components use nouns: Health, Trigger Volume, Particle Emitter.
- Events begin with `On`: On Start, On Interact, On Trigger Enter.
- Conditions read as a question or state: Has Item, Flag Is Set, Object Is Visible.
- Actions begin with verbs: Play Sound, Set Flag, Spawn Prefab, Switch Level.
- Presets describe gameplay roles: Sliding Door, Collectible, Checkpoint.
- Templates describe their larger starting structure or genre.
- Use title case for canonical picker labels and plain creator language instead of code, roadmap, or implementation terminology.
- Parenthetical text is reserved for information that changes creator meaning, not implementation notes such as Wave or Priority.

## Identity and compatibility

Serialized IDs are stable and separate from display labels. A label improvement never requires rewriting a project, Prefab, sequence, graph, animation event, or exported game. For example, `sound` remains the Action ID while Play Sound is the label and Play Audio is a historical alias.

Resolution follows this order:

1. exact stable ID;
2. current display label;
3. documented historical alias;
4. unresolved, with the original value preserved by the owning loader.

Aliases are read compatibility and search metadata, not new serialized identities. New projects continue writing the existing stable ID. Aliases must not form chains, and two records in one vocabulary may not claim the same normalized label/alias.

## Deprecation policy

A historical display name may remain indefinitely as an alias at negligible cost. A stable ID is deprecated only when its semantics are unsafe or impossible to preserve; that requires an explicit versioned migration and regression fixtures. Phase 005 deprecates no serialized IDs.

Surface-specific names are allowed only for genuinely different concepts. Graph Delay / Wait is a graph sequencing primitive, not an alias for an executable `ACTION_TYPES` entry. Scoped Condition metadata distinguishes identical legacy IDs when their meaning differs between Graph and AI without changing saved records.

## Help text

Every canonical type supports one short sentence explaining creator effect or intent. Help should answer “what does adding this do?” and avoid architecture history. Longer instruction belongs in documentation or onboarding.
