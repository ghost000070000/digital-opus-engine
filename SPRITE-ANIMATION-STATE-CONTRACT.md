# Sprite Animation State Contract

Phase 023 makes named Sprite animation states instance-owned authoring data on Sprite Renderer version 6.

## Canonical record

`animationStates` is an ordered array of `{ id, name, clipRef }`. `id` is a stable renderer-local identity, `name` is the creator-facing label and must be unique case-insensitively on that renderer, and `clipRef` is a typed Sprite Animation Clip asset reference. `initialAnimationStateRef` stores a state ID, never a display name. `playOnStart` enters that initial state only when both state and clip are valid. `spriteAssetRef` remains the static fallback.

State IDs are local: two Sprite objects may both own `idle`. Renaming `Idle` to `Resting` leaves `idle`, initial state, and Actions intact. Removing a referenced state leaves Action IDs untouched so Project Validation can identify and repair the break. Empty state clip selections are preserved as repairable authoring data and never crash playback.

## Persistence and migration

Save, Load, Undo, duplication, linked and portable Prefabs, level duplication, Editable export, and Playable export use the ordinary component serialization path. Runtime playback is underscore-prefixed transient state and never serialized.

Sprite Renderer v5 migrates `animationClipRef` deterministically to `[{ id: "animation-state-default", name: "Default", clipRef }]`, makes that state initial, and removes the legacy field from canonical output. A missing legacy clip migrates to an empty collection and static fallback.

## Validation and boundaries

Validation reports missing/duplicate IDs, missing/duplicate names, missing or wrong-type clips, invalid initial state, invalid autoplay configuration, and broken state Actions. Phase 023 does not add transitions, automatic switching, parameters, blend graphs, events, directional variants, flip controls, Tilemaps, 2D physics, or orthographic/pixel-perfect cameras.
