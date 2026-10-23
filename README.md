# Digital Opus Engine

A zero-dependency, vanilla-JavaScript WebGL2 game engine — and, built entirely on top of its own public API, a no-code drag-and-drop game editor for browser mini-games, with 28 example games.

```bash
node tools/dev-server.js
```
then open `http://localhost:8837/editor/index.html`. The start screen offers **Start Blank** (a playable scene with ground, a player start and a third-person character), a guided tour, playable starters and the example games; press **?** in the editor for every keyboard shortcut.

`file://` won't reliably work for the editor (module loading and some browser APIs need a real origin) — serve it over HTTP. The public site build lives in `dist/engine-site` (see Build & test).

## Editor at a glance

- **Scene view like Unity**: right-drag to look and fly with WASD/QE, middle-drag pan, Alt-drag orbit, proportional zoom, F to frame, Shift+1…9 / 1…9 saved views, Play From Here (Shift+P).
- **Placing and arranging**: drag from the Objects palette, the Content Library (with thumbnails) or straight from the desktop (models, images); objects rest on whatever is under the cursor; move-gizmo plane handle, hold Ctrl to snap, hold V to snap corners, End to drop to the surface; precise click selection.
- **Editing many things at once**: copy/cut/paste across levels and projects (assets travel along), multi-object Inspector (shared transform, colour, align, distribute, randomize), copy/paste logic, select similar, drag-to-scrub number fields, Hierarchy rename/focus/context menu, Undo keeps the selection.
- **Gameplay without code**: Behaviors with searchable actions, 🎯 pick targets in the scene, logic arrows in the viewport, Requires-item (keys, locks), Physics Objects (fall, push, bounce, roll) with On Object Enter/Exit, and ready-made pieces: Physics Crate/Ball, Pressure Plate + Door, Jump Pad, Teleporter Pair, Finish Line, Key + Locked Door, Coin Trail and Countdown Timer, which add their own HUD.
- **Code when you want it**: a per-object Script component with lifecycle hooks, autocomplete, a Script Console and physics access (`ctx.kick`, `onObjectEnter`).
- **Visual logic and animation**: Visual Graphs with live debugging and a project Variables panel with safe rename; a docked animation timeline where you pose objects in the scene and key them.
- **Durable saves and sharing**: projects live in IndexedDB; export a single-file Playable or Editable HTML game.

Everything new is listed in [`CHANGELOG.md`](CHANGELOG.md).

---

## What this actually is

Two things, deliberately built as one:

1. **The engine** (`engine/src/`) — a from-scratch WebGL2 engine: renderer, procedural terrain/water, physics, particles, procedural audio, save/settings, a DOM-based HUD, and a glTF importer. Zero runtime dependencies, one `<script>` tag, nothing else to install.
2. **The editor** (`editor/`) — a drag-and-drop, no-code-as-far-as-feasible game builder, built *using only* the engine's own public `window.Opus` API. It is not a special-cased tool with private engine access; every editor capability had to earn its way into the public API first (see [`API-FRICTION.md`](API-FRICTION.md)).

The editor is the actual product. The engine is the proven runtime underneath it, kept fully public and documented so it's useful standalone too — but "no-code as far as feasible" is the real goal, not "ship a JS library."

**"As far as feasible" is a real constraint, not a slogan.** Unity hasn't achieved fully code-free game creation with orders of magnitude more resources than this project has. The honest target: push placement, configuration, and common game logic as far into visual, drag-and-drop territory as is actually achievable — and give logic that doesn't fit a clearly-labeled scripting escape hatch, rather than pretending everything is reachable without code.

---

## Architecture

```
+-------------------------------------------------------------------+
|  editor/  — Crate Run (game + no-code editor hybrid)              |
|  Built entirely through window.Opus, same as any external user.   |
|  Owns: placement, drag-to-move, multi-select, marquee-select,     |
|  behaviors (fixed dropdown + node-graph + Custom Script escape    |
|  hatch), undo/redo, save/load, export, touch controls.            |
+-------------------------------------------------------------------+
                                  |
               Consumes exclusively via window.Opus
                                  v
+-------------------------------------------------------------------+
|                       Public API Surface                          |
|                       (engine/src/22-api.js)                      |
|   Opus.create(), App, Mesh, Terrain, Water, Physics, Camera, HUD  |
+-------------------------------------------------------------------+
                                  |
              Encapsulates & orchestrates engine subsystems
                                  v
+-----------------------+-----------------------+-------------------+
|   WebGL2 Renderer     |   Procedural Systems   |  Audio & Physics  |
| (shaders, VAOs, loop)  | (terrain, water, noise,|  (buoyancy, slope,|
|                        |  glTF import, particles)|  procedural hum) |
+-----------------------+-----------------------+-------------------+
```

**Source layout & build.** `engine/src/01-vec3.js` through `22-api.js` (22 files, strict contiguous numbering enforced by the build — `node build/build.js` refuses to build otherwise), concatenated into one IIFE closure at `dist/opus-engine.js`. Only `window.Opus` escapes the closure; internal renderer state, shader source, and GPU handles are unreachable from outside, verified (`typeof Renderer === 'undefined'` outside the bundle). No hard bundle-size cap — an editor UI needs room to grow; minification (whitespace/comment stripping + private-identifier mangling) runs regardless, so size grows from real features, not waste. Current bundle: ~92 KB (~24.6 KB gzip).

**`editor/` has no special access.** `editor/index.html` loads the built `dist/opus-engine.js` bundle plus `editor/src/01-editor.js` — the same two-script-tag setup any external Opus user would use. Every editor feature that needed something the engine didn't expose became a public API addition first (glTF import, touch input simulation, mesh geometry round-tripping, etc.) — never a private workaround. That discipline is the whole point of [`API-FRICTION.md`](API-FRICTION.md): every friction point recorded, the smallest reusable public capability built, proven by using it, documented.

**Engine subsystems**, briefly:
- **Renderer** — lit WebGL2 meshes, gradient sky, terrain height/slope vertex coloring, sum-of-sines animated water with fresnel tint, instanced particle billboards.
- **Terrain/Water** (`19-terrain.js`, procedural + `08-mesh.js`) — seeded island heightfields with CPU sampling that exactly matches the GPU mesh (`Terrain.sampleHeight`/`sampleNormal`), animated water with matching world-space sampling.
- **Physics** (`20-physics.js`) — raycasts (sphere/AABB), swept trigger volumes, terrain collision (slope sliding vs. cliff blocking), buoyancy, soft map-boundary pushback.
- **glTF import** (`21-gltf.js`) — a from-scratch glTF 2.0 parser (`.gltf` JSON with embedded base64 buffers, or `.glb` binary containers), geometry only (no materials/textures/animation/skinning — the renderer has no texture-sampling path). Bakes node-hierarchy transforms into flat vertex arrays, the same shape `Opus.Mesh.fromArrays` already accepted, so no renderer change was needed at all.
- **Input** (`04-input.js`) — keyboard + Pointer Events (unifies mouse/touch/pen), plus `simulateKeyDown/Up` so an on-screen touch control can drive the exact same key-state a real keyboard would.
- **HUD** (`14-ui.js`) — a DOM overlay with a small primitives registry (labels, panels, buttons, modals, `addTouchButton` for press-and-hold touch/mouse controls) for games that want a built-in HUD; `editor/` opts out (`hud: false`) and builds its own chrome directly, same underlying pattern.
- **Audio, Save, Settings, Particles, Camera** — procedural Web Audio (node-recycled engine hum, positional blips), localStorage-backed save slots, orbit/chase camera modes, capped particle emitters.

**Editor-side systems** (all built on the public API above, no engine access):
- **Placement & selection** — drag from palette (Pointer-Events-based, not HTML5 Drag-and-Drop, so it works on touch), click/shift-click/marquee-select, multi-select-aware drag-to-move, duplicate, delete.
- **Behaviors** — a fixed On Click/On Enter → Message/Sound/Win/Lose/Boost/Objective dropdown (the no-code common case) with two escape hatches for anything that doesn't fit: **Custom Script** (`new Function(entity, app, Opus, game, code)`) and **Node Graph** (a visual editor — click-to-connect ports, sequencing, gated conditions, AND/OR, named counters — wiring together the same fixed actions rather than being a general-purpose language).
- **Undo/redo, Save/Load, Export** — all reuse one `serializeScene()`/`loadScene()` pair as the snapshot format; a scene (including imported mesh geometry, via `Opus.Mesh.toArrays`) round-trips through all three the same way.

---

## Current state

**The engine** exports a documented, tested public API (`node tests/run-tests.js` — 468 test files, run together, covering math, procedural sampling, physics, scene/entity ownership, particles, input, settings, save slots) plus everything added this session: glTF import/export-of-arrays, touch input primitives, and the HUD's touch button.

**Crate Run** (`editor/index.html`) is a 7-island archipelago: 21 crates (disappear on collection, no double-counting on re-entry), 7 hazards (3 patrol on a moving path, the rest static — all a spiky mine shape, not a plain cube), 5 boost pads (a pyramid shape, force-configurable), one bonus crate authored entirely via the node-graph editor, and one landmark imported via `Opus.Mesh.fromGLTF` from a genuinely multi-node model. Playable start to finish on desktop (mouse + keyboard) and touch (on-screen D-pad + boost button, touch-capable editor).

**What shipped, roughly in order** (full detail in [`ROADMAP.md`](ROADMAP.md)): the core no-code placement loop → widened palette (terrain/water/mine/boost pad) → visual behaviors (fixed dropdown + Custom Script) → the game/editor hybrid shell → hovercraft gameplay consolidated from an earlier standalone demo → multi-island world (surfacing and fixing a real terrain-collision bug, friction #15) → gameplay variety (patrol hazards, boost pads) → a real editor-usability pass (drag-to-move, keyboard shortcuts, duplicate, cursor feedback, multi-select, marquee-select — surfacing and fixing a real camera/pointer-event conflict bug, friction #18) → the four originally-deferred items: **touch support in exported games**, **mobile/touch editing**, **glTF asset import**, and **node-graph visual scripting** — each landing as a genuine reusable engine capability, proven by using it in Crate Run itself, not a demo-only shortcut.

---

## Roadmap — what's next

No fixed timeline; work is picked by what's actually needed next, proven by building something real with it, and documented (see "How roadmap work is selected" in [`ROADMAP.md`](ROADMAP.md)).

**Open, low-risk, whenever it's worth doing:**
- More Crate Run content toward a longer single-playthrough target — the island/crate/hazard pattern is proven and cheap to repeat.
- Marquee-select and drag-to-move currently cover cubes and terrain; water stays number-field-only by design (it's one giant backdrop plane — raycast-picking it would break "click empty space to deselect" almost everywhere). Revisit only if that tradeoff stops being right.
- Minor UI polish as it's noticed (e.g., the node-graph canvas has no zoom/pan yet — fine at the current graph sizes, would matter for much larger graphs).

**Deliberately not started without a direction-setting conversation first:**
- **Multiplayer/networking** — the one item from the original deferred list still untouched. A fundamentally different kind of work: a hosting-model decision (peer-to-peer vs. authoritative server), netcode, and likely client prediction/reconciliation for a physics-simulated game. Not something to default into via the same incremental "build it, prove it, document it" loop everything else here used.

---

## Repository map

| Path | What it is |
|---|---|
| `engine/src/` | Engine source, 22 files, numbered in strict dependency order |
| `dist/` | Built artifacts (`opus-engine.js`, `delivery-run.html`) — run `node build/build.js` to regenerate |
| `editor/` | Crate Run — the no-code editor + shipped game |
| `demo/` | Standalone unbundled dev loader + the original Delivery Run demo source (superseded by the editor as the primary product, kept for engine-only dogfooding) |
| `template/`, `examples/` | Copyable starter template and five tutorial examples for using the engine standalone, outside the editor |
| `tests/` | Public API regression suite (`run-tests.js`) + a browser WebGL2 smoke test |
| `docs/` | `getting-started.md`, `api-reference.md` — reference material for using the engine's public API directly |
| `ROADMAP.md` | Full phase-by-phase build history, in detail |
| `API-FRICTION.md` | Every gap found while building the editor/demo against the engine's public API, and how each was resolved |
| `CHANGELOG.md` | Version-tagged change log |

## Build & test

```bash
node build/build.js --verbose   # builds dist/opus-engine.js + dist/delivery-run.html
node tests/run-tests.js         # builds, then runs the public-API regression suite against the built bundle
```

For a real WebGL2 + DOM lifecycle smoke test, serve the repo root and open `tests/browser-smoke.html`.

## Using the engine standalone (without the editor)

```html
<canvas id="game"></canvas>
<script src="dist/opus-engine.js"></script>
<script>
const app = Opus.create(document.getElementById('game'));
const cube = app.addEntity({
  mesh: Opus.Mesh.cube(),
  color: [0.25, 0.7, 1],
  position: new Opus.Vec3(0, 0, 0),
});
app.start((dt) => { cube.rotationY += dt; });
</script>
```

See [`template/`](template/) for a copyable starting point, [`examples/`](examples/) for five focused tutorials (scene basics → terrain/water → physics → particles/audio → a mini-game), and [`docs/api-reference.md`](docs/api-reference.md) for the full documented API surface.

## Maturity

- **Editor / Crate Run**: the primary product surface, actively developed, dogfooded end to end.
- **Engine public API**: stable in shape, still provisional (pre-1.0) — expect additive changes, not breaking ones, as the pattern from `API-FRICTION.md` has been so far.
- **WebGL2 only**, no fallback renderer. Not production-hardened; this is a working developer preview, not a shipped commercial engine.
