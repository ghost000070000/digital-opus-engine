// --- Hovercraft player controller ---
// Ported from the earlier standalone Delivery Run demo: one game, not two
// disconnected demos. Driving to a crate is a much more compelling proof
// of "built with this editor" than clicking a static cube with a mouse.
// Movement/collision/hover math is unchanged from the proven original;
// only the terrain/water source (looked up from `placed`, not a fixed
// module-level const) and emitter lifecycle (spawned/removed per play
// session via the new removeEmitter API) are new.

const MAP_BOUNDARY = 40; // must clear all five islands (farthest: (20,20) center + radius 9 ≈ 37.3)

// Touch devices have no physical keyboard, so WASD/Space have nothing to
// read -- on-screen buttons drive the exact same key state via the new
// Input.simulateKeyDown/Up, so updateCraftPhysics below needs zero changes.
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
// `codeOrGetter` accepts a fixed key code (unrebindable buttons -- none of
// these five actually are anymore, kept for generality) OR a function
// returning the CURRENT code (Wave 5: Move/Jump/Boost are all rebindable
// via inputActionMap, and this touch button must invoke the same LOGICAL
// action, not whatever key happened to be bound when the page first
// loaded). The code is resolved once at press time and reused for the
// matching release, so a rebind mid-press can't release the wrong key.
function markGameplayPointerDevice(event) {
  if (!playMode || gameEnded) return;
  app.input.markDevice?.(event.pointerType==='touch'||event.pointerType==='pen'?'touch':'keyboard-mouse');
}
function wireTouchButton(id, codeOrGetter, onPress, options) {
  const btn = document.getElementById(id);
  const resolveCode = () => (typeof codeOrGetter === 'function' ? codeOrGetter() : codeOrGetter);
  const heldPointers = new Map();
  const press = (e) => { e.preventDefault();if(options?.guard&&!options.guard())return;const pointer=e.pointerId??'primary',source=`touch:${id}:${pointer}`,previous=heldPointers.get(pointer);if(previous)app.input.simulateKeyUp(previous,source);const code=resolveCode();if(typeof code!=='string'||!code)return;if(options?.capture&&e.pointerId!==undefined)btn.setPointerCapture?.(e.pointerId);markGameplayPointerDevice(e);heldPointers.set(pointer,code);app.input.simulateKeyDown(code,source);if(onPress)onPress(); };
  const release = (e) => { e.preventDefault(); const pointer=e.pointerId??'primary',code=heldPointers.get(pointer);if(code)app.input.simulateKeyUp(code,`touch:${id}:${pointer}`);heldPointers.delete(pointer); };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('pointercancel', release);
  if(options?.capture)btn.addEventListener('lostpointercapture',release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn._releaseTouchInput=()=>{for(const [pointer,code] of heldPointers)app.input.simulateKeyUp(code,`touch:${id}:${pointer}`);heldPointers.clear();};
}
wireTouchButton('touch-up', () => inputTouchActionCode('moveForward'));
wireTouchButton('touch-down', () => inputTouchActionCode('moveBack'));
wireTouchButton('touch-left', () => inputTouchActionCode('moveLeft'));
wireTouchButton('touch-right', () => inputTouchActionCode('moveRight'));
wireTouchButton('touch-boost', () => inputTouchActionCode('jump'));

let craft = null;
let craftParts = [];
let craftVelocity = null;
let craftSteering = 0;
let craftBoostActive = 0;
let craftBoostCooldown = 0;
let craftExhaust = null;
let craftSpray = null;
let craftFoam = null;

// Generic player accessor -- every controller (hovercraft today, more to
// come) populates this on spawn so consumer code (camera, AI follow,
// triggers, checkpoints, the boost action) never needs to know which
// controller is active. `entity`/`radius`/`controllerType` are set once at
// spawn; `velocity` is a getter/setter delegating to the controller's own
// state variable (which gets *reassigned*, not mutated, every frame) so it
// always reflects the live value without the hovercraft's proven physics
// code having to change how it stores that state.
let player = null;
// Logic-check pass: no jump-enabled controller (topdown-with-jump,
// third-person, first-person) had ANY recovery from walking/jumping off the
// edge of placed floor geometry into open space -- none of the 28 catalog
// games place explicit `terrain` objects, so `currentTerrainItem()` returns
// null and there is no fallback ground height once you clear the last box
// collider; `applyMapBoundary` only ever nudges XZ, never Y. The result,
// confirmed live: fall off any ledge and free-fall forever with the level
// receding above you -- exactly the "jump off map and get stuck" report.
// Fixed once, at the single per-frame choke point every controller already
// funnels through (`updatePlayerController`), reusing the exact same
// recovery the `respawnAtCheckpoint` behavior-graph action already used for
// hazards: checkpoint if one's been set, else `computeSpawnPoint()`. Not a
// per-level authoring fix (which would need retrofitting 23 existing
// projects with a manual void-trigger volume each) -- this is unconditional
// for every controller, so it can never be missed on a level.
const VOID_FALL_MARGIN = 30; // generous: real jumps/falls off a platform are a few units, not 30
let voidFallY = -Infinity;

const PLAYER_CONTROLLERS = {
  hovercraft: { spawn: spawnHovercraftController, despawn: despawnHovercraftController, update: updateHovercraftController },
  topdown: { spawn: spawnTopDownController, despawn: despawnTopDownController, update: updateTopDownController },
  thirdperson: { spawn: spawnThirdPersonController, despawn: despawnThirdPersonController, update: updateThirdPersonController },
  firstperson: { spawn: spawnFirstPersonController, despawn: despawnFirstPersonController, update: updateFirstPersonController },
};

// Always spawns using `currentPlayerSettings` (set by applyLevelPlayerSettings
// before Play starts / a level switches), so it never needs its own type
// argument -- one fewer place that could disagree with the Player panel.
