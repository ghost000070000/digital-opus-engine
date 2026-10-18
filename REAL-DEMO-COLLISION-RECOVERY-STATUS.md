# Real-demo collision recovery — initial checkpoint

## Verdict

`REAL_DEMO_COLLISION_BLOCKED`

This is an incomplete acceptance checkpoint, not a claim that all 28 games have
been independently reproduced as failing. The user reports collision problems in
all 28 public demos. That report remains unresolved. Phase 049's independent
qualification does not qualify the demos. Phase 050 remains planned.

## Scope and observations

- Controlling addendum: attachment `3644909c-e75f-4023-8826-2e0c0d2f854f`.
- No earlier recovery-campaign specification was located in the attachments.
  The user clarified that all 28 demos have collision problems.
- `editor/src/01-editor.js`, `ACTION_REGISTRY.moveObject.exec`, updates the target
  Transform directly with `entity.position.set(...)`. It does not itself call a
  collision solver. This is a confirmed code observation, not yet a confirmed
  root cause for any individual public demo. `setPosition` also writes directly;
  intentional teleport semantics must not be silently changed.
- `updateTopDownController` integrates movement and then invokes legacy terrain
  and item collision helpers. Those are distinct from the newer shape-owned 2D
  Body/Collider stack. Missing 2D components alone cannot establish that a legacy
  3D game has no physics.
- The shared export composer is used by both native exports and catalog builds.
  Build/package success is not gameplay acceptance.

## Verification blocker

Opened the actual Arsenal Run public playable at
`http://127.0.0.1:8849/dist/games-site/arsenal-run.html`. Its start menu rendered,
including the `Begin mission` button. Clicking that button timed out and reset
the browser-control connection. A fresh acquisition of the same returned tab
also timed out and reset the connection. The game-start outcome is unknown;
neither attempt is counted as a gameplay PASS or a reproduced collision FAIL.
Read-only local command output was also substantially delayed during recovery.

## Acceptance still required

The read-only catalog inventory completed for all 28 public games. Level objects
have no authored `components` keys. This is a level-object inventory, not a claim
about normalized runtime data, nested Prefabs, or dynamically spawned objects.
The controller and `solid` counts below are source observations, not play results.

| Game | Authored controller | Solid level objects | Source/editor Play | Editable | Playable | Acceptance |
| --- | --- | ---: | --- | --- | --- | --- |
| forest-range | thirdperson | 3 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| arsenal-run | firstperson | 30 | NOT_TESTED | NOT_TESTED | START_OUTCOME_UNKNOWN | PENDING |
| power-grid | firstperson | 17 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| moving-temple | thirdperson | 8 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| foglight | thirdperson | 25 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| relic-frontier | thirdperson | 14 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| relic-island | thirdperson | 4 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| npc-puzzle-adventure | thirdperson | 5 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| relic-runner-2 | thirdperson | 9 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| valley-run | thirdperson | 0 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| painted-wilds | thirdperson | 4 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| textured-adventure | thirdperson | 4 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| temple-switch-puzzle | thirdperson | 3 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| signal-relay | firstperson | 26 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| silent-sector | firstperson | 20 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| iron-arena | firstperson | 11 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| opus-arena | thirdperson | 11 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| power-station | thirdperson | 6 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| assembly-line | firstperson | 7 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| blacksite | firstperson | 16 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| shifting-facility | firstperson | 9 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| signal-zero | thirdperson | 8 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| dungeon-descent | topdown | 15 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| sentinel-maze | thirdperson | 8 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| survival-arena | hovercraft | 4 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| survival-arena-2 | hovercraft | 8 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| survival-arena-3 | hovercraft | 9 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |
| skyway-trial | thirdperson | 6 | NOT_TESTED | NOT_TESTED | NOT_TESTED | PENDING |

For every row, actual movement trace, runtime filter result, geometry candidate,
solver invocation, normalized Collider/Body/Character/Tile status and visible
geometry acceptance remain NOT_TESTED. Source controller names do not replace
those observations. This is not the final acceptance matrix.

For every public catalog game, record actual movement path, collision system,
normalized registry and shape/Tile Layer filters, relevant mutual-filter result,
visible wall/floor role, Collider/Body/Character/Tile presence, and source-editor,
Editable, and Playable outcomes. Until observed, each gameplay outcome is
**NOT_TESTED**, not NOT_APPLICABLE or PASS.

For each reproduced failure trace the actual mover/target pair, filter result,
geometry candidate, solver invocation and final Transform. Fix shared integration
causes only after reproduction; do not broaden masks to hide missing physics or
solver bypass. Then recheck all 28 and Phase 049 regressions.

## Changes made

Qualification documentation only. No product source or game content repair was
made without reproduction. No commit, push, deployment, Phase 050 implementation,
or new public game. Existing user changes remain untouched.
