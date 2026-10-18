// --- First-Person Controller (Wave 5, Priority C) -----------------------
// Justified now (per the spec's own reasoning) because everything it needs
// already exists: solids, vertical physics/jump, projectiles/weapons, and
// Input Actions. Reuses the EXACT same physics Third-Person already uses
// (terrain collision, vertical box landing, horizontal solid push, map
// boundary) -- no second collision solver. The one genuine new piece is
// camera ownership: instead of a chase camera trailing a visible player
// model, this controller drives `app.camera` directly in 'fixed' mode every
// frame from its own yaw/pitch state (no new engine API needed for that --
// Camera.setFixedOptions/. fovY were already public, just never driven by a
// per-frame controller before). The player entity itself still exists (for
// collision) but is invisible, the standard "you don't render your own
// body" FPS convention.
let firstPersonEntity = null;
let firstPersonVelocity = null;
let firstPersonGrounded = false;
let fpJumpKeyWasDown = false;
let fpYaw = 0, fpPitch = 0; // radians; pitch clamped to just under +/-90 degrees below
const FP_PITCH_LIMIT = 1.5; // ~85.9 degrees -- short of true +/-90 to avoid the look direction ever exactly reaching straight up/down (a degenerate camera basis there)
// Wave 9 (Priority A, Sections 19-20): First-Person Recoil -- a transient
// ADDITIVE offset layered on top of fpYaw/fpPitch, never written INTO them,
// so recoil recovering to 0 never fights or drifts the player's own actual
// aim. Kicked on fire (applyWeaponRecoilKick), decayed every real frame
// (tickRecoilRecovery, simulation-time driven) regardless of whether the
// mouse itself moved that frame -- unlike applyFirstPersonLook, which only
// runs on a mouse-move event.
let recoilPitchOffset = 0, recoilYawOffset = 0;
// Wave 9 (Priority C, Sections 43-46): Camera Shake -- simulation-time
// driven (survives pause correctly: paused sim time doesn't advance, so a
// shake started right before pause correctly freezes rather than finishing
// silently in the background), decaying linearly to zero over `duration`.
// `triggerCameraShake` called again before a prior shake finishes replaces
// it (a fresh hit re-triggering shake mid-shake is the natural expectation,
// not additive stacking, per Section 44's own "bounded" framing).
let cameraShakeIntensity = 0, cameraShakeDuration = 0, cameraShakeElapsed = 0;
let cameraShakePolicy = null;
function clearCameraShake() {
  cameraShakeIntensity = cameraShakeDuration = cameraShakeElapsed = 0;
  cameraShakePolicy = null;
  app.camera.shakeOffset = null;
}
function resolveCameraShakePolicy(params = {}) {
  const preset=params.preset===undefined||params.preset===''?'Custom':params.preset;
  let policy;try{policy=Opus.Camera.shakePreset(preset);}catch(error){return null;}
  for(const key of ['intensity','duration']) {
    const raw=params[key];if(raw===undefined||raw===null||raw==='')continue;
    const value=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()?Number(raw):NaN;
    if(!Number.isFinite(value)||value<0)return null;
    if(preset==='Custom')policy[key]=value;
  }
  if(params.direction!==undefined&&params.direction!=='')policy.direction=params.direction;
  if(!['right','left','up','down','forward','back'].includes(policy.direction))return null;
  return policy;
}
function triggerCameraShake(intensity, duration, policy = null) {
  if(typeof intensity!=='number'||!Number.isFinite(intensity)||intensity<0||typeof duration!=='number'||!Number.isFinite(duration)||duration<0)return false;
  if(!intensity||!duration){clearCameraShake();return true;}
  if(policy){try{Opus.Camera.sampleShake(policy,0);}catch(error){return false;}}
  cameraShakeIntensity = intensity;
  cameraShakeDuration = policy ? duration : Math.max(0.01,duration);
  cameraShakeElapsed = 0;
  cameraShakePolicy = policy ? {...policy} : null;
  return true;
}
// Wave 9 (Priority C/Section 43): Player Damage Feedback -- a short red
// screen flash plus a small Camera Shake, both fixed/subtle rather than a
// full per-hit-authored config (a bounded default, not a graphic editor).
function triggerPlayerDamageFeedback() {
  const flashEl = document.getElementById('damage-flash');
  if (flashEl) {
    flashEl.style.background = 'rgba(200, 20, 20, 0.35)';
    requestAnimationFrame(() => { flashEl.style.background = 'rgba(200, 20, 20, 0.001)'; });
  }
  triggerCameraShake(0.12, 0.25);
}
function tickCameraShake(dt) {
  if(app.paused||typeof dt!=='number'||!Number.isFinite(dt)||dt<=0)return;
  if (cameraShakeElapsed >= cameraShakeDuration) {
    if (app.camera.shakeOffset) app.camera.shakeOffset = null;
    return;
  }
  cameraShakeElapsed += dt;
  if(cameraShakeElapsed>=cameraShakeDuration){clearCameraShake();return;}
  const t = Math.min(1, cameraShakeElapsed / cameraShakeDuration);
  const remaining = cameraShakeIntensity * (1 - t); // linear falloff
  app.camera.shakeOffset = cameraShakePolicy ? Opus.Camera.sampleShake(cameraShakePolicy,cameraShakeElapsed) : new Opus.Vec3((Math.random() * 2 - 1) * remaining, (Math.random() * 2 - 1) * remaining, (Math.random() * 2 - 1) * remaining);
}
function applyWeaponRecoilKick(weapon) {
  const v = weapon.recoilVertical || 0;
  const h = weapon.recoilHorizontal || 0;
  if (!v && !h) return;
  recoilPitchOffset += v * (Math.PI / 180);
  recoilYawOffset += (Math.random() * 2 - 1) * h * (Math.PI / 180);
}
function tickRecoilRecovery(dt) {
  if (!recoilPitchOffset && !recoilYawOffset) return;
  const decay = Math.max(0, 1 - dt * 6); // recovery is bounded/fixed-feel rather than a full per-weapon curve editor, per Section 19's "no competitive-shooter recoil pattern editor"
  recoilPitchOffset *= decay;
  recoilYawOffset *= decay;
  if (Math.abs(recoilPitchOffset) < 0.0003) recoilPitchOffset = 0;
  if (Math.abs(recoilYawOffset) < 0.0003) recoilYawOffset = 0;
  if (firstPersonEntity) {
    const p = Math.max(-FP_PITCH_LIMIT, Math.min(FP_PITCH_LIMIT, fpPitch + recoilPitchOffset));
    firstPersonEntity.quaternion = Opus.Quat.fromEuler(p, fpYaw + recoilYawOffset, 0);
  }
}

function spawnFirstPersonController(position) {
  const settings = currentPlayerSettings;
  firstPersonEntity = app.addEntity({ mesh: cubeMesh, color: [0.2, 0.75, 0.55], position: position.clone(), scale: new Opus.Vec3(0.6, playerBodyHeight(settings), 0.6) });
  firstPersonEntity.visible = false; // FPS convention: never render your own body
  firstPersonVelocity = new Opus.Vec3();
  firstPersonGrounded = false;
  fpJumpKeyWasDown = false;
  fpYaw = Number.isFinite(settings.initialYaw) ? settings.initialYaw : 0;
  fpPitch = Number.isFinite(settings.initialPitch) ? Math.max(-FP_PITCH_LIMIT, Math.min(FP_PITCH_LIMIT, settings.initialPitch)) : 0;
  firstPersonEntity.quaternion = Opus.Quat.fromEuler(fpPitch, fpYaw, 0);

  app.camera.setMode('fixed');
  app.camera.fovY = (settings.fovDegrees || 70) * Math.PI / 180;
  const openingEye = position.add(new Opus.Vec3(0, settings.eyeHeight == null ? 0.6 : settings.eyeHeight, 0));
  app.camera.setFixedOptions({ eye: openingEye, target: openingEye.add(firstPersonEntity.forward), up: new Opus.Vec3(0, 1, 0) });

  if (isTouchDevice) {
    document.getElementById('touch-controls').classList.add('visible');
    document.getElementById('touch-look-zone').classList.add('visible');
  } else {
    requestFirstPersonPointerLock();
  }
  const touchBoostBtn = document.getElementById('touch-boost');
  touchBoostBtn.style.display = '';
  touchBoostBtn.textContent = 'JUMP';

  player = {
    controllerType: 'firstperson',
    entity: firstPersonEntity,
    radius: settings.collisionRadius || 0.4,
    get velocity() { return firstPersonVelocity; },
    set velocity(v) { firstPersonVelocity = v; },
  };
}

function despawnFirstPersonController() {
  if (!firstPersonEntity) return;
  app.scene.remove(firstPersonEntity);
  firstPersonEntity = null;
  firstPersonVelocity = null;
  document.getElementById('touch-boost').textContent = 'BOOST';
  document.getElementById('touch-controls').classList.remove('visible');
  document.getElementById('touch-look-zone').classList.remove('visible');
  releaseFirstPersonPointerLock();
  app.camera.setMode('orbit');
  player = null;
}

// Shared by mouse (Pointer Lock movementX/Y), touch (drag delta on the
// look zone), and gamepad (right stick, scaled by dt in pollGamepad) --
// ONE function updates yaw/pitch and the entity's full orientation, so all
// three input sources stay perfectly consistent with each other and with
// whatever fireAttack/AI targeting reads off `entity.forward`.
function applyFirstPersonLook(dx, dy, sensitivity) {
  if (![dx, dy, sensitivity].every(Number.isFinite) || sensitivity < 0) return;
  const yaw = fpYaw + dx * sensitivity;
  const pitch = fpPitch + dy * sensitivity * (app.settings.get('invertMouseY') === true ? -1 : 1);
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
  fpYaw = yaw;
  fpPitch = pitch;
  fpPitch = Math.max(-FP_PITCH_LIMIT, Math.min(FP_PITCH_LIMIT, fpPitch));
  if (firstPersonEntity) firstPersonEntity.quaternion = Opus.Quat.fromEuler(fpPitch, fpYaw, 0);
}

function effectiveMouseSensitivity() {
  const preference = Number(app.settings.get('mouseSensitivity'));
  const userSensitivity = Number.isFinite(preference) && preference > 0 ? preference : 0.0018;
  const authored = Number(currentPlayerSettings.mouseSensitivity);
  const authoredScale = Number.isFinite(authored) && authored > 0 ? authored / 0.0022 : 1;
  const effective = userSensitivity * authoredScale;
  return Number.isFinite(effective) && effective > 0 ? effective : 0.0018;
}

function updateFirstPersonController(dt) {
  if (!firstPersonEntity) return null;
  const settings = currentPlayerSettings;
  const input = app.input;
  // Wave 6 (Priority B/Section 17-18): same Crouch/Sprint rule as
  // Third-Person's own controller above -- crouch wins over sprint, both
  // read through the shared inputActionMap so they rebind the same way
  // every other action already does. Crouching also naturally lowers the
  // First-Person camera's eye position -- `eye = position + eyeHeight`
  // already reads `position.y`, which `applyCrouchState` itself lowers to
  // keep the mover's feet planted, so no separate "crouch eye height" math
  // is needed at all.
  const crouchWanted = inputActionDown('crouch');
  const sprintDown = !crouchWanted && inputActionDown('sprint');
  const crouchDown = applyCrouchState(firstPersonEntity, crouchWanted, player.radius);
  player.crouching = crouchDown; // Wave 9B (Silent Sector): exposed so driveMovementNoise can read crouch state without a second physics pass
  const baseSpeed = settings.moveSpeed || 6;
  const speed = baseSpeed * (crouchDown ? (settings.crouchSpeedMultiplier ?? 0.5) : sprintDown ? (settings.sprintSpeedMultiplier ?? 1.6) : 1);
  const accel = settings.acceleration || 40;
  const gravity = settings.gravity || 20;
  const jumpSpeed = settings.jumpSpeed || 8;
  let forwardIn = 0, strafeIn = 0;
  if (inputActionDown('moveForward','ArrowUp')) forwardIn += 1;
  if (inputActionDown('moveBack','ArrowDown')) forwardIn -= 1;
  if (inputActionDown('moveRight','ArrowRight')) strafeIn += 1;
  if (inputActionDown('moveLeft','ArrowLeft')) strafeIn -= 1;

  // Movement direction uses YAW ONLY (flat) -- standard FPS convention;
  // looking up/down doesn't tip your walking direction into the ground/sky.
  const yawForward = new Opus.Vec3(Math.sin(fpYaw), 0, Math.cos(fpYaw));
  const yawRight = new Opus.Vec3(yawForward.z, 0, -yawForward.x);
  const moveDir = yawForward.scale(forwardIn).add(yawRight.scale(strafeIn));
  const previousPosition = firstPersonEntity.position.clone();

  const currentHorizontal = new Opus.Vec3(firstPersonVelocity.x, 0, firstPersonVelocity.z);
  let horizontal;
  if (moveDir.length() > 0.001) {
    const dir = moveDir.normalize();
    const target = dir.scale(speed);
    horizontal = currentHorizontal.add(target.sub(currentHorizontal).scale(Math.min(1, (accel * dt) / speed)));
  } else {
    horizontal = currentHorizontal.scale(Math.exp(-0.6 * (accel / 10) * dt));
  }

  let verticalY = firstPersonVelocity.y - gravity * dt;
  const jumpDown = inputActionDown('jump');
  if (jumpDown && !fpJumpKeyWasDown && firstPersonGrounded) verticalY = jumpSpeed;
  fpJumpKeyWasDown = jumpDown;

  firstPersonVelocity = new Opus.Vec3(horizontal.x, verticalY, horizontal.z);
  firstPersonEntity.position = firstPersonEntity.position.add(firstPersonVelocity.scale(dt));

  // Terrain, vertical (landing-on-top) and horizontal solid collision --
  // the exact same three checks Third-Person's own jump-enabled path
  // already runs, reused verbatim rather than a second implementation.
  firstPersonGrounded = false;
  const halfHeight = firstPersonEntity.scale.y * 0.5;
  const terrainItem = currentTerrainItem(firstPersonEntity.position);
  if (terrainItem) {
    const terrainCollision = Opus.Physics.resolveTerrainCollision(firstPersonEntity.position, firstPersonVelocity, playerTerrainClearance(firstPersonEntity, player.radius), terrainItem.options);
    const collision = constrainTerrainCeilingRise(terrainCollision, previousPosition, player.radius, halfHeight);
    if (collision.collided) { firstPersonEntity.position = collision.correctedPosition; firstPersonVelocity = collision.correctedVelocity; }
    if (collision.grounded) firstPersonGrounded = true;
  }
  for (const item of placed) {
    if (item.kind !== 'cube' || !item.entity.solid || !item.entity.visible) continue;
    // Wave 6 (Priority B/Section 14): same Ramp branch as Third-Person's own
    // loop above -- First-Person always has real per-frame vertical physics,
    // so a Ramp always gets its sloped-surface resolution here, never the
    // flat-top box fallback.
    if (item.isRamp) {
      const rampCfg = { center: item.entity.position, half: item.entity.scale.scale(0.5), quat: item.entity.quaternion };
      const rCollision = Opus.Physics.resolveRampCollision(firstPersonEntity.position, firstPersonVelocity, player.radius, halfHeight, rampCfg, dt);
      if (rCollision.collided) {
        firstPersonEntity.position = rCollision.correctedPosition;
        firstPersonVelocity = rCollision.correctedVelocity;
      }
      if (rCollision.grounded) firstPersonGrounded = true;
      applyPlatformCarry(firstPersonEntity, item, rCollision.grounded);
      continue;
    }
    const collider = itemColliderConfig(item);
    const half = collider.shape === 'box' ? collider.half : new Opus.Vec3(collider.radius, collider.radius, collider.radius);
    const center = item.entity.position.add(collider.offset);
    let verticalHandled = false;
      const vCollision = resolveItemVerticalCollision(firstPersonEntity.position, firstPersonVelocity, player.radius, halfHeight, item, dt);
    if (vCollision.collided) {
      firstPersonEntity.position = vCollision.correctedPosition;
      firstPersonVelocity = vCollision.correctedVelocity;
      verticalHandled = true;
    }
    if (vCollision.grounded) firstPersonGrounded = true;
    applyPlatformCarry(firstPersonEntity, item, vCollision.grounded);
    const feetY = firstPersonEntity.position.y - halfHeight;
    const headY = firstPersonEntity.position.y + halfHeight;
    const verticallyOverlapping = headY > center.y - half.y && feetY < center.y + half.y;
    if (verticallyOverlapping && !verticalHandled) {
      if (tryStepUp(firstPersonEntity, firstPersonVelocity, halfHeight, firstPersonGrounded, item, player.radius)) {
        firstPersonGrounded = true;
        continue;
      }
      const solidCollision = resolveItemColliderCollision(firstPersonEntity.position, firstPersonVelocity, player.radius, item, previousPosition);
      if (solidCollision.collided) { firstPersonEntity.position = solidCollision.correctedPosition; firstPersonVelocity = solidCollision.correctedVelocity; }
    }
  }
  const boundary = applyPlayerPlayBounds(firstPersonEntity.position, firstPersonVelocity, player.radius);
  firstPersonEntity.position = boundary.correctedPosition;
  firstPersonVelocity = new Opus.Vec3(boundary.correctedVelocity.x, firstPersonVelocity.y, boundary.correctedVelocity.z);

  // First-person always runs gravity/vertical collision, even in historical
  // projects without third-person's opt-in jumpEnabled field.
  const reconciled = reconcilePlayerWallContacts(firstPersonEntity.position, firstPersonVelocity, player.radius, previousPosition, halfHeight);
  firstPersonEntity.position = reconciled.correctedPosition;
  firstPersonVelocity = reconciled.correctedVelocity;
  if (!firstPersonGrounded) {
    const support = resolveFinalItemSupport(firstPersonEntity.position, firstPersonVelocity, player.radius, halfHeight, dt);
    if (support) {
      firstPersonEntity.position = support.hit.correctedPosition;
      firstPersonVelocity = support.hit.correctedVelocity;
      firstPersonGrounded = true;
      applyPlatformCarry(firstPersonEntity, support.item, true);
    }
  }

  // The controller owns the camera transform directly -- eye at the
  // authored eye height above the entity's feet-anchored position, looking
  // along the SAME full pitch+yaw orientation the entity's own quaternion
  // already holds (applyFirstPersonLook keeps them in lockstep), so
  // aiming/shooting (fireAttack reads player.entity.forward) always matches
  // what's actually rendered on screen.
  const eyeHeight = settings.eyeHeight != null ? settings.eyeHeight : 0.6;
  const eye = firstPersonEntity.position.add(new Opus.Vec3(0, eyeHeight, 0));
  const lookDir = firstPersonEntity.forward;
  if (!hasExplicitGameplayCamera()) app.camera.setFixedOptions({ eye, target: eye.add(lookDir), up: new Opus.Vec3(0, 1, 0) });

  return previousPosition;
}

// Pointer Lock (Wave 5): requested on Play start for a First-Person level
// on a non-touch device, released on Stop/pause/Escape -- never silently
// re-acquired without a fresh user gesture (the browser wouldn't allow that
// anyway, but the explicit release on exitPlayMode/pause means a paused
// game never traps the mouse). `mousemove`'s movementX/Y only means
// anything WHILE actually locked (checked every event, not just at
// listener-registration time, since lock state can end at any moment via
// the browser's own Escape handling, outside this code's control).
function requestFirstPersonPointerLock() {
  // requestPointerLock() returns a Promise (in browsers that resolve it at
  // all) that can reject for reasons entirely outside this code's control
  // -- the tab lost focus between the gesture and the grant, the embedding
  // context genuinely can't support it (caught live: this exact rejection,
  // WrongDocumentError, firing in this session's own sandboxed preview
  // frame), or the user simply hasn't interacted with the page yet. None of
  // those are bugs to surface as an uncaught error; Pointer Lock is already
  // optional (touch/non-locked-mouse look still work), so a rejection here
  // is silently swallowed exactly like the older callback-based API (which
  // has no rejection to observe at all) always behaved.
  if (!canvas.requestPointerLock || app.paused || gameEnded) return;
  try {
    const result = canvas.requestPointerLock();
    if (result && typeof result.then === 'function') result.then(() => { if (app.paused || gameEnded) releaseFirstPersonPointerLock(); }, () => {});
  } catch (err) { /* some environments throw synchronously instead of rejecting a promise -- either way, Pointer Lock is optional and this is never a product error */ }
}
function releaseFirstPersonPointerLock() {
  if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
}
document.addEventListener('mousemove', (e) => {
  if (!playMode || !player || player.controllerType !== 'firstperson') return;
  if (document.pointerLockElement !== canvas) return;
  if (app.paused || gameEnded || !inputContextLookAllowed()) return;
  if (e.movementX || e.movementY) app.input.markDevice?.('keyboard-mouse');
  applyFirstPersonLook(e.movementX || 0, e.movementY || 0, effectiveMouseSensitivity());
});
// Third-person orbit: hold the right mouse button and drag. No Pointer Lock, so
// left clicks keep reaching On Click behaviors and HUD buttons.
let tpOrbitPointerId = null, tpOrbitLastX = 0, tpOrbitLastY = 0;
function thirdPersonOrbitAllowed() {
  return playMode && !app.paused && !gameEnded && player && player.controllerType === 'thirdperson' && inputContextLookAllowed();
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 2 || e.pointerType === 'touch' || !thirdPersonOrbitAllowed()) return;
  tpOrbitPointerId = e.pointerId; tpOrbitLastX = e.clientX; tpOrbitLastY = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== tpOrbitPointerId) return;
  if (!thirdPersonOrbitAllowed()) { tpOrbitPointerId = null; return; }
  const dx = e.clientX - tpOrbitLastX, dy = e.clientY - tpOrbitLastY;
  tpOrbitLastX = e.clientX; tpOrbitLastY = e.clientY;
  if (dx || dy) app.input.markDevice?.('keyboard-mouse');
  applyThirdPersonLook(dx, dy, effectiveMouseSensitivity() * 2);
});
function endThirdPersonOrbit(e) { if (e.pointerId === tpOrbitPointerId) tpOrbitPointerId = null; }
canvas.addEventListener('pointerup', endThirdPersonOrbit);
canvas.addEventListener('pointercancel', endThirdPersonOrbit);
canvas.addEventListener('contextmenu', (e) => { if (thirdPersonOrbitAllowed()) e.preventDefault(); });
// Clicking back into the canvas mid-session re-acquires lock after the
// browser (or the player pressing Escape) released it -- a real, expected
// gesture, not code silently fighting the browser's own Escape handling.
canvas.addEventListener('click', () => {
  if (playMode && !gameEnded && !app.paused && player && player.controllerType === 'firstperson' && !isTouchDevice && document.pointerLockElement !== canvas) {
    requestFirstPersonPointerLock();
  }
});

// Touch look (Wave 5, section 18): a dedicated invisible drag zone on the
// right half of the viewport (left half stays free for the existing D-pad
// touch buttons to sit on/near) -- drag delta between successive touch
// samples feeds the exact same applyFirstPersonLook function Pointer Lock
// uses, so touch/mouse/gamepad look can never disagree about sensitivity
// or pitch clamping.
let touchLookPointerId = null;
let touchLookLastX = 0, touchLookLastY = 0;
const touchLookZoneEl = document.getElementById('touch-look-zone');
touchLookZoneEl.addEventListener('pointerdown', (e) => {
  if (!playMode || app.paused || gameEnded || !player || player.controllerType !== 'firstperson' || !inputContextLookAllowed()) return;
  touchLookPointerId = e.pointerId;
  touchLookLastX = e.clientX; touchLookLastY = e.clientY;
  markGameplayPointerDevice(e);
  e.preventDefault();
});
touchLookZoneEl.addEventListener('pointermove', (e) => {
  if (!playMode || app.paused || gameEnded || !player || player.controllerType !== 'firstperson' || !inputContextLookAllowed()) { touchLookPointerId = null; return; }
  if (e.pointerId !== touchLookPointerId) return;
  const dx = e.clientX - touchLookLastX, dy = e.clientY - touchLookLastY;
  touchLookLastX = e.clientX; touchLookLastY = e.clientY;
  applyFirstPersonLook(dx, dy, effectiveMouseSensitivity() * 2.2); // touch drags cover fewer pixels than a mouse for the same intended turn, so scaled up
  e.preventDefault();
});
function endTouchLook(e) { if (e.pointerId === touchLookPointerId) touchLookPointerId = null; }
touchLookZoneEl.addEventListener('pointerup', endTouchLook);
touchLookZoneEl.addEventListener('pointercancel', endTouchLook);

