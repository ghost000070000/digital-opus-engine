# Phase079 — Moving Platform component

COMPLETED. Exact authoritative title; tracker expanded definition is empty.
Reuse existing qualified systems rather than introducing another platform tick.

Existing Moving Platform2D schema composes Kinematic Body2D, enabled BoxCollider2D
and Body linearVelocity. Phase048 owns translation/carry/obstruction semantics.
Legacy solid Cube platforms compose Property Animation/Patrol with actual 3D
Player support. Existing palette and gameplay presets must remain compatible.
These are distinct authoring/motion worlds; no silent XY/XZ migration.

First characterize a blank-project creator journey and missing discoverability.
Provide useful configuration through native component/preset controls, no raw
IDs or required Script. If generated animation/Start records are owned, identify
them narrowly; preserve independent user edits and unrelated records. Avoid
direct Transform animation competing with modern Body2D velocity.

Required product gates: real standing rider carry, walk-off, obstruction/ceiling
safety where applicable, pause/Stop/restart, authored versus Game Save ownership,
Undo/Redo, independent duplication, Prefab, project Save/reopen and exact Source/
Editable/Playable consistency. Regress legacy platform games and Phase048.
Explicit limitations must distinguish translation from rotation/scale/side push.
Existing048 readiness does not itself qualify079 creator workflow.

## Implemented candidate — 2026-10-10

Explicit Moving Platform3D for Cube: enabled, opt-in autoplay, signed world axis
distance and one-way duration. Start Platform Motion composes canonical Events
and typed Self/Object Actions. It compiles independent transient position tracks
into the existing Property Animation clock; no authored clip/Start record is
generated or overwritten, no new controller tick. Solid is an explicit prerequisite;
enabled Body2D rejects this competing motion owner. Existing legacy presets and
modern Body2D carry remain unchanged. Ordinary animation pause/stop/restart applies;
explicit Play Animation can intentionally replace this playback.

Actual-source characterization4 and component/runtime9 pass. Preserved REDs:
undefined pause state in canonical Action, empty Travel Axis enum, finite endpoint
overflow, parent hierarchy overwriting world motion. Repairs use app.paused,
canonical choices, finite endpoint rejection and component-only canonical parent/
socket world-to-local commit. Existing authored clips keep historical semantics.
First native candidate a2bf passed Cube19 and modernSprite15 Source/Editable/
Playable cases, including actual rider carry, walk-off, modern ceiling clamp,
parented 3D motion, pause and authored Stop/project restoration. Full8 gates/
412syntax/40JSON/all28sites passed. Existing Moving Temple and Skyway native
gameplay/restart checks passed, zero page/console/external errors.

Native Distance edit→Tab into untouched Duration→Undo exposed an earlier shared
Inspector defect: focus alone created empty history. Phase006's mounted field
editor was reopened; first valid changed mutation now captures history before
mutation and coalesces typing within a field session. Invalid, unchanged, Reset
and bulk-mask cases retain correct history. Seven actual mounted regressions
observed RED then GREEN. No assertion weakened to conceal the native failure.
Final d6bb candidate passed full eight command gates, 413 syntax/40 JSON checks,
fresh native 3D19/modern15 and prior core14 cases. See PHASE-079-REPORT.md for
exact run identities, retained RED evidence and intentional limitations.

No 2D ping-pong route is claimed: modern velocity is configured on Body2D. No
rotational/scaled carry, arbitrary dynamic physics or GameSave playback-phase
resume claim. Parent/socket math regression is not alone real browser acceptance.
