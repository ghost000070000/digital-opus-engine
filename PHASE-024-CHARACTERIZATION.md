# Phase 024 Characterization

## Baseline

Phase 023 supplied Sprite Animation Clip v2, a visual frame editor, deterministic Once/Loop playback, renderer-local named states, state-switch actions, Prefab/project persistence, and export support. Frame records had only `spriteAsset` and `durationMs`; Sprite frame events and target-specific no-code event sources did not exist.

The repository was already heavily dirty and was preserved. Phase 024 is bounded to Sprite Animation Events and stops before Phase 025, deployment, DNS work, a 29th game, or unrelated cleanup.

## Implemented delta

- Clip schema v3 ordered named frame events with v1/v2 migration.
- Stable IDs, collision-safe creation/duplication, visual selected-frame authoring and markers.
- Single deterministic frame-entry dispatch path with immutable context and a documented pathological cap.
- Exact target/Clip/event no-code listener source over existing Behaviors, Graphs, Sequences, and Actions.
- Validation, deletion warnings, dependency retention, Save/Load, Prefab, duplication, and export propagation.

## Honest boundary

This does not unify the older skinned-mesh time/action event feature, create a generic event bus, add payloads, or solve general animation controllers/transitions. Animation remains capability grade C; Sprites / 2D remains B; AFR-0009 remains confirmed.

