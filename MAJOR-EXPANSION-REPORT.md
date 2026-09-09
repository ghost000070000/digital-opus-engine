# Major Game-Builder Expansion + Stress-Dogfood Batch — Final Report

## Verdict: `QUALIFIED_WITH_BOUNDED_GAPS`

Real, deep, verified capability was added and three genuinely different
playable stress-test games were built and proven end to end. A large
remaining portion of the original ~25-track wishlist (see "Not built this
batch," below) was deliberately not attempted rather than shallow-touched,
in dependency order, so the depth here is real rather than spread thin.
That's a legitimate, explicitly-allowed outcome per the batch spec, not a
failure — the bounded gaps are itemized and ranked below, not hidden.

## Capability inventory (what actually got built, in dependency order)

1. **Three bounded AUDIT.md fixes** (High severity, done first, kept
   bounded): Custom Script session-trust gate; glTF import allocation
   bound before allocating; Node Graph node-id collision fix. All three
   regression-tested (`tests/editor-smoke.html`, `tests/public-api.test.js`).
2. **Object References**: stable per-item `id` + optional user-editable
   `name`, surviving rename/duplicate/Save-Load/Undo-Redo/scene-switching;
   `findItemById` resolves gracefully (no-op, not a crash) when a target
   has been deleted.
3. **Shared action-execution core**: one `ACTION_TYPES`/`executeAction`
   table now backs both the fixed trigger/action dropdown and Node Graph —
   previously two separate implementations. Vocabulary grew from 7 actions
   to 19: Message, Sound, Win, Lose, Objective, Boost, Move Object, Set
   Position, Rotate Object, Show/Hide Object, Enable/Disable Object,
   Destroy Object, Change Color, Set/Increment/Decrement Counter, Spawn
   Prefab, Set Checkpoint, Respawn At Checkpoint, Custom Script (fixed-
   dropdown-only, by design). All target-reference-aware via a shared
   dropdown-of-placed-items field type.
4. **Trigger Volumes**: first-class invisible-in-play trigger regions
   (reuses the cube item shape via an `isTrigger` flag, not a new item
   kind); On Exit added as a trigger type (available on any object, not
   just volumes); one-shot/repeat semantics.
5. **Prefabs**: save any placed object as a named, reusable template
   (persisted independently of any project); place instances from a
   dedicated palette section via the same pointer-drag path as built-in
   objects.
6. **AI Behavior**: Follow (chases the craft), Orbit (circles a base
   point), Wander (random drift within a radius) — direct steering, no
   navmesh, per the spec's explicit scope boundary. "Chase" is Follow at a
   higher user-set Speed, not a separate code path.
7. **Grouping**: a Group/Ungroup control; clicking any one grouped member
   reselects the whole group for coherent move/duplicate/delete, without
   needing a full transform hierarchy.
8. **Spawn Prefab**: runtime instantiation mid-play-session, fully wired
   with live triggers immediately (not just "from the next play session"),
   with cleanup of runtime-spawned items on Stop.
9. **On Start trigger**: fires once per Play session before the craft
   spawns, for initializing counters; `window.__gameState` and
   runtime-spawned items now correctly reset between Play/Stop cycles
   (previously silently persisted).
10. **Counter At Most condition**: the `<=` counterpart to the existing
    `>=` Counter Reaches, for counters that count down to a floor (health,
    lives) rather than up to a threshold — found and fixed via an actual
    failing playtest of Game C, not a synthetic test.
11. **Checkpoints/Respawn**: Set Checkpoint + Respawn At Checkpoint, so a
    hazard can knock the player back to a safe point instead of ending the
    game outright.

Every item above has its own dated finding in `API-FRICTION.md` (#20–#33)
with the concrete need, the rejected alternative, the actual change, and
how it was verified — not just asserted.

## Per-game breakdown

### Game A — Crate Run Expanded (`games/crate-run-expanded.patch.js`)
A real evolution of the *shipped* starter game's mechanics, not just more
islands: every hazard's instant Lose is replaced with a 3-life system
(hit → message → respawn at last checkpoint; only the third hit ends the
game), plus three Checkpoint Trigger Volumes. Verified by fetching and
`eval`-ing the exact shipped file (not a re-typed copy): the 3-hit
sequence fires correctly, including the fallback-to-normal-spawn-point
case before any checkpoint is touched, and the full 21-crate win condition
is unaffected.

### Game B — Temple Switch Puzzle (`games/temple-switch-puzzle.json`)
Stress-tests object references and cross-object logic. Two one-shot
Trigger Volume switches must both be activated (tracked via a shared
counter) before a separate Goal trigger will accept Win; each switch also
changes the color of a specific *other* object (an id-based target
reference, verified to keep resolving correctly after that object was
renamed mid-session — the exact object-reference guarantee this whole
batch's Object References work exists to provide). No physical door,
since cubes have no collision in this engine (see bottleneck #1, below) —
adapted to a logic-gated goal instead, which is the honest fit for what
the engine actually supports.

### Game C — Survival/Arena (`games/survival-arena.json`)
Stress-tests runtime spawning and state. Three AI-Follow "Hunter" enemies
continuously chase the player; touching one costs health (Node Graph:
Decrement Counter → gated Lose via Counter At Most); four orb pickups
disappear and increment a `collected` counter, gated Win at 4. Verified
with genuine real-time physics — an enemy closing a real 10-unit gap over
~1s of actual elapsed time and tripping an actual `TriggerVolume`, not a
manually-invoked shortcut — and the exact bug this game's own dogfooding
caught (finding #31, `counterReaches` firing Lose on the *first* hit
instead of the third) was fixed and reverified this same way.

## Engine friction discovered and root-fixed

14 new findings this batch (`API-FRICTION.md` #20–#33), 3 of them the
scoped-in-advance AUDIT.md High fixes and 11 discovered by building and
playing the games above. Two are worth calling out specifically because
they were caught by *playing*, not by inspection or a synthetic test:

- **#31**: Game C's Lose condition fired on the first hunter touch instead
  of the third — `counterReaches` is `>=`, structurally wrong for a
  counter that only falls. Fixed by adding `counterAtMost` (`<=`) as a
  sibling condition, reverified with a real AI chase, not a manual call.
- **#33**: Considered giving Game A a Spawn-Prefab-driven bonus wave;
  caught by design reasoning (not a runtime failure) that Spawn Prefab
  depends on the *player's local* prefab library, which isn't part of a
  portable project file — recorded as a real gap (see bottleneck #4) and
  Game A's design adjusted to not depend on it, rather than shipping
  something that would silently break for anyone else who imported it.

## Scale results

A live scene was pushed to 293 objects (43 shipped + 250 stress-added,
~50 of them running live AI Behavior simultaneously) and played for a real
elapsed second with zero console errors. `serializeScene()`: 0.5ms.
`loadScene()` round-trip: 17.5ms. `app.save.save()` (localStorage):
2.2ms for the resulting ~87KB payload. `pushUndo()`: 0.7ms. No bottleneck
found at this scale — 293 objects is well above anything the three
stress-test games or the shipped Crate Run actually use (43–47 objects
each), so this is genuine headroom, not a tuned-to-pass number.

## Persistence results

Every new piece of per-item state (`id`, `name`, `groupId`, `isTrigger`,
`triggerRepeat`, `ai`, and the corrected `patrol` re-basing) was verified
through a real Save/Load round trip via `serializeScene`/`loadScene`, not
just asserted to be included. Prefabs were verified to survive a full page
reload (separate `localStorage` key, independent of any one project).
`games/*.json` were verified by fetching and importing the actual files
from disk through the real Import Project JSON path, not by trusting
in-memory state.

## Existing-regression confirmation

- **Crate Run still wins at 21/21** — reconfirmed after every single track
  in this batch, most recently on a fresh page load with no prior mutation.
- Hazards still lose (7/7 present, confirmed firing Lose).
- Boost pads still present and functional (5/5, force-add confirmed
  working through the legacy `.param` dispatch path in finding #24's
  verification).
- Node Graph still works, including through the shared-core refactor
  (finding #24) and the new condition-node addition (finding #31).
- `tests/public-api.test.js`: **19/19 passing**, rerun after every track.
- `tests/editor-smoke.html`: **3/3 passing** (starter game boots, Custom
  Script trust gate, Node Graph id collision), rerun after every track.
- Touch input and glTF import: untouched by any change in this batch (no
  edits to `engine/src/12-touch*` or `21-gltf.js` beyond finding #21's
  allocation-bound, which has its own dedicated regression test); not
  independently re-run this session, so this is "no code path touched,"
  not "explicitly reverified," and is called out as such rather than
  implied otherwise.

## ONNX / local-AI decision

**`ONNX_NOT_JUSTIFIED_YET`** — full reasoning in `ONNX-UTILITY-ASSESSMENT.md`.
No friction found or game built this batch was blocked by something only a
model could solve; every gap closed with a small, deterministic, testable
change instead.

## Top 5 ranked next bottlenecks

Per the batch's explicit instruction: **not auto-fixed here.** Finding
where the system bends was part of the objective; these are handed back
for a decision, not silently patched.

1. **No solid-object collision.** Cubes (crates, hazards, doors, prefabs)
   are purely trigger-based — nothing physically blocks the craft. This
   directly shaped Game B's design (a logic-gated goal instead of a real
   blocking door) and is the ceiling on any future puzzle/platformer game
   that wants physical blocking, pushing, or stacking.
2. **No multi-scene/level system.** Exactly one project can be open (and
   saved to the single `'editor-project'` localStorage slot) at a time;
   the three stress-test games in `games/` exist as separate files loaded
   one at a time via Import, not as levels within one project. Explicitly
   called out in the original spec as a major architectural stress test,
   and it remains unattempted.
3. **Prefabs aren't portable with the project that references them**
   (finding #33). A project using Spawn Prefab silently depends on the
   author's local prefab library, not on anything the project file itself
   carries — a real correctness gap for sharing a project built with
   prefabs, found by design reasoning while scoping Game A.
4. **No transform gizmos.** Object placement/editing is still
   number-field-and-drag only; the spec's axis-constrained
   move/rotate/scale gizmo track was not attempted this batch. Every game
   built this session used plain-number positioning successfully, but a
   larger or more spatially fussy level would feel the gap quickly.
5. **No standalone playable export.** "Export Project" produces a project
   JSON re-importable into the editor, not a self-contained playable HTML
   file a player could open with no editor present. The three
   stress-test games are only playable by importing them into
   `editor/index.html`, not by opening a standalone file directly.

## Post-report continuation

The batch spec's own instruction was to stop after this report rather than
auto-fix the ranked bottlenecks. The user explicitly asked to keep going
afterward, so work continued against the ranked list above, same
dogfooding discipline (real change, real verification, regression pass
after each):

- **Bottleneck #3 closed** (API-FRICTION.md finding #34): Export Project
  now scans a project for every Spawn Prefab reference (fixed dropdown and
  Node Graph node alike) and bundles exactly those prefabs' records into
  the exported file; importing merges them into the recipient's local
  library, additive-only (never overwrites a same-named local prefab).
  Verified with the exact scenario finding #33 described: a recipient with
  an empty local prefab library importing a project that uses Spawn Prefab
  now gets it working immediately, where before it would have silently
  no-op'd.

- **Bottleneck #5 closed** (API-FRICTION.md finding #35): a new "Export
  Standalone Game" button produces a single self-contained, double-
  clickable HTML file — the engine bundle and the editor script inlined
  directly (no `<script src>`, no adjacent `dist/`/`src/` folders needed),
  booting straight into the embedded project via the exact same boot path
  Crate Run itself already used, "Edit This Game" toggle included. Caught
  and fixed a real bug in the process (not a hypothetical): the editor's
  own source contains the literal substring `</script` (inside this very
  feature's code), which silently truncated the very first export attempt
  when inlined raw, because the HTML parser ends a `<script>` block at
  that literal text regardless of JS syntax. Verified against real files
  end to end: the generated file boots directly into Survival Arena (not
  Crate Run), initializes health via a real On Start behavior, and fires a
  real Win on collecting all 4 orbs.

- **Bottleneck #1 closed** (API-FRICTION.md finding #36): added
  `Physics.resolveBoxCollision` (circle-vs-AABB resolution, XZ-plane only —
  the craft's height is already fully managed by terrain/water sampling,
  independent of this) plus a per-object "Solid" inspector checkbox,
  opt-in so every existing game's pass-through crates/hazards/triggers are
  unaffected. An invisible solid object doesn't block, so the pre-existing
  Show/Hide Object action doubles as a complete door mechanic with no new
  action needed. Immediately used to upgrade Game B's Door from a
  logic-gated goal to a real physical block, reverified end to end from
  the actual repo file with deterministic 60Hz physics stepping: blocked
  before both switches are hit, opens and passes through after.

- **Bottleneck #4 partially closed** (API-FRICTION.md finding #37): the
  inspector previously had no rotation control at all and only uniform
  scale — a gap concretely hit while giving Game B's Door its wide, thin
  shape, which was only reachable through direct code, not the UI. Added a
  Rotation Y field (degrees) and independent Scale X/Y/Z fields with a
  Make Uniform convenience button. This closes the *numeric* half of the
  bottleneck; on-screen 3D drag gizmos (axis-constrained handles in the
  viewport) remain unattempted and are the larger, still-open half.

- **Bottleneck #2 partially closed** (API-FRICTION.md finding #38): added
  `SaveSystem.list()` (enumerates saved slots — the actual missing piece;
  `save`/`load` already took an arbitrary slot name) plus a Project Name
  field, Saved Projects dropdown, and Load/Delete Selected buttons,
  replacing the single hardcoded `'editor-project'` slot. This closes
  "keep several independently-named local projects around and switch
  between them," which is genuinely useful and was genuinely missing, but
  is NOT the larger "multiple levels loaded and switchable within one
  running project" architecture the original bottleneck also implied —
  that remains unattempted and would need Undo/Redo, the play-session
  lifecycle, and every `placed`-array-holding piece of state to become
  level-aware. Also fixed a test-infrastructure gap found while verifying
  this: the test suite's mock `localStorage` never implemented `.length`/
  `.key(i)`, so it silently couldn't exercise enumeration at all.

- **Bottleneck #4 fully closed** (API-FRICTION.md finding #39): added an
  on-screen Move gizmo (X/Y/Z axis handles, click-and-drag) on top of
  finding #37's numeric fields, closing both halves of "no transform
  gizmos." Built entirely from existing capability (a handle is just a
  thin colored cube; the drag math reuses `worldToScreen`, already built
  earlier this batch for marquee-select). Found and fixed a real
  hit-testing bug in the process: the first version picked handles via a
  sphere at each one's center, which — since all three share one origin —
  picked the wrong axis when clicked, confirmed by dispatching a real
  `PointerEvent` at the X handle and watching the object move along Y
  instead. Rewritten as closest-approach-to-line-segment picking, which
  correctly disambiguates. Rotate/Scale on-screen handles remain a
  smaller, separate, not-yet-needed follow-up (their numeric fields
  already exist).

- **Bottleneck #2 fully closed** (API-FRICTION.md finding #40): added
  `levels` (an array of `{name, objects}`, alongside `placed` rather than
  a rewrite of it — `placed` stays exactly "the active level's live
  content," the inactive levels sit as plain serialized data swapped in
  via the same `loadScene` Save/Load/Undo already used) plus a Levels
  panel and a `Switch Level` action for gameplay-driven transitions
  between levels (carries score/lives across the switch; fires the new
  level's own On Start behaviors). `serializeProject()`/`loadProjectFull()`
  now back Export/Save/Load/Import/Standalone-Export, accepting every
  project-format generation this editor has produced, so all three shipped
  games and every existing save keep loading unchanged. Found two real
  caching bugs while testing this (not while building it): `editor/index.html`
  served stale from browser cache twice, silently missing the new UI and
  crashing the boot sequence before `buildStarterGame()`; and the test
  harness's own iframe had no cache-busting at all, meaning it was
  vulnerable to the identical failure on every future run until fixed with
  a `Date.now()`-based query string.

All five bottlenecks from the original ranked list are now closed, three
fully from the initial continuation and two (#2, #4) fully closed across
this session with an honest intermediate "partial" state along the way,
documented rather than glossed over. Remaining future work is what was
already flagged as deliberately out of scope for this session (Rotate/
Scale on-screen handles, a project-scoped/bundled prefab library beyond
what finding #34 already does) — smaller, separate follow-ups, not
silently-dropped bottlenecks.

## Second continuation: two items from "Not built this batch"

With all five ranked bottlenecks closed, work continued into the original
"Not built this batch" list (still per explicit user request to keep
going):

- **Pause** (API-FRICTION.md finding #41): investigating "start/pause/win/
  lose screens" found Pause already fully built at the engine level
  (`App.pause`/`resume`/`onPauseChange`) and simply unreachable from the
  editor (`hud: false` disables the HUD's own pause button, and the
  engine's internal Escape-key pause toggle had no visible feedback at
  all). Added a Pause/Resume button and overlay. Verified the freeze is
  real with an `app.onUpdate`-registered tick counter (73 ticks/500ms
  running, 0 while paused, 72 after resume) — first pass reached for a
  polling workaround before finding the already-public `onPauseChange`,
  corrected once found rather than shipped as a workaround.
- **Environment settings** (finding #42): sky/fog/sun were already
  fully rendered by the engine, just entirely hardcoded with no public
  accessor. Added `App.setEnvironment`/`getEnvironment` plus a per-level
  editor panel (Sky/Fog color, Sun color, Fog density) — kept per level,
  not global, consistent with finding #40's levels work. Caught a real
  reconstruction bug before it shipped: a round-tripped `lightDir` comes
  back from JSON as a plain object, not a real `Vec3`, which would have
  thrown on load of any project with a customized environment — fixed and
  reverified via the actual Export→Import round trip, not just reasoning
  about the format.

Both verified through real UI interaction and the full regression suite
(21/21 `public-api.test.js`, 3/3 `editor-smoke.html`, 6/6
`browser-smoke.html`, 21/21 crate win path, all three shipped games
replayed and won).

## Not built this batch (explicitly deferred, not silently dropped)

Transform gizmos; multi-scene/level system; player-controller/camera
authoring beyond what already existed; a dedicated pause screen (On Start
now covers session initialization, and Win/Lose overlays already existed
pre-batch, but no separate Pause UI was built); bounded UI authoring;
audio/particle/environment authoring; bounded material/visual variety;
asset library; project format versioning/migration (only additive,
backward-compatible fields were added — no explicit version number or
migration path exists); standalone playable game export; editor UI
reorganization for growing capability density. All were reachable in the
original ~25-track list; none were shallow-touched instead of the depth
delivered above, per this batch's own stated priority.
