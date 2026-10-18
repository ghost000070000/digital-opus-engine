# Phase 024 Report — Sprite Animation Events

Status: qualified on 2026-09-15. Evidence is recorded in `phase-024-dogfood.json` and the current-run gate results below.

## Delivered

Sprite Animation Clip v3 now owns ordered named events per frame. The dedicated editor provides event markers and selected-frame add/rename/remove controls. Runtime emits immutable, target-specific frame-entry context through one bounded dispatcher. `On Sprite Animation Event` listeners select a Sprite, one of its state Clips, and a named event, then reuse ordinary Behavior/Node Graph/Sequence actions.

Migration, stable identity, frame and Clip duplication semantics, listener validation, deletion warnings, dependency collection, persistence, Prefabs, level duplication, and both export tiers are covered by focused tests. Frame zero fires on fresh start, explicit same-state restart, different-state switch, and loop wrap; ordinary same-state switches, pause, stop, and scrubbing do not emit gameplay events. Once playback emits the final event once. Large deltas retain exact final playback position while dispatch is bounded to 1,024 events per advance.

The event listener is deliberately exact and local: it stores `targetId`, `clipId`, and `eventId`, exposes creator-facing names instead of raw IDs, and has no wildcard route. Reactions execute through the existing action path rather than a second action engine.

## Scope boundaries

No generic signals, payload system, wildcard listeners, transition system, 3D/skinned event unification, deployment, DNS change, game 29, commit, push, reset, or clean operation was performed. Phase 025 was not started.

## Qualification

- `node tests/phase-024-sprite-animation-events.test.js`: 66/66 assertions passed.
- Phase 011-024 focused matrix: 14 suites, 590/590 assertions passed.
- `node tests/run-tests.js`: 952/952 assertions passed, including Showcase 15/15 and public-site integration 1/1.
- `node build/build.js`: engine and demo bundles rebuilt successfully.
- `node build/build-games.js`: 28/28 playable games rebuilt.
- `node build/build-engine-site.js`: 28/28 examples packaged; path and broken-link checks passed.
- `node build/build-games-site.js`: 28/28 public games packaged; path and broken-link checks passed.
- `node tools/build-capability-dashboard.js --check`: 57 capabilities valid (A=5, B=32, C=18, D=1, N/A=1).
- `git diff --check`: passed; line-ending notices only.

Visible browser qualification authored `Walk` and `Attack Once` Clips, frame events, a rename from `Hit` to `Damage Window`, and exact no-code reactions. It observed repeated loop events, exercised a different-state switch, deliberately broke and repaired the Attack Clip reference, reached zero validation issues, and verified Save/Load persistence. Fresh editable and playable exports were generated and booted. Both ran the `DAMAGE WINDOW` reaction with clean consoles; only the editable tier exposed `Edit This Game`.

Capability grades remain truthful: Animation and Animation Events are C, Sprites / 2D is B, and AFR-0009 remains CONFIRMED.

Verdict: `PHASE_024_SPRITE_ANIMATION_EVENTS_READY`.
