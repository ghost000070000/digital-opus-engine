# Digital Opus Engine — Architecture Overview

## Tilemap v4 object placement and Spawn Markers (Phase 037)

Tilemap v4 adds a top-level `spawnMarkers[]` metadata list. Marker records are independent from ordered visual Layers and contain stable Tilemap-local identity, required name, safe integer cell coordinates, and an optional Prefab-name reference. The runtime exposes immutable query views whose world positions are derived from current cell size and the Tilemap's resolved Entity basis. It performs no automatic spawning.

The editor's Place Object tool is separate: it cell-snaps the existing Prefab instantiation path once, yielding ordinary scene objects with no continuing Tilemap binding. This preserves scene hierarchy, serialization, dependency, and Undo conventions without inventing an object-layer runtime.

## Tilemap v2 multi-layer model (Phase 033)

A Tilemap is one scene object with one Transform, Tileset, Sorting Layer, and Order in Layer. Its canonical version-2 `layers[]` array is stored bottom-to-top; every layer has a Tilemap-local stable ID, unique name, visibility, authoring lock, and its own sparse row-major cell list. Version-1 top-level cells migrate deterministically into `tilemap-layer-default`. Save and exports write layers only.

Editor cell access is explicitly layer-aware and uses one transient index per layer. Active Layer is transient editor state. Runtime resolution flattens visible layers bottom-to-top into one contiguous Tilemap Sprite-pass entity, so no per-layer scene entities, Textures, or timers are created. Collision, auto-tiling, terrain, object layers, layer opacity/tint/parallax/Transform, and per-layer Tilesets remain outside this phase.

The Digital Opus Engine is designed with a core philosophy: **Zero dependencies, single-file bundle distribution, and immediate usability via standard HTML script tags.**

## Architecture Layers

```
+-------------------------------------------------------------------+
|                        Game Application                           |
|      (e.g., dist/delivery-run.html, template, or custom game)     |
+-------------------------------------------------------------------+
                                  |
               Consumes exclusively via window.Opus
                                  v
+-------------------------------------------------------------------+
|                       Public API Surface                          |
|                       (engine/src/22-api.js)                      |
|  Opus.create(), App, Mesh, Terrain, Water, Physics, Camera, HUD   |
+-------------------------------------------------------------------+
                                  |
              Encapsulates & orchestrates engine subsystems
                                  v
+-----------------------+-----------------------+-------------------+
|   WebGL2 Renderer     |   Procedural Systems  |  Audio & Physics  |
| (shaders, VAOs, loops)| (terrain, water, noise| (buoyancy, slope, |
|                       |   particle instancing)|   procedural hum) |
+-----------------------+-----------------------+-------------------+
```

## Build Pipeline & Closure Isolation

- **Source Layout**: Engine source files live in `engine/src/01-vec3.js` through `22-api.js`, arranged in strict dependency order.
- **Build Artifact**: `node build/build.js` concatenates source files into an IIFE closure in `dist/opus-engine.js`.
- **Encapsulation**: Only `window.Opus` is exposed globally. Internal GL context state, raw shader strings, buffer allocations, and VAO pooling are hidden inside the closure.

## Systems & Subsystems

1. **Game Loop (`GameLoop`, `Time`)**:
   - Uses `requestAnimationFrame` with delta time clamping and high-resolution performance counters.
2. **WebGL2 Renderer (`Renderer`, `Shader`, `GLContext`)**:
   - Single Lit Phong shader pass for entities, customized shaders for terrain height/slope vertex colors, sum-of-sines animated ocean water with fresnel tint, and instanced particle billboarding.
3. **Camera System (`Camera`)**:
   - Supports dual modes: debug `orbit` mode for free inspection, and `chase` mode for smooth target entity following with position, yaw, pitch, and look-ahead smoothing.
4. **Physics & Environment (`Physics`, `Terrain`, `Water`)**:
   - CPU-side terrain height sampling (`islandHeight`) and water wave sampling (`sampleWaveHeight`) mirror shader calculations exactly.
   - Terrain collision response handles steep cliff sliding and gentle slope riding.
   - Map perimeter boundary applies soft pushback forces.
5. **Procedural Web Audio (`AudioEngine`)**:
   - Node-recycling vehicle engine hum oscillator, spatial HRTF blips, and procedural game stingers.
6. **HUD & User Interface (`HUD`)**:
   - Zero-dependency DOM overlay rendering FPS, quality toggles, pause screens, title cards, controls overlays, and modal screens.
7. **Ownership and Cleanup (`App`)**:
   - Mesh factories return CPU descriptions. The App privately creates/caches GPU geometry.
   - `destroy()` cancels animation, removes input/resize/visibility listeners, clears scheduled HUD/audio work, releases audio and GPU resources, destroys emitters, and clears scene references.

Game code stays outside the engine IIFE and communicates only through `window.Opus` and its App. Renderer contexts, shaders, programs, buffers, and caches are implementation details.

## How a schema component becomes addable

The editor has one component registry and one generic Add Component/Inspector path. To add a new schema-backed capability:

1. Register its schema with `addable: true`, creator-facing `displayName`, `category`, `help`, eligibility, defaults, and field descriptors.
2. Keep `multiplicity: 'single'` while records use the current one-component-per-schema-ID bag. Internal or automatically managed schemas omit `addable` and stay hidden.
3. Supply `readTarget` / `applyTarget` only when the component needs compatibility or runtime behavior.

The registry automatically provides eligibility filtering, deterministic search/category ordering, duplicate prevention, default creation, generic primitive Inspector controls, validation, Undo integration, Save/Load, prefab/duplicate transport, and export embedding. There is no separate picker catalog or per-component Add button to maintain.

## Current status vs. this document

This document describes the v0.1.0-era engine core and predates the
project's primary product: `editor/` (Crate Run), a no-code game editor
built entirely on the public API described above. glTF import
(`Opus.Mesh.fromGLTF`), touch input (`Input.simulateKeyDown/Up`,
`HUD.addTouchButton`), and a node-graph visual scripting editor have all
since shipped — see the top-level [`README.md`](../README.md) for the
current architecture (editor + engine), and [`ROADMAP.md`](../ROADMAP.md)
for the full build history. This file is kept as engine-core-only
background reading; the README is the up-to-date reference.

## Still out of scope

- OBJ/FBX import (glTF only)
- Networking, sockets, or multiplayer state sync
- 2D Canvas fallback or 2D physics
- Plugin architectures
- TypeScript definitions or npm packaging
# Phase 038 Tilemap Chunk reuse

Tilemap Chunks are versioned `tilemap-chunk` authoring Assets. They capture a zero-based rectangular subset of one Tileset's sparse Tile Layers plus optional Spawn Marker templates. They never own ordinary scene objects, source Tilemap identity, or runtime instances.

The stamp planner clones the target Tilemap, resolves explicit distinct Layer mappings, applies stored Cells with merge-only hole semantics, re-resolves weighted Terrain from destination Layer/coordinates, runs canonical Auto-Tile recomputation across destination boundaries, and allocates fresh marker IDs/names. Commit materializes that exact plan in one editor snapshot transaction. Editable project data retains Chunks; Playable data strips them and carries only materialized Tilemap content.
