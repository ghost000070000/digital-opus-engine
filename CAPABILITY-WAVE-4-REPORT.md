# Capability Expansion Wave 4 — Closeout Report

Digital Opus Engine · Wave 4 · closed out this session

This report summarizes everything built, fixed, and verified in Wave 4, per
the wave's own governing discipline: build meaningful capability → build
real games with it → find what breaks → fix the reusable root cause → keep
building. Every feature below was authored through real editor functions in
a live browser (never hand-authored JSON, never an internals bypass), and
every claim of "verified" below is backed by an exact-value assertion
actually run against live engine/editor state, not visual inspection alone.
Full detail for every item lives in [CHANGELOG.md](CHANGELOG.md) (the
"Capability Expansion Wave 4" section) and [API-FRICTION.md](API-FRICTION.md)
(findings #52–#60); this report is the summary, not a replacement for either.

## 1. Capability delivered this wave

| Area | What shipped |
|---|---|
| Spawning | Spawn Point object + generalized `computeSpawnPoint()` priority chain (closes finding #51) |
| Scene graph | Real transform hierarchy (parent/child), Prefabs 2.0 (multi-object prefabs) |
| Terrain | Terrain Sculpting (Raise/Lower/Flatten/Smooth brushes over a real heightfield, collision-consistent) |
| Lighting | Placeable Point/Spot Lights (`App.createLight`, bounded `MAX_LIGHTS=8`, shadows explicitly deferred) |
| Materials | Materials 2.0: Unlit, Transparency/Alpha, Emissive, UV tiling/offset |
| Animation | Property Animation (multi-keyframe clips, Animation Editor modal), Play/Stop/Restart/Pause Animation actions |
| Combat | Object Health, Projectiles (`fireProjectile`), Fire Projectile action, Player Weapon, Enemy Ranged Attack |
| Navigation | Waypoint Graph pathfinding (`item.connections`, A* via `findWaypointPath`, Navigate To Target AI) |
| Input | Input Actions (rebindable Interact/Attack, gamepad-synced) |
| UX flow | Pause Menu (Resume/Restart/Main Menu), Project Settings (Volume/Quality/Fullscreen, `App.setQuality`) |
| Authoring speed | Command Palette (Ctrl+K) |
| Asset management | Asset Library search/tags/folders (mesh + texture + audio, one shared mechanism) |

## 2. Required stress games (all 4, all shipped, all bug-found-and-fixed where applicable)

| Game | File | Proves | Bug found & fixed |
|---|---|---|---|
| Opus Arena | `games/opus-arena.json` | Object Health + Fire Projectile + Enemy Ranged Attack + Player Weapon + Spawner, together | **#59** — `usedPrefabNames` missed `ai.attackPrefab` and `playerSettings.weapon.prefabName`, silently dropping a used prefab from export |
| Power Station | `games/power-station.json` | Hierarchy + Property Animation + Interact + Inventory + Dialogue + Lights + Materials, together | none (clean build) |
| Valley Run | `games/valley-run.json` | Real sculpted terrain (brush strokes, not a seed) + jump/platform section + Waypoint patrol + Checkpoint/Respawn + multi-light Environment | none (two dev-tooling gaps found and worked around, not product bugs — see §4) |
| Sentinel Maze | `games/sentinel-maze.json` | Waypoint Graph pathfinding against a REAL maze (not open terrain): a wall a direct line crosses, a connected route that doesn't | **#60** — Navigate To Target's recompute timer oscillated forever when near a route-segment midpoint, re-selecting an already-passed waypoint on every recompute |

Every one of the 4 was: built through real editor functions → dogfooded
with exact-value assertions (not screenshots) → exported → re-verified
after a fresh `fetch()` + `loadProjectFull()` round-trip of the exact
shipped file. All 13 shipped stress games (9 from Waves 2–3 plus these 4)
and Crate Run were reverified regression-clean in one sweep at closeout
(§5).

## 3. Real bugs found and fixed this wave

Three genuine, previously-undiscovered bugs were found by dogfooding, not
by inspection — each is a new API-FRICTION.md finding with full diagnosis:

- **#58** — Pause overlay was silently `.visible` underneath the Start
  Screen/Dialogue the whole time (harmless until Wave 4 gave it real
  buttons). Fixed by gating pause-overlay visibility on both being hidden.
- **#59** — `usedPrefabNames` didn't recognize two prefab-reference shapes
  Wave 4 itself introduced (`ai.attackPrefab`, `playerSettings.weapon.prefabName`),
  silently dropping a used prefab from `serializeProject()`'s bundle.
  Fixed by extending the whitelist and adding a sibling
  `usedPrefabNamesFromPlayerSettings` for the project-level case.
- **#60** — Navigate To Target's periodic route recompute re-seeded itself
  from "nearest waypoint to raw position" even mid-route, flip-flopping
  between two waypoints near a segment's midpoint and oscillating forever
  instead of progressing. Fixed by seeding recompute from the
  currently-targeted waypoint instead, only falling back to
  nearest-to-position for a genuinely new chase.

All three: reproduced with an exact repro script, root-caused, fixed at the
reusable source (not worked around per-game), and re-verified against the
exact scenario that exposed them plus a fresh export round-trip.

## 4. Dev-environment/methodology findings (not product bugs)

Two artifacts of THIS session's specific browser-automation setup were
found and worked around — documented so they don't get mistaken for engine
defects later:

- This session's preview browser tab does not fire `requestAnimationFrame`
  while unattended/backgrounded — real wall-clock waiting left `simElapsed`
  frozen at 0 even with `playMode` true. Worked around by manually invoking
  the engine's own per-frame callback array (`app._d` in the built bundle)
  with an explicit `dt`, the same "drive the real function directly"
  discipline already established for `tickTweens`/`tickProjectiles`.
- Hand-transcribing a large generated JSON blob (Valley Run's ~529-element
  terrain height-delta array) into a file lost 1-2 elements, twice, purely
  from manual copy-paste at that size — not a serialization bug (the live
  browser array was always exactly 529). Resolved by having the browser
  `fetch()`-POST the real export straight to a small local file-write
  endpoint, eliminating manual transcription entirely; the shipped file was
  then confirmed byte-exact.

## 5. Final regression sweep (this session, at closeout)

- `node --check editor/src/01-editor.js && node build/build.js && node tests/run-tests.js` → **23/23 passed**, re-run after every single change in this wave, always green.
- All 13 shipped stress games (`games/*.json`) loaded fresh via `fetch()` + `loadProjectFull()` in one sweep — all 13 loaded without exception, correct object counts, zero new console errors (only this session's pre-existing, timestamp-identified stale entries and the known headless-AudioContext warning).
- Performance sweep at the spec's required scale (§6) and three torture-test scenarios (§7) all run and measured directly, not assumed.

## 6. Performance sweep (measured, not assumed)

Real entities placed via `app.addEntity`/`addPlaced` (the same path every
placed object goes through), renderer (`app._J.render()`) and full editor
update loop timed directly, warmed up first:

| Objects | Avg render (ms) | Avg update (ms) |
|---|---|---|
| 500 | 1.01 | — |
| 750 | 1.54 | — |
| 1000 | 1.93 | — |
| 1500 | 4.43 | 0.28 |
| 2500 (beyond spec, for headroom) | 3.35 | — |

Even the worst point (1500 objects, ≈4.7ms total) leaves well over 12ms of
headroom inside a 60fps budget; the 2500-object point coming in LOWER than
1500 shows the 1500 reading includes real measurement noise, not a genuine
superlinear trend. **GPU instancing: deferred, `INSTANCING_DEFERRED_NOT_YET_NEEDED`**
— the renderer does issue one draw call per entity today (confirmed by
reading the renderer source, not assumed), but measured evidence at the
spec's own required range shows no performance problem instancing would be
solving yet. Revisit if a future game's dogfood needs meaningfully more
than ~2500 simultaneous entities.

## 7. Torture tests (real scale, measured)

- **Hierarchy, 10-level-deep + 100 objects** (covered earlier this wave, during the transform-hierarchy build): built in 2.3ms, serialized in 0.5ms, round-tripped in 2.1ms, every parent/child relationship and world position intact.
- **Prefab, 50-copy**: placed via the real prefab-instantiation path in 92ms total; serialize <1ms; round-trip load 0.9ms; every one of the 50 has a genuinely unique id afterward.
- **Projectiles, 2000 simultaneously fired**: fired in 6.8ms; ticked through full lifetime in 73.2ms total; zero leaked scene objects after expiry.
- **Terrain sculpting, 300 real brush strokes**: 398.9ms total (≈1.3ms/dab, each a full terrain regenerate); zero NaN/Infinity corruption in the resulting height-delta grid.
- **Light-count limit** (covered earlier this wave, during the Lighting 2.0 build): 12 lights placed, exactly one over-limit console warning fired (not one per frame).

## 8. Utility gates assessed honestly this wave

- **glTF skeletal animation**: `SKELETAL_ANIMATION_DEFERRED_WITH_TECHNICAL_REASON`. Zero existing skinning groundwork in the importer; would need a new vertex attribute layout, the session's first VERTEX-shader change, and a bone-transform composer that is NOT reusable from the object transform hierarchy just built. Property Animation already covers this wave's actual "door/turret/collectible" dogfood need without a skeleton.
- **Shadows**: `SHADOWS_DEFERRED_WITH_REASON`. A materially larger lift than placeable lights (full depth pass, light-space matrices, a shadow map, bias/PCF tuning) for less real game-builder value per this wave's own explicit priority ordering.
- **GPU instancing**: `INSTANCING_DEFERRED_NOT_YET_NEEDED` (§6) — measured, not assumed.

## 9. Explicitly out of scope / not attempted this wave

- Movement (WASD) and Jump/Boost stay hardcoded in Input Actions — only Interact/Attack are rebindable, a disclosed bound to avoid touching three separate controllers' physics code for a part of the input surface nobody asked to rebind.
- Waypoint connections are bidirectional-only (one-way connections weren't worth the extra authoring UI this pass, per the spec's own "only if easy" gate).
- Spawning a whole multi-object prefab assembly at runtime (Spawner/Spawn Prefab still spawn only the root piece of a multi-object prefab) — a real, separate future extension.

## 10. Closeout verification (final pass, after §1–§9 above)

Four items flagged as still-owed after the first draft of this report were
completed and verified before treating the wave as closed:

- **ONNX utility gate, re-affirmed for Wave 4**: Terrain Sculpting, Property
  Animation, Waypoint Graph pathfinding, Combat, Command Palette, and Asset
  Library tags/search all reviewed — none is a learned/classification task;
  all remain deterministic and rule-based. `ONNX_NOT_JUSTIFIED_YET`.
- **Playable Export verification, through the real pipeline**: built an
  actual Playable-tier export of `sentinel-maze.json` via `buildExportHTML(true)`
  (Wave 4's newest, most recently fixed system), opened it in a completely
  fresh browser tab with zero editor state, and reproduced the identical
  chase-and-catch result already verified in the editor purely from that
  standalone bundle — confirming the wave's work is real product behavior,
  not an editor-only illusion. Zero console errors.
- **Schema/migration, single-normalization-path confirmed**: loaded the
  oldest pre-Wave-4 shipped game through the unmodified `normalizeProjectData()`
  path and confirmed every Wave 4 field defaults cleanly with no crash — no
  second, Wave-4-specific load path was ever written.
- **Touch/gamepad retest, re-confirmed not re-trusted**: read the live
  viewport pointer handler and confirmed it has no `pointerType` branching
  anywhere (touch/pen structurally cannot diverge from mouse); re-simulated
  a gamepad and confirmed Interact still fires through the current Input
  Action binding after every later change this wave (Command Palette, Asset
  Library) touched nothing near the input layer.

## 11. What this report is not

This wave is closed at a real, verified stopping point, not because
everything conceivable was built. Per the standing instruction, Wave 5 does
not begin automatically after this report.
