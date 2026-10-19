// Phase 042: one bounded Trigger Collider 2D lifecycle service. It remains
// separate from the legacy player-centric Trigger Volume above and routes
// its canonical events through the same Behavior -> Action path as every
// other no-code event. App.onUpdate itself is pause-gated by the engine.
function dispatchTrigger2DEvent(payload) {
  if (!playMode || gameEnded || !payload) return;
  window.__lastTrigger2DEvent = payload;
  const log = window.__trigger2DEventLog || (window.__trigger2DEventLog = []);
  log.push(payload); if (log.length > 10000) log.splice(0, log.length - 10000);
  const owner = placed.find((item) => item.id === payload.triggerObjectId);
  if (!owner) return;
  const previousContext = window.__currentTrigger2DEvent;
  window.__currentTrigger2DEvent = payload;
  try { runBehaviors(owner, payload.eventType); } finally { window.__currentTrigger2DEvent = previousContext || null; }
}
const trigger2DManager = globalThis.OpusTrigger2D ? OpusTrigger2D.createTriggerLifecycle({ collisionLayers: () => collisionLayers, emit: dispatchTrigger2DEvent, onError: (error) => showToast(`Trigger 2D callback error: ${error.message}`) }) : null;
window.opusTrigger2D = trigger2DManager;
function translateBody2DWorld(item, delta) {
  if (!item || !item.entity || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return false;
  if (item.parentId) {
    const parent = findItemById(item.parentId);
    if (!parent || !parent.entity) return false;
    resolveWorldTransform(parent);
    const node = (item.socketName && resolveSocketSourceTransform(parent, item.socketName)) || itemLocalNode(parent);
    const scale = node.scale;
    if (![scale.x, scale.y, scale.z].every(Number.isFinite) || Math.abs(scale.x) <= 1e-8 || Math.abs(scale.y) <= 1e-8 || Math.abs(scale.z) <= 1e-8) return false;
    const unrotated = node.quaternion.conjugate().rotateVec3(new Opus.Vec3(delta.x, delta.y, 0));
    const localDelta = new Opus.Vec3(unrotated.x / scale.x, unrotated.y / scale.y, unrotated.z / scale.z);
    if (![localDelta.x, localDelta.y, localDelta.z].every(Number.isFinite)) return false;
    if (!item.localPosition) item.localPosition = new Opus.Vec3(0, 0, 0);
    item.localPosition.set(item.localPosition.x + localDelta.x, item.localPosition.y + localDelta.y, item.localPosition.z + localDelta.z);
  } else {
    item.entity.position.set(item.entity.position.x + delta.x, item.entity.position.y + delta.y, item.entity.position.z);
  }
  updateHierarchyTransforms();
  return true;
}
function canTranslateBody2DWorld(item) {
  if (!item || !item.entity) return false;
  if (!item.parentId) return true;
  const parent = findItemById(item.parentId);
  if (!parent || !parent.entity) return false;
  resolveWorldTransform(parent);
  const node = (item.socketName && resolveSocketSourceTransform(parent, item.socketName)) || itemLocalNode(parent);
  const scale = node && node.scale;
  return !!scale && [scale.x, scale.y, scale.z].every(Number.isFinite) && Math.abs(scale.x) > 1e-8 && Math.abs(scale.y) > 1e-8 && Math.abs(scale.z) > 1e-8;
}
function characterTileObstacles(mover, bounds) {
  return globalThis.OpusCharacterTileQuery ? OpusCharacterTileQuery.query(placed, tilesets, mover, bounds, body2DManager && body2DManager.metrics, collisionLayers) : [];
}
const body2DManager = globalThis.OpusBody2D ? OpusBody2D.createBody2DManager({ collisionLayers: () => collisionLayers, translateWorld: translateBody2DWorld, canTranslateWorld: canTranslateBody2DWorld, tileObstacles: characterTileObstacles,
  characterVelocity: item => currentPlayerSettings && currentPlayerSettings.controllerType === 'topdown2d' && item.id === currentPlayerSettings.topdownObjectRef ?
    player && topdownPlayerObject() === item ? topdown2DIntent : [0, 0] :
    currentPlayerSettings && currentPlayerSettings.controllerType === 'platformer2d' && item.id === currentPlayerSettings.platformerObjectRef ?
    player && platformerPlayerObject() === item ? platformer2DIntent : [0, 0] : null }) : null;
window.opusBody2D = body2DManager;
window.getCharacterCollision2DState = (objectId) => body2DManager && placed.some((item) => item.id === objectId) ? body2DManager.getCharacterCollision2DState(objectId) : Object.freeze({ active: false, grounded: false, ceiling: false, wallLeft: false, wallRight: false, wallSliding: false, onSlope: false, groundNormal: null, slopeAngle: null, groundSupportId: null, onMovingPlatform: false, groundSupportVelocity: Object.freeze([0, 0]) });
function captureAuthoredBody2DTransforms() {
  authoredBody2DTransforms.clear();
  for (const item of placed) if (item.components && item.components['body-2d'] && item.entity) authoredBody2DTransforms.set(item.id, {
    position: item.entity.position.clone(), localPosition: item.localPosition ? item.localPosition.clone() : null,
    body: JSON.parse(JSON.stringify(item.components['body-2d'])),
  });
}
function restoreAuthoredBody2DTransforms() {
  for (const item of placed) {
    const saved = authoredBody2DTransforms.get(item.id);
    if (!saved || !item.entity) continue;
    item.entity.position.set(saved.position.x, saved.position.y, saved.position.z);
    item.localPosition = saved.localPosition ? saved.localPosition.clone() : undefined;
    if (item.components) item.components['body-2d'] = saved.body;
    body2DObjects.add(item);
  }
  authoredBody2DTransforms.clear();
  updateHierarchyTransforms();
}

// A fresh session (enterPlayMode) OR a mid-session level switch
// (switchToLevelDuringPlay) must both undo any "disappears when collected"
// state a previous playthrough left behind (see COLLECT_SCRIPT below) --
// otherwise replaying would start with already-collected crates missing --
// and must both give every Spawner a fresh, real `spawnerState` before
// `tickSpawners` ever runs, since `tickSpawners` silently skips any spawner
// item with none. Trigger Volume/Camera/Spawner/Light markers are
// editor-only furniture -- always hidden once Play is active, regardless of
// how Play got to this exact state (a fresh start or a level transition).
// Factored out because `switchToLevelDuringPlay` used to skip this entirely
// -- a level 2 loaded via Next Level/Switch Level had every Spawner
// permanently inert (no `spawnerState` ever set) and every marker left
// visible, found live dogfooding the Blacksite stress game's own
// Entry -> Core transition.
// Opt-in hide/show gates own only their runtime visibility and collider flags.
// Historical Show/Hide, teleports, and animated Opening Door presets are unchanged.
const doorGateState = new Map();
function validDoorGate(item) {
  const c = item && item.components && item.components['door-gate'];
  if (!item || !placed.includes(item) || !['cube','sprite'].includes(item.kind) || !item.entity
    || !c || c.version !== 1 || c.enabled !== true || typeof c.startsOpen !== 'boolean' || typeof c.persistState !== 'boolean') return false;
  for (const [id,kind] of [['box-collider-2d','box'],['circle-collider-2d','circle']]) {
    const collider = item.components[id];
    if (collider && (typeof collider.enabled !== 'boolean' || !OpusCollider2D.resolveCollider2DWorldShape(item, { ...collider, enabled: true }, kind))) return false;
  }
  const body = item.components['body-2d'];
  return !body || (OpusBody2D.validBody(body) && body.type === 'static');
}
function doorGateCloseObstruction(item, state) {
  if (item.kind === 'cube' && item.entity.solid && player && player.entity) {
    const cfg = itemColliderConfig(item), center = item.entity.position.add(cfg.offset);
    const position = player.entity.position;
    const vertical = ['firstperson','thirdperson'].includes(player.controllerType);
    const halfHeight = player.entity.scale.y * .5;
    const height = cfg.shape === 'box' ? cfg.half.y : cfg.radius;
    if (!vertical || (position.y + halfHeight > center.y - height + 1e-6 && position.y - halfHeight < center.y + height - 1e-6)) {
      const radius = player.controllerType === 'hovercraft' ? .55 : player.radius;
      const hit = resolveItemColliderCollision(position, new Opus.Vec3(), radius, item);
      if (hit.collided && hit.correctedPosition.sub(position).length() > 1e-7) return 'Player';
    }
  }
  if (OpusBody2D.role(item, 'static')) {
    const shapes = [];
    for (const [id, enabled] of Object.entries(state.colliders)) {
      if (!enabled) continue;
      const shape = OpusCollider2D.resolveCollider2DWorldShape(item, { ...item.components[id], enabled }, id === 'box-collider-2d' ? 'box' : 'circle');
      if (shape) shapes.push(shape);
    }
    for (const actor of placed) {
      if (actor === item || !OpusBody2D.role(actor, 'kinematic')) continue;
      for (const shape of shapes) for (const other of OpusCollider2D.enumerateCollider2DWorldShapes(actor)) {
        if (OpusCollisionFilter2D.allows(shape, other, collisionLayers) && OpusCollider2D.overlaps(shape, other)) return actor.name || actor.id;
      }
    }
  }
  return null;
}
function setDoorGateOpen(item, open, restoring = false) {
  if (!playMode || gameEnded || (!restoring && app.paused) || typeof open !== 'boolean') return { changed: false, reason: 'Door unavailable' };
  if (!validDoorGate(item)) {
    if (!restoring && typeof showToast === 'function') showToast('Choose an enabled Door / Gate with valid Collider settings; a 2D Body must be Static');
    return { changed: false, reason: 'Door unavailable' };
  }
  let state = doorGateState.get(item);
  if (!state) {
    state = { visible: item.entity.visible, colliders: {}, open: false };
    for (const id of ['box-collider-2d','circle-collider-2d']) if (item.components[id]) state.colliders[id] = item.components[id].enabled;
    doorGateState.set(item, state);
  }
  if (!open && state.open && !restoring) {
    const occupied = doorGateCloseObstruction(item, state);
    if (occupied) {
      if (typeof showToast === 'function') showToast('Doorway occupied — move clear and close again');
      return { changed: false, reason: 'Doorway occupied', occupiedBy: occupied, open: true };
    }
  }
  const changed = state.open !== open;
  item.entity.visible = open ? false : state.visible;
  for (const [id, enabled] of Object.entries(state.colliders)) if (item.components[id]) item.components[id].enabled = open ? false : enabled;
  state.open = open;
  return { changed, open };
}
function restoreDoorGatesForAuthoring() {
  for (const [item, state] of doorGateState) {
    if (item.entity) item.entity.visible = state.visible;
    for (const [id, enabled] of Object.entries(state.colliders)) if (item.components && item.components[id]) item.components[id].enabled = enabled;
  }
  doorGateState.clear();
}
function prepareDoorGatesForPlay() {
  restoreDoorGatesForAuthoring();
  for (const item of placed) if (validDoorGate(item)) setDoorGateOpen(item, item.components['door-gate'].startsOpen, true);
}
function authoredDoorGateRecord(record) {
  const item = placed.find(candidate => candidate.id === record.id), state = doorGateState.get(item);
  if (!state || !record.components) return record;
  const view = { ...record, components: { ...record.components } };
  for (const [id, enabled] of Object.entries(state.colliders)) if (view.components[id]) view.components[id] = { ...view.components[id], enabled };
  return view;
}
function compilePlatformMotion(item) {
  const c = item?.components?.['moving-platform-3d'];
  if (item?.kind !== 'cube' || !item.entity || !c || c.version !== 1 || c.enabled !== true ||
      typeof c.autoplay !== 'boolean' || !['x', 'y', 'z'].includes(c.axis) ||
      !Number.isFinite(c.distance) || !Number.isFinite(c.duration) || c.duration < .05 ||
      item.components['body-2d']?.enabled || !item.entity.solid) return null;
  const p = item.entity.position, start = [p.x, p.y, p.z];
  if (!start.every(Number.isFinite)) return null;
  const end = start.slice(); end[{ x: 0, y: 1, z: 2 }[c.axis]] += c.distance;
  if (!end.every(Number.isFinite)) return null;
  return { name: 'Component Platform Motion', duration: c.duration, loop: 'pingpong', tracks: {
    position: [{ t: 0, value: start, easing: 'linear' }, { t: c.duration, value: end, easing: 'linear' }],
    rotationY: [], scale: [], visible: [],
  } };
}
function startPlatformMotion(item, preparing = false) {
  if (!preparing && (!playMode || gameEnded || app.paused)) return { changed: false };
  const clip = compilePlatformMotion(item);
  if (!clip) {
    if (!preparing && typeof showToast === 'function') showToast('Choose an enabled Moving Platform 3D on a Solid Cube, without Body 2D');
    return { changed: false, reason: 'Platform unavailable' };
  }
  // Compile into the existing Property Animation owner, never authored clip or
  // Start records. Canonical animation Actions retain deliberate override semantics.
  item._anim = { clipIndex: -1, componentClip: clip, elapsed: 0, playing: true };
  return { changed: true };
}
function preparePlacedForPlay() {
  restoreDoorGatesForAuthoring();
  collectedPickupObjects = new WeakSet();
  captureAuthoredDeathBaseline();
  captureAuthoredObjectHealth(placed);
  const pathPointIds = new Set(placed.filter((item) => item.kind === 'path').flatMap((item) => item.pointIds || []));
  for (const item of placed) {
    if (item.kind === 'cube') item.entity.visible = !item.isTrigger && !item.isWaypoint && !item.isSpawnPoint && !item.isPathPoint && !pathPointIds.has(item.id);
    else if (item.kind === 'sprite') resetSpriteAnimationForItem(item, true);
    else if (item.kind === 'camera') item.entity.visible = false;
    else if (item.kind === 'spawner') { item.entity.visible = false; item.spawnerState = { enabled: item.options.startEnabled !== false, timer: 0, spawnedTotal: 0, activeIds: [], firstSpawnDone: false }; }
    else if (item.kind === 'light') item.entity.visible = false;
  }
  prepareDoorGatesForPlay();
  for (const item of placed) if (item.components?.['moving-platform-3d']?.autoplay === true) startPlatformMotion(item, true);
}
// Authoring and runtime share item records, but never their variable baselines.
// Capture current Inspector edits at Play; restore on Stop before Save/export.
function captureAuthoredObjectVariables(items) {
  for (const item of items) item._authoredVariables = { ...(item.variables || {}) };
}
function restoreAuthoredObjectVariables(items) {
  for (const item of items) if (item._authoredVariables) item.variables = { ...item._authoredVariables };
}
function captureAuthoredObjectHealth(items) {
  for (const item of items) item._authoredHealth = {
    health: OpusAuthoring.stableClone(item.health),
    component: OpusAuthoring.stableClone(item.components && item.components.health),
  };
}
function authoredHealthSerializationTarget(item) {
  if (typeof playMode === 'undefined' || !playMode || !item._authoredHealth) return item;
  const view = { ...item, health: OpusAuthoring.stableClone(item._authoredHealth.health) };
  if (item.components) {
    view.components = { ...item.components };
    if (item._authoredHealth.component === undefined) delete view.components.health;
    else view.components.health = OpusAuthoring.stableClone(item._authoredHealth.component);
  }
  return view;
}
function restoreAuthoredObjectHealth(items) {
  for (const item of items) if (item._authoredHealth) {
    if (item._authoredHealth.health === undefined) delete item.health;
    else item.health = OpusAuthoring.stableClone(item._authoredHealth.health);
    if (item.components) {
      if (item._authoredHealth.component === undefined) delete item.components.health;
      else item.components.health = OpusAuthoring.stableClone(item._authoredHealth.component);
    }
  }
}
// Session-only authoring recovery. Game-world persistence still records live
// destruction independently; only project records and Stop restore these objects.
let authoredDeathBaseline = new Map();
let authoredDeathJournal = new Set();
let authoredSessionLevels = new Map();
function captureAuthoredSessionLevels() {
  authoredSessionLevels.clear();
  for (const level of levels) authoredSessionLevels.set(level.id, {
    baseline: new Map((level === levels[currentLevelIndex] ? placed.filter(item => !item.runtimeSpawned).map(serializeItemRecord) : level.objects || []).map(record => [record.id, OpusAuthoring.stableClone(record)])),
    journal: new Set(),
  });
}
function captureAuthoredDeathBaseline() {
  // First preparation may also be used by qualification hosts. Never replace
  // a level's original records after Restart has loaded its live runtime view.
  if (!authoredSessionLevels.size) captureAuthoredSessionLevels();
  const id = levels[currentLevelIndex].id;
  let entry = authoredSessionLevels.get(id);
  if (!entry) {
    entry = { baseline: new Map(placed.filter(item => !item.runtimeSpawned)
      .map(item => [item.id, OpusAuthoring.stableClone(serializeItemRecord(item))])), journal: new Set() };
    authoredSessionLevels.set(id, entry);
  }
  authoredDeathBaseline = entry.baseline;
  authoredDeathJournal = entry.journal;
}
function rememberAuthoredDeath(item) {
  if (playMode && !item.runtimeSpawned && authoredDeathBaseline.has(item.id)) authoredDeathJournal.add(item.id);
}
function includeAuthoredDeaths(records, includeTransforms = true, baseline = authoredDeathBaseline, journal = authoredDeathJournal) {
  records = records.map(record => typeof authoredDoorGateRecord === 'function' ? authoredDoorGateRecord(record) : record);
  if (!journal.size && (!includeTransforms || !baseline.size)) return records;
  const byId = new Map(records.map(record => [record.id, record]));
  // Preserve survivor state except references invalidated by runtime removal.
  for (const [id, original] of baseline) {
    if (journal.has(id)) byId.set(id, OpusAuthoring.stableClone(original));
    else if (byId.has(id)) {
      const view = { ...byId.get(id) };
      // Project Save/export and Stop own authored transforms. Game Save still
      // reads live objects; mid-play level transitions explicitly retain their
      // historical runtime transform view instead of baking it into authoring.
      if (includeTransforms && ['cube', 'sprite'].includes(original.kind)) {
        for (const key of ['position','scale','rotationY','quaternion','parentId','socketName','localPosition','localRotationY','localQuat','localScale']) {
          if (original[key] === undefined) delete view[key];
          else view[key] = OpusAuthoring.stableClone(original[key]);
        }
        if (view.components) {
          view.components = { ...view.components };
          if (original.components && original.components.transform) view.components.transform = OpusAuthoring.stableClone(original.components.transform);
          else delete view.components.transform;
        }
      }
      if (journal.has(original.parentId)) {
        for (const key of ['parentId','socketName','localPosition','localRotationY','localQuat','localScale']) {
          if (original[key] === undefined) delete view[key]; else view[key] = OpusAuthoring.stableClone(original[key]);
        }
      }
      if (Array.isArray(original.connections)&&(view.connections===undefined||Array.isArray(view.connections))) view.connections = Array.from(new Set([...(view.connections || []), ...original.connections.filter(key => journal.has(key))]));
      if (original.pointIds) view.pointIds = Array.from(new Set([...(view.pointIds || []), ...original.pointIds.filter(key => journal.has(key))]));
      byId.set(id, view);
    }
  }
  const ordered = [];
  for (const id of baseline.keys()) if (byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id); }
  return ordered.concat(Array.from(byId.values()));
}
function authoredLevelObjectRecords(level) {
  const entry = authoredSessionLevels.get(level.id);
  const records = OpusAuthoring.stableClone(level.objects || []);
  return entry ? includeAuthoredDeaths(records, true, entry.baseline, entry.journal) : records;
}
function restoreAuthoredDeaths() {
  if (authoredDeathJournal.size || authoredDeathBaseline.size) {
    const records = includeAuthoredDeaths(placed.map(serializeItemRecord));
    loadScene(records); // same reconstruction as Save/Load, not a second entity loader
  }
  for (const level of levels) if (authoredSessionLevels.has(level.id)) {
    // Current objects have just been reconstructed by the canonical loader;
    // inactive level views are restored independently without touching Game Save.
    level.objects = level === levels[currentLevelIndex] ? placed.filter(item => !item.runtimeSpawned).map(serializeItemRecord) : authoredLevelObjectRecords(level);
  }
  authoredSessionLevels.clear();
  authoredDeathBaseline.clear();
  authoredDeathJournal.clear();
}
function enterPlayMode() {
  if(projectDurability){projectDurability.dirtyBeforePlay=projectHasUnsavedChanges();projectDurability.pristineBeforePlay=projectIsUntouchedBaseline();}
  openingMenuFreshSession = true;
  releaseTouchInputControls();touchInputMappingPage=0;
  inputDeviceRuntime=null;
  resetTransientScreens();
  renderMenuScreenLaunchers();
  if (typeof OpusHudBindings !== 'undefined') refreshHudBindingCatalog();
  captureAuthoredUiConfigs();
  syncCurrentLevelObjects();
  captureAuthoredSessionLevels();
  authoredDeathBaseline.clear();
  authoredDeathJournal.clear();
  signalRuntime.clear();
  graphTrace.clear();graphTraceGraphLocation.locations=[];if(graphTrace.enabled)graphTrace.record({time:0,outcome:'SESSION_START'});syncGraphTrace(true);
  captureAuthoredObjectVariables(placed);
  if (body2DManager) body2DManager.clearCharacterCollision2DState();
  // A fresh session always boots from the designated Start Level, not
  // necessarily whichever level happens to be open for editing.
  // Play From Here tests the level being edited instead.
  const fromHere = typeof playFromHereActive === 'function' && playFromHereActive();
  if (!fromHere && startLevelIndex !== currentLevelIndex && levels[startLevelIndex]) switchToLevel(startLevelIndex);
  captureAuthoredBody2DTransforms();
  if(typeof authoringFixtureCapture!=='undefined')authoringFixtureCapture=null;
  if(typeof authoringFixtureCheck!=='undefined')cancelAuthoringFixtureCheck('Play started; isolated check cancelled without changing the authored project.');
  playMode = true;
  app.scene.spinEnabled = true;
  startPerformanceProfilerSession();
  if (sculptDragState) finishTerrainSculptGesture();
  if (paintDragState) finishTerrainPaintGesture();
  showTerrainSculptPreview(null);
  if (scatterBrushDragState) finishScatterBrushGesture();
  if (scatterBrushMarker) scatterBrushMarker.visible=false;
  if(typeof setPlayerAuthoringControlsEditable==='function')setPlayerAuthoringControlsEditable();
  setShadowAuthoringControlsEditable();
  compileInputDeviceRuntime();
  compileInputContextRuntime();
  renderSignalManager();
  gameEnded = false;
  loadPlayerInputOverrides(); // Wave 6 (Priority D): reload the player's own rebinds fresh each session
  renderMappedTouchControls();
  playerFrozen = false; // Wave 6 (Priority L): a fresh session must never start already frozen mid-cutscene
  if (app.paused) app.resume(); // defensive: a fresh session must never start already paused
  endOverlayEl.classList.remove('visible');
  pauseOverlayEl.classList.remove('visible');
  setObjective('');
  deselectAll();
  canvas.style.cursor = '';
  document.getElementById('play-btn').textContent = '■ Stop';
  document.getElementById('play-btn').classList.add('playing');
  document.getElementById('pause-btn').disabled = false;
  // Named counters (health/lives/score/...) must start each play session
  // fresh too -- previously __gameState only ever got created lazily on
  // first write and otherwise persisted silently across Stop/Play cycles,
  // so a health counter depleted in a previous attempt would carry into the
  // next one instead of resetting.
  window.__gameState = {};
  window.__checkpoint = null;
  window.__damageCooldowns = {};
  window.__gameTimers = {};
  window.__gameFlags = {};
  window.__gameInventory = {};
  lootDrawCounters = Object.create(null);
  window.__gameObjectives = {};
  window.__worldState = {};
  window.__destroyedPersistentIds = {};
  window.__gamePlaytimeSeconds = 0; // Wave 8 (Priority H): reset on every fresh Play; Load Game restores it from the save's own metadata instead (see loadGame's exec)
  if (trigger2DManager) trigger2DManager.reset();
  window.__trigger2DEventLog = [];
  window.__lastTrigger2DEvent = null;
  window.__currentTrigger2DEvent = null;
  teardownPlayerEquipment(); // Wave 7 (Priority C): fresh Play must not carry a previous attempt's equipped visuals/state
  heldObjectItem = null; // Wave 7 (Priority J): fresh Play must not start with a stale held-object reference from a previous attempt
  pendingDelays = [];
  deferredCalls = [];
  runningSequenceIds = [];
  activeCameraBlend = null;
  activeCameraPath = null; // Wave 9C (Section 27): same cleanup requirement as Camera Blend just above
  lastAppliedCameraItemId = null;
  resetParallaxRuntime();
  activeTweens = [];
  activeProjectiles = [];
  lastAttackTime = -Infinity;
  // Keep the existing App callback's simulation epoch. App time survives
  // editing/Stop; resetting only this mirror makes fresh OnStart waits expire
  // on the first Play frame after any sufficiently long authoring session.
  for (const item of placed) {
    if (item._anim) item._anim.playing = false;
    if (item._carryPrevPos) item._carryPrevPos = undefined;
    // Dogfood (Signal Relay) fix: restore each object's variables to their
    // AUTHORED baseline on every fresh Play, not whatever the previous Stop
    // left mutated in place -- see the `_authoredVariables` comment in
    // instantiateCubeRecord/instantiateItemFromRecord for why a separate
    // snapshot exists at all. An item placed live during Play itself (never
    // went through either instantiate function with a record) has no
    // `_authoredVariables`, so it's simply left alone here.
    if (item._authoredVariables) item.variables = { ...item._authoredVariables };
  }
  // Sprite frame-zero events are real gameplay events, so autoplay begins
  // only after the fresh-session state above has been reset.
  preparePlacedForPlay();
  for (const item of placed) wireItemTrigger(item);
  // Wave 9B -- REAL BUG found live dogfooding Arsenal Run's own "grant +
  // equip weapons on Start" pattern: `spawnPlayer` used to run AFTER
  // `runStartBehaviors()`, so `player` was still `null` (a genuine fresh
  // Stop->Play cycle always despawns it first) for the ENTIRE duration of
  // every On Start behavior -- `equipItemToSlot`'s own `if (!player) return`
  // silently no-oped every single time. This had never been caught before
  // because nothing prior to Weapons 2.0 called Equip Item from an On Start
  // behavior (Wave 7's own Equipment dogfood only ever equipped via a
  // runtime Interact/pickup, always well after spawn). Fixed by spawning
  // the Player BEFORE Start behaviors run, so any Start behavior that
  // reads/touches the Player (Equip Item included) sees a real, live one.
  if (cameraViewState) exitCameraView();
  spawnPlayer(computeSpawnPoint());
  const authoredActiveCamera = placed.find((item) => item.kind === 'camera' && item.isActiveCamera);
  if (authoredActiveCamera) applyCameraPreset(authoredActiveCamera);
  captureParallaxReference();
  runStartBehaviors();
  startAmbientAudioForCurrentLevel();
  initFogZonesForCurrentLevel();
  showStartScreenIfConfigured();
}

// Reuses the existing, already-proven Pause plumbing (App.pause/resume)
// rather than inventing a second "is input blocked" concept -- the Start
// Screen visually covers the viewport AND the game is genuinely paused
// underneath it, so there's no window where a keyboard key could move the
// player before the screen is dismissed.
function showStartScreenIfConfigured() {
  updateMainMenuExtras(); // Controls also appears in Pause when Start is disabled.
  const cfg = currentUiConfig.startScreen;
  if (!cfg.enabled) return;
  if (typeof playFromHereActive === 'function' && playFromHereActive()) return; // testing a spot: straight into the game
  document.getElementById('start-overlay-title').textContent = cfg.title || '';
  document.getElementById('start-overlay-subtitle').textContent = cfg.subtitle || '';
  document.getElementById('start-overlay-btn').textContent = cfg.buttonText || 'Start';
  document.getElementById('start-overlay').classList.add('visible');
  app.pause();
}
function startOpeningMenuGame() {
  if (!playMode) return false;
  // Explicit opt-in only: historical Start resumes its existing session.
  // Initial Play has already performed the canonical fresh-session reset;
  // do not repeat Start Behaviors just to dismiss that first menu.
  if (currentUiConfig.startScreen.newGame === true && !openingMenuFreshSession) {
    exitPlayMode();
    enterPlayMode();
  }
  openingMenuFreshSession = false;
  document.getElementById('start-overlay').classList.remove('visible');
  if (app.paused) app.resume();
  return true;
}
document.getElementById('start-overlay-btn').addEventListener('click', startOpeningMenuGame);

// On Start fires once for every item that has one, giving a scene a place
// to initialize counters (starting health/lives) or show an opening
// objective -- the fixed Click/Enter/Exit triggers all need something to
// happen to the player first, which nothing does before this point.
// Called both at the start of a fresh Play session (enterPlayMode) and
// after a mid-session Switch Level (switchToLevelDuringPlay) -- a newly
// entered level deserves its own opening beat too, just without the
// session-wide state resets (__gameState, checkpoint) a FRESH session gets.
function runStartBehaviors() {
  // Wave 8 (Priority A dogfood, a real bug found via the dependency
  // collector's own cycle-protection test): iterates a SNAPSHOT
  // (`.slice()`), not the live `placed` array. `for...of` over the live
  // array is not a fixed-length pass -- if one object's own "On Start"
  // behavior spawns a NEW object (Spawn Prefab) that ALSO has an "On
  // Start" behavior, that new object gets appended to the SAME array this
  // loop is still iterating, and `for...of` keeps walking into it,
  // firing ITS "On Start" too. A genuine cycle (A's own On Start spawns B,
  // B's own On Start spawns A) turned this into an unbounded runaway --
  // reproduced live: `placed.length` reached 60,000+ objects and the tab
  // had to be recovered. A freshly Spawn-Prefab'd object's own "On Start"
  // behavior was never documented or intended to auto-fire (spawnPrefab's
  // own exec only ever wires enter/exit/stay via `wireItemTrigger`, not
  // 'start') -- this was purely an iteration-safety bug in THIS loop, not
  // a feature anything actually relied on.
  runLifecycleBehaviors('start');
  if (typeof startScripts === 'function') startScripts();
}

// Creates and registers the live TriggerVolume for one item, if its
// behaviors call for one. Factored out of enterPlayMode's bulk setup loop
// so a runtime-spawned item (Spawn Prefab action, below) gets the exact
// same live wiring a design-time item gets at Play start, instead of only
// working starting the NEXT play session.
function wireItemTrigger(item) {
  if (item.kind !== 'cube' || !item.behaviors) return;
  const scriptCode = item.script?.enabled !== false && item.script?.code || ''; // Script component trigger hooks
  const hasEnter = item.behaviors.some((b) => b.trigger === 'enter') || /function\s+onTriggerEnter\s*\(/.test(scriptCode);
  const hasExit = item.behaviors.some((b) => b.trigger === 'exit') || /function\s+onTriggerExit\s*\(/.test(scriptCode);
  // On Stay -- fires every frame the player is inside (Damage Zones: a
  // Trigger Volume with a Damage Player behavior whose OWN Cooldown field
  // throttles actual damage, not the one-shot flag below, since a Damage
  // Zone must keep re-firing on every visit, not just the first).
  const hasStay = item.behaviors.some((b) => b.trigger === 'stay');
  if (!hasEnter && !hasExit && !hasStay) return;
  item.triggerFired = false; // reset one-shot state for this play session
  // One-shot only applies to Trigger Volumes (triggerRepeat === false) --
  // an ordinary crate/hazard keeps its existing "fires every time you
  // cross it" behavior, since that's what the shipped starter game relies on.
  const oneShot = item.isTrigger && item.triggerRepeat === false;
  // Wave 6 (Priority A/Section 8): a real Trigger Volume marker (isTrigger)
  // defaults to its ACTUAL rendered box shape now, fixing the long-standing
  // "looks like a box, behaves like a giant sphere" mismatch -- an author
  // can still explicitly opt back into Sphere via `triggerShape:'sphere'`.
  // Deliberately scoped to isTrigger markers only: an ordinary enter/exit/
  // stay cube that ISN'T an authored Trigger Volume (a crate, a hazard, a
  // Priority K pickup preset) keeps its existing sphere-1.5x-scale
  // "generous touch radius" behavior completely unchanged -- that's the
  // CORRECT feel for "walk near this and pick it up," not a bug to fix.
  const useBoxShape = item.isTrigger && item.triggerShape !== 'sphere';
  const shapeOptions = useBoxShape
    ? { shape: 'box', half: item.entity.scale.scale(0.5), quat: item.entity.quaternion }
    : { shape: 'sphere', radius: 1.5 * Math.max(item.entity.scale.x, item.entity.scale.z) };
  const volume = new Opus.Physics.TriggerVolume({
    center: item.entity.position,
    ...shapeOptions,
    onEnter: hasEnter ? () => {
      if (oneShot && item.triggerFired) return;
      item.triggerFired = true;
      runBehaviors(item, 'enter');
    } : undefined,
    onExit: hasExit ? () => {
      if (oneShot && item.triggerFired) return;
      if (oneShot) item.triggerFired = true;
      runBehaviors(item, 'exit');
    } : undefined,
    onStay: hasStay ? () => runBehaviors(item, 'stay') : undefined,
  });
  playTriggers.push({ item, volume });
}

function exitPlayMode() {
  if (typeof stopScripts === 'function') stopScripts();
  openingMenuFreshSession = false;
  releaseTouchInputControls();
  inputDeviceRuntime=null;
  resetTransientScreens();
  collectedPickupObjects = new WeakSet();
  signalRuntime.clear();
  if(graphTrace.enabled)graphTrace.record({time:simElapsed,outcome:'SESSION_STOP'});syncGraphTrace(true);
  playMode = false;
  app.scene.spinEnabled = false;
  stopPerformanceProfilerSession();
  if(typeof setPlayerAuthoringControlsEditable==='function')setPlayerAuthoringControlsEditable();
  setShadowAuthoringControlsEditable();
  restoreAuthoredUiConfigs();
  updateInteract(); // Stop must remove the old target/prompt, not just gate Actions.
  renderSignalManager();
  restoreAuthoredObjectVariables(placed);
  restoreAuthoredObjectHealth(placed);
  restoreDoorGatesForAuthoring();
  if (body2DManager) body2DManager.clearCharacterCollision2DState();
  restoreAuthoredBody2DTransforms();
  playTriggers = [];
  if (trigger2DManager) trigger2DManager.reset();
  window.__currentTrigger2DEvent = null;
  pendingDelays = []; // a Delay from this session must never fire into the next one
  deferredCalls = [];
  runningSequenceIds = []; // a Sequence's own Delay must never fire into a dead/next session either
  activeCameraBlend = null; // an in-flight camera blend must never keep animating into a dead session
  activeCameraPath = null; // Wave 9C (Section 27): same reasoning for an in-flight Camera Path
  lastAppliedCameraItemId = null;
  resetParallaxRuntime();
  activeTweens = [];
  activeProjectiles = []; // the underlying items are cleaned up below via the existing runtimeSpawned sweep
  for (const code of gamepadHeldKeys) app.input.simulateKeyUp(code,'gamepad');
  gamepadHeldKeys.clear();
  gamepadStartWasHeld = false;
  // Runtime-spawned items (Spawn Prefab) are session furniture, not scene
  // content -- without this, repeated Play/Stop cycles would silently pile
  // up an ever-growing number of leftover enemies each time.
  for (const item of placed.slice()) {
    if (item.runtimeSpawned) removeItemFromScene(item);
  }
  restoreAuthoredDeaths();
  despawnPlayer();
  stopAmbientAudio();
  if (app.paused) app.resume(); // Stop always leaves things in a resumed state, not paused-and-stuck
  document.getElementById('play-btn').textContent = '▶ Play';
  document.getElementById('play-btn').classList.remove('playing');
  document.getElementById('pause-btn').disabled = true;
  toastEl.classList.remove('visible');
  endOverlayEl.classList.remove('visible');
  pauseOverlayEl.classList.remove('visible');
  document.getElementById('start-overlay').classList.remove('visible');
  document.getElementById('dialogue-overlay').classList.remove('visible');
  document.getElementById('hud-elements-layer').innerHTML = '';
  setObjective('');
  // Wave 9 (Priority A/Section 26) -- crosshair/recoil/shake are all
  // session-scoped transient state; a Stop must not leave any of them
  // bleeding into the editor view or the next Play session.
  document.getElementById('crosshair').classList.remove('visible');
  recoilPitchOffset = 0; recoilYawOffset = 0;
  clearCameraShake();
  weaponRuntimeState = {};
  activeWeaponSlot = 'primaryHand';
  for (const item of placed) if (item.kind === 'sprite') resetSpriteAnimationForItem(item, false);
}

// Starting Play turns this same focused button into Stop. Release only that
// focus in active gameplay so a real Space jump cannot activate Stop by default.
// Do not suppress keyboard input globally or steal focus from paused/menu fields.
function releasePlayButtonFocusForGameplay() {
  if (!playMode || app.paused || gameEnded) return false;
  const button = document.getElementById('play-btn');
  if (!button || document.activeElement !== button || typeof button.blur !== 'function') return false;
  button.blur();
  return true;
}

document.getElementById('play-btn').addEventListener('click', () => {
  if (playMode) exitPlayMode();
  else { enterPlayMode(); markOnboardingProgress('play'); releasePlayButtonFocusForGameplay(); }
});

// Pause freezes simulation at the engine level (App.pause/resume, already
// built -- camera, physics/AI update callbacks, and audio's engine hum all
// stop; rendering and input keep running) but had no editor-facing way to
// reach it: no button, and no visible feedback for the Escape-key toggle
// the engine already wires up internally (App's own keydown listener,
// engine/src/22-api.js) -- a player pressing Escape had no way to tell
// whether anything had actually happened.
document.getElementById('pause-btn').addEventListener('click', () => {
  if (!playMode) return;
  if (app.paused) app.resume(); else app.pause();
});
// App.onPauseChange (already public, engine/src/22-api.js) fires
// regardless of WHICH path triggered the change -- this button or the
// engine's own internal Escape binding, which the editor has no other hook
// into at all -- so the overlay/label stay correct either way with no
// polling needed.
function syncPauseScreen(paused) {
  if (paused) resetControllerStateEvents();
  if (paused && currentPlayerSettings && currentPlayerSettings.controllerType === 'platformer2d') resetPlatformerPlayerIntent();
  if (paused && currentPlayerSettings && currentPlayerSettings.controllerType === 'topdown2d') resetTopdownPlayerIntent();
  if(paused&&typeof releaseTouchInputControls==='function')releaseTouchInputControls();
  if (paused) touchLookPointerId = null;
  // Toolbar/API Resume cannot leave a pause-owning modal over live gameplay.
  // The last owner is removed before the deliberate release resumes App.
  if (!paused && gameplayScreenPauseOwners.size) { app.pause(); return; }
  // Wave 4 fix, found dogfooding the new Pause Menu buttons: App.pause() is
  // also how the Start Screen and Dialogue already implement themselves
  // (see the comments on each -- reusing the same proven pause plumbing was
  // deliberate, not a bug). Before the pause overlay had real buttons, that
  // meant it was ALSO "visible" (by class) underneath the Start Screen the
  // whole time a fresh session's Start Screen was up -- invisible in
  // practice only because it had no interactive content and a lower
  // z-index. Now that it has real Resume/Restart/Main Menu buttons, showing
  // it stacked behind the Start Screen or a Dialogue box is a real bug, not
  // a cosmetic one -- gate it to the actual "player paused" case only.
  const startScreenShowing = document.getElementById('start-overlay').classList.contains('visible');
  const dialogueShowing = gameplayScreenPauseOwners.has('dialogue') || document.getElementById('dialogue-overlay').classList.contains('visible');
  // Wave 8 (Priority E): Inventory also pauses via this SAME app.pause()
  // plumbing (Section 31's chosen default) -- excluded here for the exact
  // same reason Dialogue/Start Screen already are, so opening Inventory
  // doesn't ALSO pop the plain Pause overlay stacked behind it.
  const inventoryShowing = document.getElementById('inventory-overlay').classList.contains('visible');
  const menuShowing = document.getElementById('menu-screen-overlay')?.classList.contains('visible');
  pauseOverlayEl.classList.toggle('visible', playMode && paused && !startScreenShowing && !dialogueShowing && !inventoryShowing && !menuShowing);
  document.getElementById('pause-btn').textContent = paused ? '▶ Resume' : '⏸ Pause';
  // Pointer Lock (Wave 5): released the instant ANYTHING pauses (the Pause
  // button, Start Screen, or Dialogue -- this callback fires for all three,
  // the exact reasoning the comment above already established) so the
  // mouse is free to click pause/dialogue/start UI, and never left locked
  // behind an overlay the player can't otherwise reach with the cursor --
  // "do not trap users in Pointer Lock." Re-acquired automatically once
  // resumed while still in a First-Person Play session (the canvas click
  // handler covers the case where the browser's own Escape key already
  // dropped it and a fresh click is what re-triggers this).
  if (playMode && player && player.controllerType === 'firstperson' && !isTouchDevice) {
    if (paused) releaseFirstPersonPointerLock();
    else requestFirstPersonPointerLock();
  }
}
app.onPauseChange(syncPauseScreen);
app.onPauseChange(blockPreResumeInputPresses);

