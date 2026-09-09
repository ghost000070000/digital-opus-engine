# Digital Opus Engine — Architecture Overview

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
