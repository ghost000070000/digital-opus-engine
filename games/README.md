# Digital Opus games

Every project below started as an engineering dogfood build (stress-testing
one Capability Wave or another), but they're real, playable projects now --
this directory is the editable **source** for the whole game catalog, not
just an engineering fixture folder.

## Quick Play

The fastest way to actually play these: open the generated launcher,
`dist/games/index.html`, in a browser. No editor, no import, no file picker
-- click a game, it plays. (Run `node build/build.js && node build/build-games.js`
first if `dist/games/` doesn't exist yet or looks stale.) Each game also has
its own standalone build at `dist/games/<id>.html` -- genuinely self-contained
(no adjacent files, no network dependency), so a single `.html` file can be
copied anywhere and still play.

## Edit a Game

Open `editor/index.html`, click the **Games** tab (top-left of the editor
panel), pick a card, and click **Open in Editor**. That loads the exact same
project this README describes, fully editable -- move things around, Save
As under a new name, Export your own build. The bundled sample itself is
never overwritten; "Open in Editor" always loads a pristine copy.

## Raw Source

The files in this directory (`games/*.json`) remain available for manual
use exactly as before: **Project → Import Project JSON** in the editor still
works, still requires no changes, and is still how you'd load a project file
you didn't get from the built-in catalog. `games/catalog.json` is the single
metadata source (title, genre, description, category) that drives the
editor's own Games tab, the static launcher, and the build-time playable-HTML
generator (`build/build-games.js`) -- see `GAME-CATALOG-AND-PLAYABLE-BUILDS-REPORT.md`
at the repo root for the full story of how that pass turned this backlog into
a real product surface.

The rest of this file is the original engineering history: what each project
was built to stress-test, and how it was verified at the time. Kept as-is,
below, as a real record -- not erased just because the games it describes are
now also real, presentable products.

## Wave 2 stress games

Built to dogfood the Capability Expansion Wave 2 systems (Player Controllers,
Camera authoring, Health/Damage, Timers/Delay, HUD/UI authoring, Flags, Tags,
Tweens, AI Wave 2, Interact, Inventory, Save Game) together, in real playable
games, not in isolation. Each was built the same way as the games below —
through the real editor functions (`placeItem`, behavior arrays, Node Graph
data structures), never by hand-writing the JSON from scratch — and verified
by actually playing it through in a real browser session: walking into
triggers, firing Interact, taking damage, running out the clock, winning,
and losing, all confirmed against the live `window.__gameState`/DOM, not
just written and assumed correct.

### relic-island.json — Relic Island (third-person adventure)

Third-Person Controller, Camera-relative movement across an open island.
Collect 3 Relics (Counter + HUD Counter Display), find a Key (Inventory:
Give Item) to unlock a Gate via an NPC Lever (**On Interact**, gated by a
Node Graph **Has Item** check — wrong answer shows "locked", right answer
**Tweens** the gate open), avoid a Lava **Damage Zone** (**On Stay** +
Damage Player with a cooldown, plus a Node Graph **Health At Most(0) → Lose**
check), reach the Shrine gated on **Counter Reaches(relics, 3)** to Win. A
configured **Start Screen**, **Health Bar** HUD, and per-level **Win/Lose**
title/message. Verified: relic pickup, locked-vs-unlocked lever branches,
gate tween completing at its target position, Win correctly refused before
3 relics and correctly firing after, and Lose firing after sustained lava
damage — with the configured (not default) Win/Lose text confirmed on screen
both times.

### dungeon-descent.json — Dungeon Descent (top-down dungeon/puzzle)

Top-Down Controller navigating a walled corridor (10 solid Wall segments —
real `resolveBoxCollision` blocking, not just a visual maze). Two **Flags**
(`switchA`/`switchB`) set by two Trigger Volume switches in separate rooms;
either switch re-checks both flags via a Node Graph **AND** node and
**Tweens** a solid Gate open only once both are true (hitting either switch
first, or both in either order, all verified). A **Timer** counts elapsed
run time in a HUD **Timer Display**. Reaching the Exit past the open gate
Wins. Verified: Switch A alone leaves the gate closed, Switch B afterward
correctly opens it (AND-gate re-evaluated from either switch), the Timer
HUD reads live elapsed seconds, and Win fires with the configured title.

### survival-arena-2.json — Survival Arena 2.0 (rebuilt with generalized systems)

The original `survival-arena.json`'s "dodge the Hunters" concept, rebuilt on
Wave 2's generalized systems instead of hand-rolled counters: a reusable
**Hunter enemy prefab** (AI **Follow**, **On Stay** Damage Player with a
cooldown, a Node Graph **Health At Most(0) → Lose** check) spawned in two
real waves via **Spawn Prefab** chained through Node Graph **Delay** nodes
(12s, then 20s) — no manually pre-placed "fake" enemies, every Hunter in the
scene at runtime was actually spawned by the graph. A **Health Bar** and a
**Survived: Ns** Timer HUD track state; central water-ringed arena reuses
the Hovercraft controller. Verified twice: once letting a stationary player
take real contact damage from real AI-driven Hunters through to Lose (health
hit exactly 0, "Overwhelmed" shown), and once with health temporarily raised
to confirm the full two-wave graph runs to completion and Win fires
("You Survived!") — both runs used the actual spawned enemy count (6 total
across both waves, confirmed via `entity.ai.type === 'follow'`), not a
placeholder.

**Not built in Wave 2**: the optional platformer stress game — there was no
jump/gravity primitive yet, so building one would have meant faking the one
mechanic a platformer is supposed to stress-test. Built in Wave 3 once a
real vertical-physics primitive existed to justify it — see
`skyway-trial.json` below.

## Wave 3 stress games

### skyway-trial.json — Skyway Trial (platformer, vertical physics gate)

Built to prove the Wave 3 **Vertical Physics Gate** (gravity/jump/grounded-
state, see CHANGELOG.md and API-FRICTION.md finding #49) with a real,
completable game, not just isolated physics steps. Third-Person Controller
with **Jump enabled** (Gravity 20, Jump Speed 8), a Start Platform, and a
straight-line staircase of 5 floating solid platforms rising in height
(0.5 → 4.5) and receding in Z, each a real single-jump apart at this
controller's tuned Move Speed/Jump Speed/Gravity. A **Win** Trigger Volume
sits over the final platform; a wide, low **Fall Zone** Trigger Volume
(`Opus.Physics.TriggerVolume`'s radius derived from scale, sized and
positioned to sit well clear of every platform and the start pad — see the
friction-log entry for why a naive box-shaped volume didn't work, it's
actually a sphere) catches a missed jump and fires **Lose**.

Verified end-to-end, twice: (1) walking forward off the Start Platform with
no jump input falls straight into the Fall Zone and Loses; (2) jumping at
every landing traverses the full 5-platform staircase and reaches the Win
Trigger — re-verified identically after a fresh `fetch()` +
`loadProjectFull()` round-trip of the exact shipped file, not just the
in-memory session that built it. Zero console errors either run.

**Also surfaced while building this**: `computeSpawnPoint()` only accounts
for terrain/water height, not an arbitrary solid platform used as a level's
actual ground — spawning a player on a bare solid-cube start pad requires
manually placing that platform so its top sits at world Y=0 (matching
`computeSpawnPoint`'s implicit "ground is at 0" assumption), documented as
a known authoring constraint rather than fixed at the engine level (fixing
it generally would mean a raycast-down-to-nearest-solid spawn search, out of
scope for this pass — noted for a future wave).

### textured-adventure.json — Textured Adventure (texture stress game)

Built to prove the Wave 3 Texture system with a real completable game, not
just an object with a texture applied in isolation. Third-Person Controller
across an open terrain map with three distinctly-textured Relic pickups
(Stone/Sandstone/Mossy Brick — three separate imported checkerboard PNGs,
not the same texture reused three times), each spinning and, on touch,
incrementing a shared `relics` Counter, hiding itself (Set Visibility), and
playing a pickup chime. A textured Hazard slab (damage-over-time via **On
Stay** + Damage Player with a cooldown, plus a Node Graph **Health At
Most(0) → Lose** check) sits off the direct path. A textured Shrine gated on
**Counter Reaches(relics, 3)** fires Win. A HUD Counter Display and Health
Bar track both live.

Verified end-to-end both ways: collecting all 3 relics and reaching the
Shrine fires Win with the configured title ("Shrine Restored"); standing in
the Hazard long enough fires Lose with its own configured title ("Consumed
by the Ruins") — both re-verified after a fresh `fetch()` +
`loadProjectFull()` round-trip of the exact shipped file, confirming all
three imported textures (not just the geometry/behaviors) survive the
round-trip and re-attach via the async texture-decode path. Zero console
errors either run.

### survival-arena-3.json — Survival Arena 3 (Spawner-based rebuild)

A second rebuild of the "dodge the Hunters" concept — this time to stress
the Wave 2 **Spawner object** specifically, replacing Survival Arena 2.0's
hand-wired Delay-chain wave logic with a single real `Spawner` (prefab
`Hunter`, interval 4s, initial delay 1.5s, max 4 active, 10 total) inside a
water-ringed arena, plus a hidden timer cube (On Start → Delay 20s → Win) as
the survival clock, on the Hovercraft controller.

Building and exporting this file surfaced a real, previously-undiscovered
bug: `usedPrefabNames()` — which decides which locally-saved prefabs an
export actually bundles — only recognized a prefab referenced through the
`spawnPrefab` action, never through a Spawner object's own
`options.prefabName`. A level depending entirely on a Spawner would export
silently with `prefabs: []`, working fine in the same authoring session
(the prefab is still in that browser's local library) and then spawning
nothing at all, forever, with no error, on any fresh machine. Fixed — see
CHANGELOG.md and API-FRICTION.md finding #56 for the full diagnosis and fix.

Verified the fix directly, not just re-exported and assumed: cleared every
prefab from the browser's local library, fresh-loaded the exported file, and
confirmed the Spawner still successfully spawns real Hunter instances from
the now-correctly-bundled prefab. Zero console errors; `node
tests/run-tests.js` stayed at 23/23 throughout.

### npc-puzzle-adventure.json — The Sanctum Key (Dialogue/Interact/Inventory puzzle-adventure)

Built to stress branching Dialogue, Interact, Inventory, Flags, a solid
door, a Tween, a Camera change, and a multi-level transition all composing
together — deliberately no Custom Script anywhere in the file. Two levels,
"Village" (Start Level) and "Inner Sanctum", Third-Person Controller.

An NPC (Sailor) carries two independent `interact` behaviors on the same
object: a branching **Dialogue Tree** (offers a key; choosing it sets the
`talkedToSailor` flag and advances to a closing line) and, separately, a
Node Graph gated on that same flag (**Is Flag True → Give Item(key) → Set
Flag True(hasKey)**) — the two systems coordinate purely through shared
flag state, with neither one calling into the other. A DoorSwitch's Node
Graph (**Has Item(key) → Move To (Tween) → Change Camera → Show Message**)
tweens a solid Door open and cuts to a dedicated Camera object for the
reveal. A trigger past the door fires Next Level into "Inner Sanctum",
whose own trigger fires Win.

Verified the complete path end-to-end live in Play mode against the actual
exported file (not just the authoring session): first Interact shows
exactly one dialogue choice with zero starting inventory; choosing it sets
the flag and advances the conversation; re-interacting (flag now true)
grants the key through the graph, with the dialogue's harmless re-offer of
the same already-answered choice not interfering; the DoorSwitch's `Has
Item` gate correctly blocks with no key and passes with one; the door tween
lands exactly on its configured target position; the level trigger advances
`currentLevelIndex` and correctly respawns the player in "Inner Sanctum";
the Sanctum's own trigger fires Win with its configured title ("The Sanctum
Yields Its Secret"). Re-verified identically after a fresh `fetch()` +
`loadProjectFull()` round-trip of the exact shipped file. Zero console
errors either run (aside from the sandbox's known headless-AudioContext
warning, present across every game built this session and unrelated to any
product code).

## Wave 4 stress games

### opus-arena.json — Opus Arena (third-person arena shooter)

Built to prove Object Health, Fire Projectile, Enemy Ranged Attack, the
Player Weapon, and a Spawner all working together in one real game — none of
these had previously been combined. Third-Person Controller, 100 max health,
a Weapon (prefab `Bolt`, 20 damage, 22 speed). A "Grunt" enemy prefab (tagged
`enemy`, AI **Follow** + **Enemy Ranged Attack** targeting the Player with
its own Bolt-firing attack, plus **On Stay** Damage Player) spawns in waves
via a **Spawner** (interval 3s, up to 4 active, 8 total). A hidden
GameManager Trigger Volume covering the arena resets a `kills` counter On
Start and runs two Node Graphs every frame: **Win** on **Counter Reaches
(kills, 8)**, **Lose** on **Health At Most(0)**. `tickProjectiles` was
extended to increment `window.__gameState.kills` (a fixed key, matching how
Player Health's own `window.__gameState.health` already works) whenever a
tagged object's Object Health reaches 0 from a projectile hit, so Win needs
zero extra wiring beyond Fire Projectile + Object Health, both pre-existing.
A HUD Health Bar and `Kills: {value}/8` Counter Display track both live.

Exporting this file surfaced a second instance of the exact bug class
finding #56 (Survival Arena 3) already found: `usedPrefabNames()` recognized
a Spawner's `options.prefabName` but not an AI's own `attackPrefab` (Enemy
Ranged Attack) or the Fire Projectile action/node's `prefabName`, and had no
way to see `playerSettings.weapon.prefabName` at all (project-level, not
object-level). A scene using all three reference shapes at once exported
with `prefabs.length === 1`, silently dropping "Bolt". Fixed — see
CHANGELOG.md and API-FRICTION.md finding #59 for the full diagnosis and fix.

Verified the fix directly: rebuilt the scene fresh through the real editor
functions after the fix landed and confirmed `serializeProject().prefabs`
returns both `"Bolt"` and `"Grunt"` (`prefabCount: 2`, previously 1). Fired a
projectile at a 1-HP Grunt and confirmed `window.__gameState.kills`
incremented and the Grunt was cleanly removed from the scene, in one atomic
fire+tick script (avoiding the cross-call background-render-loop timing trap
this session's own projectile tests already documented). Re-verified all of
the above after a fresh `fetch()` + `loadProjectFull()` round-trip of the
exact shipped file. Zero console errors; `node tests/run-tests.js` stayed at
23/23 throughout.

### power-station.json — Power Station (hierarchy/machine puzzle)

Built to prove real transform hierarchy (parent/child), Property Animation,
Interact, Inventory-lite, branching Dialogue, placeable Lighting, and
Materials 2.0 all composing together in one game. A two-part Turbine (a
Base parent + a glowing `unlit`/emissive Rotor child) sits under a warm
point light. Interacting with the Base runs a Node Graph gated on **Has
Item(fuelCell, 3)**: below 3 it shows a message; at 3 it **Play Animation**s
a looping spin clip on the Rotor and fires **Win**. Two Fuel Cells sit in
the open (Interact → Give Item + Set Visibility + message); a third sits
behind a locked Gate that only opens after a branching **Dialogue Tree**
with an NPC sets a flag, and a separate Shed Switch's own Node Graph
**Tweens** the Gate open once that flag is true — the same
Dialogue-sets-flag/Switch-tweens-Gate pattern `npc-puzzle-adventure.json`
already established, reused rather than reinvented.

Verified every mechanic directly against live behavior/graph execution: the
Turbine correctly refuses to spin/Win below 3 Fuel Cells and correctly does
both at 3; a Fuel Cell's Interact behavior increments the inventory by
exactly 1; the Shed Switch's Tween only fires once the dialogue-set flag is
true, confirmed by tracing the Gate's Y position through the full unlock
sequence. Re-verified after a fresh `fetch()` + `loadProjectFull()`
round-trip, including that the Rotor's hierarchy parenting and animation
clip both survive intact. Zero console errors; `node tests/run-tests.js`
stayed at 23/23.

### valley-run.json — Valley Run (sculpted terrain / platforming / patrol)

Built to prove real Terrain Sculpting (brush strokes chained into an
actually-different shape, not a random seed alone), a jump/platform section,
a Waypoint-route patrol hazard, a Checkpoint/Respawn cycle, and multiple
placeable Lights/tuned Environment together. A long valley is sculpted
directly with the real brush-application function (raised ridges, a
flattened path, then a deep chasm carved across it) — the same function the
Sculpt Mode UI itself calls per dab. Four floating platforms bridge the
chasm. A Checkpoint Trigger sits before it; a Fall Zone inside fires
**Respawn At Checkpoint** rather than a hard Lose. A "Sentry" hazard patrols
between two named Waypoints (**Patrol Route**, ping-pong) with contact
damage. Two placeable Lights and a tuned Environment replace the default
lighting. An explicit Spawn Point closes the `computeSpawnPoint()`
ambiguity finding #51 already documented for a bare-terrain level.

Verified the sculpted terrain's collision matches its render height
bit-for-bit; Checkpoint/Fall Zone/Win all fire correctly via direct behavior
execution; the Sentry correctly walks its full patrol route. Two real
dev-environment gaps were found and worked around while building this (not
product bugs): this session's preview browser doesn't fire
`requestAnimationFrame` while unattended, requiring the engine's per-frame
callbacks to be driven manually with an explicit `dt` to observe AI motion;
and hand-copying the sculpted terrain's ~529-element height-delta array from
the browser twice produced a file 1-2 elements short, resolved by having the
browser `fetch()`-POST the real export straight to a small local file-write
endpoint instead of transcribing it by hand. The shipped file was confirmed
byte-exact (`deltas.length === 529`) and fully re-verified after a fresh
`fetch()` + `loadProjectFull()` round-trip. Zero console errors; `node
tests/run-tests.js` stayed at 23/23.

### sentinel-maze.json — Sentinel Maze (waypoint pathfinding vs. a real maze)

The spec's own required test for Waypoint Graph pathfinding against a real
maze, not open terrain: a solid Wall spans the level with a gap on one side;
the Player spawns on one side, a "Sentinel" enemy (**Navigate To Target**)
spawns directly across on the other, so a straight line between them crosses
the wall. A 3-Waypoint chain routes around through the gap. Reach the Exit
before the Sentinel (contact damage) catches you.

Building this required test surfaced a real, previously-undiscovered bug in
Waypoint Graph pathfinding: the periodic route recompute could flip-flop
between two waypoints whenever the AI was near the midpoint of a route leg,
resetting its progress and oscillating forever instead of advancing — a
different failure mode from the `offGraph` tail-jitter fixed earlier this
wave. Fixed by seeding the recompute from the waypoint the AI is currently
heading to rather than "nearest to raw position" once a route is already in
progress. See CHANGELOG.md and API-FRICTION.md finding #60.

Verified against the fix: traced the Sentinel's position and confirmed
`navPathIndex` now advances monotonically with zero oscillation; confirmed a
direct Sentinel→Player line does cross the wall (the maze tests something
real) while the Sentinel's actual path never enters the wall's footprint;
confirmed it reaches the Player after the full route, and correctly
re-routes when the Player moves mid-chase. Re-verified after a fresh
`fetch()` + `loadProjectFull()` round-trip. Zero console errors; `node
tests/run-tests.js` stayed at 23/23.

## survival-arena.json — Game C: Survival/Arena

Stress-tests runtime spawning and state (AI Behavior, Trigger Volumes, the
shared action/Node Graph core, and named-counter game state), independent of
Crate Run's own systems.

- 3 red "Hunter" enemies (AI Behavior: Follow) chase the player continuously.
- Touching one costs 1 health (starts at 3, set via an On Start behavior) and
  shows a hit message; health reaching 0 loses.
- 4 gold "Orb" pickups disappear and increment a `collected` counter on
  touch; collecting all 4 wins.
- Everything is built from the shared action vocabulary and Node Graph
  conditions (Decrement Counter, Counter At Most, Increment Counter, Counter
  Reaches) — no Custom Script.

Found and fixed while building this: `counterReaches` (`>=`) is the wrong
comparison for a *falling* counter like health reaching a floor — see
API-FRICTION.md finding #31 for the `counterAtMost` (`<=`) fix that came out
of it.

## temple-switch-puzzle.json — Game B: Temple/Switch Puzzle

Stress-tests object references and cross-object logic: two one-shot Trigger
Volume switches must both be activated before a real, physically solid
Door will open.

- Two "Switch" Trigger Volumes (one-shot: `triggerRepeat: false`), each
  incrementing a shared `switches` counter and, once both have been hit,
  changing the color of and hiding a *specific other object* — "Door" —
  via its stable id, not a search by name or position.
- "Door" is a solid (`Physics.resolveBoxCollision`-backed) cube that
  physically blocks the path to the Goal until both switches are hit;
  hiding it (Show/Hide Object) doubles as opening it, since an invisible
  solid object doesn't block movement.
- "Goal" always shows a hint message on entry, but only fires Win once
  `switches` reaches 2 (Node Graph gate) — reachable at all only once the
  Door has actually opened.

Verified two things specifically: object references survive a rename
mid-session (a switch's stored target id for Door kept resolving correctly
after renaming that object, since it's an id lookup via `findItemById`,
never a name lookup); and the Door is a genuine physical obstacle, not just
a visual — verified with real deterministic 60Hz physics stepping that the
craft is stopped at the Door's face before both switches are hit, and
passes straight through once it opens.

## crate-run-expanded.patch.js — Game A: Crate Run Expanded

Not a from-scratch scene like the two above — a real evolution of the
*shipped* Crate Run starter game's mechanics, not just more islands.
Applied as a small patch script (see the file for exact usage) rather than
a second full scene export, since duplicating all 47 starter-game objects
(mostly identical crates/terrain the base game already ships) into a ~49KB
JSON file would mostly be redundant copies of content that already exists.

- Replaces every hazard's instant Lose with a 3-life system: touching one
  costs a life, shows a hit message, and respawns you at your last
  checkpoint; only the third hit ends the game.
- Adds three Checkpoint Trigger Volumes near the farther islands.
- The existing 21-crate collection win condition is untouched.

Verified by fetching and running the exact shipped file (not a re-typed
copy): the life/respawn/lose sequence fires correctly across three hits,
including falling back to the normal spawn point before any checkpoint has
been touched and to the correct checkpoint after, and the full 21-crate win
path is unaffected.

## signal-relay.json — Signal Relay (first-person stealth/objective)

A small facility stealth game, not a stress test dressed up as one:
restore power at three Relay Consoles while avoiding two patrolling
security drones, then extract. First-Person Controller with a hitscan
Sidearm (muzzle/impact effects, tracer). One linked, parameterized
`RelayConsole` Prefab (a Color parameter, three per-instance tints); two
State-Machine drones (Patrol/Alert/Attack/Investigate, real Perception);
a Scatter Layer of pipe-clutter decoration painted with the real Brush; a
Start Screen, Save/Continue, and a real Win (Extraction) and Lose
(health-triggered) state. Carries one real imported Model (an original
glTF "Relay Console" prop), Texture ("facility-hazard-panel"), and Audio
clip ("data-core-pickup-chime"), each pushed through the real Import UI
and verified surviving a clean-room Playable Export with zero dependency
on the editor's own session, cache, or dev-server paths.

## foglight.json — Foglight (third-person atmospheric adventure)

A ~15-minute traversal/exploration game, deliberately built on a
different slice of the engine than Signal Relay: Third-Person Controller
with real jump-based platforming (not First-Person, no weapons). Explore
a misty vale, cross two stepping-stone traversal sections (real jumps
across gaps, with a forgiving "fall into the mist" hazard that damages
and respawns at the nearest Checkpoint rather than ending the run), find
the Vale Key past a Mist Guardian's territory to pass a locked Gate, and
light three Foglights (one parameterized Prefab, per-instance tinted) to
open the Sanctuary. The Guardian is a real animated, skinned enemy (an
original 2-joint glTF creature with a "Lurch" clip) patrolling a real
authored Path and breaking into a chase when the player gets close. One
Item Definition (Vale Key), one Scatter Layer (moss groundcover), real
Save/Continue, Stop/Play-safe object state, and a real Win (reach the
Sanctuary) and Lose (health depletion) state. Carries one real imported
skinned Model, Texture ("moss-stone"), and Audio clip ("beacon-ignite"),
each pushed through the real Import UI and verified surviving a
clean-room Playable Export.
