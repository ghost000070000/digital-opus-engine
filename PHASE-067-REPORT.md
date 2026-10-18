# Phase067 — Signal debugging inspector

COMPLETED on `f8c25401f4115be020fa4c35559b1368d0a97cbc97c427c30b7727ba51c7a10e`.

Project → Inspect Signal routing shows named direct active-scene senders and
On Signal receivers, channel/type, and native navigation to ordinary Objects.
The explicit Capture checkbox records actual canonical-dispatch acceptance,
rejection, receiver invocation, channel mismatch and work-limit observations.
Capture defaults off; records are local/transient, bounded128, primitive-only,
values clipped160 and last12 displayed. No listener registry, queue ownership,
telemetry or gameplay mutation was introduced. Invocation is explicitly not
proof that an Action effect succeeded.

Clear history leaves gameplay work alone. Fresh Play/Stop/project/history resets
old evidence; returning to Project refreshes authored routes. Definitions and
missing references remain recoverable. Disabled capture preserves real delivery.
The optional observer cannot propagate exceptions into gameplay. Invalid Object
reference prechecks also explain their actual rejection rather than silently
disappearing from the inspector.

Actual-source regression exposed an initial graph-route mismatch: graph sends
store `type`/`signalId` directly, not `action`/`params`. The scanner now reads the
real format, safely ignores malformed collections without replacing them, and
stops at4096 records. Native graph authoring confirms both discovery and delivery.
One earlier browser failure was an observation of absent authored variables after
reopen, not a product failure; corrected read and full campaign pass. The stale
generated capability inventory failure was repaired with its existing generator,
not by relaxing assertions. Evidence remains in qualification/phase-067/findings.json.

Final native `inspector-browser-20261010T010043081Z`:17 observations PASS. Named
Number sender/receiver, actual count7 effect, Clear/Stop, capture-off parity,
declaration mismatch/Undo, Prefab-channel rejection, removed-reference/Undo,
native receiver Prefab placement, bounded cyclic dispatch256/count1792/last128,
fresh Play, native graph sender, exact Save/reopen and Editable/Playable all pass.
Diagnostic opt-in and history do not persist. Editable native inspector works;
Playable defaults off with the same actual count7 effect. Screenshots were
visually inspected for readable named routing/help/live proof. Zero page, console
and external-request errors.

Previous typed/no-value delayed relay native workflow
`relays-browser-20261010T010229177Z`:20 observations PASS on the same fingerprint,
including strict filters, overlapping Waits, history, Prefab and both exports.

Full `regression-direct-20261010T010100191Z`:8 gates PASS,377 JS syntax files,
integrated suite including earlier physics/logic/authoring/public API/site gates,
engine build, all28 game builds, both sites, JSON and diff, frozen final fingerprint.
Fresh rebuilt `probe-20261010T010229687Z`:Arsenal Run, Power Grid, Signal Relay,
Silent Sector, Relic Frontier, Dungeon Descent and Survival Arena all start,
accept actual movement, restart natively and move afterwards; zero page/console/
external errors across firstperson/thirdperson/topdown/hovercraft. This is targeted
compatibility, not a new complete collision soak or full playthrough claim.

Permanent regression: tests/phase-067-signal-inspector.test.js. Grade remains B,
not product-complete: direct routes are not a transitive Function dependency graph,
only active-scene receivers execute, full payload archives are deliberately absent,
and existing Cube-oriented Behavior authoring/independent cross-project bundle
limits remain. No new feature-specific multi-hour endurance was justified.

Drive full241-row readback: only E68 COMPLETED/E69 IN PROGRESS changed; strict
status validation and WRAP/MIDDLE preserved. API verification is not a claim of
Google-rendered fit.67 COMPLETED/1 IN PROGRESS/172 PLANNED. Continue exact Phase068;
no commit, push, deployment, Game29 or overall product READY claim.
