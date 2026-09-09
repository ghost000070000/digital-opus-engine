# Capability Expansion Wave 3 — Report

This covers the Wave 3 specification, picked up after Wave 2's own report (`CAPABILITY-WAVE-2-REPORT.md`) closed out with a list of independent subsystems left unstarted: Asset Library, texture/material support, audio file assets, export tiers, and the vertical-physics/platformer gate. Wave 3 targeted exactly that list, plus everything downstream of it (branching Dialogue, Node Graph pan/zoom, Level Transitions/Stable IDs/format versioning, Waypoint/Patrol AI, Spawner polish, and four new stress games). A separate, explicitly-scoped Editor UI/UX Rearchitecture pass ran between the texture/audio work and the rest of this list, at the user's direction, and is documented on its own in `EDITOR-UI-REARCHITECTURE-REPORT.md` — it is not counted as a Wave 3 capability here, since it deliberately added no new engine/gameplay capability. Every item below reflects what was actually built and verified in this session, not aspiration.

## Capability matrix

| Item | Status | Notes |
|---|---|---|
| Texture support (per-face UVs, `App.createTexture`/`destroyTexture`, `entity.texture`) | BUILT | One base-color texture per entity, multiplied into existing lighting; no PBR maps, no multi-layer |
| Editor: Texture Asset Library | BUILT | Import (file or glTF-embedded), async-decode-bridged, usage-count-gated delete |
| Audio asset pipeline (`AudioEngine.decodeAudio`, `playBuffer`) | BUILT | Browser-native decode — whatever the browser itself supports (mp3/wav/ogg) just works, no bundled codec |
| Editor: Audio Asset Library | BUILT | Import/Preview/Rename/usage-count-gated Delete, same async-bridge shape as textures |
| Play Sound 2.0 (Mode: Synth / Asset) | BUILT | Pre-2.0 behaviors with no `.mode` fall through to Synth unchanged |
| Per-level Ambient Audio | BUILT | Loops on Play and on every mid-play level switch, never stacks |
| Dialogue system upgrade: branching conversations | BUILT | Named entries, up to 3 choices each, optional jump/flag/condition per choice; original single-screen `showDialogue` untouched alongside it |
| Interact double-trigger fix | FIXED | Touch Interact button could re-fire a behavior while the game was paused (dialogue open); keyboard path was already safe. See API-FRICTION.md #54 |
| Export Tiers (Project / Editable Game / Playable Game) | BUILT | One shared `buildExportHTML` builder, not three maintained pipelines; Playable tier permanently locks out the embedded editor |
| Export metadata (Title/Author/Version/Description) | BUILT | Title becomes the exported file's `<title>`; round-trips through save/load/export |
| Export size safety warning | BUILT | Non-blocking; flags anything over 15MB |
| Node Graph pan/zoom + Fit + Reset View | BUILT | Pure CSS transform over the existing DOM node layer; node coordinates on disk unaffected, view state never serialized |
| Gamepad utility gate, re-confirmed for Jump | CONFIRMED_NO_NEW_CODE | Existing generic key-code mapping already covers Jump for free (shares the `Space` keycode with Boost, only one controller ever active) |
| Fixed inspector panel overflow (`.field-triple` layout, Custom Script summary truncation) | FIXED | Reported live by the user; two distinct layout bugs, not one |
| Vertical Character Physics Gate (gravity/jump/grounded state) | PASSED | Opt-in per level (Jump checkbox), Third-Person controller only; new engine primitive `Opus.Physics.resolveVerticalBoxCollision` for landing on solid platforms. See API-FRICTION.md #49 |
| Waypoint object + AI Patrol Route (Loop / Ping-Pong) | BUILT | Reuses the cube+flag pattern (`isWaypoint`), no new item kind; found and fixed a real pre-existing serialization gap (`ai.targetId`/`waypointNames` were silently dropped on save) along the way |
| Spawner polish (Initial Delay, per-spawn Tag, Reset Spawner) | BUILT | Composes directly with the existing Object Tags system |
| Level Transitions (Instant / Fade) | BUILT | Real wall-clock timing, works identically whether or not the game happens to be paused when it fires |
| Stable Level IDs | BUILT | Every level gets a permanent id; Duplicate Level regenerates fresh ids and remaps every internal object reference |
| Project format versioning + single migration path | BUILT | `{format, version}` stamped on export; one `normalizeProjectData()` replaces three separately-inlined shape checks, rejects unrecognized newer versions with a clear error |
| Project Asset Library (mesh dedup) | BUILT | Import Model creates a reusable asset (one GPU mesh, N placements) instead of embedding a full geometry copy per instance |
| Fixed Standalone Export regression (stale `<script>`-tag replace) | FIXED | This session's own dev-cache-busting fix had silently broken export's string-replace; regex now anchored on a unique comment, not a generic tag |
| `usedPrefabNames` never recognized a Spawner's own prefab reference | FIXED | Export would have silently shipped a Spawner-based level with `prefabs: []` — works in the authoring session, spawns nothing on a fresh machine. See API-FRICTION.md #56 |
| Loading a second project after importing any asset silently wiped the new project's objects | FIXED | Real, serious, previously-undiscovered load-ordering bug, found during the final sweep — see API-FRICTION.md #57 |
| Final regression/performance/asset-dedup-scale/spawn-destroy-torture/touch sweep | VERIFIED | All 9 shipped games regression-clean; 301-object scene serializes ~2ms/loads ~13ms/0.048ms-per-frame update cost; 100-instance mesh dedup ~93% export-size savings; ~4,000 Spawner spawn events across 800 cycles with zero leaked entities; touch-dispatched Interact/Dialogue/Node-Graph-pan all confirmed pixel-exact |
| `ONNX_NOT_JUSTIFIED_YET`, re-affirmed | VERDICT | Every system built this wave remains deterministic and rule-based by construction — see verdict section below |

## Stress-game results

| Game | Systems stressed | Result |
|---|---|---|
| `skyway-trial.json` — Skyway Trial | Vertical Physics Gate: Third-Person + Jump, 5-platform staircase, Fall Zone | Verified both ways (Win by clearing the staircase, Lose by falling) after a fresh round-trip. Surfaced `computeSpawnPoint()`'s terrain/water-only ground assumption — API-FRICTION.md #51 |
| `textured-adventure.json` — Textured Adventure | 3 distinctly-textured Relics, textured Hazard, texture-gated Shrine, HUD | Verified both Win and Lose paths, all 3 imported textures survive a fresh round-trip via the async decode bridge |
| `survival-arena-3.json` — Survival Arena 3 | Real Spawner object (replacing Wave 2's hand-wired Delay-chain), hidden Delay-based survival timer | Verified end-to-end; building/exporting this file is what surfaced and proved the fix for the Spawner-prefab-bundling bug (finding #56) |
| `npc-puzzle-adventure.json` — The Sanctum Key | Branching Dialogue + a separate flag-gated Node Graph on the same NPC, Inventory, solid Door, Tween, Camera change, 2-level transition — no Custom Script | Verified the complete chain end-to-end (dialogue → flag → key grant → door tween → camera swap → level transition → win) live and after a fresh round-trip |

## What was actually verified (not just written)

Every BUILT/FIXED/PASSED/CONFIRMED item above was exercised live in a real browser against the real editor code paths — placing objects through the actual editor UI and data structures (never hand-authored JSON, never an internals bypass), entering real Play sessions, and reading back real resulting state (position, health, inventory, flags, HUD DOM, console). Deterministic techniques established and reused throughout (mocked gamepads, synthesized real WAV/PNG assets in-browser, direct `simElapsed`/`tickTweens`/`tickSpawners`/`processPendingDelays` advancement in place of unreliable real-time waits, real dispatched touch `PointerEvent`s) are documented inline in CHANGELOG.md and, where they surfaced a genuine product bug rather than just a test-methodology note, in API-FRICTION.md (findings #49, #51, #54, #56, #57 all trace to this wave). `node tests/run-tests.js` (23 dependency-free public-API tests) stayed green after every change, checked repeatedly through the whole wave, and never regressed — including immediately after both real-bug fixes (#56, #57) landed.

## ONNX verdict

`ONNX_NOT_JUSTIFIED_YET` — reviewed every system built across Wave 3 (textures, the audio asset pipeline, branching Dialogue with conditional gating, Export Tiers, Node Graph pan/zoom, vertical physics, Waypoint/Patrol AI, Spawner polish, Level Transitions, the Asset Library, and the final sweep) for anything that would genuinely benefit from local ONNX inference — classification, generation, embedding/similarity, or any learned decision a fixed rule can't already express. None qualifies: texture/audio/mesh assets are author-imported and browser-decoded, not classified or generated; Dialogue branching is deterministic condition evaluation (flags/items/health/counters), the same category of logic every other condition in this engine already uses; Export Tiers, Node Graph pan/zoom, and the Asset Library are pure editor tooling with no runtime decision-making at all; vertical physics and AI Patrol are direct-steering/kinematic, not learned. Every system this engine has shipped, across Wave 2 and Wave 3 both, remains deterministic and rule-based by construction.

## Final verdict

`CAPABILITY_WAVE_3_QUALIFIED_WITH_BOUNDED_GAPS`

Rationale: every item Wave 2's own report listed as left over — Asset Library, texture/material support, audio file assets, export tiers, and the vertical-physics/platformer gate — is now BUILT and PASSED. Downstream work opportunistically completed alongside it (branching Dialogue, Node Graph pan/zoom, Level Transitions, Stable Level IDs, format versioning, Waypoint/Patrol AI, Spawner polish) is also BUILT. Four new stress games (one per major new capability cluster: vertical physics, textures, the Spawner rebuild, and a Dialogue/Inventory/Tween/multi-level puzzle-adventure) were built through real editor functions and verified end-to-end, including fresh round-trips. Two real, previously-undiscovered bugs were found and fixed along the way by this wave's own dogfooding discipline rather than shipped silently: the Spawner-prefab export-bundling gap (#56) and the far more serious cross-project asset-library load-ordering bug (#57), the latter caught only because the final sweep deliberately tested realistic multi-project session behavior rather than each feature in total isolation — a good argument for why that sweep belongs at the end of every wave, not just this one. What remains open going into a future wave: multiplayer/networking (explicitly out of scope per ROADMAP.md, its own direction-setting conversation), a Spawn Point object / solid-ground-aware `computeSpawnPoint()` (flagged, not fixed, in #51), and general performance headroom beyond the ~300-object scale actually measured this pass (no evidence of a problem at that scale, but untested materially beyond it). Crate Run, the regression anchor, and all 9 shipped stress games were reverified working end-to-end at the close of this wave, with zero console errors throughout.

Per explicit instruction, Wave 4 does not begin automatically after this report.
