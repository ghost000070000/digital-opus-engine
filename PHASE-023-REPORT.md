# Phase 023 Report

## Outcome

Phase 023 is qualified. Sprite Renderer v6 now owns named animation states with stable renderer-local IDs, explicit Clip mappings, an Initial State, and no-code state switching. The work stops before Phase 024: no transition graph, blend tree, directional-state generator, or automatic state rules were added.

## Delivered

- Deterministic migration of historical v5 `animationClipRef` data into one `Default` state; canonical saves remove the legacy field.
- Inspector authoring for add, rename, remove, clear/repair, typed Clip assignment, Initial State, and `playOnStart`, including live name persistence and duplicate/empty-name guards.
- Per-instance transient `currentStateId`; different-state frame-zero entry, same-state no-op, explicit restart, Once completion, switch-away/back reset, Stop/static fallback, and safe invalid requests.
- Shared `Set Sprite Animation State` Action for Behaviors, Node Graphs, and Sequences, with target-aware state pickers, stable-ID rename safety, and contextual validation.
- Full dependency and usage traversal for every state Clip, including Prefabs and noninitial states, while unrelated Clips remain prunable.
- Bounded public set/current-state operations without exposing mutable playback internals.
- Static Sprite, Phase 022 Clip Editor, Billboard, 3D/skinned animation, geometry, pivot, sorting, tint, opacity, duplication, Prefab, Save/Load, and export boundaries remain intact.

## Human dogfood

Through normal visible editor controls, the campaign imported and sliced the local atlas, authored `Idle`/`Walk`/`Attack` Clips, placed Sprite `obj44`, mapped three states, enabled Idle-on-start, and authored start/interact/click state Actions on `obj2`. `Walk` was renamed to `Moving` while local ID `animation-state-2` and its Action reference stayed unchanged.

A Clip mapping was cleared to produce `required-reference-missing`, then repaired to the final validation result: `No structured authoring issues found.` The linked `Phase 023 Animated Sprite` Prefab and the complete state model survived project Save/Load without reconfiguration.

Real downloaded exports were served back over localhost and booted in-browser. Editable retained the state controls, mappings, Initial State, and Actions. Playable exposed no editor chrome and accepted the authored interaction inputs. Both boots had zero console warnings/errors; Editable displayed only the expected pre-existing Custom Script trust gate. Full details are in `phase-023-dogfood.json`.

## Qualification

- Phase 023 focused tests: 68/68.
- Phase 011–023 focused total: 524/524.
- Integrated runner: 886/886, plus Showcase 15/15 and public-site integration 1/1.
- Engine: 160,854 bytes; gzip 41,445 bytes; 22 sources. Demo: 178,748 bytes.
- Public games: 28/28, 118.5 MB; no game 29.
- Engine site: 219.7 MB, including a 1,519 KB editor package and all 28 examples.
- Games site: 28/28, 140.0 MB.
- All five required build paths passed. Capability dashboard check passed; Animation remains C and Sprites / 2D remains B. AFR-0009 remains confirmed rather than being falsely closed.

## Boundaries

No commit, push, deployment, DNS change, or game 29 was created. The pre-existing dirty worktree was preserved.

## Verdict

`PHASE_023_SPRITE_ANIMATION_STATES_READY`
