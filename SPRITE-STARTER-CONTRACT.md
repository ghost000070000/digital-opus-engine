# Sprite Starter Contract

Phase 030 provides exactly three bounded Sprite starters. A starter is product content used only to create the first state of an ordinary `digital-opus-project` v6 project. It is not a runtime mode, template-project kind, genre kit, marketplace package, or public game.

## Identity and discovery

- Stable IDs are `sprite-2d-scene`, `sprite-animated-character`, and `sprite-parallax-hybrid`.
- Display names and descriptions are creator-facing and may evolve without changing those IDs.
- Start Blank remains the first and most prominent first-run choice. Sprite Starters are optional choices on the same welcome surface.

## Creation and ownership

`OpusSpriteStarters.instantiate(id)` invokes a local creator, deep-clones its result, assigns a fresh ordinary project name, and passes the project through the existing `loadProjectFull` path. The created objects, textures, Sprite Assets, clips, states, Cameras, layers, and metadata are project-local ordinary records. Starter identity is not serialized into runtime project data and has no authority after creation.

Project-local IDs may repeat between two different isolated projects because current references are project-scoped. A generalized re-keying/package system is not introduced. Each call returns a fresh deep object graph, so editing one instance cannot mutate another instance or the canonical creator source.

## Persistence, export, and offline behavior

Starter projects use ordinary Save/Load, validation, dependency closure, Editable Export, and Playable Export. All supplied artwork is deterministic local SVG data. Selection performs no fetch, upload, publish, catalog mutation, or export. Export pruning follows the existing project dependency collector; unrelated starter content is not added to another project.

Example objects are removable. No hidden starter object or starter-specific runtime is required for validity. The normal editor can rename projects, delete or replace artwork, edit Cameras/layers/clips/states, create Prefabs, and export.

## Boundary

This contract does not define a general template architecture, template updates, inheritance, genre kits, Tilemaps, 2D physics, controllers, input maps, or deployment. Those remain owned by later roadmap phases.

