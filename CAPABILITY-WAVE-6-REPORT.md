# Digital Opus Engine — Capability Expansion Wave 6 — Final Report

Collider System, Skeletal Animation & Terrain Painting (Wave 6) — Animated Player, Blending, Textured Terrain, Sequences & Finished Game Shell (Wave 6B)

## 1. Verdict

**`CAPABILITY_WAVE_6_QUALIFIED_WITH_BOUNDED_GAPS`**

Wave 6 (Priorities A-M, Sections 1-52 of its own spec) shipped a real Collider system (oriented box collision, box/sphere trigger shapes, a `collider` data model with editor visualization), ramps and walkable-slope physics with Step Height, Crouch+Sprint, the engine's first skeletal glTF animation pipeline (import, CPU pose sampling, GPU vertex-shader skinning, a minimal Animation Inspector), mouse-input rebinding, a real Main Menu/game-shell (Start Screen doubling as Main Menu, Pause Menu, Controls, Settings), terrain painting, a sky panorama, billboards, scene-tree drag reparenting with a Local/World gizmo, Prefab Workflow 3.0, and deeper AI character gameplay (name-matched clip locomotion/attack/death). Three required stress games (Shifting Facility, Iron Arena, plus Wave 5's carried-forward set) shipped and were dogfooded live.

Wave 6B (this session's own continuation, Sections 1-75) then built directly on top of that: skeletal animation crossfade, a full Skinned Player Character system (separate visual entity from the authoritative collision body), crouch ceiling clearance, real textured terrain layers, a bounded Sequence authoring system (reused by a new `Play Sequence` action), footstep audio, multi-select Rotate/Scale (with the parent/child hard edge correctly handled), two character-authoring presets, Camera Blend Duration, Level Duplicate correctness, binding-aware HUD prompts, a Continue button, and both REQUIRED new stress games (Relic Runner 2, Signal Zero). Along the way this wave found and fixed **eight real, previously-undiscovered bugs** (three engine/editor-logic bugs from Wave 6 itself, five from Wave 6B — full list in Section 4), two of them severe (a stale-Proxy input-binding bug that silently broke every non-first-loaded project's custom key bindings for an entire page session, and a Playable Export bug that shipped the engine bundle completely missing from every standalone export since an earlier, unrelated dev-tooling fix).

Priority F (Animation Events) was assessed and honestly **deferred** in both sub-waves it was offered in — Wave 6's own Event/Signal channel gate stayed closed (no stress game demonstrated the "one event, many independent listeners" case), and Wave 6B's Animation Events utility gate was deferred because its one concrete motivating example was already fully solved by Priority A's own Attack-animation hook. A handful of smaller, explicitly-scoped gaps (per-axis multi-select Scale doesn't move group positions; terrain-layer-based footstep sound selection; capsule collider shape) are named, bounded, and documented rather than silently missing. ONNX stays `NOT_JUSTIFIED_YET`. No multiplayer work was attempted, per the standing instruction. **Wave 7 is not started here**, per this Wave's own explicit closeout instruction.

## 2. Capability Matrix

| # | Capability | Status | Notes |
|---|---|---|---|
| 1 | Oriented Box Collision + Collider data model (Wave 6, Priority A) | BUILT | `resolveOrientedBoxCollision`, bit-exact degeneration to the old axis-aligned check; `item.collider` (box/sphere, offset) resolved through one shared `resolveItemColliderCollision` all 4 controllers use. |
| 2 | Trigger Volume real box/sphere shape (Wave 6, Priority A) | BUILT (bug found+fixed) | Fixed the long-standing "renders as a box, collides as a sphere" mismatch; swept crossing preserved for both shapes. |
| 3 | Ramp/Wedge + walkable-slope physics, Step Height, Crouch+Sprint (Wave 6, Priority B) | BUILT | New `Opus.Mesh.wedge()` + `resolveRampCollision`; auto-climb via `tryStepUp`; crouch shrinks the mover's real collision height (no second shape). |
| 4 | Skeletal glTF Animation pipeline (Wave 6, Priority C) | BUILT | Import, CPU pose sampling (`computeSkinPalette`), GPU vertex-shader skinning, Entity/App integration, Animation Inspector — the engine's first skinned-character capability, on the third attempt after two honest Wave 4/5 deferrals. |
| 5 | Mouse Input Actions + player rebinding (Wave 6, Priority D) | BUILT | Real `Mouse0/1/2` binding support; live rebind panel with conflict warnings. |
| 6 | Main Menu / Game Shell (Wave 6, Priority E) | BUILT | Start Screen doubles as Main Menu (How To Play/Credits sub-panels), Pause Menu, shared Controls/Settings. |
| 7 | Terrain Painting (color-only) + Sky Panorama + Billboard primitive (Wave 6, Priorities G/H/I) | BUILT | Paint-weight grid (`opts.paintEdits`), equirectangular panorama sky, billboard mesh — all additive, bit-identical when unused. |
| 8 | Scene-tree drag reparenting + Local/World gizmo + Prefab Workflow 3.0 (Wave 6, Priorities J/K) | BUILT | Full hierarchy authoring UI; Update/Replace/Unlink prefab instance operations. |
| 9 | Cutscene primitive (Freeze/Unfreeze Player) + Deeper AI Character Gameplay (Wave 6, Priorities L/M) | BUILT | The one missing piece a scripted camera cutscene needed; clip-NAME-matched Idle/Walk/Run/Attack/Death for AI characters — the direct precedent Wave 6B's own Player/Enemy presets build on. |
| 10 | Skeletal animation crossfade (Wave 6B, Priority B) | BUILT | `computeSkinPaletteBlended`/`localTRSToPalette`, per-joint TRS lerp/slerp; live-verified mid-blend palette differs from both endpoints, settles bit-exact at completion. |
| 11 | Skinned Player Character (Wave 6B, Priority A) | BUILT | Separate visual entity synced to the (still-authoritative) controller body every frame; explicit clip-mapping + Auto Detect; Attack/Death reuse Priority M's override mechanism. |
| 12 | Crouch ceiling clearance (Wave 6B, Priority C) | BUILT | `canStandAt` (bounded AABB approximation); the exact remaining bound Wave 6's own Priority B named. |
| 13 | True textured terrain layers (Wave 6B, Priority D) | BUILT | Up to 3 texture+UV-tiling layers on the EXISTING paint-weight grid; world-space planar projection, no new UV attribute; `painted-wilds.json` upgraded with real procedural grass/rock/path textures. |
| 14 | Sequence authoring + `Play Sequence` action (Wave 6B, Priority E) | BUILT (bug found+fixed) | Ordered action+Delay list reusing `ACTION_TYPES`/`executeAction`; Ignore reentrancy; cleanup on Stop/Restart/Switch. `serializeProject`'s own field whitelist silently dropped Sequences — found and fixed. |
| 15 | Animation Events utility gate (Wave 6B, Priority F) | DEFERRED_WITH_REASON | The spec's own concrete example ("Attack clip -> Fire Weapon") is already fully solved by Priority A's Attack hook; building a real per-clip event system now would be complexity without a matching capability gain. |
| 16 | Footstep audio (Wave 6B, Priority J) | BUILT | Grounded+moving gated, Walk/Run volume switch off the same threshold locomotion animation uses; terrain-layer-based sound selection explicitly deferred (no runtime terrain-sampling API exists to hang it on). |
| 17 | Multi-select Rotate/Scale (Wave 6B, Priority L) | BUILT | `selectionRoots` correctly excludes a co-selected child from direct transform (proven non-degenerately via a real `reparentItem` pair); Uniform Scale moves group positions from the pivot, per-axis Scale deliberately does not (named, bounded). |
| 18 | Character Authoring Presets — Create Animated Player / Create Animated Enemy (Wave 6B, Priorities H/I) | BUILT | One-click convenience over existing mechanisms only; no new data shape. |
| 19 | Camera Blend Duration (Wave 6B, Priority K) | BUILT | Repurposes the existing `'fixed'` camera mode as an interpolation vehicle; no new camera architecture. Exact-lerp verified at the midpoint and exact hand-off verified at completion. |
| 20 | Level Duplicate correctness (Wave 6B, Priority M) | BUILT (2 bugs found+fixed) | Duplicate Level silently dropped Sequences entirely, and a duplicated Sequence's own object-id references (e.g. `cameraId`) weren't remapped to the duplicate's own objects — both fixed. |
| 21 | Skinned asset sharing + save size (Wave 6B, Sections 53-54) | VERIFIED, NO FIX NEEDED | 25 real instances confirmed to share one skin/clip object reference; a 28-instance save confirmed to carry the geometry payload exactly once, in the Asset Library. |
| 22 | Binding-aware HUD prompts + Continue (Wave 6B, Priority G) | BUILT | `{bind:actionName}` HUD tokens (touch-aware fallback); a real Continue button gated on `SaveSystem.has`. |
| 23 | Playable/Editable Export, clean-room verified (Wave 6B, Sections 55-56) | BUILT (severe bug found+fixed) | Every export had shipped with the ENGINE BUNDLE completely missing since an earlier dev-tooling change, undetected until a genuine isolated-iframe clean-room test. Fixed; re-verified `Opus`/`app` initialize and Play actually starts inside a truly isolated realm. |

## 3. Required Stress Games — Dogfood Reports

### Shifting Facility (`games/shifting-facility.json`, Wave 6, Priority A)
A rotating hierarchical door (pivot+panel), a Sphere-Collider boulder (cube mesh, sphere collision), a moving platform, a 30-degree-rotated wall (oriented box collision on genuinely tilted geometry), and a Box-shape Trigger checkpoint — built entirely from Priority A's own new pieces, round-tripped through real save/load, verified loading via `fetch()` and 90 real ticked frames.

### Iron Arena (`games/iron-arena.json`, Wave 6, Priority C/M)
A walled arena plus a rotated pillar, 3 animated Sentries (real skinned multi-clip asset, AI Follow + clip-name-matched locomotion), First-Person Hitscan combat, a live Kills HUD. Three real bugs found and fixed while dogfooding this specific game (death-animation re-entrancy under sustained combat; a Start-Screen-dismissal test-methodology trap; an asset-vs-instance clip-mutation bug that would have silently reverted on save/reload).

### Relic Runner 2 (`games/relic-runner-2.json`, Wave 6B, Section 61 — REQUIRED)
The real threshold this whole Priority-A-through-M Wave 6B arc built toward: a skinned Third-Person Player (Idle/Walk/Sprint/Jump/Attack/Death, blended locomotion) on real textured, ramped terrain (two procedurally-textured paint layers) with solid colliders, a real Animated Enemy, a Checkpoint, a glowing Relic Win trigger, Health-depletion Lose (driving the Player's own mapped Death clip), a binding-aware HUD prompt, and a real intro Sequence/cutscene. Dogfooded via a genuine `fetch()`+`loadProjectFull()` load and real per-frame ticking through the app's own registered update callbacks: intro cutscene, Animated Enemy AI/Auto-Animate, HUD binding resolution, Win, and Lose (through the real Death-clip-driven sequence) all confirmed working, zero console errors. Surfaced (and worked around) a real, documented engine start-ordering fact: `runStartBehaviors()` fires before `spawnPlayer()`, so an On-Start Sequence's own Change Camera step needs a tiny leading Delay to avoid being immediately overwritten by the Player's own spawn-time camera setup.

### Signal Zero (`games/signal-zero.json`, Wave 6B, Section 62 — REQUIRED)
A small, finished 2-level game exercising the full menu/save/export shell: Main Menu with Continue/How-To-Play/Credits/Controls/Settings, Pause Menu, a Sequence-driven intro cutscene, a real skinned Player with mouse-button Attack (`Mouse0`, deliberately non-default to exercise a genuinely different binding end-to-end), Sprint, Crouch, an Animated Enemy per level, a Save-Game-then-Switch-Level trigger, and a Win/Lose pair. This exact game's own multi-project-load dogfood requirement is what surfaced the severe `effectiveInputMap` staleness bug (Section 4) — precisely the kind of finding this stress game exists to catch. Re-verified clean (zero console errors) after the fix, across a full multi-level, multi-load session.

## 4. Bug Report

### Product bugs (found and fixed)
1. **Wave 6, Priority A** — Trigger Volume rendered as a box but collided as a sphere at `1.5x` the box's larger horizontal dimension; fixed with real box/sphere shape support and swept-crossing preserved for both.
2. **Wave 6, Priority M (Iron Arena dogfood)** — `applyHitDamage`'s kill branch had no re-entrancy guard; a character sitting in `placed` during its own Death-animation window could be hit repeatedly, awarding duplicate kills and queueing redundant deferred removals. Fixed with a `wasAlreadyDead` transition guard.
3. **Wave 6, Priority M (Iron Arena dogfood)** — mutating a placed instance's `entity.skin.clips` (to relabel a fixture's generic clip names) only touched a per-session revived runtime copy, never the Asset Library's own stored `skin` data `serializeAssets` actually persists — a save/reload would have silently reverted every clip-name mapping. Fixed by relabeling the asset's own stored data before any instance's mesh handle is cached.
4. **Wave 6B, Priority E** — `serializeProject`'s own level-field whitelist was missing `sequences` entirely; every authored Sequence was silently dropped on save/load. Found via an explicit before/after round-trip check, fixed by adding it to both the save-side whitelist and the load-side normalization.
5. **Wave 6B, Priority M** — Duplicate Level had the exact same `sequences`-omission gap independently (a different code path than #4), PLUS a deeper issue: a duplicated Sequence's own object-id references (e.g. a `changeCamera` step's `cameraId`) weren't remapped to the duplicate's own objects, leaving them pointing at the original level's. Fixed by extending the existing `remapObjectIds` whole-JSON-substitution mechanism to remap both arrays together.
6. **Wave 6B, Priority G (Signal Zero dogfood) — severe.** `effectiveInputMap`'s Proxy was constructed with the `inputActionMap` OBJECT as its own target, captured once at module load; `loadProjectFull` reassigns the `inputActionMap` variable to a new object on every load, which an already-constructed Proxy can never follow. Every subsequently loaded project's own custom key bindings were silently inert in real gameplay for the rest of the page session (while the Controls panel and every direct reader of `inputActionMap` looked completely correct, masking the bug). Fixed by closing over the live `inputActionMap` binding inside the Proxy's `get` trap instead of relying on its frozen target. Confirmed with a real three-project load sequence.
7. **Wave 6B, Priority G (Playable Export clean-room dogfood) — severe.** `buildExportHTML`'s engine-inlining `.replace()` searched for an old literal `<script>` tag that no longer existed (an earlier, unrelated Priority C fix had turned it into a `document.write` cache-buster); the no-op left a SECOND, broader `.replace()` to swallow the entire dev-time script block — including the engine's own loading code — and replace it with the editor JS alone. Every Playable/Editable export since that earlier fix landed had shipped with the entire game engine missing, failing completely the moment it was opened outside the dev folder, with no error reported. Fixed by folding both inlines into the one regex-based replace that already tracks the block's current shape. Verified in a genuinely isolated `<iframe srcdoc>` realm — `Opus`/`app` initialize, Main Menu renders, Start enters real Play with a spawned player.
8. **Wave 6B, Priority K (HUD prompt polish)** — `keyCodeToLabel` had no case for Shift/Ctrl/Alt/Digit/Arrow keys, so a HUD `{bind:sprint}` prompt read the clunky literal "ShiftLeft" instead of "Shift". Small, generally-useful fix (benefits the Controls panel too).

### Test-methodology artifacts (not product bugs, correctly diagnosed)
- A `mode:'fade'` level transition's real `setTimeout` doesn't advance with synthetic per-frame `dt` ticking — a genuine, documented distinction between simulated and real wall-clock time, not a bug, hit once while dogfooding Signal Zero's Switch Level.
- Two false alarms during Skinned Player dogfood (a transient fall-state at spawn with no Fall clip mapped; normal deceleration lag after releasing input) were both correctly diagnosed as designed fallback-chain/acceleration-ramp behavior, not bugs, by ticking further and observing the expected settle.
- An `activePointerId` stuck-non-null state during Multi-select Rotate/Scale dogfood, traced to dispatching a synthetic `pointerup` on the wrong element (`canvas` instead of `window`, where the real listener lives) — a test-harness mistake, not a product bug; fixed in the test script.

## 5. What Was Not Attempted and Why

- **Wave 7 was not started**, per this Wave's own explicit standing instruction.
- **Animation Events (Wave 6B, Priority F)** — deferred with a concrete reason: the spec's own motivating example is already solved by Priority A's Attack hook.
- **Event/Signal channel (Wave 6, Priority F)** — gate never triggered; no stress game demonstrated a "one event, many independent listeners" case existing counters/flags/tags couldn't handle.
- **Terrain-layer-based footstep sound selection** — assessed as not "easy" per the spec's own gate (no runtime terrain-sampling API exists to query dominant paint layer at a position); a single authored footstep sound per Player shipped instead.
- **Per-axis multi-select Scale group-position offset** — deliberately not built (only Uniform Scale moves group positions from the pivot); a real but separate, more ambiguous design question, named rather than silently skipped.
- **Capsule Collider shape** — Wave 6's own evaluation kept the existing sphere(XZ)+fixed-vertical-extent model, a genuine tested decision (geometrically identical to a true capsule in the one plane that matters for doorways/stairs), not a gap.
- **No multiplayer work was attempted**, per the standing instruction.

## 6. Performance (new capability only, not a repeat of old benchmarks)

- **Collider torture test**: 100 mixed colliders (60 auto-box, 20 explicit Sphere, 10 rotated explicit Box, 5 two-level hierarchy chains, 5 independently moving Sphere colliders), 60 simulated frames × 100-solid probing = 6,000 collision checks: zero exceptions, ~320ms total, no perceptible per-frame cost.
- **Trigger torture test**: 100 real `TriggerVolume` instances (50 Sphere + 50 rotated Box) driven through a realistic 10-step approach/leave sequence each (1,000 total calls): exactly 1 Enter + 1 Exit per volume, zero exceptions, ~310ms.
- **Skinned asset sharing at scale**: 25 real placed skinned instances confirmed to share exactly one skin/clip object reference (not duplicated 25×) with fully independent per-instance animation/health/AI state.
- **Save size**: a 28-skinned-instance project confirmed to carry the geometry/rig payload exactly once (in the Asset Library), never per-instance.
- No frame-time regression observed in any dogfood session across either sub-wave; the new systems (crossfade, textured terrain, Sequences, camera blending) all ran inside the same real per-frame budget the existing systems already used.

## 7. ONNX Verdict

**`ONNX_NOT_JUSTIFIED_YET`** — unchanged. No system built in Wave 6 or Wave 6B (skeletal animation, terrain painting/texturing, Sequences, camera blending, multi-select transforms, character presets) has a genuine "needs a trained model" shape; every one of them is deterministic authored/procedural/state-machine logic. Revisit only if a future wave's own stress-game dogfood surfaces a real inference-shaped need.

## 8. Regression

Every shipped game across both sub-waves was reverified loading and playing clean after the changes that touched it, re-confirmed again at this report's own closeout via real `fetch()` + `loadProjectFull()` loads: `Blacksite`, `Moving Temple`, `Iron Arena`, and `Painted Wilds` (the four games explicitly named for deep-replay by Wave 6B's own regression scope) plus a bounded load/Play/no-error sweep across the rest of the shipped catalog. `node build/build.js` + `node tests/run-tests.js`: **31/31**, unchanged (entirely editor-side work this Wave beyond the engine-level crossfade/terrain-texture additions, both covered by the dedicated dogfood in Sections 3-4 above rather than new unit tests, matching this project's own established "real dogfood over synthetic unit tests for editor-layer work" discipline).

## 9. Final Structured Response (37 items)

1. Oriented Box Collision — BUILT
2. Trigger Volume box/sphere shape — BUILT (bug fixed)
3. Collider data model + editor visualization — BUILT
4. Capsule Collider — evaluated, kept existing model (documented decision)
5. Ramp/Wedge + walkable-slope physics — BUILT
6. Step Height — BUILT
7. Crouch + Sprint — BUILT
8. Skeletal glTF Animation pipeline — BUILT
9. Mouse Input Actions + rebinding — BUILT
10. Main Menu / Game Shell (Wave 6) — BUILT
11. Event/Signal channel gate (Wave 6) — NOT_TRIGGERED, stays closed
12. Terrain Painting (color) — BUILT
13. Sky Panorama — BUILT
14. Billboard/Sprite primitive — BUILT
15. Scene-tree drag reparenting + Local/World gizmo — BUILT
16. Prefab Workflow 3.0 — BUILT
17. Cutscene primitive (Freeze/Unfreeze Player) — BUILT
18. Deeper AI Character Gameplay (clip-name locomotion/attack/death) — BUILT
19. Required stress game: Shifting Facility — BUILT
20. Required stress game: Iron Arena — BUILT (3 bugs found+fixed)
21. Skeletal animation crossfade — BUILT
22. Skinned Player Character — BUILT
23. Crouch ceiling clearance — BUILT
24. True textured terrain layers — BUILT
25. Sequence authoring + Play Sequence action — BUILT (bug found+fixed)
26. Animation Events utility gate — DEFERRED_WITH_REASON
27. Signal Zero stress-game requirement (game shell) — BUILT
28. Create Animated Player / Create Animated Enemy presets — BUILT
29. Footstep audio — BUILT (terrain-layer selection deferred)
30. Camera Blend Duration — BUILT
31. Multi-select Rotate/Scale — BUILT (parent/child hard edge handled; per-axis-Scale position offset bounded-out)
32. Level Duplicate correctness — BUILT (2 bugs found+fixed)
33. Skinned asset sharing + save size — VERIFIED, no violation
34. Binding-aware HUD prompts + Continue — BUILT
35. Playable/Editable Export, clean-room verified — BUILT (severe bug found+fixed)
36. Required stress game: Relic Runner 2 — BUILT
37. Required stress game: Signal Zero — BUILT

**Overall verdict: `CAPABILITY_WAVE_6_QUALIFIED_WITH_BOUNDED_GAPS`.** Every required deliverable across both sub-waves shipped, was dogfooded live (not assumed correct from reading the code), and is documented with reproduction evidence where a bug was found. The gaps that exist (item 11, item 26, footstep terrain-layer selection, per-axis-Scale position offset, Capsule Collider) are each named, reasoned, and bounded — not silent omissions. Wave 7 is not started here.
