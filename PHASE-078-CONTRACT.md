# Phase078 — Door/Gate component

COMPLETED. Exact authoritative title; expanded tracker definition empty.
Compose explicit no-code Open/Close/Toggle with existing Events/Conditions and
canonical visibility/collision runtime. Do not add another inventory/lock runtime.
Legacy hidden solid means passable; modern2D rendering visibility does not imply
collision disabled. Preserve historical Actions and authored versus GameSave state.
Characterize before choosing an explicit opt-in policy. Qualify native real
closed blocking/open passing, obstruction behavior, typed target/owner controls,
history/duplication/Prefab/Save/reopen, both exported tiers and proportional broad
regression. Adding data must not silently create a Collider or Event. No fake
sliding claim for hide/show doors, no global depenetration, no new public game.

## Characterized contract — 2026-10-10

Actual-source regression `tests/phase-078-door-characterization.test.js` proves
hidden legacy Solid is pass-through but an enabled hidden modern Collider still
blocks actual Body2D movement. Historical Game World State captures Cube visibility,
not Collider enabled flags, and excludes Sprite objects. Project projection preserves
survivor component edits. Do not globally equate visibility with enabled physics.

The ordinary new component should own its own Cube/Sprite panel: Enabled, Starts
Open, and explicit Open Door / Close Door / Toggle Door Actions (Self by default).
No extra raw panel ID for the ordinary path. It supplies hide/show gate behavior,
not an animated slide/swing. Existing proximity-hide palette and separate animated
Opening Door preset remain compatible; the misleading proximity preset label is
corrected while preserving its stable id and historical search alias.

Closing must preflight before any mutation and refuse an occupied doorway without
teleport/push, hidden retry or partial state change. Legacy occupancy uses actual
Player/controller geometry; modern static-gate occupancy uses supported enabled
kinematic actors, exact prospective closed shapes and mutual existing filters.
Preserve originally disabled Colliders. Runtime overrides must be independently
owned/restored on Stop and authored project Save/export. Explicit opt-in Game Save
state needs a scoped implementation and tests; historical visibility persistence
alone is insufficient. Missing/future/disabled records stay inert.

Concrete own-panel component/runtime and safe close now implemented and qualified:
final Cube18 and Sprite16 native authoring/history/Prefab/persistence/Source/
Editable/Playable observations pass; actual-source runtime17 plus full integrated
eight gates pass. Final06c5 fingerprint frozen across each final qualification.
See PHASE-078-REPORT.md for runs, preserved failed attempts and intentional limits.
