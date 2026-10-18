# Phase066 — Reusable event-driven prefab patterns

COMPLETED on `ecc6aa369b3ea03612b4919b09137db8c128a22f256feeda27ce7713f58ecbd7`.

Three discoverable Event-driven Prefabs gameplay presets compose existing public
Signals and ordinary editable Behaviors: Signal Sender, Signal Indicator and
Signal Show/Hide. Named Signal selectors, native Color/Boolean controls and clear
channel guidance let creators capture paired roles as a reusable assembly without
Script, hidden IDs or a second Prefab/dispatcher runtime. Sender supports existing
Click/Enter/Start Events and no-value Signals; receiver roles accept existing typed
or no-value declarations. Named references validate before history/mutation.
Updating a role replaces only its own preset Behavior, preserving unrelated
creator logic; changing Sender Event does not leave duplicate senders.

Actual creator dogfood reopened earlier history/persistence/input boundaries:

- Single-object Save Prefab lacked Undo while assembly capture already had it.
  Save and Update From This now capture history before library mutation.
- Viewing parameters inserted empty authored maps. Rendering is now read-only;
  maps initialize only on real edits. Invalid parameter-list data is retained,
  and Add refuses with a diagnostic rather than replacing unknown content.
- Default, label, variable-name and override edits lacked history. Mutations now
  capture before changing data, preserve false/zero and avoid duplicate history
  for input/change notifications of the same value.
- Normal and full-bundle snapshots retained live variable/override/Behavior maps.
  Later edits corrupted prior snapshots. Both boundaries now own deep-copied
  portable scene records; native zero/clear Undo proved the repair.
- Gameplay picking allowed hidden receivers to intercept visible Click senders.
  Play excludes hidden Cube/Sprite/Tilemap/Terrain objects; editor selection of
  hidden authoring objects remains unchanged. Actual-source red and real canvas
  input confirmed the defect and repair.
- Bundled-library loading discarded parameters and recoverable metadata.
  Imported definitions now retain independent complete portable payloads.
  Parameter definition edits and Undo/Redo persist the local library, preventing
  a stale local definition from silently defeating refresh/reopen.

Permanent regressions use actual handlers, adapter, history capture and picker:
`tests/phase-066-event-prefabs.test.js`. The earlier preset and capability tests
were extended to cover the three roles without lowering their old assertions.
Captured failed attempts and diagnoses remain in
`qualification/phase-066/history-and-oracle-findings.json`.

Native `patterns-browser-20261010T004128882Z`:21 observations PASS, zero page,
console and external-request errors. Native controls create named scoped Signals,
apply and update roles, capture an assembly, drag two independently owned instances,
remove one sender to prove no cross-talk, use actual canvas input on a Click
sender, duplicate a third instance, Undo exactly, rename references, Save/reopen
and run both exact exported tiers. Source/reopened Source/Editable/Playable
preserve independent visible Indicator/Show effects. Screenshots include the
readable named preset picker, clicked pattern and both exported patterns.

Native configured-parameter `event-prefabs-browser-20261010T003833630Z`:10
observations PASS. Single capture, Add Parameter, bound default7, explicit zero
override, Clear, exact Undo/Redo, native Save/reopen and both exported parameter
definitions/starting variables all pass. No browser errors or external requests.
Prior065 relay compatibility `relays-browser-20261010T004004455Z`:20 native
observations PASS with zero errors on this same fingerprint.

Final `regression-direct-20261010T003854855Z`:8 gates PASS,375 syntax files,
integrated suite, engine, all28 catalog games, both sites, JSON, diff and matching
start/final fingerprint. Earlier gate caught a stale capability improvement-phase
assertion; it was extended to require the new evidence and retained limits.
The earlier8a6b gates do not qualify the later parameter-persistence repair.

Fresh `probe-20261010T004045739Z`:Arsenal Run, Power Grid, Signal Relay, Silent
Sector, Relic Frontier, Dungeon Descent and Survival Arena actually start, accept
input, move, restart natively and move again. All four controller families, zero
page/console/external errors. This is proportional compatibility, not a new full
collision soak or a claimed full playthrough.

Qualification distinctions: Playable intentionally prunes unrelated Tile authoring
metadata, so it uses exact pattern/instance/Signal records plus actual runtime
effects, while Editable/source retain exact full authoring state. A hidden chrome
timeout was an automation selector failure, not data loss. Visible neighboring
geometry and unrelated moving-platform motion were isolated in the internal
fixture, not misreported as a solver failure. Camera framing was corrected so
distance fog did not hide visible Color evidence. Captured template scene senders
are ordinary Objects, not automatically authoring-only: after capture the unused
scene Sender was removed through native controls; library instances remained.

Limits remain explicit: Cube-oriented preset Inspector, no new full Sprite role
authoring, no inactive mailbox, no arbitrary structured payload or independent
cross-project dependency-bundle promise. Historical additive library import
preserves existing same-name definitions rather than overwriting unrelated user
content. Parameter bindings remain existing root-level fields, not arbitrary
child Action configuration. Visible Cube picking retains its historical sphere
approximation. Signals capability remainsB, not feature-count promotion.

No public game content, Game29, commit, push, deployment or external dependency.
Continue automatically to067 — Signal debugging inspector.
