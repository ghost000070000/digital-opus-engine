# Digital Opus Engine — Audit

Date: 2026-08-25. Scope: `engine/`, `editor/`, `demo/`, `tests/`, `docs/`,
and the top-level markdown docs. Findings only — no fixes applied yet.
Each item is graded **Real issue**, **Minor/cosmetic**, or **Non-issue
(checked, ruled out)**; non-issues are recorded so they aren't
re-investigated later.

## Priority order

1. Custom Script executes unsandboxed on an untrusted loaded/imported project (Security, High)
2. glTF import has no allocation bound before the size check (Correctness/DoS, High)
3. Node-graph editor node IDs can collide after reloading a saved project (Correctness, High)
4. New engine capabilities (glTF, touch input) have zero regression test coverage (Test coverage, Medium)
5. `docs/api-reference.md` and `CHANGELOG.md` don't document this session's additions (Docs, Medium)
6. `build/build.js`'s internal-name mangle list is missing the new glTF helpers (Cosmetic, Low)
7. `docs/getting-started.md` doesn't mention the editor as an entry point (Cosmetic, Low)

---

## 1. Custom Script executes unsandboxed on an untrusted project — Real issue, High

**Where**: `editor/src/01-editor.js:889` (script execution), trigger wiring
around line 1268–1272 (`'enter'` trigger volumes), Load Project button
around line 1754.

```js
new Function('entity', 'app', 'Opus', 'game', behavior.param || '')(item.entity, app, Opus, game);
```

**What actually happens**: loading a saved project or an imported scene
JSON does **not** itself execute anything — `loadScene`/`cloneBehaviors`
only deep-clone data. But a `script` action attached to an `'enter'`
trigger fires the moment the hovercraft's proximity volume detects the
player near that object during Play — which happens automatically from
normal movement, not a deliberate click. The `Function` constructor body
is **not sandboxed**: despite the four named parameters, the function body
can reach `window`, `document`, `fetch`, cookies, and anything else on the
page, not just `entity`/`app`/`Opus`/`game`.

**Concrete failure scenario**: someone shares a Crate Run project file
(via Export Scene JSON or a save). It contains one crate near the spawn
point with `{trigger: 'enter', action: 'script', param: '<malicious JS>'}`.
The recipient loads the project and presses Play. Within a second or two
of normal driving, the script runs with full page privileges — no
confirmation dialog, no warning, no visual difference from an innocuous
crate. Grepped the codebase for `confirm(`, `sandbox`, `untrusted`: zero
matches anywhere.

**Why it's real and not just "working as designed"**: Custom Script as an
*authoring* escape hatch for the person building their own game is a
deliberate, documented design choice (see API-FRICTION.md) and isn't in
question. The gap is specifically about **loading someone else's file**
with no signal that doing so is different from loading your own. A
no-code tool whose whole pitch is letting non-programmers build and share
games is exactly the context where "share your game with a friend" is a
natural, expected action.

**Not a fix recommendation, just noting the shape of it**: the smallest
version of this stays entirely in the editor's project-load path (not the
engine, not the sandboxing itself, which would be a much bigger change) —
something like flagging when a loaded project contains any `script` or
`graph` behavior and surfacing that before Play, so at least the user
knows a file can run arbitrary code before it does. Whether and how to
address this is a product decision, not something to default into.

---

## 2. glTF import has no allocation bound before the size check — Real issue, High

**Where**: `engine/src/21-gltf.js:83` (`readGLTFAccessor`), the only size
guard is at line 239 (`vertexCount > 65535`, in `parseGLTFToArrays`).

`accessor.count` comes directly from the parsed file's JSON with no upper
bound check before:

```js
const out = new Float32Array(count * numComponents);
```

The 65,535-vertex ceiling documented in the friction log and the public
API's own error message only runs **after** every accessor for every
primitive has already been fully allocated and read.

**Concrete failure scenario**: a crafted `.gltf`/`.glb` with an accessor
claiming `count: 5000000` on POSITION triggers a tens-to-hundreds-of-MB
allocation and a full synchronous decode loop before the 65,535 check ever
runs. The editor's `try/catch` around the import handler (around line
1771–1784) means this doesn't crash with no feedback, but the tab can
still hang or the allocation can fail ungracefully before that catch is
ever reached. This is the newest, most complex parsing surface in the
project and it's the one place accepting arbitrary external files by
design (the whole point of asset import) — worth a cheap fix (check
`count` against a sane ceiling before allocating, not just after).

Two related things were checked and **ruled out**:
- Out-of-bounds `byteOffset`/`bufferView` reads: `DataView.get*` throws
  `RangeError` on out-of-bounds access rather than silently returning
  garbage, so malformed offsets surface as a caught, toasted error, not
  silent corruption.
- GLB chunk-length trust (`parseGLTFContainer`, line 53–63): a
  truncated/malformed GLB can yield a shorter-than-expected chunk via
  `ArrayBuffer.slice`'s clamping behavior, but the resulting truncated
  JSON then fails `JSON.parse` and throws — no exploitable primitive found
  beyond the allocation issue above.

---

## 3. Node-graph node IDs can collide after reloading a saved project — Real issue, High

**Where**: `editor/src/01-editor.js:1052` (`let graphNodeIdCounter = 1;`),
incremented at line 1232, never reset or reconciled against loaded graph
data in `openGraphEditor` (line 1054–1061).

The counter is module-level and monotonic, which is safe within one
continuous page session (always increasing, so a new node never collides
with an earlier one in *any* graph created that session). But it resets to
`1` on every fresh page load, while a saved project's graphs persist node
ids like `n1`, `n2` from whatever session created them.

**Concrete failure scenario**: load a saved project (or the shipped
starter scene's own bonus-crate graph) whose item already has nodes `n1`
and `n2`. Open that item's Node Graph editor and click any "add node"
button — the new node is assigned id `n1`, colliding with the existing
one. Both nodes now share `data-node-id="n1"` in the DOM;
`document.querySelectorAll('[data-node-id="n1"]')` returns two elements,
and every id-keyed lookup (port wiring, dragging, deletion, edge
rendering) becomes ambiguous between them.

**Trigger condition is narrow but genuinely reproducible**: reopening and
editing a previously-saved graph after a fresh page load — exactly what
"edit a project you saved yesterday" looks like. Not defensively guarded
anywhere (no id-uniqueness check on node creation).

---

## 4. New capabilities have zero regression test coverage — Real issue, Medium

**Where**: `tests/public-api.test.js` (18 tests total, confirmed passing).

Confirmed by reading every `test(...)` block: coverage exists for Vec3,
Mat4, Mesh (cube/fromArrays only), Terrain, Water, Physics, Entity, Scene,
particles, Input (via real DOM event dispatch), Settings, and Save. Zero
references to:

- `Opus.Mesh.fromGLTF` / `Opus.Mesh.toArrays` (`engine/src/21-gltf.js`,
  `22-api.js:148,161`) — the newest and most complex parsing surface in
  the codebase, entirely unverified by the formal suite. Manually
  verified during development (translation/rotation baking checked
  against exact hand-computed coordinates, a real GLB container, error
  paths) but that verification isn't captured as a re-runnable regression
  test.
- `Input.simulateKeyDown/Up` (`04-input.js:57,62`) — the existing input
  test dispatches synthetic DOM events, never calls these directly.
- `HUD.addTouchButton` (`14-ui.js:253`) — no HUD tests exist in the suite
  at all (the Node-based harness doesn't set up a DOM/canvas easily), so
  this isn't a gap specific to touch buttons — HUD as a whole has no
  coverage. Worth noting as its own, broader gap.

---

## 5. `docs/api-reference.md` and `CHANGELOG.md` don't document this session's additions — Real issue, Medium

**`docs/api-reference.md`** (header still says v0.1.0):
- §5 Mesh Primitives (line 69–76) lists only `cube`/`plane`/`grid`/
  `fromArrays` — missing `fromGLTF` and `toArrays` entirely, despite both
  being used by the editor.
- §11 HUD (line 126) lists the original primitive set but not
  `addTouchButton`.
- No mention anywhere of `Input.simulateKeyDown/Up`.
- No mention of `editor/` as a way to use the engine at all.

**`CHANGELOG.md:5–11`** — the "Unreleased" section only mentions the
roadmap document and the test-suite additions; none of the editor, glTF
import, touch input, or node-graph scripting work is reflected, despite
all of it existing in the current tree per `ROADMAP.md`.

(`docs/architecture.md` had a similar problem and was already partially
patched to point at the top-level `README.md` as the current reference —
see that file's "Current status vs. this document" section. The two
files above weren't touched during that pass.)

---

## 6. `build/build.js`'s mangle list is missing the new glTF internal names — Minor/cosmetic

**Where**: `build/build.js:111–124` (`internalNames` array inside
`mangleInternals`).

Confirmed by grepping the actual shipped `dist/opus-engine.js`: none of
`gltfFail`, `decodeDataURI`, `parseGLTFContainer`, `readGLTFAccessor`,
`quatToMat4`, `nodeLocalMatrix`, `transformPoint`, `transformDirection`,
`computeFlatNormals`, `walkGLTFNode`, `parseGLTFToArrays`,
`GLTF_COMPONENT_TYPES`, `GLTF_TYPE_COMPONENTS`, or `GLB_MAGIC` are
mangled — they appear fully readable in the bundle, byte-identical to the
source file. The auto-detected `_`-prefixed regex doesn't catch them
since none use a leading underscore, and they were never added to the
manual list the way `hudButtonStyle` and the rest were.

Impact is bundle-size and readability only (a few hundred bytes, internal
names visible in the shipped file) — no functional or security
consequence, since the whole module is still unreachable from outside the
IIFE regardless of whether its internal names are shortened.

---

## 7. `docs/getting-started.md` doesn't mention the editor — Minor/cosmetic

Self-consistent for the engine-only workflow it describes; just doesn't
present `editor/` as an alternative, no-code on-ramp alongside the
hand-coded one. Not incorrect, just incomplete relative to what the
project actually is now.

---

## Checked and ruled out

- **`demo/` vs `editor/` duplication**: `demo/src/21-game.js` is still
  actively built by `build/build.js` into `dist/delivery-run.html` and is
  a deliberately separate legacy artifact per its own comments, not
  orphaned or accidentally duplicated. Some conceptual overlap
  (hazards, boost pads) exists but each is implemented independently by
  design — not a maintenance-risk duplication.
- **`Opus.Mesh.toArrays` throwing uncaught in `serializeScene`**
  (`editor/src/01-editor.js:1594`): only called when a cube's mesh isn't
  one of the three tagged built-ins. Every other mesh-producing path
  reachable from the editor (`fromArrays`, `fromGLTF`) always yields an
  `'arrays'`-kind descriptor, which is exactly what `toArrays` requires.
  No path currently places a `'cube'`-kind item with a
  `grid`/`plane`/`terrain`-kind mesh, so this can't throw uncaught today.
- **glTF out-of-bounds reads silently corrupting data**: ruled out above
  in finding 2 — `DataView` throws rather than reading garbage.
