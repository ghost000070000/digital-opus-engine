# Digital Opus Engine Roadmap

**Status: Editor v0, v0.1, and v0.2's core slice are built and verified.** Place
(Cube/Terrain/Water) → select (viewport or Scene list) → edit (inspector,
regenerating terrain/water live) → attach behaviors (On Click / On Enter →
Show Message / Play Sound / **Win Game / Lose Game** / Advanced: Custom
Script) → Play-test live in the editor → Save/Load/Export, with full
Undo/Redo. Win/Lose shows a full-screen end-state overlay and freezes
further triggers; Custom Script scripts can also call `game.win()`/
`game.lose()`, so scripted conditions (e.g. "collect 3 of 5") reach the same
primitive as the fixed action, not a separate path. Custom Script remains
the deliberate, honestly-labeled ceiling on the fixed visual set — errors
are caught and reported per-behavior, not a hard wall and not a silent
failure.

**Major Game-Builder Expansion batch complete — see `MAJOR-EXPANSION-REPORT.md`.**
Object References, a shared action-execution core (fixed dropdown + Node
Graph now dispatch through one table, vocabulary grown from 7 to 19
actions), Trigger Volumes, Prefabs, AI Behavior (Follow/Orbit/Wander),
Grouping, runtime Spawn Prefab, the On Start trigger, Checkpoints/Respawn,
and a `counterAtMost` condition fix caught by an actual failing playtest —
all built, dogfooded, and regression-tested (`API-FRICTION.md` #20–#33).
Three new playable stress-test games ship in `games/`. Verdict:
`QUALIFIED_WITH_BOUNDED_GAPS` — transform gizmos, a multi-scene/level
system, solid-object collision, portable prefabs, and standalone playable
export remain open; ranked in the report, not silently dropped.

**The shipped artifact is now a game/editor hybrid, not two separate
things.** `editor/index.html` opens directly into "Crate Run" — a real,
complete, playable mini-game (procedural island, 3 collectible crates
wired via scripted behaviors toward a scripted win condition, 1 hazard
cube wired via the fixed Lose action) with zero clicks needed to start
playing. A single always-visible "Edit This Game" toggle reveals the exact
same live scene in the full editor — same objects, same behaviors, fully
editable — and toggling back starts a genuinely fresh play session (game
state reset, end overlay cleared). This is the actual proof: the shipped
game isn't a separate hand-coded artifact next to the editor, it's a
scene the editor itself produced and can still edit live.

**Consolidated into one game, not two.** The hovercraft controller
(movement/collision/hover/camera/particles) was ported from the earlier
standalone Delivery Run demo into the editor's Play mode itself — driving
to a crate, not clicking it, is now the actual gameplay. Required one
more small API addition, `App.removeEmitter` (friction #14), so the
hovercraft's exhaust/spray/foam trail can be cleanly spawned and torn
down every play session instead of leaking. Crate Run's 3 crates and 1
hazard now use proximity ("On Enter") triggers checked against the
hovercraft's live position, not the camera. This is the base to grow
toward the ~30-minute target incrementally — more crates, more terrain,
more hazards, added through the editor itself, not a rewrite.

Added a persistent objective/progress display (distinct from the
transient toast — a live "Crates: 2/3" shouldn't fade) via `game.
setObjective(text)` in the script sandbox plus a fixed "Update
Objective" action for non-scripted use. Crate Run now shows live
progress through the whole playthrough, correctly hides when returning
to the editor, and resets at the start of each session.

**World expanded to two islands connected by open water** — 6 crates (3
per island) and 2 hazards, real distance to actually drive across. This
surfaced a genuine, previously-dormant engine bug: `Physics.
resolveTerrainCollision` sampled height using world coordinates directly,
never offsetting by the terrain's own `position` the way the per-instance
`.sampleHeight()`/`.sampleNormal()` handles already did — it only ever
worked because every terrain built with this engine so far happened to
sit at world origin. Fixed at the source (friction #15) and reverified:
collision height now exactly matches `sampleHeight()` on both islands.
Also fixed `computeSpawnPoint()` (assumed terrain was always at world
origin) and generalized terrain lookup to "closest island to the craft"
rather than always the first one placed.

**Audio feedback added for the game's actual defining moments** — until
now, collecting a crate and winning/losing were completely silent
despite the audio engine being fully capable (only the boost sound and
the generic fixed "Play Sound" action used it). Crate pickups now play a
chime that rises in pitch with each one collected; winning plays a
two-note ascending jingle, losing a low descending buzz. Small, but a
real player-experience gap that six silent collection events per
playthrough was leaving on the table.

**A third island**, placed off the existing east-west line (triangular
layout, not just "further out") for real navigation choices. 9 crates,
3 hazards total now. Confirms the multi-island architecture (and the
collision fix from the previous phase) generalizes cleanly — adding an
island is now genuinely just one entry in `islandDefs`, with boundary/
water extent widened to match. Verified the collision fix holds on the
new island specifically (not a coincidence carried over from the first
fix), and a real physics-driven drive settles to a correct grounded
height there too.

**Two more islands (four and five)**, filling out a five-island spread
(a north/south pair plus a fifth further northeast) — 15 crates, 5
hazards, boundary widened to 40 and water to size 84 to cover the new
extent. Purely content at this point: no new engine or editor gaps
surfaced, confirming the `islandDefs` pattern plus the friction #15
collision fix really do generalize to N islands, not just 2-3. Verified
the same way as every prior island — exact `resolveTerrainCollision`
vs. `sampleHeight` match on both new islands, a real physics-driven
drive settling to correct grounded height on each, and a full 15-crate
playthrough (driven through actual trigger `.update()` calls, not
mocked) confirming the live objective counter and win overlay both
fire correctly at 15/15.

**Gameplay variety beyond collect-and-avoid**: two of the five hazards now
patrol back and forth (oscillating along one axis) instead of sitting
static, so avoiding them takes timing, not just memorized position — the
`TriggerVolume`'s `center` is a live reference to the hazard entity's own
`position` Vec3, so mutating that position in place (`.set()`, not
reassignment) each frame is enough to keep detection correct with no
engine change. Also added boost pads: a new fixed `boost` action
(alongside message/sound/win/lose/objective in the same dropdown, not a
script-only trick) that gives the hovercraft a forward velocity impulse —
three are placed on the open-water routes between islands as shortcut
lanes worth steering for. Both are pure editor-level additions (no new
engine API, no friction log entry) and were verified directly: patrol
position genuinely changes frame to frame with the trigger tracking it,
driving onto a moving hazard fires Game Over, crossing a boost pad jumps
craft speed by exactly the configured force, and the full 15-crate win
path still resolves correctly with the new hazards/pads coexisting in
the world.

**Closing polish for this session**: the Scene list labeled every cube
generically as "Cube #N" regardless of role, which was already confusing
with 15 crates + 5 hazards + 3 boost pads in one flat list — `itemLabel`
now reads a cube's behaviors and names it by role (Crate / Hazard /
Patrol Hazard / Boost Pad / Cube). Also found and fixed a real latent
bug while reasoning about the undo system: `serializeScene`/`loadScene`
(reused as-is for Undo/Redo history *and* Save/Load) never captured a
cube's `spin` or `patrol` properties, so pushing an undo snapshot after
this session's hazard/boost-pad work and then undoing would have silently
flattened them back to static, non-spinning cubes — a real regression
nobody would have noticed without deliberately checking. Both are now
serialized and restored; reproduced the exact push-undo-undo sequence
and confirmed patrol/spin survive it.

**Cleanup pass in response to real user feedback on the shipped game**:
(1) removed the leftover reference ground plane — a dark 20x20 slab at
world origin, sized for the original single-island layout, that now sat
oddly above the water in the middle of an 84-unit multi-island world
("the massive platform in the middle"). It was purely visual (the
drag-and-drop raycast math already used an independent y=0 plane
calculation, not this entity), so removing it was zero-risk. (2) Fixed
a genuine engine-level rendering bug (friction #16): every terrain's
square mesh had a perfectly flat, constant-height area beyond its
circular island radius, which read as an artificial "platform" once
submerged — `islandHeight` now blends that area toward gentle seafloor
noise instead, with on-land height/physics provably unchanged (the new
term cancels out exactly inside the island). (3) Crates, hazards, and
boost pads were all literally cubes, distinguished only by color —
hazards are now a spiky octahedron ("mine") and boost pads a pyramid,
both built via `Opus.Mesh.fromArrays` at the editor level (no engine
change needed for this part); crates stay cubes, which still reads
correctly for "crate." All three verified in-browser: no console errors,
world entity counts and mesh identities confirmed correct, collision/
grounding checks unaffected, and the full 15-crate win path still
resolves correctly.

**More feedback-driven polish**: recoloring a collected crate green was
too subtle to register at a glance or in motion — "hard to tell which
collected or not." Crates now disappear entirely on pickup instead
(`entity.visible = false`, a real, renderer-respected property already
used elsewhere for the selection marker). Added an idempotency guard so
driving away and back over an already-collected crate can't double-count
it, and `enterPlayMode` now resets every cube back to visible at the
start of each session, so a fresh playthrough still starts with all 15
crates present — verified directly (collect, confirm invisible, re-enter
same spot, confirm no double-count, exit and restart, confirm visible
again). Also added Mine to the palette — previously hazards only existed
as starter-scene content built in code; now dragging Mine from the
palette drops a fully-configured hazard (octahedron mesh, red, On
Enter → Lose Game already wired) the same way Boost Pad already worked
as a fixed action, not just something reachable via script. Verified via
a real simulated drag-and-drop: dropped item is a proper hazard, labeled
"Hazard #N" in the Scene list.

**Editor v0.1 polish: drag-to-move for cubes.** "Editing is still
number-field-based" has been the one line carried forward unaddressed
in every phase since v0.1 — this closes the most common case of it.
Clicking a cube (crate/hazard/boost pad/plain cube) in the viewport and
dragging now repositions it live along the ground plane, instead of
requiring three number fields for even a small nudge. Scoped to cubes
only: terrain/water repositioning would mean regenerating their mesh on
every mousemove, which is a real cost a cube's plain `position.x/z` set
doesn't have — they keep the existing number-field flow, which is fine
since they're placed once and rarely moved. Reuses the exact same
ground-plane math the initial drag-and-drop placement already used
(`screenToGroundPoint`), so there's no new projection code, just a
grab-offset and a mousemove listener. One subtlety: a `justDragged` flag
suppresses the existing click handler's deselect-on-empty-space logic
right after a drag ends, otherwise finishing a drag would immediately
deselect the object you just moved.

This session's preview environment doesn't render the browser pane by
default, so `window.innerWidth`/the canvas's layout rect were reporting
0x0 — genuine mouse-coordinate testing needed a temporarily patched
`canvas.getBoundingClientRect()` to give real DOM events valid
coordinates to work with. Verified the actual registered listeners end
to end this way: mousedown hit-selects via the real raycast and arms the
drag without moving anything yet; mousemove updates position to exactly
match the ground-plane point under the cursor (confirmed against the
same math independently) and lazily pushes exactly one undo snapshot on
first movement, not one per frame; mouseup finalizes and flags
`justDragged`; the following click stays selected instead of clearing
it. Full 15-crate win path re-verified unaffected afterward.

**Drag-to-move extended to terrain (islands).** The "batched
regeneration" concern noted last phase turned out to be unfounded: the
renderer applies a terrain's `position` as a draw-time translation over
mesh geometry that's already in local coordinates (`Mat4.translation`
in `renderTerrain`, engine/src/09-renderer.js), so moving a terrain
needs zero mesh regeneration -- same cost as dragging a cube. The real
subtlety was that a terrain handle carries *two* separate `position`
Vec3 objects under the hood: one the renderer/`sampleHeight`/
`sampleNormal` read, one the physics call and the inspector's
Seed/Size/Radius regenerate-on-edit read from `item.options`. Dragging
now keeps both in sync every frame -- otherwise it's exactly the kind
of visual/collision desync friction #15 was about, just introduced by
the editor this time instead of the engine. Terrain also gained
raycast picking (an AABB approximation of its square footprint) so it's
selectable by clicking in the viewport, not just the Scene list.

Water is deliberately still excluded from raycast picking and dragging:
it's one giant backdrop plane spanning most of the map, so making it
pickable would mean almost every click lands on it, including the
"click empty space to deselect" gesture -- that would stop working
almost everywhere. It stays Scene-list-only, unchanged.

This session's preview pane doesn't composite frames by default
(`document.hidden` stays true, and the canvas's layout rect drifted
between separate tool calls, unrelated to the app itself) -- verified
correctness with a pinned, fixed `getBoundingClientRect()` for an exact
check rather than chasing that noise: picking correctly resolves to the
terrain under the ray, a full mousedown-drag-mouseup sequence moves it
to exactly the computed ground point, and `item.handle.position` /
`item.options.position` land bit-for-bit identical afterward. Also
confirmed water is never returned by the picker (preserving
click-to-deselect), and re-ran the full 15-crate win path clean.

**Mini phase: Escape and Delete/Backspace as editor keyboard shortcuts.**
Drag-to-move made the viewport the primary way to work with an object,
but deselecting still meant clicking empty space (awkward now that
terrain is also raycast-pickable and covers a good share of the view),
and deleting still meant the inspector's button. Escape now deselects,
Delete/Backspace now deletes the current selection (reusing the same
`deleteSelected()` the inspector button already called, so it's one
code path either way). Both are guarded against an active text
field -- typing in the behavior message/script textarea or a number
input swallows Delete/Backspace/Escape normally rather than deleting
the object or losing the selection; Escape while typing blurs the
field instead. Verified directly: Escape clears `selectedItem`, Delete
removes a test object and clears selection, both correctly no-op while
a textarea has focus (confirmed via real `document.activeElement`, not
just the guard's own logic), and Escape-while-typing blurs rather than
deselects. Full 15-crate win path re-verified unaffected.

**Mini batch: Duplicate (Ctrl+D) and Y-nudge (`[`/`]`).** Placing
several similar objects meant re-dragging from the palette and
re-adding behaviors each time -- Duplicate clones the current
selection (cube, terrain, or water) with an independent behaviors copy
and a small position offset, so "one more of this" is one keystroke.
Reuses each item's own `entity.mesh`, so a duplicated hazard stays a
mine-shape and a duplicated boost pad stays a pyramid rather than
reverting to a generic cube -- confirmed directly (`dup.entity.mesh ===
mineMesh`). Terrain duplication also gets a fresh random seed so the
copy isn't visually identical to the original once separated by drag.
`[`/`]` nudge a selected cube's height by 0.25 -- drag-to-move covers
X/Z, but Y still meant the number field even for a quick lift; held
keys (`e.repeat`) don't spam a new undo snapshot per repeat tick, only
the initial press does. Both shortcuts share the existing typing-guard
with Escape/Delete, confirmed directly against real focus state (Ctrl+D
and `[`/`]` both correctly no-op while the behavior textarea has
focus). Full 15-crate win path re-verified unaffected.

**Mini update: Boost Pad added to the palette.** Mine got a palette
entry two phases ago; Boost Pad -- its sibling fixed-action object --
only ever existed via starter content or Duplicate. Dragging it in now
drops a fully-configured boost pad (pyramid mesh, spin, "On Enter →
Boost" already wired at force 11), matching the exact same
color/scale/spin/force the starter scene's own boost pads use, so a
hand-placed one is indistinguishable from a built-in one. Verified via
simulated drag-and-drop: correct mesh, correct behavior, labeled
"Boost Pad #N" in the Scene list. Full 15-crate win path re-verified
unaffected.

**Mini win: a visible Duplicate button.** Ctrl+D worked but had zero UI
footprint -- a hidden power-user shortcut is exactly the kind of thing
"no-code as far as feasible" shouldn't leave undiscoverable. Added a
"Duplicate" button paired with Delete in the inspector for all three
kinds (cube/terrain/water), same button-pair styling already used for
Undo/Redo. Both call the same `duplicateSelected()`, so there's one
code path regardless of whether it's triggered by keyboard or click.
Verified all three kinds via direct button clicks. Full 15-crate win
path re-verified unaffected.

**Mini win: cursor feedback for drag-to-move.** Nothing in the viewport
ever hinted an object could be dragged -- the feature worked but was
invisible until you happened to try it. The canvas cursor now shows
'grab' while hovering a draggable item (cube or terrain, mirroring
`pickEntity`), 'grabbing' during an actual drag, and resets on release
and on entering Play mode (so a lingering 'grab' cursor doesn't carry
into gameplay). Verified directly: hover-on gives 'grab', a point aimed
at open sky gives no cursor change, mousedown flips to 'grabbing' and
holds through the drag, release resets based on what's now under the
cursor, and entering Play mode always resets to default regardless of
prior state. Full 15-crate win path re-verified unaffected.

**Multi-select.** The last standing item from v0.1's original polish
list. Shift-click adds/toggles an item in the viewport or the Scene
list; `selectedItem` (the last item clicked/toggled) stays meaningful
as the "primary" selection for single-item property editing, while a
new `selectedItems` Set backs everything that needs to act on the whole
group. Dragging any member of a multi-selection now moves the entire
group together as a rigid formation (a single shared delta from the
grab point applied to each item's own start position, not a per-item
grab offset) rather than collapsing to just the one you happened to
click; dragging something outside the current selection still replaces
it and drags just that one, matching ordinary click-to-select. Delete
and Duplicate (both the keyboard shortcuts and the inspector buttons)
now operate on the whole selection as a single undo step each, not one
step per item -- confirmed directly (3 boost pads deleted in one Delete
press produced exactly one undo snapshot, not three). The inspector
gained a dedicated multi-select view ("N objects selected" + Duplicate
All / Delete All) since editing properties across a heterogeneous
selection (a cube next to a terrain) isn't attempted. One marker
entity per selected item now, pooled the same way the original single
marker was rather than destroyed/recreated per render.

Dogfooding this surfaced a real, previously-latent bug in `pickEntity`:
an object resting on an island sits *inside* that terrain's own
picking AABB (which spans a generous +-3 in y to approximate the whole
heightfield), so the AABB's near face is almost always closer to the
camera than anything resting inside it -- a raw closest-hit comparison
let the terrain win nearly every time a crate/hazard/boost pad sat on
land, exactly backwards from what clicking or dragging it should do.
Found while testing group-drag on two crates sitting on an island (the
drag grabbed the whole island instead). Fixed by checking cubes first
and always preferring a cube hit over terrain, rather than merging both
into one distance comparison; re-verified terrain is still picked
correctly on genuinely empty ground with no cube nearby. This was
purely an editor-level bug (`pickEntity` isn't part of the public Opus
API), so no friction log entry, just a direct fix.

Verified: shift-click add/toggle-off, markers/Scene-list/inspector all
tracking the live selection size, group drag preserving exact relative
offsets between members, mass delete/duplicate each as one undo step,
Escape clearing a multi-selection, and -- since the drag math changed
from a per-item grab offset to a shared delta -- re-confirmed the
single-item drag case still lands on the exact same point as before
the refactor (bit-for-bit, not just close). Full 15-crate win path
re-verified unaffected throughout.

**Two more islands (six and seven)**, filling out the SW/NW corners to
balance island five's NE corner -- 7 islands, 21 crates, 7 hazards (3
patrol), 5 boost pads total now. Both new islands sit at the same
~28-unit distance from origin as island five, so `CRAFT_BOUNDARY` (40)
and the water size (84) already had enough headroom to cover them with
no adjustment -- purely content this time, confirming the world was
sized with room to grow rather than needing to be re-tuned every
addition. Two more boost pads connect the new islands to the existing
web of routes. Verified the same way as every prior island: exact
collision/sampleHeight match on both new islands, a real physics-driven
drive settling to correct grounded height on each, and a full 21-crate
playthrough resolving to the win state.

**Marquee (rectangle) select.** The one item explicitly deferred when
multi-select shipped. A mousedown that starts on empty space (nothing
for object-drag to grab) now opens a rectangle instead of doing
nothing; releasing it selects every cube/terrain whose position
projects inside it (water excluded, same reasoning as `pickEntity`).
Shift held while dragging adds to the existing selection instead of
replacing it. A ~4px movement threshold distinguishes a real marquee
from a plain click, so clicking empty space to deselect still works
exactly as before.

This needed a capability the engine's public API doesn't have:
world-to-screen projection (`Opus` only ever exposed the reverse,
screen-to-world, for placement/picking). Rather than an engine change,
built it entirely from what `Camera` already exposes publicly (`eye`,
`getBasis()`, `fovY`) -- the same perspective-projection math
`screenPointToRay`'s ray direction implies, solved in the other
direction. No friction log entry: this is a capability the *editor*
needed for its own UI, not a gap in what a game built with Opus could
already do.

Verified thoroughly: `worldToScreen` round-trips correctly (projecting
a crate's position and picking at that exact screen point hits the
same crate back), a real mousedown-drag-mouseup marquee selected
exactly the expected cluster (cross-checked against manually projected
positions beforehand, not just trusted), markers/Scene-list/inspector
all reflect the resulting selection, shift+marquee adds without
disturbing what was already selected, and a plain click with no real
movement still deselects exactly as before marquee-select existed. Full
21-crate win path re-verified unaffected.

Remaining: further content growth toward the ~30-minute target is now
a matter of repeating this same proven pattern. No editor-polish items
remain outstanding from the v0.1 list.

## Deferred items, picked back up

User direction: pursue all four deferred items (touch-in-exported-games,
asset import, node-graph scripting, mobile/touch editing), sequenced by
tractability/payoff rather than the order they were originally listed.

### Touch support in exported games (1 of 4) — done

Turned out narrower than the deferred note implied. Camera orbit and
click-based behaviors already worked on touch for free: orbit is
driven by Pointer Events (already unified across mouse/touch), and a
tap synthesizes a `click` event like any browser tap. The actual gap
was narrow but real: the hovercraft's entire movement scheme is gated
on keyboard state (`input.isDown('KeyW')`), and a touch device has no
keyboard for that to read. Fixed with two small, reusable engine
additions rather than a demo-specific hack (friction #17):
`Input.simulateKeyDown/Up` (drives the exact same key-state Sets real
keyboard events do, so `isDown`/`wasPressed` can't tell the
difference) and `HUD.addTouchButton` (a "press and hold" primitive,
distinct from `addButton`'s click-only `onClick`, for any other Opus
game using the built-in HUD). Crate Run's own virtual D-pad + boost
button are built in its own markup (the editor runs with `hud: false`,
same as every other piece of its UI chrome) and needed zero changes to
`updateCraftPhysics` — the same `isDown('KeyW')` calls now read from a
finger. Verified: `simulateKeyDown/Up` and `wasPressed` interplay
directly, all five on-screen buttons via real dispatched Pointer
Events (including `pointerleave`/`pointercancel` correctly releasing a
held key — the finger-slides-off-the-button case), a full
physics-driven drive using only simulated touch input, and
`HUD.addTouchButton` independently on a throwaway HUD-enabled instance
(exact press/release counts, clean DOM removal). Full 21-crate win
path re-verified unaffected.

### Mobile/touch editing (2 of 4) — done

Bigger than it looked, and surfaced a real bug along the way (friction
#18) that had nothing to do with touch: the editor's object-drag and
marquee-select used legacy mouse events, while the engine's own
camera-orbit-drag already listens on Pointer Events -- a real click
fires both, so every drag/marquee gesture was *also* silently
accumulating into the camera's pending orbit delta the whole time,
priming it to jump whenever a frame next consumed it. Invisible in
every prior test this session because those all dispatched
`MouseEvent`s exclusively, never the paired `PointerEvent`s a real
click actually produces. Fixed by draining `Input.consumeDrag()` every
tick an editor-owned gesture is active (no engine change needed, the
method already existed) and, since fixing it meant touching this code
anyway, converting object-drag/marquee-select from mouse events to the
matching pointer events with `activePointerId` guarding against a
second concurrent pointer. Separately, palette placement used HTML5
Drag-and-Drop, which doesn't fire on touch in most mobile browsers at
all -- replaced with a Pointer-Events-based implementation (floating
ghost element, resolves on release over the canvas) so the same code
serves mouse and touch.

Verified thoroughly: palette placement end-to-end via dispatched
Pointer Events including the "released outside the canvas places
nothing" case; object-drag landing on the exact same point as before
*and* leaving zero pending camera delta (confirmed non-zero/pending
before the fix, zero after); marquee-select re-verified under pointer
events; a second concurrent pointer confirmed fully ignored mid-
gesture; `pointerType: 'touch'` events specifically confirmed to drive
the identical code path. Full 21-crate win path re-verified
unaffected.

### Asset import (3 of 4) — done

The biggest lift of the four so far: a real glTF 2.0 parser, written
from scratch (zero-dependency is a hard constraint, so a third-party
loader was never an option). Scoped deliberately to geometry only --
no materials, textures, animations, or skinning -- because the
renderer has no texture-sampling shader path at all (uniform
per-entity color only) and `Entity` has no skinning, so parsing that
data would fill in fields nothing downstream could render anyway.
Added `Opus.Mesh.fromGLTF(input)` (a JSON string for .gltf, or an
ArrayBuffer for .glb) to `engine/src/21-gltf.js` -- a new file, which
meant renumbering the previously-last `21-api.js` to `22-api.js` (the
build's contiguous-numbering check caught this immediately if
mishandled). It walks the node hierarchy, bakes each node's TRS
transform into its vertices (`Entity` has one mesh per entity, not a
scene graph, so the whole scene flattens into one mesh), and produces
the exact same flat-array shape `Opus.Mesh.fromArrays` already
accepted -- meaning the *rendering* side needed zero new engine
capability, only the *parsing* side was new. Throws a specific reason
for anything unsupported (external `.bin` references, non-indexed or
non-triangle primitives, over 65535 vertices) rather than silently
dropping data (friction #19).

Wiring it into the editor surfaced a second real gap: Save/Load/Export
and Undo/Redo all reuse the same `serializeScene`/`loadScene` pair,
which had no way to persist an imported mesh's geometry -- there's no
source file kept around to re-import from, and a mesh's raw arrays
live in a private WeakMap by design. Fixed with a symmetric API
addition, `Opus.Mesh.toArrays(mesh)` (the inverse of `fromArrays`),
so the editor can round-trip a custom mesh's geometry through
serialization the same way it already round-trips position/color/
behaviors. Without this, importing a model and later undoing past
that point -- or just saving and reloading -- would have silently
reverted it to a plain cube, the exact class of bug friction #15 and
#18 were about, just for mesh identity instead of position.

Verified unusually thoroughly given how easy it is for a parser to be
subtly wrong in ways that don't crash: ran the raw parser directly
(bypassing the intentionally opaque public API) against hand-built
fixtures and confirmed translation baking lands on exact expected
coordinates for every vertex, a 90-degree quaternion rotation matches
the engine's own already-trusted `Mat4.rotationY` exactly, a real
spec-correct GLB binary container parses correctly including the
missing-NORMAL fallback (computed averaged face normals), and four
distinct error conditions each fail with their intended specific
message. In the editor: a full file-picker import through the real
`change` event correctly places a labeled, selectable, draggable item,
and -- the actual point of building `toArrays` -- the imported mesh
survives both Undo/Redo and a real Save/Load round-trip through
`localStorage` with the reconstructed mesh confirmed genuine, not a
silent cube fallback. Full 21-crate win path re-verified unaffected.

### Node-graph visual scripting (4 of 4) — done

Scoped per explicit direction: additive (the fixed trigger/action list
stays exactly as it is -- simple, tested, the common case), and the
graph wires together the *existing* primitives plus basic flow (AND/
OR, a named counter) rather than becoming a general-purpose visual
programming language. "Node Graph" is a new option in the same Action
dropdown as Message/Sound/Win/Lose/Boost/Objective/Custom Script; a
graph behavior's `action` is `'graph'` and its `param` slot is a
`{ nodes, edges }` structure instead of text.

**Execution model**: one implicit `start` node; `next` edges chain
action nodes in sequence; an action node may carry at most one
incoming `gate` edge from a condition node, which makes it a guard
clause (skip *this* action if false, but the sequence still continues
past it) rather than a branch -- no explicit if/else, matching the
"wire together existing actions" scope. AND/OR read their operands via
`cond` edges from other condition nodes, recursively. Node types:
seven actions mirroring the fixed list one-for-one (Message, Sound,
Win, Lose, Objective, Boost, Increment Counter) plus three conditions
(AND, OR, Counter Reaches).

**Editor**: a full-screen modal with a node canvas, drawn as plain
absolutely-positioned DOM nodes with an SVG overlay for edges (no new
rendering system -- reuses ordinary HTML/CSS/SVG, consistent with how
the rest of the editor's chrome is built outside the WebGL canvas).
Ports connect by **click, then click again** on a compatible port,
not drag-to-connect -- more forgiving than precise drag-release
hit-testing on small circular targets, and identical from touch and
mouse with no separate code path, carrying forward the touch-support
pass from earlier this phase. Connection rules (which port pairs are
valid, and which accept only one edge vs. several) are a small lookup
table checked in both click orders, since a user might click either
end of a pair first.

Wiring "Edit" into the existing behavior list (not just "Add
Behavior") surfaced the deep-clone gap the earlier `spin`/`patrol` and
mesh-identity fixes this session were about, in a new place: a graph's
`{ nodes, edges }` is a nested object, and `serializeScene`,
`loadScene`, and `duplicateSelected` all did a shallow `{ ...b }` copy
of each behavior -- fine for flat fields, but it would leave an
undo snapshot, a reload, or a duplicate sharing the *same* graph
object as its source, so editing one later would silently corrupt the
other. Fixed with one shared `cloneBehaviors()` helper (JSON round-trip
deep clone, safe since a graph is plain data) used everywhere a
behaviors array gets copied, closing the gap in all three places at
once rather than patching each call site separately.

Verified unusually thoroughly given how much surface area a UI like
this has: the execution engine directly (sequencing, counter
increment, a gated action correctly blocked until threshold *and* the
chain still continuing past the block, AND/OR composed correctly in
both directions) before any UI existed to build a graph with; then the
actual UI end to end -- toolbar buttons adding real nodes, field
inputs updating node config, port clicks connecting in both possible
click orders, an invalid port pairing correctly rejected with no edge
created, clicking the same port twice correctly cancelling, a real
`PointerEvent`-driven node drag, node deletion correctly removing its
edges (not leaving orphans), Save committing to the item's behaviors
list, and Edit reopening the exact saved graph as an independent
clone (editing it and Cancelling leaves the original untouched); then
a full integration run firing the saved graph through the *real*
`runBehaviors('enter')` dispatch path twice, confirming Win only fires
on the run where the counter actually reaches its threshold; then
undo/redo specifically re-verified to preserve the graph intact across
a full scene rebuild (the exact case the `cloneBehaviors` fix
addresses). Full 21-crate win path re-verified unaffected throughout.

---

**All four deferred items are now done.** Crate Run plays on touch
devices via virtual controls built on new, genuinely reusable engine
primitives (`Input.simulateKeyDown/Up`, `HUD.addTouchButton`); the
editor itself is touch-capable end to end (placement, object-drag,
marquee-select, and a real pre-existing camera-drag bug fixed along
the way); real 3D models import via a from-scratch glTF 2.0 parser
(`Opus.Mesh.fromGLTF`, paired with the new `Opus.Mesh.toArrays` for
persistence); and behaviors can now be built visually as well as
through the fixed dropdown or Custom Script. Every item shipped as a
genuine, reusable Opus API addition proven by using it in Crate Run,
not a demo-only shortcut -- the same discipline this whole session has
followed from friction #1 onward.

**Dogfooding the two biggest additions on real shipped content**, not
just their own test suites: a beacon landmark on the home island,
imported via `Opus.Mesh.fromGLTF` from a genuinely multi-node model (a
pole and a beacon light, two mesh nodes at two different transforms,
flattened into one mesh) rather than another synthetic single-node
fixture; and a bonus crate authored entirely with the node-graph
editor (start → Increment Counter → Message) instead of Custom
Script, wired into the real trigger system. Verified both directly:
the beacon's bounding box matches the expected pole-to-light extent
exactly, and the bonus crate's graph fires correctly through the real
`playTriggers` dispatch without ending the game (it's optional content,
not gated into the win condition) -- while the main 21-crate win path
stays completely unaffected.

Digital Opus Engine's actual product goal is a drag-and-drop, no-code-as-far-as-
feasible game builder. The `window.Opus` JS API and the Delivery Run demo are the
proven runtime underneath that — infrastructure, not the end product. This
supersedes the earlier v0.1.1 → v1.0 "stay code-first forever, no editor" plan;
that plan is no longer the direction.

**"No-code as far as feasible" is a real constraint, not a slogan.** Unity hasn't
fully achieved no-code with orders of magnitude more resources than this project
has. The honest goal: push placement, configuration, and common game logic as far
into visual/drag-and-drop territory as is actually achievable at this scale, and
accept a scripting escape hatch for anything that isn't — not chase an impossible
zero-code bar and ship nothing.

## Product principles (revised)

- The editor is the product. The JS API stays fully documented and supported —
  the editor is built on it, not a replacement for it — but it's no longer the
  primary surface end users touch.
- No-code where it's genuinely achievable (object placement, property editing,
  common triggers/behaviors); a code escape hatch where it isn't, rather than
  a half-working visual abstraction over something code does better.
- Keep proving every capability through actually using it — same dogfooding
  discipline as the runtime (see `API-FRICTION.md`), applied to the editor now.
- Zero dependencies stays non-negotiable for both the runtime and the editor
  itself. The editor is an Opus-powered app, same as any game built with it.
- Bundle size is tracked, not capped (unchanged from the previous revision) —
  an editor UI needs room the old ~80KB ceiling didn't leave.

## Editor v0 — prove the core no-code loop

Priority: **Now**

The smallest real test of "no-code scene composition": place an object, edit it
without writing JS, see it live, get something playable out.

- A self-contained editor app (`editor/`), built on the Opus runtime, same
  single-file-no-build-step house style as the rest of Digital Opus's tools.
- A live 3D viewport (an actual running `Opus` scene, not a mockup).
- A palette of draggable object types, starting minimal (one prop type) and
  widening once the core loop is proven — not the other way around.
- Drag from palette onto the viewport places an entity.
- Click-to-select plus an inspector panel for editing position/color/scale
  (and later terrain/water/light-specific properties) with no code required.
- Scene serialization (JSON) and a way to preview/export what was built as a
  playable page.

Exit criteria: someone can place a handful of objects, adjust them, and get a
working preview, having written zero JavaScript.

## Editor v0.1 — widen placement + persistence

Priority: **Next**

- Add terrain, water, particles, and lighting to the palette, each with an
  inspector tailored to its real parameters (seed/size for terrain, wave
  config for water, etc.) rather than generic position/color fields.
- Save/load editor projects (reuse `SaveSystem`/localStorage first; file
  export/import once the in-browser loop is solid).
- Undo/redo for placement and property edits.
- Multi-select and basic transform gizmos in the viewport itself, not just
  number-input editing.

## Editor v0.2 — visual behavior, the actual no-code test

Priority: **Next**

This is where "no-code" is actually decided — everything before this is just
a scene composer. Scope deliberately small and honest about the ceiling:

- A small, fixed set of visual triggers and actions (on-enter/on-click/on-timer
  → play sound / show message / move object / change scene state), not a
  general node-graph visual scripting system.
- Win/lose/objective primitives exposed as visual configuration, reusing the
  same HUD primitives Delivery Run already proved out.
- An explicit, well-labeled "Advanced: custom script" escape hatch for game
  logic that doesn't fit the visual primitives — no pretending everything is
  reachable without code.

Exit criteria: a genuinely new small game (not Delivery Run) can be built in
the editor by someone who did not write JavaScript for it, with only the
custom-script hatch used for anything visual triggers couldn't express.

## Deferred, revisited later

Node-graph visual scripting, asset import (glTF), and mobile/touch
editing — all originally listed here — are done; see the "Deferred
items, picked back up" section above for what shipped and how it was
verified. Still deferred:

- Multiplayer/networking — a fundamentally different kind of undertaking
  (netcode, an authoritative-vs-peer-to-peer hosting decision, likely
  client prediction/reconciliation for a physics-simulated game) that
  warrants its own direction-setting conversation before any code, not
  something to default into.

## How roadmap work is selected

Same discipline as before: a capability earns its place in the editor by
being needed to build something real in it, not by being speculatively
useful. Record friction, build the smallest reusable capability, prove it
by using it, document it.
