# Authoring Friction Register

This is the human-readable view of `authoring-friction.json`, the machine-readable source of truth. Generate both registry views with `node tools/authoring-friction-report.js --write` and validate without writing with `--check`. Stable IDs never change when titles, severity, phase linkage, or resolution state changes.

## Operational workflow

OBSERVE → RECORD → REPRODUCE → CLASSIFY → ROOT CAUSE → ASSIGN CORRECT LAYER → FIX → RE-DOGFOOD → VERIFY → CLOSE

## Bounded contract

- States: OBSERVED, REPRODUCED, CONFIRMED, PLANNED, IN_PROGRESS, RESOLVED, ACCEPTED_LIMITATION, DUPLICATE, INVALID.
- Severity measures creator impact, never engineering difficulty: CRITICAL blocks a major common capability class; HIGH makes a common workflow inaccessible, error-prone, hidden, or excessively manual; MEDIUM is repeated avoidable but usable friction; LOW is practical polish friction with a workaround.
- Frequency is separate from severity: ONCE, OCCASIONAL, REPEATED, PERVASIVE.
- Every classified issue has one primary root cause, optional contributing causes, one correct fix layer, one creator journey, stable affected-system names, reproducible evidence, and optional phase linkage.
- RESOLVED requires all five checks: root cause addressed; creator workflow re-run; regression coverage where appropriate; workaround no longer required; inventory/coverage grade reconsidered. Code changed alone is not resolution.
- ACCEPTED_LIMITATION requires an intentional bound, reasonable workaround, disproportionate engineering cost, and clear documentation.
- DUPLICATE records keep their own identity and evidence and point to a non-duplicate canonical issue. Historical records are never deleted.

## Registry

| ID | Finding | State | Severity | Frequency | Primary root cause | Creator journey | Correct fix layer | Affected systems | Phase linkage |
|---|---|---|---|---|---|---|---|---|---|
| AFR-0001 | 2D workflow still lacks a dedicated controller, general physics, and pixel-perfect Camera authoring | ACCEPTED_LIMITATION | CRITICAL | PERVASIVE | MISSING_CAPABILITY | Create Object | component | Sprites / 2D, Colliders, Player Controllers, Cameras | D001 / T011 |
| AFR-0002 | No tile-based level authoring | RESOLVED | CRITICAL | PERVASIVE | MISSING_CAPABILITY | Build Level | viewport/direct manipulation | Tilemaps, Sprites / 2D, Colliders | D001 / T031 / R032 |
| AFR-0003 | Capability discovery depends on a dense conditional Inspector | ACCEPTED_LIMITATION | HIGH | REPEATED | DISCOVERABILITY | Add Gameplay | Inspector | Behaviors, Health, Trigger Volumes, Particles | D001 |
| AFR-0004 | Free-typed state keys are not rename-safe | ACCEPTED_LIMITATION | HIGH | REPEATED | REFERENCE_SAFETY | Add Gameplay | project model | Variables, Save Game, Behaviors, Node Graph | D001 |
| AFR-0005 | Project input actions are fixed and incomplete | ACCEPTED_LIMITATION | HIGH | REPEATED | MISSING_CAPABILITY | Add Gameplay | project model | Input Actions, Rebinding, Player Controllers | D001 |
| AFR-0006 | Equipment setup spans hidden cross-panel contracts | ACCEPTED_LIMITATION | HIGH | REPEATED | WORKFLOW | Build Character | component | Equipment, Inventory, Weapons, Mesh Assets | D001 |
| AFR-0007 | Prefabs lack portable identity and explicit overrides | ACCEPTED_LIMITATION | HIGH | REPEATED | DATA_MODEL | Reuse Content | project model | Prefabs | D001 |
| AFR-0008 | Branching logic lacks a readable traced overview | ACCEPTED_LIMITATION | HIGH | REPEATED | INSPECTOR_UI | Add Gameplay | Visual Graph | AI State Machine, Node Graph, AI | D001 |
| AFR-0009 | Animation control relies on clip-name conventions | ACCEPTED_LIMITATION | HIGH | REPEATED | DATA_MODEL | Build Character | component | Animation, AI State Machine | D001 |
| AFR-0010 | Sequences are form lists rather than a timeline | ACCEPTED_LIMITATION | HIGH | REPEATED | INSPECTOR_UI | Add Gameplay | timeline | Sequences, Cameras, Animation, Audio Assets | D001 |
| AFR-0011 | Navigation graph authoring scales poorly | ACCEPTED_LIMITATION | HIGH | REPEATED | VIEWPORT_UI | Build Level | viewport/direct manipulation | Navigation, Paths, AI | D001 |
| AFR-0012 | HUD and menu layout lacks a responsive canvas | ACCEPTED_LIMITATION | HIGH | PERVASIVE | VIEWPORT_UI | Create UI | viewport/direct manipulation | HUD, Menus | D001 |
| AFR-0013 | Runtime behavior is not author-traceable | ACCEPTED_LIMITATION | HIGH | REPEATED | VALIDATION | Debug | validation | Debugging, Node Graph, Behaviors, AI State Machine | D001 |
| AFR-0014 | Project preflight does not cover every incomplete setup | ACCEPTED_LIMITATION | HIGH | REPEATED | VALIDATION | Export | validation | Validation, Prefabs, Equipment, Variables | D001 |
| AFR-0015 | No guided first-game onboarding | RESOLVED | HIGH | PERVASIVE | DOCUMENTATION | Learn Engine | onboarding/documentation | Onboarding, Templates | D001 / T009 / R009 |
| AFR-0016 | Material changes require reapplying to placed copies | ACCEPTED_LIMITATION | MEDIUM | REPEATED | DATA_MODEL | Reuse Content | asset pipeline | Materials, Texture Assets | D001 |
| AFR-0017 | Spatial zones are hidden compositions | ACCEPTED_LIMITATION | MEDIUM | REPEATED | DISCOVERABILITY | Add Gameplay | preset | Audio Zones, Fog Zones, Trigger Volumes, Behaviors | D001 |
| AFR-0018 | Large-scene hierarchy operations are minimal | ACCEPTED_LIMITATION | MEDIUM | REPEATED | VIEWPORT_UI | Build Level | viewport/direct manipulation | Hierarchy, Scene/Object Creation | D001 |
| AFR-0019 | Project save and game save have an unclear mental model | RESOLVED | MEDIUM | OCCASIONAL | DOCUMENTATION | Save | onboarding/documentation | Save Game, Export | D001 / R240 |
| AFR-0020 | Asset import diagnostics are too shallow | ACCEPTED_LIMITATION | MEDIUM | OCCASIONAL | ASSET_PIPELINE | Import Asset | asset pipeline | Import, Mesh Assets, Texture Assets, Audio Assets | D001 |
| AFR-0021 | Dogfood A repeats dense capability discovery | DUPLICATE → AFR-0003 | HIGH | REPEATED | DISCOVERABILITY | Add Gameplay | Inspector | Behaviors, Scene/Object Creation | D004 / T005 |
| AFR-0022 | Dogfood B repeats dense behavior-entry discovery | DUPLICATE → AFR-0003 | HIGH | REPEATED | DISCOVERABILITY | Add Gameplay | Inspector | Behaviors, Validation | D004 / T005 |
| AFR-0023 | Imported textures cannot be applied from the asset library | RESOLVED | LOW | REPEATED | WORKFLOW | Import Asset | asset pipeline | Texture Assets, Materials, Import | D004 / R240 |
| AFR-0024 | Sequential Sprite Inspector edits could target a replaced component record | RESOLVED | HIGH | REPEATED | DATA_MODEL | Create Object | component | Sprites / 2D, Transform, Prefabs | D020 / T020 / R020 |
| AFR-0025 | Trigger Collider 2D detection remains bounded without filtering and multiple volumes | ACCEPTED_LIMITATION | MEDIUM | REPEATED | MISSING_CAPABILITY | Add Gameplay | component | Trigger Volumes, Colliders, Sprites / 2D, Behaviors | D042 / T049 |
| AFR-0026 | Body 2D v1 lacks Dynamic motion and richer contact authoring | ACCEPTED_LIMITATION | MEDIUM | REPEATED | MISSING_CAPABILITY | Add Gameplay | component | Colliders, Sprites / 2D, Behaviors | D043 |

Phase linkage uses D = discovered, T = target, and R = resolved. A blank target is backlog evidence, not an implicit roadmap commitment.

## Evidence and reproduction

### AFR-0001 — 2D workflow still lacks a dedicated controller, general physics, and pixel-perfect Camera authoring

The normal Sprite and Tilemap paths now include reusable 2D collision shapes, Static/Kinematic response, Trigger detection, and eligible Character Tile collision. Remaining broad friction is dedicated controller/input and jump authoring, general 2D physics, and genuine pixel-perfect Camera workflow.

Current workaround: Compose Character Collision 2D with a Kinematic Body and Box/Circle Collider for Static and Tile blocking; author movement separately. Dedicated controller/input, gravity, and jumping remain future work.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Split stale controller claim from explicit future pixel-perfect Camera and utility-rejected general Dynamic physics. Neither is promised by orthographic framing or Character collision. Bounded limitation, not new physics mandate.
- Code-free common path: Use qualified Sprite controllers, orthographic framing and Character/Tile collision; integer-pixel or mass-stacking games remain outside this contract.
- Why expansion is out of scope: 044 declined Dynamic promotion; a new solver/pixel policy exceeds the qualified common2D workflow.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0001 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Create a Tileset, Tilemap, and Character Collision 2D object; confirm Tile blocking and contact state without code.
  2. Search the Scene, Components, and viewport for dedicated 2D controller/input and jump authoring, general Dynamic physics, and pixel-perfect Camera snapping; confirm those remaining gaps.

Evidence:

  - phase_report: `PHASE-001-REPORT.md` — Original Sprite/2D assessment
  - phase_report: `PHASE-012-REPORT.md` — Reusable Sprite Asset workflow
  - phase_report: `PHASE-013-REPORT.md` — Named sorting-layer implementation
  - phase_report: `PHASE-014-REPORT.md` — Sprite/Billboard boundary and hybrid rendering acceptance
  - phase_report: `PHASE-017-REPORT.md` — Sampling and opacity implementation and acceptance
  - phase_report: `PHASE-018-REPORT.md` — Atlas region and slicing acceptance
  - phase_report: `PHASE-019-REPORT.md` — Direct Sprite Asset placement acceptance
  - phase_report: `PHASE-020-REPORT.md` — Epoch 02 clean-room qualification and hardening
  - phase_report: `PHASE-026-REPORT.md` — Nine-slice implementation and qualification
  - contract: `NINE-SLICE-SPRITE-ASSET-CONTRACT.md` — Guide ownership and validation
  - contract: `NINE-SLICE-RENDERING-CONTRACT.md` — Rendering, UV, flip, and tiny-target rules
  - contract: `SPRITE-ASSET-PLACEMENT-CONTRACT.md` — Typed payload, perspective placement, defaults, cancellation, history, and identity
  - contract: `SPRITE-SORTING-LAYER-CONTRACT.md` — Stable IDs, explicit order, runtime tuple, and deletion safety
  - contract: `SPRITE-VS-BILLBOARD-CONTRACT.md` — Authoritative object, workflow, persistence, and conversion boundary
  - source: `editor/src/00-authoring-plumbing.js` — Sprite asset and placement-record contracts
  - source: `editor/src/01-editor.js` — Shared pointer placement dispatcher and stable live-component synchronization
  - test: `tests/phase-020-sprite-foundation.test.js` — Epoch-wide Sprite contracts, repair paths, regression, and boundary coverage
  - test: `tests/phase-026-nine-slice-sprites.test.js` — Nine-slice contract and regression coverage
  - browser_audit: `phase-020-dogfood.json` — Fresh-profile clean-room authoring, persistence, hybrid scene, and export evidence
  - browser_audit: `phase-026-dogfood.json` — Visible creator workflow, repair, persistence, Prefab, and export evidence
  - phase_report: `PHASE-030-REPORT.md` — Epoch 03 starter and integrated dogfood qualification
  - browser_audit: `phase-030-dogfood.json` — Visible starter/dogfood authoring plus isolated Editable and Playable export evidence
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0001 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0002 — No tile-based level authoring

The common multi-layer tile-based level-authoring journey is discoverable, direct-manipulation based, persistent, validated, connectivity-aware, supports deterministic natural Terrain variation and large-area painting, renders at runtime, and is portable across projects without code.

Current workaround: None for visual multi-layer Tilemaps or eligible Character Tile collision. General Body-vs-Tile physics and later one-way/slope rules remain outside this resolved authoring issue.

Reproduction:

  1. Create a Tileset and one Tilemap, add four layers, paint the same coordinate in multiple layers, reorder, hide, lock, duplicate, and clear one layer.
  2. Undo/Redo layer and stroke operations, Save/Load, validate, and export Editable and Playable artifacts; confirm one Tilemap object remains one scene object.

Evidence:

  - phase_report: `PHASE-001-REPORT.md` — Original Tilemap assessment
  - phase_report: `PHASE-031-REPORT.md` — Tileset and Tile Palette foundation qualification
  - browser_audit: `phase-031-dogfood.json` — Visible Tileset/Palette authoring, repair, persistence, and export evidence
  - test: `tests/phase-031-tileset-palette.test.js` — Schema, references, UI, persistence, pruning, and boundary coverage
  - phase_report: `PHASE-032-REPORT.md` — Tilemap object, paint and erase, runtime, persistence, export, and qualification closure
  - browser_audit: `phase-032-dogfood.json` — Live authoring and exact Editable and Playable artifact boot evidence
  - test: `tests/phase-032-tilemap-paint-erase.test.js` — Sparse model, viewport workflow, renderer, export, and scope regression coverage
  - phase_report: `PHASE-033-REPORT.md` — Multi-layer Tilemap implementation and qualification
  - browser_audit: `phase-033-dogfood.json` — Layer-panel, Paint/Erase, Undo/Redo, validation, and export boot evidence
  - test: `tests/phase-033-multilayer-tilemaps.test.js` — Migration, identity, layer isolation, validation, dependency, export, and bounded performance coverage
  - phase_report: `PHASE-034-REPORT.md` — Tile collision metadata authoring and no-physics boundary qualification
  - browser_audit: `phase-034-dogfood.json` — Visible collision editing, overlay, repair, persistence, and export evidence
  - test: `tests/phase-034-tile-collision-metadata.test.js` — Schema, geometry, validation, identity, overlay, export, and scope coverage
  - phase_report: `PHASE-035-REPORT.md` — Auto-Tile Set, resolver, authoring, persistence, export, and no-runtime-solver qualification
  - browser_audit: `phase-035-dogfood.json` — Visible Rule authoring, Auto Paint/Erase, override, retiling, persistence, and export evidence
  - test: `tests/phase-035-auto-tiling.test.js` — Masks, gated corners, membership, resolver, validation, migration, export, and scope coverage
  - phase_report: `PHASE-036-REPORT.md` — Terrain Brush authoring, determinism, footprint, export, and qualification evidence
  - test: `tests/phase-036-terrain-brushes.test.js` — Terrain schema, hashing, footprints, semantics, validation, persistence, and scope coverage
  - browser_audit: `phase-036-dogfood.json` — Visible Terrain Brush creation, painting, recompute, repair, persistence, and export evidence

### AFR-0003 — Capability discovery depends on a dense conditional Inspector

Registered Components and seven common gameplay roles now have searchable entry points, while capabilities outside those bounded catalogs still surface through conditional Inspector panels.

Current workaround: Use Add Component or Apply Gameplay Preset when the needed capability is cataloged; use the legacy Inspector and samples for uncataloged capabilities.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Advanced conditional Inspector density remains. Do not claim every capability is a Component, novice learning certification or universal tablet accessibility. Partial improvement/explicit limit.
- Code-free common path: Use searchable Components/Presets, command palette, starters and guide; advanced conditional panels remain.
- Why expansion is out of scope: A full Inspector framework replacement would risk preserved authoring ownership without improving an unproven common-path blocker.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0003 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Select a scene object and search Apply Gameplay Preset for a supported role such as Checkpoint or Damage Zone.
  2. Search for an uncataloged behavior role or advanced capability.
  3. Observe that the supported role is one-click configurable while the uncataloged capability still requires manual Inspector discovery and wiring.

Evidence:

  - source: `editor/src/01-editor.js` — renderInspectorBody/renderInspector conditional surface
  - browser_audit: `tools/audit-phase-004.js` — Workflows A and B repeat this discovery path.
  - browser_audit: `tools/audit-phase-006.js` — Health, Trigger Volume, and Particle Emitter share one field/section interaction path; Add Component remains absent.
  - browser_audit: `tools/audit-phase-007.js` — Search, keyboard add, duplicate prevention, Undo/Redo, Save/Load, validation, prefab, duplicate, and exports passed; legacy non-schema discovery remains outside the picker.
  - browser_audit: `tools/audit-phase-008.js` — Seven-role preset dogfood passed with parameters, one-step application, semantic update/no duplication, Undo/Redo, Save/Load, Prefab, Duplicate, validation, and both export tiers.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0003 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0004 — Free-typed state keys are not rename-safe

Counters, flags, timers, variables, slots, and semantic tags frequently use free-typed string keys, so typos and renames split state silently.

Current workaround: Keep spellings synchronized manually and search project JSON/source while debugging.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Names remain strings; no automatic global rename/reference identity and Object Variables not newly covered. Clearly retain this limitation; do not introduce a parallel state runtime to close the title.
- Code-free common path: Select existing exact-case state hints or copy matching strings; explicitly edit every use on rename. Object Variables remain separate.
- Why expansion is out of scope: Global string rename across opaque legacy graphs requires a new identity/migration contract; guessing would risk user data.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0004 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Create two actions that address the same state key.
  2. Introduce a spelling difference in one key.
  3. Observe that both values remain valid strings but no longer address the same state.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Variables and Save Game use name-based state.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0004 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0005 — Project input actions are fixed and incomplete

Named Actions and controller discovery have explicit keyboard-or-mouse/gamepad/touch author defaults. Generated Controls and project-scoped local keyboard/mouse preferences, bounded tuning and contextual logical maps use canonical runtime paths; consult094–096 reports for frozen creator/native/export evidence. Automatic active-device prompts qualified097 and optional per-level joystick/button layout qualified098 after native resize/default occlusion repairs. Persistent device/context/effective-binding diagnostics qualified099 with native typed repairs and alltiers; composed cross-device epoch qualification100 development and physical hardware acceptance remains unclaimed. Phone preview needs explicit scaled viewport boundary. Collection membership does not create abilities or disable input.

Current workaround: Use named Input Action assets, Device Mappings and an On Update typed Pressed/Held graph; no Custom Script needed for the common mapped-action path.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Physical gamepad/touch/hotplug/cross-device testing remains unavailable, not implicitly passed. No all-device compatibility promise.
- Code-free common path: Use qualified named keyboard/mouse Actions and author device mappings; test physical controllers/touch on actual target hardware.
- Why expansion is out of scope: Desktop automation cannot certify every physical device; universal device coverage is outside available evidence.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0005 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Open Project Input Actions and Device Mappings.
  2. Create a named Action and configure device-only touch or gamepad input.
  3. Validate real authoring/export gates before treating the broader cross-device workflow as complete.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Input Actions and Rebinding rows.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0005 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0006 — Equipment setup spans hidden cross-panel contracts

Item, equipment, rig socket, slot/name, and weapon settings live in separate sections that must agree.

Current workaround: Learn the implicit mapping and manually coordinate names across panels.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Separate panels remain; arbitrary legacy mapping uses historical first match, sockets use names, no automatic rename/bone migration/scale inheritance. The old implicit-ID workaround is superseded for supported named paths.
- Code-free common path: Use named Item/slot/Weapon/socket selectors and explicit suggestions; inspect unavailable/legacy mappings.
- Why expansion is out of scope: Automatic cross-panel/bone rename and scale inheritance change qualified equipment/rig ownership semantics.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0006 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Configure an inventory item and equippable weapon.
  2. Assign its socket and slot across the relevant panels.
  3. Observe the multiple name-based relationships and separate configuration surfaces.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Equipment and Inventory limitations.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0006 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0007 — Prefabs lack portable identity and explicit overrides

Prefabs are name-identified, locally stored, manually synchronized, and have limited override semantics and unclear project/library ownership.

Current workaround: Bundle/import projects, manually update linked instances, or duplicate objects.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Name identity and explicit manual synchronization remain; global GUID/live-sync promises are absent. Ownership restoration is repaired, not cache deletion or a new Prefab format. No blanket claim about every override combination.
- Code-free common path: Save complete Project libraries; use explicit portable transfers, independent linked placement, parameters/Clear and manual updates.
- Why expansion is out of scope: GUID/live-sync conversion needs legacy migration/conflict semantics; detached snapshot restoration must preserve compatible names.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0007 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Save an object as a prefab and place multiple instances.
  2. Change the source and inspect update/override behavior.
  3. Attempt to reuse it in another project.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Prefabs graded C.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0007 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0008 — Branching logic lacks a readable traced overview

AI now has a canonical authored node/edge overview. Live AI execution tracing and broader branching diagnostics remain separate unresolved friction.

Current workaround: Keep graphs small, rely on naming, and inspect the running game manually.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: No complete AI decision-reason history or visual replay debugger. Partial improvement with explicit diagnostic bounds.
- Code-free common path: Inspect live AI state/noise/input and bounded Graph Trace outcomes; reproduce conditions through Play/Pause.
- Why expansion is out of scope: Full AI reason replay requires retained execution semantics beyond qualified observational tracing.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0008 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Open an object's AI state machine or Node Graph.
  2. Run branching logic.
  3. Attempt to identify the active state, fired edge, and failed condition from the authoring surface.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — AI State Machine and Node Graph rows.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0008 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0009 — Animation control relies on clip-name conventions

Auto-animation infers states from clip names such as idle, walk, run, attack, and death; complex transitions have no visual controller.

Current workaround: Rename clips externally or manually select and play clips/actions.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Legacy auto-name mode retained, no universal skeletal visual blend tree or automatic clip rename rebinding.
- Code-free common path: Use explicit Player/manual animation maps and existing crossfades; unavailable choices remain visible.
- Why expansion is out of scope: Universal skeletal blend trees/automatic clip migration introduce another controller architecture.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0009 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Import an animated model with non-conventional clip names.
  2. Enable automatic character animation.
  3. Observe that semantic mapping and transitions cannot be authored explicitly.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Animation limitations.
  - browser_audit: `phase-022-dogfood.json` — Three Sprite clips were visually authored, previewed, looped, saved, reused, and exported without raw IDs.
  - contract: `SPRITE-ANIMATION-EDITOR-CONTRACT.md` — Bounded one-clip visual authoring surface.
  - browser_audit: `phase-024-dogfood.json` — Sprite frame events were authored, renamed, dispatched, persisted, and exported; the 3D skinned-animation convention remains.
  - contract: `SPRITE-ANIMATION-EVENT-NOCODE-CONTRACT.md` — Target-specific Sprite event listener boundary and remaining generic-animation exclusions.
  - browser_audit: `phase-025-dogfood.json` — Base flips, semantic directions, sparse variants, mirror reuse, fallback, persistence, and exports were qualified in the real editor.
  - contract: `SPRITE-DIRECTIONAL-ANIMATION-CONTRACT.md` — Bounded direction resolution, XOR flip composition, fallback, playback, persistence, and no-controller boundary.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0009 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0010 — Sequences are form lists rather than a timeline

Sequence authoring provides an ordered action list without tracks, ruler, scrubbing, markers, or spatial-temporal overview.

Current workaround: Chain camera, delay, and action records and replay from the beginning.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: No general multitrack timeline or Sequence scrub;181 property-clip scrub is not a substitute claim. Intentional utility bound.
- Code-free common path: Compose ordered Sequences with Camera/Freeze/Animation; property clip scrub is not multitrack Sequence scrub.
- Why expansion is out of scope: 186 utility gate retained existing composition rather than a second timeline language/clock.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0010 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Create a sequence with camera, delay, animation, and sound actions.
  2. Attempt to scrub or align actions on tracks.
  3. Observe that timing is edited only as ordered form values.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Sequences graded C.
  - browser_audit: `phase-022-dogfood.json` — Visual Sprite frame authoring reduced form scanning; the broader Sequence surface was intentionally unchanged.
  - contract: `SPRITE-ANIMATION-PREVIEW-CONTRACT.md` — Bounded preview/scrub scope is asset-local, not a Sequence timeline.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0010 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0011 — Navigation graph authoring scales poorly

Authors place waypoints and add connections one dropdown edge at a time without automatic reachability checks or a navigation surface.

Current workaround: Hand-build and visually inspect the waypoint graph.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: No automatic navmesh/reachability/avoidance/bulk editing. Direct fallback/disconnected behavior remains documented; no pathfinding expansion justified by stale title.
- Code-free common path: Author named reciprocal/directed Waypoints and test intended routes; direct/disconnected fallback is explicit.
- Why expansion is out of scope: Automatic navmesh/reachability/avoidance/bulk generation needs algorithms outside126's navigation scope.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0011 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Place several waypoints.
  2. Connect them through Inspector dropdowns.
  3. Attempt to visualize directionality and validate reachability.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Navigation authoring limitations.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0011 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0012 — HUD and menu layout lacks a responsive canvas

HUD direct manipulation and responsive preview are qualified; menu composition is still constrained by fixed legacy screens. Narrow HUD Inspector label spacing remains non-blocking polish friction.

Current workaround: Use the qualified HUD canvas and typed fields; legacy Start/Pause screens until Menu page qualification finishes.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: No universal responsive free-layout canvas, physical small-device or assistive-tech certification; narrow advanced density remains.
- Code-free common path: Use existing HUD anchors, screen stack/templates and intended-viewport preview.
- Why expansion is out of scope: A universal responsive free-layout canvas is a different authoring model; physical small-device certification remains unverified.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0012 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Create several HUD elements and verify actual Desktop/Tablet/Phone fit.
  2. Try composing a new menu screen beyond existing Start/Pause fields.
  3. Retest native page/history/export acceptance before treating086 as complete.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — HUD and Menus limitations.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0012 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0013 — Runtime behavior is not author-traceable

Authors cannot see which event fired or why an action or condition failed; failures surface through status text, console messages, or silent no-ops.

Current workaround: Open browser developer tools and inspect runtime globals or source.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: No breakpoint/replay/all-AI-reasons/effect-success guarantee. Blanket untraceability stale, bounded diagnostics remain.
- Code-free common path: Use bounded Graph Trace, live State/AI observation and owner/node navigation for the corresponding execution scope.
- Why expansion is out of scope: Breakpoints/replay/all-AI-reasons and guaranteed effect success exceed existing diagnostic semantics.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0013 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Create a behavior or graph with a condition that does not pass.
  2. Run the game.
  3. Attempt to inspect event, condition, action, and state execution from the editor.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Debugging graded C.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0013 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0014 — Project preflight does not cover every incomplete setup

Phase 003 added centralized component/reference/asset validation, but unregistered prefab, socket, and state-name contracts can still remain silent until play.

Current workaround: Use Validate Project for covered data, then manually play unregistered paths.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: No gameplay correctness proof or free-text typo oracle; warnings retain data. Do not silence legitimate preflight to improve completion rate.
- Code-free common path: Use typed Problems/preflight and native Play; preserve warnings/unknown data for deliberate repair.
- Why expansion is out of scope: Guessing opaque authored intent would mutate compatible data; validator is not a gameplay correctness or typo oracle.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0014 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Run Project > Validate Project to confirm covered structured references are checked.
  2. Create an invalid unregistered name-based setup such as a socket/state relationship.
  3. Observe that broader semantic preflight remains incomplete.

Evidence:

  - phase_report: `PHASE-003-REPORT.md` — Bounded validator coverage
  - contract: `PROJECT-VALIDATION-CONTRACT.md` — Validation scope and exclusions.
  - browser_audit: `tools/audit-phase-006.js` — Required-field issue and invalid-draft recovery were verified inline; broader unregistered semantic checks remain outside scope.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0014 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0015 — No guided first-game onboarding

The missing first-game path was reproduced from a clean local profile, then closed with the verified palette-to-export guided journey.

Current workaround: None for the bounded first 3D game journey; richer genre templates remain intentionally outside Phase 009.

Reproduction:

  1. Open the editor with cleared local storage as a first-time creator.
  2. Attempt to build and export a complete small game using only in-product guidance.
  3. Observe that no progressive onboarding path coordinates the steps.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Onboarding reconsidered from D/Poor to A/Good after clean-profile closure.
  - browser_audit: `phase-009-dogfood.json` — Edge clean-profile run verifies first run, Skip, resume, Save/Load, state isolation, Help, and final Playable Export.
  - regression: `tests/phase-009-onboarding.test.js` — Dependency-free regression contract covers the onboarding state and editor/build integration.

### AFR-0016 — Material changes require reapplying to placed copies

Named Capture/Edit & Preview/Apply assets reuse independent material values with portable texture references. Centralized preview editing now exists; shared instance relationships remain absent by the compatibility-preserving copy contract.

Current workaround: Edit and Save the named Material, then Apply to each object that should receive the new appearance. Existing placed objects retain independent values until explicitly updated.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Reapply after library changes is intentional; no live shared-material links. Not automatically a renderer/data-model defect.
- Code-free common path: Capture/Edit/Preview/Apply Material looks; reapply deliberately, leaving placed copies independent.
- Why expansion is out of scope: Live material links contradict the existing copy-ownership contract and change saved/render semantics.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0016 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Give multiple objects the same material settings.
  2. Attempt to edit the shared look once.
  3. Observe that every object owns separate fields.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Materials graded C.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0016 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0017 — Spatial zones are hidden compositions

Audio and fog zones are expressed as actions on generic triggers, so the Palette and Inspector do not present them as recognizable authored objects.

Current workaround: Place Trigger Volume, then know which zone action and fields to add.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: One managed effect per legacy Trigger; no full weather authoring or physical listening claim. Old hidden-only description superseded for supported paths.
- Code-free common path: Use visible Fog/Audio Environment zone setup; distinct effects can use separate colocated Trigger Objects/grouped Prefabs.
- Why expansion is out of scope: A multi-effect weather stack adds new overlap/ownership rules beyond the qualified one-effect Trigger.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0017 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Search the palette for Audio Zone or Fog Zone.
  2. Create one using Trigger Volume and the appropriate action.
  3. Observe that the composition depends on prior knowledge.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Audio Zones and Fog Zones rows.
  - phase_report: `PHASE-008-REPORT.md` — Initial catalog exclusions and bounded-capability rationale.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0017 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0018 — Large-scene hierarchy operations are minimal

The scene tree lacks mature bulk operations, filtering, locking, visibility controls, and clear generated-object ownership.

Current workaround: Operate one selection at a time and use names and groups manually.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: No universal scene locking/bulk reparent/generated ownership/100k-object performance guarantee. Bounded scale tooling.
- Code-free common path: Use Scene filters/flattened matches/visibility/collapse, Collections and reusable Prefabs/Chunks at demonstrated scale.
- Why expansion is out of scope: General locking/bulk reparent/generated ownership/100k-object guarantees require a broader scene/performance contract.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0018 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Open a level with many objects.
  2. Attempt to filter, lock, hide, bulk reparent, and distinguish generated ownership in the scene tree.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Hierarchy graded B with scalability limits.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0018 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0019 — Project save and game save have an unclear mental model

Save Project, project JSON export, and runtime Save Game use different stores and semantics without one clear product explanation.

Current workaround: Learn the distinction through experimentation and action labels.

Reproduction:

  1. Use Save Project, export project JSON, and run a Save Game action.
  2. Reload the editor and exported game.
  3. Compare what each mechanism persisted and where.

Evidence:

  - inventory: `CURRENT-AUTHORING-SURFACE-INVENTORY.md` — Save Game and Export persistence paths.
  - qualification: `qualification/phase-240/CHECKPOINT-20261016T0518.md` — Canonical generated persistence guide repair, native discoverability and actual store boundary evidence.
  - browser_audit: `qualification/phase-240/save-guide-20261016T063651842Z/results.json` — Current source and built package offline anchor/three-store table/shared runtime-origin warning/640px+360px fit/errors[]external[] closed.
  - browser_audit: `qualification/phase-239/gauntlet-flow-20261016T063116205Z/proof.json` — Current37 native observations: exact authoring Save/browser reload/HomeOpen plus actual offline Editable/Playable Autosave/NewGame/Continue/Win/Lose.

### AFR-0020 — Asset import diagnostics are too shallow

Importers provide useful fallbacks but limited structured diagnostics, normalization options, and compatibility preview.

Current workaround: Retry a differently exported asset and inspect the browser console.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: No universal codec/PBR/morph/external-folder/transcoder/decompression-security guarantee; Audio memory cap is after decode. Broad console-only/shallow diagnostics stale for supported formats; normalization expansion not mandatory.
- Code-free common path: Use staged reports/approval for supported embedded models/images/browser Audio; Cancel or re-export unsupported content, retaining original files.
- Why expansion is out of scope: Universal codec/PBR/morph/external-folder/transcoding/predecoder security support adds major decoder and asset semantics.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0020 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Import a model, image, or audio file that is unsupported or malformed.
  2. Inspect the creator-facing result.
  3. Observe that the response does not provide a structured pipeline report with actionable normalization guidance.

Evidence:

  - source: `editor/src/01-editor.js` — Import handlers report compact status errors.
  - browser_audit: `tools/audit-phase-004.js` — Workflow C exercises the current successful import path.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0020 supported evidence and residual boundary; original observations remain unchanged.
  - browser_audit: `qualification/phase-240/import-diagnostics-20261016T065025427Z/results.json` — Current9 native observations: mixed staging/Cancel/one UndoRedo/malformed refusals/recovery/independent Model+Prefab/SaveReload/actual reviewed file tiers; errors[]external[]/resources closed. Universal normalization/codec/security not claimed.

### AFR-0021 — Dogfood A repeats dense capability discovery

Creating a cube is direct, but adding gameplay still requires locating the Behaviors section in the long object Inspector.

Current workaround: Know that Behaviors is the capability-entry surface and scroll to it.

Reproduction:

  1. Drag Cube from the palette into the viewport.
  2. Find Behaviors in Inspector.
  3. Add an On Start Show Message behavior.

Evidence:

  - browser_audit: `tools/audit-phase-004.js` — Workflow A.

### AFR-0022 — Dogfood B repeats dense behavior-entry discovery

The cross-object picker is safe after Phase 003, but reaching it still depends on finding the correct behavior and field inside the Inspector.

Current workaround: Know the action vocabulary and locate its Inspector section.

Reproduction:

  1. Select the newly created object.
  2. Choose Move Object in Behaviors.
  3. Pick another object from the target selector and validate the project.

Evidence:

  - browser_audit: `tools/audit-phase-004.js` — Workflow B; picker and validation succeed.

### AFR-0023 — Imported textures cannot be applied from the asset library

A successful texture import creates a library row, but that row has Rename and Delete only; applying it requires returning to the selected object's Material controls.

Current workaround: None for assigning an existing Texture to one selected Mesh/Billboard: use Assign to selected Mesh in the Texture library. Sprite images remain owned by Sprite Assets; no bulk assignment or new texture channels are claimed.

Reproduction:

  1. Import an image from Assets.
  2. Inspect the new texture row actions.
  3. Return to the object Inspector and assign the texture through Material.

Evidence:

  - browser_audit: `tools/audit-phase-004.js` — Workflow C imports and applies phase-004-proof.png.
  - source: `editor/src/01-editor.js` — Texture library rows expose Rename/Delete; assignment is f-texture in Inspector.

### AFR-0024 — Sequential Sprite Inspector edits could target a replaced component record

In a fresh project, editing multiple Sprite fields and then applying a pivot or direct viewport manipulation could preserve the first edit while silently reverting later edits because mounted controls referenced a component object replaced during synchronization.

Current workaround: None. Synchronization now preserves an existing live canonical component object and only invokes normalization when the component is absent; convenience actions also reacquire the selected component at click time.

Reproduction:

  1. Select one Sprite and edit Width, Height, Opacity, Tint, and Order in Layer sequentially.
  2. Apply a pivot preset, resize in the viewport, and drag the pivot handle.
  3. Before the fix, observe later Inspector values revert; after the fix, all values remain together.

Evidence:

  - source: `editor/src/01-editor.js` — syncSpriteRenderer preserves existing component identity and click callbacks reacquire live state.
  - test: `tests/phase-020-sprite-foundation.test.js` — Regression guards the live-component synchronization path.
  - browser_audit: `phase-020-dogfood.json` — Clean-room reproduction and post-fix multi-field/direct-manipulation rerun.

### AFR-0025 — Trigger Collider 2D detection remains bounded without filtering and multiple volumes

Trigger Collider 2D is separate detection geometry and deliberately does not block. Trigger-only objects do not target each other, v1 allows one Trigger per object, Stay fires every simulation tick, Circle uses the larger XY scale, invisible regions require selection, and all eligible ordinary colliders participate because Layers/Masks are deferred. Phase 048 provides scoped moving-platform carry. Phase 049 provides named geometry-owned mutual filters; remaining multiplicity and Dynamic boundaries are unchanged.

Current workaround: Use ordinary Collider 2D components on targets, attach Behaviors to canonical Trigger 2D events, keep Stay actions bounded, and structure scenes conservatively until filtering lands. Use selected gizmos to author invisible regions. Static/Kinematic Body 2D can now supply physical blocking independently of Trigger detection. Use named Collision Layers and geometry-owned Masks instead of scripts to select eligible 2D pairs.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: One Trigger/object, ordinary Collider targets, tick Stay and larger-XY-scale Circle remain bounded semantics. No multiple-volume schema/general physics claim.
- Code-free common path: Use mutual Layers/Masks and eligible Colliders; multiple volumes can be separate Trigger Objects/grouped Prefabs.
- Why expansion is out of scope: Multiple sensor shapes on one owner and general response alter collision identities/schema beyond049 filtering.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0025 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Add Trigger Collider 2D and an ordinary Collider 2D to separate objects.
  2. Enter Play and observe detection without blocking, including after Kinematic Body 2D motion.
  3. Search for Layers/Masks, Trigger-vs-Trigger targeting, multiple Trigger arrays, or a visual event graph and confirm those are intentionally absent.

Evidence:

  - phase_report: `PHASE-042-REPORT.md` — Qualified detection lifecycle and explicit no-response scope.
  - contract: `TRIGGER-COLLIDER-2D-CONTRACT.md` — Ownership, geometry, and response boundary.
  - seam: `PHASE-043-BODY-TRIGGER-INTERACTION-SEAM.md` — Implemented Body-before-Trigger update order.
  - seam: `PHASE-049-COLLISION-FILTERING-SEAM.md` — Future filtering boundary.
  - contract: `COLLISION-LAYERS-MASKS-CONTRACT.md` — Implemented mutual filtering; broader limitations remain open.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0025 supported evidence and residual boundary; original observations remain unchanged.

### AFR-0026 — Body 2D v1 lacks Dynamic motion and richer contact authoring

Body 2D deliberately exposes only Static and Kinematic roles. Phase 045 adds scoped Character Collision 2D Tilemap consumption and contact state, Phase 046 adds Character-only one-way support surfaces, and Phase 047 adds bounded Character slope and step handling plus support identity. None adds a Dynamic Body, gravity, forces, mass, friction, restitution, collision filtering, a full input/jump/drop-through controller, moving-platform carry, or general collision events. Phase 044's qualification-only gravity model was stable but its Dynamic label would mislead without broader movable-body response. Extreme high-speed/grazing sweeps can conservatively hit the 48-iteration cap; Phase 044 rest tests had no recurring cap. Phase 048 provides scoped moving-platform carry. Phase 049 provides named geometry-owned mutual filters; remaining multiplicity and Dynamic boundaries are unchanged.

Current workaround: Use Static Bodies for obstacles and velocity-driven Kinematic Bodies for moving objects. Add Character Collision 2D for scoped Static/Tile blocking and wall contacts, and a separate Trigger Collider 2D for detection. Author movement separately; do not promise Dynamic stacking or moving-platform carry. Use named Collision Layers and geometry-owned Masks instead of scripts to select eligible 2D pairs.

Accepted limitation (not a claim that the missing feature was implemented):

- Supported boundary: Static/Kinematic/Character is not mass/forces/stacking/general rigidbody physics. Keep explicit boundary; don't promote prototype tests to production capability.
- Code-free common path: Use Static/Kinematic/Character movement, carry, filtering, clips and Triggers; mass/forces/stacking are not equivalent supported games.
- Why expansion is out of scope: 044 explicitly declined canonical Dynamic promotion; a mass-based solver would bypass that utility gate.
- Documentation: Creator Guide docs/generated/index.html#scope-limits; AUTHORING-FRICTION-REGISTER.md AFR-0026 individual rationale; qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md supported evidence and explicit residual.

Reproduction:

  1. Add a Body 2D and inspect its Static/Kinematic type selector and velocity fields.
  2. Move an ordinary Kinematic Body into a Static Body, an ordinary Collider without Static Body, and another Kinematic Body; only the Static Body blocks it.
  3. Add Character Collision 2D and a Tilemap floor, then observe scoped Tile blocking and contact state while Dynamic and general collision events remain absent.

Evidence:

  - contract: `BODY-2D-STATIC-KINEMATIC-CONTRACT.md` — Explicit v1 role and authoring scope.
  - test: `tests/phase-043-static-kinematic-bodies.test.js` — Static response and Kinematic pass-through cases.
  - fuzz: `qualification/phase-043/kinematic-fuzz.json` — Legal-separation and anti-tunneling coverage.
  - utility_gate: `PHASE-044-DYNAMIC-BODY-UTILITY-GATE.md` — Dynamic product promotion rejected after prototype stability, creator-value, and expectation review.
  - fuzz: `phase-044-dynamic-fuzz.json` — Capped sweep and rest-contact evidence.
  - contract: `COLLISION-LAYERS-MASKS-CONTRACT.md` — Implemented mutual filtering; broader limitations remain open.
  - review: `qualification/phase-240/FRICTION-DISPOSITIONS-20261016T0618.md` — AFR-0026 supported evidence and residual boundary; original observations remain unchanged.
