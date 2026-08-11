# Digital Opus Engine — Public API Reference (v0.1.0)

All public capabilities are exposed under the global `window.Opus` namespace.

---

## 1. Top-Level Namespace (`Opus`)

- `Opus.VERSION` (`string`): Engine semver string (`"0.1.0"`).
- `Opus.create(canvas, config)` -> `App`: Creates an engine instance bound to an HTML `<canvas>`.
  - `canvas`: `HTMLCanvasElement`.
  - `config.dprCap` (`number`): Max device pixel ratio cap (default `2`).
  - `config.autoStart` (`boolean`): Automatically start render loop (default `true`).
  - `config.hud` (`boolean`): Enable built-in HUD controls (default `true`).
- `Opus.screenshot(canvas, filename)`: Triggers immediate PNG canvas capture and browser download.
- `Opus.App`: Exported App constructor. Prefer `Opus.create(...)` for normal construction.

---

## 2. Engine App Lifecycle (`App`)

The object returned by `Opus.create(canvas)`:

- `app.scene`: `Scene` instance.
- `app.camera`: `Camera` instance.
- `app.input`: `Input` instance.
- `app.audio`: `AudioEngine` instance.
- `app.hud`: `HUD` instance (or `null` if `config.hud === false`).
- `app.settings`: `SettingsManager` instance.
- `app.save`: `SaveSystem` instance.
- `app.addEntity(opts)` -> `Entity`: Creates and registers a lit 3D entity.
- `app.createTerrain(opts)` -> `Terrain`: Generates procedural island heightfield & adds to render loop.
- `app.createWater(opts)` -> `Water`: Creates animated sum-of-sines water surface & adds to render loop.
- `app.createEmitter(opts)` -> `ParticleEmitter`: Creates GPU-instanced particle emitter & adds to simulation.
- `app.onUpdate(fn)`: Registers per-frame callback `(dt, elapsed) => void` and returns an unsubscribe function. `elapsed` is simulation time and does not advance while paused.
- `app.onPauseChange(fn)`: Observes pause/resume and returns an unsubscribe function.
- `app.start(update?)`: Starts rendering and optionally registers an update callback.
- `app.pause()` / `app.resume()`: Pauses or resumes simulation while rendering continues.
- `app.resize()`: Recalculates canvas viewport and size.
- `app.screenshot(filename)`: Captures safe PNG screenshot after next frame render.
- `app.destroy()`: Cleans up WebGL context, DOM nodes, audio nodes, and event listeners.

`destroy()` is idempotent. After destruction, creation, registration, loop, resize, and screenshot methods throw a descriptive error; a second `destroy()` is a safe no-op.

---

## 3. Math (`Opus.Vec3`, `Opus.Mat4`)

### `Opus.Vec3`
- `constructor(x, y, z)`
- `add(v)`, `sub(v)`, `scale(s)`, `dot(v)`, `cross(v)`, `length()`, `normalize()`, `clone()`, `set(x, y, z)`
- Static: `Vec3.lerp(a, b, t)`

### `Opus.Mat4`
- `Mat4.identity()`, `Mat4.perspective(fovY, aspect, near, far)`, `Mat4.lookAt(eye, target, up)`, `Mat4.multiply(a, b)`, `Mat4.compose(pos, rotY, scale)`

---

## 4. Camera (`Opus.Camera`)

- `camera.mode`: `'orbit'` or `'chase'`.
- `camera.setMode(mode)`: Sets mode (`'orbit'` vs `'chase'`).
- `camera.setTarget(entityOrNull)`: Sets the live entity used for chase following, or clears it with `null`. Invalid or destroyed entities are rejected; destroying the current target clears it safely on the next camera update.
- `camera.setChaseOptions(opts)`: Configures `distance`, `height`, `pitch`, `lerpSpeed`, `rotationLerpSpeed`, `lookAhead`.
- `camera.screenPointToRay(ndcX, ndcY, aspect)`: Reconstructs world-space ray from normalized device coordinates.

---

## 5. Mesh Primitives (`Opus.Mesh`)

- `Opus.Mesh.cube()`: Shareable 1x1x1 unit-cube description.
- `Opus.Mesh.plane()`: Shareable 1x1 XZ-plane description.
- `Opus.Mesh.grid(size, segments)`: Shareable subdivided-grid description.
- `Opus.Mesh.fromArrays(positions, normals, indices)`: Custom indexed mesh description. Arrays are retained and must not be mutated.

Mesh descriptions never expose a WebGL context, buffer, or vertex-array object.

---

## 6. Terrain (`Opus.Terrain`)

- `Opus.Terrain.generate(opts)`: Validates and returns a procedural-terrain description.
- `Opus.Terrain.sampleHeight(x, z, terrainOrOpts)`: CPU heightfield lookup; out-of-map queries safely return the ocean floor.
- `Opus.Terrain.sampleNormal(x, z, terrainOrOpts)`: Heightfield normal.
- A handle from `app.createTerrain(opts)` also provides `sampleHeight(x,z)` and `sampleNormal(x,z)`.

---

## 7. Water (`Opus.Water`)

- `Opus.Water.createSurface(opts)`: Validates and returns a water description.
- `Opus.Water.sampleHeight(water, x, z, time)`: Exact world-space visible height.
- `Opus.Water.sampleSurface(water, x, z, time)`: Returns `{ height, normal, intensity, foamFactor }`.
- A handle from `app.createWater(opts)` provides matching `sampleHeight` and `sampleSurface` methods.

---

## 8. Physics Utilities (`Opus.Physics`)

- `Opus.Physics.resolveTerrainCollision(position, velocity, radius, terrainOpts)`: Tests height/slope, redirects velocity along steep cliffs, pushes position out of terrain. Returns `{ collided, grounded, steep, terrainHeight, slopeRadians, normal, correctedPosition, correctedVelocity }`.
- `Opus.Physics.applyMapBoundary(position, velocity, radius, boundaryRadius)`: Soft perimeter pushback vector. Returns `{ warning, intensity, correctedPosition, correctedVelocity }`.
- `Opus.Physics.applyBuoyancy(entity, water, time, opts)`: Floats entity on wave surface.
- `Opus.Physics.TriggerVolume`: Proximity trigger zone with `onEnter` and `onExit` callbacks. Call `trigger.update(position, previousPosition)` for swept high-speed detection; the second argument defaults to `position`.
- `Opus.Physics.raySphere`, `Opus.Physics.rayAABB`, `Opus.Physics.sphereSphereIntersect`.

---

## 9. Particle Emitters (`Opus.ParticleEmitter`)

- `new Opus.ParticleEmitter(opts)`: Configures GPU-instanced particle system (`position`, `rate`, `life`, `riseSpeed`, `spread`, `size`, `color`, `gravity`, `maxParticles`).

---

## 10. Audio Engine (`Opus.AudioEngine`)

- `audio.resume()`: Unlocks browser Web Audio Context.
- `audio.startEngineHum()`, `audio.updateEngineHum(pitchRatio, volume)`, `audio.stopEngineHum()`: Recyclable procedural vehicle hum oscillator.
- `audio.playPickup()`, `audio.playDelivery()`, `audio.playWin()`, `audio.playLose()`, `audio.playBoost()`: Procedural web audio stingers.
- `audio.playBlip({ frequency, duration, type, position })`: Positional or 2D audio blip.
- `audio.setMuted(muted)`: Toggles global audio mute.

---

## 11. HUD Primitives & Save System (`Opus.HUD`, `Opus.SaveSystem`)

- `hud.addText`, `addLabel`, `addCounter`, `addTimer`, `addSpeed`, `addObjective`, `addPanel`, `addButton`
- `hud.showTitleCard(opts)`, `hud.showControlsOverlay(opts)`
- `hud.showWinModal(opts)`, `hud.showLoseModal(opts)`
- `hud.showWarning(text, intensity)`, `hud.clearWarning()`
- `hud.showMessage(text, duration)`
- Primitive handles support `update`, `show`, `hide`, and `remove`.
- `save.save(slot, data)` / `save.load(slot)`: Persistence across browser sessions.

## 12. Scene and Entity Ownership

- `new Opus.Entity(opts)`: Creates a CPU-side entity with public transform, color, mesh, visibility, and `destroyed` state.
- `scene.add(entity)`: Adds a live `Entity`; invalid and destroyed values are rejected.
- `scene.remove(entity)`: Removes and destroys the entity. Returns `true` when present, otherwise `false`.
- `scene.clear()`: Destroys and removes every entity.
- `entity.destroy()`: Idempotently marks the entity destroyed and invisible; subsequent `update()` calls are safe no-ops.
