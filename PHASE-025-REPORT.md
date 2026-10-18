# Phase 025 Report — Sprite Flip and Directional Variants

Status: qualified.

## Delivered

Sprite Renderer v7 adds authored Flip X/Y and compatible Initial Direction `none`. Eight explicit directions drive sparse per-State variants with an optional typed Clip override and Mirror X/Y. One runtime resolver preserves playback for same-Clip mirror changes, restarts different Clips at frame zero, preserves exact Animation Event identity, and safely falls back to the base Clip for absent or broken variant references.

The shared Action registry exposes `Set Sprite Direction` and bounded `Set Sprite Flip` to Behaviors, Node Graphs, and Sequences. Directional Clip references participate in validation, usage warnings, dependency collection, Save/Load, Prefabs, duplication, and both export tiers. The frozen engine API is extended through an immutable `window.Opus` facade, so the public sprite state, direction, and flip controls are present in real exports.

## Human browser qualification

The visible local editor was used to create `Phase 025 Directional Proof` from a blank project. The project contains a Hero Sprite with Walk, Idle, and Attack States; four-way Walk direction authoring; Left mirror reuse; distinct Up and Down Clips; an Initial Direction of Down; a frame-zero Footstep Event; and ordinary no-code Direction and Flip Actions. Flip X, Flip Y, and combined Flip were exercised without changing Transform scale. Save/Load, Prefab creation, Prefab instantiation, and Prefab update were exercised.

The referenced Walk Up Clip was deliberately deleted after confirmation. Validation retained the missing stable ID and reported three actionable errors for the scene Hero, Prefab instance, and Prefab definition. Play remained crash-free through base-Clip fallback. The reference was repaired, the Prefab updated, the project saved, and validation returned to `No structured authoring issues found.` Browser warnings/errors were empty.

## Export proof

The normal editor export controls generated isolated Editable and Playable single-file HTML artifacts. Both booted without network access or runtime errors. Both preserved Initial Direction Down and the Idle/Walk/Attack States. Runtime checks proved Right-to-Left reused the same Clip and retained 50 ms playback time with Mirror X, while Right-to-Up selected the distinct Up Clip and restarted at frame zero. The Editable artifact reopened editor chrome; the Playable artifact exposed no editor chrome. Evidence is recorded in `phase-025-export-proof.json`.

## Automated gates

- Phase 025: 77/77 passed.
- Focused Phase 011–025: 667/667 passed.
- Full suite: 1,029/1,029 passed.
- Showcase quality: 15/15 passed.
- Public-site integration: 1/1 passed with 28 public games.
- All 28 games rebuilt; the site contains 4 Featured and 24 Samples.
- Capability dashboard validation passed with honest grades: Sprites / 2D B, Animation C, Animation Events C. AFR-0009 remains CONFIRMED.

## Boundaries

No movement/input/velocity/AI/controller direction inference, transition graph, negative-scale synchronization, new static-direction asset system, nine-slice, deployment, DNS change, game 29, reset, clean, commit, or push was performed. Phase 026 was not started. The pre-existing dirty worktree was preserved.

## Verdict

`PHASE_025_SPRITE_DIRECTIONAL_VARIANTS_READY`
