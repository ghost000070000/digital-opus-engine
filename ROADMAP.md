# Digital Opus Engine Roadmap

Digital Opus Engine is currently a v0.1 developer preview. The roadmap prioritizes
reliability and a stable developer experience before broadening the renderer or
adding large content systems.

This roadmap describes direction, not fixed release dates. A milestone ships when
its exit criteria are met.

## Product principles

- Keep the core usable through one browser script with zero runtime dependencies.
- Preserve a compact, understandable engine instead of competing feature-for-feature
  with full-scale editors and general-purpose engines.
- Build every public capability through examples or complete games before declaring
  it stable.
- Keep renderer internals private and maintain explicit ownership and cleanup.
- Use optional companion scripts when they create a cleaner product boundary, not
  solely to satisfy an arbitrary core-size ceiling.

Bundle size remains a visible engineering metric, but it is not capped. New core
capabilities should justify their download, parse, memory, and maintenance costs
through demonstrated use in examples or complete games.

## v0.1.1 - Reliability baseline

Priority: **Now**

- Add deterministic unit tests for `Vec3`, `Mat4`, terrain and water sampling,
  ray tests, trigger sweeps, collision response, and boundary response.
- Add lifecycle regression tests covering repeated start, pause, resume, restart,
  entity removal, and idempotent destruction.
- Add browser smoke coverage for current Chrome, Firefox, Edge, and Safari.
- Exercise resize, visibility changes, WebGL context loss, audio unlock, storage
  failure, and screenshot failure paths.
- Add continuous integration for tests, distributable builds, bundle-size reporting,
  and a clean-worktree check after generation.
- Record baseline frame-time, entity-count, terrain, and particle benchmarks.

Exit criteria:

- The documented public API has automated behavioral coverage for its critical
  paths.
- All supported browsers can load an example, render a frame, pause/resume, and
  destroy the App without uncaught errors.
- The release artifacts are reproducible and report their raw and compressed sizes.

## v0.2 - Prototype-ready developer experience

Priority: **Next**

- Introduce action-based input mapping above raw keyboard state.
- Add keyboard rebinding, Gamepad API support, and a touch-control reference UI.
- Add optional debug views for rays, triggers, terrain normals, map boundaries,
  camera targets, and frame statistics.
- Publish TypeScript declaration files while keeping JavaScript and script-tag
  usage first-class.
- Define API stability, deprecation, and migration rules.
- Add focused recipes for projectiles, checkpoints, menus, camera transitions,
  save/load, and object pooling.
- Dogfood the release with a second small game using different engine systems from
  Delivery Run.

Exit criteria:

- A developer can build and debug a keyboard, gamepad, or touch-controlled prototype
  without reaching into engine internals.
- Public API changes have documented compatibility and migration behavior.

## v0.3 - Optional content pipeline

Priority: **Later**

- Define a versioned companion-module contract that does not expose renderer
  internals.
- Provide an optional glTF 2.0 loader for static meshes, textures, UVs, unlit
  materials, and transparency.
- Add skeletal animation only after static glTF loading and resource cleanup are
  proven reliable.
- Add scene serialization for procedural or externally authored levels.
- Offer optional ES-module and npm packaging alongside the drop-in browser script.

Exit criteria:

- Games can load a representative glTF asset without increasing the core bundle.
- Loaded CPU, GPU, image, and animation resources follow the App lifecycle and are
  fully releasable.

## v0.4 - Rendering scale and quality

Priority: **Later**

- Add frustum culling and measured batching improvements.
- Add a directional-shadow path with quality controls.
- Expand lighting and materials only where benchmark scenes demonstrate a need.
- Add renderer, GPU-resource, and particle profiling diagnostics.
- Define tested quality presets for desktop and mobile-class hardware.

Exit criteria:

- Benchmark scenes show a documented improvement or bounded cost for every new
  rendering feature.
- Lower-quality modes retain readable visuals and stable gameplay timing.

## v1.0 - Stable small-game engine

The 1.0 release is a stability milestone rather than a feature-count milestone.
It requires:

- A semantically versioned, compatibility-tested public API.
- Documented browser, device, and performance targets.
- Automated lifecycle and resource-leak regression coverage.
- Keyboard, gamepad, and touch input paths.
- At least one supported optional asset-loading path.
- At least two complete, distinct games built only through public APIs.
- Migration notes for every preview release that changed public behavior.

## Deferred beyond v1.0

Unless user demand changes the product direction, these remain out of scope:

- Networking and authoritative multiplayer synchronization
- A visual scene editor, node graphs, or a full integrated development environment
- A 2D renderer or 2D physics engine
- Direct OBJ or FBX pipelines when glTF can serve as the interchange format
- A general-purpose plugin marketplace

## How roadmap work is selected

New public API proposals should begin as a concrete need in an example or complete
game. Record the friction, implement the smallest reusable engine capability, add
regression coverage, and document the resulting API. Bundle size, lifecycle
ownership, and compatibility impact are part of the acceptance criteria for every
change.
