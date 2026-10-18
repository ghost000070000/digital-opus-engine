# Digital Opus Engine — Public API Reference (v0.1.0)

All public capabilities are exposed under the global `window.Opus` namespace.

### Advanced editor/runtime host Action extensions

After the editor/runtime has loaded, developer-owned host JavaScript may register an Action while Play is stopped. This is an editor/runtime facade API, not part of the bare rendering-engine bundle.

```js
Opus.ActionExtensions.register('custom_bonus', {
  label: 'Award Host Bonus',
  help: 'Add a bonus using the host application.',
  fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
  exec(params, owner, opus) {
    // Your host implementation. owner may be null for HUD/Sequence callers.
    console.log('Bonus:', params.amount);
  }
});
```

The same Action appears in Behavior, Visual Graph and Sequence search; ordinary authoring/history and canonical dispatch are reused. Graph nodes store fields directly; Behavior/Sequence store params. `Opus.ActionExtensions.list()` returns detached metadata. There is no silent overwrite, unregister, arbitrary condition/value-node callback API or package evaluator. Reload the host page to replace installations. Limit: 32 Actions/page, 16 fields/Action, 64 KiB callback source. Stable IDs match `custom_[a-z][a-z0-9_]{0,63}`. Supported field types: text, number, checkbox, select (1–32 distinct strings), target (Object reference); reserved Graph keys id/type/x/y and prototype keys are refused. Descriptors are copied/frozen. Callbacks receive canonical values and must validate domain-specific constraints; they can have full browser privileges. Exceptions are reported by the existing toast path; asynchronous work and unbounded callbacks remain the host author's responsibility.

Registration revokes Custom Script approval and closes any pending source review. Calls stay disabled until explicit Project permission review/acknowledgement/confirmation; revocation and canonical document loading disable them again. Review shows callback function source, not captured closures or host installation code. This is not a security sandbox or a way to make untrusted HTML safe.

Save/Load, Prefabs and exports preserve Action IDs and parameters, including unavailable implementations and unknown parameters. They **do not serialize/evaluate callbacks or automatically embed host code**. Export review states this limitation. The developer must install matching trusted host code separately in each exported page, then obtain explicit permission before Start. Missing Actions remain inert; Graph nodes and Behavior labels expose retained/unavailable state. Prefer built-in Actions for ordinary self-contained no-code games. This API does not promise closure serialization or automatic plugin/package distribution.

Install the matching host schema **before copying/placing custom-action assemblies** if their Object references need rebinding. With the schema available, declared `target` fields rebind to copied Objects; text, select and unknown parameter values stay unchanged even if they equal an Object ID. Without a matching host schema, custom parameters remain inert, byte-preserved data: references are not guessed. Verify those references before later enabling an installed implementation. Historical built-in copy/remap semantics are unchanged.

### Reusable packages: data versus executable extensions

For ordinary no-code reuse, capture a Prefab and use its palette **Package** button; use **Import** even in an empty Prefab library. This uses the existing integrity-checked Asset Pack, dependency closure and additive keep-both import, not another package format. Import adds library records with one Undo and does not place scene objects. Supported pack media are static Models, PNG Textures and Audio with supported Sprite/Prefab dependencies. Whole scenes/shared logic, other image formats and skinned Models use full Project transfer.

Advanced Prefabs may retain authored Script source or custom Action references as data. Export/import preview explains the boundary; preview/import never execute that code. Importing potential advanced logic disables approval and exposes Project source review; Undo/Redo do not restore approval. Review the complete imported project before explicitly enabling full-page Script permission. Custom Action implementations are still separate host installations, not serialized executable plugins. Prefer built-in Actions for portable no-code packages; there is no automatic plugin installer, marketplace, remote service or hidden evaluator.

### Creator skeletal clip mapping (portable editor metadata)

Select a skinned Cube → Inspector → Animation Clip for a fixed instance clip, or None (bind pose). Disable Auto-Animate for fixed manual ownership; NPC named roles otherwise drive the same Entity clip. Changed valid selection owns one Undo; no-op/Play/invalid/stale edits are refused. Duplicate, actual Prefab placement, Save/reopen and both export types retain the manual selection independently. Unavailable saved numeric indices remain visible for deliberate repair.

Level → Player → Player Visual maps locomotion/attack roles independently of NPCs. Null is **Automatic name matching (legacy)**, not bind pose. Explicit selections add optional `visual.clipMapIdentity[role] = {assetId, name}` beside the retained numeric `clipMap`. No import migration occurs. An explicit Mesh Asset change retains old identities and indices as unavailable until reviewed or deliberately Auto Detected. A unique exact named clip follows reordering within its Asset; missing/ambiguous/different-Asset reviewed mappings remain inert. Legacy unreviewed numeric mappings retain historical behavior, including their index limitations. This metadata is editor/project schema, not a new `Opus` namespace API.

Existing Entity clip changes reuse the skeletal clock and palette sampler. The skinned instance Inspector exposes Skeletal Crossfade seconds (0–10); 0 preserves historical instant cuts. Its optional `animationBlendTime` object record travels through canonical Save, Duplicate, Prefab and both exports; it is not shared Asset metadata. Auto-Animate owns clip selection, while this duration controls transitions between its roles. A fixed clip does not animate a transition merely because a duration was set. Player Locomotion Blend Time remains the existing Level-owned field with historical .15 default. Interrupted fades retain the current local joint pose; ordinary two-clip fades retain their advancing source clock. Phase183 scoped native authoring/Player visual acceptance is qualified; bone/socket world-transform queries are not newly qualified as blended-pose consumers. No root motion, blend tree/layering or animation-event API is introduced by this UX.

### Shared skeletal Animation Events (creator metadata)

Select a skinned instance → Inspector → Animation Events. Choose a clip, its time in seconds and Message, Sound or Fire Player Weapon; parameters reuse the common Action fields. Events belong to the shared Mesh Asset, not an individual instance: Duplicate, Prefab instances and a Player using that Asset receive the same events. Changed fields own Undo/Redo; no-op, invalid, Play and stale-owner mutations are refused. Save and both exports retain the Asset metadata independently.

The existing Entity timeline fires events on forward crossings and wraps; an initial clip switch resynchronizes without retroactive firing, and paused/zero-dt updates do not repeat events. Crossfades use the destination clip's timeline. Legacy authored-array dispatch order is retained; multi-lap frames do not promise multiple occurrences. Unavailable saved clip/time/effect choices remain visible for deliberate repair; malformed records are retained for recovery and skipped at execution, not silently rebound or deleted. These are editor/project records, not a new public event runtime or `Opus` API. Phase184 scoped authoring/history/portable event lifecycle is qualified; integrated full-product readiness remains separate.

### Whole-scene color grading (Scene Look)

Creators use **Level → Environment → Scene Look**, not Custom Script. Optional LDR exposure (-4..4 stops) and saturation (0..2; 0 monochrome, 1 original color) grade the completed scene, including Sprites, water and particles, while leaving DOM HUD text unchanged. Changes have Undo/Redo and travel with the level through Save/Load and Editable/Playable exports.

Public integration: `app.configurePostProcessing({enabled:true, exposure:-1, saturation:0})`; `app.getPostProcessing()` returns detached settings. `app.setEnvironment({postProcessing: settings})` and `app.getEnvironment().postProcessing` use the same implementation. Configuration patches validate atomically; omitted values keep current settings, literal zero is meaningful. `app.getPostProcessingInfo()` reports current target dimensions, MSAA samples and estimated target bytes without exposing GPU handles.

Default disabled and enabled identity settings (exposure0/saturation1) allocate no target or post pass. A changed look uses a full-size color/depth target, retaining up to4 samples where the canvas uses MSAA; resizing and disabling release targets. Byte estimates exclude driver padding and program memory. LDR grading cannot recover clipped highlights; this is not HDR, bloom or physical lighting. Existing projects retain the original look.

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
  - `input.wasPressed(code)`: Historical consuming press queue; only the first read consumes the edge.
  - `input.wasPressedThisFrame(code)`: Non-consuming aggregate physical press observation. Multiple event listeners may read the same edge, even after `wasPressed` consumed it. Holding does not create another edge.
  - `input.endFrame()`: Expires frame observations without clearing held keys or the historical queue. `App` calls this after each update, including paused/error paths; standalone Input hosts own this boundary. `clear()` also clears frame observations.
- `app.audio`: `AudioEngine` instance.
- `app.hud`: `HUD` instance (or `null` if `config.hud === false`).
- `app.settings`: `SettingsManager` instance.
- `app.setQuality('low' | 'high')`: Device-local pixel-density profiles (caps 1×/2×), immediate resize and shared HUD/settings persistence. Does not change authored materials, lights or shadows.
- `app.getQuality()`: Detached inspection of profile, DPR cap, display/applied density, actual canvas width/height and pixel count. The editor Rendering… panel uses this same API. Profiles have identical density on a 1× display; High can render four times as many pixels on a 2× display. Not an FPS guarantee. Local preferences are not project/Prefab history.

Editor viewport: select visible Cubes, static meshes or true Sprites in the Scene list, then **Focus Selected**. This uses public Camera framing and changes only the session's authoring view, not authored Cameras or Undo history. Stop Play and exit explicit Camera View first. Unsupported geometry, overly large groups and views beyond the editor orbit angle/range are refused without changing the view. Editable exports can return from a stopped gameplay camera to the authoring orbit through this command.
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

- `camera.captureMotionState()` / `camera.restoreMotionState(state)`: Versioned **transient** motion journal for preview/rollback, not project JSON. Captures `version:1`, `mode`, independent `target`, `chaseEye`, `chaseTarget`, finite `chaseYaw`, nullable `lastTargetPosition`, `followTarget`, `shakeOffset`, and the original `targetEntity` identity. Restore validates the complete journal before mutation and clones its vectors; it restores smoothed presentation and velocity history without reacquiring the target. Fixed/Chase/obstruction options, projection, clips and orbit controls remain the host's responsibility, restored through existing APIs before restoring motion. An entity destroyed after capture retains its identity until the next normal Camera update safely releases it; fresh `setTarget()` still requires a live entity.

- `camera.computeFraming(worldCorners, {aspect, padding:0.1})`: Pure framing query for at most 4096 finite world-space `Vec3` corners. Aspect must be positive; padding is the fraction of viewport width/height reserved on **each** side, from zero to less than `0.5`. Returns independent `{ok:true, eye, target, up, orthographicHeight, projection, near, far}` settings which a host can apply through the existing fixed-camera/projection controls. Uses the current base orientation before transient shake or obstruction presentation and preserves authored FOV, projection and clip planes. Thus repeated fitting does not bake temporary effects into the authored pose; rendered `eye` and `getBasis()` still include those effects. Empty targets, invalid camera basis/frustum, overflowing geometry or an impossible near/far fit return `{ok:false, reason}`; malformed arguments throw before mutation. Does not change the Camera or corners, maintain target membership or start a follow loop. Perspective fits both horizontal and vertical FOV; orthographic framing uses the actual viewport aspect.

- `camera.mode`: `'orbit'`, `'chase'`, `'fixed'` or `'followLookAt'`.
- `camera.setMode(mode)`: Selects one of those public modes.
- `camera.setTarget(entityOrNull)`: Sets the live entity used for chase following, or clears it with `null`. Invalid or destroyed entities are rejected; destroying the current target clears it safely on the next camera update.
- `camera.setChaseOptions(opts)`: Configures `distance`, `height`, `pitch`, `lerpSpeed`, `rotationLerpSpeed`, `lookAhead`, and optional `bearingMode` (`followTarget` default or `fixed`) / `bearingYaw` (radians).
- `camera.setObstructionOptions({enabled, radius, padding})`: Opt-in Chase-only eye clearance. Defaults are disabled, radius `0.25`, padding `0.05`; positive finite radius and nonnegative finite padding. Does not change authored eye, follow distance or Player position. Fixed, followLookAt and editor orbit remain unchanged.
- `camera.setObstructionQuery(queryOrNull)`: Install a read-only world query `(originVec3, desiredEyeVec3, radius) => nearestDistanceOrNull`. Inputs are independent copies. The getter resolves the final rendered eye against fresh geometry, after controller/scenery updates; return null when unobstructed. Invalid distances fail explicitly. The editor supplies its ordinary visible solid legacy box/sphere candidates, excluding Player, hidden/destroyed objects and ramps. Common creators use the Camera Inspector's **Avoid solid obstacles** instead of code.
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
- `Opus.Physics.cameraObstructionDistance(origin, desiredEye, radius, obstacles)`: Stateless finite-segment nearest entry distance or null. Candidates are `{shape:'box',center:Vec3,half:Vec3,quat:Quat|null}` or `{shape:'sphere',center:Vec3,radius:number}`. Box/sphere bounds expand by clearance; box corners are conservative. Malformed candidates and expanded bounds containing the origin are ignored. Caller owns visibility/solid/target filtering. No target depenetration, terrain/ramp/triangle-mesh, modern XY Collider, or full-frustum clipping guarantee; choose clearance appropriate to framing.

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
# Planar 2D lighting

In Level → Environment, enable **2D Lighting (XY)** and lower Ambient (0–1). Drag a Point Light into the scene for a torch, or a Spot Light for a cone. Use ordinary light color, intensity, range, position and direction controls. Light Prefabs are captured in the Light Inspector and use the existing reusable object format.

`app.configureLighting2D({enabled:true,ambient:0.1})`, `app.getLighting2D()` and `environment.lighting2D` share the editor/export representation. Configuration is an atomic validated patch; getters are detached. Disabled by default; legacy projects remain flat. It affects all Sprite and Tilemap artwork, not 3D materials or DOM HUDs. Ambient zero is supported.

Stylized illumination uses world XY distance and projected Spot direction; Z is deliberately ignored. Squared radial falloff uses the existing bounded Point/Spot light selection. A Spot direction with no XY component emits no planar light. No normals, specular, wall shadows or occlusion. Texture alpha, opacity and sorting remain unchanged. No additional framebuffer/pass; cost scales with the existing capped lights and affected fragments. Scene Look grading, if enabled, runs afterwards.
