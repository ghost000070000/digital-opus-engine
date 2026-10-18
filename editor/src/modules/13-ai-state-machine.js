// --- AI State Machine (Wave 7, Priority D, Sections 24-32) ---
// Bounded, much smaller than a generic Behavior Tree: `ai.states = [{name,
// movement, attack, animRole, entryActions, transitions: [{condition, to}]}]`,
// `ai.startState`. Transition priority is authored order -- the FIRST valid
// transition in a state's own array wins, checked once per tick before that
// tick's movement/attack run (so a same-tick transition immediately drives
// the NEW state's own movement, not a one-frame-stale old one).
function distanceToPlayerXZ(pos) {
  if (!player) return Infinity;
  const d = pos.sub(player.entity.position);
  d.y = 0;
  return d.length();
}
// Bounded Line Of Sight: a straight ray from `fromPos` to the Player's own
// position, blocked by visible solid collision geometry before the Player.
// Use the same authored shape/offset/orientation as movement, not the render
// scale proxy of an imported mesh. Existing public rays keep this bounded.
function hasLineOfSightToPlayer(fromPos, observer = null) {
  if (!player) return false;
  return hasLineOfSightToPosition(fromPos, player.entity.position, observer);
}
function hasLineOfSightToPosition(fromPos, targetPos, observer = null) {
  const toTarget = targetPos.sub(fromPos);
  const dist = toTarget.length();
  if (dist < 1e-6) return true;
  const dir = toTarget.scale(1 / dist);
  for (const other of placed) {
    if (other === observer || other.kind !== 'cube' || !other.entity.solid || other.entity.visible === false) continue;
    const cfg = itemColliderConfig(other), center = other.entity.position.add(cfg.offset);
    let t;
    if (cfg.shape === 'sphere') t = Opus.Physics.raySphere(fromPos, dir, center, cfg.radius);
    else {
      const inverse = other.entity.quaternion ? other.entity.quaternion.conjugate() : Opus.Quat.identity();
      const box = new Opus.Physics.AABB(cfg.half.scale(-1), cfg.half);
      t = Opus.Physics.rayAABB(inverse.rotateVec3(fromPos.sub(center)), inverse.rotateVec3(dir), box);
    }
    if (t !== null && t < dist) return false;
  }
  return true;
}
// Wave 9 (Priority B, Sections 29-31): real Vision Field -- distance, THEN
// angle inside the authored FOV cone, THEN (if required) LOS, all three in
// order (cheapest check first). Uses `item.entity.forward` -- the entity's
// REAL current orientation (Section 30's own "do not derive a second
// heading model"); for ground AI (no pitch/roll) this is yaw, exactly as
// the spec anticipates.
function aiCanSeePlayer(item, pos) {
  if (!player) return false;
  const perception = (item.entity.ai && item.entity.ai.perception) || defaultAiPerception();
  const toPlayer = player.entity.position.sub(pos);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  if (dist > (perception.visionDistance != null ? perception.visionDistance : 15)) return false;
  if (dist < 1e-6) return true;
  const forward = item.entity.forward;
  const fwdFlat = new Opus.Vec3(forward.x, 0, forward.z);
  const fwdLen = fwdFlat.length();
  if (fwdLen > 1e-6) {
    const cosAngle = fwdFlat.scale(1 / fwdLen).dot(toPlayer.scale(1 / dist));
    const halfFovCos = Math.cos(((perception.fovDegrees != null ? perception.fovDegrees : 100) / 2) * Math.PI / 180);
    if (cosAngle < halfFovCos) return false;
  }
  if (perception.requiresLOS !== false && !hasLineOfSightToPlayer(pos, item)) return false;
  return true;
}
// Wave 9 (Priority B, Sections 32-35): Noise Events -- pure authored
// gameplay data (position/radius/timestamp), broadcast immediately at emit
// time to every placed AI within BOTH the noise's own radius and that
// listener's own authored Hearing Radius (the tighter of the two bounds).
// No persistent event queue/list to manage -- an instantaneous scan is
// simpler and sufficient for "did anyone just hear this," matching Section
// 33's own "no audio analysis, no ML" framing.
function emitNoiseEvent(position, radius) {
  for (const other of placed) {
    if (other.kind !== 'cube' || !other.entity.ai || !aiBrainCanRun(other)) continue;
    const perception = other.entity.ai.perception;
    if (!perception || !perception.hearingRadius) continue;
    const dist = other.entity.position.sub(position).length();
    if (dist <= Math.min(radius, perception.hearingRadius)) {
      other._lastHeardNoisePos = position.clone();
      other._lastHeardNoiseAt = simElapsed;
    }
  }
}
function evaluateAiTransitionCondition(cond, item, pos) {
  if (!cond) return false;
  switch (cond.type) {
    case 'distanceToPlayerAtMost': return distanceToPlayerXZ(pos) <= (cond.value || 0);
    case 'distanceToPlayerAtLeast': return distanceToPlayerXZ(pos) >= (cond.value || 0);
    case 'lineOfSightToPlayer': return hasLineOfSightToPlayer(pos, item);
    case 'noLineOfSightToPlayer': return !hasLineOfSightToPlayer(pos, item);
    case 'healthAtMost': ensureObjectHealthInit(item); return item.health.current <= (cond.value || 0);
    case 'timeInStateAtLeast': return (simElapsed - (item._aiStateEnteredAt || 0)) >= (cond.value || 0);
    case 'canSeePlayer': return aiCanSeePlayer(item, pos);
    case 'cannotSeePlayer': return !aiCanSeePlayer(item, pos);
    case 'heardNoiseRecently': return item._lastHeardNoiseAt != null && (simElapsed - item._lastHeardNoiseAt) <= (cond.value ?? 3);
    default: return false;
  }
}
function aiStateDef(ai, name) {
  return (ai.states || []).find((s) => s.name === name);
}
function enterAiState(item, ai, stateName) {
  const state = aiStateDef(ai, stateName);
  if (!state) return;
  ai._currentState = stateName;
  item._aiStateEnteredAt = simElapsed;
  if(state.movement?.type==='wander'&&state.movement.restartOnEnter===true){
    state.movement._entryBase=item.entity.position.clone();
    delete state.movement.wanderTarget;delete state.movement.wanderTimer;
  }
  if (state.animRole && item.characterAnimSync && item.entity.skin) setCharacterLocomotionState(item, state.animRole);
  for (const action of (state.entryActions || [])) executeAction(action.action, action.params, item);
}
// The one per-frame entry point for a State Machine character -- checks
// transitions (authored order, first valid wins), THEN runs the resulting
// (possibly just-switched) state's own movement/attack through the exact
// same shared steps every Simple-AI type already uses. Returns the resolved
// follow-target entity so the caller's animation-locomotion logic can stay
// uniform if it ever needs to (currently unused there -- State Machine
// characters animate per-state, not from movement delta).
function tickAiStateMachine(item, ai, pos, dt, elapsed) {
  if (!ai.states || ai.states.length === 0) return null;
  if (!ai._currentState || !aiStateDef(ai, ai._currentState)) enterAiState(item, ai, ai.startState || ai.states[0].name);
  let state = aiStateDef(ai, ai._currentState);
  if (!state) return null;
  for (const tr of (state.transitions || [])) {
    if (evaluateAiTransitionCondition(tr.condition, item, pos)) {
      if (tr.to !== ai._currentState) enterAiState(item, ai, tr.to);
      break; // authored-order, first-valid-wins -- never evaluate a later transition once one has matched
    }
  }
  state = aiStateDef(ai, ai._currentState); // re-read AFTER a possible same-tick transition
  if (!state) return null;
  const movementCfg = state.movement || { type: '' };
  const followTargetEntity = applyAiMovementStep(item, movementCfg, pos, dt, elapsed);
  if (state.attack) applyAiAttackStep(item, state.attack, pos, followTargetEntity, elapsed);
  if(state.animRole&&item.characterAnimSync&&item.entity.skin&&!(item._animOverrideUntil>elapsed))setCharacterLocomotionState(item,state.animRole);
  return followTargetEntity;
}

// Per-level presentation bounds keep short samples inside their authored world.
// Unconfigured projects retain the established radial boundary unchanged.
function applyPlayerPlayBounds(position, velocity, radius) {
  const bounds = currentPlayerSettings.playBounds;
  if (!bounds || !['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(bounds[key])) || bounds.maxX - bounds.minX <= radius * 2 || bounds.maxZ - bounds.minZ <= radius * 2) return Opus.Physics.applyMapBoundary(position, velocity, radius, MAP_BOUNDARY);
  const correctedPosition = position.clone();
  const correctedVelocity = velocity.clone();
  correctedPosition.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, position.x));
  correctedPosition.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, position.z));
  for (const axis of ['x', 'z']) if (correctedPosition[axis] !== position[axis] && velocity[axis] * (position[axis] - correctedPosition[axis]) > 0) correctedVelocity[axis] = 0;
  const distance = Math.min(position.x - bounds.minX - radius, bounds.maxX - radius - position.x, position.z - bounds.minZ - radius, bounds.maxZ - radius - position.z);
  const intensity = Math.max(0, Math.min(1, 1 - distance / 2));
  return { correctedPosition, correctedVelocity, warning: intensity > 0, intensity };
}

let platformer2DController = null;
let platformer2DIntent = [0, 0];
let topdown2DController = null;
let topdown2DIntent = [0, 0];
let controllerStateSession = 0;
let controllerStateEvents = null;
function resetControllerStateEvents() {
  controllerStateSession++;
  if (controllerStateEvents) controllerStateEvents.reset();
}
function controllerStatePlayerIsCurrent(owner, session) {
  if (!playMode || gameEnded || app.paused || !owner || player !== owner || controllerStateSession !== session) return false;
  if (owner.controllerType === 'platformer2d') return platformerPlayerObject()?.entity === owner.entity;
  if (owner.controllerType === 'topdown2d') return topdownPlayerObject()?.entity === owner.entity;
  return ['firstperson', 'thirdperson', 'topdown', 'hovercraft'].includes(owner.controllerType);
}
function dispatchControllerStateEvent(context) {
  if (!controllerStatePlayerIsCurrent(context.owner, context.session)) return;
  const subscribers = placed.slice().map(owner => ({ owner, behaviors: Array.isArray(owner.behaviors) ? owner.behaviors.slice() : [] }));
  for (const entry of subscribers) for (const behavior of entry.behaviors) {
    if (!controllerStatePlayerIsCurrent(context.owner, context.session)) return;
    if (!placed.includes(entry.owner) || !entry.owner.behaviors?.includes(behavior)) continue;
    if (behavior.trigger !== 'controllerStateEvent' || behavior.eventRef?.source !== 'levelPlayer' || behavior.eventRef.state !== context.event) continue;
    runAction(behavior, entry.owner, undefined, context);
  }
}
function controllerStateTickIsCurrent(owner, session) {
  return playMode && !gameEnded && !app.paused && player === owner && controllerStateSession === session &&
    (!owner || controllerStatePlayerIsCurrent(owner, session));
}
function sampleControllerStateEvents(dt) {
  const owner = player, session = controllerStateSession;
  if (!controllerStatePlayerIsCurrent(owner, session)) { if (controllerStateEvents) controllerStateEvents.reset(); return; }
  if (!controllerStateEvents && globalThis.OpusControllerStateEvents) controllerStateEvents = OpusControllerStateEvents.createControllerStateEvents({
    emit: dispatchControllerStateEvent, isCurrent: sample => controllerStatePlayerIsCurrent(sample.owner, sample.session)
  });
  if (!controllerStateEvents) return;
  const family = owner.controllerType, p = owner.entity.position;
  let grounded = null;
  if (family === 'firstperson') grounded = firstPersonGrounded;
  else if (family === 'thirdperson' && currentPlayerSettings.jumpEnabled === true) grounded = thirdPersonGrounded;
  else if (family === 'platformer2d') {
    const contact = body2DManager?.getCharacterCollision2DState(owner.objectId);
    grounded = contact?.active === true ? contact.grounded === true : null;
  }
  controllerStateEvents.sample({ owner, session, family, position: [p.x, p.y, p.z], grounded }, dt);
}
function topdownPlayerObject() {
  const id = currentPlayerSettings && currentPlayerSettings.topdownObjectRef;
  if (typeof id !== 'string' || !id) return null;
  const matches = placed.filter(item => item.id === id);
  const item = matches.length === 1 && matches[0];
  if (!item || item.kind !== 'sprite' || !item.entity) return null;
  const record = item.components && item.components['topdown-controller-2d'];
  if (!record || record.version !== 1 || record.enabled !== true ||
      OpusAuthoring.validateComponent(item, 'topdown-controller-2d').some(issue => (issue.severity || 'error') === 'error')) return null;
  if (![record.moveLeftActionRef, record.moveRightActionRef, record.moveUpActionRef, record.moveDownActionRef].every(id => !!findInputAction(id))) return null;
  return item;
}
function collectTopdownPlayerIssues(project) {
  const issues = [];
  for (const level of project.levels || []) {
    const settings = level.playerSettings;
    if (!settings || settings.controllerType !== 'topdown2d') continue;
    const matches = typeof settings.topdownObjectRef === 'string' ? (level.objects || []).filter(item => item.id === settings.topdownObjectRef) : [];
    const item = matches.length === 1 && matches[0];
    const record = item && item.components && item.components['topdown-controller-2d'];
    if (!item || item.kind !== 'sprite' || !record || record.enabled !== true || record.version !== 1 ||
        OpusAuthoring.validateComponent(item, 'topdown-controller-2d').some(issue => (issue.severity || 'error') === 'error')) {
      issues.push({ severity: 'error', code: 'topdown-player-target', scope: 'player', levelId: level.id, field: 'topdownObjectRef',
        referenceType: 'object', referenceValue: settings.topdownObjectRef,
        message: '2D Top-down Player needs one named Sprite with valid enabled Top-down Controller, Kinematic Body, Collider and Character Collision. Wall-slide, slope and step handling must be explicitly off; no fallback Player is spawned.' });
    }
  }
  return issues;
}
function resetTopdownPlayerIntent() {
  if (topdown2DController) topdown2DController.reset();
  topdown2DIntent = [0, 0];
}
function platformerPlayerObject() {
  const id = currentPlayerSettings && currentPlayerSettings.platformerObjectRef;
  if (typeof id !== 'string' || !id) return null;
  const matches = placed.filter(item => item.id === id);
  const item = matches.length === 1 && matches[0];
  if (!item || item.kind !== 'sprite' || !item.entity) return null;
  const record = item.components && item.components['platformer-controller-2d'];
  if (!record || record.version !== 1 || record.enabled !== true ||
      OpusAuthoring.validateComponent(item, 'platformer-controller-2d').some(issue => (issue.severity || 'error') === 'error')) return null;
  if (![record.moveLeftActionRef, record.moveRightActionRef, record.jumpActionRef].every(id => !!findInputAction(id))) return null;
  return item;
}
function collectPlatformerPlayerIssues(project) {
  const issues = [];
  for (const level of project.levels || []) {
    const settings = level.playerSettings;
    if (!settings || settings.controllerType !== 'platformer2d') continue;
    const matches = typeof settings.platformerObjectRef === 'string' ? (level.objects || []).filter(item => item.id === settings.platformerObjectRef) : [];
    const item = matches.length === 1 && matches[0];
    const record = item && item.components && item.components['platformer-controller-2d'];
    if (!item || item.kind !== 'sprite' || !record || record.enabled !== true || record.version !== 1 ||
        OpusAuthoring.validateComponent(item, 'platformer-controller-2d').some(issue => (issue.severity || 'error') === 'error')) {
      issues.push({ severity: 'error', code: 'platformer-player-target', scope: 'player', levelId: level.id, field: 'platformerObjectRef',
        referenceType: 'object', referenceValue: settings.platformerObjectRef,
        message: 'Platformer Player needs one named Sprite in this level with valid enabled Platformer Controller, Kinematic Body, Collider and Character Collision. No fallback Player is spawned.' });
    }
  }
  return issues;
}
function resetPlatformerPlayerIntent() {
  if (platformer2DController) platformer2DController.reset();
  platformer2DIntent = [0, 0];
}
function spawnPlayer(position) {
  resetControllerStateEvents();
  if (currentPlayerSettings && currentPlayerSettings.controllerType === 'topdown2d') {
    resetTopdownPlayerIntent();
    const item = topdownPlayerObject();
    topdown2DController = globalThis.OpusTopDownController2D ? OpusTopDownController2D.createTopDownController2D() : null;
    player = item && topdown2DController ? { controllerType: 'topdown2d', entity: item.entity, objectId: item.id, velocity: new Opus.Vec3(), radius: 0 } : null;
    if (typeof renderMappedTouchControls === 'function') renderMappedTouchControls();
    return; // Authored XY Sprite and Camera, never legacy XZ spawn/mesh fallback.
  }
  if (currentPlayerSettings && currentPlayerSettings.controllerType === 'platformer2d') {
    resetPlatformerPlayerIntent();
    const item = platformerPlayerObject();
    platformer2DController = globalThis.OpusPlatformerController2D ? OpusPlatformerController2D.createPlatformerController2D() : null;
    player = item && platformer2DController ? { controllerType: 'platformer2d', entity: item.entity, objectId: item.id, velocity: new Opus.Vec3(), radius: 0 } : null;
    // This authored Sprite and the existing XY Camera own their appearance/start.
    // Invalid explicit ownership never spawns a fallback legacy character.
    if (typeof renderMappedTouchControls === 'function') renderMappedTouchControls();
    return;
  }
  // Generate the historical controller default, not the previous level's shot.
  // Authored active Cameras and Start Actions apply after spawn and may override it.
  app.camera.setProjection('perspective');
  app.camera.setChaseOptions({ bearingMode:'followTarget', bearingYaw:0 });
  app.camera.setObstructionOptions({enabled:false,radius:0.25,padding:0.05});
  app.camera.near = 0.1;
  app.camera.far = 100;
  app.camera.fovY = Math.PI / 4; // Default frustum ownership; family and authored Cameras apply next.
  const type = (currentPlayerSettings && PLAYER_CONTROLLERS[currentPlayerSettings.controllerType]) ? currentPlayerSettings.controllerType : 'hovercraft';
  PLAYER_CONTROLLERS[type].spawn(position);
  if(typeof renderMappedTouchControls==='function')renderMappedTouchControls();
  // Present the authored character before the Start Screen pauses updates.
  syncPlayerVisual();
  footstepTimer = 0;
  movementNoiseTimer = 0;
  // See VOID_FALL_MARGIN's own comment: recomputed every spawn/respawn so a
  // multi-level game's void floor always tracks THAT level's own spawn
  // height, not level 1's.
  voidFallY = position.y - VOID_FALL_MARGIN;
  // Public Showcase Recovery pass (Section 6B): the on-screen controls hint
  // used to be a single string hardcoded into editor/index.html itself
  // (the original Crate Run demo's own hovercraft instructions), shown on
  // every Hovercraft-controller game regardless of what that game actually
  // was. Moved here (the one shared spawn choke point every controller
  // funnels through, not just Hovercraft) and now reads the per-project
  // `Controls Hint` field authored in Player Settings -- blank by default,
  // which correctly shows nothing rather than another game's instructions.
  const controlsHintEl = document.getElementById('controls-hint');
  const hintText = (currentUiConfig.startScreen.controlsHint || '').trim();
  controlsHintEl.textContent = hintText;
  clearTimeout(controlsHintEl._hideTimer);
  if (hintText && !isTouchDevice) {
    controlsHintEl.classList.add('visible');
    controlsHintEl._hideTimer = setTimeout(() => controlsHintEl.classList.remove('visible'), 5000);
  } else {
    controlsHintEl.classList.remove('visible');
  }
}
function despawnPlayer() {
  resetControllerStateEvents();
  if (player && player.controllerType === 'topdown2d' || !player && currentPlayerSettings && currentPlayerSettings.controllerType === 'topdown2d') {
    resetTopdownPlayerIntent(); topdown2DController = null; player = null;
    return; // Authored Sprite remains in the Scene.
  }
  if (player && player.controllerType === 'platformer2d' || !player && currentPlayerSettings && currentPlayerSettings.controllerType === 'platformer2d') {
    resetPlatformerPlayerIntent(); platformer2DController = null; player = null;
    return; // Never remove the authored Sprite from the Scene.
  }
  if (!player) return;
  // The visual belongs to this controller generation. Keeping it alive
  // across Stop/Play leaves a new visible primitive underneath the ranger,
  // and can retain the previous level's model/equipment entities.
  teardownPlayerVisual();
  // Equipment survives the first-person per-frame hidden-body cleanup, but
  // belongs only to this controller generation and must leave the Scene now.
  teardownPlayerEquipment();
  PLAYER_CONTROLLERS[player.controllerType].despawn();
}
// Wave 6 (Priority L): the one missing piece a scripted camera sequence
// needed to actually BE a cutscene rather than "the camera cuts away while
// the player silently keeps walking around off-screen" -- Change Camera +
// Delay (both already existed, Wave 4/5) can already sequence a multi-shot
// camera pan today, but nothing could stop the player CONTROLLER from
// still processing input and moving during it. Deliberately bounded: this
// freezes CONTROLLER-driven movement only (gravity/input/physics), not the
// whole simulation the way Dialogue's app.pause() does -- AI, animations,
// tweens, and the camera itself all keep running, exactly what a cutscene
// needs (everything else in the world still plays out; only the player
// stops moving). Not a full Cutscene/Sequence track editor -- see the
// CHANGELOG entry for this priority's own gate reasoning on why that
// larger feature wasn't built.
let playerFrozen = false;
// Returns the player's position before this frame's movement, for swept
// trigger checks (or null if no player is spawned).
function resolvePlayerControllerAbilities(item, family, record) {
  return OpusControllerAbilities.resolveControllerAbilities({ family, components: item.components, controller: record }, {
    actionDown: id => findInputAction(id) ? inputActionDown(id) : undefined,
    actionPressed: id => findInputAction(id) ? inputActionWasPressed(id) : undefined
  });
}
function updatePlayerController(dt, elapsed) {
  if (currentPlayerSettings && currentPlayerSettings.controllerType === 'topdown2d') {
    const item = topdownPlayerObject();
    if (!item || !player || player.entity !== item.entity || !topdown2DController) { resetTopdownPlayerIntent(); return null; }
    const record = item.components['topdown-controller-2d'];
    const abilities = resolvePlayerControllerAbilities(item, 'topdown2d', record);
    topdown2DIntent = topdown2DController.prepare({ speed: abilities.speed },
      { left: inputActionDown(record.moveLeftActionRef), right: inputActionDown(record.moveRightActionRef),
        up: inputActionDown(record.moveUpActionRef), down: inputActionDown(record.moveDownActionRef) },
      dt, { frozen: playerFrozen, paused: app.paused });
    return item.entity.position.clone();
  }
  if (currentPlayerSettings && currentPlayerSettings.controllerType === 'platformer2d') {
    const item = platformerPlayerObject();
    if (!item || !player || player.entity !== item.entity || !platformer2DController) { resetPlatformerPlayerIntent(); return null; }
    const record = item.components['platformer-controller-2d'];
    const abilities = resolvePlayerControllerAbilities(item, 'platformer2d', record);
    platformer2DIntent = platformer2DController.prepare(abilities,
      { left: inputActionDown(record.moveLeftActionRef), right: inputActionDown(record.moveRightActionRef), jumpPressed: abilities.jumpPressed },
      dt, body2DManager.getCharacterCollision2DState(item.id), { frozen: playerFrozen, paused: app.paused });
    return item.entity.position.clone();
  }
  if (!player) { teardownPlayerVisual(); return null; }
  if (playerFrozen) {
    syncPlayerVisual(); // position may still change during a frozen cutscene (Change Camera doesn't move the player, but stay correct regardless)
    return player.entity.position.clone(); // no movement this frame -- "previous position" for swept checks is just the current one
  }
  const result = PLAYER_CONTROLLERS[player.controllerType].update(dt, elapsed);
  // Void-fall catch (logic-check pass) -- see VOID_FALL_MARGIN's own comment.
  // One check, after every controller's own update, regardless of
  // controllerType: a hovercraft never drops in Y so this never fires for
  // it, but a jump-enabled topdown/third-person/first-person controller
  // that clears the last floor collider gets caught and returned to the
  // last checkpoint (or spawn) instead of free-falling forever.
  if (player && player.entity.position.y < voidFallY) {
    const target = window.__checkpoint ? window.__checkpoint.clone() : computeSpawnPoint();
    player.entity.position = target;
    player.velocity = new Opus.Vec3();
    voidFallY = target.y - VOID_FALL_MARGIN;
  }
  // Wave 6B (Priority A): sync THIS frame's body position/rotation to the
  // visual, then drive locomotion off THIS frame's freshly-computed
  // grounded/velocity state -- called from the same dispatcher every
  // controller's own update already funnels through, so there's no one-
  // frame lag reading last frame's state (the risk of instead syncing from
  // a separately-registered app.onUpdate callback, which runs in
  // registration order, not necessarily after this dispatcher).
  syncPlayerVisual();
  drivePlayerVisualLocomotion();
  syncPlayerEquipmentVisuals();
  syncHeldObjectPosition();
  driveFootstepAudio(dt);
  driveMovementNoise(dt);
  // Wave 7 (Priority B): the Player's own visual entity is not a `placed`
  // item, so it needs its own explicit call here rather than falling under
  // the `placed`-loop version above -- same shared `tickAnimationEvents`,
  // no separate code path. `contextItem` is `null` (there is no Player
  // "item" the way an AI character has one); every action reachable from an
  // animation event in this dogfood (`fireWeapon`) reads global player
  // state directly and doesn't need one.
  if (playerVisualEntity) tickAnimationEvents(playerVisualEntity, currentPlayerSettings.visual && currentPlayerSettings.visual.assetId, null);
  return result;
}

