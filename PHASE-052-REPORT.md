# Phase052 — Visual Event nodes and lifecycle events

COMPLETED on bcb15f6f686dae87234d92469e939430a4b488e87923c76108af1a53acb676be.
Product mission continues into exact053, not overall READY.

The implicit Graph entry is now a visible editable Event node. Its named selector
and help configure the owning Behavior, not a second listener system. All existing
Events remain available. Sprite frame Events expose a dedicated named Sprite/Clip/
Event source panel. Save commits owning trigger/eventRef, Cancel does not mutate,
and historical start::next-out / start edges and Action/Condition arrays survive.
Graph Fit measures actual rendered dimensions; wider Event nodes and parameter-rich
nodes are included without changing authored positions. New-node spacing avoids
the enlarged Event entry. Historical Action positions remain untouched.

Lifecycle scope: existing On Start fires on fresh Play and level entry. New opt-in
On Update fires once per active simulation tick on ordinary cube Behavior owners;
pause/editor/ended games do not dispatch it. Snapshot iteration excludes newly
spawned same-tick subscribers; live membership excludes owners removed by earlier
handlers. Stop clears existing delayed work as before, not a new On Stop event.
Use Timers/Delay for elapsed-time work; an Update is a tick, not one second.

## Product evidence

- Native events-browser-20261009T203143739Z:25 observations, all native controls,
  evaluation read-only. Start counter once, Update ticks, exact Sprite frame pulses;
  Source/restart/reload/Editable/Playable execution; Pause/Stop/Resume isolation.
  Event edit Cancel/Save/Undo/Redo; object Duplicate/history; Prefab capture; exact
  saved logic/ref arrays after Save/reload/Load and both exports. Native Fit contains
  full Event/Action dimensions. Current Update and Sprite screenshots reviewed.
  Zero page/console errors and external HTTP requests. Fixture uses existing
  canonical Sprite APIs; no browser injection or new public game.
- Existing051 native19-observation regression passed after Event entry addition.
- tests/phase-052-lifecycle.test.js extracts actual dispatcher source, not a fake
  event implementation. Start/Update, ended guard, spawned-subscriber snapshot,
  historical entry seam and removed-owner regression pass. removed-owner-red.log
  preserves observed stale callback failure before repair; green.log proves fix.
- Final regression-direct-20261009T202947751Z: integrated suite, engine,28/28
  games and both sites exit0;337 JS syntax/JSON/diff pass, start/final bcb match.
  Prior041–051/controller/API/onboarding/capability/friction/site chain remains green.
- Actual-source lifecycle-cost.json at bcb:10000 objects/no subscribers ~0.180ms
  per tick;10000/16 subscribers ~0.205ms;1000/1000 ~0.402ms on this Node run.
  Not browser FPS, forced-GC stability or universal scale acceptance. Membership
  checks trade lookup cost for correct removed-owner behavior; dense large-project
  workloads remain later scale review.

## Limits and decisions

One object-owned Event per graph, not a multi-entry graph schema. Historical IDs and
project format unchanged. Stop/Destroy lifecycle ordering is not implemented or
advertised; adding callbacks after editor restoration would be unsafe. General
event payloads/signals, typed value pins, graph variables, tracing and migration
remain respective future phases. Free-typed state keys remain visible friction.
Prefab capture preserves level-local Sprite/Sequence refs; standalone dependency
portability is not newly proven. Update-driven Graph Delay can queue repeated work;
authors should gate it or start a reentrancy-protected Sequence when appropriate.
No replacement physics/controller/runtime, grade inflation, commit/push/deployment.
Collision closure remains separately frozen at b57, not re-soaked for these UI/
opt-in logic additions. Full product acceptance still requires remaining roadmap.
