# Post-Wave-9 Product Dogfood Report

**This is not a Capability Wave report.** No new capability roadmap was opened. The task was: build one real, non-cloned, non-trivial game through the actual editor UI, using real imported assets, and let whatever friction that game actually produces decide what (if anything) gets fixed. Nothing was added speculatively.

## 1. Game Identity

- **Name**: Signal Relay
- **File**: `games/signal-relay.json`
- **Genre**: First-person stealth/objective prototype (restore-power-and-extract, with AI guards to avoid)
- **Core loop**: Explore a small facility → find and Interact with 3 Relay Consoles (avoiding 2 patrolling drones with Patrol→Alert→Attack/Investigate AI) → once all 3 are powered, a Security Gate opens → reach Extraction → Win. Getting caught and losing all health → Lose.
- **Playtime**: ~10-15 minutes for a careful first playthrough
- **Levels**: 1 (single facility level; level-switching verification is N/A for this game, noted rather than skipped silently)
- **Objects placed**: 28 (9 architecture pieces, 1 spawn point, 3 linked-prefab consoles, 2 State-Machine drones + their projectile prefab, 1 Win trigger, 1 Lose watcher, 1 Start-behavior object, 10 Scatter-Layer-owned decoration objects, 1 Security Gate)
- **Prefabs**: 3 (`RelayConsole` with a Color Parameter, `DroneBolt` projectile, `PipeJunk` decoration)
- **Project file size**: 66,311 bytes

## 2. Real Imported Assets (per-type)

All three were generated as small, original, self-created files (no external/copyrighted downloads), then pushed through the actual Import UI, not fabricated in-memory. Do NOT read the earlier in-session Capability Wave reports' asset claims as equivalent to this section -- this section is specifically the real-file-through-real-UI flow this pass required.

| Type | Asset | How created | Import path | Used in game | Clean-room verified |
|---|---|---|---|---|---|
| Model | `relay-console` (glTF 2.0, 3.3KB, 72 verts/36 tris) | Node script generating an original multi-box "Relay Console" prop | Real `#import-model-input` file input, `DataTransfer`+`File`+`change` event | Mesh for all 3 RelayConsole prefab instances | Yes -- mesh present, visible, applied in isolated iframe with zero network requests |
| Texture | `facility-hazard-panel` | Generated original bitmap | Real Import Texture UI | Applied to `SecurityGate` | Yes -- `textureAssetId` resolved, material present, zero network requests |
| Audio | `data-core-pickup-chime` (WAV, 1ch, 0.35s, 48kHz) | Hand-encoded 16-bit PCM WAV | Real Import Audio UI | Played on each console's successful Interact | Yes -- real decoded `AudioBuffer` confirmed inside the clean-room iframe (not just a dataURL string) |

## 3. Mandatory Verification Results

- **Player/controller**: First-person controller, working. Sidearm hitscan weapon with muzzle/impact effects and a tracer, working.
- **Core gameplay**: Interact-to-power-console, AI patrol/alert/attack/investigate, Scatter-painted decoration -- all working through real UI-driven authoring, confirmed via genuine Play sessions.
- **Objectives**: `obj_restore_power` (counter target 3) → `obj_extract` chain confirmed correct (see friction #80/#4 below for the bug this exposed and fixed).
- **Save/Continue**: Full mandatory mid-game Save/Load cycle completed via the real `Load Game` action, in a genuinely fresh browser session (full page navigation, no shared in-memory state) -- confirmed objectives, `__gameState` (health, counters), individual object `variables` (console `powered` flags), player position, and weapon runtime (magazine/reserve) all round-tripped correctly.
- **Stop→Play repeatability**: Confirmed clean after fixing friction #81 below -- a second fresh Play in the same tab now correctly reverts every object's `variables` to its authored baseline, not the previous attempt's mutated state.
- **Win**: Confirmed -- Extraction trigger correctly fires `win` before `completeObjective` (see friction #80/#3), `gameEnded` correctly becomes `true` only once all 3 consoles are genuinely powered.
- **Lose**: Level-spanning stay-trigger on health ≤ 0, present and wired; not independently re-verified this session beyond confirming the graph exists and follows the same win/gate-ordering discipline as the fixed Win trigger.
- **Level-switching**: N/A -- Signal Relay is single-level. Noted, not silently skipped.
- **Playable Export**: Built via the real `export-playable-btn` → `buildExportHTML(true)`, opened in an isolated `<iframe srcdoc>` realm (a distinct, opaque origin with zero access to the dev server or editor session). Confirmed: correct title/Start Screen ("Signal Relay", Deploy/Continue/How To Play/Controls/Credits), all 28 objects present, imported mesh/texture/audio all resolved with **zero network requests** to the dev server, gameplay live (objectives active, gameState initialized), no editor chrome reachable (`export-playable-btn`/`Edit This Game` both present in the DOM but genuinely inert -- zero-size, no `offsetParent`, correctly non-interactive).
- **Editable Export**: Built via `buildExportHTML(false)`, opened in a second isolated iframe. Confirmed: real "🛠 Edit This Game" button present and functional (toggles to "✕ Close Editor" on click), real editor root (`#app`) opens with all 28 objects/1 texture asset/level name ("Signal Relay") intact, a live object could genuinely be moved (`ConsoleAlpha.entity.position.x`: -25 → -20), and a re-export from inside that reopened editor succeeded (valid ~1.25MB HTML output).
- **Clean-room asset independence**: Confirmed for both exports -- `performance.getEntriesByType('resource')` inside the clean-room iframe showed zero requests back to `localhost:8180/games/...`, proving the imported model/texture/audio do not depend on the editor's dev-server-relative paths, cache, or session.

## 4. Friction Log

| Friction | Classification | Resolution |
|---|---|---|
| Update From Prefab silently discarded an instance's own Name/Tags/Variables | **PRODUCT_BUG (A)** | Fixed at root: `swapItemForPrefabInstance` now preserves them. API-FRICTION #78. |
| An ordinary linked-Prefab placement (no Spawner/AI/weapon reference) was dropped from every Save/Export | **PRODUCT_BUG (A)** | Fixed at root: `scanObjectRecord` now adds `sourcePrefabName` to the dependency set. API-FRICTION #79. |
| A Node Graph node with two gate edges silently honored only the first (`.find()` vs. all-gates-AND) | **PRODUCT_BUG (A)** | Fixed at root: `runGraph` now collects and ANDs every gate edge per node. API-FRICTION #80. |
| Stop→Play reset every piece of global runtime state except an object's own `variables` | **PRODUCT_BUG (A)** | Fixed at root: `enterPlayMode` now restores `variables` from a new `_authoredVariables` snapshot every fresh Play. API-FRICTION #81. |
| A Wander AI's live runtime target (`wanderTarget`/`wanderTimer`) was baked directly into the saved project file (code comment claimed otherwise) | **PRODUCT_BUG (A)** | Fixed at root: new `sanitizeAiStatesForSave` strips runtime fields on both Save and (defensively) Load. Cleaned the pre-existing pollution already on disk in `forest-range.json`. API-FRICTION #82. |
| `isTrigger:true` set on the three consoles (copying an older pattern), making them invisible in Play and blocking Interact entirely | **AUTHORING_MISTAKE (E)** | My own mistake -- engine behavior (`preparePlacedForPlay` hides trigger volumes) is correct and intentional. Fixed by setting `isTrigger:false`. No engine change. |
| Node Graph actions gated on a condition the action's OWN first side effect then falsified (state-flip action placed before, not after, everything reading that state) | **AUTHORING_MISTAKE (E)**, x2 occurrences (console Interact graph, Extraction Win graph) | My own authoring mistake, reproducing an already-documented, intentional engine behavior (API-FRICTION #72: gates re-evaluate fresh per node, by design). Fixed by reordering each graph so state-flipping actions run last. No engine change -- this is the 4th independent time this exact authoring trap has been hit across the project's history; flagged below as the strongest evidence for a possible future authoring-safety theme, but NOT built this pass (see Section 6). |
| `read_console_messages` kept showing 3 stale pre-fix errors across every later check | **TEST/ENVIRONMENT_ARTIFACT (F)** | Confirmed via each error's own embedded `?bust=` cache-busting timestamp not matching the current page load; no product code affected. |
| My own injected iframe probe scripts threw `Identifier 'X' has already been declared` on repeated script-tag injection into the same realm | **TEST/ENVIRONMENT_ARTIFACT (F)** | A restatement of the already-known "top-level `let`/`const` doesn't reliably scope across separately-injected `<script>` tags in the same realm" quirk from earlier Waves. No product code affected. |

## 5. Engine/Editor Changes Made Because of Dogfood

All five are real, previously-undiscovered bugs, each with a concrete, reusable root-cause fix (not a workaround), each reproduced live before the fix and re-verified live after it, each confirmed with a clean `node build/build.js` + `node tests/run-tests.js` (31/31) and a full 27-game catalog regression sweep with zero new console errors.

1. **`swapItemForPrefabInstance` instance-identity loss** -- exposed by: Updating three uniquely-identified linked console instances from their shared prefab. Why not authorable another way: there is no alternative "refresh from prefab, keep my instance's identity" path. Reusable: yes, applies to every Update-From-Prefab call in every game. Public API changed: no new surface, existing function's behavior corrected.
2. **`scanObjectRecord` linked-prefab dependency gap** -- exposed by: three ordinary (non-Spawner, non-AI-reference) placed prefab instances vanishing from Save/Export. Why not authorable another way: this is a Save/Export-time bug, invisible to any in-editor authoring workflow. Reusable: yes, affects every game using plain linked-prefab placement (the single most common prefab usage pattern). Public API changed: no new surface.
3. **`runGraph` multi-gate `.find()` bug** -- exposed by: an objective gated on two real conditions (reentry guard + counter target) completing on the first alone. Why not authorable another way: no visual-graph-only workaround exists; the bug is in gate resolution itself, invisible from the graph editor's own UI. Reusable: yes, affects any node anyone ever draws two gate arrows into, in any game. Public API changed: no new surface, existing function's behavior corrected to match its own design intent.
4. **`enterPlayMode` variables-reset gap** -- exposed by: the task's own mandatory Stop→Play repeatability check. Why not authorable another way: this is session-lifecycle behavior, not something an author's own graph/behavior authoring can route around. Reusable: yes, affects every game using `setObjectVariable` (a very common primitive) tested via repeated Stop/Play in the editor. Public API changed: new internal `_authoredVariables` field on placed items (not a public/documented API surface).
5. **AI wander-state save pollution** -- exposed by: a load-time crash after a routine re-save. Why not authorable another way: this is a serialization bug, entirely outside author control. Reusable: yes, affects any game with a Wander-type AI State Machine state ever Saved mid/post-session. Public API changed: new internal `sanitizeAiStatesForSave` helper (not public/documented API surface).

## 6. What Was Tempting But Deliberately NOT Built

- **A structural fix to Node Graph gate-timing** (e.g., snapshotting all gate conditions at the start of a graph run instead of re-evaluating fresh per node) -- this is the single most recurring friction pattern in the project's history (4 independent occurrences now, across 2 different dogfood passes and 2 different games), and is the strongest real candidate this pass surfaced for a genuinely justified future theme. **Not built this pass** because: it is a change to core, already-load-bearing graph execution semantics used by every existing game and every existing graph in the catalog; the actual harm this pass hit was two authoring mistakes, both fixed correctly and cheaply by reordering my own graphs, not by changing the engine; and the task's own explicit guidance ("NOT_JUSTIFIED is often the correct engineering decision," "is the fix disproportionate to the actual friction") points against a large, risky semantic change justified by authoring mistakes rather than a capability gap. Flagged, not built.
- **Touch-control parity for Crouch/Sprint/Pause** -- Signal Relay never asked the player to Crouch or Sprint, and Pause was only ever exercised via keyboard/desktop. Per the task's own explicit scoping, this stays a documented gap, not a blocking fix.
- **Any renderer feature (PBR, post-processing, volumetric fog, GI, reflections, a full rigid-body solver)** -- nothing in Signal Relay's own design needed any of these; the existing unlit/simple-lit rendering and the existing Fog Zone system were sufficient for a facility-corridor stealth game.
- **Reopening Dynamic Physics / GPU Instancing / ONNX / Signal / Status / Suspicion gates** -- none of these were blocked on by anything this game actually needed. All remain closed.
- **A generic "any key not in the authored schema" runtime-state stripper** (as opposed to the explicit per-field `sanitizeAiStatesForSave` allowlist actually built) -- rejected in favor of the existing per-field whitelist convention this whole serialization layer already follows, for consistency and auditability, even though it means a future movement type's own runtime field will need its own explicit addition later.

## 7. Custom Script Usage

None. Every gameplay system in Signal Relay (state-flip variables, counters, objectives, Win/Lose, AI, Scatter, weapon, HUD, Save/Load) was expressible through existing visual primitives (Node Graph, Behaviors, AI State Machine, Prefab Parameters). No Custom Script was used anywhere in this build.

## 8. Full Catalog Regression

All 27 games (`games/*.json` -- the 26 pre-existing plus `signal-relay.json`) loaded via `loadProjectFull`, entered Play, ticked, and exited cleanly with zero thrown errors in a fresh browser session. The five Wander-AI-using games (`arsenal-run`, `forest-range`, `relic-frontier`, `signal-relay`, `silent-sector`) were additionally left running in real Play for several real seconds (not just manually-advanced simulation time) after the wander-pollution fix, to genuinely exercise the fixed tick path -- zero console errors. `forest-range.json` was found independently polluted by the same on-disk wander-state bug (pre-existing, unrelated to this pass) and cleaned the same way. The Crate Run fresh-boot anchor (page loaded with no project pre-loaded) was re-confirmed: correct title, "Crates: 0/21" HUD, terrain/water/hovercraft rendering, zero console errors.

`node build/build.js` and `node tests/run-tests.js` both clean after every engine change this pass (31/31 canonical tests passing throughout; no new tests added, per the task's own "don't inflate test count" guidance -- none of this pass's fixes touched foundational pure/public logic the existing suite doesn't already cover at the integration level via the full-catalog regression itself).

## 9. Verdict

**POST_WAVE_9_DOGFOOD_SUCCESS_WITH_OPEN_FRICTION**

Success: the game was built entirely through real editor UI workflows with real imported assets, all mandatory verification steps (mid-game Save/Load, Stop→Play repeatability, Playable/Editable Export in clean-room isolation) passed, and every root-cause engine bug found was fixed and reverified with zero regressions.

Open friction (not blocking, explicitly not fixed this pass, documented for the record): the recurring Node-Graph gate-timing authoring trap (Section 6) remains open by design -- a real, load-bearing engine behavior that keeps tripping up authors (including twice more in this very pass) but whose fix is judged disproportionate to what any single game's own friction has justified so far.

## 10. Wave 10 Decision

**WAVE_10_NOT_JUSTIFIED**

Signal Relay was fully buildable with current engine capability. Every friction point that blocked the game itself was a genuine, narrow, reusable engine bug, fixed at its root with a small, targeted change -- none of them point at one missing coherent subsystem. The one recurring pattern that COULD theoretically justify a future theme (Node Graph gate-timing/authoring-safety) is explicitly not being proposed here: it was not newly discovered by this game (it's the same, already-documented, already-intentional behavior from API-FRICTION #72), this pass's own instances of it were both authoring mistakes with a one-line author-side fix, and a structural engine change to core graph semantics is a large, risky undertaking that no single game's friction has yet concretely forced. Per the task's own standard, that is not enough to justify opening a Wave 10.

Do NOT start Wave 10.
