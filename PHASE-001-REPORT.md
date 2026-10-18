# Digital Opus Engine — Phase 001 Report

## 1. Verdict

`PHASE_001_NO_CODE_CONTRACT_READY`

Phase 001 establishes the no-code product contract and current authoring baseline. It does not implement Phase 002, Sprites, or any new runtime capability.

## 2. Build and source baseline

- Date: 2026-09-12
- HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`
- Branch: `main`
- Working tree: dirty before and after this phase; unrelated, local-preview, evidence, RC1, and generated files were preserved.
- `node build/build.js`: PASS — 158,687 bytes, 40,950 gzip bytes, 22 source files.
- `node tests/run-tests.js`: PASS — 33/33 Engine, 15/15 showcase-quality, 1/1 public-site integration (28 public, 0 internal).
- `node build/build-games.js`: PASS — 28/28 playable HTML exports, 109.8 MB total.
- No reset, clean, discard, commit, tag, push, deployment, or DNS operation occurred.

## 3. Beginner no-code capability today

A patient beginner can build and export a compact 3D game without JavaScript: place primitives or imported assets, transform a scene, sculpt terrain, add lighting/collision/triggers, select one of four player controllers, add enemy/pickup/door/platform presets, attach simple trigger/action Behaviors, create HUD and game-shell screens, organize levels, play-test, save, and produce editable or playable standalone HTML.

The credible beginner envelope includes a small collectathon, obstacle course, exploration game, simple arena shooter, hovercraft course, or moving-platform challenge. That is real no-code capability—not only runtime APIs—but it is discoverable mainly through experimentation and samples, not a coherent guided workflow.

## 4. Coverage totals

The 55-system inventory in `CURRENT-AUTHORING-SURFACE-INVENTORY.md` yields:

| Grade | Count | Meaning in the current product |
|---|---:|---|
| A | 4 | Fully no-code authorable |
| B | 28 | Common path is no-code |
| C | 19 | UI exists but is partial, awkward, convention-heavy, or weakly validated |
| D | 3 | Major capability absent/runtime-inadequate for no-code authoring |
| N/A | 1 | Custom Script, intentionally an advanced code escape hatch |

The low A count matters more than the broad B count: the engine has many usable capabilities, but relatively few workflows meet the full discovery, manipulation, validation, persistence, reuse, export, and pleasantness contract.

## 5. What is technically possible but requires excessive hidden knowledge

- AI state machines require dense forms and implicit state/clip conventions.
- Equipment requires item definitions, equipment mappings, rig sockets, slots, and weapon settings to agree across panels.
- Variables, counters, flags, timers, tags, slots, and several references depend on free-typed names.
- Prefab identity and update behavior depend on names, local storage scope, manual synchronization, and limited override semantics.
- Navigation requires hand-placed waypoint graphs and manual connection authoring.
- Node Graph is opened through an object's Behavior and has no runtime trace.
- Character auto-animation infers meaning from clip names.
- Audio/Fog Zones are constructed from generic triggers plus actions rather than obvious zone components.
- HUD layout and Sequences are numeric/form workflows rather than direct visual canvas/timeline workflows.
- Save Game works underneath, but slot/state schema and runtime persistence rules are hard to inspect.

These capabilities are often technically no-code, yet remain C because success depends on knowledge the editor does not make explicit.

## 6. Runtime-only and completely absent capabilities

The engine contains orthographic matrix math for shadow rendering, textured billboard geometry, general collision primitives, camera infrastructure, and Custom Script access. None of that constitutes a true 2D authoring system.

Completely absent as first-class creator workflows:

- true Sprite objects and Sprite assets;
- sprite sheets/atlases and frame animation;
- orthographic 2D camera authoring;
- sorting layers and draw order;
- tilemaps and tile painting;
- 2D collider/physics semantics;
- a 2D player controller;
- a guided first-project onboarding flow.

Partly present underneath but not first-class authoring concepts include named typed Signals, a reusable Component model, comprehensive project Input Actions, material assets, project-wide validation, runtime graph/state debugging, and an intentional 2D/3D hybrid composition contract.

## 7. Ranked top 20 authoring gaps

Ranking weighs basic expectation, frequency, severity, code/hidden knowledge, genre leverage, and whether a shared fix unlocks multiple systems.

| Rank | Gap | Why it ranks here |
|---:|---|---|
| 1 | True Sprite asset/object/render authoring | A basic engine expectation is completely absent and blocks nearly every genuine 2D genre. Billboard support does not satisfy it. |
| 2 | Schema-backed Components and “Add Component” discovery | Current capabilities are scattered across object flags and conditional Inspector blocks; this is the shared usability and scalability bottleneck. |
| 3 | Project-wide validation plus typed, rename-safe references | Silent typos and incomplete cross-panel setups affect variables, prefabs, equipment, animation, AI, saves, graphs, and zones. |
| 4 | Orthographic 2D camera, layers, and coordinate contract | Sprites cannot become a coherent authoring workflow without predictable pixels/world units, viewport framing, sorting, and resize behavior. |
| 5 | Comprehensive Input Actions and rebinding | Only Interact/Attack are project-bindable; ordinary abilities and movement schemes still require fixed controller assumptions or code. |
| 6 | Guided onboarding and starter templates | Existing breadth is difficult for a beginner to discover; a first complete game currently requires reverse-engineering samples. |
| 7 | Tilemap asset/layer/painter workflow | Essential high-leverage 2D world authoring is absent, though it should follow rather than precede the Sprite foundation. |
| 8 | 2D colliders, physics, triggers, and player controller | 3D physics cannot simply be relabeled 2D; genuine 2D games need planar semantics and dedicated authoring. |
| 9 | Direct-manipulation UI canvas | HUD/menu authoring through forms creates slow play/stop/tune loops and limits responsive layouts. |
| 10 | Reusable Material assets | Looks are repeated per object; no shared material identity, preview, or one-edit-many workflow exists. |
| 11 | Portable Prefab assets with explicit variants/overrides | The runtime is capable, but name identity, local scope, and manual update semantics make reuse fragile. |
| 12 | Visual Animation Controller | Clip-name inference and scattered controls do not scale to transitions, blending, layered states, or understandable reuse. |
| 13 | Real Sequence/Timeline authoring | Ordered action lists cover basics but lack tracks, scrubbing, markers, spatial context, and live preview. |
| 14 | Node Graph/runtime logic diagnostics | Authors cannot see which event, condition, node, or action ran, failed, or held stale state. |
| 15 | Scalable Scene tree and hierarchy manipulation | Bulk organization, reparenting, filtering, locking, visibility, and ownership become painful as scenes grow. |
| 16 | Navigation authoring and reachability validation | Manual waypoint-edge editing works for small spaces but scales poorly and gives limited feedback. |
| 17 | Unified Equipment workflow | Several valid subsystems must align by hidden names and rig knowledge; this should be one composed authoring path. |
| 18 | Save-game schema and state inspector | Runtime persistence exists, but creators cannot clearly define, inspect, migrate, or debug saved state. |
| 19 | First-class named Signals/Events | Lifecycle triggers exist, but reusable typed communication and reference discovery are missing. |
| 20 | Asset import diagnostics and normalization | Local import works, but failures and compatibility problems lack structured, creator-facing explanations and fixes. |

Sprites/2D rank first because a direct repository audit finds the core capability truly absent and because it unlocks a major class of games. The ranking is not prompt-driven: the Component/validation foundations rank immediately behind it because adding Sprites through more ad hoc flags and Inspector branches would deepen the product's largest structural problem.

## 8. Sprite and 2D assessment

| Capability | Current state | Assessment |
|---|---|---|
| True Sprite objects | Absent | Current `isBillboard` objects remain ordinary 3D entities. |
| Sprite asset import | Absent | Image import creates Texture assets only; no Sprite metadata/import settings. |
| Sprite rendering | Absent | A textured quad goes through the 3D scene/depth path; no dedicated 2D renderer/batch/layer contract. |
| Pivot/origin | Absent | No Sprite pivot handles or normalized/pixel pivot data. |
| Size | Absent | Billboard size is generic 3D entity scale, not pixels-per-unit or source-frame dimensions. |
| Sorting layer | Absent | No named sorting layer. |
| Draw order | Absent | No explicit per-Sprite order within a layer. |
| Transparency | Partial underneath | Per-entity alpha and cutout-oriented shader behavior exist, but no 2D transparency/sorting workflow. |
| Filtering | Not authorable | Texture creation uses fixed WebGL filtering/mipmap/wrap choices; no nearest/pixel-art import setting. |
| Atlases | Absent | No atlas asset, region slicing, packing, or frame references. |
| Frame animation | Absent | Property/skinned animation does not provide sprite-frame animation. |
| Orthographic 2D camera | Absent | `Mat4.orthographic` exists for bounded shadow projection; it is not a creator-facing camera mode. |
| Tilemaps | Absent | No tile set, map layer, painter, renderer, or serialized tile cells. |
| 2D colliders | Absent | Existing sphere/AABB/box/terrain collision operates in the 3D controller/world model. |
| 2D Player controller | Absent | Top-Down is still a 3D-world controller, not a planar Sprite controller. |
| 2D/3D hybrid scenes | Accidental/partial | Billboards can coexist with meshes, but no documented camera, layer, depth, lighting, or collision contract makes hybrid scenes intentional. |

Conclusion: **WORLD-SPACE BILLBOARD is supported; TRUE 2D SPRITE is not.** Sprite work is urgent, but it should land on the small schema/serialization seams established in Phases 002–003 rather than as another `isSprite` branch threaded through the monolith.

## 9. Which authoring model fits each capability

| Authoring model | Use it for |
|---|---|
| Direct manipulation + Inspector | Transform, hierarchy, terrain sculpt/paint, path points, collider bounds, trigger bounds, camera framing, Sprite pivot/size, tile painting, and UI layout. |
| Components | Mesh/Sprite renderer, Collider, Rigidbody/2D Body, Health, Weapon, AI, Audio Source/Zone, Fog Zone, Inventory, Equipment, Camera, Player Input, and reusable state. |
| Presets | Door, pickup, checkpoint, moving platform, projectile, enemy archetype, camera rig, Audio Zone, Fog Zone, and genre starter objects—compositions of visible components/events/actions. |
| Events + Conditions + Actions | Common local reactions: enter trigger, click/interact, damage, collect, open door, play sound, update objective, switch level. |
| Visual Graph | Branching quests, reusable game-state orchestration, compound conditions, AI/state logic, and multi-object logic where a short Behavior list stops being readable. |
| Sequence/Timeline | Cutscenes, camera moves, timed animation/audio/action tracks, scripted presentation, and ordered encounters. |
| Custom Script | Unusual mechanics, experimental algorithms, external integrations, and power-user extensions that exceed the curated vocabulary. |

Do not force spatial editing into Node Graph, and do not grow complex quests or state machines as hundreds of Inspector fields. Components define capabilities; direct manipulation edits spatial data; Events/Actions express simple reactions; Graph and Timeline handle complexity.

## 10. Architecture scalability assessment

**Can another 200+ phases safely continue adding `if (item.foo)` blocks to one editor file? No.**

Current pressure points:

- `editor/src/01-editor.js` is 16,138 lines / 969,617 bytes.
- It contains 469 named functions, 710 direct `getElementById` calls, 240 `selectedItem` references, 173 object-kind comparisons, and 136 explicit undo call sites.
- `renderInspectorBody()` is a large conditional template and `renderInspector()` hand-wires controls after every render.
- `serializeCubeRecord()` is an explicit field allowlist; comments document repeated cases where new runtime/authoring fields were initially omitted or runtime-only data leaked into saves.
- Placeable capability is frequently represented by `kind:'cube'` plus flags such as trigger, waypoint, ramp, billboard, spawn point, carryable, AI, collider, and variables.
- Player settings and project panels are hard-coded markup paired with hand-wired JavaScript.
- `ACTION_TYPES` is a useful registry, but Graph-only conditions are appended separately and state keys remain free-typed.

Existing seams worth protecting:

- one `ACTION_TYPES` vocabulary reused by Behaviors, Graph, Sequences, and Animation Events;
- `renderActionFieldInput()` and typed field kinds such as target, prefab, asset, level, objective, and sequence;
- `serializeItemRecord()` / `instantiateItemFromRecord()` shared load/prefab paths;
- `PLAYER_CONTROLLERS` dispatch;
- shared `composeExportHTML()` and one editor/export runtime;
- transform/hierarchy, undo stack, asset libraries, and strong automated runtime/export tests.

The answer is gradual extraction, not a rewrite. New systems should stop increasing hard-coded branches and instead register schemas, fields, serialization ownership, validation, duplication/prefab rules, and Inspector sections. Existing systems can migrate when touched.

## 11. What must be protected or refactored before Sprite work

Urgent prerequisites are bounded:

1. Define a small authoring schema/component registry that can describe fields, defaults, serialization, duplication/prefab behavior, validation, and Inspector placement without changing runtime behavior.
2. Extract/reuse field renderers and reference pickers so Sprite properties do not introduce another hand-wired UI island.
3. Establish versioned serialization ownership and round-trip tests for new component/asset data; retain current legacy loaders.
4. Define the asset-type registration seam needed for a Sprite asset derived from an imported image without forking Texture import.
5. Define renderer ordering/camera seams for Sprite layers without forking the editor/export runtime.
6. Keep undo transactions, project save/load, prefab duplicate, and both export tiers in the Sprite acceptance contract from its first slice.

Do not first split the entire 16k-line file, redesign all saved projects, or migrate every current object to Components. Those are high-risk rewrites and are not prerequisites for the first Sprite lane.

## 12. Recommended execution order

Follow the stable phase IDs in this execution order:

1. **Phase 002** — establish the bounded schema/component and serialization contract, with characterization tests around existing authoring/export paths.
2. **Phase 003** — introduce the minimum module/registry seams and reusable field/reference/validation plumbing required by new capabilities, with no broad UI rewrite.
3. **Phases 011–020** — jump to the urgent true Sprite lane: Sprite asset/object, render contract, pivot/size, transparency/filtering, sorting/order, orthographic 2D camera, and editor/export dogfood.
4. **Return to Phases 004–010** — continue general no-code foundation using evidence from the first real component-based feature.
5. **Phases 021–030** — Sprite Animation.
6. **Phases 031–040** — Tilemaps.
7. **Phases 041–050** — 2D Physics.
8. **Phase 051 onward** — Visual Logic and subsequent roadmap.

Yes: execution should jump to Sprite phases after 002/003 unless those phases reveal a concrete hard prerequisite. Phase IDs remain stable.

## 13. Direct answers to the Phase questions

1. **What can a beginner genuinely build today without code?** A bounded, compact 3D game using palette/imported objects, four controllers, terrain, collision, presets, simple AI/combat/interactions, HUD/menus, levels, save, and standalone export.
2. **What can they technically build but only with excessive hidden knowledge?** State-machine AI, equipment/rig sockets, advanced prefab parameters, graphs, animation conventions, navigation, zones, save-state persistence, larger dialogue/HUD flows, and reusable typed state.
3. **Which capabilities are runtime-only?** Pieces of orthographic math, generic rendering/collision, event dispatch and scripting exist underneath, but true 2D, named Signals, comprehensive input maps, and component authoring do not exist as meaningful creator paths.
4. **Which expected basics are completely absent?** True Sprites, atlases/frame animation, authorable 2D camera/layers, tilemaps, 2D physics/colliders/controller, and guided onboarding.
5. **What are the top 20 gaps?** Ranked in Section 7.
6. **Where do Sprites/2D rank?** True Sprite authoring is #1; its supporting 2D camera is #4, Tilemaps #7, and 2D Physics #8.
7. **Which problems need Components?** Reusable capabilities/data: renderers, colliders, health, weapons, AI, input, inventory/equipment, zones, cameras, and 2D bodies.
8. **Which need Visual Graph?** Branching quests, compound state conditions, reusable orchestration, multi-object logic, and visual state machines—not transforms or basic property editing.
9. **Which need direct manipulation?** Transform/hierarchy, terrain, paths, collider/trigger bounds, cameras, Sprite pivot/size, tile painting, and UI layout.
10. **Which should remain advanced code?** Unusual mechanics, custom algorithms, experimentation, extensions, and integrations outside the curated no-code vocabulary.
11. **Is the architecture sustainable for another 200 phases?** Not if work continues as hard-coded branches in `01-editor.js`; yes only with gradual registry/schema seams and protected shared runtime paths.
12. **What should be protected/refactored before Sprite work?** Protect one runtime, shared Actions/export/serialization/transform/undo behavior; add bounded schema, field, reference, validation, asset-type, and render-order seams.
13. **What is the recommended order?** Phase 002 → Phase 003 → Phases 011–020 → return to 004–010 → 021–030 → 031–040 → 041–050 → 051 onward.

## 14. Program boundaries and status

- Phase 002 was not implemented automatically.
- Sprites were assessed but not implemented.
- No game #29 was created.
- The 28 games were not re-polished or rebalanced.
- No deployment or DNS work occurred.
- **Wave 10 status: NOT STARTED.**

Phase 001 stops here with the contract, inventory, rubric, friction evidence, architecture assessment, and execution recommendation complete.
