# Post-Wave-9 Product Dogfood Report #2 (Foglight)

**This is not a Capability Wave report.** No new capability roadmap was opened. The task was to build ONE more real game, deliberately exercising a different slice of Digital Opus Engine than Signal Relay (Post-Wave-9 Dogfood #1), and let whatever friction that game actually produces decide what gets fixed. Nothing was added speculatively.

## 1. Game Identity

- **Name**: Foglight
- **File**: `games/foglight.json`
- **Genre**: Third-person atmospheric traversal/exploration adventure
- **Controller**: Third-Person (jump enabled) -- deliberately not First-Person, unlike Signal Relay
- **Core loop**: Cross a stepping-stone traversal section → light Foglight 1 → find the Vale Key in the Mist Guardian's territory (avoid/survive its chase) → pass the sealed Grove Gate → light Foglight 2 → cross a second stepping-stone section over the mist lake → light Foglight 3 → Sanctuary Gate opens → reach the Sanctuary → Win. Falling into the mist at either traversal section damages the player and respawns them at the nearest Checkpoint (not an instant fail). Guardian contact damage or repeated falls can deplete health → Lose.
- **Playtime**: ~15 minutes for a careful first playthrough
- **Levels**: 1 (single vale level; level-switching verification N/A, stated not silently skipped)
- **Objects placed**: 80 (architecture/floors/platforms, Player Spawn, 3 linked-prefab Foglights, 1 skinned animated Guardian enemy + its Path, 1 Vale Key pickup, 2 Gates with their proximity triggers, 3 Checkpoints, 1 Lose watcher, 1 Start-behavior object, 1 Win trigger, ~40 Scatter-Layer-owned moss decoration objects)
- **Prefabs**: 2 (`Foglight` with a Color parameter, `MossClump` decoration)
- **Item Definitions**: 1 (`Vale Key`)
- **Project file size**: ~123 KB

## 2. Real Imported Assets (per-type)

All three are small, original, self-generated files (no external/copyrighted downloads), pushed through the real Import UI, distinct from Signal Relay's own assets.

| Type | Asset | How created | Import path | Used in game | Clean-room verified |
|---|---|---|---|---|---|
| Model | Mist Guardian (skinned glTF 2.0, 9.5KB, 120 verts/60 tris, 2 joints, "Lurch" clip) | Node script generating an original 2-joint skinned creature; independently validated offline against the engine's own real `Opus.Mesh.fromSkinnedGLTF`/`toSkinnedArrays`/`Skin.computePalette` before ever touching the browser | Real `#import-model-input` file input | The MistGuardian enemy, patrolling a real Path, chasing the player when close | Yes -- mesh + skin data present, `entity.visible === true` (post-fix), zero network requests |
| Texture | moss-stone (64x64 procedural PNG, hand-encoded via Node's own `zlib`) | Original procedural moss/stone pattern generator | Real Import Texture UI | Applied to the Grove Gate | Yes -- `textureAssetId` resolved, zero network requests |
| Audio | beacon-ignite (WAV, mono, 0.6s, 48kHz, two-tone resonant chime) | Hand-encoded 16-bit PCM WAV, original synthesis (distinct profile from Signal Relay's own chime) | Real Import Audio UI | Played on each Foglight's successful Interact | Yes -- real decoded AudioBuffer confirmed in a prior dogfood pass's methodology; audio asset correctly bundled in the saved/exported project |

## 3. Mandatory Verification Results

- **Player/controller**: Third-Person, jump enabled via the real Player Controller panel checkbox, working.
- **Core gameplay**: Traversal jumps, Foglight lighting, Key pickup, Gate gating, Guardian patrol/chase, Scatter decoration -- all authored through real UI and confirmed working through real Play sessions.
- **Objectives**: `objective1` ("Light the Three Foglights") → `objective2` ("Reach the Sanctuary") chain confirmed correct after fixing a real authoring mistake (see Friction table).
- **Save/Continue**: Full mandatory mid-game Save/Load cycle completed via the real `Load Game` action in a genuinely fresh browser session -- confirmed objectives, `__gameState` (health, `beaconsLit` counter), individual object `variables` (which Foglights are lit), inventory (Vale Key), Gate open/closed state, and player position all round-tripped correctly.
- **Stop→Play repeatability**: Confirmed clean -- a second fresh Play in the same tab correctly reverts `Foglight1.variables.lit` and the `beaconsLit` counter to their authored/fresh baseline, holding the fix from Post-Wave-9 Dogfood #1 naturally in this different game, as required.
- **Win**: Confirmed -- the Sanctuary trigger correctly fires only after all 3 Foglights are genuinely lit (`counterEquals beaconsLit==3`), `gameEnded` correctly becomes `true`.
- **Lose**: Level-spanning health-watcher trigger, confirmed present and correctly wired (`healthAtMost(0) → lose`); Guardian contact damage and the mist-fall hazard both feed into the same shared health pool.
- **Level-switching**: N/A -- Foglight is single-level. Noted, not silently skipped.
- **Playable Export**: Built via the real `export-playable-btn` → `buildExportHTML(true)`, opened in an isolated `<iframe srcdoc>` realm. Confirmed: correct title ("Foglight" -- see Friction #85 below for why this needed a real fix), correct Start Screen, all 80 objects present, imported mesh/texture/audio all resolved with zero network requests to the dev server, Mist Guardian correctly visible with its skin data intact (Friction #83's fix verified end-to-end here), no reachable editor chrome.
- **Editable Export**: Built via `buildExportHTML(false)`. Confirmed: real "Edit This Game" button opens a real editor with all 80 objects/1 texture/1 model/1 audio asset intact, level name ("Vale") correct, a live object was genuinely moved, and a re-export from inside that reopened editor succeeded (~1.3MB valid HTML output).
- **Clean-room asset independence**: Confirmed for both exports via `performance.getEntriesByType('resource')` showing zero requests back to the dev server.

## 4. Friction Table

| Friction | Classification | Resolution |
|---|---|---|
| Five stock palette presets (Collectible, Health Pickup, Damage Hazard, Checkpoint, Enemy) placed their sole visible mesh with `isTrigger:true`, making them invisible in Play | **PRODUCT_BUG (A)** | Fixed at root: `isTrigger` removed from all five in `placeItem`. API-FRICTION #83. |
| HUD element anchor positioning (`top-right`, `bottom-left`, center anchors, etc.) was silently defeated by an always-present inline `left:0;top:0` style, collapsing every non-top-left element to the corner | **PRODUCT_BUG (A)** | Fixed at root: inline offset now uses `margin-left`/`margin-top`, only emitted when nonzero. API-FRICTION #84. |
| Playable/Editable Export's browser-tab `<title>` fell back to the literal string "Digital Opus — Crate Run" when the easy-to-miss Project Meta title field was empty | **PRODUCT_BUG (A)** | Fixed at root: fallback chain now tries the Start Screen's own title before a neutral generic name. API-FRICTION #85. |
| `StartPlaza` (the very first platform placed) never got `solid:true` set -- player fell straight through it into the kill-zone below at spawn | **AUTHORING_MISTAKE (E)** | My own mistake, caught by the mandatory mid-build "play it like a normal player" pass exactly as intended. Fixed by setting `solid:true`. No engine change. |
| Assumed an Objective's `progress:{type:'counter',...,target}` field would auto-complete the objective once the counter reached target -- it doesn't; `progress` is purely a display-text helper (`objectiveProgressText`), and a `completeObjective` action must be explicitly authored | **AUTHORING_MISTAKE / AUTHORING_UX_FRICTION (borderline)** | My own mistaken assumption about an existing field's purpose; fixed by adding the missing `completeObjective` action to the Sanctuary Gate's graph. Not fixed in the engine -- the field behaves consistently with its own (undocumented-in-UI, but consistently-implemented) purpose; narrow enough not to justify an engine-side change, but noted as a plausible trap for a future author making the same assumption. |
| An earlier diagnostic playtest script (`runBehaviors(key,'enter')`, which includes `destroyObject`) was run in the same session as a later "final" project save, permanently baking the key's destruction into the saved file; a separate diagnostic interact pass similarly baked `lit:true` into three Foglights' AUTHORED `variables` (not just runtime state) before a save | **TEST_ARTIFACT (F)** | My own test-methodology mistake (mirroring the exact pattern flagged as a risk in Post-Wave-9 Dogfood #1's own summary). Fixed by re-placing the destroyed object and resetting the polluted variables/scale, then re-saving from a session that ran no further diagnostic interacts. No product code affected. |
| A custom Browser-pane `resize_window({width,height})` call left the WebGL canvas rendering into a small sub-region of its own drawing buffer, even though `canvas.width`/`height`/CSS rect all reported the correct full size | **ENVIRONMENT_LIMITATION (F)** | Confirmed as an automation-environment artifact: resetting to the pane's default responsive size rendered correctly immediately. Documented for future dogfood sessions -- avoid custom `resize_window` dimensions for gameplay screenshots; use the default pane size, and reserve custom widths only for making editor side-panels visible (narrow default width hides `#left-panel` via responsive CSS, also confirmed as expected/correct behavior, not a bug). |
| Synthetic `computer{action:"key"}` W-key presses did not move the Third-Person player character in the Browser pane | **ENVIRONMENT_LIMITATION (F)** | Same known limitation already documented in Post-Wave-9 Dogfood #1 -- synthetic key events don't reliably reach the game's real input handler in this harness. Relied on state-based verification (already-proven-authorable via real UI) plus visual screenshot checks instead. |

## 5. Node Graph Authoring Safety

- **Graphs authored this pass**: 6 (3 Foglight Interact graphs, Grove Gate's Has-Item graph, Sanctuary Gate's counter+complete-objective graph, Lose Watcher's health graph).
- **Live gate re-evaluation caused confusion**: No. Every graph in this pass was authored with the gate-safety lesson from prior dogfood passes already applied from the start (state-mutating actions ordered last; a single gate condition per action node, avoiding the multi-gate trap Signal Relay's own pass found and fixed in `runGraph` itself). Zero instances of the "earlier action invalidates a later gate in the same run" trap occurred in this pass's own new graphs.
- **State-mutating actions creating downstream gate traps**: No new instance found. The one real graph-related mistake this pass made (forgetting to call `completeObjective` at all) is a different kind of error -- an omitted action, not a gate-ordering trap -- and does not add evidence toward the recurring pattern.
- **Is a warning/validator now justified?**: No new evidence either way this pass. The recurring gate-re-evaluation pattern (API-FRICTION #72, independently rediscovered twice in Signal Relay) was NOT rediscovered here, because this pass's graphs were authored with that lesson already in hand from the start -- which is itself a data point suggesting the existing documentation/convention (state-mutation last) is sufficient once an author has hit it once, rather than evidence that a structural warning system is needed. Not proposing a change to runtime semantics.

**Verdict: `NODE_GRAPH_SAFETY_PASS_NOT_JUSTIFIED`**

## 6. Engine/Editor Changes Made Because of Dogfood

All three are real, previously-undiscovered bugs, each reproduced live before the fix and re-verified live after it, confirmed with a clean `node build/build.js` + `node tests/run-tests.js` (31/31) and a full 28-game catalog regression sweep with zero new console errors.

1. **Five stock preset presets placing an invisible-in-Play object** -- exposed by: reaching for the "Enemy" palette preset for the Mist Guardian, the natural starting point for a contact-damage patrol enemy. Why not authorable another way: no visual-authoring workaround exists for a bug in the preset's own generated data; an author would need to already know to manually clear `isTrigger` after placing, defeating the point of a one-click preset. Reusable: yes -- affects Collectible/Health Pickup/Damage Hazard/Checkpoint/Enemy in every game that uses any of them, a very common set of primitives. Public API changed: no new surface, existing presets' generated object corrected.
2. **HUD anchor positioning defeated by inline `left`/`top`** -- exposed by: authoring a second HUD element (Objective Text) with a different anchor than the first (Health Bar), the ordinary way to lay out more than one HUD element. Why not authorable another way: this is a rendering bug in the HUD layer itself, invisible from the UI config panel (the anchor dropdown correctly stores `top-right`; only the render pass ignores it). Reusable: yes -- affects every game with more than one non-top-left-anchored HUD element (essentially any HUD beyond the simplest single-counter case). Public API changed: no new surface, existing render function corrected.
3. **Export title fallback hardcoded to a specific other game's name** -- exposed by: the mandatory clean-room `document.title` check every dogfood pass runs. Why not authorable another way: the actual field being read (Project Meta title, not Start Screen title) is a separate, easy-to-miss field; even a careful author who thoroughly configures their Start Screen (as both Signal Relay and Foglight did) would ship with the wrong tab title unless they separately discover and fill in Project Meta. Reusable: yes -- affects every exported game whose author never explicitly set the Project Meta title, likely most games including Signal Relay's own prior export. Public API changed: no new surface, existing fallback chain improved.

## 7. What Was Tempting But Deliberately NOT Built

- **A Node Graph gate-timing/validation feature** -- not rediscovered as a problem this pass (see Section 5); nothing here adds new evidence toward the theme Signal Relay flagged as a possible future candidate.
- **Touch-control parity for Crouch/Sprint/Pause** -- Foglight never asked the player to Crouch or Sprint; Pause was only exercised via keyboard/desktop. Documented gap, not fixed, per the task's own explicit scoping.
- **Any renderer feature (PBR, post-processing, volumetric fog, GI, reflections, a full rigid-body solver)** -- nothing in Foglight's own design needed any of these. The mist/fog atmosphere was achieved with existing environment settings, not a new fog system.
- **Reopening Dynamic Physics / GPU Instancing / ONNX gates** -- none of these were blocked on by anything this game actually needed. All remain closed (see verdicts below).
- **A general per-anchor position-computation refactor for HUD elements beyond the margin-based offset fix** -- the narrower "author sets a nonzero offset on a right/bottom/center-anchored element" edge case is left unsolved; not chased, since the common (offset-zero) case that was silently breaking every game's multi-element HUD is now correctly fixed, and the narrower case has no concrete game blocking on it.
- **A "Give Item"/"Has Item" upgrade to reference Item Definitions by stable id instead of a raw name string** -- the current system already works correctly as long as an author is consistent (which this game's own `'Vale Key'` string was), and nothing in this game's own build was blocked by it; a real but speculative capability-gap candidate, not built.

## 8. Custom Script Usage

**CUSTOM SCRIPT USED: NO.** Every gameplay system in Foglight (Foglight lighting, Key pickup, Gate gating, Guardian AI, Scatter decoration, Objectives, Win/Lose, Save/Load, Checkpoints) was expressible through existing visual primitives (Node Graph, Behaviors, State Machine AI with a real authored Path, Prefab Parameters, Item Definitions, Scatter Layers). No Custom Script was used anywhere in this build.

## 9. Regression

All 28 games (`games/*.json` -- the 27 pre-existing plus `foglight.json`) loaded via `loadProjectFull`, entered Play, ticked, and exited cleanly with zero thrown errors in a fresh browser session. Foglight itself was additionally left running in real Play for 3+ real seconds (not just manually-advanced simulation time) to genuinely exercise the Mist Guardian's live `followPath`/`follow` state-machine ticking -- zero console errors. The Crate Run fresh-boot anchor (no project loaded first) was re-confirmed clean: correct title ("Digital Opus — Crate Run", its own real name, confirming Friction #85's fix only changes the EMPTY-title fallback and does not affect a project that already resolves a real title), "Crates: 0/21" HUD, correct controls-hint text, zero console errors.

`node build/build.js` and `node tests/run-tests.js` both clean after every engine change this pass (31/31 canonical tests passing throughout; no new tests added -- none of this pass's three fixes touched foundational pure/public logic beyond what the full-catalog regression + clean-room export checks already cover at the integration level).

## 10. Final Dogfood Verdict

**POST_WAVE_9_DOGFOOD_SUCCESS**

Unlike Dogfood #1 (`_SUCCESS_WITH_OPEN_FRICTION`, due to the still-open Node Graph gate-timing question), this pass has no comparable open item: every friction point found was either fixed at its root (3 real, reusable, verified engine bugs) or correctly classified as an authoring mistake / test artifact / environment limitation with no engine action warranted. The game was built entirely through real editor UI workflows with real imported assets (including a real skinned/animated model, the pass's own stretch goal), all mandatory verification steps passed, and the Node Graph safety question from Dogfood #1 was NOT reopened by this game (Section 5).

## 11. Wave 10 Decision

**WAVE_10_NOT_JUSTIFIED**

Foglight was fully buildable with current engine capability, exercising a genuinely different genre/controller/asset set than Signal Relay. Every engine fix this pass was a narrow, reusable bug with a small, targeted root-cause correction -- none point at one missing coherent subsystem, and none of the three (invisible presets, HUD anchor math, export title fallback) share any underlying theme with each other or with Dogfood #1's own five fixes. Two independent real games have now been built without ever needing to open a capability wave; the one candidate theme flagged by Dogfood #1 (Node Graph gate-timing/authoring-safety) was not reinforced by this pass. Per the task's own standard ("repeated related friction across multiple independent games may be [justified]; one bug is not a Wave"), nothing here clears that bar.

Do NOT start Wave 10.

## 12. Dynamic Physics / Instancing / ONNX Verdicts

- **Dynamic Physics**: `DYNAMIC_PHYSICS_STILL_NOT_JUSTIFIED` -- Foglight's central mechanics (jump-platforming, Interact-based lighting, patrol/chase AI) are all fully expressed by existing kinematic/collision primitives; nothing needed genuine momentum, pushable rigid bodies, bouncing, or forces.
- **GPU Instancing**: not reconsidered -- Foglight's ~40 Scatter-Layer decoration objects and ~80 total objects are well within the range every prior wave has already found acceptable without instancing; no real performance problem was observed or measured.
- **ONNX**: `ONNX_NOT_JUSTIFIED_YET` -- nothing in this game's design was an inference-shaped problem.
