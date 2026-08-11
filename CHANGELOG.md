# Changelog

All notable changes to Digital Opus Engine will be documented in this file.

## [Unreleased]

### Added
- Formal release roadmap with reliability, developer-experience, content-pipeline, rendering, and 1.0 milestones.
- Dependency-free public API regression suite covering math, procedural sampling, physics, scene/entity ownership, particles, input cleanup, settings, and save slots.
- Real-browser WebGL2 smoke harness covering App rendering, pause/resume, scene ownership, and terminal cleanup.
- One-command build-and-test runner at `node tests/run-tests.js`.

### Changed
- Bundle size remains reported but no longer has a hard 81,920-byte build limit.

## [0.1.0] - 2026-07-30

### Added
- **Public API Surface (`window.Opus`)**: Complete documented entry point (`Opus.create`, `App`, `Mesh`, `Terrain`, `Water`, `Physics`, `AudioEngine`, `HUD`, `Camera`).
- **Playable Demo (`dist/delivery-run.html`)**: 90-second Hovercraft Delivery Run demo game built 100% through the public engine API.
- **Chase Camera System**: Added target entity following with smooth position/rotation lerping and lookahead to `Camera`.
- **Physics Enhancements**: Added `Physics.resolveTerrainCollision` (steep slope cliff sliding & terrain height locking) and `Physics.applyMapBoundary` (soft pushback).
- **Procedural Audio Vehicle Hum**: Added node-recycling `AudioEngine.startEngineHum()`, `updateEngineHum()`, and game stingers (`playPickup`, `playDelivery`, `playWin`, `playLose`, `playBoost`).
- **HUD Primitives & Overlays**: Added `hud.addLabel`, `addPanel`, `showTitleCard`, `showControlsOverlay`, `showWinModal`, `showLoseModal`, `showWarning`.
- **Starter Template**: Added `template/index.html` and `template/game.js`.
- **Tutorial Examples**: Added 5 self-contained HTML examples in `examples/` (`01-hello-scene` to `05-mini-game`).
- **Documentation**: Added `getting-started.md`, `api-reference.md`, `architecture.md`, `API-FRICTION.md`, and `LICENSE`.

### Changed
- Mesh factories now return renderer-independent descriptions; raw WebGL state is private.
- Input, resize, animation, HUD timer, audio timer, particle, scene, and GPU cleanup are App-owned.
- Water sampling returns world-space height and offers surface normals/intensity/foam.
- Pause keeps rendering active while freezing simulation so UI resume remains available.
- Simulation elapsed time and App-created water freeze together while paused.
- Trigger volumes support swept high-speed crossings through an optional previous position.
- Scene removal destroys entities, chase targets clear safely, and post-destroy App calls report useful errors.

### Known limitations
- WebGL2-only; no fallback renderer.
- Developer-preview API may change after v0.1.0.
- Primitive procedural geometry only; no asset importers, editor, mobile/touch controls, or gamepad support.
- One directional light and compact material model.
