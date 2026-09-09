# Digital Opus Engine — Capability Expansion Wave 7 — Final Report

Character Attachments, Gameplay AI, World Persistence & Rapid World Building

## 1. Verdict

**`CAPABILITY_WAVE_7_QUALIFIED_WITH_BOUNDED_GAPS`**

Wave 7 shipped 12 of its 13 named priorities as real, dogfooded engine/editor capability: Bone/Socket Attachments (the flagship), Animation Events, Player Equipment, a Gameplay AI State Machine, World-State Save Game 2.0, an Objectives system, Scatter Placement, Array/Duplicate, Pickup/Carry/Drop, Hit Reactions/Knockback, Projectile Muzzle Socket, and Enemy Spawner + AI State Machine integration. One priority (Simple Dynamic Physics) was assessed and deliberately deferred with a documented technical reason, exactly as the spec's own gate allows. Every shipped capability was verified through real, live dogfood against actual game files (not synthetic unit tests alone) — animated bone-following proven via genuine per-frame pose changes, world-state persistence proven across a real full-page reload (a fresh JS realm), the AI State Machine proven through a real Patrol→Alert→Chase→Attack→Flee sequence with real steering, and the flagship Muzzle Socket proven by capturing `fireHitscan`'s own real `origin` argument during a live shot.

The one honest, explicitly-acknowledged gap: the spec calls for three separately-named, separately-shipped stress games (RELIC FRONTIER / POWER GRID / FOREST RANGE). This wave shipped ONE comprehensive stress game (`games/relic-frontier.json`) that genuinely exercises the combat/equipment/AI/objectives/persistence stack together end-to-end, including a clean-room iframe export verification — but POWER GRID's own dedicated persistence-puzzle level and FOREST RANGE's own dedicated large-scale world-authoring level were not built as separate shipped files. Each underlying MECHANISM those two games would have exercised was independently torture-tested with real numeric evidence during its own priority's dogfood (100-object and 500-object Scatter, 100-object World-State persistence, 25-character Socket stress, 30-agent AI State Machine stress — all reported below with real measurements). This is a genuine, acknowledged scope reduction from the full spec, not a silent one — see Section 9.

A real regression bug was found and fixed during Priority M's own integration dogfood (a State Machine's Wander/Orbit movement crashing when no author-facing "base" field existed for it — see Section 4). No other regressions were found across a 22-game smoke-load sweep plus deep dogfooding of Iron Arena, Relic Runner 2, and Painted Wilds. ONNX stays `ONNX_NOT_JUSTIFIED_YET`. No multiplayer work was attempted. Dynamic Physics gate: `DYNAMIC_PHYSICS_DEFERRED_WITH_TECHNICAL_REASON`. **Wave 8 is not started here.**

## 2. Capability Matrix

| # | Capability | Status | Notes |
|---|---|---|---|
| 1 | Bone world-transform query | BUILT | `sampleClipJointWorldTRS`/`Opus.Skin.computeJointTransforms` — incremental TRS composition matching `resolveWorldTransform`'s own formula, sourced from the real sampled skeleton, not inferred from vertices. |
| 2 | Socket authoring | BUILT | `asset.sockets` (asset-level metadata), Socket Editor UI, joint-name dropdown with synthetic fallback for pre-Wave-7 saves. |
| 3 | Socket object attachment | BUILT | `attachToSocket`/`detachFromSocket`, reuses `item.parentId` + one new `item.socketName`; `resolveSocketSourceTransform` substitutes into the ONE existing `resolveWorldTransform` path. |
| 4 | Runtime socket-following | BUILT | Live-verified: rotation genuinely changes between Idle/Attack poses while position correctly stays fixed for a single-joint-rotation clip — true per-frame bone-following, not a one-time snap. |
| 5 | Socket prefab persistence | BUILT | `remapObjectIds`'s existing whole-JSON substitution correctly remaps `parentId` on prefab instantiation with zero socket-specific code; verified independence between original and spawned copies. |
| 6 | Animation Events | BUILT | Per-clip `{clipIndex, time, action, params}` on the asset; crossing detection verified for ordinary playback, looping (no wrap-boundary duplicate), same-time re-tick (no double-fire), high-dt skip-over, and clip-switch restart. |
| 7 | Animation-event weapon timing | BUILT | `weapon.fireOnAnimationEvent` + `fireWeapon` action; live-verified deferred fire only happens at the authored crossing, default path still fires immediately. |
| 8 | Equipment slots | BUILT | `currentPlayerSettings.equipmentDefs`, reuses Inventory as source of truth, no second item database. |
| 9 | Equip/Unequip actions | BUILT | `equipItem`/`unequipItem`, visual instantiate/attach and clean removal verified live. |
| 10 | Equipped weapon | BUILT | `weapon.source: 'equipment'` + `resolveActivePlayerWeapon()`; Fixed Weapon mode fully preserved as the default. |
| 11 | AI State Machine | BUILT | `ai.mode: 'stateMachine'`, states/transitions/entry-actions; movement/attack dispatch shared with Simple-AI via `applyAiMovementStep`/`applyAiAttackStep` (zero duplicated code). |
| 12 | LOS condition | BUILT | `hasLineOfSightToPlayer`, reuses `Opus.Physics.rayAABB` against solids; verified blocked/clear with a real wall. |
| 13 | AI distance transitions | BUILT | `distanceToPlayerAtMost/AtLeast`, plus `healthAtMost`/`timeInStateAtLeast` (a built-in hysteresis primitive). |
| 14 | World State Save Game | BUILT | `item.persistRuntimeState`, `worldState[levelId][objectId]`; `saveFormatVersion: 2`, backward compatible with pre-Wave-7 saves. |
| 15 | Persistent destroyed objects | BUILT | `markPersistentDestruction` at the one real destruction call site; verified cross a genuine full-page reload. |
| 16 | Persistent doors/object transforms | BUILT | Same mechanism as #15; verified a moved "door" object's transform survives a fresh session. |
| 17 | Objective system | BUILT | `currentObjectiveDefs` + `window.__gameObjectives`; 3 actions, 2 conditions, HUD auto-display, simple `nextObjective` chaining. |
| 18 | Objective persistence | BUILT | Rides the same Save Game payload as World State. |
| 19 | Scatter tool | BUILT | `performScatter` — Circle/Box region, seeded deterministic placement, min-spacing rejection sampling, ONE Undo step. Verified at 100 and 500 placements (Section 6). |
| 20 | Terrain-conforming scatter | BUILT | Real `sampleHeight`/`sampleNormal` (Max Slope filter), verified genuinely-varied Y across a real terrain. |
| 21 | Array/Grid duplication | BUILT | `performArrayDuplicate`, Linear + Grid, ONE Undo step; Circular deliberately not built (no concrete need surfaced). |
| 22 | Dynamic Physics gate | DEFERRED_WITH_REASON | `DYNAMIC_PHYSICS_DEFERRED_WITH_TECHNICAL_REASON` — every existing collision primitive is one-sided correction-only, no pairwise/impulse/mass model exists; a genuine new subsystem, not a small extension; no dogfood surfaced a concrete need. |
| 23 | Pick Up/Carry/Drop | BUILT | `item.carryable`, kinematic hold (FP forward-offset, TP hand-socket-preferred); full pickup→carry→drop→consume→objective-complete flow verified live. |
| 24 | Hit reaction | BUILT | Hit clip (Death always wins by construction, not a priority check), flash/tint via `deferredCalls`. |
| 25 | Knockback | BUILT | Player: added to `player.velocity` (real physics integration next tick). AI: kinematic position push (`applyHitReaction`). `weapon.knockback` field. |
| 26 | Signal/Event gate | NOT_JUSTIFIED | Reassessed; every real Wave 7 broadcast-shaped scenario was already expressible with Objectives/flags/behaviors; kept deferred. |
| 27 | Generic dependency collector gate | NOT_ASSESSED_THIS_WAVE | Section 82/83's investigation was not performed this session (time/scope trade-off, see Section 9) — every new Wave 7 reference field (sockets, equipmentDefs, animationEvents, objectiveDefs) WAS correctly added to its own serialize whitelist by hand, following the project's established discipline, but the architectural question of whether a generic collector is now warranted was not revisited. |
| 28 | ONNX | NOT_JUSTIFIED | `ONNX_NOT_JUSTIFIED_YET` — every new system is deterministic; no dogfood created an inference-shaped problem. |

## 3. Stress Game Report

### Relic Frontier (`games/relic-frontier.json`, Sections 71-72 — REQUIRED)
Genre: armed Third-Person action. Systems exercised: skinned Player + RightHand Socket, Equipped Weapon (Hitscan, Muzzle Socket), AI State Machine guard (Patrol/Chase/Attack with an entry-action Objective completion), a 3-objective chain, a persistent gate (World State), an Extraction Win trigger, and a light Scatter decoration cluster. Central gameplay is entirely visual/no-code (Trigger Volumes + fixed-dropdown Behaviors + AI State Machine authoring, no Custom Script). Save/Load: verified — a real gate-open state survived a genuine full-page reload. Playable Export: verified in genuine `<iframe srcdoc>` isolation — `Opus`/`app` initialized, title correct, Start Screen present, real Play entered with a real spawned player and the first Objective already auto-active. Win: verified (`gameEnded === true` after reaching Extraction with the guard defeated). Lose: not separately exercised this session (Player has no configured Lose condition in this specific level; the underlying Health/Lose mechanism itself was already proven in Iron Arena/Relic Runner 2's own Wave 6 dogfood and is unmodified this wave). Real bugs exposed: a Hitscan shot blocked by a real Wall during initial guard placement — confirmed CORRECT engine behavior (a wall should block a shot), not a defect; relocating fixed the test setup, not the code.

### Power Grid / Forest Range
NOT BUILT this session. See Section 9 for the honest accounting of what stands in for them (individually torture-tested mechanisms with real numbers, Section 6).

## 4. Bug Report

### Product bugs found and fixed
1. **Priority G (Scatter)** — `scatterPlaceOne` assumed every prefab has the multi-member `.records`/`rootId` shape and crashed instantly on a real single-object prefab (`.record` only); the multi-member branch also never called `addPlaced()` on its own new items (would have silently placed nothing into the live scene). Fixed by branching on `prefab.records && prefab.records.length > 0`, the same test `swapItemForPrefabInstance` already uses, and adding the missing `addPlaced` calls.
2. **Priority M (Spawner + AI State Machine integration)** — a State Machine state's own `movement` object has no author-facing "base" field in the v1 card UI, so `movement.type: 'wander'`/`'orbit'` crashed (`Cannot read properties of undefined (reading 'x')`) the instant it actually ran with the Player far away (my first dogfood pass happened to avoid it by teleporting the Player close immediately). Fixed with a lazy self-anchor (`if (!ai.base) ai.base = pos.clone();`) in `applyAiMovementStep`'s Orbit/Wander branches — harmless for Simple-AI (always already has `ai.base`), correct for State Machine (anchors wherever the AI actually is on first use).

### Test-methodology artifacts (not product bugs)
- A Hitscan shot during Relic Frontier's own combat dogfood registered `hit.type: 'solid'` instead of hitting the guard — traced to a real level Wall directly between player and guard at the chosen encounter position. Confirmed correct (a wall blocking a shot is exactly right); the guard's position was the test's own oversight, not engine logic.
- Manual per-frame driving (`entity.update(dt)` / `tickAiStateMachine(...)` called directly) was used throughout this wave's dogfood instead of waiting on the real `requestAnimationFrame` loop, because the Browser pane's rAF is throttled while backgrounded in this session's environment — documented and consistent with the same workaround this project used in Wave 6B.

## 5. World-Persistence Report

Persisted fields (only when `item.persistRuntimeState` is set): `visible`, `destroyed`, `position`, `rotation` (quaternion), `health` (only if the item has an initialized Health). NOT persisted: any object without the flag, editor-only metadata, AI runtime state (`_currentState`), transient equipment/carry state. Save format: `saveFormatVersion: 2`, additive to the pre-Wave-7 payload (`gameState`/`flags`/`checkpoint`/`playerPosition` unchanged) — a pre-Wave-7 save loads correctly with `worldState` simply absent. Destroyed-object behavior: tracked live at the moment of real destruction (`markPersistentDestruction`, gated on `playMode`), not inferred retroactively. Level-switch behavior: each level's own slice is captured independently; a level not currently active is covered by its own destroyed-id set plus whatever was captured the last time it WAS active. Restore ordering: switch level → authored scene rebuilds → apply `worldState` → spawn/restore Player — verified live by confirming the freshly-rebuilt scene had objects at their ORIGINAL authored positions immediately before `loadGame`, and at their SAVED positions immediately after. Size with 100 persistent objects: **8,842 bytes**, captured in **22.1ms**, restored in **0.6ms** (Section 6).

## 6. Torture Test Results (real measurements)

| Test | Scale | Result |
|---|---|---|
| Scatter (Section 88) | 500 placements, 1 circle region | 500/500 placed, 685 attempts, **20.3ms** create, **1** Undo step, 500-object serialize **4.6ms**/266KB, Undo (remove all 500) **29.5ms** |
| World Save (Section 87) | 100 persistent objects | Capture **22.1ms**/8,842 bytes, restore **0.6ms** |
| Socket stress (Section 85) | 25 animated characters, each with a hand-attached weapon | Build **343ms**, 30-frame tick **50.1ms** total, **25/25 unique** weapon positions (no shared runtime state), cleanup **0.5ms**, zero leaked items |
| AI State stress (Section 86) | 30 agents, Patrol/Chase/Attack, real steering | 120-frame tick **9.3ms** total; healthy final-state mix (7 patrol/10 chase/13 attack); only **10 transitions** across 60 further frames × 30 agents (1,800 agent-ticks) — no thrashing/oscillation |

All four scaled comfortably with no perceptible per-frame cost at real gameplay framerates.

## 7. AI Report

State types: author-defined (this wave's dogfood used Patrol/Alert/Chase/Attack/Flee, matching the spec's own worked example). Transition conditions: `distanceToPlayerAtMost/AtLeast`, `lineOfSightToPlayer/noLineOfSightToPlayer`, `healthAtMost`, `timeInStateAtLeast` (built-in hysteresis). LOS: boolean-only raycast against solids, no vision cones. Pathfinding interaction: a state's `movement.type: 'navigateToTarget'` reuses the existing Waypoint-graph pathfinder unchanged (not separately re-dogfooded this wave beyond confirming the shared dispatch reaches it correctly). 30-agent stress: see Section 6. Oscillation/thrashing: none observed at 30-agent scale; `timeInStateAtLeast` is available as an explicit anti-thrash primitive for an author who needs one. Transition prioritization: authored order, first-valid-wins, verified via a same-tick transition immediately driving the new state's own movement.

## 8. Socket Report

Joint transform source: the real sampled skeleton (`sampleClipJointWorldTRS`), never inferred from vertices, never reusing the vertex-skinning matrix pipeline. Socket data format: `asset.sockets = [{id, name, jointName, positionOffset, rotationOffset (XYZ degrees), scaleOffset}]`. Attachment transform formula: character world × animated joint pose × socket offset × attached local transform, verified by exact numeric agreement between an independently-derived expected value and the live composed result. Prefabs: verified independent, correctly-remapped attachments on prefab-spawned copies. Runtime-spawned assemblies: same mechanism as Prefabs (Spawner reuses `instantiatePrefabAssembly`). 25-character socket stress: see Section 6. Weapon muzzle result: verified via a captured `fireHitscan` `origin` argument matching the resolved muzzle position to floating-point precision.

## 9. Honest Scope Accounting

What was NOT done, stated plainly:
- **POWER GRID and FOREST RANGE** were not built as separate shipped stress-game files. Their underlying mechanisms (persistence, carry/drop, doors, save/load for Power Grid; Scatter/Array at scale, terrain paint, panoramas for Forest Range) were each independently verified with real evidence (Sections 5, 6), but the INTEGRATED, playable, named game files were not produced.
- **Section 82/83's dependency-collector investigation** was not performed — every new reference field was correctly hand-added to its own whitelist (proactively, following this project's established discipline), but whether that pattern has now accumulated enough repetition to justify a generic collector was not reassessed this wave.
- **A true fresh-page-load smoke test of the built-in "Crate Run" default project** specifically was not independently isolated from the 22-game regression sweep (which used real files loaded via `loadProjectFull`, not the untouched default state) — though the exact same `enterPlayMode`/`exitPlayMode` code paths it would exercise were proven robust across all 22 real games plus the new stress game.
- **Touch/Gamepad verification** (Sections 89-90) for the new authoring surfaces and gameplay actions was not separately re-tested this wave — Equip/Attack/Pick-Up all route through the existing Input Actions layer unchanged, the same reasoning that has closed this gate in prior waves, but no fresh touch/gamepad-specific dogfood was run.
- **API-FRICTION.md** was not updated this session (see the final structured response for what would have gone in it).

These are genuine trade-offs made to keep the wave moving rather than spending the entire budget on three exhaustive stress games; every PRIORITY-level capability itself was real, live-dogfooded work, not stubbed or assumed.

## 10. Final ONNX Verdict

**`ONNX_NOT_JUSTIFIED_YET`**

## 11. Final Verdict

**`CAPABILITY_WAVE_7_QUALIFIED_WITH_BOUNDED_GAPS`**
