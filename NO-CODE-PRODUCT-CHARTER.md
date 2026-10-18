# Digital Opus Engine No-Code Product Charter

## Product promise

Digital Opus Engine is a browser-native, local-first, drag-and-drop/no-code-first game engine. Its primary product objective is to let a normal creator build increasingly sophisticated 2D and 3D games through the editor without writing JavaScript for the common path.

The existing runtime and 28 games are regression, dogfood, and showcase assets. They support the product; they are not the product roadmap.

## A. Runtime existence is not product completion

A capability is not shipped merely because a JavaScript API exists, a JSON field can store it, a developer can call it, or Custom Script can reach it.

Where applicable, a creator-facing capability is complete only when it has:

- discoverable editor UI;
- direct manipulation or sensible form controls;
- save/load support;
- undo/redo support;
- predictable duplicate and prefab behavior;
- export support through the shared runtime;
- validation and clear, actionable errors;
- evidence from real editor dogfood.

Every capability review must distinguish runtime support from authoring completion.

## B. The common path is no-code

Common game-development workflows should be expressed with the smallest suitable authoring model:

- Components for reusable capabilities and data;
- Presets for common compositions;
- Events, Conditions, and Actions for straightforward reactions;
- Variables and Signals for reusable state and communication;
- Node Graph for branching or stateful logic;
- Sequences and visual editors for ordered or time-based work;
- direct manipulation for spatial work.

Missing basic authoring must not be disguised by telling the creator to use Custom Script.

## C. Code is the escape hatch

Custom Script remains a valuable advanced tool for unusual mechanics, advanced extensions, experiments, and power users. It is not the fallback implementation for ordinary movement, interaction, UI, animation, 2D, combat, or world-building workflows.

The script trust gate must remain explicit for externally loaded projects.

## D. 2D and 3D are first-class

The existing 3D foundation remains supported. Genuine 2D workflows are now an explicit product priority: true Sprite objects and assets, sprite animation, orthographic 2D cameras, tilemaps, 2D collision, 2D controllers, and intentional 2D/3D hybrid composition.

A textured world-space quad that faces the camera is a Billboard, not a complete Sprite system. It does not satisfy 2D pivot, pixel sizing, sorting, atlas, animation, 2D camera, tilemap, or 2D physics requirements.

## E. One runtime

Editor play mode, editable export, playable export, and samples should use one implementation wherever practical. Shared systems—especially transforms, actions, serialization, asset resolution, and export composition—must not be forked into parallel versions.

Authoring-only UI may be modularized, but runtime behavior must remain shared and regression-tested.

## F. Local first

Preserve:

- no mandatory account;
- no required cloud service;
- offline operation where practical;
- local assets and saves;
- deterministic, portable project state;
- standalone editable and playable exports.

Cloud collaboration or publishing may be additive later, never a prerequisite for basic creation.

## Shipping test

A phase may claim a creator capability only when the relevant row in `CURRENT-AUTHORING-SURFACE-INVENTORY.md` improves with evidence. A runtime-only API, undocumented JSON field, or scripted workaround does not raise no-code coverage.

Phase work should make one coherent creator workflow better, exercise it in the real editor, verify save/load and export, and stop at the phase boundary.
