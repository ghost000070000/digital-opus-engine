# API Friction Log

Every time building the demo (or an example/template) needed something the public `Opus` API couldn't cleanly do, that friction was recorded here and resolved in `engine/src/` before continuing.

---

## Dogfooding Discoveries & Public API Solutions (v0.1.0)

### 1. Camera Target Following
- **Demo Need**: Hovercraft driving required a third-person chase camera smoothly following the vehicle's position and orientation.
- **API Limitation**: `Camera` only provided Orbit mode controlled by mouse drag / arrow keys.
- **Workaround Rejected**: Manipulating camera internals (`camera.yaw`, `camera.target`) directly in demo tick code.
- **Public API Change**: Added `camera.setMode('chase' | 'orbit')`, `camera.setTarget(entity)`, and `camera.setChaseOptions({ distance, height, lerpSpeed, rotationLerpSpeed, lookAhead })` to `Camera`.
- **Result**: Demo game code calls `app.camera.setTarget(craft)`; target replacement and restart reset chase state to the live target while ordinary following remains smoothed.

### 2. Terrain Slope Collision & Sliding
- **Demo Need**: Hovercraft needed to drive over gentle island hills but slide smoothly along steep cliffs without penetrating ground or hard-stopping.
- **API Limitation**: `Physics` only provided `sampleWaveHeight` and `applyBuoyancy`.
- **Workaround Rejected**: Duplicating terrain height finite-difference math inside `21-game.js`.
- **Public API Change**: Added `Physics.resolveTerrainCollision(position, velocity, radius, terrainOpts)` returning `{ collided, grounded, steep, terrainHeight, slopeRadians, normal, correctedPosition, correctedVelocity }`.
- **Result**: Generic physics collision response is reusable across any Opus game.

### 3. Soft Map Boundary Pushback
- **Demo Need**: Hovercraft needed to stay within the island perimeter with soft pushback and HUD boundary warning.
- **API Limitation**: No boundary helper in engine physics; the first helper draft also accumulated inward velocity on every repeated edge sample.
- **Workaround Rejected**: Hard teleporting or custom demo boundary checks.
- **Public API Change**: Added `Physics.applyMapBoundary(position, velocity, radius, boundaryRadius)` returning pushback vectors and warning intensity.
- **Result**: Bounded, convergent pushback with stable warning intensity and no hard teleport.
- **Compatibility Impact**: Same return shape; pathological repeated edge calls no longer accelerate inward without bound.

### 4. Vehicle Engine Sound & Node Recycling
- **Demo Need**: Hovercraft needed dynamic engine hum pitching up/down based on speed and throttle.
- **API Limitation**: `AudioEngine` only supported single-shot `playBlip` and ambient noise drone. Creating new oscillators every frame caused audio glitches.
- **Workaround Rejected**: Direct Web Audio `AudioContext` node creation in demo code.
- **Public API Change**: Added `audio.startEngineHum()`, `audio.updateEngineHum(pitchRatio, volume)`, `audio.stopEngineHum()` with internal Web Audio node recycling.
- **Result**: Smooth engine hum with zero audio node allocations per frame.

### 5. Game HUD Primitives & Modals
- **Demo Need**: Crates counter, timer, title overlay, controls overlay, win/lose modal dialogs.
- **API Limitation**: `HUD` only had static FPS/Pause/Quality buttons.
- **Workaround Rejected**: Direct DOM manipulation in game script.
- **Public API Change**: Added `hud.addLabel`, `hud.addPanel`, `hud.showTitleCard`, `hud.showControlsOverlay`, `hud.showWinModal`, `hud.showLoseModal`, `hud.showWarning`.
- **Result**: Clean UI primitives managed entirely via public engine methods.

### 6. Mesh Creation Leaked the Rendering Context
- **Demo Need**: Assemble a procedural hovercraft and tutorial objects without bypassing the engine.
- **API Limitation**: Primitive factories required `app.gl`, which exposed the raw WebGL2 context and GPU objects.
- **Workaround Rejected**: Treating the renderer context as a supported game API.
- **Public API Change**: `Opus.Mesh.*` now returns shareable CPU-side descriptions; `App` privately materializes and caches GPU geometry when an entity enters its scene.
- **Result**: Demo, template, and examples create geometry without renderer access.
- **Compatibility Note**: Pre-0.1 preview calls such as `Opus.Mesh.cube(app.gl)` must drop the context argument.

### 7. Visible Water Sampling Was Static-Only
- **Demo Need**: Hover on the exact animated surface and blend smoothly across shorelines.
- **API Limitation**: Sampling required passing internal wave data and returned only a local displacement.
- **Workaround Rejected**: Copying shader wave equations into the game.
- **Public API Change**: Water handles provide world-space `sampleHeight` and `sampleSurface` methods; the latter also returns normal, intensity, and foam factor.
- **Result**: Gameplay and rendering use one wave definition.
- **Compatibility Note**: The static `Opus.Water.sampleHeight(handle, x, z, time)` remains supported but now returns world-space height.

### 8. Restart and Destruction Could Duplicate Work
- **Demo Need**: Repeated restarts, pause/resume, and teardown without stacked loops, listeners, audio, or particles.
- **API Limitation**: Input and resize listeners were anonymous, loop starts could queue duplicate frames, and GPU cleanup used cross-type WebGL probes that throw in Chromium before scene teardown completes.
- **Workaround Rejected**: Demo-side listener bookkeeping and page reloads.
- **Public API Change**: App-owned input/context/loop/audio/HUD/particle/GPU lifecycles now have idempotent cleanup; `onUpdate` and `onPauseChange` return unsubscribe functions.
- **Result**: Restart resets game objects in place and `app.destroy()` releases engine-owned work.
- **Compatibility Note**: `pause()` now pauses simulation while keeping the render loop alive so the public controls can resume it.

### 9. Seeded Mission Placement Needed Slope Queries
- **Demo Need**: Place five reachable crates and a delivery zone deterministically without steep or overlapping locations.
- **API Limitation**: Terrain exposed height but not a reusable public normal query.
- **Workaround Rejected**: Finite-difference sampling in demo code.
- **Public API Change**: Added `Terrain.sampleNormal` plus handle-level `sampleNormal`.
- **Result**: Placement rejection uses public terrain slope data and reproduces from one seed.
- **Compatibility Note**: Additive API; existing terrain sampling remains supported.

### 10. Fast Craft Could Skip Small Triggers
- **Demo Need**: Boosted movement must collect a crate even when one frame begins before and ends beyond its trigger sphere.
- **API Limitation**: `TriggerVolume.update(position)` only tested the final point.
- **Workaround Rejected**: Enlarging demo triggers or duplicating segment/sphere intersection math in the game.
- **Public API Change**: `TriggerVolume.update(position, previousPosition)` now performs a swept segment test while retaining the one-argument form.
- **Result**: Fast crossings emit one enter and one exit without duplicate scoring.
- **Compatibility Impact**: Additive optional argument; existing callers are unchanged.

### 11. Removed Entities Remained Usable as Camera Targets
- **Demo Need**: Restart replaces the hovercraft while chase mode is active without following stale scene state.
- **API Limitation**: Scene removal only spliced an array, and camera targets had no liveness contract.
- **Workaround Rejected**: Reaching into camera fields or maintaining demo-only tombstones.
- **Public API Change**: Entities expose a read-only-by-convention `destroyed` state; scene removal/clear destroys owned entities, and `Camera.setTarget` rejects destroyed targets and accepts `null`.
- **Result**: Target removal and replacement are deterministic and cannot produce stale chase transforms.
- **Compatibility Impact**: Removed entities are now terminal instead of reusable; callers should create a replacement entity.

### 12. Pause Advanced the Public Game Clock
- **Demo Need**: A 90-second mission and boost cooldown must not be consumed while paused.
- **API Limitation**: The update callback's `elapsed` value came from wall-clock loop time even though updates were paused.
- **Workaround Rejected**: Maintaining a second demo-owned clock that could drift from water and engine simulation.
- **Public API Change**: App callbacks and App-created water now share an App-owned simulation clock that advances only during active updates.
- **Result**: Pause/resume preserves timer, cooldown, animation, and visible/sampled water phase together.
- **Compatibility Impact**: `elapsed` now means simulation time, not wall time; this corrects the documented pause behavior.
