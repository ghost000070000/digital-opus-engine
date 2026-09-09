# Digital Opus Engine — Capability Expansion Wave 8 — Final Report

Reusable Gameplay Systems, Prefab Parameters, Inventory/Weapons 2.0, Spline Worlds & Production Authoring

## 1. Verdict

**`CAPABILITY_WAVE_8_QUALIFIED_WITH_BOUNDED_GAPS`**

Wave 8 shipped its architectural centerpiece — a generic dependency collector replacing four fragile hand-maintained export scanners — and its flagship reusability feature — Prefab Parameters, letting one prefab definition become 30+ meaningfully different instances (health/speed/color, or an equipment-style weapon-source binding) without 30 prefab files. Both are real, live-dogfooded, and both found and fixed genuine pre-existing bugs (a Player Visual asset silently excluded from every export; a severe 60,000-object runaway in `runStartBehaviors`; a shared-color-array bug affecting every prefab-spawned entity). Object Variables, Item Definitions + Inventory UI, Objective Log, Save Slots/Autosave, Spline/Path Authoring, weighted Scatter 2.0, and a bounded Audio Zone all shipped as real, working, dogfooded capability. Both required stress games — Power Grid and Forest Range — were built this time (Wave 7 had skipped them) and both pass their full required proof: real no-code central gameplay, real cross-session persistence (Power Grid), real 428-object/19-gesture authoring leverage (Forest Range), and genuine clean-room `<iframe>` export verification for both.

Weapons 2.0 (ammo/reload/switching) and its own Arsenal Run stress game were deliberately NOT built this wave — a genuine scope trade-off stated honestly, not a silent gap (see Section 9). Status Effects, the Scatter Brush, Scatter Layer presets-as-UI, Camera Path, and Fog Zone were assessed and deliberately deferred per their own gated language in the spec. Dynamic Physics stayed closed (`DYNAMIC_PHYSICS_STILL_NOT_JUSTIFIED`) — Power Grid was built entirely on Carry/Drop with no pushable/bouncing mechanic needed. GPU Instancing stayed closed (`INSTANCING_STILL_NOT_NEEDED`) — a real 1,000-object Scatter torture test measured 38.5ms creation with no perceptible per-frame cost. Signal gate stayed deferred — Power Grid's own gate-opening logic was fully expressible with Object Variables + an `and` condition, never becoming "obnoxious and brittle" enough to justify a broadcast primitive. Four real product bugs were found and fixed this wave (Section 4), on top of two the collector's own dogfood surfaced.

## 2. Capability Matrix

| Capability | Status |
|---|---|
| Generic dependency collector | BUILT |
| Recursive prefab dependencies | BUILT |
| Object Variables | BUILT |
| Object-variable conditions/actions | BUILT |
| Object-variable persistence | BUILT |
| Prefab Parameters | BUILT |
| Parameter bindings | BUILT |
| Instance overrides | BUILT |
| Spawn parameter overrides | BUILT |
| Item Definitions | BUILT |
| Stable Item IDs | BUILT |
| Inventory UI | BUILT |
| Equip from Inventory | BUILT |
| Consumable-use gate | BUILT |
| Ammo | NOT_BUILT_THIS_WAVE |
| Reload | NOT_BUILT_THIS_WAVE |
| Weapon switching | NOT_BUILT_THIS_WAVE |
| Ammo HUD | NOT_BUILT_THIS_WAVE |
| Objective Log | BUILT |
| Objective progress | BUILT |
| Autosave | BUILT |
| Save-slot metadata | BUILT |
| Spline/Path authoring | BUILT |
| Follow Path | BUILT |
| Camera Path | DEFERRED_WITH_REASON |
| Populate Along Path | BUILT |
| Scatter Layers | PARTIAL |
| Weighted Scatter | BUILT |
| Scatter Brush | DEFERRED_WITH_REASON |
| Environment/Audio Zones | PARTIAL |
| Status-effect gate | NOT_JUSTIFIED |
| Parameterized Spawner | BUILT |
| Signal gate | NOT_JUSTIFIED |
| Dynamic Physics gate | NOT_JUSTIFIED |
| GPU Instancing gate | NOT_JUSTIFIED |
| ONNX | NOT_JUSTIFIED |

## 3. Power Grid Report

Genre: first-person environmental puzzle. Central gameplay is entirely no-code (Trigger Volume Behaviors + Node Graphs, zero Custom Script). Carry/Drop: real (pick up a Power Cell, carry it, insert/consume it at the Generator). Objectives: real, auto-chained ("Restore Emergency Power" -> "Route Coolant"). Save/Autosave: real -- Autosave fires the moment both coolant switches are activated (an authored trigger, not a background timer). World persistence: real, verified across a genuine full-page reload -- the gate's open position AND the Power Cell's destroyed state both survived. Inventory/parameterized prefabs: not the centerpiece of this particular puzzle (Forest Range and the Prefab Parameters dogfood cover those). Environment zones: a real Audio Zone (immediate-switch, not smooth-faded — see Section 9). Win path: real (reach Extraction after both objectives complete). Failure path: none authored (a pure puzzle, no lose condition needed). Playable Export: verified in genuine `<iframe srcdoc>` isolation.

## 4. Forest Range Report

Object count: 428. Scatter Layer count: 1 (weighted, 3 species). Weighted variation: real (40/35/25 split, not built by hand). Terrain conformity: real (`sampleHeight`/`sampleNormal`, slope-filtered). Path usage: real (a 6-point terrain-conformed road, Populate Along Path producing 15 lamp posts). Authoring effort: 19 explicit manual gestures total (prefab authoring + 2 batch operations + a handful of gameplay placements) for 428 objects — the entire point of this stress game, not incidental. Performance: 400-object Scatter in 17.5ms, 60 real AI-tick frames across 2 patrol guards in 1.3ms, full project serialize in 5.2ms/159,927 bytes. Save/Load: not the centerpiece here (Power Grid covers persistence); Playable Export verified in genuine `<iframe srcdoc>` isolation with all 428 objects present and real Play entered.

## 5. Dependency Collector Report

Previous approach: four independent hand-maintained scanners (`usedPrefabNames`/`usedPrefabNamesFromPlayerSettings` plus one inline scan each in `serializeAssets`/`serializeTextureAssets`/`serializeAudioAssets`), each only checking whichever field shapes existed when it was last touched. New approach: `collectProjectDependencies()`, one function, one pass, feeding all four asset-kind serializers. Supported reference categories: prefabs (Spawner, Simple-AI + State-Machine attack prefabs, Behaviors/Node-Graph/Animation-Event fields via declarative `type` lookup, Equipment weapon prefabs, Prefab-Parameter references), mesh assets (placed objects, Player Visual, Equipment visuals, Prefab-Parameter references), texture assets (object/terrain-layer), audio assets (ambient, Behavior/Animation-Event sound actions, Prefab-Parameter references). Recursive closure: a bundled prefab's own records are scanned for further references, repeated via a worklist. Cycle handling: a `visitedPrefabs` Set guards a prefab chain that eventually references itself — verified with a real 2-prefab cycle, terminated in 0.4ms, no infinite loop. Clean-room evidence: Section 3/CHANGELOG's own recorded `<iframe>` test — a real 4-deep chain (Spawner -> Enemy -> Weapon -> Bullet) discovered from one reference, and functionally exercised (a real spawn + a real fire) inside total isolation.

## 6. Prefab Parameter Report

Schema: `prefab.parameters = [{id, label, type, default, bindingField, variableName?}]`. Supported types: Number/Boolean/String/Color/Prefab-Reference this wave (Mesh/Texture/Audio-Asset types share the same field-rendering machinery, addable in a line each). Binding model: a small curated table (`PREFAB_PARAM_BINDINGS`) — Color/Scale/AI Speed/Health Max/Attack Damage+Cooldown+Prefab/Animation Speed/Sound Asset/an Object Variable's starting value — deliberately not a JS expression system. Default resolution: the prefab's own stored default. Instance override resolution: `resolveEffectivePrefabParamValue` — an instance's own `prefabParams[id]` if present, else the default; re-resolved every apply, never cached stale. Prefab update behavior: "Update From Prefab" carries an instance's own overrides forward (verified: an unoverridden instance picks up a changed default; an overridden one keeps its own value) for the SAME source prefab, starts fresh for a different one. Runtime Spawn behavior: `spawnPrefabAssembly`'s new `paramOverrides`/`rngSeed` args support both fixed values and deterministically-seeded `{min,max}` ranges. Export dependency behavior: a parameter's own default OR an instance's override, when Prefab/Asset-typed, is discovered by the same generic collector (Section 5).

## 7. Bug Report

### Product bugs found and fixed
1. **Priority A** — `serializeAssets` never scanned `playerSettings.visual.assetId`; a Player Visual referencing an asset with no other placed-object reference silently shipped without it.
2. **Priority A** — `usedPrefabNames` never scanned an AI State Machine state's own `attack.attackPrefab`; `serializeAudioAssets` never scanned an Animation Event's own `sound` action `audioAssetId`.
3. **Priority A** — `runStartBehaviors()` iterated the live `placed` array; a cyclic pair of Spawn-Prefab-on-Start prefabs produced a 60,000+ object runaway. Fixed with `placed.slice()`.
4. **Priority C** — `instantiateCubeRecord` passed `record.color` by reference (never cloned); every instance spawned from the same prefab record shared ONE mutable color array, so a Color parameter binding on one instance silently repainted every other instance built from that record. Fixed with `.slice()`.
5. **Priority I** — `itemPosition`/`itemLabel` both assumed every item has `.entity` or `.handle`; a Path (the first item shape with neither) crashed both on selection. Fixed with explicit `kind === 'path'` cases.
6. **Priority K** — `removeItemFromScene` never cleared `heldObjectItem` when the destroyed object was the currently-held one; a natural "insert the carried object, consuming it" flow left a dangling reference.

### Test-methodology artifacts (not product bugs)
- Two separate "placed a Trigger/gameplay object at a fixed Y on real terrain, teleported the player to match" mistakes (Relic Frontier's guard-near-a-wall in Wave 7, and Forest Range's Win trigger this wave) — both were genuine authoring oversights in the DOGFOOD SCRIPT, not the engine; both confirmed by sampling the real terrain height and re-testing.
- A Node Graph authoring mistake (gating every step of a multi-step sequence on the same volatile condition, which an early step's own side effect then invalidates) — a real, reusable lesson, not an engine bug (see API-FRICTION #72).
- Large browser-state extraction: `javascript_tool` truncates very large return values (>~150KB) into a local overflow file rather than returning them inline — worked around by reading that file directly with Node and un-wrapping one layer of JSON-string double-encoding.

## 8. Torture Test Results (real measurements)

| Test | Scale | Result |
|---|---|---|
| Dependency chain | 4-deep + a 2-prefab cycle | 0.4ms, correct closure, no infinite loop |
| Prefab Parameters | 100 instances, deterministic overrides | 2.5ms spawn, 100/100 independent values, Update-From-Prefab correct, 26.7KB/100 serialized |
| Object Variables | 20 prefab instances, self-scoped logic | zero cross-instance contamination (exactly the 3 interacted-with instances changed) |
| Spline | 50 points, Follow Path + Populate Along Path (81 instances) | 50-point path serialized instantly; Follow Path genuinely traced the curve over 300 ticks; Populate Along Path 81 objects, 1 Undo step |
| Scatter | 1,000 objects | 38.5ms create, 1.4ms serialize (285KB), 16.7ms Undo -- no instancing needed |
| World Save | 250 persistent objects (+ 50 with Object Variables) | 0.5ms capture, 23.5KB, 0.9ms restore |

## 9. Honest Scope Accounting

- **Weapons 2.0 (ammo/reload/switching/ammo HUD) and Arsenal Run** were not built this session. Save Game Equipment State (equipped item persistence) WAS built ahead of the rest, since it was cheap and Power Grid's own dogfood benefited from it directly.
- **Audio Zone switches immediately, not with the smooth authored-duration crossfade** the spec describes — the engine's `AudioEngine.playBuffer` handle has no public volume-ramp API to build a real fade on top of without an engine change; that change wasn't made this session. Fog Zone was not built at all (Audio Zone alone was judged "highest-value first").
- **Scatter Layers as a saved, re-runnable, named preset with a dedicated multi-source authoring UI, and the Scatter Brush**, were not built — the underlying weighted-selection and ownership-tagging mechanisms are real and fully dogfooded (directly callable, as Forest Range's own build script does), but no panel/brush-gesture UI exists yet.
- **Camera Path** was not built as a dedicated action/UI — `samplePathPosition` is fully camera-agnostic and mechanically reachable, but no dogfood needed a scripted flyover badly enough to justify it ahead of the two required games.
- **Touch/Gamepad** were not freshly re-verified this wave beyond confirming the new Inventory input action routes through the existing `simulateKeyDown`-driven synthetic-keydown layer every other logical action already uses (the same reasoning that has closed this gate in prior waves) — no dedicated touch/gamepad dogfood session was run.

## 10. Final ONNX Verdict

**`ONNX_NOT_JUSTIFIED_YET`**

## 11. Final Verdict

**`CAPABILITY_WAVE_8_QUALIFIED_WITH_BOUNDED_GAPS`**
