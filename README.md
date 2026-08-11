# Digital Opus Engine

Version 0.1.0 — **developer preview**

Digital Opus Engine is a zero-runtime-dependency, vanilla-JavaScript WebGL2 game engine distributed as one browser script. Engine users need no npm install, framework, or bundler.

```html
<canvas id="game"></canvas>
<script src="opus-engine.js"></script>
<script>
const app = Opus.create(document.getElementById('game'));
const cube = app.addEntity({
  mesh: Opus.Mesh.cube(),
  color: [0.25, 0.7, 1],
  position: new Opus.Vec3(0, 0, 0)
});
app.start((dt) => { cube.rotationY += dt; });
</script>
```

The release engine is **81,404 bytes** (**21,281 gzip bytes**); the standalone Delivery Run is **99,298 bytes**. WebGL2 is required.

## Features

- Lit WebGL2 meshes, gradient sky, hemisphere light, and distance fog
- Seeded island terrain with matching public height/normal sampling
- Animated water with exact public height/surface sampling
- Orbit and smoothed chase cameras
- Raycasts, triggers, buoyancy, terrain response, and soft map boundaries
- Capped particle emitters
- User-activated procedural audio and reusable vehicle hum
- Managed HUD primitives, overlays, settings, save slots, and screenshots
- Explicit lifecycle with resize, pause/resume, and comprehensive cleanup

## Made with Digital Opus Engine

[Play Hovercraft Delivery Run](dist/delivery-run.html), a 90-second playable technical demo built through the same documented public API available to engine users.

## Start here

- [Copyable starter template](template/)
- [01 — Hello scene](examples/01-hello-scene.html)
- [02 — Terrain and water](examples/02-terrain-water.html)
- [03 — Physics](examples/03-physics.html)
- [04 — Particles and audio](examples/04-particles-audio.html)
- [05 — Mini-game](examples/05-mini-game.html)
- [Getting started](docs/getting-started.md)
- [API reference](docs/api-reference.md)
- [Architecture](docs/architecture.md)
- [Roadmap](ROADMAP.md)
- [API friction log](API-FRICTION.md)

Serve the repository root over HTTP:

```bash
python -m http.server 8180
```

Then visit `http://localhost:8180/dist/delivery-run.html`. `file://` execution is not promised.

## Build

The dependency-free build command is:

```bash
node build/build.js --verbose
```

It produces `dist/opus-engine.js` and `dist/delivery-run.html` and reports their resulting sizes. Bundle size is monitored but is not a build failure condition.

## Test

Build the release artifacts and run the dependency-free public API regression suite:

```bash
node tests/run-tests.js
```

The tests execute against `dist/opus-engine.js`, so they cover the same compacted public bundle shipped to engine users.

For a real WebGL2 and DOM lifecycle smoke test, serve the repository and open
`http://localhost:8180/tests/browser-smoke.html`. The page reports App creation,
rendering, pause/resume, scene ownership, and destruction results in place.

## Maturity

- Engine: Developer preview / alpha
- API: Provisional documented public API
- Demo: Playable technical demo
- Template and examples: Starter quality

This release is not production-ready. See the changelog and architecture notes for intentional limitations.
