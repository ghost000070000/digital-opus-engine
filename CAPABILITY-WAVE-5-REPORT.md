# Digital Opus Engine — Capability Expansion Wave 5 — Final Report

Full 3D Authoring, Character Animation, FPS Gameplay & Runtime Assemblies

## 1. Verdict

**`WAVE_5_SUBSTANTIALLY_DELIVERED_WITH_NAMED_GAPS`**

Priorities A through K, plus J's own re-confirmation, are built, dogfooded live in a real browser against real shipped games, and documented in detail. Three required stress games (Moving Temple, Assembly Line, Blacksite) are shipped, playable, and verified end-to-end from fresh file loads. All required torture tests (full-XYZ hierarchy, runtime-prefab-at-scale, first-person input, projectile-at-volume, moving-platform including rotation, shadows-at-scale) passed, the required performance sweep and schema-migration confirmation are done. Priority G (skeletal animation) was investigated and honestly deferred with concrete evidence, not skipped. Four real, previously-undiscovered engine/editor bugs were found and fixed via this process, each documented with reproduction, fix, and re-verification.

Priorities L (Event Channel/Signal), M (Fullscreen Game UI/Menu polish), N (Mouse Input Actions), and O (Level Streaming) were **not reached** this Wave — an explicit scope decision made under this session's own time budget, not a build failure. None of the three shipped stress games' own dogfood surfaced a hard requirement for L or O (the spec's own gate for both), so their deferral is consistent with the spec's "only add if a stress game demonstrates real need" instruction. M and N are real, valuable, bounded gaps (see section 8) that a follow-up pass should pick up first — but per the spec's own explicit instruction, **Wave 6 is not started here.**

## 2. Capability Matrix

| # | Capability | Status | Notes |
|---|---|---|---|
| 1 | Full XYZ object rotation (Priority A) | BUILT | `Opus.Quat`, bit-exact backward compat with legacy `rotationY`. Full hierarchy, gizmo, inspector support. |
| 2 | Full XYZ hierarchy inheritance (cube/camera/spawner/light) | BUILT | Extended beyond Wave 4's cube-only restriction. |
| 3 | Rotate gizmo (3-axis rings) | BUILT | 2 real bugs found+fixed dogfooding (seam ambiguity, dropped first-move delta). |
| 4 | Runtime multi-object Prefab Assemblies (Priority B) | BUILT | Spawner + Spawn Prefab action both spawn full assemblies via the one shared remap mechanism. |
| 5 | Assembly-aware destroy (Destroy Assembly action, cascading cleanup) | BUILT | Deliberately separate from non-cascading Destroy Object. |
| 6 | First-Person Controller (Priority C) | BUILT | Reuses Third-Person's exact collision code; camera-owning, Pointer Lock. |
| 7 | Complete Input Actions (Priority D) | BUILT | moveForward/Back/Left/Right/jump added; Arrow-key fallback always available; rebind conflict warning. |
| 8 | Moving Solids / Kinematic World — translating (Priority E) | BUILT | Exact `0.000` carry gap proven through a full ping-pong cycle incl. direction reversal. |
| 9 | Moving Solids — vertical/elevator (Priority E) | BUILT (bug found+fixed) | See finding #61 — Y-carry double-counted against the vertical snap; fixed, exact `0.800` constant gap through a full accelerating ride. |
| 10 | Moving Solids — rotating | BUILT (scope-limited, honestly reported) | Safe (no launch/penetration/jitter, proven over 5s/multiple cycles) but does NOT sweep a standing mover's position — carry is translation-only by design, not a bug. |
| 11 | Projectile Collision 2.0 — swept, solids + tagged targets (Priority F) | BUILT | No new engine API needed (`Opus.Physics.raySphere`/`rayAABB` already public). Nearest-hit-wins. 2,500-shot volume test, 100% hit rate at the exact fast-crossing-thin-target case an end-point check would miss. |
| 12 | Hitscan weapon mode (Priority F) | BUILT | Instant ray, same swept primitives. |
| 13 | Melee weapon mode (Priority F) | BUILT | Radius + forward cone, no raycast needed. |
| 14 | Character/NPC skeletal animation (Priority G) | `SKELETAL_ANIMATION_DEFERRED_AGAIN_WITH_PROTOTYPE_EVIDENCE` | Zero existing groundwork confirmed by direct re-grep (not memory); full render-pipeline scope assessed (would be the session's first vertex-shader change); no skinned test asset exists to dogfood against. Real dedup found+fixed while investigating (`quatToMat4` duplicate of `Mat4.fromQuaternion`). |
| 15 | Bounded Directional Shadows — rendering (Priority H) | BUILT | Sun-only, PCF-softened, bounded box around the camera. Dogfooded live with a real caster/ground pair. |
| 16 | Bounded Directional Shadows — editor authoring | BUILT (gap found+fixed) | See finding #63 — the engine API existed with ZERO way to actually enable it in a saved project; fixed by folding into the existing `setEnvironment` round-trip + one new Level-tab UI section. |
| 17 | Local Point/Spot Light Quality — per-light enabled flag (Priority I) | BUILT | Plain mutable field, filtered at the one render choke-point. |
| 18 | Local Point/Spot Light Quality — spot cone visualization (Priority I) | BUILT | Editor-only marker set, same "arranged cubes" precedent as the rotate gizmo. |
| 19 | Runtime Assembly Spawner 2.0 (Priority J) | RE-CONFIRMED, NO CHANGES NEEDED | Already correct from Priority B; re-proven via a real 100-spawn + 30-simultaneous-destroy torture test. |
| 20 | Reusable Gameplay Component Presets (Priority K) | BUILT | Collectible, Health Pickup, Damage Hazard, Checkpoint, Door, Enemy, Moving Platform, Projectile — 8 presets, 2 real bugs found+fixed (`ai.base`, behavior `params` nesting). |
| 21 | Event Channel/Signal utility (Priority L) | NOT_REACHED_THIS_WAVE | Gate condition ("only if a stress game demonstrates real need") never triggered — all 3 stress games' cross-object communication needs were fully met by existing counters/flags/tags. |
| 22 | Fullscreen Game UI/Menu polish (Priority M) | NOT_REACHED_THIS_WAVE | Pause/Settings overlay already exists and works (confirmed via the first-person input torture test's own repeated pause/resume cycling); dedicated Main Menu/How-To-Play/Credits/live-bindings Controls screen not built. Real, bounded, good candidate for the next pass. |
| 23 | Mouse Input Actions (Priority N) | NOT_REACHED_THIS_WAVE | Confirmed by direct grep: no mouse-button (`Mouse0`/`Mouse1`) support exists anywhere in `Input` or the action-binding system. Attack still keyboard-only (`KeyQ` default). Pointer Lock mouse-MOVEMENT delivery for look is fully verified working (First-Person torture test); mouse-BUTTON-as-action-binding is the missing piece. |
| 24 | Level Streaming (Priority O) | NOT_REACHED_THIS_WAVE | Gate condition never triggered — Blacksite's 2-level structure loads each level's full object set on transition with no observed hitch at this content scale. |
| 25 | Asset Instancing (Priority P) | `INSTANCING_STILL_NOT_NEEDED` | Re-affirmed by the performance sweep's own measured scene (28 objects, 50 fps in-preview) showing no draw-call-bound symptom; gate stays measure-only. |
| 26 | Required stress game: Blacksite | BUILT | 2 levels, FPS+weapon+assemblies+lights+shadows+dialogue+key/door+checkpoint+HUD+level transition, dogfooded end-to-end from a fresh file load. 2 real bugs found+fixed (level-switch spawner inertness, shadow authoring gap). |
| 27 | Required stress game: Assembly Line | BUILT | 3 spawners, 18 simultaneous 2-piece assemblies at saturation, sustained real combat, zero orphans. |
| 28 | Required stress game: Moving Temple | BUILT | Translating platform + Interact-triggered elevator, dogfooded through a full chained walkthrough. 1 real engine bug found+fixed (finding #61) + 1 real level-geometry authoring bug found+fixed (elevator/landing-platform overlap) in the same pass. |
| 29 | Required torture tests (hierarchy/prefab/FP-input/projectile/platform/shadow) | BUILT | All 6 run and passed; see CHANGELOG.md for exact numbers. 2 tests each surfaced real bugs (#61 platform carry, and the hierarchy test's own independent-check bug, self-caught and fixed, not a product defect). |
| 30 | Performance sweep (combined real Wave-5 scene) | BUILT | 28 objects / 4 hierarchy members / 1 AI / 6 lights / shadows on, measured via real `requestAnimationFrame` timing: 20.0ms/frame avg (~50fps) in this session's sandboxed preview browser. Surfaced finding #64 (a serious prefab-merge bug) along the way. |
| 31 | Schema migration confirmation | CONFIRMED, NO VERSION BUMP | `PROJECT_FORMAT_VERSION` stays 3; every Wave 5 field verified to derive/default safely from the OLDEST supported (pre-levels, bare-array) project shape with zero crashes. |

## 3. Stress Game Dogfood Reports

### Blacksite (`games/blacksite.json`)
Two levels ("Entry"/"Core") composing nearly every Wave 5 priority in one real playable facility: First-Person + Pointer Lock + complete Input Actions + Jump, a Hitscan Weapon against tagged multi-piece Spawner-assembly "Sentry" enemies, a real transform hierarchy (each Sentry's beacon child), Point+Spot lights with Shadows actually enabled, an Interact dialogue console, a key pickup that unlocks a Solid door, a Checkpoint, a HUD label, and a Next-Level transition proving score/kills carry across it. Dogfooded end-to-end via one definitive atomic fresh-file walkthrough (an earlier attempt that mixed live-session play with export was caught and discarded before ever reaching disk, after it accidentally baked a mid-session-destroyed key into the "saved" level). Found and fixed 2 real engine bugs (finding #62: level-switch left new-level Spawners permanently inert; finding #63: shadows had zero editor authoring surface). Corrected an inaccurate damage-trace claim from the earlier Assembly Line writeup once the same double-`applyHitDamage`-call artifact was properly diagnosed here.

### Assembly Line (`games/assembly-line.json`)
3 Spawners producing a 2-piece "AssemblyBot" prefab continuously (0.4s interval, 6 max active each — 18 simultaneous assemblies / 36 objects at saturation) while a First-Person Hitscan player destroys them. Saturated to cap with 5s of idle ticking (exact arithmetic match), then ran 10s of real sustained combat via the actual nearest-hit-wins ray query (not scripted guaranteed hits) — zero orphaned children, zero leaked/duplicated objects throughout the churn. Re-verified after a fresh file round-trip.

### Moving Temple (`games/moving-temple.json`)
A translating platform (3s ping-pong) and an Interact-triggered elevator (4s eased vertical rise), dogfooded through a full chained walkthrough (spawn → cross the gap → ride the elevator → reach the top). Found and fixed finding #61 (a real vertical-carry double-count bug that dropped the player off an accelerating elevator) and, in the same investigation pass, a real level-geometry authoring mistake (the elevator's rise destination overlapped the landing platform's own solid footprint). Both fixed; the corrected ride holds an exact constant `0.800` gap across the full 4-second rise plus settle.

## 4. Bug Report

### Product bugs (found and fixed)
1. **Finding #61** — `applyPlatformCarry` double-counted a vertically-moving platform's own motion against the already-authoritative vertical box snap, causing a growing overshoot that dropped a rider off an accelerating elevator mid-ride. Fixed: carry now applies X/Z only, never Y.
2. **Finding #62** — `switchToLevelDuringPlay` (the function Next Level/Switch Level actually calls) never ran the same per-item Play setup a fresh `enterPlayMode()` always has, leaving every Spawner on a level reached via a transition permanently inert (no `spawnerState` ever assigned) and every editor-only marker left visible. Fixed by factoring that setup into a shared `preparePlacedForPlay()`, called from both paths.
3. **Finding #63** — Bounded Directional Shadows had a fully working, already-proven engine API (`App.configureShadows`) with literally no way for any saved project to actually enable it — no UI, no schema field. Fixed by folding `shadows` into the existing `setEnvironment`/`getEnvironment` round-trip plus one new Level-tab UI section.
4. **Finding #64** — `mergeBundledPrefabs` (run by every project load) silently dropped a multi-object prefab's `records`/`rootId` the moment it merged a new prefab name into a player's local library, permanently downgrading every Spawner-produced assembly to root-only for that player from then on, with zero error anywhere. This had been silently masked through every earlier Wave 5 test that happened to already have the correct prefab in memory. Caught only via a dedicated clean-slate reproduction. Fixed by copying `records`/`rootId` onto the merged entry.
5. **Two smaller bugs from Priority A/K dogfooding** (documented in CHANGELOG.md/API-FRICTION.md in full): the rotate gizmo's ring-picking seam ambiguity and dropped first-move delta (Priority A); a missing `ai.base` field and a behavior-`params`-nesting mistake in 5 of 8 Priority K presets, both caught by asserting exact before/after game-state values rather than "did it throw."
6. **Real dedup, not a behavior bug**: `21-gltf.js`'s private `quatToMat4` was a byte-for-byte duplicate of the new public `Mat4.fromQuaternion`, found while investigating Priority G. Removed.

### Test-environment artifacts (not product bugs, correctly attributed)
- This preview browser's `requestAnimationFrame` does not reliably fire when unattended between separate tool calls, and background ticking CAN occur between calls unpredictably — the root cause of several early false alarms across Waves 4-5, always resolved by redoing the test atomically in one script.
- Two Moving Temple "drift" false alarms (spawn-embedding, stale-`_carryPrevPos`-from-manual-teleport) and two rotating-platform "drift" false alarms (test objects placed outside the level's own 40-unit `MAP_BOUNDARY`) — all four investigated to a definitive root cause via direct instrumentation (input-state checks, function-call tracing, monkey-patching) rather than guessed at, and all four confirmed to be test-setup mistakes, not engine defects.

### Methodology mistakes (self-corrected)
- Assembly Line's own original combat dogfood called `applyHitDamage` a second time on a hit `fireHitscan` had already resolved internally, silently double-applying damage; the resulting "100 → 60 → 20 → removed, exactly 40 damage per hit" claim in the original CHANGELOG write-up was factually wrong and has been corrected in place once the same pattern was properly diagnosed while building Blacksite. The structural claims that write-up actually needed to prove (zero orphans, correct churn) were unaffected and remain accurate.
- The hierarchy torture test's own first independent verification formula omitted a parent-scale multiplication term, producing a small but real-looking discrepancy on the 100-item fan (not the chain, where the omission happened to cancel algebraically) — found, fixed in the test script itself (not the product), and reran to an exact zero-error match.

## 5. What Was Not Attempted and Why

- **Wave 6 was not started**, per the spec's own explicit standing instruction.
- **Priorities L, M, N, O** were not reached this Wave (see matrix rows 21-24) — a scope decision under this session's time budget, not a build failure. M (Fullscreen Menu polish) and N (Mouse Input Actions) are the most valuable, most bounded candidates for whatever comes next; L and O never had their own gate condition triggered by real stress-game need.
- **Skeletal animation (Priority G)** remains deferred with concrete, current-session prototype-level evidence, not a stale Wave 4 assumption re-asserted.

## 6. Regression

All 16 shipped games (13 pre-Wave-5 plus Moving Temple, Assembly Line, Blacksite) reverified loading and behaving clean after every single change landed this Wave, re-checked again at the end of this report. `node tests/run-tests.js`: **27/27**, up from 23 at the start of Wave 5 (4 new dedicated tests: `Quat`/hierarchy transform composition, `Mat4.orthographic`, and the high-dt swept-collision regression).
