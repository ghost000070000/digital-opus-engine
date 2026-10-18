// --- Top-down player controller ---
// Direct WASD/arrow/touch movement on the XZ plane (no steering, no hover) --
// same terrain/water lookup and solid-collision primitives as the
// hovercraft, just simpler integration since there's no lateral drift to
// resist. Reuses the same touch buttons (they drive KeyW/A/S/D key state,
// which this reads exactly like a real keyboard would).
let topdownEntity = null;
let topdownVelocity = null;

function spawnTopDownController(position) {
  const settings = currentPlayerSettings;
  topdownEntity = app.addEntity({ mesh: cubeMesh, color: [0.85, 0.35, 0.2], position: position.clone(), scale: new Opus.Vec3(0.7, 0.7, 0.7) });
  topdownVelocity = new Opus.Vec3();

  app.camera.setTarget(topdownEntity);
  app.camera.setChaseOptions({ distance: 9, height: 13, pitch: 1.35, lerpSpeed: 7, rotationLerpSpeed: 8, lookAhead: 0 });
  app.camera.setMode('chase');

  if (isTouchDevice) document.getElementById('touch-controls').classList.add('visible');

  player = {
    controllerType: 'topdown',
    entity: topdownEntity,
    radius: settings.collisionRadius || 0.5,
    get velocity() { return topdownVelocity; },
    set velocity(v) { topdownVelocity = v; },
  };
}

function despawnTopDownController() {
  if (!topdownEntity) return;
  app.scene.remove(topdownEntity);
  topdownEntity = null;
  topdownVelocity = null;
  app.camera.setTarget(null);
  app.camera.setMode('orbit');
  document.getElementById('touch-controls').classList.remove('visible');
  player = null;
}

function updateTopDownController(dt) {
  if (!topdownEntity) return null;
  const settings = currentPlayerSettings;
  const speed = settings.moveSpeed || 6;
  const accel = settings.acceleration || 24;
  const input = app.input;
  let x = 0, z = 0;
  if (inputActionDown('moveForward','ArrowUp')) z -= 1;
  if (inputActionDown('moveBack','ArrowDown')) z += 1;
  if (inputActionDown('moveLeft','ArrowLeft')) x -= 1;
  if (inputActionDown('moveRight','ArrowRight')) x += 1;
  const moveDir = new Opus.Vec3(x, 0, z);
  const previousPosition = topdownEntity.position.clone();
  if (moveDir.length() > 0) {
    const target = moveDir.normalize().scale(speed);
    topdownVelocity = topdownVelocity.add(target.sub(topdownVelocity).scale(Math.min(1, (accel * dt) / speed)));
    if (settings.rotateToMovement) topdownEntity.rotationY = Math.atan2(x, -z);
  } else {
    topdownVelocity = topdownVelocity.scale(Math.exp(-0.6 * (accel / 10) * dt));
  }
  topdownEntity.position = topdownEntity.position.add(topdownVelocity.scale(dt));

  const terrainItem = currentTerrainItem(topdownEntity.position);
  if (terrainItem) {
    const collision = Opus.Physics.resolveTerrainCollision(topdownEntity.position, topdownVelocity, player.radius, terrainItem.options);
    if (collision.collided) { topdownEntity.position = collision.correctedPosition; topdownVelocity = collision.correctedVelocity; }
  }
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.solid || !item.entity.visible) continue;
    const solidCollision = resolveItemColliderCollision(topdownEntity.position, topdownVelocity, player.radius, item, previousPosition);
    if (solidCollision.collided) { topdownEntity.position = solidCollision.correctedPosition; topdownVelocity = solidCollision.correctedVelocity; }
  }
  const boundary = applyPlayerPlayBounds(topdownEntity.position, topdownVelocity, player.radius);
  topdownEntity.position = boundary.correctedPosition;
  topdownVelocity = boundary.correctedVelocity;

  const reconciled = reconcilePlayerWallContacts(topdownEntity.position, topdownVelocity, player.radius, previousPosition, null);
  topdownEntity.position = reconciled.correctedPosition;
  topdownVelocity = reconciled.correctedVelocity;

  return previousPosition;
}

// --- Third-person player controller ---
// Camera-relative WASD/touch movement. Vertical physics (gravity/jump/
// grounded-state) is OPT-IN per level via Player Settings' Jump checkbox --
// off by default so every existing Third-Person level keeps its exact prior
// flat-ground behavior unchanged. When on, Y is integrated like any other
// axis (gravity accelerates thirdPersonVelocity.y every frame) and resolved
// against terrain (resolveTerrainCollision, already Y-aware) and solid
// objects (the new resolveVerticalBoxCollision, landing on top / bonking
// the underside) each frame, exactly the same two collision sources the
// XZ movement below already resolves against.
let thirdPersonEntity = null;
let thirdPersonVelocity = null;
let thirdPersonGrounded = false;
let jumpKeyWasDown = false;
// Camera yaw owned by the controller rather than derived from the character's
// facing. Movement is camera-relative, so a camera that followed the facing
// turned every strafe into a feedback loop (holding A or D spun the player).
let tpCameraYaw = 0;
let tpCameraWrittenYaw = null; // last bearing we wrote; an authored camera change releases ownership
const TP_TURN_RATE = 12; // rad/s the character turns toward travel; never an instant snap
const TP_AUTO_STEER_RATE = 1.6; // rad/s the camera swings toward forward-diagonal travel (keyboard steering)
const TP_PITCH_MIN = -0.15, TP_PITCH_MAX = 1.1;
function turnAngleToward(current, target, maxStep) {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return current + Math.max(-maxStep, Math.min(maxStep, diff));
}
function thirdPersonOwnsCameraBearing() {
  const cam = app.camera;
  if (!thirdPersonEntity || cam.mode !== 'chase' || cam.targetEntity !== thirdPersonEntity) return false;
  if (cam.chaseOptions.bearingMode === 'followTarget') {
    if (tpCameraWrittenYaw === null) tpCameraYaw = thirdPersonEntity.rotationY || 0;
    return true;
  }
  return tpCameraWrittenYaw !== null && cam.chaseOptions.bearingYaw === tpCameraWrittenYaw;
}
function applyThirdPersonLook(dx, dy, sensitivity) {
  if (![dx, dy, sensitivity].every(Number.isFinite) || sensitivity < 0 || !thirdPersonOwnsCameraBearing()) return;
  tpCameraYaw = Math.atan2(Math.sin(tpCameraYaw + dx * sensitivity), Math.cos(tpCameraYaw + dx * sensitivity));
  const pitch = app.camera.chaseOptions.pitch + dy * sensitivity * (app.settings.get('invertMouseY') === true ? -1 : 1);
  if (Number.isFinite(pitch)) app.camera.chaseOptions.pitch = Math.max(TP_PITCH_MIN, Math.min(TP_PITCH_MAX, pitch));
  tpCameraWrittenYaw = tpCameraYaw;
  app.camera.setChaseOptions({ bearingMode: 'fixed', bearingYaw: tpCameraYaw });
}

function spawnThirdPersonController(position) {
  const settings = currentPlayerSettings;
  thirdPersonEntity = app.addEntity({ mesh: cubeMesh, color: [0.2, 0.75, 0.55], position: position.clone(), scale: new Opus.Vec3(0.6, playerBodyHeight(settings), 0.6) });
  thirdPersonEntity.rotationY = Number.isFinite(settings.initialYaw) ? settings.initialYaw : 0;
  thirdPersonVelocity = new Opus.Vec3();
  thirdPersonGrounded = false;
  jumpKeyWasDown = false;
  tpCameraYaw = thirdPersonEntity.rotationY;
  tpCameraWrittenYaw = null;

  app.camera.setChaseOptions({ distance: 6.5, height: 2.6, pitch: Number.isFinite(settings.initialPitch) ? settings.initialPitch : 0.28, lerpSpeed: 6.5, rotationLerpSpeed: 8.5, lookAhead: 0.8 });
  app.camera.setTarget(thirdPersonEntity);
  app.camera.setMode('chase');

  if (isTouchDevice) document.getElementById('touch-controls').classList.add('visible');
  // The existing Boost touch button is otherwise unused by this controller
  // (Boost is a Hovercraft-only action) -- repurposed as Jump when the
  // level opts into vertical physics, hidden entirely otherwise so it
  // doesn't sit on screen as a dead button.
  const touchBoostBtn = document.getElementById('touch-boost');
  touchBoostBtn.style.display = settings.jumpEnabled ? '' : 'none';
  touchBoostBtn.textContent = 'JUMP';

  player = {
    controllerType: 'thirdperson',
    entity: thirdPersonEntity,
    radius: settings.collisionRadius || 0.5,
    get velocity() { return thirdPersonVelocity; },
    set velocity(v) { thirdPersonVelocity = v; },
  };
}

function despawnThirdPersonController() {
  if (!thirdPersonEntity) return;
  app.scene.remove(thirdPersonEntity);
  thirdPersonEntity = null;
  thirdPersonVelocity = null;
  document.getElementById('touch-boost').textContent = 'BOOST';
  document.getElementById('touch-boost').style.display = '';
  app.camera.setTarget(null);
  app.camera.setMode('orbit');
  document.getElementById('touch-controls').classList.remove('visible');
  player = null;
}

// Moving platform carry (Wave 5, Priority E) -- a player standing on a
// solid that's itself moving (Property Animation, a Tween) should move
// WITH it, not be left behind or slide off as it translates. Deliberately
// self-contained (no separate per-frame "capture platform positions" hook
// needed): called once per solid, every frame, from each Player
// Controller's own collision loop -- which already runs AFTER
// updateAnimations/tickTweens have moved that frame's platforms (see their
// onUpdate registration order, both earlier in this file than the main
// gameplay loop), so `item.entity.position` here is already this frame's
// moved position. `item._carryPrevPos`, stashed on the ITEM itself, is
// simply "wherever this same function last saw this item" -- last frame's
// moved position -- so the delta between the two is exactly how far the
// platform moved this one frame. Only applied to the mover when it's
// actually grounded ON this specific item this frame; the position is
// still refreshed on every solid every frame regardless, so a mover that
// steps onto a DIFFERENT platform next frame doesn't inherit a stale delta
// accumulated while it wasn't standing there. Kinematic (position-driven),
// not a physics constraint -- no rigid-body/mass involved, matching the
// spec's own "this is kinematic character-platform interaction" framing.
// Horizontal (X/Z) ONLY -- Y is deliberately excluded. The caller always
// invokes this immediately after the SAME frame's vertical box-snap (see
// updateThirdPersonController/updateFirstPersonController), which already
// repositions the mover's Y to exactly `box.max.y + halfHeight` using the
// platform's OWN already-moved-this-frame position -- authoritative and
// exact, not an approximation. Applying carry's Y delta on top of that
// double-counts the platform's vertical movement for the frame: found by
// dogfooding a fast (easeInOut, ~2-3 u/s peak) vertical elevator, where the
// compounding overshoot grew a small starting gap frame over frame until
// the mover drifted far enough above the platform to fall outside the
// snap's own tolerance band a few frames later and dropped off entirely --
// a translating (horizontal-only) platform never exposed this, since there
// is no competing vertical snap to double up against on that axis.
