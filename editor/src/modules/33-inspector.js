// --- Inspector ---

function rgbToHex(color) {
  const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(color[0])}${c(color[1])}${c(color[2])}`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// The scene-removal half of "delete an object" -- shared by deleteSelected
// (multi-item toolbar delete) and the Destroy Object action (single item,
// possibly mid-gameplay, never itself selected), so there's one place that
// knows how to remove each kind from both the engine and `placed`.
// Wave 7 (Priority E/Section 34): the ONE place any destruction (Destroy
// Object, Destroy Assembly, world-state restore itself) funnels through,
// so persistent-destruction tracking needs no second call site to remember.
// Gated on `playMode` -- an author deleting an object in the EDITOR itself
// (Delete Object button, prefab swap-and-replace) must never be mistaken
// for a runtime gameplay destruction.
function markPersistentDestruction(item) {
  if (!playMode || !item.persistRuntimeState) return;
  const levelId = levels[currentLevelIndex] && levels[currentLevelIndex].id;
  if (!levelId) return;
  window.__destroyedPersistentIds = window.__destroyedPersistentIds || {};
  window.__destroyedPersistentIds[levelId] = window.__destroyedPersistentIds[levelId] || new Set();
  window.__destroyedPersistentIds[levelId].add(item.id);
}
// Wave 7 (Priority E): builds ONE level's own worldState slice --
// `{[objectId]: {destroyed} | {destroyed:false, visible, position,
// rotation, health?}}` -- covering only objects with `persistRuntimeState`
// set, and only the properties that actually apply (no `health` key for an
// object with no Health system initialized). `placed` only ever holds the
// CURRENTLY LOADED level's own objects, so a level other than the active
// one is covered entirely by its own destroyed-id set (persisted runtime
// destructions, tracked live by `markPersistentDestruction` regardless of
// which level is active at the time) -- its other fields (position, etc.)
// were already captured into `window.__worldState` the last time THAT
// level was itself active, and this function is not asked to re-derive
// them from nothing.
function collectWorldStateForLevel(levelId) {
  const state = {};
  const destroyedSet = (window.__destroyedPersistentIds && window.__destroyedPersistentIds[levelId]) || new Set();
  for (const id of destroyedSet) state[id] = { destroyed: true };
  const activeLevelId = levels[currentLevelIndex] && levels[currentLevelIndex].id;
  if (levelId === activeLevelId) {
    for (const item of placed) {
      if (item.kind !== 'cube' || !item.persistRuntimeState) continue;
      const rec = {
        destroyed: false,
        visible: item.entity.visible,
        position: [item.entity.position.x, item.entity.position.y, item.entity.position.z],
        rotation: [item.entity.quaternion.x, item.entity.quaternion.y, item.entity.quaternion.z, item.entity.quaternion.w],
      };
      if (item.health) rec.health = item.health.current;
      // Wave 8 (Priority B/Section 13): Object Variables OPT IN to World
      // State persistence only alongside `persistRuntimeState` (never
      // automatically for every object with variables) -- and only real
      // ones present at capture time, never a blind clone of authored
      // defaults.
      if (item.variables && Object.keys(item.variables).length) rec.variables = { ...item.variables };
      state[item.id] = rec;
    }
  }
  if (levelId === activeLevelId) for (const item of placed) {
    if (!validDoorGate(item) || item.components['door-gate'].persistState !== true) continue;
    const gate = doorGateState.get(item);
    if (gate) state[item.id] = { ...(state[item.id] || {}), doorOpen: gate.open };
  }
  return state;
}
function captureCurrentLevelWorldState() {
  const levelId = levels[currentLevelIndex] && levels[currentLevelIndex].id;
  if (!levelId) return;
  window.__worldState = window.__worldState || {};
  window.__worldState[levelId] = collectWorldStateForLevel(levelId);
}
// Applies a previously-saved worldState slice onto the CURRENTLY LOADED
// level's own freshly-rebuilt authored scene -- MUST run after that scene
// already exists (see Section 37's restore order, enforced by this
// function's own two call sites in the `loadGame` action above, never
// called any earlier). A record whose object no longer resolves (either
// truly gone, or the `destroyed:true` case) is always a silent no-op --
// nothing to restore state ONTO.
function applyWorldStateToCurrentLevel() {
  const levelId = levels[currentLevelIndex] && levels[currentLevelIndex].id;
  const stateForLevel = window.__worldState && window.__worldState[levelId];
  if (!stateForLevel) return;
  for (const id in stateForLevel) {
    const rec = stateForLevel[id];
    const item = findItemById(id);
    if (!item) continue;
    if (rec.destroyed) { removeItemFromScene(item); continue; }
    if (rec.visible != null) item.entity.visible = rec.visible;
    if (rec.position) item.entity.position.set(rec.position[0], rec.position[1], rec.position[2]);
    if (rec.rotation) item.entity.quaternion = new Opus.Quat(rec.rotation[0], rec.rotation[1], rec.rotation[2], rec.rotation[3]);
    if (rec.health != null && item.health) item.health.current = rec.health;
    if (rec.variables) item.variables = { ...(item.variables || {}), ...rec.variables };
    if (typeof rec.doorOpen === 'boolean' && validDoorGate(item) && item.components['door-gate'].persistState === true) setDoorGateOpen(item, rec.doorOpen, true);
  }
}
function removeItemFromScene(item) {
  rememberAuthoredDeath(item);
  markPersistentDestruction(item);
  if (body2DManager) body2DManager.clearCharacterCollision2DState(item.id);
  trigger2DObjects.delete(item);
  body2DObjects.delete(item);
  // Wave 8 (Priority K dogfood/Power Grid): destroying the currently-HELD
  // object directly (e.g. "insert the carried Power Cell, consuming it" --
  // a real, natural Carry/Drop end state Wave 7's own dogfood never
  // exercised) must not leave `heldObjectItem` pointing at a destroyed
  // entity -- `syncHeldObjectPosition` would otherwise keep writing
  // position/quaternion onto a dead object every frame forever, and
  // `objectIsHeld` would keep reporting true for something no longer in
  // the scene at all.
  if (heldObjectItem === item) heldObjectItem = null;
  if (item.kind === 'cube' || item.kind === 'sprite' || item.kind === 'tilemap') app.scene.remove(item.entity);
  else if (item.kind === 'terrain') app.removeTerrain(item.handle);
  else if (item.kind === 'water') app.removeWater(item.handle);
  else if (item.kind === 'emitter') app.removeEmitter(item.handle);
  else if (item.kind === 'camera') app.scene.remove(item.entity);
  else if (item.kind === 'spawner') app.scene.remove(item.entity);
  else if (item.kind === 'light') { app.scene.remove(item.entity); app.removeLight(item.lightHandle); }
  // Wave 8 (Priority I): a Path's own container item has no entity/handle
  // of its own to remove from the engine scene (nothing above matches
  // `kind === 'path'`); a deleted POINT MARKER (an ordinary `kind:'cube'`
  // item, already handled by the first branch above) additionally prunes
  // itself out of its owning path's `pointIds` here, so a path never ends
  // up referencing a dangling id.
  if (item.kind === 'cube' && item.isPathPoint && item.pathId) {
    const owner = findItemById(item.pathId);
    if (owner && owner.pointIds) owner.pointIds = owner.pointIds.filter((id) => id !== item.id);
  }
  const idx = placed.indexOf(item);
  if (idx !== -1) placed.splice(idx, 1);
  // A deleted parent must not leave children pointing at a dangling id --
  // resolveWorldTransform() fails safe against that already (falls back to
  // unparented), but unparenting them explicitly here keeps entity.* correct
  // starting THIS frame rather than depending on that fallback ever running,
  // and keeps the Scene tree from showing a orphaned-looking indent.
  for (const other of placed) {
    if (other.parentId === item.id) unparentItem(other);
    if (other.isWaypoint && Array.isArray(other.connections)) other.connections = other.connections.filter((id) => id !== item.id);
  }
  if (selectedItems.has(item)) {
    selectedItems.delete(item);
    if (selectedItem === item) selectedItem = null;
    syncSelectionMarkers();
  }
  // A destroyed item's own TriggerVolume (if any -- e.g. Destroy Object
  // fired on a runtime-spawned enemy that was itself a Trigger Volume, or
  // just had an Enter/Exit behavior) must stop being polled, or it would go
  // on calling onEnter/onExit against a position nothing is updating anymore.
  const triggerIdx = playTriggers.findIndex((t) => t.item === item);
  if (triggerIdx !== -1) playTriggers.splice(triggerIdx, 1);
}

function deleteSelected() {
  if (selectedItems.size === 0) return;
  pushUndo();
  for (const item of Array.from(selectedItems)) removeItemFromScene(item);
  // Deleting the one designated default Spawn Point would otherwise leave
  // the level with zero default -- computeSpawnPoint()'s explicit-Spawn-Point
  // priority would silently fall through to the terrain/solid-ground/safe-
  // default chain with no indication anything changed. Auto-promote whatever
  // Spawn Point remains, same "never leave zero of the thing that must exist
  // exactly once" reasoning as Start Level.
  const remainingSpawnPoints = placed.filter((p) => p.isSpawnPoint);
  if (remainingSpawnPoints.length > 0 && !remainingSpawnPoints.some((p) => p.isDefaultSpawn)) {
    remainingSpawnPoints[0].isDefaultSpawn = true;
  }
  deselectAll();
}

// A graph behavior's `graph` ({ nodes, edges }) is a nested object -- a
// plain shallow `{ ...b }` would leave a duplicate/undo-snapshot/reload
// sharing the SAME graph object as its source, so editing one later would
// silently mutate the other. Used by serializeScene, loadScene, and
// duplicateSelected -- everywhere a behaviors array gets copied.
function cloneBehaviors(behaviors) {
  return (behaviors || []).map((b) => {
    if (b.action === 'graph' && b.graph) return { ...b, eventRef:b.eventRef?JSON.parse(JSON.stringify(b.eventRef)):b.eventRef, graph: typeof OpusGraphSchema==='undefined'?JSON.parse(JSON.stringify(b.graph)):OpusGraphSchema.migrate(b.graph) };
    if (b.action === 'dialogueTree' && b.dialogueTree) return { ...b, eventRef:b.eventRef?JSON.parse(JSON.stringify(b.eventRef)):b.eventRef, dialogueTree: JSON.parse(JSON.stringify(b.dialogueTree)) };
    // Wave 9D -- REAL BUG found live dogfooding the new Audio Asset Prefab
    // Parameter: this fallback branch used to be a SHALLOW `{ ...b }`,
    // leaving `b.params` (an object, for every non-legacy action) as one
    // SHARED reference across every instance ever cloned from the same
    // source behaviors array (prefab spawn, Duplicate, Array, Scatter --
    // every one of them routes through instantiateCubeRecord ->
    // cloneBehaviors). Harmless as long as nothing ever mutated `params`
    // in place after cloning; the new `soundAsset` Prefab Parameter binding
    // is the first thing that does (`b.params.audioAssetId = value`,
    // applyPrefabParamBinding) -- setting one instance's audio override
    // silently overwrote EVERY sibling instance's params object too, since
    // they were kept literally the same object. The exact same bug CLASS
    // Wave 8 already fixed once for `instantiateCubeRecord`'s shared
    // `record.color` array (see that fix's own comment) -- a different
    // field, same root cause, same fix shape.
    return { ...b, params: b.params ? { ...b.params } : b.params, eventRef: b.eventRef ? { ...b.eventRef } : b.eventRef };
  });
}

// Placing several similar objects (another crate, another hazard) meant
// re-dragging from the palette and re-adding behaviors each time -- cloning
// the current selection is much cheaper when what you want is "one more of
// this" (or several: duplicating a multi-selection clones the whole group
// and selects the clones, not the originals). Reuses each item's own mesh
// (entity.mesh), so a duplicated hazard stays a mine-shape and a duplicated
// boost pad stays a pyramid, not a generic cube.
function duplicateSelected() {
  if (selectedItems.size === 0) return;
  pushUndo();
  const newItems = [];
  // Duplicates of a grouped selection stay linked to EACH OTHER under a
  // fresh group id, not the source's -- otherwise "Duplicate All" on a
  // group would silently merge six objects into one twelve-member group
  // instead of producing two independent groups of six.
  const groupIdMap = new Map();
  const signalInstanceMap = new Map();
  function remapGroupId(srcGroupId) {
    if (!srcGroupId) return undefined;
    if (!groupIdMap.has(srcGroupId)) groupIdMap.set(srcGroupId, generateGroupId());
    return groupIdMap.get(srcGroupId);
  }
  const idMap = new Map(); // src item -> new item, for remapping parentId when a whole assembly is duplicated together
  for (const src of selectedItems) {
    let newItem;
    if (src.kind === 'sprite') {
      const record = serializeSpriteRecord(src);
      record.position[0] += 1.5;
      record.position[2] += 1.5;
      newItem = instantiateSpriteRecord(record, new Opus.Vec3(...record.position));
    } else if (src.kind === 'tilemap') {
      const record = serializeTilemapRecord(src);
      record.position[0] += 1.5; record.position[2] += 1.5;
      newItem = instantiateTilemapRecord(record);
    } else if (src.kind === 'cube') {
      const srcEntity = src.entity;
      const entity = app.addEntity({
        mesh: srcEntity.mesh,
        color: srcEntity.color.slice(),
        position: new Opus.Vec3(srcEntity.position.x + 1.5, srcEntity.position.y, srcEntity.position.z + 1.5),
        scale: new Opus.Vec3(srcEntity.scale.x, srcEntity.scale.y, srcEntity.scale.z),
        rotationY: srcEntity.rotationY,
      });
      // Skin data is shared through the immutable imported mesh, but the
      // authored manual clip is instance-owned; do not duplicate default Idle.
      if (srcEntity.skin) {
        entity.animationClip = srcEntity.animationClip;
        entity.animationBlendTime = srcEntity.animationBlendTime;
      }
      if (srcEntity.spin) entity.spin = srcEntity.spin;
      // Patrol/AI carry a `base` point captured at the ORIGINAL position, so
      // a duplicate re-bases it to its own new spot rather than sharing
      // (and steering back toward) the source's base -- caught while adding
      // AI duplication support: patrol had the exact same gap already,
      // silently dropped on duplicate, fixed here too rather than left half-fixed.
      if (srcEntity.patrol) entity.patrol = { ...srcEntity.patrol, base: entity.position.clone() };
      if (srcEntity.ai) entity.ai = { ...srcEntity.ai, base: entity.position.clone() };
      if (srcEntity.solid) entity.solid = true;
      if (srcEntity.texture) entity.texture = srcEntity.texture;
      entity.unlit = srcEntity.unlit;
      entity.alpha = srcEntity.alpha;
      entity.spritePassRelation = Opus.normalizeSpritePassRelation(src.spritePassRelation || srcEntity.spritePassRelation);
      entity.emissiveColor = srcEntity.emissiveColor ? srcEntity.emissiveColor.slice() : [0, 0, 0];
      entity.emissiveIntensity = srcEntity.emissiveIntensity || 0;
      entity.uvScale = srcEntity.uvScale ? srcEntity.uvScale.slice() : [1, 1];
      entity.uvOffset = srcEntity.uvOffset ? srcEntity.uvOffset.slice() : [0, 0];
      newItem = { kind: 'cube', entity, behaviors: cloneBehaviors(src.behaviors), isTrigger: src.isTrigger, triggerRepeat: src.triggerRepeat, triggerShape: src.triggerShape, collider: src.collider ? JSON.parse(JSON.stringify(src.collider)) : undefined, tags: src.tags ? src.tags.slice() : undefined, assetId: src.assetId, isWaypoint: src.isWaypoint, isRamp: src.isRamp, isBillboard: src.isBillboard, billboardMode: src.billboardMode, spritePassRelation: src.spritePassRelation || srcEntity.spritePassRelation || 'behind-sprites', sourcePrefabName: src.sourcePrefabName, characterAnimSync: src.characterAnimSync, textureAssetId: src.textureAssetId, isSpawnPoint: src.isSpawnPoint, isDefaultSpawn: src.isSpawnPoint ? false : undefined, animationClips: src.animationClips ? JSON.parse(JSON.stringify(src.animationClips)) : undefined, connections: src.connections ? src.connections.slice() : undefined };
    } else if (src.kind === 'terrain') {
      const opts = { ...src.options, seed: Math.floor(Math.random() * 10000) };
      opts.position = new Opus.Vec3(src.options.position.x + 8, src.options.position.y, src.options.position.z + 8);
      const handle = app.createTerrain(opts);
      newItem = { kind: 'terrain', handle, options: opts };
      syncTerrainLayerTextures(newItem);
    } else if (src.kind === 'water') {
      const opts = { ...src.options };
      opts.position = new Opus.Vec3(src.options.position.x + 8, src.options.position.y, src.options.position.z + 8);
      const handle = app.createWater(opts);
      newItem = { kind: 'water', handle, options: opts };
    } else if (src.kind === 'camera') {
      const srcEntity = src.entity;
      const newPos = new Opus.Vec3(srcEntity.position.x + 1.5, srcEntity.position.y, srcEntity.position.z + 1.5);
      const entity = app.addEntity({
        mesh: srcEntity.mesh,
        color: srcEntity.color.slice(),
        position: newPos,
        scale: new Opus.Vec3(srcEntity.scale.x, srcEntity.scale.y, srcEntity.scale.z),
      });
      const options = normalizeCameraOptions({ ...JSON.parse(JSON.stringify(src.options)), position: newPos });
      newItem = { kind: 'camera', entity, options, isActiveCamera: false };
    } else if (src.kind === 'spawner') {
      const srcEntity = src.entity;
      const newPos = new Opus.Vec3(srcEntity.position.x + 1.5, srcEntity.position.y, srcEntity.position.z + 1.5);
      const entity = app.addEntity({
        mesh: srcEntity.mesh,
        color: srcEntity.color.slice(),
        position: newPos,
        scale: new Opus.Vec3(srcEntity.scale.x, srcEntity.scale.y, srcEntity.scale.z),
      });
      const options = JSON.parse(JSON.stringify(src.options));
      options.position = newPos;
      newItem = { kind: 'spawner', entity, options };
    } else if (src.kind === 'light') {
      const srcEntity = src.entity;
      const newPos = new Opus.Vec3(srcEntity.position.x + 1.5, srcEntity.position.y, srcEntity.position.z + 1.5);
      const entity = app.addEntity({ mesh: srcEntity.mesh, color: srcEntity.color.slice(), position: newPos, scale: new Opus.Vec3(srcEntity.scale.x, srcEntity.scale.y, srcEntity.scale.z) });
      const options = JSON.parse(JSON.stringify(src.options));
      options.position = newPos;
      if (options.direction) options.direction = new Opus.Vec3(options.direction.x, options.direction.y, options.direction.z);
      const lightHandle = app.createLight({ type: options.lightType, position: options.position.clone(), color: options.color, intensity: options.intensity, range: options.range, angle: options.angle, direction: options.direction, enabled: options.enabled });
      newItem = { kind: 'light', entity, options, lightHandle };
    } else {
      const opts = { ...src.options };
      opts.position = new Opus.Vec3(src.options.position.x + 1.5, src.options.position.y, src.options.position.z + 1.5);
      const handle = app.createEmitter(opts);
      newItem = { kind: 'emitter', handle, options: opts };
    }
    // Duplicate follows Save/Load's authored-variable contract for every
    // object kind. Hand-built legacy branches otherwise lose Self inputs.
    // Keep separate snapshots so runtime mutation cannot alter either the
    // source object or the duplicate's next fresh-Play baseline.
    if (src.variables) {
      newItem.variables = { ...src.variables };
      newItem._authoredVariables = { ...src.variables };
    }
    if(src.characterAnimRoles!==undefined)newItem.characterAnimRoles=JSON.parse(JSON.stringify(src.characterAnimRoles));
    newItem.groupId = remapGroupId(src.groupId);
    if(src.signalPrefabInstanceId){if(!signalInstanceMap.has(src.signalPrefabInstanceId))signalInstanceMap.set(src.signalPrefabInstanceId,generateItemId());newItem.signalPrefabInstanceId=signalInstanceMap.get(src.signalPrefabInstanceId);}
    // Copied through as-is for now; remapped below ONLY when the source's
    // parent was ALSO part of this same duplicated selection (a whole
    // assembly duplicated together should stay attached to ITS OWN new
    // parent, not silently alias back onto the original's).
    newItem.parentId = src.parentId;
    newItem.localPosition = src.localPosition ? src.localPosition.clone() : undefined;
    newItem.localRotationY = src.localRotationY;
    newItem.localQuat = src.localQuat ? src.localQuat.clone() : undefined;
    newItem.localScale = src.localScale ? src.localScale.clone() : undefined;
    // Phase 002: one deep-copy path for every registered Component. The
    // registry re-applies each proof Component to its existing legacy
    // runtime owner, so duplicate behavior stays identical without a
    // component-specific branch here.
    OpusAuthoring.copyComponents(src, newItem);
    // Keep historical duplication's local patrol/orbit origin. Component
    // copying must not steer a duplicate back to its source's authored base.
    if (newItem.kind === 'cube' && newItem.entity.ai) {
      const brain = OpusAiBrain.inspect(newItem.components?.['ai-brain']);
      if (brain.ok) {
        brain.record.config.base = [newItem.entity.position.x, newItem.entity.position.y, newItem.entity.position.z];
        newItem.components['ai-brain'] = brain.record;
        newItem.entity.ai.base = newItem.entity.position.clone();
      }
    }
    idMap.set(src, newItem);
    addPlaced(newItem);
    newItems.push(newItem);
  }
  for (const newItem of newItems) {
    if (!newItem.parentId) continue;
    const srcParent = findItemById(newItem.parentId);
    const mappedParent = srcParent && idMap.get(srcParent);
    if (mappedParent) newItem.parentId = mappedParent.id;
  }
  hierarchyTickToken++; // force a fresh resolve pass -- world transforms for the new duplicates must be correct before anything reads them
  updateHierarchyTransforms();
  selectedItems.clear();
  for (const item of newItems) selectedItems.add(item);
  selectedItem = newItems[newItems.length - 1] || null;
  syncSelectionMarkers();
  renderInspector();
  renderSceneList();
}

const inspectorBody = document.getElementById('inspector-body');

function behaviorAuthoringHTML() {
  return `      <div class="field-row"><label>Behaviors</label>
        <div class="field-help">${escapeHtml(OpusAuthoringLanguage.LOGIC_SURFACES.behavior.help)} Use Level → Sequences for ordered/timed Actions.</div>
        <div id="behavior-list"></div>
        <input id="b-action-search" type="search" aria-label="Search Behavior Actions" placeholder="Search Actions, categories or aliases…">
        <div class="field-triple">
          <select id="b-trigger">
            ${OpusAuthoringLanguage.EVENTS.map((event) => `<option value="${event.id}">${escapeHtml(event.label)}</option>`).join('')}
          </select>
          <select id="b-action"></select>
        </div>
        <div id="b-trigger-fields"></div>
        <div id="b-fields"></div>
        <button id="add-behavior-btn" class="toolbar-btn" style="margin-top:6px">Add Behavior</button>
      </div>
`;
}
function bindBehaviorAuthoring() {
    renderBehaviorList(selectedItem);
    // Action options and their param fields both come from ACTION_TYPES
    // ('graph' appended manually, since it's the one action outside that
    // table) -- the same dynamic-field pattern the Node Graph node UI uses,
    // so a new action type gets a working Add Behavior form for free.
    const actionSelect = document.getElementById('b-action');
    const triggerSelect = document.getElementById('b-trigger');
    const triggerFields = document.getElementById('b-trigger-fields');
    const behaviorLogicChoices = OpusAuthoringLanguage.logicEntries(ACTION_TYPES);
    function renderBehaviorChoices() {
      const current = actionSelect.value, query = document.getElementById('b-action-search').value;
      const choices = behaviorLogicChoices.filter(meta => meta.id === current || OpusAuthoringLanguage.matchesLogicEntry(meta,query));
      actionSelect.innerHTML = choices.map(meta=>`<option value="${escapeHtml(meta.id)}" title="${escapeHtml(meta.help)}">${escapeHtml(meta.label)}</option>`).join('');
      if (choices.some(meta=>meta.id===current)) actionSelect.value = current;
    }
    renderBehaviorChoices();
    document.getElementById('b-action-search').oninput = () => { const previous = actionSelect.value; renderBehaviorChoices(); if (actionSelect.value !== previous) renderAddBehaviorFields(); };
    function renderAddBehaviorFields(values = {}) {
      const action = actionSelect.value;
      const fieldsEl = document.getElementById('b-fields');
      if (action === 'graph') {
        fieldsEl.innerHTML = '<p style="color:#8592a8;font-size:11.5px;margin:4px 0">Opens Visual Graph (formerly Node Graph) on Add. The selected Event starts its branching flow.</p>';
        return;
      }
      if (action === 'dialogueTree') {
        fieldsEl.innerHTML = '<p style="color:#8592a8;font-size:11.5px;margin:4px 0">Opens the Dialogue editor on Add.</p>';
        return;
      }
      const def = ACTION_TYPES[action];
      fieldsEl.innerHTML = def.fields.length
        ? def.fields.map((f) => `<div class="field-row"><label>${escapeHtml(f.label || f.key)}</label>${renderActionFieldInput(f, values[f.key], null, values, selectedItem)}</div>`).join('')
        : '<p style="color:#8592a8;font-size:11.5px;margin:4px 0">No parameters.</p>';
      if(action==='changeCamera')fieldsEl.insertAdjacentHTML('beforeend','<p class="field-help" id="camera-blend-authoring-status">Use a finite nonnegative duration; zero cuts. Same-projection framing blends smoothly. Different projections switch immediately, then blend view position. The newest Camera blend or path owns the view.</p>');
      if(action==='cameraShake')fieldsEl.insertAdjacentHTML('beforeend','<p class="field-help" id="camera-shake-authoring-status" role="status">Choose a preset or enter finite nonnegative Custom values. Zero clears an effect.</p>');
      const target = fieldsEl.querySelector('[data-field="targetId"]');
      const signal = fieldsEl.querySelector('[data-field="signalId"]');
      const refreshDependentFields = () => {
        const next = {};
        fieldsEl.querySelectorAll('[data-field]').forEach((input) => { const field = def.fields.find((entry) => entry.key === input.dataset.field); next[input.dataset.field] = field ? readActionFieldValue(field,input) : input.value; });
        renderAddBehaviorFields(next);
      };
      if (target && def.fields.some((field) => field.type === 'spriteAnimationState')) target.onchange=refreshDependentFields;
      if (signal) signal.onchange=refreshDependentFields;
      if(action==='cameraShake'){const preset=fieldsEl.querySelector('[data-field="preset"]');if(preset)preset.onchange=refreshDependentFields;}
    }
    function renderTriggerFields(values) {
      triggerFields.innerHTML = triggerSelect.value === 'controllerStateEvent'?controllerStateEventSourceOptions(values).html:triggerSelect.value === 'signal'?signalChoiceHTML(values?.signalId):triggerSelect.value === 'spriteAnimationEvent' ? spriteAnimationEventSourceOptions(values).html : '';
      const target = triggerFields.querySelector('[data-sprite-event-target]'); const clip = triggerFields.querySelector('[data-sprite-event-clip]');
      if (target) target.onchange = () => renderTriggerFields({ targetId: target.value });
      if (clip) clip.onchange = () => renderTriggerFields({ targetId: triggerFields.querySelector('[data-sprite-event-target]').value, clipId: clip.value });
    }
    triggerSelect.onchange = () => renderTriggerFields();
    actionSelect.onchange = renderAddBehaviorFields;
    renderTriggerFields();
    renderAddBehaviorFields();
    document.getElementById('add-behavior-btn').onclick = () => {
      const action = actionSelect.value;
      if(triggerSelect.value==='controllerStateEvent'){const issue=controllerStateEventAuthoringIssue(readBehaviorEventSource(triggerSelect.value,triggerFields));if(issue){const status=triggerFields.querySelector('[data-controller-event-status]');if(status)status.textContent=issue;showStatus(issue);return;}}
      if (action === 'graph') {
        // Node Graph has no param fields -- it opens its own editor instead,
        // and the behavior is only actually added once the user saves a
        // graph there (Cancel adds nothing), unlike every other action.
        openGraphEditor(selectedItem, null, triggerSelect.value, readBehaviorEventSource(triggerSelect.value,triggerFields));
        return;
      }
      if (action === 'dialogueTree') {
        // Same "opens its own editor, adds nothing until Saved there" shape
        // as Node Graph above.
        openDialogueEditor(selectedItem, null, triggerSelect.value, readBehaviorEventSource(triggerSelect.value,triggerFields));
        return;
      }
      const def = ACTION_TYPES[action];
      const params = {};
      document.querySelectorAll('#b-fields [data-field]').forEach((input) => {
        const f = def.fields.find((fld) => fld.key === input.dataset.field);
        if (!f) return;
        params[f.key] = readActionFieldValue(f,input);
      });
      if(action==='changeCamera'){
        const input=document.querySelector('#b-fields [data-field="blendSeconds"]'),raw=input?.value??'',duration=raw.trim()?Number(raw):0;
        if(!Number.isFinite(duration)||duration<0){const status=document.getElementById('camera-blend-authoring-status');if(status)status.textContent='Behavior not added. Blend duration must be finite and nonnegative; use zero for an instant cut.';showStatus('Blend duration must be finite and nonnegative.');return;}
        params.blendSeconds=duration;
      }
      if(action==='cameraShake'&&!resolveCameraShakePolicy(params)){const status=document.getElementById('camera-shake-authoring-status');if(status)status.textContent='Behavior not added. Choose an available preset and finite nonnegative Custom values.';showStatus('Camera effect values must be finite and nonnegative.');return;}
      pushUndo();
      const behavior = { trigger: document.getElementById('b-trigger').value, action };
      if (['spriteAnimationEvent','signal','controllerStateEvent'].includes(behavior.trigger)) behavior.eventRef = readBehaviorEventSource(behavior.trigger,triggerFields);
      // Legacy actions keep the flat `.param` string shape existing saved
      // projects already use; newer actions persist as `.params` (object).
      if (def.legacy) { if (def.legacyParam) behavior.param = params[def.legacyParam] || ''; }
      else behavior.params = params;
      selectedItem.behaviors.push(behavior);
      renderBehaviorList(selectedItem);
    };
}

function changeMaterialAuthoringField(entity,key,value,beforeChange) {
  if(playMode||!entity)return false;
  if(key==='alpha'){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)return false;}
  else if(key==='emissiveIntensity'){if(typeof value!=='number'||!Number.isFinite(value)||value<0)return false;}
  else if(key==='unlit'){if(typeof value!=='boolean')return false;}
  else if(key==='emissiveColor'||key==='color'){if(!Array.isArray(value)||value.length!==3||value.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))return false;value=value.slice();}
  else if(key==='uvScale'||key==='uvOffset'){if(!Array.isArray(value)||value.length!==2||value.some(v=>typeof v!=='number'||!Number.isFinite(v)||(key==='uvScale'&&v<=0)))return false;value=value.slice();}
  else return false;
  if(Array.isArray(value)?Array.isArray(entity[key])&&value.every((v,i)=>v===entity[key][i]):Object.is(entity[key],value))return false;
  beforeChange();entity[key]=value;return true;
}
function bindMaterialAuthoringField(control,entity,key,type,afterChange) {
  let captured=false;
  const commit=()=>changeMaterialAuthoringField(entity,key,type==='checkbox'?control.checked:type==='color'?hexToRgb(control.value):control.value.trim()?Number(control.value):NaN,()=>{if(type==='checkbox'||!captured){pushUndo();captured=true;}});
  if(type==='checkbox')control.onchange=()=>{commit();afterChange?.();};
  else{control.oninput=commit;control.onchange=()=>{commit();afterChange?.();};control.onblur=()=>{captured=false;};}
}
function changeLightAuthoringField(item,key,value,beforeChange) {
  if(playMode||!placed.includes(item)||item.kind!=='light')return false;
  const opts=item.options,handle=item.lightHandle;
  let previous;
  if(key==='color'){
    if(!Array.isArray(value)||value.length!==3||value.some(v=>!Number.isFinite(v)||v<0||v>1))return false;
    previous=opts.color;if(value.every((v,i)=>v===previous[i]))return false;value=value.slice();
  }else if(key==='enabled'){
    if(typeof value!=='boolean')return false;previous=opts.enabled!==false;
  }else{
    if(typeof value!=='number'||!Number.isFinite(value))return false;
    if(key==='intensity'){if(value<0)return false;previous=opts.intensity;}
    else if(key==='range'){if(value<=0)return false;previous=opts.range;}
    else if(key==='angle'){if(value<=0||value>=Math.PI/2)return false;previous=opts.angle;}
    else if(/^position\.[xyz]$/.test(key))previous=item.entity.position[key.slice(-1)];
    else if(/^direction\.[xyz]$/.test(key)&&opts.direction){
      const axis=key.slice(-1);previous=opts.direction[axis];
      if(['x','y','z'].every(a=>(a===axis?value:opts.direction[a])===0))return false;
    }else return false;
  }
  if(Object.is(previous,value))return false;
  beforeChange();
  if(key.startsWith('position.')){
    item.entity.position[key.slice(-1)]=value;commitEditedWorldTransform(item);
    opts.position=item.entity.position.clone();handle.position.set(opts.position.x,opts.position.y,opts.position.z);
  }else if(key.startsWith('direction.')){
    opts.direction[key.slice(-1)]=value;handle.direction.set(opts.direction.x,opts.direction.y,opts.direction.z);
  }else {opts[key]=key==='enabled'?(value?undefined:false):value;handle[key]=Array.isArray(value)?value.slice():value;}
  syncLightConeViz();return true;
}
function bindLightAuthoringField(control,item,key,type) {
  if(!control)return;
  let captured=false;
  const feedback=document.createElement('small');feedback.id=control.id+'-feedback';feedback.setAttribute('role','status');feedback.style.display='none';feedback.style.color='#f3bb70';
  const row=control.closest('.field-row');if(row)row.appendChild(feedback);else control.insertAdjacentElement('afterend',feedback);control.setAttribute('aria-describedby',feedback.id);control.disabled=playMode;
  const canonical=()=>key.startsWith('position.')?item.entity.position[key.slice(-1)]:key.startsWith('direction.')?item.options.direction[key.slice(-1)]:key==='enabled'?item.options.enabled!==false:item.options[key];
  const restore=()=>{const v=canonical();if(type==='checkbox')control.checked=v;else control.value=type==='color'?rgbToHex(v):String(key==='angle'?v*180/Math.PI:v);};
  const commit=()=>{
    const value=type==='checkbox'?control.checked:type==='color'?hexToRgb(control.value):control.value.trim()?Number(control.value)*(key==='angle'?Math.PI/180:1):NaN;
    let error='';
    if(playMode)error='Stop Play before editing lights.';
    else if(type==='number'){
      if(!Number.isFinite(value))error='Enter a finite number.';
      else if(key==='range'&&value<=0)error='Range must be greater than zero world units.';
      else if(key==='intensity'&&value<0)error='Intensity must be zero or greater; zero emits no light.';
      else if(key==='angle'&&(value<=0||value>=Math.PI/2))error='Cone half-angle must be greater than 0 and less than 90 degrees.';
      else if(key.startsWith('direction.')&&['x','y','z'].every(a=>(a===key.slice(-1)?value:item.options.direction[a])===0))error='Direction needs at least one non-zero axis.';
    }
    control.setAttribute('aria-invalid',error?'true':'false');feedback.textContent=error;feedback.style.display=error?'block':'none';
    if(error)return false;
    return changeLightAuthoringField(item,key,value,()=>{if(type==='checkbox'||!captured){pushUndo();captured=true;}});
  };
  if(type==='checkbox')control.onchange=commit;
  else{control.oninput=commit;control.onchange=commit;control.onblur=()=>{if(control.getAttribute('aria-invalid')==='true'){restore();control.setAttribute('aria-invalid','false');feedback.textContent='Invalid value was not saved; previous value restored.';}captured=false;};}
}
function bindObjectNameField(control,item) {
  let captured=false;control.disabled=playMode;
  control.oninput=()=>{
    if(playMode||selectedItem!==item||!placed.includes(item)){control.value=item.name||'';return;}
    const value=control.value||undefined;if(item.name===value)return;
    if(!captured){pushUndo();captured=true;}item.name=value;renderSceneList();
  };
  control.onblur=()=>{captured=false;};
}
function renderInspectorBody() {
  if (selectedItems.size === 0) {
    inspectorBody.innerHTML = '<p id="inspector-empty">No Object selected. Click an object in the viewport or Scene list, or drag one from Objects. Components and gameplay presets appear here after selection.</p>';
    return;
  }

  // Editing properties across a heterogeneous multi-selection (a cube next
  // to a terrain, say) isn't attempted -- just the two operations that make
  // sense for any group: move them together (already covered by drag, no
  // inspector control needed) and duplicate/delete as a unit.
  if (selectedItems.size > 1) {
    // Grouping doesn't change how a selection moves (multi-select drag
    // already moves the whole set together, coherently, with no group
    // needed for that) -- what it adds is persistence: clicking any ONE
    // grouped member later re-selects the whole group again (see
    // selectItem), instead of the grouping only lasting as long as this one
    // marquee/shift-click selection does.
    const groupIds = new Set([...selectedItems].map((i) => i.groupId).filter(Boolean));
    const isOneWholeGroup = groupIds.size === 1 && [...selectedItems].every((i) => i.groupId === [...groupIds][0])
      && placed.filter((p) => p.groupId === [...groupIds][0]).length === selectedItems.size;
    inspectorBody.innerHTML = `
      <p style="color:#9fb3d9;margin-bottom:12px">${selectedItems.size} objects selected</p>
      <div class="field-triple">
        <button id="group-btn" class="toolbar-btn" style="margin-bottom:0">${isOneWholeGroup ? 'Ungroup' : 'Group'}</button>
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate All</button>
      </div>
      <div class="field-triple">
        <button id="delete-btn" style="margin-bottom:0">Delete All</button>
      </div>
      <div class="field-row"><label for="prefab-name-input">Reusable assembly</label>
        <input id="prefab-name-input" placeholder="Prefab name">
        <div class="field-help">Save all selected objects and their children. Each placement keeps the arrangement and independent groups.</div>
        <button id="save-prefab-btn" class="toolbar-btn">Save Selection as Prefab</button>
      </div>
    `;
    inspectorBody.insertAdjacentHTML('beforeend',`<div class="field-row"><label>Frame selected objects with Camera<select id="camera-group-selection-picker"><option value="">Choose Fixed Camera…</option>${placed.filter(item=>item.kind==='camera'&&item.options.mode==='fixed').map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name||itemDisplayName(item,placed.indexOf(item)))}</option>`).join('')}</select></label><button class="toolbar-btn" id="camera-group-selection-capture">Use selected objects as targets</button><p class="field-help">Captures named targets and enables group framing on the chosen Fixed Camera; ordinary editor grouping is unchanged.</p></div>`);
    document.getElementById('camera-group-selection-capture').disabled=playMode;
    if(isOneWholeGroup&&[...selectedItems].every(item=>item.kind==='light')){
      const row=document.createElement('div');row.className='field-row';
      const label=document.createElement('label');label.textContent='Edit individual light (keeps group)';row.appendChild(label);
      for(const member of selectedItems){
        const button=document.createElement('button');button.className='toolbar-btn';button.textContent=member.name||itemDisplayName(member,placed.indexOf(member));button.dataset.groupLightEdit=member.id;button.disabled=playMode;
        button.onclick=()=>{if(playMode||!placed.includes(member))return;selectedItems.clear();selectedItems.add(member);selectedItem=member;syncSelectionMarkers();renderSceneList();renderInspector();};row.appendChild(button);
      }
      inspectorBody.appendChild(row);
    }
    document.getElementById('camera-group-selection-capture').onclick=()=>{const item=placed.find(entry=>entry.id===document.getElementById('camera-group-selection-picker').value);if(!item)return;const group=item.options.targetGroup;if(!inspectCameraTargetGroup(group).ok)return;changeCameraTargetGroup(item,{...group,enabled:true,targetIds:[...selectedItems].filter(target=>target!==item&&target.entity).map(target=>target.id)});};
    document.getElementById('group-btn').onclick = () => {
      pushUndo();
      if (isOneWholeGroup) {
        for (const item of selectedItems) item.groupId = undefined;
      } else {
        const groupId = generateGroupId();
        for (const item of selectedItems) item.groupId = groupId;
      }
      renderInspector();
    };
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('save-prefab-btn').onclick = () => {
      const name = document.getElementById('prefab-name-input').value.trim();
      if (!name) { showStatus('Name this assembly before saving it as a Prefab'); return; }
      const members = [...selectedItems];
      const root = members.find((item) => !members.some((other) => other.id === item.parentId)) || members[0];
      const { payload, memberCount } = buildPrefabPayload(root, name, members);
      pushUndo();
      const existingIndex = prefabs.findIndex((prefab) => prefab.name === name);
      if (existingIndex === -1) prefabs.push(payload); else prefabs[existingIndex] = payload;
      // Only a complete group has a discoverable root membership on later
      // instance updates. Ungrouped selections remain independent objects.
      if (isOneWholeGroup) root.sourcePrefabName = name;
      savePrefabs(); renderPrefabPalette(); renderInspector();
      showStatus(`Saved prefab "${name}" (${memberCount} objects)`);
    };
    return;
  }

  if (selectedItem.kind === 'tilemap') {
    const item = selectedItem; const entity = item.entity; const bounds = OpusAuthoringPlumbing.tilemapOccupiedBounds(item); const activeLayer = activeTilemapLayer(item);
    const totalCells = OpusAuthoringPlumbing.tilemapCellCount(item); const layersTopFirst = [...(item.layers || [])].reverse();
    const boundText = bounds ? `${bounds.minX},${bounds.minY} → ${bounds.maxX},${bounds.maxY}` : 'Empty';
    if (!Array.isArray(item.spawnMarkers)) item.spawnMarkers = []; if (selectedSpawnMarkerId && !OpusAuthoringPlumbing.getSpawnMarkerById(item, selectedSpawnMarkerId)) selectedSpawnMarkerId = null;
    const selectedMarker = OpusAuthoringPlumbing.getSpawnMarkerById(item, selectedSpawnMarkerId); const prefabOptions = `<option value="">(none)</option>${prefabs.map((prefab) => `<option value="${escapeHtml(prefab.name)}">${escapeHtml(prefab.name)}</option>`).join('')}`;
    const markerRows = item.spawnMarkers.map((marker) => `<button type="button" class="toolbar-btn${selectedMarker && selectedMarker.id === marker.id ? ' active' : ''}" data-marker-select="${escapeHtml(marker.id)}" style="margin:2px 0;text-align:left">◆ ${escapeHtml(marker.name)} <span class="tilemap-layer-count">(${marker.x}, ${marker.y})${marker.prefabRef ? ` · ${escapeHtml(marker.prefabRef)}` : ''}</span></button>`).join('');
    const layerRows = layersTopFirst.map((layer) => { const canonicalIndex = item.layers.indexOf(layer); const count = OpusAuthoringPlumbing.tilemapCellCount(item, layer.id); return `
      <div class="tilemap-layer-row${activeLayer && activeLayer.id === layer.id ? ' active' : ''}" data-tilemap-layer-row="${escapeHtml(layer.id)}">
        <button type="button" data-layer-visible="${escapeHtml(layer.id)}" aria-label="${layer.visible === false ? 'Show' : 'Hide'} layer ${escapeHtml(layer.name)}" aria-pressed="${layer.visible !== false}">${layer.visible === false ? '○' : '◉'}</button>
        <button type="button" data-layer-lock="${escapeHtml(layer.id)}" aria-label="${layer.locked ? 'Unlock' : 'Lock'} layer ${escapeHtml(layer.name)}" aria-pressed="${layer.locked}">${layer.locked ? '🔒' : '🔓'}</button>
        <button type="button" data-layer-collision="${escapeHtml(layer.id)}" aria-label="Collision Enabled for layer ${escapeHtml(layer.name)}" title="Collision Enabled: Tiles with collision metadata can block Character Collision 2D" aria-pressed="${layer.collisionEnabled !== false}">${layer.collisionEnabled === false ? '◇' : '◆'}</button>
        <input data-layer-name="${escapeHtml(layer.id)}" aria-label="Layer name" value="${escapeHtml(layer.name)}">
        <span class="tilemap-layer-count">${count}</span>
        <button type="button" data-layer-up="${escapeHtml(layer.id)}" aria-label="Move ${escapeHtml(layer.name)} up" ${canonicalIndex === item.layers.length - 1 ? 'disabled' : ''}>↑</button>
        <button type="button" data-layer-down="${escapeHtml(layer.id)}" aria-label="Move ${escapeHtml(layer.name)} down" ${canonicalIndex === 0 ? 'disabled' : ''}>↓</button>
        <button type="button" data-layer-delete="${escapeHtml(layer.id)}" aria-label="Delete layer ${escapeHtml(layer.name)}" ${item.layers.length <= 1 ? 'disabled title="A Tilemap must keep at least one layer"' : ''}>×</button>
      </div>`; }).join('');
    inspectorBody.innerHTML = `
      <div class="field-row"><label>Tilemap</label><div class="field-help">One transformed scene object. Layers share this Tileset, Transform, Sorting Layer, and sparse Tile identity; canonical order is bottom to top.</div></div>
      <div class="field-row"><label>Name</label><input id="tilemap-name" value="${escapeHtml(item.name || 'Tilemap')}"></div>
      <div class="field-row"><label>Transform Position</label><div class="field-triple"><input type="number" data-tilemap-transform="px" step="0.1" value="${entity.position.x}"><input type="number" data-tilemap-transform="py" step="0.1" value="${entity.position.y}"><input type="number" data-tilemap-transform="pz" step="0.1" value="${entity.position.z}"></div></div>
      <div class="field-row"><label>Tileset</label><select id="tilemap-tileset"><option value="">(unassigned)</option>${tilesets.map((ts) => `<option value="${escapeHtml(ts.id)}"${item.tilesetRef === ts.id ? ' selected' : ''}>${escapeHtml(ts.name)}</option>`).join('')}</select></div>
      <div class="field-row"><label>Layers</label><div class="field-help">Topmost layer is shown first. ${item.layers.length} layers · ${totalCells} painted cells · bounds ${boundText}</div><div class="tilemap-layer-panel">${layerRows}</div><div class="field-triple"><button id="tilemap-add-layer" class="toolbar-btn">+ Add Layer</button><button id="tilemap-duplicate-layer" class="toolbar-btn" ${activeLayer ? '' : 'disabled'}>Duplicate Layer</button><button id="tilemap-clear-layer" class="toolbar-btn" ${activeLayer && activeLayer.cells.length && !activeLayer.locked ? '' : 'disabled'}>Clear Layer</button></div></div>
      ${activeLayer ? `<div class="field-row"><label for="tilemap-layer-collision-enabled">Collision Enabled · ${escapeHtml(activeLayer.name)}</label><input id="tilemap-layer-collision-enabled" type="checkbox" ${activeLayer.collisionEnabled !== false ? 'checked' : ''}><div class="field-help">When enabled, Tiles on this Layer whose Tile definitions contain collision metadata can block Character Collision 2D movement. Visibility and authoring lock are independent.</div></div>` : ''}
      <div class="field-row"><label>Sorting Layer</label><select id="tilemap-sorting-layer">${orderedSpriteSortingLayers().map((layer) => `<option value="${escapeHtml(layer.id)}"${item.sortingLayerRef === layer.id ? ' selected' : ''}>${escapeHtml(layer.name)}</option>`).join('')}</select><input id="tilemap-order" type="number" step="1" value="${item.orderInLayer || 0}"></div>
      <div class="field-triple"><button id="tilemap-inspector-paint" class="toolbar-btn">Paint</button><button id="tilemap-inspector-erase" class="toolbar-btn">Erase</button><button id="tilemap-inspector-palette" class="toolbar-btn">Open Palette</button></div>
      <button id="tilemap-inspector-export-bundle" class="toolbar-btn">Export Portable Tilemap</button>
      <div class="field-row"><label>Grid Objects</label><div class="field-help">Place one normal Prefab instance at a cell center. Placement is a one-time snap; the object has no ongoing Tilemap binding.</div><select id="tilemap-inspector-prefab"><option value="">Choose Prefab…</option>${prefabs.map((prefab) => `<option value="${escapeHtml(prefab.name)}"${tilemapPlacementPrefabName === prefab.name ? ' selected' : ''}>${escapeHtml(prefab.name)}</option>`).join('')}</select><button id="tilemap-inspector-place-object" class="toolbar-btn">Place Object Tool</button></div>
      <div class="field-row"><label>Spawn Markers (${item.spawnMarkers.length})</label><div class="field-help">Tilemap-local runtime metadata. Markers are independent of Layers and never instantiate Prefabs automatically.</div><div>${markerRows || '<div class="field-help">No markers yet.</div>'}</div><button id="tilemap-inspector-add-marker" class="toolbar-btn">Spawn Marker Tool</button></div>
      ${selectedMarker ? `<div class="field-row" data-marker-detail="${escapeHtml(selectedMarker.id)}"><label>Marker Detail</label><input id="tilemap-marker-name" value="${escapeHtml(selectedMarker.name)}"><div class="field-triple"><input id="tilemap-marker-x" aria-label="Marker X" type="number" step="1" value="${selectedMarker.x}"><input id="tilemap-marker-y" aria-label="Marker Y" type="number" step="1" value="${selectedMarker.y}"><select id="tilemap-marker-prefab" aria-label="Marker Prefab">${prefabOptions}</select></div><div class="field-triple"><button id="tilemap-marker-duplicate" class="toolbar-btn">Duplicate</button><button id="tilemap-marker-delete">Delete Marker</button></div></div>` : ''}
      ${activeLayer && activeLayer.visible === false ? '<div class="field-help">Show this layer to edit its cells.</div>' : activeLayer && activeLayer.locked ? '<div class="field-help">Unlock this layer to edit its cells.</div>' : ''}
      <div class="field-triple"><button id="tilemap-clear" class="toolbar-btn" ${totalCells ? '' : 'disabled'}>Clear All Layers</button><button id="duplicate-btn" class="toolbar-btn">Duplicate</button><button id="delete-btn">Delete Object</button></div>`;
    document.getElementById('tilemap-name').oninput = (e) => { item.name = e.target.value; renderSceneList(); };
    inspectorBody.querySelectorAll('[data-tilemap-transform]').forEach((input) => input.addEventListener('focus', () => pushUndo(), { once: true }));
    inspectorBody.querySelectorAll('[data-tilemap-transform]').forEach((input) => input.oninput = () => { const value = (key) => Number(inspectorBody.querySelector(`[data-tilemap-transform="${key}"]`).value); entity.position.set(value('px'), value('py'), value('pz')); hierarchyTickToken++; syncSelectionMarkers(); syncTilemapOverlay(); });
    document.getElementById('tilemap-tileset').onchange = (e) => { const next = e.target.value || null; if (next === item.tilesetRef) return; if (totalCells && !confirm(`Change Tileset and clear ${totalCells} painted cells across ${item.layers.length} layers? Existing Tile IDs belong to the current Tileset.`)) { e.target.value = item.tilesetRef || ''; return; } finishTilemapStroke(); pushUndo(); item.tilesetRef = next; OpusAuthoringPlumbing.clearTilemapCells(item); syncTilemapRenderer(item); setTilemapTool(null); renderInspector(); };
    document.getElementById('tilemap-sorting-layer').onchange = (e) => { pushUndo(); item.sortingLayerRef = e.target.value; syncTilemapRenderer(item); };
    document.getElementById('tilemap-order').onchange = (e) => { pushUndo(); item.orderInLayer = Math.trunc(Number(e.target.value) || 0); syncTilemapRenderer(item); };
    const beginLayerTool = (tool) => { const layer = activeTilemapLayer(item); if (!layer) { showStatus('Add a Tile Layer first'); return; } if (layer.visible === false) { showStatus('Show this layer to edit its cells.'); return; } if (layer.locked) { showStatus('Unlock this layer to edit its cells.'); return; } if (tool === 'paint' && !item.tilesetRef) { showStatus('Assign a Tileset first'); return; } if (tool === 'paint') openTilePalette(item.tilesetRef); setTilemapTool(tool); };
    document.getElementById('tilemap-inspector-paint').onclick = () => beginLayerTool('paint');
    document.getElementById('tilemap-inspector-erase').onclick = () => beginLayerTool('erase');
    document.getElementById('tilemap-inspector-palette').onclick = () => item.tilesetRef ? openTilePalette(item.tilesetRef) : showStatus('Assign a Tileset first');
    document.getElementById('tilemap-inspector-export-bundle').onclick = () => previewTilemapBundleExport('tilemap', item);
    document.getElementById('tilemap-inspector-prefab').onchange = (event) => { tilemapPlacementPrefabName = event.target.value; setTilemapTool('place-object'); };
    document.getElementById('tilemap-inspector-place-object').onclick = () => setTilemapTool('place-object');
    document.getElementById('tilemap-inspector-add-marker').onclick = () => setTilemapTool('spawn-marker');
    inspectorBody.querySelectorAll('[data-marker-select]').forEach((button) => { button.onclick = () => { selectedSpawnMarkerId = button.dataset.markerSelect; renderInspector(); syncTilemapOverlay(); }; });
    if (selectedMarker) {
      const updateMarker = (patch) => { pushUndo(); OpusAuthoringPlumbing.updateSpawnMarker(item, selectedMarker.id, patch); renderInspector(); syncTilemapOverlay(); };
      document.getElementById('tilemap-marker-name').onchange = (event) => updateMarker({ name: event.target.value });
      document.getElementById('tilemap-marker-x').onchange = (event) => updateMarker({ x: Math.trunc(Number(event.target.value)) });
      document.getElementById('tilemap-marker-y').onchange = (event) => updateMarker({ y: Math.trunc(Number(event.target.value)) });
      const markerPrefab = document.getElementById('tilemap-marker-prefab'); markerPrefab.value = selectedMarker.prefabRef || ''; markerPrefab.onchange = (event) => updateMarker({ prefabRef: event.target.value || null });
      document.getElementById('tilemap-marker-duplicate').onclick = () => { pushUndo(); const copy = OpusAuthoringPlumbing.duplicateSpawnMarker(item, selectedMarker.id); selectedSpawnMarkerId = copy && copy.id; renderInspector(); syncTilemapOverlay(); };
      document.getElementById('tilemap-marker-delete').onclick = () => { pushUndo(); OpusAuthoringPlumbing.deleteSpawnMarker(item, selectedMarker.id); selectedSpawnMarkerId = null; renderInspector(); syncTilemapOverlay(); };
    }
    inspectorBody.querySelectorAll('[data-tilemap-layer-row]').forEach((row) => { row.onclick = (event) => { if (event.target.matches('button,input')) return; selectTilemapLayer(item, row.dataset.tilemapLayerRow); renderInspector(); }; });
    if (activeLayer) { const host = document.createElement('div'); inspectorBody.appendChild(host); mountCollisionFilterFields(host, activeLayer); }
    inspectorBody.querySelectorAll('[data-layer-visible]').forEach((button) => { button.onclick = () => { finishTilemapStroke(); pushUndo(); OpusAuthoringPlumbing.setTilemapLayerVisibility(item, button.dataset.layerVisible, button.getAttribute('aria-pressed') !== 'true'); syncTilemapRenderer(item); renderInspector(); syncTilemapOverlay(); }; });
    inspectorBody.querySelectorAll('[data-layer-lock]').forEach((button) => { button.onclick = () => { finishTilemapStroke(); pushUndo(); OpusAuthoringPlumbing.setTilemapLayerLocked(item, button.dataset.layerLock, button.getAttribute('aria-pressed') !== 'true'); renderInspector(); syncTilemapOverlay(); }; });
    inspectorBody.querySelectorAll('[data-layer-collision]').forEach((button) => { button.onclick = () => { finishTilemapStroke(); pushUndo(); const layer = OpusAuthoringPlumbing.getTilemapLayer(item, button.dataset.layerCollision); if (layer) layer.collisionEnabled = button.getAttribute('aria-pressed') !== 'true'; renderInspector(); validateCurrentProject(); }; });
    const collisionToggle = document.getElementById('tilemap-layer-collision-enabled'); if (collisionToggle) collisionToggle.onchange = () => { finishTilemapStroke(); pushUndo(); const layer = activeTilemapLayer(item); if (layer) layer.collisionEnabled = collisionToggle.checked; renderInspector(); validateCurrentProject(); };
    inspectorBody.querySelectorAll('[data-layer-name]').forEach((input) => { input.onfocus = () => { if (!input.dataset.undoCaptured) { pushUndo(); input.dataset.undoCaptured = 'true'; } selectTilemapLayer(item, input.dataset.layerName); }; input.oninput = () => { if (!OpusAuthoringPlumbing.renameTilemapLayer(item, input.dataset.layerName, input.value)) showStatus('Layer names must be non-empty and unique within this Tilemap'); }; input.onchange = () => { delete input.dataset.undoCaptured; renderInspector(); }; });
    inspectorBody.querySelectorAll('[data-layer-up]').forEach((button) => { button.onclick = () => { finishTilemapStroke(); pushUndo(); OpusAuthoringPlumbing.reorderTilemapLayer(item, button.dataset.layerUp, 1); syncTilemapRenderer(item); renderInspector(); }; });
    inspectorBody.querySelectorAll('[data-layer-down]').forEach((button) => { button.onclick = () => { finishTilemapStroke(); pushUndo(); OpusAuthoringPlumbing.reorderTilemapLayer(item, button.dataset.layerDown, -1); syncTilemapRenderer(item); renderInspector(); }; });
    inspectorBody.querySelectorAll('[data-layer-delete]').forEach((button) => { button.onclick = () => { const layer = OpusAuthoringPlumbing.getTilemapLayer(item, button.dataset.layerDelete); if (!layer || item.layers.length <= 1) return; if (layer.cells.length && !confirm(`Delete layer "${layer.name}"? ${layer.cells.length} painted cells will be removed.`)) return; finishTilemapStroke(); pushUndo(); OpusAuthoringPlumbing.deleteTilemapLayer(item, layer.id); tilemapActiveLayerIds.delete(item); syncTilemapRenderer(item); renderInspector(); syncTilemapOverlay(); }; });
    document.getElementById('tilemap-add-layer').onclick = () => { finishTilemapStroke(); pushUndo(); const layer = OpusAuthoringPlumbing.addTilemapLayer(item, { name: 'Layer', visible: true, locked: false }, activeTilemapLayer(item) && activeTilemapLayer(item).id); tilemapActiveLayerIds.set(item, layer.id); syncTilemapRenderer(item); renderInspector(); };
    document.getElementById('tilemap-duplicate-layer').onclick = () => { const layer = activeTilemapLayer(item); if (!layer) return; finishTilemapStroke(); pushUndo(); const copy = OpusAuthoringPlumbing.duplicateTilemapLayer(item, layer.id); tilemapActiveLayerIds.set(item, copy.id); syncTilemapRenderer(item); renderInspector(); };
    document.getElementById('tilemap-clear-layer').onclick = () => { const layer = activeTilemapLayer(item); if (!layer || !layer.cells.length || layer.locked || !confirm(`Clear ${layer.cells.length} painted cells from layer "${layer.name}"?`)) return; finishTilemapStroke(); pushUndo(); OpusAuthoringPlumbing.clearTilemapLayer(item, layer.id); syncTilemapRenderer(item); renderInspector(); syncTilemapOverlay(); };
    document.getElementById('tilemap-clear').onclick = () => { if (!totalCells || !confirm(`Clear ${totalCells} painted cells from all ${item.layers.length} layers?`)) return; finishTilemapStroke(); pushUndo(); OpusAuthoringPlumbing.clearTilemapCells(item); syncTilemapRenderer(item); renderInspector(); syncTilemapOverlay(); };
    document.getElementById('duplicate-btn').onclick = duplicateSelected; document.getElementById('delete-btn').onclick = deleteSelected;
    syncTilemapOverlay(); return;
  }

  if (selectedItem.kind === 'sprite') {
    const entity = selectedItem.entity;
    const euler = entity.quaternion.toEuler();
    const deg = (radians) => Math.round(radians * 180 / Math.PI * 1000) / 1000;
    inspectorBody.innerHTML = `
      <div class="field-row" data-concept-boundary="sprite"><label>Sprite</label><div class="field-help">Authored flat visual: keeps this Transform orientation and uses a Sprite Asset plus Sprite Sorting Layers. It does not face the camera automatically.</div></div>
      <div class="field-row" data-hybrid-layer-summary="sprite"><label>Hybrid Layering (read-only)</label><div class="field-help">Sprites always draw as one contiguous pass: after opaque depth and Behind Sprites transparency, before In Front of Sprites transparency. Transform Z is tested against opaque depth; Sprite order is Sorting Layer, Order in Layer, then stable Object ID.</div></div>
      <div class="field-row"><label>Transform Position</label><div class="field-triple"><input type="number" data-sprite-transform="px" step="0.1" value="${entity.position.x}"><input type="number" data-sprite-transform="py" step="0.1" value="${entity.position.y}"><input type="number" data-sprite-transform="pz" step="0.1" value="${entity.position.z}"></div></div>
      <div class="field-row"><label>Transform Rotation (degrees)</label><div class="field-triple"><input type="number" data-sprite-transform="rx" step="1" value="${deg(euler.x)}"><input type="number" data-sprite-transform="ry" step="1" value="${deg(euler.y)}"><input type="number" data-sprite-transform="rz" step="1" value="${deg(euler.z)}"></div></div>
      <div class="field-row"><label>Transform Scale</label><div class="field-triple"><input type="number" data-sprite-transform="sx" step="0.1" value="${entity.scale.x}"><input type="number" data-sprite-transform="sy" step="0.1" value="${entity.scale.y}"><input type="number" data-sprite-transform="sz" step="0.1" value="${entity.scale.z}"></div></div>
      <div data-schema-slot="sprite-renderer"></div>
      ${behaviorAuthoringHTML()}
      <div class="field-row"><label>Save as Prefab</label><div class="field-triple"><input type="text" id="sprite-prefab-name" placeholder="Prefab name"><button id="sprite-save-prefab" class="toolbar-btn" style="margin-bottom:0">Save</button></div></div>
      ${propertyAnimationInspectorHTML(selectedItem)}
      ${selectedItem.sourcePrefabName ? `
      <div class="field-row"><label>Linked Prefab: ${escapeHtml(selectedItem.sourcePrefabName)}</label>
        <div class="field-triple">
          <button id="sprite-update-from-prefab" class="toolbar-btn" style="margin-bottom:0" ${prefabs.some((p) => p.name === selectedItem.sourcePrefabName) ? '' : 'disabled title="Source prefab no longer exists"'}>⭯ Update From Prefab</button>
          <button id="sprite-update-prefab-from-this" class="toolbar-btn" style="margin-bottom:0">⭱ Update Prefab From This</button>
          <button id="sprite-unlink-prefab" class="toolbar-btn" style="margin-bottom:0">Unlink</button>
        </div>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Manual replace-and-reinstantiate sync; Sprite fields use the shared component record path.</div>
      </div>` : ''}
      <div class="field-triple"><button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button><button id="delete-btn" style="margin-bottom:0">Delete Object</button></div>`;
    const updateTransform = () => {
      const read = (key) => Number(inspectorBody.querySelector(`[data-sprite-transform="${key}"]`).value);
      entity.position.set(read('px'), read('py'), read('pz'));
      entity.quaternion = Opus.Quat.fromEuler(read('rx') * Math.PI / 180, read('ry') * Math.PI / 180, read('rz') * Math.PI / 180);
      entity.scale.set(read('sx'), read('sy'), read('sz'));
      hierarchyTickToken++;
      syncSelectionMarkers();
    };
    inspectorBody.querySelectorAll('[data-sprite-transform]').forEach((control) => {
      bindCoreAuthoringInput(control, updateTransform);
    });
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('sprite-save-prefab').onclick = () => {
      const name = document.getElementById('sprite-prefab-name').value.trim();
      if (!name) { showStatus('Enter a prefab name'); return; }
      pushUndo();
      const { payload } = buildPrefabPayload(selectedItem, name);
      const index = prefabs.findIndex((prefab) => prefab.name === name);
      if (index === -1) prefabs.push(payload); else prefabs[index] = payload;
      selectedItem.sourcePrefabName = name;
      savePrefabs();
      renderPrefabPalette();
      showStatus(`Saved Sprite prefab "${name}"`);
      renderInspector();
    };
    if (selectedItem.sourcePrefabName) {
      const updateFrom = document.getElementById('sprite-update-from-prefab');
      if (updateFrom) updateFrom.onclick = () => updateInstanceFromPrefab(selectedItem);
      document.getElementById('sprite-update-prefab-from-this').onclick = () => {
        const name = selectedItem.sourcePrefabName;
        const { payload } = buildPrefabPayload(selectedItem, name);
        const index = prefabs.findIndex((prefab) => prefab.name === name);
        if (index === -1) prefabs.push(payload); else prefabs[index] = payload;
        savePrefabs(); renderPrefabPalette(); showStatus(`Updated Sprite prefab "${name}" from this object`);
      };
      document.getElementById('sprite-unlink-prefab').onclick = () => {
        pushUndo(); selectedItem.sourcePrefabName = undefined; renderInspector(); showStatus('Unlinked Sprite from prefab');
      };
    }
    bindPropertyAnimationInspector(selectedItem);
    bindBehaviorAuthoring();
    return;
  }

  // Wave 8 (Priority I): a Path has no `.entity` at all -- handled as its
  // own early, self-contained branch rather than threading `kind==='path'`
  // checks through the (enormous) cube-item branch below.
  if (selectedItem.kind === 'path') {
    const path = selectedItem;
    const ownsPath = () => !playMode && selectedItem === path && placed.includes(path);
    const points = (path.pointIds || []).map((id) => findItemById(id)).filter(Boolean);
    inspectorBody.innerHTML = `
      <div class="field-row"><label>Path Name</label><input type="text" id="f-path-name" value="${escapeHtml(path.name || '')}" placeholder="Path name"></div>
      <div class="field-row">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea"><input type="checkbox" id="f-path-loop"${path.loop ? ' checked' : ''}> Loop (closed path)</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea;margin-top:4px"><input type="checkbox" id="f-path-smooth"${path.smooth ? ' checked' : ''}> Smooth (Catmull-Rom, not straight segments)</label>
      </div>
      <div class="field-row"><label>Points (${points.length})</label>
        <div id="path-point-list">${points.map((p, i) => `<div class="field-triple" style="margin-top:3px"><span style="font-size:11px;color:#c7d3ea;align-self:center">#${i + 1}</span><button data-path-select-point="${escapeHtml(p.id)}" class="toolbar-btn" style="margin-bottom:0">Select</button><button data-path-delete-point="${escapeHtml(p.id)}" class="hud-remove-btn">✕</button></div>`).join('')}</div>
        <button id="path-add-point-btn" class="toolbar-btn" style="margin-top:4px">+ Add Point</button>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Drag a point marker in the viewport (same Move gizmo as any object) to reshape the path. New points append after the last one.</div>
      </div>
      <div class="field-row"><label>Populate Along Path</label>
        <div class="field-triple">
          <select id="path-populate-prefab"><option value="">(none)</option>${prefabs.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')}</select>
          <input type="number" id="path-populate-spacing" placeholder="Spacing" value="2" min="0.1" step="0.5">
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#c7d3ea"><input type="checkbox" id="path-populate-align" checked> Align</label>
        </div>
        <button id="path-populate-btn" class="toolbar-btn" style="margin-top:4px">Populate</button>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#c7d3ea"><input type="checkbox" id="path-populate-preserve-scale" checked> Preserve Prefab proportions</label>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Choose a Prefab and at least two distinct points. Approximate distance spacing0.1–10000; maximum2048 instances; smooth curves use40 length samples. Output is ordinary placed objects, one Undo step; editing the Path does not update old output. Preserve proportions retains authored root scale; unchecked keeps historical uniform scale.</div>
      </div>
      <div class="field-triple">
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button>
        <button id="delete-btn" style="margin-bottom:0">Delete Object</button>
      </div>
    `;
    const pathNameInput=document.getElementById('f-path-name'); let pathNameCaptured=false;
    pathNameInput.onfocus=()=>{pathNameCaptured=false;};
    pathNameInput.oninput=e=>{if(ownsPath())changePathAuthoringField(path,'name',e.target.value,()=>{if(!pathNameCaptured){pushUndo();pathNameCaptured=true;}});};
    pathNameInput.onblur=()=>{pathNameInput.value=path.name||'';};
    document.getElementById('f-path-loop').onchange = (e) => { if(ownsPath())changePathAuthoringField(path,'loop',e.target.checked); };
    document.getElementById('f-path-smooth').onchange = (e) => { if(ownsPath())changePathAuthoringField(path,'smooth',e.target.checked); };
    document.querySelectorAll('[data-path-select-point]').forEach((btn) => { btn.onclick = () => { const p = findItemById(btn.dataset.pathSelectPoint); if (p) selectItem(p); }; });
    document.querySelectorAll('[data-path-delete-point]').forEach((btn) => {
      btn.onclick = () => { if(!ownsPath())return;const p = findItemById(btn.dataset.pathDeletePoint); if (p && (path.pointIds||[]).includes(p.id) && p.pathId===path.id) { pushUndo(); removeItemFromScene(p); renderInspector(); } };
    });
    document.getElementById('path-add-point-btn').onclick = () => {
      if(!ownsPath())return;
      pushUndo();
      const last = points[points.length - 1];
      const basePos = last ? last.entity.position : new Opus.Vec3();
      addPathPoint(path, new Opus.Vec3(basePos.x + 2, basePos.y, basePos.z));
      renderInspector();
    };
    document.getElementById('path-populate-btn').onclick = () => {
      if(!ownsPath())return;
      const prefabName = document.getElementById('path-populate-prefab').value;
      if (!prefabName) { showStatus('Choose a Prefab first'); return; }
      const spacingInput=document.getElementById('path-populate-spacing');
      const spacing = spacingInput.value.trim() ? Number(spacingInput.value) : NaN;
      if(!Number.isFinite(spacing)||spacing<0.1||spacing>10000){showStatus('Spacing must be 0.1–10000');return;}
      const align = document.getElementById('path-populate-align').checked;
      const preservePrefabScale=document.getElementById('path-populate-preserve-scale').checked;
      const result = populateAlongPath(path, { prefabName, spacing, alignToPath: align, scale: 1, preservePrefabScale });
      renderSceneList();
      showStatus(result.placedCount ? `Populated ${result.placedCount} along path` : 'No placement: choose an existing Prefab, two distinct points and spacing that produces at most2048 instances');
    };
    if(playMode)inspectorBody.querySelectorAll('input,select,button').forEach(control=>control.disabled=true);
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
    document.getElementById('delete-btn').onclick = deleteSelected;
    return;
  }

  if (selectedItem.kind === 'cube') {
    const entity = selectedItem.entity;
    inspectorBody.innerHTML = `
      ${selectedItem.isBillboard ? `<div class="field-row" data-concept-boundary="billboard"><label>Billboard (World-Space)</label><div class="field-help">Camera-facing 3D image: uses an ordinary Texture and Material, lighting, alpha, and depth. It is not a Sprite and has no Sprite Asset or Sprite Sorting Layer.</div></div>` : ''}
      <div class="field-row"><label>Position</label>
        <div class="field-triple">
          <input type="number" id="f-x" step="0.1" value="${entity.position.x.toFixed(2)}">
          <input type="number" id="f-y" step="0.1" value="${entity.position.y.toFixed(2)}">
          <input type="number" id="f-z" step="0.1" value="${entity.position.z.toFixed(2)}">
        </div>
      </div>
      <div class="field-row"><label>Rotation X / Y / Z (degrees)</label>
        <div class="field-triple">
          <input type="number" id="f-rotation-x" step="5" value="${(entity.quaternion.toEuler().x * 180 / Math.PI).toFixed(1)}">
          <input type="number" id="f-rotation-y" step="5" value="${(entity.quaternion.toEuler().y * 180 / Math.PI).toFixed(1)}">
          <input type="number" id="f-rotation-z" step="5" value="${(entity.quaternion.toEuler().z * 180 / Math.PI).toFixed(1)}">
        </div>
      </div>
      <div class="field-row"><label>Scale (X / Y / Z)</label>
        <div class="field-triple">
          <input type="number" id="f-scale-x" step="0.1" min="0.05" value="${entity.scale.x.toFixed(2)}">
          <input type="number" id="f-scale-y" step="0.1" min="0.05" value="${entity.scale.y.toFixed(2)}">
          <input type="number" id="f-scale-z" step="0.1" min="0.05" value="${entity.scale.z.toFixed(2)}">
        </div>
        <button id="f-scale-uniform-btn" class="toolbar-btn" style="margin-top:4px;margin-bottom:0">Make Uniform (use X)</button>
      </div>
      <div class="field-row"><label>Color${materialTextureRef(selectedItem) ? ' (tints the texture below)' : ''}</label>
        <input type="color" id="f-color" value="${rgbToHex(entity.color)}">
      </div>
      <div class="field-row"><label>Texture</label>
        <select id="f-texture">
          <option value="">None</option>
          ${textureAssets.map((t) => `<option value="${t.id}"${materialTextureRef(selectedItem) === t.id ? ' selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
        </select>
      </div>
      ${materialTextureRef(selectedItem) ? `
      <div class="field-row"><label>Texture Tiling (X / Y) / Offset (X / Y)</label>
        <div class="field-triple">
          <input type="number" id="f-uv-scale-x" step="0.1" min="0.01" value="${(entity.uvScale ? entity.uvScale[0] : 1).toFixed(2)}">
          <input type="number" id="f-uv-scale-y" step="0.1" min="0.01" value="${(entity.uvScale ? entity.uvScale[1] : 1).toFixed(2)}">
        </div>
        <div class="field-triple" style="margin-top:4px">
          <input type="number" id="f-uv-offset-x" step="0.05" value="${(entity.uvOffset ? entity.uvOffset[0] : 0).toFixed(2)}">
          <input type="number" id="f-uv-offset-y" step="0.05" value="${(entity.uvOffset ? entity.uvOffset[1] : 0).toFixed(2)}">
        </div>
      </div>` : ''}
      <div class="field-row"><label>Material</label>
        ${typeof renderMaterialLibraryFields==='function'?renderMaterialLibraryFields():''}
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea;margin-bottom:6px">
          <input type="checkbox" id="f-unlit"${entity.unlit ? ' checked' : ''}> Unlit (flat color, ignores lighting)
        </label>
        <label style="font-size:10px;color:#66759a">Transparency (1 = opaque, 0 = invisible)</label>
        <input type="range" id="f-alpha" min="0" max="1" step="0.01" value="${entity.alpha ?? 1}">
        <label style="font-size:10px;color:#66759a;margin-top:4px">Emissive Color / Intensity</label>
        <div class="field-triple">
          <input type="color" id="f-emissive-color" value="${rgbToHex(entity.emissiveColor || [0, 0, 0])}">
          <input type="number" id="f-emissive-intensity" step="0.1" min="0" value="${entity.emissiveIntensity || 0}">
        </div>
      </div>
      ${entity.alpha < 1 ? `
      <div class="field-row" data-hybrid-layering="eligible"><label>Hybrid Layering</label>
        <label style="font-size:10px;color:#66759a">Relative to Sprites</label>
        <select id="f-sprite-pass-relation">
          <option value="behind-sprites" ${(selectedItem.spritePassRelation || entity.spritePassRelation) !== 'in-front-of-sprites' ? 'selected' : ''}>Behind Sprites</option>
          <option value="in-front-of-sprites" ${(selectedItem.spritePassRelation || entity.spritePassRelation) === 'in-front-of-sprites' ? 'selected' : ''}>In Front of Sprites</option>
        </select>
        <div class="field-help">Available to transparent Meshes and Billboards. Both choices depth-test against opaque 3D; neither is an x-ray. The saved choice is retained while the material is opaque.</div>
      </div>` : `
      <div class="field-row" data-hybrid-layering="inactive"><label>Hybrid Layering</label><div class="field-help">Opaque objects always draw before the Sprite pass. A previously authored Relative to Sprites choice is preserved and becomes active again if Transparency drops below 1.</div></div>`}
      ${propertyAnimationInspectorHTML(selectedItem)}
      <details id="ai-archetype-library"></details>
      <div class="field-row"><label>AI Brain — movement</label>
        <select id="f-ai-type">
          <option value="">None</option>
          <option value="follow"${entity.ai && entity.ai.type === 'follow' ? ' selected' : ''}>Follow (chase the Player, or Target below)</option>
          <option value="flee"${entity.ai && entity.ai.type === 'flee' ? ' selected' : ''}>Flee (run from the Player within Radius)</option>
          <option value="faceTarget"${entity.ai && entity.ai.type === 'faceTarget' ? ' selected' : ''}>Face Target (rotate to track, no movement)</option>
          <option value="orbit"${entity.ai && entity.ai.type === 'orbit' ? ' selected' : ''}>Orbit (circle in place)</option>
          <option value="wander"${entity.ai && entity.ai.type === 'wander' ? ' selected' : ''}>Wander (random drift)</option>
          <option value="patrolRoute"${entity.ai && entity.ai.type === 'patrolRoute' ? ' selected' : ''}>Patrol Route (visit named Waypoints in order)</option>
          <option value="navigateToTarget"${entity.ai && entity.ai.type === 'navigateToTarget' ? ' selected' : ''}>Navigate To Target (pathfind via connected Waypoints)</option>
          <option value="followPath"${entity.ai && entity.ai.type === 'followPath' ? ' selected' : ''}>Follow Path (moving platforms and patrol routes)</option>
        </select>
        <div class="field-triple" id="f-ai-params" style="${entity.ai && entity.ai.type !== 'patrolRoute' ? '' : 'display:none'}">
          <input type="number" id="f-ai-speed" step="0.1" min="0.1" placeholder="Speed" value="${entity.ai ? entity.ai.speed : 3}"${entity.ai && entity.ai.type === 'faceTarget' ? ' disabled' : ''}>
          <input type="number" id="f-ai-radius" step="0.5" min="0.5" placeholder="Radius" value="${entity.ai ? entity.ai.radius : 5}"${entity.ai && (entity.ai.type === 'follow' || entity.ai.type === 'faceTarget') ? ' disabled' : ''}>
        </div>
        ${entity.ai && (entity.ai.type === 'follow' || entity.ai.type === 'faceTarget' || entity.ai.type === 'navigateToTarget') ? `
        <div class="field-row" style="margin-top:6px"><label style="font-size:10px;color:#66759a">Target selection</label>
          <select id="f-ai-target-selection">
            <option value="fixed"${entity.ai.targetSelection !== 'nearestTag' ? ' selected' : ''}>Player / named target (existing)</option>
            <option value="nearestTag"${entity.ai.targetSelection === 'nearestTag' ? ' selected' : ''}>Nearest tagged Cube (3D)</option>
          </select>
        </div>
        ${entity.ai.targetSelection === 'nearestTag' ? `
        <div class="field-row"><label>Exact target tag</label><input id="f-ai-target-tag" type="text" value="${escapeHtml(entity.ai.targetTag || '')}"></div>
        <div class="field-row"><label>Acquisition range (XYZ)</label><input id="f-ai-target-range" type="number" min="0" step="0.5" value="${entity.ai.targetRange ?? 8}"></div>
        <div style="font-size:10px;color:#66759a">Live visible tagged Cubes only; ignores self. Zero range requires the same position. No line-of-sight filter. Attack range remains separate.</div>
        ` : `
        <div class="field-row" style="margin-top:6px"><label style="font-size:10px;color:#66759a">Target (optional -- defaults to Player)</label>
          ${renderActionFieldInput({ key: 'aiTargetId', type: 'target', emptyLabel: 'Player' }, entity.ai.targetId, 'f-ai-target')}
        </div>`}` : ''}
        ${entity.ai && entity.ai.type === 'patrolRoute' ? `
        <div class="field-row" style="margin-top:6px">
          <label style="font-size:10px;color:#66759a">Speed</label>
          <input type="number" id="f-ai-patrol-speed" step="0.1" min="0.1" value="${entity.ai.speed}">
          <label style="font-size:10px;color:#66759a;margin-top:4px">Waypoint names, in order (comma-separated -- set each Waypoint's Name field)</label>
          <input type="text" id="f-ai-waypoints" placeholder="WP1, WP2, WP3" value="${escapeHtml(entity.ai.waypointNames || '')}">
          <div style="display:flex;gap:10px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#c7d3ea"><input type="checkbox" id="f-ai-loop"${entity.ai.loop ? ' checked' : ''}> Loop</label>
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#c7d3ea"><input type="checkbox" id="f-ai-pingpong"${entity.ai.pingpong ? ' checked' : ''}> Ping-Pong</label>
          </div>
        </div>` : ''}
        ${entity.ai && entity.ai.type === 'followPath' ? `
        <div class="field-row" style="margin-top:6px">
          <label style="font-size:10px;color:#66759a">Path</label>
          <select id="f-ai-path">${placed.filter((p) => p.kind === 'path').map((p, pi) => `<option value="${escapeHtml(p.id)}"${entity.ai.pathId === p.id ? ' selected' : ''}>${escapeHtml(p.name || itemDisplayName(p, pi))}</option>`).join('') || '<option value="">(no Paths placed yet)</option>'}</select>
          <label style="font-size:10px;color:#66759a;margin-top:4px">Speed</label>
          <input type="number" id="f-ai-path-speed" step="0.1" min="0.1" value="${entity.ai.speed || 2}">
          <div style="display:flex;gap:10px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#c7d3ea"><input type="checkbox" id="f-ai-path-pingpong"${entity.ai.pingpong ? ' checked' : ''}> Ping-Pong (ignored if the Path itself loops)</label>
          </div>
        </div>` : ''}
        ${entity.ai ? `
        <div class="field-row" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea">
            <input type="checkbox" id="f-ai-attack-enabled"${entity.ai.attackEnabled ? ' checked' : ''}> Ranged Attack (fires at Target/Player in range)
          </label>
          <div id="f-ai-attack-fields" class="ai-combat-authoring" style="display:${entity.ai.attackEnabled ? '' : 'none'}">
            <div class="field-row" style="margin-top:4px"><label style="font-size:10px;color:#66759a">Projectile Prefab</label>
              ${aiProjectileChoiceHtml(entity.ai.attackPrefab,'f-ai-attack-prefab')}
            </div>
            <div class="ai-combat-grid">
              <label>Range (XYZ units)<input type="number" id="f-ai-attack-radius" step="0.1" min="0.1" value="${entity.ai.attackRadius || 8}"></label>
              <label>Cooldown (seconds)<input type="number" id="f-ai-attack-cooldown" step="0.1" min="0.1" value="${entity.ai.attackCooldown || 1.5}"></label>
              <label>Damage (0 allowed)<input type="number" id="f-ai-attack-damage" step="1" min="0" value="${entity.ai.attackDamage ?? 10}"></label>
              <label>Damage Type${aiDamageTypeChoiceHtml(entity.ai.attackDamageType,'id="f-ai-attack-type"')}</label>
              <label>Projectile speed (units/sec)<input type="number" id="f-ai-attack-speed" step="0.1" min="0.1" value="${entity.ai.attackSpeed || 12}"></label>
            </div>
            <small id="ai-attack-status" role="status">${escapeHtml(aiAttackAuthoringStatus(entity.ai))}</small>
            <small>Uses the movement target selection. Nearest tagged Cube has no Player fallback; existing Player / named mode uses Player only when no name is chosen. Cooldown is simulation time, not frame count; leaving range does not reset it. No automatic line-of-sight test. Single-Cube projectiles only; assemblies remain retained but cannot fire.</small>
          </div>
        </div>` : ''}
      </div>
      ${entity.ai ? `
      <div class="field-row">
        <label><input type="checkbox" id="f-ai-solid-collision"${entity.ai.collideWithSolids === true ? ' checked' : ''}> Block solid objects</label>
        <div style="font-size:10.5px;color:#66759a">Stops AI movement at visible solids; slides along walls. Leave off for intentional path/platform animation. Does not add gravity or navigation.</div>
        ${entity.ai.collideWithSolids === true ? `<label>Character collision radius <input type="number" id="f-ai-collision-radius" min="0.05" max="10" step="0.05" value="${entity.ai.collisionRadius || 0.35}"></label>` : ''}
      </div>
      <div class="field-row">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea"><input type="checkbox" id="f-ai-statemachine-mode"${entity.ai.mode === 'stateMachine' ? ' checked' : ''}> AI Mode: State Machine</label>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">When on, the AI Behavior fields above are ignored -- movement/attack come from whichever state is currently active below instead.</div>
        <div id="ai-perception-fields"></div>
        ${entity.ai.mode === 'stateMachine' ? '<div id="ai-state-list"></div><button id="ai-state-add-btn" class="toolbar-btn" style="margin-top:4px">+ Add State</button>' : ''}
      </div>` : ''}
      <div class="field-row"><label>Attach to Socket</label>
        ${selectedItem.socketName ? `
        <p style="font-size:11.5px;color:#8fd0a0;margin:2px 0">Attached to "${escapeHtml(selectedItem.socketName)}" on ${(() => { const c = findItemById(selectedItem.parentId); return c ? escapeHtml(itemDisplayName(c, placed.indexOf(c))) : '(missing character)'; })()}</p>
        <button id="socket-detach-btn" class="toolbar-btn" style="margin-bottom:0">Detach</button>
        ` : (() => {
          const characters = placed.filter((p) => p.entity && p.entity.skin && p !== selectedItem);
          if (characters.length === 0) return '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No skinned characters placed in this scene yet.</p>';
          return `
        <div class="field-triple">
          <select id="socket-attach-character">${characters.map((c) => `<option value="${c.id}">${escapeHtml(itemDisplayName(c, placed.indexOf(c)))}</option>`).join('')}</select>
          <select id="socket-attach-socket"></select>
          <button id="socket-attach-btn" class="toolbar-btn" style="margin-bottom:0">Attach</button>
        </div>`;
        })()}
      </div>
      ${selectedItem.health || (selectedItem.components && selectedItem.components.health) ? '<div data-schema-slot="health"></div>' : ''}
      ${selectedItem.isTrigger ? '<div data-schema-slot="trigger"></div>' : `
      <div class="field-row"><label>Collision</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea">
          <input type="checkbox" id="f-solid"${entity.solid ? ' checked' : ''}> Solid (blocks players; hidden = passable)
        </label>
        ${entity.solid ? `
        <label style="font-size:10px;color:#66759a;margin-top:6px;display:block">Collider Shape</label>
        <select id="f-collider-shape">
          <option value="auto"${!selectedItem.collider ? ' selected' : ''}>Legacy centred box (uses object scale)</option>
          <option value="box"${selectedItem.collider && selectedItem.collider.shape === 'box' ? ' selected' : ''}>Box (custom size/offset)</option>
          <option value="sphere"${selectedItem.collider && selectedItem.collider.shape === 'sphere' ? ' selected' : ''}>Sphere</option>
        </select>
        ${selectedItem.assetId ? `<button id="f-collider-fit-mesh" class="toolbar-btn" style="margin:6px 0 2px"${meshFittedItemCollider(selectedItem, findAssetById(selectedItem.assetId)) ? '' : ' disabled'}>Fit Box to Mesh</button>
        <button id="f-collider-fit-trunk" class="toolbar-btn" style="margin:6px 0 2px"${meshTrunkItemCollider(selectedItem, findAssetById(selectedItem.assetId)) ? '' : ' disabled'}>Fit Box to Trunk/Base</button>
        <div style="font-size:10.5px;color:#66759a">Fits a static, unparented mesh's bounds at its current scale and orientation. Trunk/Base fits only the bottom of the model, so trees and lamp posts block at the trunk, not the canopy. This is a bounding box, not per-triangle collision. Fit again after resizing or rotating.</div>` : ''}
        ${selectedItem.collider && selectedItem.collider.shape === 'box' ? `
        <label style="font-size:10px;color:#66759a;margin-top:4px">Size (X, Y, Z)</label>
        <div class="field-triple">
          <input type="number" id="f-collider-size-x" step="0.1" min="0.05" value="${(selectedItem.collider.size ? selectedItem.collider.size.x : entity.scale.x).toFixed(2)}">
          <input type="number" id="f-collider-size-y" step="0.1" min="0.05" value="${(selectedItem.collider.size ? selectedItem.collider.size.y : entity.scale.y).toFixed(2)}">
          <input type="number" id="f-collider-size-z" step="0.1" min="0.05" value="${(selectedItem.collider.size ? selectedItem.collider.size.z : entity.scale.z).toFixed(2)}">
        </div>` : ''}
        ${selectedItem.collider && selectedItem.collider.shape === 'sphere' ? `
        <label style="font-size:10px;color:#66759a;margin-top:4px">Radius</label>
        <input type="number" id="f-collider-radius" step="0.1" min="0.05" value="${(selectedItem.collider.radius != null ? selectedItem.collider.radius : Math.max(entity.scale.x, entity.scale.z) / 2).toFixed(2)}">` : ''}
        ${selectedItem.collider ? `
        <label style="font-size:10px;color:#66759a;margin-top:4px">Offset (X, Y, Z)</label>
        <div class="field-triple">
          <input type="number" id="f-collider-offset-x" step="0.1" value="${(selectedItem.collider.offset ? selectedItem.collider.offset.x : 0).toFixed(2)}">
          <input type="number" id="f-collider-offset-y" step="0.1" value="${(selectedItem.collider.offset ? selectedItem.collider.offset.y : 0).toFixed(2)}">
          <input type="number" id="f-collider-offset-z" step="0.1" value="${(selectedItem.collider.offset ? selectedItem.collider.offset.z : 0).toFixed(2)}">
        </div>` : ''}` : ''}
      </div>`}
      ${selectedItem.isSpawnPoint ? `
      <div class="field-row"><label>Spawn Point</label>
        ${selectedItem.isDefaultSpawn
          ? `<div style="font-size:12px;color:#3ee6ff">★ Default Player Spawn for this level</div>`
          : `<button id="set-default-spawn-btn" class="toolbar-btn" style="margin-bottom:0">★ Set as Default Player Spawn</button>`}
      </div>` : ''}
      ${selectedItem.isWaypoint ? `
      <div class="field-row waypoint-graph-authoring"><label>Navigation graph links</label>
        <p class="waypoint-graph-help">Connect named Waypoints around obstacles, then choose Navigate To Target on an AI Brain. New links are two-way; existing outgoing-only links are retained. This is an authored XZ route, not a navmesh or automatic obstacle avoidance.</p>
        <div id="waypoint-graph-summary">${waypointConnectionSummary(selectedItem).outgoing.length} outgoing · ${waypointConnectionSummary(selectedItem).incoming.length} incoming</div>
        <div id="waypoint-connection-list">${waypointConnectionSummary(selectedItem).outgoing.map(({id:connId,item:conn,status}) => {
          const label=conn?itemDisplayName(conn,placed.indexOf(conn)):typeof connId==='string'?connId:'Invalid retained reference';
          return `<div class="waypoint-link-row">
            <span>${escapeHtml(label)} <small>${escapeHtml(status)}</small></span>
            ${typeof connId==='string'?`<button type="button" data-remove-connection="${escapeHtml(connId)}" aria-label="Remove link to ${escapeHtml(label)}" ${playMode?'disabled':''}>Remove</button>`:''}
          </div>`;
        }).join('') || '<p class="waypoint-graph-help">No outgoing links.</p>'}
        </div>
        ${waypointConnectionSummary(selectedItem).issues.length?`<p id="waypoint-graph-issues" class="waypoint-graph-warning">${escapeHtml(waypointConnectionSummary(selectedItem).issues.join('; '))}. References are never silently repaired on view.</p>`:''}
        <div class="waypoint-link-add">
          <select id="add-connection-select" aria-label="Connect to existing Waypoint" ${playMode?'disabled':''}>
            <option value="">Choose another Waypoint</option>
            ${placed.filter((p) => p.isWaypoint && p !== selectedItem && !(Array.isArray(selectedItem.connections)?selectedItem.connections:[]).includes(p.id)).map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(itemDisplayName(p, placed.indexOf(p)))}</option>`).join('')}
          </select>
          <button id="add-connection-btn" type="button" class="toolbar-btn" ${playMode?'disabled':''}>Connect both ways</button>
        </div>
        <small class="waypoint-graph-help">Remove deletes the recorded link and its reverse, if present. Incoming-only links are edited at their source Waypoint. Invalid records remain available for explicit repair; graph edits are disabled during Play.</small>
      </div>` : ''}
      ${entity.skin ? `
      <div class="field-row">
        <button id="create-animated-enemy-btn" class="toolbar-btn" style="background:#2a4a6a">✨ Create Animated Enemy</button>
        <div style="font-size:10.5px;color:#66759a;margin-top:-4px">One click: AI Follow, Health, Auto-Animate, and a ranged Attack slot (damage pre-set -- still pick a Projectile Prefab afterward to make it actually fire).</div>
      </div>
      <div class="field-row"><label>Animation Clip</label>
        <select id="f-animation-clip"${playMode?' disabled':''}>
          <option value="" ${entity.animationClip == null ? 'selected' : ''}>None (bind pose)</option>
          ${entity.animationClip!=null&&!entity.skin.clips[entity.animationClip]?`<option value="${escapeHtml(String(entity.animationClip))}" selected disabled>Unavailable saved clip (retained)</option>`:''}
          ${entity.skin.clips.map((c, i) => `<option value="${i}" ${entity.animationClip === i ? 'selected' : ''}>${escapeHtml(c.name)} (${c.duration.toFixed(2)}s)</option>`).join('')}
        </select>
        <div class="field-help">${entity.skin.jointCount} joints — a changed clip starts from t=0 using the existing skeletal clock. This manual selection does not override Auto-Animate's role ownership; disable Auto-Animate for a fixed clip. Stop Play to edit. Unavailable saved indices are retained for explicit repair.</div>
      </div>
      <div class="field-row"><label>Root motion utility</label>
        <select id="root-motion-joint" aria-label="Root motion joint"><option value="">Choose root joint…</option>${(entity.skin.jointNames||[]).map((name,index)=>({name,index})).filter(root=>entity.skin.jointParents?.[root.index]===-1).map(root=>`<option value="${escapeHtml(root.name)}">${escapeHtml(root.name)}</option>`).join('')}</select>
        <button id="root-motion-inspect" class="toolbar-btn">Inspect selected clip travel</button>
        <p id="root-motion-report" class="field-help" role="status">Measures root translation from clip start to end in skeleton-local units. Does not move the character, controller or collider. Loop accumulation, rotation extraction and automatic locomotion are not supported; use existing movement controls.</p>
      </div>
      <div class="field-row"><label>Skeletal Crossfade (seconds)</label>
        <input id="f-animation-blend" type="number" min="0" max="10" step="0.05" value="${Number.isFinite(entity.animationBlendTime)&&entity.animationBlendTime>=0&&entity.animationBlendTime<=10?entity.animationBlendTime:''}"${playMode?' disabled':''}>
        <div class="field-help">This instance only, including Auto-Animate role switches. 0 cuts instantly (legacy default); up to 10 seconds blends from the current pose. A fixed clip does not change just because a crossfade is configured. Player visuals use Level → Player settings instead.${!Number.isFinite(entity.animationBlendTime)||entity.animationBlendTime<0||entity.animationBlendTime>10?' Unavailable saved duration retained; enter a valid duration to repair it.':''}</div>
      </div>
      <div class="field-row"><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea"><input type="checkbox" id="f-character-anim-sync" ${selectedItem.characterAnimSync ? 'checked' : ''}${playMode?' disabled':''}> Auto-Animate</label>
        <div class="field-help">Simple AI picks Idle/Walk/Run from actual movement; State Machine uses its named state role. Attack/Hit temporarily override, then resume; Death is terminal. Enable this to use the mappings below.</div>
        ${aiAnimationRolePanel(selectedItem)}
      </div>
      <div class="field-row"><label>Sockets</label>
        <div id="socket-list"></div>
        ${selectedItem.assetId ? `<div class="field-triple">
          <input type="text" id="socket-new-name" placeholder="Socket name (e.g. RightHand)">
          <select id="socket-new-bone">${entity.skin.jointNames.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}</select>
          <button id="socket-add-btn" class="toolbar-btn" style="margin-bottom:0">+ Add</button>
        </div>` : '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">This instance has no asset reference -- Sockets need a real Asset Library entry to save against.</p>'}
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">A socket is authoring metadata on this ASSET (shared by every placed instance), not a change to the imported skeleton. Attach an ordinary object to one from that object's own Inspector.</div>
      </div>
      <p class="field-help">Animation Events belong to this shared Asset: every instance and Player using it receives them. Times use the selected clip's seconds; effects fire on forward crossings and loops, not on the initial clip switch. Save before replacing unavailable data.</p>
      <div class="field-row"><label>Animation Events</label>
        <div id="anim-event-list"></div>
        <button id="anim-event-add-btn" class="toolbar-btn" style="margin-top:4px">+ Add Event</button>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Fires an action at a specific time in a specific clip (e.g. Fire Weapon exactly when the swing animation reaches its firing pose). Authored per-asset, shared by every placed instance.</div>
      </div>` : ''}
      ${selectedItem.isBillboard ? `
      <div class="field-row"><label>Billboard Mode</label>
        <select id="f-billboard-mode">
          <option value="full" ${selectedItem.billboardMode !== 'cylindrical' ? 'selected' : ''}>Full (always faces camera)</option>
          <option value="cylindrical" ${selectedItem.billboardMode === 'cylindrical' ? 'selected' : ''}>Cylindrical (stays upright)</option>
        </select>
        <div class="field-help">Full follows camera pitch and yaw. Cylindrical follows yaw only so trees, signs, and impostors remain upright.</div>
      </div>` : ''}
      <div class="field-row"><label>Tags (comma-separated)</label>
        <input type="text" id="f-tags" placeholder="e.g. enemy, breakable" value="${escapeHtml((selectedItem.tags || []).join(', '))}">
      </div>
      <div class="field-row">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea"><input type="checkbox" id="f-persist-runtime-state"${selectedItem.persistRuntimeState ? ' checked' : ''}> Persist Runtime State</label>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Off (default): this object always resets to its authored state on Load/Play. On: its visible/destroyed/position/rotation/Health state survives Save Game -> Load Game.</div>
      </div>
      <div class="field-row">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea"><input type="checkbox" id="f-carryable"${selectedItem.carryable ? ' checked' : ''}> Carryable</label>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Lets Pick Up Object/Drop Held Object hold this in front of the Player (or in a hand Socket, Third-Person with a skinned Visual).</div>
      </div>
      <div class="field-row"><label>Object Variables</label>
        <div id="object-variable-list"></div>
        <div class="field-triple">
          <input type="text" id="objvar-new-name" placeholder="name">
          <select id="objvar-new-type"><option value="number">Number</option><option value="boolean">Boolean</option><option value="string">String</option></select>
          <button id="objvar-add-btn" class="toolbar-btn" style="margin-bottom:0">+ Add</button>
        </div>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Per-instance state (Number/Boolean/String) -- Set/Increment/Toggle Object Variable actions default Target to this object itself, so a reusable prefab never needs a globally-unique counter name.</div>
      </div>
      ${behaviorAuthoringHTML()}
      <div class="field-row"><label>Save as Prefab</label>
        <div style="display:flex;gap:6px">
          <input type="text" id="prefab-name-input" placeholder="Prefab name" style="flex:1" list="prefab-name-list">
          <datalist id="prefab-name-list">${prefabs.map((p) => `<option value="${escapeHtml(p.name)}">`).join('')}</datalist>
          <button id="save-prefab-btn" class="toolbar-btn" style="margin-bottom:0;white-space:nowrap">Save</button>
        </div>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Typing an EXISTING prefab's name updates it instead of saving a duplicate.</div>
      </div>
      ${selectedItem.sourcePrefabName ? `
      <!-- Wave 6 (Priority K): Prefab Workflow 3.0 -- only shown for a
           LINKED instance (one placed from the palette/prefab list, or a
           prior Update From Prefab). Update From Prefab is a manual,
           one-way, on-demand re-sync (no automatic propagation, no
           override tracking) -- the priority's own explicit bounded scope. -->
      <div class="field-row"><label>Linked Prefab: ${escapeHtml(selectedItem.sourcePrefabName)}</label>
        <div class="field-triple">
          <button id="update-from-prefab-btn" class="toolbar-btn" style="margin-bottom:0" ${prefabs.some((p) => p.name === selectedItem.sourcePrefabName) ? '' : 'disabled title="Source prefab no longer exists"'}>⭯ Update From Prefab</button>
          <button id="update-prefab-from-this-btn" class="toolbar-btn" style="margin-bottom:0">⭱ Update Prefab From This</button>
          <button id="unlink-prefab-btn" class="toolbar-btn" style="margin-bottom:0">Unlink</button>
        </div>
      </div>
      <div class="field-row"><label>Prefab Parameters</label>
        <div id="prefab-param-def-list"></div>
        <div class="field-triple">
          <input type="text" id="param-new-name" placeholder="name (e.g. enemySpeed)">
          <select id="param-new-type"><option value="number">Number</option><option value="boolean">Boolean</option><option value="string">String</option><option value="color">Color</option><option value="prefabReference">Prefab Reference</option><option value="meshAsset">Mesh Asset</option><option value="textureAsset">Texture Asset</option><option value="audioAsset">Audio Asset</option></select>
          <button id="param-add-btn" class="toolbar-btn" style="margin-bottom:0">+ Add</button>
        </div>
        <div style="font-size:10.5px;color:#66759a;margin-top:3px">Defined once on the PREFAB (shared by every instance); each field below also binds it to a real prefab field so setting it actually does something.</div>
        <div id="prefab-param-override-list" style="margin-top:6px"></div>
      </div>` : ''}
      ${prefabs.length > 0 ? `
      <div class="field-row"><label>Replace With Prefab</label>
        <div style="display:flex;gap:6px">
          <select id="replace-with-prefab-select"><option value="">Choose a prefab...</option>${prefabs.map((p, i) => `<option value="${i}">${escapeHtml(p.name)}</option>`).join('')}</select>
          <button id="replace-with-prefab-btn" class="toolbar-btn" style="margin-bottom:0;white-space:nowrap">Replace</button>
        </div>
      </div>` : ''}
      <div class="field-triple">
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button>
        <button id="delete-btn" style="margin-bottom:0">Delete Object</button>
      </div>
    `;
    for (const id of ['f-x', 'f-y', 'f-z', 'f-rotation-x', 'f-rotation-y', 'f-rotation-z', 'f-scale-x', 'f-scale-y', 'f-scale-z', 'f-color']) {
      document.getElementById(id).onfocus = () => pushUndo();
    }
    if (entity.skin) {
      const clipOwner = selectedItem;
      document.getElementById('root-motion-inspect').onclick = () => {
        if (selectedItem !== clipOwner || !placed.includes(clipOwner) || clipOwner.entity !== entity) return;
        const report = document.getElementById('root-motion-report');
        try {
          const clip = entity.skin.clips?.[entity.animationClip];
          const rootName = document.getElementById('root-motion-joint').value;
          if (!rootName) throw new Error('Choose an available root joint first.');
          const delta = Opus.Skin.computeRootMotionDelta(entity.skin, entity.animationClip, 0, clip?.duration, rootName);
          report.textContent = `Root travel (${rootName}): X ${delta.x.toFixed(3)}, Y ${delta.y.toFixed(3)}, Z ${delta.z.toFixed(3)} skeleton-local units. Diagnostic only: character and collider remain under existing movement ownership. This is net start-to-end translation, not total path length or world displacement.`;
        } catch (error) { report.textContent = `Root motion unavailable: ${error.message}. Saved animation data is retained; no movement was applied.`; }
      };
      document.getElementById('f-animation-clip').onchange = (e) => {
        if (!changeSkeletalInstanceClip(clipOwner, e.target.value === '' ? null : Number(e.target.value))) {
          e.target.value = entity.animationClip == null ? '' : String(entity.animationClip);
        }
      };
      document.getElementById('f-character-anim-sync').onchange = (e) => {
        changeAiAnimationSync(selectedItem,e.target.checked);
      };
      document.getElementById('f-animation-blend').onchange = (e) => {
        const value = e.target.value.trim();
        changeSkeletalInstanceBlend(clipOwner, value === '' ? NaN : Number(value));
        e.target.value = Number.isFinite(entity.animationBlendTime) && entity.animationBlendTime >= 0 && entity.animationBlendTime <= 10 ? String(entity.animationBlendTime) : '';
      };
      document.querySelectorAll('[data-ai-animation-role]').forEach(el=>{el.onchange=()=>{if(changeAiAnimationRole(selectedItem,el.dataset.aiAnimationRole,el.value))renderInspector();};});
      // Wave 6B (Priority I): "Create Animated Enemy" -- one click fills in
      // ordinary editor data (AI Follow, Health, Auto-Animate, an Attack
      // slot with damage pre-set) using the exact same fields/defaults an
      // author would otherwise set by hand through this same Inspector --
      // no hidden runtime, nothing that isn't also a normal saved field.
      // Projectile Prefab is deliberately left for the author to pick
      // afterward (a preset can't guess which prefab they want to fire).
      document.getElementById('create-animated-enemy-btn').onclick = () => {
        createAnimatedEnemyFromInspector(selectedItem);
      };
      renderSocketList(selectedItem);
      renderAnimationEventList(selectedItem);
    }
    if (selectedItem.isBillboard) {
      document.getElementById('f-billboard-mode').onchange = (e) => {
        pushUndo();
        selectedItem.billboardMode = e.target.value;
      };
    }
    document.getElementById('f-x').oninput = (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) entity.position.x = v; };
    document.getElementById('f-y').oninput = (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) entity.position.y = v; };
    document.getElementById('f-z').oninput = (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) entity.position.z = v; };
    // Full XYZ rotation fields (Wave 5) -- each field's oninput reads ALL
    // THREE current field values (not just its own) and rebuilds the whole
    // orientation via Quat.fromEuler in one shot, rather than trying to
    // "adjust just one axis" of an already-composed quaternion (which has
    // no single correct meaning once pitch/roll are involved -- there's no
    // way to change "the yaw" of an arbitrary quaternion in isolation
    // without first deciding an Euler order, which is exactly what
    // fromEuler already commits to). This is what keeps editing one field
    // from unexpectedly destroying whatever the OTHER two fields already
    // held, e.g. typing a new Y value must not silently zero out X/Z.
    function applyRotationFields() {
      const x = parseFloat(document.getElementById('f-rotation-x').value) || 0;
      const y = parseFloat(document.getElementById('f-rotation-y').value) || 0;
      const z = parseFloat(document.getElementById('f-rotation-z').value) || 0;
      entity.quaternion = Opus.Quat.fromEuler(x * Math.PI / 180, y * Math.PI / 180, z * Math.PI / 180);
    }
    document.getElementById('f-rotation-x').oninput = applyRotationFields;
    document.getElementById('f-rotation-y').oninput = applyRotationFields;
    document.getElementById('f-rotation-z').oninput = applyRotationFields;
    // Per-axis scale (a wide thin wall, a tall thin door -- any non-uniform
    // shape) was previously only reachable through Custom Script or direct
    // property access, never through the inspector; the shipped uniform-only
    // field couldn't produce the Temple Switch Puzzle's own Door shape.
    // "Make Uniform" is a convenience for the common case, not a separate
    // mode -- the three axes stay independently editable either way.
    for (const axis of ['x', 'y', 'z']) {
      document.getElementById(`f-scale-${axis}`).oninput = (e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v) && v > 0) entity.scale[axis] = v;
      };
    }
    document.getElementById('f-scale-uniform-btn').onclick = () => {
      pushUndo();
      entity.scale.set(entity.scale.x, entity.scale.x, entity.scale.x);
      renderInspector();
    };
    bindMaterialAuthoringField(document.getElementById('f-color'),entity,'color','color');
    document.getElementById('f-texture').onchange = (e) => {
      if(playMode)return;
      const texId = e.target.value;
      const asset = texId ? findTextureAssetById(texId) : null;
      if(texId&&!asset)return;
      if(materialTextureRef(selectedItem)===(texId||null))return;
      pushUndo();
      if (!texId) {
        clearTextureFromEntity(entity);
        selectedItem.textureAssetId = undefined;
        selectedItem.textureDisabled = true;
      } else {
        selectedItem.textureDisabled = false;
        selectedItem.textureAssetId = asset.id; applyTextureToEntity(entity, asset);
      }
      renderInspector();
    };
    const uvScaleX = document.getElementById('f-uv-scale-x');
    if (uvScaleX) {
      entity.uvScale = entity.uvScale || [1, 1];
      entity.uvOffset = entity.uvOffset || [0, 0];
      for(const [id,key,index] of [['f-uv-scale-x','uvScale',0],['f-uv-scale-y','uvScale',1],['f-uv-offset-x','uvOffset',0],['f-uv-offset-y','uvOffset',1]]){
        const control=document.getElementById(id);let captured=false;
        control.oninput=()=>{const value=entity[key].slice();value[index]=control.value.trim()?Number(control.value):NaN;changeMaterialAuthoringField(entity,key,value,()=>{if(!captured){pushUndo();captured=true;}});};
        control.onblur=()=>{captured=false;};
      }
    }
    bindMaterialAuthoringField(document.getElementById('f-unlit'),entity,'unlit','checkbox');
    const materialCapture=document.getElementById('material-capture-btn');
    if(materialCapture)materialCapture.onclick=()=>captureNamedMaterial(document.getElementById('material-capture-name').value);
    const materialApply=document.getElementById('material-apply-btn');
    if(materialApply)materialApply.onclick=()=>applyNamedMaterial(document.getElementById('material-asset-picker').value);
    const materialEdit=document.getElementById('material-edit-btn');
    if(materialEdit)materialEdit.onclick=()=>openMaterialEditor(document.getElementById('material-asset-picker').value);
    bindMaterialAuthoringField(document.getElementById('f-alpha'),entity,'alpha','number');
    document.getElementById('f-alpha').onchange = () => renderInspector();
    const spritePassRelation = document.getElementById('f-sprite-pass-relation');
    if (spritePassRelation) spritePassRelation.onchange = (e) => {
      pushUndo(); selectedItem.spritePassRelation = e.target.value; entity.spritePassRelation = Opus.normalizeSpritePassRelation(e.target.value); validateCurrentProject();
    };
    bindMaterialAuthoringField(document.getElementById('f-emissive-color'),entity,'emissiveColor','color');
    bindMaterialAuthoringField(document.getElementById('f-emissive-intensity'),entity,'emissiveIntensity','number');
    bindPropertyAnimationInspector(selectedItem);
    // Wave 7 (Priority A/Section 7): Attach to Socket wiring.
    const attachmentOwner = selectedItem;
    const ownsAttachment = () => !playMode && selectedItem === attachmentOwner && placed.includes(attachmentOwner);
    const socketDetachBtn = document.getElementById('socket-detach-btn');
    if (socketDetachBtn) {
      socketDetachBtn.onclick = () => { if (!ownsAttachment() || !attachmentOwner.parentId) return; pushUndo(); detachFromSocket(attachmentOwner); renderInspector(); showStatus('Detached from socket'); };
    }
    const socketAttachCharSelect = document.getElementById('socket-attach-character');
    if (socketAttachCharSelect) {
      const socketAttachSocketSelect = document.getElementById('socket-attach-socket');
      const refreshSocketOptions = () => {
        const charItem = findItemById(socketAttachCharSelect.value);
        const sockets = attachmentSocketChoices(charItem);
        socketAttachSocketSelect.innerHTML = sockets.length
          ? sockets.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('')
          : '<option value="">(no available unambiguous sockets on this character)</option>';
      };
      refreshSocketOptions();
      socketAttachCharSelect.onchange = refreshSocketOptions;
      document.getElementById('socket-attach-btn').onclick = () => {
        if (!ownsAttachment()) return;
        const charItem = findItemById(socketAttachCharSelect.value);
        const socketName = socketAttachSocketSelect.value;
        if (!charItem || !socketName) { showStatus('Pick a character with at least one authored socket first'); return; }
        if (attachToSocket(attachmentOwner, charItem, socketName, pushUndo)) {
          renderInspector();
          showStatus(`Attached to "${socketName}"`);
        }
      };
    }
    if (!selectedItem.isTrigger) {
      document.getElementById('f-solid').onchange = (e) => { pushUndo(); entity.solid = e.target.checked; renderInspector(); };
      const shapeSelect = document.getElementById('f-collider-shape');
      if (shapeSelect) {
        const fitMeshButton = document.getElementById('f-collider-fit-mesh');
        if (fitMeshButton) fitMeshButton.onclick = () => {
          const fitted = meshFittedItemCollider(selectedItem, findAssetById(selectedItem.assetId));
          if (!fitted) { showStatus('Fit requires a static, unparented mesh with valid bounds'); return; }
          pushUndo();
          selectedItem.collider = fitted;
          renderInspector();
          showStatus('Collision box fitted to mesh — Undo restores the previous shape');
        };
        const fitTrunkButton = document.getElementById('f-collider-fit-trunk');
        if (fitTrunkButton) fitTrunkButton.onclick = () => {
          const fitted = meshTrunkItemCollider(selectedItem, findAssetById(selectedItem.assetId));
          if (!fitted) { showStatus('Fit requires a static, unparented mesh with valid bounds'); return; }
          pushUndo();
          selectedItem.collider = fitted;
          renderInspector();
          showStatus('Collision box fitted to trunk/base — Undo restores the previous shape');
        };
        shapeSelect.onchange = (e) => {
          pushUndo();
          if (e.target.value === 'auto') selectedItem.collider = undefined;
          else if (e.target.value === 'box') selectedItem.collider = { shape: 'box', size: { x: entity.scale.x, y: entity.scale.y, z: entity.scale.z }, offset: { x: 0, y: 0, z: 0 } };
          else selectedItem.collider = { shape: 'sphere', radius: Math.max(entity.scale.x, entity.scale.z) / 2, offset: { x: 0, y: 0, z: 0 } };
          renderInspector();
        };
        const sizeX = document.getElementById('f-collider-size-x');
        if (sizeX) {
          const syncSize = () => {
            const x = parseFloat(document.getElementById('f-collider-size-x').value) || 0.1;
            const y = parseFloat(document.getElementById('f-collider-size-y').value) || 0.1;
            const z = parseFloat(document.getElementById('f-collider-size-z').value) || 0.1;
            selectedItem.collider.size = { x: Math.max(0.05, x), y: Math.max(0.05, y), z: Math.max(0.05, z) };
          };
          sizeX.onchange = () => { pushUndo(); syncSize(); };
          document.getElementById('f-collider-size-y').onchange = () => { pushUndo(); syncSize(); };
          document.getElementById('f-collider-size-z').onchange = () => { pushUndo(); syncSize(); };
        }
        const radiusInput = document.getElementById('f-collider-radius');
        if (radiusInput) radiusInput.onchange = (e) => { pushUndo(); selectedItem.collider.radius = Math.max(0.05, parseFloat(e.target.value) || 0.1); };
        const offsetX = document.getElementById('f-collider-offset-x');
        if (offsetX) {
          const syncOffset = () => {
            const x = parseFloat(document.getElementById('f-collider-offset-x').value) || 0;
            const y = parseFloat(document.getElementById('f-collider-offset-y').value) || 0;
            const z = parseFloat(document.getElementById('f-collider-offset-z').value) || 0;
            selectedItem.collider.offset = { x, y, z };
          };
          offsetX.onchange = () => { pushUndo(); syncOffset(); };
          document.getElementById('f-collider-offset-y').onchange = () => { pushUndo(); syncOffset(); };
          document.getElementById('f-collider-offset-z').onchange = () => { pushUndo(); syncOffset(); };
        }
      }
    }
    document.getElementById('f-tags').onchange = (e) => {
      pushUndo();
      selectedItem.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
    };
    document.getElementById('f-persist-runtime-state').onchange = (e) => {
      pushUndo();
      selectedItem.persistRuntimeState = e.target.checked;
    };
    document.getElementById('f-carryable').onchange = (e) => {
      pushUndo();
      selectedItem.carryable = e.target.checked;
    };
    renderObjectVariableList(selectedItem);
    // AI type/speed/radius apply immediately to entity.ai (read directly by
    // the app.onUpdate steering loop) -- radius is meaningless for Follow
    // (there's no fixed base to circle/drift around), so it's disabled
    // rather than removed, keeping the field layout stable while switching
    // types.
    const aiTypeSelect = document.getElementById('f-ai-type');
    const aiParamsEl = document.getElementById('f-ai-params');
    const aiSpeedInput = document.getElementById('f-ai-speed');
    const aiRadiusInput = document.getElementById('f-ai-radius');
    aiTypeSelect.onchange = () => {
      pushUndo();
      const type = aiTypeSelect.value;
      if (!type) {
        entity.ai = null;
      } else {
        entity.ai = {
          type,
          speed: parseFloat(aiSpeedInput.value) || 3,
          radius: parseFloat(aiRadiusInput.value) || 5,
          base: entity.position.clone(),
          loop: type === 'patrolRoute' ? true : undefined,
        };
      }
      renderInspector(); // Target field only shows for Follow/Face Target -- needs a full re-render to appear/disappear
    };
    aiSpeedInput.oninput = () => { if (entity.ai) entity.ai.speed = parseFloat(aiSpeedInput.value) || 3; };
    aiRadiusInput.oninput = () => { if (entity.ai) entity.ai.radius = parseFloat(aiRadiusInput.value) || 5; };
    const aiTargetSelect = document.getElementById('f-ai-target');
    if (aiTargetSelect) {
      aiTargetSelect.onchange = () => { if (entity.ai) entity.ai.targetId = aiTargetSelect.value || undefined; };
    }
    if (entity.ai && entity.ai.type === 'patrolRoute') {
      // Editing any of the route's own fields invalidates the cached
      // resolved-id list (see the patrolRoute tick above) -- otherwise
      // retyping the waypoint list mid-Play would keep patrolling the OLD
      // route until the next full Stop/Play cycle happened to clear it.
      const invalidateRoute = () => { delete entity.ai.resolvedWaypointIds; };
      document.getElementById('f-ai-patrol-speed').oninput = (e) => { const v = parseFloat(e.target.value); if (v > 0) entity.ai.speed = v; };
      document.getElementById('f-ai-waypoints').oninput = (e) => { entity.ai.waypointNames = e.target.value; invalidateRoute(); };
      document.getElementById('f-ai-loop').onchange = (e) => { entity.ai.loop = e.target.checked; };
      document.getElementById('f-ai-pingpong').onchange = (e) => { entity.ai.pingpong = e.target.checked; invalidateRoute(); };
    }
    if (entity.ai && entity.ai.type === 'followPath') {
      const pathSel = document.getElementById('f-ai-path');
      if (pathSel) pathSel.onchange = () => { entity.ai.pathId = pathSel.value || undefined; delete entity.ai._pathLengthFor; };
      document.getElementById('f-ai-path-speed').oninput = (e) => { const v = parseFloat(e.target.value); if (v > 0) entity.ai.speed = v; };
      document.getElementById('f-ai-path-pingpong').onchange = (e) => { entity.ai.pingpong = e.target.checked; };
    }
    const aiAttackEnabled = document.getElementById('f-ai-attack-enabled');
    if (aiAttackEnabled) {
      aiAttackEnabled.onchange = (e) => { entity.ai.attackEnabled = e.target.checked; renderInspector(); };
      const attackPrefabSel = document.getElementById('f-ai-attack-prefab');
      if (attackPrefabSel) attackPrefabSel.onchange = (e) => { entity.ai.attackPrefab = e.target.value; };
      const attackRadius = document.getElementById('f-ai-attack-radius');
      if (attackRadius) {
        attackRadius.oninput = (e) => { const v = parseFloat(e.target.value); if (v > 0) entity.ai.attackRadius = v; };
        document.getElementById('f-ai-attack-cooldown').oninput = (e) => { const v = parseFloat(e.target.value); if (v > 0) entity.ai.attackCooldown = v; };
        document.getElementById('f-ai-attack-damage').oninput = (e) => { const v = parseFloat(e.target.value); if (v >= 0) entity.ai.attackDamage = v; };
      }
    }
    if (entity.ai) {
      document.getElementById('f-ai-solid-collision').onchange = (e) => {
        pushUndo(); entity.ai.collideWithSolids = e.target.checked; renderInspector();
      };
      const collisionRadiusInput = document.getElementById('f-ai-collision-radius');
      if (collisionRadiusInput) collisionRadiusInput.onchange = (e) => {
        const value = Number(e.target.value);
        if (Number.isFinite(value) && value >= 0.05 && value <= 10) { pushUndo(); entity.ai.collisionRadius = value; }
        renderInspector();
      };
      const smToggle = document.getElementById('f-ai-statemachine-mode');
      if (smToggle) {
        smToggle.onchange = (e) => {
          pushUndo();
          entity.ai.mode = e.target.checked ? 'stateMachine' : 'simple';
          if (entity.ai.mode === 'stateMachine' && !entity.ai.states) entity.ai.states = [];
          renderInspector();
        };
      }
      renderAiPerceptionFields(selectedItem);
      if (entity.ai.mode === 'stateMachine') renderAiStateList(selectedItem);
    }
    renderAiArchetypeLibrary(selectedItem);
    const addConnectionBtn = document.getElementById('add-connection-btn');
    if (addConnectionBtn) {
      addConnectionBtn.onclick = () => {
        const otherId = document.getElementById('add-connection-select').value;
        if (!otherId) return;
        const result=editWaypointConnection(selectedItem,otherId);
        if(!result.ok)showStatus(result.reason);
      };
      document.querySelectorAll('[data-remove-connection]').forEach((btn) => {
        btn.onclick = () => {
          const otherId = btn.dataset.removeConnection;
          const result=editWaypointConnection(selectedItem,otherId,{remove:true});
          if(!result.ok)showStatus(result.reason);
        };
      });
    }
    const setDefaultSpawnBtn = document.getElementById('set-default-spawn-btn');
    if (setDefaultSpawnBtn) {
      setDefaultSpawnBtn.onclick = () => {
        pushUndo();
        for (const p of placed) { if (p.isSpawnPoint) p.isDefaultSpawn = false; }
        selectedItem.isDefaultSpawn = true;
        renderInspector();
        renderSceneList();
        showStatus('Default Player Spawn updated');
      };
    }
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
    document.getElementById('save-prefab-btn').onclick = () => {
      const nameInput = document.getElementById('prefab-name-input');
      const name = nameInput.value.trim() || itemDisplayName(selectedItem, placed.indexOf(selectedItem));
      const { payload, memberCount } = buildPrefabPayload(selectedItem, name);
      pushUndo(); // Capture both library and source link, like assembly capture.
      // Wave 6 (Priority K): typing an EXISTING prefab's name now UPDATES
      // that prefab in place (overwriting its stored record/records/rootId)
      // instead of pushing a second entry sharing the same name -- the
      // "Update Prefab" half of the workflow. A genuinely new name still
      // pushes a fresh entry, byte-identical to the pre-Wave-6 behavior.
      const existingIndex = prefabs.findIndex((p) => p.name === name);
      if (existingIndex !== -1) {
        prefabs[existingIndex] = payload;
        showStatus(`Updated prefab "${name}"${memberCount > 1 ? ` (${memberCount} objects)` : ''}`);
      } else {
        prefabs.push(payload);
        showStatus(`Saved prefab "${name}"${memberCount > 1 ? ` (${memberCount} objects)` : ''}`);
      }
      selectedItem.sourcePrefabName = name; // this instance is now (or still) linked to the prefab it was just saved/updated from
      savePrefabs();
      renderPrefabPalette();
      nameInput.value = '';
      renderInspector();
    };
    if (selectedItem.sourcePrefabName) {
      const updateFromBtn = document.getElementById('update-from-prefab-btn');
      if (updateFromBtn) updateFromBtn.onclick = () => updateInstanceFromPrefab(selectedItem);
      document.getElementById('update-prefab-from-this-btn').onclick = () => {
        const { payload, memberCount } = buildPrefabPayload(selectedItem, selectedItem.sourcePrefabName);
        pushUndo();
        const existingIndex = prefabs.findIndex((p) => p.name === selectedItem.sourcePrefabName);
        if (existingIndex !== -1) prefabs[existingIndex] = payload; else prefabs.push(payload);
        savePrefabs();
        renderPrefabPalette();
        showStatus(`Updated prefab "${selectedItem.sourcePrefabName}"${memberCount > 1 ? ` (${memberCount} objects)` : ''} from this object`);
      };
      document.getElementById('unlink-prefab-btn').onclick = () => {
        pushUndo();
        selectedItem.sourcePrefabName = undefined;
        renderInspector();
        showStatus('Unlinked from prefab (this instance is now independent)');
      };
      renderPrefabParamPanel(selectedItem);
    }
    const replaceBtn = document.getElementById('replace-with-prefab-btn');
    if (replaceBtn) {
      replaceBtn.onclick = () => {
        const idx = document.getElementById('replace-with-prefab-select').value;
        if (idx === '') return;
        replaceItemWithPrefab(selectedItem, prefabs[Number(idx)]);
      };
    }
    bindBehaviorAuthoring();
    return;
  }

  if (selectedItem.kind === 'terrain') {
    const opts = selectedItem.options;
    inspectorBody.innerHTML = `
      <div class="field-row"><label>Seed</label><input type="number" id="f-seed" step="1" value="${opts.seed}"></div>
      <div class="field-row"><label>Size</label><input type="number" id="f-size" step="1" min="4" value="${opts.size}"></div>
      <div class="field-row"><label>Radius</label><input type="number" id="f-radius" step="0.5" min="1" value="${opts.radius}"></div>
      <div class="field-row"><label>Sculpt</label>
        <button id="sculpt-toggle-btn" class="toolbar-btn" style="margin-bottom:6px">${sculptMode ? '■ Stop Sculpting' : '⛰ Start Sculpting'}</button>
        <div class="field-triple">
          <button id="sculpt-raise-btn" class="toolbar-btn${sculptSettings.brush === 'raise' ? ' active' : ''}" style="margin-bottom:0">Raise</button>
          <button id="sculpt-lower-btn" class="toolbar-btn${sculptSettings.brush === 'lower' ? ' active' : ''}" style="margin-bottom:0">Lower</button>
          <button id="sculpt-flatten-btn" class="toolbar-btn${sculptSettings.brush === 'flatten' ? ' active' : ''}" style="margin-bottom:0">Flatten</button>
        </div>
        <div class="field-triple">
          <button id="sculpt-smooth-btn" class="toolbar-btn${sculptSettings.brush === 'smooth' ? ' active' : ''}" style="margin-bottom:0">Smooth</button>
        </div>
        <div class="field-row"><label for="sculpt-radius">Brush radius</label><input type="number" id="sculpt-radius" step="0.5" min="0.5" max="256" value="${sculptSettings.radius}" title="World units · 0.5–256"></div>
        <div class="field-row"><label for="sculpt-strength">Strength</label><input type="number" id="sculpt-strength" step="0.1" min="0.05" max="2" value="${sculptSettings.strength}" title="0.05–2"></div>
        <div class="inspector-hint" id="sculpt-help" role="status">Drag on this terrain to sculpt. One stroke = one Undo. Flatten uses the first point’s height; Smooth softens neighboring heights.</div>
        ${opts.heightEdits ? `<button id="sculpt-reset-btn" class="toolbar-btn" style="margin-top:6px">Reset Sculpting to Procedural</button>` : ''}
      </div>
      <div class="field-row"><label>Terrain surface paint</label>
        <p class="field-help">Choose a layer, then drag on this terrain. Colors and optional textures blend over the procedural surface; painting does not change height. One changed stroke is one Undo. Escape ends the stroke. Masks favor flat ground or steep slopes.</p>
        <button id="paint-toggle-btn" class="toolbar-btn" style="margin-bottom:6px">${paintMode ? '■ Stop Painting' : '🖌 Start Painting'}</button>
        <div id="paint-layer-list"></div>
        ${(opts.paintEdits ? opts.paintEdits.layers.length : 2) < PAINT_MAX_LAYERS ? `<button id="paint-add-layer-btn" class="toolbar-btn" style="margin-bottom:6px">+ Add Layer</button>` : ''}
        <div class="field-triple">
          <input type="number" id="paint-radius" step="0.5" min="0.5" max="256" value="${paintSettings.radius}" aria-label="Paint radius (world units)" title="Radius: 0.5–256 world units" placeholder="Radius">
          <input type="number" id="paint-strength" step="0.1" min="0.05" max="2" value="${paintSettings.strength}" aria-label="Paint strength" title="Strength: 0.05–2 per dab" placeholder="Strength">
          <select id="paint-automask" title="Slope Automask">
            <option value="off" ${paintSettings.automask === 'off' ? 'selected' : ''}>No automask</option>
            <option value="flat" ${paintSettings.automask === 'flat' ? 'selected' : ''}>Favor flat ground</option>
            <option value="steep" ${paintSettings.automask === 'steep' ? 'selected' : ''}>Favor steep slopes</option>
          </select>
        </div>
        ${opts.paintEdits ? `<button id="paint-reset-btn" class="toolbar-btn" style="margin-top:6px">Reset Painting to Procedural</button>` : ''}
      </div>
      <div class="field-triple">
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button>
        <button id="delete-btn" style="margin-bottom:0">Delete Terrain</button>
      </div>
    `;
    const regenerate = (patch) => { pushUndo(); regenerateTerrain(selectedItem, patch); };
    document.getElementById('f-seed').onchange = (e) => regenerate({ seed: parseFloat(e.target.value) || 0 });
    document.getElementById('f-size').onchange = (e) => { const v = parseFloat(e.target.value); if (v >= 4) regenerate({ size: v }); };
    document.getElementById('f-radius').onchange = (e) => { const v = parseFloat(e.target.value); if (v >= 1) regenerate({ radius: v }); };
    document.getElementById('sculpt-toggle-btn').onclick = () => { sculptMode = !sculptMode; if (sculptMode) { paintMode = false; finishScatterBrushGesture(); scatterBrushMode = null; } renderInspector(); showStatus(sculptMode ? 'Sculpt mode on -- drag on the terrain to sculpt' : 'Sculpt mode off'); };
    document.getElementById('sculpt-raise-btn').onclick = () => { sculptSettings.brush = 'raise'; renderInspector(); };
    document.getElementById('sculpt-lower-btn').onclick = () => { sculptSettings.brush = 'lower'; renderInspector(); };
    document.getElementById('sculpt-flatten-btn').onclick = () => { sculptSettings.brush = 'flatten'; renderInspector(); };
    document.getElementById('sculpt-smooth-btn').onclick = () => { sculptSettings.brush = 'smooth'; renderInspector(); };
    for (const key of ['radius', 'strength']) {
      const input = document.getElementById('sculpt-' + key);
      input.oninput = () => { const valid = changeTerrainSculptSetting(key, input.value); input.setAttribute('aria-invalid', String(!valid)); document.getElementById('sculpt-help').textContent = valid ? 'Drag on this terrain. One changing stroke = one Undo.' : 'Enter a valid brush radius (0.5–256) and strength (0.05–2). Last valid setting remains active.'; };
      input.onblur = () => { input.value = sculptSettings[key]; input.setAttribute('aria-invalid', 'false'); };
    }
    const resetBtn = document.getElementById('sculpt-reset-btn');
    if (resetBtn) resetBtn.onclick = () => { pushUndo(); delete opts.heightEdits; regenerateTerrain(selectedItem); renderInspector(); showStatus('Sculpting reset to procedural terrain'); };
    // Paint layer rows -- built here (not in the template literal above) so
    // each row's own color swatch <input type="color"> and Select button
    // can be wired without hand-building a second escaping/serialization
    // path for per-layer state inside one big template string.
    const paintItem = selectedItem;
    const paintEdits = terrainPaintDraft(paintItem);
    const layerListEl = document.getElementById('paint-layer-list');
    if (paintEdits) {
      // Wave 6B (Priority D): a Texture dropdown (None + every Texture
      // Asset) and a UV Scale (tiling) field per layer, right alongside the
      // existing color swatch -- a layer with no texture assigned keeps
      // rendering its flat authored color exactly as before this priority.
      layerListEl.innerHTML = paintEdits.layers.map((layer, i) => `
        <div style="margin-bottom:6px;padding-bottom:6px;${i < paintEdits.layers.length - 1 ? 'border-bottom:1px solid var(--border-color,#333)' : ''}">
          <div class="field-triple" style="align-items:center;margin-bottom:4px">
            <button data-paint-layer="${i}" class="toolbar-btn${paintSettings.activeLayer === i ? ' active' : ''}" style="margin-bottom:0;text-align:left">${paintSettings.activeLayer === i ? '● ' : ''}${escapeHtml(layer.name)}</button>
            <input type="color" data-paint-color="${i}" value="${rgbToHex(layer.color)}" title="Layer color" style="padding:0;height:28px">
          </div>
          <div class="field-triple" style="align-items:center">
            <select data-paint-texture="${i}" title="Layer texture" style="grid-column:span 2">
              <option value="">No texture (flat color)</option>
              ${textureAssets.map((t) => `<option value="${t.id}"${layer.textureAssetId === t.id ? ' selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            </select>
            <input type="number" data-paint-uvscale="${i}" step="0.5" min="0.5" value="${layer.uvScale || 4}" title="Tile size (world units per texture repeat)" placeholder="Tile" ${layer.textureAssetId ? '' : 'disabled'}>
          </div>
        </div>`).join('');
      layerListEl.querySelectorAll('[data-paint-layer]').forEach((btn) => {
        btn.onclick = () => { paintSettings.activeLayer = Number(btn.dataset.paintLayer); renderInspector(); };
      });
      layerListEl.querySelectorAll('[data-paint-color]').forEach((input) => {
        let captured = false;
        input.onfocus = () => { captured = false; };
        input.oninput = () => {
          changeTerrainPaintLayer(paintItem, Number(input.dataset.paintColor), 'color', hexToRgb(input.value), () => { if (!captured) { pushUndo(); captured = true; } });
        };
      });
      layerListEl.querySelectorAll('[data-paint-texture]').forEach((select) => {
        select.onchange = () => {
          if (changeTerrainPaintLayer(paintItem, Number(select.dataset.paintTexture), 'textureAssetId', select.value || undefined)) renderInspector();
        };
      });
      layerListEl.querySelectorAll('[data-paint-uvscale]').forEach((input) => {
        input.onchange = () => {
          changeTerrainPaintLayer(paintItem, Number(input.dataset.paintUvscale), 'uvScale', input.value.trim() ? Number(input.value) : NaN);
        };
        input.onblur = () => { input.value = terrainPaintDraft(paintItem).layers[Number(input.dataset.paintUvscale)].uvScale || 4; };
      });
    }
    const addLayerBtn = document.getElementById('paint-add-layer-btn');
    if (addLayerBtn) addLayerBtn.onclick = () => { if (addPaintLayer(paintItem)) renderInspector(); };
    document.getElementById('paint-toggle-btn').onclick = () => { paintMode = !paintMode; if (paintMode) { sculptMode = false; finishScatterBrushGesture(); scatterBrushMode = null; } renderInspector(); showStatus(paintMode ? 'Paint mode on -- drag on the terrain to paint' : 'Paint mode off'); };
    for (const key of ['radius', 'strength']) {
      const input = document.getElementById('paint-' + key);
      input.disabled = playMode;
      input.oninput = () => input.setAttribute('aria-invalid', String(!changeTerrainPaintSetting(key, input.value)));
      input.onblur = () => { input.value = paintSettings[key]; input.setAttribute('aria-invalid', 'false'); };
    }
    document.getElementById('paint-automask').onchange = (e) => { paintSettings.automask = e.target.value; };
    const paintResetBtn = document.getElementById('paint-reset-btn');
    if (paintResetBtn) paintResetBtn.onclick = () => { if (playMode || !placed.includes(paintItem) || !paintItem.options.paintEdits) return; pushUndo(); delete paintItem.options.paintEdits; paintSettings.activeLayer = 0; regenerateTerrain(paintItem); renderInspector(); showStatus('Painting reset to procedural terrain'); };
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
    return;
  }

  if (selectedItem.kind === 'water') {
    const opts = selectedItem.options;
    inspectorBody.innerHTML = `
      <div class="field-row"><label>Size</label><input type="number" id="f-size" step="1" min="4" value="${opts.size}"></div>
      <div class="field-triple">
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button>
        <button id="delete-btn" style="margin-bottom:0">Delete Water</button>
      </div>
    `;
    document.getElementById('f-size').onchange = (e) => {
      const v = parseFloat(e.target.value);
      if (v < 4) return;
      pushUndo();
      app.removeWater(selectedItem.handle);
      opts.size = v;
      selectedItem.handle = app.createWater(opts);
    };
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
  }

  if (selectedItem.kind === 'emitter') {
    const handle = selectedItem.handle;
    // Every field mutates the live ParticleEmitter instance directly
    // (no remove/recreate the way Terrain/Water need for their baked
    // heightfield/wave geometry) -- rate/color/life/etc. are plain
    // instance fields `update()`/`appendRenderData()` already read fresh
    // every frame, so a change is visible immediately, in both edit and Play.
    inspectorBody.innerHTML = `
      <div class="field-row"><label>Preset</label>
        <select id="f-emitter-preset">
          <option value="">(custom)</option>
          ${Object.keys(PARTICLE_PRESETS).map((name) => `<option value="${name}">${name}</option>`).join('')}
        </select>
      </div>
      <div class="field-row"><label>Position</label>
        <div class="field-triple">
          <input type="number" id="f-x" step="0.1" value="${handle.position.x.toFixed(2)}">
          <input type="number" id="f-y" step="0.1" value="${handle.position.y.toFixed(2)}">
          <input type="number" id="f-z" step="0.1" value="${handle.position.z.toFixed(2)}">
        </div>
      </div>
      <div class="field-row"><label>Color</label>
        <input type="color" id="f-color" value="${rgbToHex(handle.color)}">
      </div>
      <div data-schema-slot="particle-emitter"></div>
      <div class="field-row"><label>Life (min / max seconds)</label>
        <div class="field-triple">
          <input type="number" id="f-life-min" step="0.1" min="0.05" value="${handle.life[0]}">
          <input type="number" id="f-life-max" step="0.1" min="0.05" value="${handle.life[1]}">
        </div>
      </div>
      <div class="field-row"><label>Rise Speed (min / max)</label>
        <div class="field-triple">
          <input type="number" id="f-rise-min" step="0.1" value="${handle.riseSpeed[0]}">
          <input type="number" id="f-rise-max" step="0.1" value="${handle.riseSpeed[1]}">
        </div>
      </div>
      <div class="field-triple">
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button>
        <button id="delete-btn" style="margin-bottom:0">Delete Emitter</button>
      </div>
    `;
    for (const id of ['f-x', 'f-y', 'f-z', 'f-color', 'f-life-min', 'f-life-max', 'f-rise-min', 'f-rise-max']) {
      document.getElementById(id).onfocus = () => pushUndo();
    }
    document.getElementById('f-x').oninput = (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) { handle.position.x = v; selectedItem.options.position = handle.position; } };
    document.getElementById('f-y').oninput = (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) { handle.position.y = v; selectedItem.options.position = handle.position; } };
    document.getElementById('f-z').oninput = (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) { handle.position.z = v; selectedItem.options.position = handle.position; } };
    document.getElementById('f-color').oninput = (e) => { handle.color = hexToRgb(e.target.value); selectedItem.options.color = handle.color; };
    document.getElementById('f-life-min').oninput = (e) => { const v = parseFloat(e.target.value); if (v > 0 && v <= handle.life[1]) { handle.life = [v, handle.life[1]]; selectedItem.options.life = handle.life; } };
    document.getElementById('f-life-max').oninput = (e) => { const v = parseFloat(e.target.value); if (v >= handle.life[0]) { handle.life = [handle.life[0], v]; selectedItem.options.life = handle.life; } };
    document.getElementById('f-rise-min').oninput = (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v <= handle.riseSpeed[1]) { handle.riseSpeed = [v, handle.riseSpeed[1]]; selectedItem.options.riseSpeed = handle.riseSpeed; } };
    document.getElementById('f-rise-max').oninput = (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v >= handle.riseSpeed[0]) { handle.riseSpeed = [handle.riseSpeed[0], v]; selectedItem.options.riseSpeed = handle.riseSpeed; } };
    document.getElementById('f-emitter-preset').onchange = (e) => {
      const preset = PARTICLE_PRESETS[e.target.value];
      if (!preset) return;
      pushUndo();
      Object.assign(handle, preset);
      Object.assign(selectedItem.options, preset);
      renderInspector();
    };
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
  }

  if (selectedItem.kind === 'camera') {
    const opts = selectedItem.options = normalizeCameraOptions(selectedItem.options);
    const obstructionUi = opts.obstruction && typeof opts.obstruction==='object' && !Array.isArray(opts.obstruction) ? opts.obstruction : {enabled:false,radius:0.25,padding:0.05};
    const showChase = opts.mode === 'chase';
    const showFixedTarget = opts.mode === 'fixed' || opts.mode === 'followLookAt';
    const viewing = cameraViewState && cameraViewState.itemId === selectedItem.id;
    const active = !!selectedItem.isActiveCamera;
    inspectorBody.innerHTML = `<div class="camera-authoring">
      <h4>Camera preset</h4><p class="field-help">Camera and 2D Camera share these settings. Make Active Camera chooses this level's opening view; without an active preset, the player controller keeps its historical camera. Use the Change Camera Action to switch to this named preset during gameplay.</p>
      <details id="camera-template-library"></details>
      <details><summary>Target group framing</summary><div id="camera-target-group-fields">${cameraTargetGroupFieldsHTML(selectedItem)}</div></details>
      <div class="field-row"><label>Position</label>
        <div class="field-triple">
          <input type="number" id="f-x" step="0.1" value="${opts.position.x.toFixed(2)}">
          <input type="number" id="f-y" step="0.1" value="${opts.position.y.toFixed(2)}">
          <input type="number" id="f-z" step="0.1" value="${opts.position.z.toFixed(2)}">
        </div>
      </div>
      <div class="field-row"><label>Projection</label>
        <select id="f-projection">
          <option value="perspective"${opts.projection === 'perspective' ? ' selected' : ''}>Perspective</option>
          <option value="orthographic"${opts.projection === 'orthographic' ? ' selected' : ''}>Orthographic (2D)</option>
        </select>
      </div>
      <div class="field-row"><label>Mode</label>
        <select id="f-mode">
          <option value="chase"${opts.mode === 'chase' ? ' selected' : ''}>Chase (follows the Player, moves with it)</option>
          <option value="orbit"${opts.mode === 'orbit' ? ' selected' : ''}>Orbit (free-look, pivots on this position)</option>
          <option value="fixed"${opts.mode === 'fixed' ? ' selected' : ''}>Fixed (static shot from this position)</option>
          <option value="followLookAt"${opts.mode === 'followLookAt' ? ' selected' : ''}>Follow Look-At (static position, tracks object or Player)</option>
        </select>
      </div>
      ${opts.projection === 'perspective' ? `<div class="field-row"><label>Field of View (degrees)</label>
        <input type="number" id="f-fov" step="1" min="20" max="120" value="${opts.fovDegrees}">
      </div>` : `<div class="field-row"><label>Orthographic Height (world units)</label>
        <input type="number" id="f-ortho-height" step="0.1" min="0.01" value="${opts.orthographicHeight}">
        <small>Full vertical world span. Camera Z does not zoom; use this value.</small>
      </div>`}
      <div class="field-row"><label>Near / Far Clip</label><div class="field-triple">
        <input type="number" id="f-near" step="0.01" min="0.001" value="${opts.near}">
        <input type="number" id="f-far" step="1" min="0.01" value="${opts.far}">
      </div></div>
      <div class="field-row"><label>Rotation X / Y / Z (degrees)</label><div class="field-triple">
        <input type="number" id="f-camera-rx" step="1" value="${opts.rotationDegrees.x}">
        <input type="number" id="f-camera-ry" step="1" value="${opts.rotationDegrees.y}">
        <input type="number" id="f-camera-rz" step="1" value="${opts.rotationDegrees.z}">
      </div></div>
      ${showChase ? `
      <div class="field-row"><label>Chase Distance / Height</label>
        <div class="field-triple">
          <input type="number" id="f-chase-distance" step="0.5" min="1" value="${opts.chase.distance}">
          <input type="number" id="f-chase-height" step="0.5" min="0.01" value="${opts.chase.height}" title="Chase height must be greater than zero.">
        </div>
      </div>
      <div class="field-row"><label>Chase Smoothing (position / rotation)</label>
        <div class="field-triple">
          <input type="number" id="f-chase-lerp" step="0.5" min="0.5" value="${opts.chase.lerpSpeed}">
          <input type="number" id="f-chase-rot-lerp" step="0.5" min="0.5" value="${opts.chase.rotationLerpSpeed}">
        </div>
      </div>
      <div class="field-row"><label>Follow tilt (degrees)</label>
        <input type="number" id="f-chase-pitch" step="1" value="${cameraPitchDegrees(opts.chase.pitch)}">
        <small>Adds elevation by sin(tilt) × distance; not an orbit-angle control. Signed values are supported.</small>
      </div>
      <div class="field-row"><label>Follow bearing</label><select id="f-chase-bearing-mode">
        <option value="followTarget"${opts.chase.bearingMode==='followTarget'?' selected':''}>Follow Player facing</option>
        <option value="fixed"${opts.chase.bearingMode==='fixed'?' selected':''}>Fixed map bearing</option>
      </select></div>
      <div class="field-row"><label>Fixed bearing (degrees)</label><input type="number" id="f-chase-bearing-yaw" step="1" value="${cameraPitchDegrees(opts.chase.bearingYaw)}">
        <small>Used only with Fixed map bearing. Keeps the view orientation while the Player turns; map-north is 180°.</small>
      </div>
      <div class="field-row"><label>Movement lead (seconds)</label>
        <input type="number" id="f-chase-look-ahead" step="0.1" value="${opts.chase.lookAhead}">
        <small>Predicts the Player's horizontal motion using velocity × seconds. Zero turns lead off; negative values trail motion.</small>
      </div>
      <p class="field-help">Chase follows the actual Player, not this marker's position. Make Active Camera selects the opening follow view; Change Camera can switch named presets during Play.</p>
<div class="field-row"><label><input id="f-camera-obstruction-enabled" type="checkbox"${obstructionUi.enabled?' checked':''} style="width:auto"> Avoid solid obstacles</label></div>
      <div class="field-row"><label>Camera clearance (world units)</label><input id="f-camera-obstruction-radius" type="number" step="0.05" min="0.01" value="${obstructionUi.radius}"></div>
      <div class="field-row"><label>Contact padding (world units)</label><input id="f-camera-obstruction-padding" type="number" step="0.01" min="0" value="${obstructionUi.padding}"></div>
      <p class="field-help">Chase-only camera clearance against visible solid Cube legacy box/sphere bounds. Pulls the view closer without moving the Player. Clearance is user-chosen, not a universal near-plane or full-frustum guarantee. Terrain, ramps and 2D Colliders are not covered. Obstacles whose expanded bounds contain the follow target are ignored; this is not depenetration.</p>
      ` : ''}
      ${showFixedTarget ? `
      <div class="field-row"><label>Look At (optional -- object to aim at)</label>
        ${renderActionFieldInput({ key: 'lookAtTargetId', type: 'target', implicitSelf:false, nullable:true, emptyLabel:opts.mode==='fixed'?'Use camera rotation':'Track the Player' }, opts.lookAtTargetId, 'f-lookat')}
      </div>
      ` : ''}
      <button id="camera-align-2d" class="toolbar-btn" style="width:100%;margin-bottom:6px">Align to 2D Plane</button>
      <button id="camera-view-btn" class="toolbar-btn" style="width:100%;margin-bottom:6px">${viewing ? 'Return to Scene View' : 'View Through Camera'}</button>
      <button id="camera-active-btn" class="toolbar-btn" style="width:100%;margin-bottom:6px">${active ? 'Active Camera ✓' : 'Make Active Camera'}</button>
      <p class="field-help" id="camera-authoring-status" role="status">View Through Camera is an authoring preview; Return restores the Scene View. Projection switching retains both Field of View and Orthographic Height. Near must be positive and less than Far.</p>
      <div class="field-triple">
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button>
        <button id="delete-btn" style="margin-bottom:0">Delete Camera</button>
      </div></div>
    `;
    bindCameraAuthoringControls(selectedItem);
    bindCameraTargetGroupControls(selectedItem);
    renderCameraTemplateLibrary(selectedItem);
    document.getElementById('camera-view-btn').disabled=playMode;
    document.getElementById('camera-view-btn').onclick = () => {if(playMode)return;viewing ? exitCameraView() : enterCameraView(selectedItem);};
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
  }

  if (selectedItem.kind === 'spawner') {
    const spawner = selectedItem;
    const opts = selectedItem.options;
    inspectorBody.innerHTML = `
      <div class="field-row"><label>Position</label>
        <div class="field-triple">
          <input type="number" id="f-x" step="0.1" value="${opts.position.x.toFixed(2)}">
          <input type="number" id="f-y" step="0.1" value="${opts.position.y.toFixed(2)}">
          <input type="number" id="f-z" step="0.1" value="${opts.position.z.toFixed(2)}">
        </div>
      </div>
      <div class="field-row"><label>Prefab to Spawn</label>
        ${prefabs.length === 0 ? '<p style="color:#8592a8;font-size:11.5px;margin:2px 0">No prefabs saved yet.</p>' : renderActionFieldInput({ key: 'prefabName', type: 'prefab' }, opts.prefabName, 'f-spawner-prefab')}
      </div>
      <div class="field-row"><label>Interval (sec) / Initial Delay (sec)</label>
        <div class="field-triple">
          <input type="number" id="f-interval" step="0.5" min="0.1" value="${opts.interval}">
          <input type="number" id="f-initial-delay" step="0.5" min="0" value="${opts.initialDelay || 0}">
        </div>
      </div>
      <div class="field-row"><label>Radius / Tag on spawned (optional)</label>
        <div class="field-triple">
          <input type="number" id="f-radius" step="0.5" min="0" value="${opts.radius}">
          <input type="text" id="f-spawn-tag" placeholder="e.g. enemy" value="${escapeHtml(opts.tag || '')}">
        </div>
      </div>
      <div class="field-row"><label>Max Active / Total Count (0 = unlimited)</label>
        <div class="field-triple">
          <input type="number" id="f-max-active" step="1" min="1" value="${opts.maxActive}">
          <input type="number" id="f-total-count" step="1" min="0" value="${opts.totalCount}">
        </div>
      </div>
      <div class="field-row"><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#c7d3ea">
        <input type="checkbox" id="f-start-enabled"${opts.startEnabled !== false ? ' checked' : ''}> Enabled at level start
      </label></div>
      <div class="field-triple">
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button>
        <button id="delete-btn" style="margin-bottom:0">Delete Spawner</button>
      </div>
    `;
    for(const axis of ['x','y','z'])bindSpawnerAuthoringField(document.getElementById('f-'+axis),spawner,'position.'+axis,'number');
    const prefabSelect = document.getElementById('f-spawner-prefab');
    if (prefabSelect) bindSpawnerAuthoringField(prefabSelect,spawner,'prefabName','select');
    for(const [id,key]of [['f-interval','interval'],['f-initial-delay','initialDelay'],['f-radius','radius'],['f-max-active','maxActive'],['f-total-count','totalCount']])bindSpawnerAuthoringField(document.getElementById(id),spawner,key,'number');
    bindSpawnerAuthoringField(document.getElementById('f-spawn-tag'),spawner,'tag','text');
    bindSpawnerAuthoringField(document.getElementById('f-start-enabled'),spawner,'startEnabled','checkbox');
    renderCombatEncounterLibrary(spawner);
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
  }

  if (selectedItem.kind === 'light') {
    const opts = selectedItem.options;
    const isSpot = opts.lightType === 'spot';
    inspectorBody.innerHTML = `
      <p class="field-help">${isSpot?'Spot':'Point'} light · Position in world units. Intensity 0 emits no light; range must be positive. Local lights do not cast shadows.</p>
      <div class="field-row"><label>World Position (X, Y, Z)</label>
        <div class="field-triple">
          <input type="number" id="f-x" step="0.1" value="${opts.position.x.toFixed(2)}">
          <input type="number" id="f-y" step="0.1" value="${opts.position.y.toFixed(2)}">
          <input type="number" id="f-z" step="0.1" value="${opts.position.z.toFixed(2)}">
        </div>
      </div>
      <div class="field-row"><label>Enabled</label><input type="checkbox" id="f-light-enabled" ${opts.enabled === false ? '' : 'checked'}></div>
      <div class="field-row"><label>Color</label><input type="color" id="f-light-color" value="${rgbToHex(opts.color)}"></div>
      <div class="field-row"><label>Intensity / Range (world units)</label>
        <div class="field-triple">
          <input type="number" id="f-light-intensity" step="0.1" min="0" value="${opts.intensity}">
          <input type="number" id="f-light-range" aria-label="Light range in world units" step="any" min="0" value="${opts.range}">
        </div>
      </div>
      ${isSpot ? `
      <div class="field-row"><label>Cone half-angle (degrees)</label>
        <input type="number" id="f-light-angle" aria-label="Spot cone half-angle in degrees" step="any" min="0" max="90" value="${opts.angle * 180 / Math.PI}">
      </div>
      <p class="field-help">Direction uses local axes relative to this light's rotation; it is normalized for rendering. At least one axis must be non-zero.</p>
      <div class="field-row"><label>Local Direction (X, Y, Z)</label>
        <div class="field-triple">
          <input type="number" id="f-light-dir-x" step="0.1" value="${opts.direction.x.toFixed(2)}">
          <input type="number" id="f-light-dir-y" step="0.1" value="${opts.direction.y.toFixed(2)}">
          <input type="number" id="f-light-dir-z" step="0.1" value="${opts.direction.z.toFixed(2)}">
        </div>
      </div>` : ''}
      <div class="field-triple">
        <button id="duplicate-btn" class="toolbar-btn" style="margin-bottom:0">Duplicate</button>
        <button id="delete-btn" style="margin-bottom:0">Delete Light</button>
      </div>
    `;
    inspectorBody.insertAdjacentHTML('beforeend', '<div class="field-row"><label for="prefab-name-input">Reusable Light Prefab</label><input id="prefab-name-input" placeholder="Prefab name"><button id="save-prefab-btn" class="toolbar-btn">Save Light as Prefab</button><p class="field-help">Stores this ordinary light and its children. An existing name updates that Prefab.</p></div>');
    const lightItem=selectedItem;
    document.getElementById('save-prefab-btn').onclick=()=>{const input=document.getElementById('prefab-name-input');if(captureLightPrefab(lightItem,input.value)){input.value='';renderInspector();}};
    for(const axis of ['x','y','z'])bindLightAuthoringField(document.getElementById('f-'+axis),lightItem,'position.'+axis,'number');
    for(const [id,key,type]of [['f-light-enabled','enabled','checkbox'],['f-light-color','color','color'],['f-light-intensity','intensity','number'],['f-light-range','range','number'],['f-light-angle','angle','number']])bindLightAuthoringField(document.getElementById(id),lightItem,key,type);
    for(const axis of ['x','y','z'])bindLightAuthoringField(document.getElementById('f-light-dir-'+axis),lightItem,'direction.'+axis,'number');
    document.getElementById('delete-btn').onclick = deleteSelected;
    document.getElementById('duplicate-btn').onclick = duplicateSelected;
  }
}

// Object References (Track I): a user-friendly display name, editable per
function captureLightPrefab(item,name){
  if(playMode||!item||item.kind!=='light'||!placed.includes(item))return false;
  name=typeof name==='string'?name.trim():'';
  if(!name||name.length>80){showStatus('Choose a Light Prefab name from 1 to 80 characters');return false;}
  const {payload}=buildPrefabPayload(item,name);
  const index=prefabs.findIndex(p=>p.name===name);
  if(index>=0&&JSON.stringify(prefabs[index])===JSON.stringify(payload)&&item.sourcePrefabName===name)return false;
  pushUndo();if(index>=0)prefabs[index]=payload;else prefabs.push(payload);
  item.sourcePrefabName=name;savePrefabs();renderPrefabPalette();showStatus('Saved Light Prefab "'+name+'"');return true;
}

// Object References (Track I): a user-friendly display name, editable per
// item, independent of the stable `id` used internally for references --
// people pick "the Gate" from a dropdown, not "obj47". Wrapping
// renderInspectorBody rather than editing all three kind-specific
// templates keeps this in one place regardless of how many item kinds
// exist.
function insertBeforeInspectorFooter(element) {
  const footerButton = inspectorBody.querySelector('#duplicate-btn, #delete-btn');
  const footer = footerButton && (footerButton.closest('.field-triple') || footerButton);
  if (footer && footer.parentNode === inspectorBody) inspectorBody.insertBefore(element, footer);
  else inspectorBody.appendChild(element);
}

function commitEditedWorldTransform(item) {
  if(!item?.parentId || !hierarchyCapable(item))return;
  const parent=findItemById(item.parentId);if(!parent || !hierarchyCapable(parent))return;
  // Capture the requested world edit before any hierarchy resolution can
  // overwrite it. Resolve only its parent, including the existing socket frame.
  const node=itemLocalNode(item),position=node.position.clone(),rotation=node.quaternion,scale=node.scale.clone();
  resolveWorldTransform(parent);
  const frame=(item.socketName&&resolveSocketSourceTransform(parent,item.socketName))||itemLocalNode(parent);
  const inverse=frame.quaternion.conjugate(),local=inverse.rotateVec3(position.sub(frame.position));
  item.localPosition=new Opus.Vec3(...['x','y','z'].map(axis=>frame.scale[axis]!==0?local[axis]/frame.scale[axis]:0));
  item.localQuat=inverse.multiply(rotation);item.localRotationY=undefined;
  item.localScale=new Opus.Vec3(...['x','y','z'].map(axis=>frame.scale[axis]!==0?scale[axis]/frame.scale[axis]:scale[axis]));
  hierarchyTickToken++;resolveWorldTransform(item);
}

function copyCombatEncounterLibrary(raw) { return JSON.parse(JSON.stringify(Array.isArray(raw)?raw:[])); }
function builtInCombatEncounters() {
  return [['Single opponent',1,1,1],['Staggered trio',3,1,2],['Small group',3,3,.5]].map(([name,totalCount,maxActive,interval])=>({kind:'CombatEncounterTemplate',version:1,name,tuning:{interval,initialDelay:0,radius:0,maxActive,totalCount,startEnabled:false}}));
}
function inspectCombatEncounterTemplate(record) {
  const bad=reason=>({ok:false,reason});
  const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>Object.prototype.hasOwnProperty.call(d,'value'));
  if(!plain(record)||record.kind!=='CombatEncounterTemplate'||record.version!==1||Object.keys(record).some(k=>!['kind','version','name','tuning'].includes(k)))return bad('Unsupported encounter template retained; it cannot be applied.');
  if(typeof record.name!=='string'||!record.name.trim()||record.name!==record.name.trim()||record.name.length>80)return bad('Choose an encounter name from 1 to 80 characters.');
  const t=record.tuning;
  if(!plain(t)||Object.keys(t).some(k=>!['prefabName','tag','interval','initialDelay','radius','maxActive','totalCount','startEnabled'].includes(k)))return bad('Encounter settings must contain only supported Spawner fields.');
  if(!Number.isFinite(t.interval)||t.interval<=0||!Number.isFinite(t.initialDelay)||t.initialDelay<0||!Number.isFinite(t.radius)||t.radius<0||!Number.isSafeInteger(t.maxActive)||t.maxActive<1||!Number.isSafeInteger(t.totalCount)||t.totalCount<1||typeof t.startEnabled!=='boolean')return bad('Templates require finite pacing and positive whole finite counts. Total Count 0 remains available in the ordinary Spawner.');
  if(t.prefabName!==undefined&&(typeof t.prefabName!=='string'||!t.prefabName)||t.tag!==undefined&&(typeof t.tag!=='string'||t.tag.length>80))return bad('Choose a named enemy Prefab and a tag of at most 80 characters.');
  return {ok:true,record:{kind:record.kind,version:1,name:record.name,tuning:{...t}}};
}
function combatEncounterPrefabIssue(name) {
  const matches=prefabs.filter(p=>p?.name===name);
  if(!name||matches.length!==1)return 'Choose one available enemy Prefab; missing or ambiguous references are not rebound.';
  const p=matches[0],assembly=p.records!==undefined;
  if(assembly&&(!Array.isArray(p.records)||!p.records.length))return 'The enemy Prefab assembly needs a non-empty object list; no encounter settings were changed.';
  const records=assembly?p.records:p.record?[p.record]:[],root=records.find(r=>r?.id===p.rootId)||records[0];
  if(!root||root.kind&&root.kind!=='cube'||!root.health||!Number.isFinite(root.health.max)||root.health.max<=0||!Number.isFinite(root.health.current)||root.health.current<=0)return 'Use a whole Cube enemy Prefab with positive authored Health at its root. Basic Enemy is a starting point; stationary targets are allowed.';
  const position=root.position||root.options?.position;
  if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return 'Save a finite XYZ position on the enemy Prefab root before using it in a Spawner. Ordinary placed Prefabs retain their historical supplied-position behavior.';
  try{validateImportedSceneRecords(records,'Encounter enemy Prefab',!assembly);}catch(error){return error.message;}
  if(assembly&&(records.some(r=>!['cube','sprite','tilemap','camera','spawner','emitter','light','path'].includes(r.kind)||typeof r.id!=='string'||!r.id)||new Set(records.map(r=>r.id)).size!==records.length))return 'Use uniquely identified supported objects in the enemy assembly; unknown records remain saved but cannot be spawned by an encounter.';
  return null;
}
function combatEncounterCandidate(item,record,prefabName) {
  const bad=reason=>({ok:false,reason});
  if(playMode)return bad('Stop Play before authoring an encounter.');
  if(!item||item!==selectedItem||item.kind!=='spawner'||!placed.includes(item)||!item.options||Array.isArray(item.options)||Object.values(Object.getOwnPropertyDescriptors(item.options)).some(d=>!Object.prototype.hasOwnProperty.call(d,'value')))return bad('Select the current Spawner before applying an encounter.');
  const state=inspectCombatEncounterTemplate(record);if(!state.ok)return state;
  const name=prefabName===undefined?state.record.tuning.prefabName:prefabName,issue=combatEncounterPrefabIssue(name);if(issue)return bad(issue);
  const tuning={...state.record.tuning,prefabName:name};
  return {ok:true,tuning,changed:Object.keys(tuning).some(k=>item.options[k]!==tuning[k])};
}
function applyCombatEncounterTemplate(item,record,prefabName) {
  const state=combatEncounterCandidate(item,record,prefabName);if(!state.ok||!state.changed)return state;
  pushUndo();Object.assign(item.options,state.tuning);return state;
}
function captureCombatEncounterTemplate(item,name) {
  if(playMode||item!==selectedItem||item?.kind!=='spawner'||!placed.includes(item))return {ok:false,reason:'Select a Spawner and stop Play before saving its encounter.'};
  if(!item.options||typeof item.options!=='object'||Array.isArray(item.options)||Object.values(Object.getOwnPropertyDescriptors(item.options)).some(d=>!Object.prototype.hasOwnProperty.call(d,'value')))return {ok:false,reason:'Retained Spawner options need repair before capture.'};
  const tuning={};for(const key of ['prefabName','tag','interval','initialDelay','radius','maxActive','totalCount','startEnabled'])tuning[key]=item.options[key];
  if(tuning.initialDelay===undefined)tuning.initialDelay=0;if(tuning.startEnabled===undefined)tuning.startEnabled=true;if(tuning.tag===undefined)delete tuning.tag;
  const state=inspectCombatEncounterTemplate({kind:'CombatEncounterTemplate',version:1,name:typeof name==='string'?name.trim():name,tuning});
  if(!state.ok)return state;const candidate=combatEncounterCandidate(item,state.record);if(!candidate.ok)return candidate;
  if(combatEncounterTemplates.length>=128||combatEncounterTemplates.some(r=>r?.name===state.record.name))return {ok:false,reason:'Choose a distinct name; at most 128 project encounter templates.'};
  pushUndo();combatEncounterTemplates.push(state.record);return state;
}
function removeCombatEncounterTemplate(index,expectedRecord=combatEncounterTemplates[index]) {
  if(playMode||!Number.isInteger(index)||index<0||index>=combatEncounterTemplates.length||combatEncounterTemplates[index]!==expectedRecord)return false;
  pushUndo();combatEncounterTemplates.splice(index,1);return true;
}
function renderCombatEncounterLibrary(item) {
  const host=document.createElement('details');host.id='combat-encounter-library';host.open=true;
  const built=builtInCombatEncounters(),choices=[...built,...combatEncounterTemplates.slice(0,128)];
  host.innerHTML=`<summary>Combat encounter templates</summary><p class="field-help">Choose a whole enemy Prefab, preview a finite recipe, then Apply. Instances use this ordinary Spawner, not a separate wave system.</p><label>Template<select id="encounter-template-select" class="field-input"><option value="">Choose a template…</option>${choices.map((r,i)=>`<option value="${i}">${i<built.length?'Starter: ':'Saved: '}${escapeHtml(typeof r?.name==='string'?r.name:'Unavailable retained record')}</option>`).join('')}</select></label><label>Enemy Prefab<select id="encounter-template-prefab" class="field-input"><option value="">Choose enemy Prefab…</option>${prefabs.filter(p=>!combatEncounterPrefabIssue(p.name)).map(p=>`<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')}</select></label><p id="encounter-template-preview" class="field-help" role="status">Choose a template to review its pacing and limits.</p><button id="encounter-template-apply" class="toolbar-btn" disabled>Apply encounter — one Undo step</button><label>Save current encounter as<input id="encounter-template-name" class="field-input" maxlength="80" placeholder="e.g. Courtyard sentries"></label><div class="camera-template-actions"><button id="encounter-template-capture" class="toolbar-btn">Save encounter template</button><button id="encounter-template-remove" class="toolbar-btn" disabled>Remove saved template</button></div><p class="field-help">Position, existing tag (unless saved in the template), parameters, Player and other objects stay unchanged. Starters wait for Start Spawner in visual logic. Initial spawn uses Initial Delay; later spawns use Interval and Max Active. Root height comes from the Prefab. Max Active counts roots still in the scene, including dying actors until removed, not visible tag members. Templates do not emit an all-enemies-defeated event. Duplicate the configured Spawner or capture a whole Prefab assembly for independent encounters.</p>`;
  insertBeforeInspectorFooter(host);
  const q=id=>host.querySelector('#encounter-template-'+id),chosen=()=>q('select').value===''?null:choices[Number(q('select').value)];
  q('prefab').value=item.options.prefabName||'';
  const preview=()=>{const record=chosen(),state=record?combatEncounterCandidate(item,record,q('prefab').value):null;q('apply').disabled=!state?.ok||!state.changed;q('remove').disabled=playMode||q('select').value===''||Number(q('select').value)<built.length;q('preview').textContent=!record?'Choose a template to review its pacing and limits.':!state.ok?state.reason:`${record.name}: ${state.tuning.totalCount} total roots, at most ${state.tuning.maxActive} active; interval ${state.tuning.interval}s, initial delay ${state.tuning.initialDelay}s, radius ${state.tuning.radius}. ${state.tuning.startEnabled?'Starts enabled.':'Waits for Start Spawner.'} ${state.changed?'Ready to Apply.':'Already identical; no history entry.'}`;};
  q('select').onchange=()=>{const record=chosen();if(record?.tuning?.prefabName!==undefined)q('prefab').value=record.tuning.prefabName;preview();};q('prefab').onchange=preview;
  for(const id of ['select','prefab','name','capture'])q(id).disabled=playMode;
  q('apply').onclick=()=>{const result=applyCombatEncounterTemplate(item,chosen(),q('prefab').value);if(result.ok&&result.changed){renderInspector();showStatus('Encounter settings applied; one Undo step.');}else q('preview').textContent=result.reason||'Encounter unchanged; no history entry.';};
  q('capture').onclick=()=>{const result=captureCombatEncounterTemplate(item,q('name').value);if(result.ok){renderInspector();showStatus('Encounter template saved in this project.');}else q('preview').textContent=result.reason;};
  q('remove').onclick=()=>{if(removeCombatEncounterTemplate(Number(q('select').value)-built.length,chosen()))renderInspector();};preview();
}
function changeSpawnerOption(item,key,value,beforeChange=pushUndo) {
  const bad=reason=>({ok:false,reason});
  if(playMode)return bad('Stop Play before editing a Spawner.');
  if(!item||item!==selectedItem||item.kind!=='spawner'||!placed.includes(item))return bad('Select the current Spawner before editing.');
  const opts=item.options;if(!opts||typeof opts!=='object'||Array.isArray(opts)||Object.values(Object.getOwnPropertyDescriptors(opts)).some(d=>!Object.prototype.hasOwnProperty.call(d,'value')))return bad('Retained Spawner options need repair.');
  const axis=key.startsWith('position.')?key.slice(9):null;
  if(axis&&!['x','y','z'].includes(axis))return bad('Choose a Spawner position axis.');
  if(axis||['interval','initialDelay','radius','maxActive','totalCount'].includes(key)){
    if(!Number.isFinite(value)||!axis&&(key==='interval'?value<=0:value<(key==='maxActive'?1:0))||['maxActive','totalCount'].includes(key)&&!Number.isSafeInteger(value))return bad('Choose a finite valid Spawner value; counts must be whole numbers.');
  }else if(key==='prefabName'){
    if(typeof value!=='string'||value&&prefabs.filter(p=>p?.name===value).length!==1)return bad('Choose one available Prefab.');
  }else if(key==='tag'){if(typeof value!=='string')return bad('Choose a text spawn tag.');value=value.trim();}
  else if(key==='startEnabled'){if(typeof value!=='boolean')return bad('Choose whether the Spawner starts enabled.');}
  else return bad('Choose a supported Spawner field.');
  if(axis&&(!opts.position||!item.entity?.position))return bad('Retained Spawner position needs repair.');
  if((axis?opts.position[axis]:opts[key])===value)return {ok:true,unchanged:true};
  beforeChange();
  if(axis){opts.position[axis]=value;item.entity.position[axis]=value;commitEditedWorldTransform(item);}
  else opts[key]=value;
  return {ok:true};
}
function bindSpawnerAuthoringField(control,item,key,type) {
  let captured=false;control.disabled=playMode;
  const discrete=type==='checkbox'||type==='select';
  const commit=()=>{
    const value=type==='checkbox'?control.checked:type==='number'?(control.value.trim()?Number(control.value):NaN):control.value;
    const result=changeSpawnerOption(item,key,value,()=>{if(discrete||!captured){pushUndo();captured=true;}});
    if(!result.ok)showStatus(result.reason);
  };
  if(discrete)control.onchange=commit;else{control.oninput=commit;control.addEventListener('blur',()=>{captured=false;});}
}
function bindCoreAuthoringInput(control, onInput) {
  let changed=false;
  control.onfocus=null; // Focusing another untouched field is not a mutation.
  control.oninput=(event)=>{if(!changed){pushUndo();changed=true;}onInput?.(event);if(typeof selectedItem!=='undefined')commitEditedWorldTransform(selectedItem);};
  control.addEventListener('blur',()=>{changed=false;});
}

function labelNativeCoreAuthoringControls() {
  // Explicit names for the existing native Transform/Visual controls only.
  // Schema-rendered component fields retain their own labels and ownership.
  const names = {
    '#f-x': 'Position X', '#f-y': 'Position Y', '#f-z': 'Position Z',
    '#f-rotation-x': 'Rotation X in degrees', '#f-rotation-y': 'Rotation Y in degrees', '#f-rotation-z': 'Rotation Z in degrees',
    '#f-scale-x': 'Scale X', '#f-scale-y': 'Scale Y', '#f-scale-z': 'Scale Z',
    '#f-color': 'Visual color', '#f-texture': 'Visual texture',
    '[data-sprite-transform="px"]': 'Position X', '[data-sprite-transform="py"]': 'Position Y', '[data-sprite-transform="pz"]': 'Position Z',
    '[data-sprite-transform="rx"]': 'Rotation X in degrees', '[data-sprite-transform="ry"]': 'Rotation Y in degrees', '[data-sprite-transform="rz"]': 'Rotation Z in degrees',
    '[data-sprite-transform="sx"]': 'Scale X', '[data-sprite-transform="sy"]': 'Scale Y', '[data-sprite-transform="sz"]': 'Scale Z',
  };
  for (const [selector, name] of Object.entries(names)) inspectorBody.querySelector(selector)?.setAttribute('aria-label', name);
}
function mountIntrinsicCoreComponentSlots() {
  labelNativeCoreAuthoringControls();
  const groups=[['transform', selectedItem.kind==='sprite' ? ['[data-sprite-transform="px"]','[data-sprite-transform="rx"]','[data-sprite-transform="sx"]'] : ['#f-x','#f-rotation-x','#f-scale-x']],['visual',['#f-color','#f-texture']]];
  for(const [id,selectors]of groups){
    const schema=OpusAuthoring.registry.get(id);
    if(!schema || !OpusAuthoring.eligibilityMatches(schema,selectedItem))continue;
    const rows=[...new Set(selectors.map(selector=>inspectorBody.querySelector(selector)?.closest('.field-row')).filter(Boolean))];
    if(!rows.length)continue;
    const slot=document.createElement('div');slot.dataset.schemaSlot=id;slot.dataset.componentId=id;slot.className='schema-component-section';
    const heading=document.createElement('div');heading.className='field-row';
    const label=document.createElement('label');label.textContent=schema.displayName;
    const help=document.createElement('p');help.className='field-help schema-component-help';help.textContent=schema.help;heading.append(label,help);
    rows[0].before(slot);slot.append(heading,...rows);
    if(selectedItem.kind==='cube')slot.querySelectorAll('input[type="number"],#f-color').forEach(control=>bindCoreAuthoringInput(control,control.oninput));
    // Keep the one existing native control set and its public Transform/Visual
    // handlers. Registration adds ownership/discovery, not a competing editor.
    OpusAuthoring.ensureComponent(selectedItem,id);
  }
}

function ensureRegisteredComponentSlots() {
  for (const schema of OpusAuthoring.registry.list()) {
    if (!OpusAuthoring.eligibilityMatches(schema, selectedItem) || !OpusAuthoring.componentExists(schema, selectedItem)) continue;
    if (inspectorBody.querySelector(`[data-schema-slot="${schema.id}"]`)) continue;
    const slot = document.createElement('div');
    slot.dataset.schemaSlot = schema.id;
    insertBeforeInspectorFooter(slot);
  }
}

function syncTriggerCollider2DInspectorFields() {
  const slot = inspectorBody.querySelector('[data-schema-slot="trigger-collider-2d"]');
  const component = selectedItem && selectedItem.components && selectedItem.components['trigger-collider-2d'];
  if (!slot || !component) return;
  const row = (key) => slot.querySelector(`[data-component-field-row="${key}"], [data-field-row="${key}"]`);
  const size = row('size'); const radius = row('radius');
  if (size) size.hidden = component.shape !== 'box';
  if (radius) radius.hidden = component.shape !== 'circle';
}
function syncBody2DInspectorFields() {
  const slot = inspectorBody.querySelector('[data-schema-slot="body-2d"]');
  const component = selectedItem && selectedItem.components && selectedItem.components['body-2d'];
  if (!slot || !component) return;
  for (const input of slot.querySelectorAll('[data-component-field="linearVelocity"]')) {
    input.disabled = component.type !== 'kinematic';
    input.title = component.type === 'kinematic' ? 'World units per second' : 'Retained and ignored while Static';
  }
  const help = slot.querySelector('[data-body-2d-role-help]');
  if (help) help.textContent = component.type === 'kinematic'
    ? 'Kinematic Bodies move using world X/Y velocity and stop or slide against Static Bodies. They do not respond to other Kinematic Bodies.'
    : 'Static Bodies are solid obstacles for Kinematic Bodies. The Body solver never moves them; saved velocity is retained but inactive.';
}

function removeRegisteredComponent(schemaId) {
  if (playMode) { showStatus('Stop Play before changing Components'); return; }
  const target=selectedItem;
  const result=OpusAuthoring.removeComponent(target,schemaId,{onBeforeChange:()=>pushUndo(),onChange:()=>{
    if(schemaId==='trigger-collider-2d') trigger2DObjects.delete(target);
    if(schemaId==='body-2d') body2DObjects.delete(target);
    if(body2DManager) body2DManager.clearCharacterCollision2DState(target.id);
  }});
  if(!result.ok){showStatus(result.reason);return;}
  syncColliderViz(); renderInspector(); syncCollider2DOverlay(); validateCurrentProject();
  showStatus(`${result.schema.displayName} removed · Undo restores its settings`);
}
function mountComponentLifecycleControls() {
  const schemas=OpusAuthoring.orderedComponents(selectedItem);
  const first=inspectorBody.querySelector('[data-schema-slot]'); if(!first) return;
  const anchor=document.createComment('Component presentation order'); first.before(anchor);
  schemas.forEach((schema,index)=>{
    const slot=inspectorBody.querySelector(`[data-schema-slot="${schema.id}"]`); if(!slot) return;
    anchor.parentNode.insertBefore(slot,anchor);
    const state=OpusAuthoring.getComponentRemovability(selectedItem,schema.id);
    const tools=document.createElement('div');tools.className='component-lifecycle-tools';
    tools.innerHTML=`<div class="field-triple"><button type="button" class="toolbar-btn" data-component-up="${escapeHtml(schema.id)}" aria-label="Move ${escapeHtml(schema.displayName)} up"${index===0?' disabled':''}>↑ Up</button><button type="button" class="toolbar-btn" data-component-down="${escapeHtml(schema.id)}" aria-label="Move ${escapeHtml(schema.displayName)} down"${index===schemas.length-1?' disabled':''}>↓ Down</button><button type="button" class="toolbar-btn" data-component-remove="${escapeHtml(schema.id)}" aria-label="Remove ${escapeHtml(schema.displayName)}"${state.ok?'':' disabled'}>Remove</button></div><p class="field-help">${escapeHtml(state.ok?'Order affects Inspector presentation only. Remove is one Undo step; other Components are retained.':state.reason)}</p>`;
    slot.prepend(tools);
    if(schema.inspector.nativeControls){const heading=slot.querySelector(':scope > .field-row');if(heading)heading.after(tools);}
    tools.querySelector('[data-component-remove]').onclick=()=>removeRegisteredComponent(schema.id);
    for(const [selector,direction]of [['[data-component-up]',-1],['[data-component-down]',1]]) tools.querySelector(selector).onclick=()=>{
      if(playMode){showStatus('Stop Play before changing Components');return;}
      const result=OpusAuthoring.moveComponent(selectedItem,schema.id,direction,{onBeforeChange:()=>pushUndo()});
      if(!result.ok){showStatus(result.reason);return;}
      renderInspector(); showStatus(`${schema.displayName} moved ${direction<0?'up':'down'} in Inspector`);
      inspectorBody.querySelector(`[data-schema-slot="${schema.id}"] [data-component-${direction<0?'up':'down'}]`)?.focus();
    };
    // Retain historical selectors for integrations, but one canonical mutation
    // path and one visible Remove control replace competing role-specific buttons.
    slot.querySelectorAll('[data-collider-remove],[data-body-remove],[data-character-remove],[data-one-way-remove],[data-moving-platform-remove]').forEach(button=>{
      button.hidden=true;button.onclick=()=>removeRegisteredComponent(schema.id);
    });
  });
  anchor.remove();
}

function mountComponentPresetWorkflow() {
  if (typeof OpusComponentPresets === 'undefined' || !selectedItem || selectedItems.size > 1) return;
  const target = selectedItem;
  function store(preset) {
    const index = componentPresets.findIndex(entry => entry?.name === preset.name);
    if (index >= 0 && !confirm(`Replace saved settings "${preset.name}"? Existing Objects will not change.`)) return;
    if (index < 0 && componentPresets.length >= 128) { showStatus('At most 128 saved component presets. Existing data was not changed.'); return; }
    pushUndo();
    if (index < 0) componentPresets.push(preset); else componentPresets[index] = preset;
    renderInspector(); showStatus(`Saved settings "${preset.name}". Apply them to another Object or export JSON.`);
  }
  inspectorBody.querySelectorAll('[data-schema-slot]').forEach(slot => {
    const id = slot.dataset.schemaSlot, schema = OpusAuthoring.registry.get(id);
    if (!schema?.addable) return;
    const controls = document.createElement('details'); controls.className = 'field-row'; controls.dataset.componentPresetCapture = id;
    controls.innerHTML = `<summary>Save Settings as Preset</summary><label>Reusable ${escapeHtml(schema.displayName)} settings<input type="text" class="field-input" data-component-preset-name="${escapeHtml(id)}" aria-label="${escapeHtml(schema.displayName)} preset name" placeholder="Preset name" maxlength="80"></label><button type="button" class="toolbar-btn" data-component-preset-save="${escapeHtml(id)}">Save Settings as Preset</button>`;
    controls.querySelector('button').onclick = () => {
      if (playMode) { showStatus('Stop Play before saving authored settings.'); return; }
      const result = OpusComponentPresets.capture(target, id, controls.querySelector('input').value);
      if (!result.ok) { showStatus(result.reason); return; } store(result.preset);
    };
    slot.append(controls);
  });
  const panel = document.createElement('details'); panel.id = 'component-preset-library'; panel.open = true;
  panel.innerHTML = `<summary>Saved Component Settings · ${componentPresets.length}</summary><p class="field-help">Reuse one component's settings without copying geometry or linking Objects. Gameplay Presets configure complete roles; Prefabs reuse Objects. Sharing settings with project-specific references is not supported yet; built-in Default collision filtering is portable.</p><label>Apply Saved Settings<select class="field-input" id="component-preset-select"><option value="">Choose saved settings</option>${componentPresets.slice(0,128).map((entry,index)=>`<option value="${index}">${escapeHtml(entry?.name || 'Unavailable preset')} · ${escapeHtml(OpusAuthoring.registry.get(entry?.componentId)?.displayName || 'Unavailable component')}</option>`).join('')}</select></label><div id="component-preset-preview" class="field-help" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;margin:8px 0"></div><div style="display:flex;flex-wrap:wrap;gap:6px"><button class="toolbar-btn" type="button" id="component-preset-apply" disabled>Apply Saved Settings</button><button class="toolbar-btn" type="button" id="component-preset-export" disabled>Export Preset JSON</button><button class="toolbar-btn" type="button" id="component-preset-import">Import Preset JSON</button></div><input id="component-preset-file" type="file" accept=".json,application/json" hidden>`;
  insertBeforeInspectorFooter(panel);
  panel.querySelector('label').className = 'field-row';
  const select=panel.querySelector('select'), apply=panel.querySelector('#component-preset-apply'), output=panel.querySelector('#component-preset-export');
  const chosen=()=> select.value === '' ? null : componentPresets[Number(select.value)];
  select.onchange=()=>{
    const preset=chosen(), state=preset?OpusComponentPresets.inspect(preset):null;
    const formatValue=(field,value)=>typeof value==='boolean'?(value?'On':'Off'):Array.isArray(value)?value.join(', '):field.choiceLabels?.[value] || (value===null||value===undefined||value===''?'None':String(value));
    const settings=state?.ok?state.schema.fields.filter(field=>Object.prototype.hasOwnProperty.call(preset.record,field.key)).map(field=>`${field.label || field.key}: ${formatValue(field,preset.record[field.key])}`).join('\n'):'';
    panel.querySelector('#component-preset-preview').textContent=!state?'Choose saved settings.':state.ok?`${state.schema.displayName} · ${preset.name}\n${settings}\nOnly this component changes. Replacing existing settings requires confirmation.`:state.reason+' The retained record is not changed.';
    apply.disabled=!state?.ok||playMode; output.disabled=!preset;
  };
  apply.onclick=()=>{
    if(playMode)return;
    const preset=chosen(), schema=OpusAuthoring.registry.get(preset?.componentId);
    if(!preset||!schema)return;
    if(OpusAuthoring.componentExists(schema,target)&&!confirm(`Replace ${schema.displayName} settings on "${itemDisplayName(target)}"? Other components and Prefab links stay unchanged.`))return;
    const result=OpusComponentPresets.apply(target,preset,{onBeforeChange:()=>pushUndo(),onChange:(schema)=>{if(schema.id==='trigger-collider-2d')trigger2DObjects.add(target);if(schema.id==='body-2d')body2DObjects.add(target);syncColliderViz();syncCollider2DOverlay();if(target.kind==='sprite'){syncSpriteRenderer(target);syncSpriteDirectManipulation();}}});
    if(!result.ok){showStatus(result.reason);return;} renderInspector(); showStatus(`Applied "${preset.name}" in one Undo step.`);
  };
  output.onclick=()=>{const preset=chosen();if(preset)downloadTextFile(JSON.stringify(preset,null,2),bundleSafeName(preset.name)+'.component-preset.json');};
  const file=panel.querySelector('input[type="file"]');
  panel.querySelector('#component-preset-import').onclick=()=>file.click();
  file.onchange=async()=>{
    const selected=file.files[0];file.value='';if(!selected)return;
    if(playMode){showStatus('Stop Play before importing settings.');return;}
    if(selected.size>65536){showStatus('Choose a component preset JSON file smaller than 64 KiB.');return;}
    try {const state=OpusComponentPresets.parse(await selected.text());if(!state.ok){showStatus(state.reason);return;}
      if(confirm(`Import "${state.preset.name}" (${state.schema.displayName}) into this project's saved settings? No Object changes until you apply it.`))store(state.preset);
    } catch {showStatus('Preset file could not be read. Existing data was not changed.');}
  };
}

function mountAddComponentWorkflow() {
  const workflow = document.createElement('div');
  workflow.className = 'add-component-workflow';
  const hasComponent = OpusAuthoring.registry.list().some((schema) => OpusAuthoring.componentExists(schema, selectedItem));
  workflow.innerHTML = `${hasComponent ? '' : '<div class="onboarding-empty">No Components yet. Add Component attaches reusable data; Gameplay Preset configures a complete role.</div>'}<button type="button" id="add-component-btn" class="toolbar-btn" aria-haspopup="dialog" aria-expanded="false">＋ Add Component</button>
    <div id="add-component-picker" class="add-component-picker" role="dialog" aria-modal="true" aria-labelledby="add-component-title" hidden>
      <div class="add-component-dialog">
        <div class="add-component-title-row"><strong id="add-component-title">Add Component</strong><button type="button" data-add-component-close aria-label="Close Add Component">✕</button></div>
        <div class="add-component-result-help">Components keep their settings with this Object. Choices below use the same registered definitions as the Inspector, Save and exports.</div>
        <input type="search" data-add-component-search role="combobox" aria-label="Search components" aria-controls="add-component-results" aria-autocomplete="list" aria-expanded="true" placeholder="Search components..." autocomplete="off">
        <div id="add-component-results" class="add-component-results" role="listbox" aria-label="Components"></div>
      </div>
    </div>`;
  const lastSlot = [...inspectorBody.querySelectorAll('[data-schema-slot]')].pop();
  if (lastSlot) lastSlot.after(workflow);
  else insertBeforeInspectorFooter(workflow);

  const opener = workflow.querySelector('#add-component-btn');
  const picker = workflow.querySelector('#add-component-picker');
  const search = workflow.querySelector('[data-add-component-search]');
  const results = workflow.querySelector('#add-component-results');
  let activeIndex = -1;

  const enabledResults = () => [...results.querySelectorAll('[data-add-component-id]:not(:disabled)')];
  const setActive = (next) => {
    const rows = enabledResults();
    rows.forEach((row) => { row.classList.remove('active'); row.setAttribute('aria-selected', 'false'); });
    if (rows.length === 0) { activeIndex = -1; search.removeAttribute('aria-activedescendant'); return; }
    activeIndex = (next + rows.length) % rows.length;
    rows[activeIndex].classList.add('active');
    rows[activeIndex].setAttribute('aria-selected', 'true');
    search.setAttribute('aria-activedescendant', rows[activeIndex].id);
    rows[activeIndex].scrollIntoView({ block: 'nearest' });
  };

  const add = (schemaId) => {
    const target = selectedItem;
    const result = OpusAuthoring.addComponent(target, schemaId, {
      onBeforeChange: () => pushUndo(),
      onChange: (schema) => {
        if (schema.id === 'scene-collection') renderSceneList();
        if (['box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d'].includes(schema.id)) syncCollisionMaskVisibility(inspectorBody.querySelector(`[data-schema-slot="${schema.id}"]`), selectedItem.components[schema.id]);
        if (schema.id === 'trigger') syncColliderViz();
        if (schema.id === 'box-collider-2d' || schema.id === 'circle-collider-2d' || schema.id === 'trigger-collider-2d' || schema.id === 'one-way-platform-2d') { if (schema.id !== 'one-way-platform-2d') activeCollider2DComponentId = schema.id; syncCollider2DOverlay(); }
        if (schema.id === 'trigger-collider-2d') trigger2DObjects.add(target);
        if (schema.id === 'body-2d') body2DObjects.add(target);
      },
    });
    if (!result.ok) { showStatus(result.reason); renderResults(search.value); return; }
    validateCurrentProject();
    showStatus(`${result.schema.displayName} added`);
    renderInspector();
    requestAnimationFrame(() => {
      const section = inspectorBody.querySelector(`[data-schema-slot="${result.schema.id}"]`);
      (section || document.getElementById('add-component-btn'))?.focus();
    });
  };

  const renderResults = (query) => {
    const candidates = OpusAuthoring.discoverComponents(selectedItem, query);
    const all = OpusAuthoring.discoverComponents(selectedItem, '');
    if (!query.trim() && all.length > 0 && all.every((entry) => !entry.addable)) {
      results.innerHTML = '<div class="add-component-empty">All available components are already on this object.</div>';
      setActive(-1);
      return;
    }
    if (candidates.length === 0) {
      results.innerHTML = `<div class="add-component-empty">${query.trim() ? 'No matching components.' : 'No components are available for this object type.'}</div>`;
      setActive(-1);
      return;
    }
    const groups = new Map();
    for (const entry of candidates) {
      if (!groups.has(entry.schema.category)) groups.set(entry.schema.category, []);
      groups.get(entry.schema.category).push(entry);
    }
    results.innerHTML = [...groups].map(([category, entries]) => `<section class="add-component-category" aria-label="${escapeHtml(category)}"><div class="add-component-category-title">${escapeHtml(category)}</div>${entries.map((entry) => `<button type="button" role="option" id="add-component-option-${escapeHtml(entry.schema.id)}" data-add-component-id="${escapeHtml(entry.schema.id)}" data-component-record-version="${entry.contract.version}" data-component-owner="${escapeHtml(entry.contract.serialization.owner)}" aria-selected="false"${entry.addable ? '' : ' disabled aria-disabled="true"'}><span class="add-component-result-title">${entry.schema.icon ? `<span aria-hidden="true">${escapeHtml(entry.schema.icon)}</span> ` : ''}${escapeHtml(entry.contract.displayName)}</span><span class="add-component-result-help">${escapeHtml(entry.contract.help)}</span>${entry.reason ? `<span class="add-component-result-reason">${escapeHtml(entry.reason)}</span>` : ''}</button>`).join('')}</section>`).join('');
    results.querySelectorAll('[data-add-component-id]:not(:disabled)').forEach((button) => button.addEventListener('click', () => add(button.dataset.addComponentId)));
    setActive(0);
  };

  const close = (returnFocus = true) => {
    picker.hidden = true;
    opener.setAttribute('aria-expanded', 'false');
    if (returnFocus) opener.focus();
  };
  const open = () => {
    picker.hidden = false;
    opener.setAttribute('aria-expanded', 'true');
    search.value = '';
    renderResults('');
    search.focus();
  };

  opener.addEventListener('click', open);
  picker.querySelector('[data-add-component-close]').addEventListener('click', () => close());
  picker.addEventListener('click', (event) => { if (event.target === picker) close(); });
  search.addEventListener('input', () => renderResults(search.value));
  picker.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(activeIndex + 1); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(activeIndex - 1); return; }
    if (event.key === 'Enter' && event.target === search) {
      const row = enabledResults()[activeIndex];
      if (row) { event.preventDefault(); add(row.dataset.addComponentId); }
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...picker.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}

// Phase 008: gameplay presets are recipes over the same ordinary fields,
// behaviors, clips, and schema components the Inspector already exposes.
// This adapter is intentionally small: the registry remains DOM/runtime
// independent and cannot become a second gameplay engine.
function legacyAiPresetCandidate(item,patch) {
  const bad=reason=>({ok:false,reason});
  if(playMode||item?.kind!=='cube'||!item.entity?.position)return bad('Choose an editable Cube.');
  const attached=Object.prototype.hasOwnProperty.call(item.components||{},'ai-brain');
  const raw=attached?OpusAiBrain.inspect(item.components['ai-brain']):null;
  if(attached&&(!raw.ok||!raw.record.enabled))return bad('Repair or explicitly enable the retained AI Brain before applying this preset.');
  const captured=item.entity.ai?OpusAiBrain.captureLegacy(item.entity.ai):{ok:true,record:OpusAiBrain.create(item.entity.position)};
  if(!captured.ok)return bad(captured.reason);
  const p=item.entity.position;
  const config={...JSON.parse(JSON.stringify(captured.record.config)),...patch,base:[p.x,p.y,p.z]};
  const checked=OpusAiBrain.inspect({...captured.record,config});
  return checked.ok?{ok:true,record:checked.record}:bad(checked.reason);
}
function gameplayPresetAdapter() {
  return {
    preflightAiPreset:(target,patch)=>legacyAiPresetCandidate(target,patch),
    aiMovementPresetCandidate:(target,id,input)=>aiMovementPresetCandidate(target,id,input),
    applyAiMovementPreset:(target,id,input)=>applyAiMovementPreset(target,id,input),
    aiInvestigationPresetCandidate:(target,id,input)=>aiInvestigationPresetCandidate(target,id,input),
    applyAiInvestigationPreset:(target,id,input)=>applyAiInvestigationPreset(target,id,input),
    topdown2DCandidate: target => topdown2DPlayerCandidate(target),
    applyTopdown2D: target => applyTopdown2DPlayerSetup(target),
    platformerCandidate: target => platformerPlayerCandidate(target),
    applyPlatformer: target => applyPlatformerPlayerSetup(target),
    signalDefinition:id=>OpusSignals.find(signalDefinitions,id),
    position: (item) => item.entity.position,
    setObject: (item, patch) => Object.assign(item, patch),
    setVisual: (item, patch) => {
      if (patch.color) item.entity.color = patch.color.slice();
      if (patch.unlit !== undefined) item.entity.unlit = patch.unlit;
      if (patch.spin !== undefined) item.entity.spin = patch.spin;
      if (patch.solid !== undefined) item.entity.solid = patch.solid;
    },
    ensureTag: (item, tag) => { item.tags = item.tags || []; if (!item.tags.includes(tag)) item.tags.push(tag); },
    setAi: (item, patch) => {
      const state=legacyAiPresetCandidate(item,patch);
      if(!state.ok)throw new Error(state.reason);
      const config=JSON.parse(JSON.stringify(state.record.config));
      item.entity.ai={...config,base:new Opus.Vec3(...config.base)};
      item.components=item.components||{};item.components['ai-brain']=state.record;
    },
    ensureComponent: (item, schemaId, values) => {
      const component = OpusAuthoring.ensureComponent(item, schemaId);
      if (!component) return null;
      Object.assign(component, values);
      if (schemaId === 'health') item.health = { max: component.max, current: component.current };
      return component;
    },
    upsertBehavior: (item, action, definition) => {
      item.behaviors = item.behaviors || [];
      let behavior = item.behaviors.find((entry) => entry.action === action && entry.trigger === definition.trigger && entry.sourcePreset === definition.sourcePreset);
      if (!behavior) { behavior = { trigger: definition.trigger, action, sourcePreset: definition.sourcePreset, params: {} }; item.behaviors.push(behavior); }
      behavior.params = JSON.parse(JSON.stringify(definition.params || {}));
      if(definition.eventRef!==undefined)behavior.eventRef=JSON.parse(JSON.stringify(definition.eventRef));
      // Collapse only exact role duplicates. Unrelated actions and triggers
      // remain untouched, including creator-authored behavior ordering.
      let found = false;
      item.behaviors = item.behaviors.filter((entry) => {
        if (entry.action !== action || entry.trigger !== definition.trigger || entry.sourcePreset !== definition.sourcePreset) return true;
        if (!found) { found = true; return true; }
        return false;
      });
      return behavior;
    },
    removeBehavior: (item, action, sourcePreset) => { item.behaviors = (item.behaviors || []).filter((entry) => entry.action !== action || entry.sourcePreset !== sourcePreset); },
    upsertClip: (item, clip) => {
      item.animationClips = item.animationClips || [];
      const index = item.animationClips.findIndex((entry) => entry.name === clip.name);
      if (index === -1) item.animationClips.push(JSON.parse(JSON.stringify(clip)));
      else item.animationClips[index] = JSON.parse(JSON.stringify(clip));
    },
  };
}

function pickupSetupCandidate(item,input) {
  const bad=reason=>({ok:false,reason});
  if(playMode||!item||item!==selectedItem||!placed.includes(item)||!['cube','sprite'].includes(item.kind)||!item.entity)return bad('Select an editable Cube or Sprite; stop Play first.');
  if(!input||!['interact','trigger2d'].includes(input.mode))return bad('Choose an activation method.');
  const definitions=currentItemDefs.filter(d=>d?.id===input.itemRef);
  if(definitions.length!==1||typeof input.itemRef!=='string'||['__proto__','constructor','prototype'].includes(input.itemRef))return bad('Choose one available named Item in Project → Items.');
  const def=definitions[0],capacity=def.stackable===false?1:def.maxStack==null?99:def.maxStack;
  if(!Number.isSafeInteger(capacity)||capacity<1||!Number.isSafeInteger(input.quantity)||input.quantity<1||input.quantity>1000||input.quantity>capacity)return bad('Quantity must be a whole number that fits the Item stack capacity (at most1000).');
  if(typeof input.removeOnCollect!=='boolean')return bad('Choose the removal policy.');
  const components=item.components===undefined?{}:item.components;
  if(!components||typeof components!=='object'||Array.isArray(components)||Object.values(Object.getOwnPropertyDescriptors(components)).some(d=>!Object.prototype.hasOwnProperty.call(d,'value')))return bad('Repair retained component data before guided setup.');
  for(const id of input.mode==='interact'?['pickup','interactable']:['pickup'])if(Object.prototype.hasOwnProperty.call(components,id)&&(!components[id]||typeof components[id]!=='object'||Array.isArray(components[id])||components[id].version!==1))return bad('Repair the retained '+id+' component before guided setup.');
  if(item.behaviors!==undefined&&!Array.isArray(item.behaviors))return bad('Repair retained Behaviors before guided setup.');
  const trigger=input.mode==='interact'?'interact':OpusTrigger2D.ENTER;
  const grants=(item.behaviors||[]).map((b,index)=>({b,index})).filter(({b})=>b?.trigger===trigger&&b.action==='collectPickup');
  if(grants.length>1||grants.some(({b})=>{const p=b.params||{};return p.targetId&&p.targetId!==item.id;}))return bad('Existing collection wiring is ambiguous or targets another Object; keep it and configure manually.');
  let collectorRef=null;
  if(input.mode==='interact'){
    if(!Number.isFinite(input.range)||input.range<=0||input.range>100||typeof input.prompt!=='string'||input.prompt.length>120)return bad('Choose a finite reach up to100 and a prompt up to120characters.');
  }else{
    const collector=placed.find(o=>o.id===input.collectorRef);
    if(!collector||collector===item||placed.filter(o=>o.id===input.collectorRef).length!==1)return bad('Choose the exact placed collector Object.');
    const triggerShape=OpusTrigger2D.resolveTriggerWorldShape(item,components['trigger-collider-2d']),shapes=OpusCollider2D.enumerateCollider2DWorldShapes(collector);
    if(!triggerShape||!shapes.length)return bad('Author an enabled Trigger Collider2D here and Box/Circle Collider2D on the collector first.');
    if(!shapes.some(shape=>OpusCollisionFilter2D.allows(triggerShape,shape,OpusCollisionFilter2D.validLayerIds(collisionLayers))))return bad('Current collision filters reject this collector; review them explicitly.');
    collectorRef=collector.id;
  }
  const candidate={...item,components:JSON.parse(JSON.stringify(components))};
  const pickup=OpusAuthoring.ensureComponent(candidate,'pickup');if(!pickup)return bad('Pickup is unavailable for this Object.');
  Object.assign(pickup,{enabled:true,itemRef:input.itemRef,quantity:input.quantity,collectorRef,removeOnCollect:input.removeOnCollect});
  if(input.mode==='interact'){const interaction=OpusAuthoring.ensureComponent(candidate,'interactable');if(!interaction)return bad('Interactable is unavailable.');Object.assign(interaction,{enabled:true,range:input.range,prompt:input.prompt});}
  const behavior=grants.length?grants[0].b:{trigger,action:'collectPickup',params:{},sourcePreset:'item-pickup-setup'};
  const kept=(item.behaviors||[]).filter(b=>!(b?.action==='collectPickup'&&b.sourcePreset==='item-pickup-setup'&&b.trigger!==trigger));
  const behaviors=grants.length?kept:[...kept,behavior];
  const changed=JSON.stringify(candidate.components)!==JSON.stringify(components)||JSON.stringify(behaviors)!==JSON.stringify(item.behaviors||[]);
  return {ok:true,changed,components:candidate.components,behaviors,definition:def,trigger};
}
function applyPickupSetup(item,input) {
  const state=pickupSetupCandidate(item,input);if(!state.ok||!state.changed)return state;
  pushUndo();item.components=state.components;item.behaviors=state.behaviors;return state;
}
function inspectEnvironmentZone(item) {
  const all=item?.behaviors||[], actions=new Set(['setFogZone','setAmbientAudio']);
  const zones=all.filter(b=>actions.has(b?.action));
  const managed=zones.filter(b=>b.sourcePreset==='environment-zone-setup');
  if(zones.length!==managed.length)return {ok:false,reason:'Existing custom zone Actions are retained. Review their Enter/Exit logic before using setup.'};
  if(!managed.length)return {ok:true,mode:'none',managed};
  const enter=managed.find(b=>b.trigger==='enter'),exit=managed.find(b=>b.trigger==='exit');
  if(managed.length!==2||!enter||!exit||enter.action!==exit.action||!enter.params||!exit.params)return {ok:false,reason:'Saved zone setup is ambiguous; repair the explicit Behaviors first.'};
  const key=enter.action==='setFogZone'?'fogColor':'audioAssetId';
  const durationKey=key==='fogColor'?'blendDuration':'fadeDuration',allowed=key==='fogColor'?['fogColor','fogDensity','priority','blendDuration']:['audioAssetId','volume','priority','fadeDuration'];
  if(Object.keys(enter.params).some(k=>!allowed.includes(k))||Object.keys(exit.params).some(k=>![key,durationKey].includes(k))||enter.params[durationKey]!==exit.params[durationKey])return {ok:false,reason:'Modified zone parameters are retained; review the explicit Behaviors first.'};
  if(!enter.params[key]||exit.params[key]!==''||Object.keys(enter).some(k=>!['trigger','action','params','sourcePreset'].includes(k)&&!(k==='eventRef'&&enter[k]===undefined))||Object.keys(exit).some(k=>!['trigger','action','params','sourcePreset'].includes(k)&&!(k==='eventRef'&&exit[k]===undefined)))return {ok:false,reason:'Modified zone setup is retained; review its explicit Behaviors first.'};
  return {ok:true,mode:key==='fogColor'?'fog':'audio',managed,params:enter.params};
}
function environmentZoneCandidate(item,input) {
  const bad=reason=>({ok:false,changed:false,reason});
  if(playMode||!placed.includes(item)||item.kind!=='cube'||!item.isTrigger)return bad('Select a current Trigger Volume outside Play.');
  if(item.triggerRepeat===false)return bad('Environment zones require Repeat so Exit can restore the underlying environment.');
  const existing=inspectEnvironmentZone(item);if(!existing.ok)return existing;
  if(!input||!['none','fog','audio'].includes(input.mode))return bad('Choose Fog, Ambient Audio or None.');
  const kept=(item.behaviors||[]).filter(b=>!existing.managed.includes(b)),behaviors=kept.slice();
  if(input.mode!=='none'){
    if(!Number.isFinite(input.priority)||Math.abs(input.priority)>100000||!Number.isFinite(input.duration)||input.duration<0||input.duration>60)return bad('Priority must be finite within ±100000; transition is 0–60 seconds.');
    let action,params,exit;
    if(input.mode==='fog'){
      if(typeof input.fogColor!=='string'||!/^#[0-9a-f]{6}$/i.test(input.fogColor)||!Number.isFinite(input.fogDensity)||input.fogDensity<0||input.fogDensity>0.2)return bad('Choose a Fog Color and density 0–0.2.');
      action='setFogZone';params={fogColor:input.fogColor,fogDensity:input.fogDensity,priority:input.priority,blendDuration:input.duration};exit={fogColor:'',blendDuration:input.duration};
    }else{
      if(!findAudioAssetById(input.audioAssetId)||!Number.isFinite(input.volume)||input.volume<0||input.volume>1)return bad('Choose an available Audio Library track and volume 0–1.');
      action='setAmbientAudio';params={audioAssetId:input.audioAssetId,volume:input.volume,priority:input.priority,fadeDuration:input.duration};exit={audioAssetId:'',fadeDuration:input.duration};
    }
    behaviors.push({trigger:'enter',action,params,sourcePreset:'environment-zone-setup'},{trigger:'exit',action,params:exit,sourcePreset:'environment-zone-setup'});
  }
  return {ok:true,changed:JSON.stringify(behaviors)!==JSON.stringify(item.behaviors||[]),behaviors};
}
function applyEnvironmentZoneSetup(item,input) {
  const state=environmentZoneCandidate(item,input);if(!state.ok||!state.changed)return state;
  pushUndo();item.behaviors=state.behaviors;return state;
}
function mountEnvironmentZoneSetup() {
  const item=selectedItem;if(!item?.isTrigger||item.kind!=='cube')return;
  const state=inspectEnvironmentZone(item),params=state.params||{},setup=document.createElement('section');setup.id='environment-zone-setup';setup.className='schema-component-section';
  setup.innerHTML='<h4>Environment zone</h4><p class="field-help">Use this Trigger Volume as a Fog or Ambient Audio region. Highest priority wins; leaving restores the next zone or level defaults. Transform and Trigger Volume below edit geometry. Setup creates ordinary Enter/Exit Behaviors, not Scripts.</p><label class="field-row">Effect<select data-zone-mode><option value="none">None (remove setup only)</option><option value="fog">Fog</option><option value="audio">Ambient Audio</option></select></label><div data-zone-fog><label class="field-row">Fog Color<input data-zone-color type="color" value="'+escapeHtml(params.fogColor||'#99a6bf')+'"></label><label class="field-row">Fog Density<input data-zone-density type="number" min="0" max="0.2" step="0.005" value="'+escapeHtml(params.fogDensity??0.05)+'"></label></div><div data-zone-audio><label class="field-row">Track<select data-zone-track><option value="">Choose Audio Library track</option>'+audioAssets.map(a=>'<option value="'+escapeHtml(a.id)+'">'+escapeHtml(a.name)+'</option>').join('')+'</select></label><label class="field-row">Volume<input data-zone-volume type="number" min="0" max="1" step="0.05" value="'+escapeHtml(params.volume??0.4)+'"></label></div><label class="field-row">Overlap rank<input data-zone-priority type="number" min="-100000" max="100000" value="'+escapeHtml(params.priority??0)+'"></label><label class="field-row">Transition (seconds)<input data-zone-duration type="number" min="0" max="60" step="0.1" value="'+escapeHtml(params.blendDuration??params.fadeDuration??0)+'"></label><p data-zone-status class="field-help"></p><button data-zone-apply type="button" class="toolbar-btn">Apply zone setup</button>';
  inspectorBody.prepend(setup);const q=s=>setup.querySelector(s);q('[data-zone-mode]').value=state.mode||'none';q('[data-zone-track]').value=params.audioAssetId||'';
  const number=s=>q(s).value.trim()?Number(q(s).value):NaN,read=()=>({mode:q('[data-zone-mode]').value,fogColor:q('[data-zone-color]').value,fogDensity:number('[data-zone-density]'),audioAssetId:q('[data-zone-track]').value,volume:number('[data-zone-volume]'),priority:number('[data-zone-priority]'),duration:number('[data-zone-duration]')});
  const preview=()=>{const input=read(),candidate=environmentZoneCandidate(item,input);q('[data-zone-fog]').hidden=input.mode!=='fog';q('[data-zone-audio]').hidden=input.mode!=='audio';q('[data-zone-status]').textContent=candidate.ok?(candidate.changed?'Apply changes in one Undo step; unrelated logic retained.':'Already applied; no history change.'):candidate.reason;q('[data-zone-apply]').disabled=!candidate.ok||!candidate.changed;};
  setup.oninput=preview;setup.onchange=preview;q('[data-zone-apply]').onclick=()=>{const result=applyEnvironmentZoneSetup(item,read());if(!result.ok){showStatus(result.reason);return;}renderInspector();showStatus('Environment zone setup applied');};setup.querySelectorAll('input,select').forEach(c=>c.disabled=playMode);preview();
}
function mountPickupSetupWorkflow() {
  const item=selectedItem;if(!item||!['cube','sprite'].includes(item.kind))return;
  const setup=document.createElement('details');setup.id='pickup-setup-workflow';setup.className='schema-component-section';
  const policy=item.components?.pickup,interaction=item.components?.interactable;
  setup.innerHTML=`<summary>Item Pickup setup</summary><p class="field-help">Choose a named Item and activation. Apply composes ordinary Components and Collect Pickup; no Script or separate inventory. Existing unrelated logic stays unchanged.</p>
    <div class="field-row"><label>Item</label><select data-pickup-item><option value="">Choose Item</option>${currentItemDefs.filter(d=>d&&typeof d.id==='string').map(d=>`<option value="${escapeHtml(d.id)}"${policy?.itemRef===d.id?' selected':''}>${escapeHtml(d.name||'Unnamed Item')}</option>`).join('')}</select></div>
    <div class="field-row"><label>Quantity</label><input type="number" data-pickup-quantity min="1" max="1000" step="1" value="${escapeHtml(policy?.quantity??1)}"></div>
    <div class="field-row"><label>Activation</label><select data-pickup-mode><option value="interact">Player Interact</option><option value="trigger2d"${policy?.collectorRef?' selected':''}>Existing Trigger2D + exact Object</option></select></div>
    <div data-pickup-interact><div class="field-row"><label>Reach (world units)</label><input type="number" data-pickup-range min="0.01" max="100" step="0.1" value="${escapeHtml(interaction?.range??2.5)}"></div><div class="field-row"><label>Prompt</label><input type="text" data-pickup-prompt maxlength="120" value="${escapeHtml(interaction?.prompt??'Collect item')}"></div></div>
    <div data-pickup-trigger><div class="field-row"><label>Collector Object</label><select data-pickup-collector><option value="">Choose exact collector</option>${placed.filter(o=>o!==item&&['cube','sprite'].includes(o.kind)).map(o=>`<option value="${escapeHtml(o.id)}"${policy?.collectorRef===o.id?' selected':''}>${escapeHtml(itemDisplayName(o,placed.indexOf(o)))}</option>`).join('')}</select></div><p class="field-help">Requires existing enabled Trigger Collider2D here and Box/Circle Collider2D on the collector. Geometry, Transform and filters are not changed.</p></div>
    <label class="field-row"><input type="checkbox" data-pickup-remove${policy?.removeOnCollect!==false?' checked':''}> Remove whole Object/Prefab assembly on collection</label><p class="field-help">Kept visuals grant once per level entry. Capacity refuses the whole grant. Project Save/Stop restoration and Game World Save are separate.</p><p data-pickup-preview class="field-help"></p><button type="button" data-pickup-apply class="toolbar-btn">Apply Pickup setup</button>`;
  insertBeforeInspectorFooter(setup);const q=selector=>setup.querySelector(selector);
  const read=()=>({itemRef:q('[data-pickup-item]').value,quantity:Number(q('[data-pickup-quantity]').value),mode:q('[data-pickup-mode]').value,range:q('[data-pickup-range]').value.trim()?Number(q('[data-pickup-range]').value):NaN,prompt:q('[data-pickup-prompt]').value,collectorRef:q('[data-pickup-collector]').value,removeOnCollect:q('[data-pickup-remove]').checked});
  const preview=()=>{const input=read(),state=pickupSetupCandidate(item,input);q('[data-pickup-interact]').hidden=input.mode!=='interact';q('[data-pickup-trigger]').hidden=input.mode!=='trigger2d';q('[data-pickup-preview]').textContent=state.ok?(state.changed?`${state.definition.name||'Item'}: ${input.quantity} per collection. One Undo step; pose and unrelated logic preserved.`:'This setup is already applied.'):state.reason;q('[data-pickup-apply]').disabled=!state.ok||!state.changed;};
  setup.oninput=preview;setup.onchange=preview;
  q('[data-pickup-apply]').onclick=()=>{const state=applyPickupSetup(item,read());if(!state.ok){showStatus(state.reason);return;}renderSceneList();renderInspector();showStatus('Item Pickup setup applied');};
  setup.querySelectorAll('input,select').forEach(control=>{control.disabled=playMode;});preview();
}
function syncGameplayPresetActiveOption(results, search, activeId) {
  const rows = [...results.querySelectorAll('[data-gameplay-preset-id]')];
  for (const row of rows) {
    row.id = `gameplay-preset-option-${row.dataset.gameplayPresetId}`;
    const active = row.dataset.gameplayPresetId === activeId;
    row.classList.toggle('active', active);row.setAttribute('aria-selected', String(active));
  }
  const active = rows.find(row => row.dataset.gameplayPresetId === activeId);
  if (active) search.setAttribute('aria-activedescendant', active.id);
  else search.removeAttribute('aria-activedescendant');
}

function mountGameplayPresetWorkflow() {
  if(typeof renderTopdown2DPlayerSettings==='function')renderTopdown2DPlayerSettings();
  if(typeof renderPlatformerPlayerSettings==='function')renderPlatformerPlayerSettings();
  if (!window.OpusGameplayPresets || !['cube','sprite'].includes(selectedItem.kind)) return;
  const workflow = document.createElement('div');
  workflow.className = 'gameplay-preset-workflow';
  workflow.innerHTML = `<button type="button" id="gameplay-preset-btn" class="toolbar-btn" aria-haspopup="dialog" aria-expanded="false">✦ Apply Gameplay Preset</button>
    <div id="gameplay-preset-picker" class="gameplay-preset-picker" role="dialog" aria-modal="true" aria-labelledby="gameplay-preset-title" hidden>
      <div class="gameplay-preset-dialog">
        <div class="gameplay-preset-title-row"><strong id="gameplay-preset-title">Gameplay Presets</strong><button type="button" data-gameplay-preset-close aria-label="Close Gameplay Presets">✕</button></div>
        <input type="search" data-gameplay-preset-search role="combobox" aria-label="Search gameplay presets" aria-controls="gameplay-preset-results" aria-autocomplete="list" aria-expanded="true" placeholder="Search roles, categories, or descriptions..." autocomplete="off">
        <div class="gameplay-preset-content"><div id="gameplay-preset-results" class="gameplay-preset-results" role="listbox" aria-label="Gameplay presets"></div><div class="gameplay-preset-config" data-gameplay-preset-config><div class="gameplay-preset-empty">Choose a preset to configure it.</div></div></div>
      </div>
    </div>`;
  const componentWorkflow = inspectorBody.querySelector('.add-component-workflow');
  if (componentWorkflow) componentWorkflow.after(workflow); else insertBeforeInspectorFooter(workflow);
  const opener = workflow.querySelector('#gameplay-preset-btn');
  const picker = workflow.querySelector('#gameplay-preset-picker');
  const search = workflow.querySelector('[data-gameplay-preset-search]');
  const results = workflow.querySelector('#gameplay-preset-results');
  const config = workflow.querySelector('[data-gameplay-preset-config]');
  const registry = OpusGameplayPresets.registry;
  let activeId = null;

  const parameterControl = (field) => {
    const common = `data-preset-parameter="${escapeHtml(field.id)}"`;
    if(field.type==='target')return `<label class="gameplay-preset-parameter"><span>${escapeHtml(field.label)}</span>${renderActionFieldInput({key:'targetId',type:'target',implicitSelf:false,nullable:true,emptyLabel:'Player'},'').replace('<select ',`<select ${common} `)}</label>`;
    if(field.type==='waypoints')return `<div class="gameplay-preset-parameter" ${common}><span>${escapeHtml(field.label)} · in order</span><div data-ai-route-rows></div><label>Add existing Waypoint<select data-ai-route-choice><option value="">Choose named Waypoint</option>${placed.filter(p=>p.isWaypoint).map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name||'Unnamed Waypoint')}</option>`).join('')}</select></label><button type="button" data-ai-route-add>Add to route</button><small>Names must be unique, without commas or surrounding spaces. Rename ambiguous Waypoints in the Inspector. Up/down changes visit order; nothing is applied until Apply.</small></div>`;
    if(field.type==='signal'){const definitions=signalDefinitions.slice(0,128).filter(d=>OpusSignals.find(signalDefinitions,d?.id)&&(!field.payloadType||OpusSignals.payloadType(d)===field.payloadType));return `<label class="gameplay-preset-parameter"><span>${escapeHtml(field.label)}</span><select ${common}><option value="">Choose Signal · Project tab</option>${definitions.map(d=>`<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)} · ${escapeHtml(OpusSignals.channelScope(d))}</option>`).join('')}</select></label>`;}
    if(field.type==='color')return `<label class="gameplay-preset-parameter"><span>${escapeHtml(field.label)}</span><input type="color" ${common} value="${escapeHtml(field.default)}"></label>`;
    if (field.type === 'boolean') return `<label class="gameplay-preset-parameter"><span><input type="checkbox" ${common}${field.default ? ' checked' : ''}> ${escapeHtml(field.label)}</span></label>`;
    if (field.type === 'enum') return `<label class="gameplay-preset-parameter"><span>${escapeHtml(field.label)}</span><select ${common}>${field.options.map((value) => `<option value="${escapeHtml(value)}"${value === field.default ? ' selected' : ''}>${escapeHtml(field.optionLabels?.[value]||value)}</option>`).join('')}</select></label>`;
    const type = field.type === 'string' ? 'text' : 'number';
    return `<label class="gameplay-preset-parameter"><span>${escapeHtml(field.label)}</span><input type="${type}" ${common} value="${escapeHtml(field.default)}"${field.min !== undefined ? ` min="${field.min}"` : ''}${field.max !== undefined ? ` max="${field.max}"` : ''}></label>`;
  };
  const readParameters = (preset) => Object.fromEntries(preset.parameters.map((field) => {
    const control = config.querySelector(`[data-preset-parameter="${field.id}"]`);
    return [field.id, field.type === 'waypoints' ? [...control.querySelectorAll('[data-ai-route-id]')].map(row=>row.dataset.aiRouteId) : field.type === 'boolean' ? control.checked : control.value];
  }));
  const renderConfig = (preset) => {
    activeId = preset.id;
    syncGameplayPresetActiveOption(results, search, activeId);
    const state = registry.inspect(selectedItem, preset.id, {}, gameplayPresetAdapter());
    config.innerHTML = `<h3>${preset.preview && preset.preview.icon ? `<span aria-hidden="true">${escapeHtml(preset.preview.icon)}</span> ` : ''}${escapeHtml(preset.displayName)}</h3><div class="gameplay-preset-description">${escapeHtml(preset.description)}</div>${preset.parameters.map(parameterControl).join('')}<div class="gameplay-preset-state" data-gameplay-preset-state>${escapeHtml(state.message)}</div><button type="button" class="toolbar-btn gameplay-preset-apply" data-gameplay-preset-apply>${state.code === 'UPDATE' ? 'Update Existing Setup' : 'Apply Preset'}</button>`;
    const route=config.querySelector('[data-ai-route-rows]');
    const refreshPresetState=()=>{const current=registry.inspect(selectedItem,preset.id,readParameters(preset),gameplayPresetAdapter());config.querySelector('[data-gameplay-preset-state]').textContent=current.message;};
    config.oninput=refreshPresetState;config.onchange=refreshPresetState;
    if(route){
      let ids=[];
      const draw=()=>{route.innerHTML=ids.map((id,i)=>`<div data-ai-route-id="${escapeHtml(id)}"><span>${i+1}. ${escapeHtml(findItemById(id)?.name||'Unavailable Waypoint')}</span> <button type="button" data-ai-route-up="${i}"${i===0?' disabled':''} aria-label="Move route entry ${i+1} up">↑</button><button type="button" data-ai-route-down="${i}"${i===ids.length-1?' disabled':''} aria-label="Move route entry ${i+1} down">↓</button><button type="button" data-ai-route-remove="${i}" aria-label="Remove route entry ${i+1}">×</button></div>`).join('');for(const [attr,delta]of [['up',-1],['down',1],['remove',0]])route.querySelectorAll(`[data-ai-route-${attr}]`).forEach(button=>button.onclick=()=>{const i=Number(button.getAttribute(`data-ai-route-${attr}`));if(attr==='remove')ids.splice(i,1);else if(i+delta>=0&&i+delta<ids.length)[ids[i],ids[i+delta]]=[ids[i+delta],ids[i]];draw();});refreshPresetState();};
      config.querySelector('[data-ai-route-add]').onclick=()=>{const id=config.querySelector('[data-ai-route-choice]').value;if(id&&ids.length<128){ids.push(id);draw();refreshPresetState();}};draw();
    }
    config.querySelector('[data-gameplay-preset-apply]').addEventListener('click', () => {
      const target = selectedItem;
      const result = preset.id==='topdown-player-2d' ? applyTopdown2DPlayerSetup(target) : preset.id==='platformer-player-2d' ? applyPlatformerPlayerSetup(target) : registry.apply(target, preset.id, readParameters(preset), gameplayPresetAdapter(), { onBeforeChange: () => pushUndo() });
      if (!result.ok) { config.querySelector('[data-gameplay-preset-state]').textContent = result.message||result.reason; return; }
      validateCurrentProject();
      renderSceneList();
      showStatus(`${preset.displayName} ${result.code === 'UPDATED' ? 'updated' : 'applied'}`);
      picker.hidden = true;
      renderInspector();
      requestAnimationFrame(() => document.getElementById('gameplay-preset-btn')?.focus());
    });
  };
  const renderResults = (query) => {
    const presets = registry.discover(selectedItem, query);
    if (!presets.length) { results.innerHTML = '<div class="gameplay-preset-empty">No matching gameplay presets.</div>'; config.innerHTML = '<div class="gameplay-preset-empty">Try another role or category.</div>'; activeId = null; syncGameplayPresetActiveOption(results, search, activeId); return; }
    const groups = new Map();
    presets.forEach((preset) => { if (!groups.has(preset.category)) groups.set(preset.category, []); groups.get(preset.category).push(preset); });
    results.innerHTML = [...groups].map(([category, entries]) => `<section aria-label="${escapeHtml(category)}"><div class="gameplay-preset-category-title">${escapeHtml(category)}</div>${entries.map((preset) => `<button type="button" role="option" aria-selected="false" class="gameplay-preset-option" data-gameplay-preset-id="${escapeHtml(preset.id)}"><span class="gameplay-preset-icon" aria-hidden="true">${escapeHtml((preset.preview && preset.preview.icon) || '✦')}</span><strong>${escapeHtml(preset.displayName)}</strong><small>${escapeHtml(preset.description)}</small></button>`).join('')}</section>`).join('');
    results.querySelectorAll('[data-gameplay-preset-id]').forEach((button) => button.addEventListener('click', () => renderConfig(registry.get(button.dataset.gameplayPresetId))));
    renderConfig(presets.find((preset) => preset.id === activeId) || presets[0]);
  };
  const close = () => { picker.hidden = true; opener.setAttribute('aria-expanded', 'false'); opener.focus(); };
  opener.addEventListener('click', () => { picker.hidden = false; opener.setAttribute('aria-expanded', 'true'); search.value = ''; renderResults(''); search.focus(); });
  picker.querySelector('[data-gameplay-preset-close]').addEventListener('click', close);
  picker.addEventListener('click', (event) => { if (event.target === picker) close(); });
  search.addEventListener('input', () => renderResults(search.value));
  picker.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const rows = [...results.querySelectorAll('[data-gameplay-preset-id]')];
      if (!rows.length) return;
      event.preventDefault();
      const current = Math.max(0, rows.findIndex((row) => row.dataset.gameplayPresetId === activeId));
      const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      renderConfig(registry.get(rows[next].dataset.gameplayPresetId)); rows[next].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && event.target === search && activeId) { event.preventDefault(); config.querySelector('[data-gameplay-preset-apply]')?.focus(); }
    else if (event.key === 'Tab') { const focusable = [...picker.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')]; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  });
}

// --- Inspector cards ---
// Presentation-only pass over the rendered Inspector: component sections and
// large settings sections become collapsible cards. Explanations sit behind a
// per-card "?" and Up/Down/Remove behind "⋯"; nothing is removed from the DOM,
// so every existing control, id and handler is unchanged. Collapse choices are
// a per-browser preference.
const INSPECTOR_CARDS_COLLAPSED_BY_DEFAULT = new Set(['Material', 'Hybrid Layering', 'Property Animation Clips', 'AI Brain — movement',
  'Object Variables', 'Save as Prefab', 'Prefab Parameters', 'Replace With Prefab', 'Sockets', 'Animation Events', 'Root motion utility',
  'Populate Along Path', 'Attach to Socket']);
function readInspectorCardPrefs() {
  try { const value = JSON.parse(localStorage.getItem('doengine:inspector-cards') || '{}'); return value && typeof value === 'object' ? value : {}; }
  catch (error) { return {}; }
}
function organizeInspectorCards() {
  const prefs = readInspectorCardPrefs();
  for (const el of [...inspectorBody.children]) {
    if (el.classList.contains('inspector-card') || el.tagName === 'DETAILS') continue;
    let title = '', originalTitle = null, key = '';
    if (el.matches('[data-schema-slot]')) {
      title = OpusAuthoring.registry.get(el.dataset.schemaSlot)?.displayName || '';
      originalTitle = el.querySelector('.field-editor-section-heading') || el.querySelector(':scope > .field-row > label:first-child');
      key = 'component:' + el.dataset.schemaSlot;
    } else if (el.classList.contains('field-row')) {
      const label = el.firstElementChild;
      if (!label || label.tagName !== 'LABEL') continue;
      if (el.querySelectorAll('input,select,textarea,button').length < 2 && el.offsetHeight < 80) continue; // small rows stay plain
      title = label.textContent.trim(); originalTitle = label; key = 'section:' + title;
    }
    if (!title) continue;
    el.classList.add('inspector-card');
    if (originalTitle) originalTitle.classList.add('inspector-card-original-title');
    const head = document.createElement('div');
    head.className = 'inspector-card-head';
    head.innerHTML = `<button type="button" class="inspector-card-toggle"><span class="inspector-card-chevron" aria-hidden="true">▾</span> ${escapeHtml(title)}</button>`;
    if (el.querySelector('.schema-component-help')) {
      const help = document.createElement('button');
      help.type = 'button'; help.className = 'inspector-card-help'; help.textContent = '?';
      help.title = 'Show or hide the explanation'; help.setAttribute('aria-label', `Help for ${title}`);
      help.onclick = () => el.classList.toggle('inspector-card-help-open');
      head.appendChild(help);
    }
    if (el.querySelector('.component-lifecycle-tools')) {
      const more = document.createElement('button');
      more.type = 'button'; more.className = 'inspector-card-more'; more.textContent = '⋯';
      more.title = 'Order and remove'; more.setAttribute('aria-label', `${title} options`);
      more.onclick = () => el.classList.toggle('inspector-card-tools-open');
      head.appendChild(more);
    }
    el.prepend(head);
    const toggle = head.firstElementChild;
    const apply = (collapsed) => { el.classList.toggle('inspector-card-collapsed', collapsed); toggle.setAttribute('aria-expanded', String(!collapsed)); };
    apply(Object.prototype.hasOwnProperty.call(prefs, key) ? prefs[key] === true : INSPECTOR_CARDS_COLLAPSED_BY_DEFAULT.has(title));
    toggle.onclick = () => {
      const collapsed = !el.classList.contains('inspector-card-collapsed');
      apply(collapsed);
      const next = readInspectorCardPrefs(); next[key] = collapsed;
      try { localStorage.setItem('doengine:inspector-cards', JSON.stringify(next)); } catch (error) { /* preference only */ }
    };
  }
}

function renderInspector() {
  queueMicrotask(() => { mountScriptInspectorSection(); organizeInspectorCards(); });
  if (terrainSculptPreview) terrainSculptPreview.style.display = 'none';
  renderInspectorBody();
  if (selectedItems.size !== 1 || !selectedItem) return;
  wireAiBrainAuthoring(selectedItem);
  // Phase 002: bounded schema-renderer proof. These mount points coexist
  // with the legacy Inspector; Health, Trigger and the Particle core fields
  // use one renderer with delegated data attributes instead of new unique
  // DOM ids. Runtime ownership stays in the existing item/handle fields.
  const componentReferenceOptions = (referenceType, field) => OpusAuthoringPlumbing.getReferenceOptions(referenceType, {
    inputActions: Object.entries(inputActionLabels()).map(([id, name]) => ({ id, name })),
    objects: placed, levels, objectives: currentObjectiveDefs, prefabs, itemDefs: currentItemDefs,
    assets, textures: textureAssets, sprites: spriteAssets, spriteAnimations: spriteAnimationClips, audio: audioAssets,
    sortingLayers: spriteSortingLayers,
    parallaxLayers, collisionLayers,
    currentObjectId: selectedItem && selectedItem.id,
    currentLevelId: levels[currentLevelIndex] && levels[currentLevelIndex].id,
  }, field);
  mountIntrinsicCoreComponentSlots();
  ensureRegisteredComponentSlots();
  inspectorBody.querySelectorAll('[data-schema-slot]').forEach((container) => {
    if(OpusAuthoring.registry.get(container.dataset.schemaSlot)?.inspector.nativeControls)return;
    OpusAuthoring.renderComponentSection(container, {
      schemaId: container.dataset.schemaSlot,
      target: selectedItem,
      optionsFor: componentReferenceOptions,
      onBeforeChange: () => pushUndo(),
      onChange: (schema) => {
        if (schema.id === 'trigger') syncColliderViz();
        if (schema.id === 'box-collider-2d' || schema.id === 'circle-collider-2d' || schema.id === 'trigger-collider-2d') { activeCollider2DComponentId = schema.id; syncCollider2DOverlay(); }
        if (schema.id === 'trigger-collider-2d') syncTriggerCollider2DInspectorFields();
        if (schema.id === 'body-2d') syncBody2DInspectorFields();
        if (schema.id === 'sprite-renderer') {
          syncSpriteRenderer(selectedItem);
          syncSpriteDirectManipulation();
        }
      },
    });
  });
  syncTriggerCollider2DInspectorFields();
  syncBody2DInspectorFields();
  const characterSlot = inspectorBody.querySelector('[data-schema-slot="character-collision-2d"]');
  if (characterSlot && selectedItem.components && selectedItem.components['character-collision-2d']) {
    const body = selectedItem.components['body-2d'];
    const colliderReady = ['box-collider-2d', 'circle-collider-2d'].some((id) => selectedItem.components[id]?.enabled);
    const requirements = document.createElement('div'); requirements.className = 'field-row';
    requirements.innerHTML = `<p class="field-help">Kinematic Body 2D: ${body?.enabled && body.type === 'kinematic' ? 'Ready' : 'Missing'} · Collider 2D: ${colliderReady ? 'Ready' : 'Missing'}. Trigger alone is not a physical shape.</p><p class="field-help">World negative Y is down. Slope Following uses walkable Static Box tops and slope Tiles up to Maximum Slope Angle; Step Handling uses Maximum Step Height for grounded obstacles and short drops. One-Way surfaces only catch downward movement. This component adds no input, gravity, jumping, or drop-through control.</p><button type="button" data-character-remove class="toolbar-btn">Remove Component</button>`;
    characterSlot.appendChild(requirements);
    requirements.querySelector('[data-character-remove]').onclick = () => { pushUndo(); if (body2DManager) body2DManager.clearCharacterCollision2DState(selectedItem.id); delete selectedItem.components['character-collision-2d']; if (!Object.keys(selectedItem.components).length) delete selectedItem.components; renderInspector(); validateCurrentProject(); };
  }
  const oneWaySlot = inspectorBody.querySelector('[data-schema-slot="one-way-platform-2d"]');
  if (oneWaySlot && selectedItem.components && selectedItem.components['one-way-platform-2d']) {
    const bag = selectedItem.components;
    const box = OpusCollider2D.resolveCollider2DWorldShape(selectedItem, bag['box-collider-2d'], 'box');
    const horizontal = box && OpusOneWay2D.horizontalTop(box);
    const slopeSurface = box && OpusCharacterSlope2D.surfaceFromShape(box, selectedItem.id, true);
    const requirements = document.createElement('div'); requirements.className = 'field-row';
    const bodyReady = bag['body-2d']?.enabled && (bag['body-2d']?.type === 'static' || bag['body-2d']?.type === 'kinematic' && bag['moving-platform-2d']?.enabled);
    requirements.innerHTML = `<p class="field-help">Static or eligible Moving Platform Body 2D: ${bodyReady ? 'Ready' : 'Missing'} · Box Collider 2D: ${box ? 'Ready' : 'Missing'} · Surface: ${horizontal ? 'Horizontal' : slopeSurface ? `${slopeSurface.angle.toFixed(1)}° slope` : 'Unsupported'}.</p><p class="field-help">Characters pass upward and through sides, then land while descending relative to the platform surface. Rotated surfaces require Slope Following and must be within that Character's Maximum Slope Angle.</p><button type="button" data-one-way-remove class="toolbar-btn">Remove Component</button>`;
    oneWaySlot.appendChild(requirements);
    requirements.querySelector('[data-one-way-remove]').onclick = () => { pushUndo(); delete selectedItem.components['one-way-platform-2d']; if (!Object.keys(selectedItem.components).length) delete selectedItem.components; syncCollider2DOverlay(); renderInspector(); validateCurrentProject(); };
  }
  const movingSlot = inspectorBody.querySelector('[data-schema-slot="moving-platform-2d"]');
  if (movingSlot && selectedItem.components && selectedItem.components['moving-platform-2d']) {
    const bag = selectedItem.components, body = bag['body-2d'], box = bag['box-collider-2d'];
    const oneWay = bag['one-way-platform-2d']?.enabled ? 'Enabled' : 'Off';
    const tools = document.createElement('div'); tools.className = 'field-row moving-platform-2d-tools';
    tools.innerHTML = `<p class="field-help">Kinematic Body 2D: ${body?.enabled && body.type === 'kinematic' ? 'Ready' : 'Missing'} · Box Collider 2D: ${box?.enabled ? 'Ready' : 'Missing'} · One-Way: ${oneWay} · Body Velocity: [${Number(body?.linearVelocity?.[0] || 0).toFixed(2)}, ${Number(body?.linearVelocity?.[1] || 0).toFixed(2)}].</p><p class="field-help">Moving Platform 2D opts a Kinematic Box into Character Collision support and carry. Grounded Characters inherit the platform's actual translation. Ordinary Kinematic objects still do not collide with each other.</p><p class="field-help">Carry follows translational platform motion. Runtime rotation/scale changes are not carried in Phase 048. Moving Platforms carry grounded Characters; they do not push unsupported Characters from the side.</p><button type="button" data-moving-platform-remove class="toolbar-btn">Remove Component</button>`;
    movingSlot.appendChild(tools);
    tools.querySelector('[data-moving-platform-remove]').onclick = () => { pushUndo(); delete selectedItem.components['moving-platform-2d']; if (!Object.keys(selectedItem.components).length) delete selectedItem.components; renderInspector(); validateCurrentProject(); showStatus('Moving Platform 2D removed'); };
  }
  const bodySlot = inspectorBody.querySelector('[data-schema-slot="body-2d"]');
  if (bodySlot && selectedItem.components && selectedItem.components['body-2d']) {
    const tools = document.createElement('div'); tools.className = 'field-row body-2d-tools';
    const hasCollider = ['box-collider-2d', 'circle-collider-2d'].some((id) => selectedItem.components[id]?.enabled);
    tools.innerHTML = `<p class="field-help" data-body-2d-role-help></p><p class="field-help">Velocity X/Y is in world units per second. Trigger Collider 2D does not block movement.${hasCollider ? '' : ' Add Box Collider 2D or Circle Collider 2D for a physical collision shape.'}</p><button type="button" data-body-remove class="toolbar-btn">Remove Component</button>`;
    bodySlot.appendChild(tools); syncBody2DInspectorFields();
    tools.querySelector('[data-body-remove]').onclick = () => {
      pushUndo(); delete selectedItem.components['body-2d']; body2DObjects.delete(selectedItem);
      if (Object.keys(selectedItem.components).length === 0) delete selectedItem.components;
      renderInspector(); validateCurrentProject(); showStatus('Body 2D removed');
    };
  }
  for (const componentId of ['box-collider-2d', 'circle-collider-2d', 'trigger-collider-2d']) {
    const slot = inspectorBody.querySelector(`[data-schema-slot="${componentId}"]`); const component = selectedItem.components && selectedItem.components[componentId];
    if (!slot || !component || !globalThis.OpusCollider2D) continue;
    slot.addEventListener('focusin', () => { activeCollider2DComponentId = componentId; syncCollider2DOverlay(); });
    const tools = document.createElement('div'); tools.className = 'field-row collider-2d-tools';
    const isTrigger = componentId === 'trigger-collider-2d';
    const shapeKind = isTrigger ? component.shape : componentId === 'box-collider-2d' ? 'box' : 'circle';
    tools.innerHTML = `<div class="field-pair"><button type="button" data-collider-fit class="toolbar-btn">Fit to Visual</button><button type="button" data-collider-remove class="toolbar-btn">Remove Component</button></div><p class="field-help">${isTrigger ? 'Trigger Collider 2D detects ordinary Box/Circle Collider 2D overlaps and emits Enter, Stay, and Exit. It never blocks or moves Objects.' : 'Collider 2D defines geometry. Add Body 2D to make it a Static obstacle or move it Kinematically.'}</p>`;
    slot.appendChild(tools);
    tools.querySelector('[data-collider-fit]').onclick = () => {
      const fit = OpusCollider2D.fitToVisual(selectedItem, shapeKind);
      if (!fit) { showStatus('Fit to Visual is unavailable because this Object has no supported visual bounds'); return; }
      pushUndo(); component.offset = fit.offset.slice(); if (shapeKind === 'box') component.size = fit.size.slice(); else component.radius = fit.radius;
      activeCollider2DComponentId = componentId; renderInspector(); syncCollider2DOverlay(); validateCurrentProject(); showStatus(`${isTrigger ? `Trigger Collider 2D · ${shapeKind === 'box' ? 'Box' : 'Circle'}` : `${componentId === 'box-collider-2d' ? 'Box' : 'Circle'} Collider 2D`} fitted to ${fit.source === 'sprite' ? 'Sprite' : 'visual'} bounds in one Undo step`);
    };
    tools.querySelector('[data-collider-remove]').onclick = () => {
      pushUndo(); delete selectedItem.components[componentId]; if (componentId === 'trigger-collider-2d') trigger2DObjects.delete(selectedItem); if (Object.keys(selectedItem.components).length === 0) delete selectedItem.components;
      renderInspector(); syncCollider2DOverlay(); validateCurrentProject(); showStatus(`${isTrigger ? 'Trigger' : componentId === 'box-collider-2d' ? 'Box' : 'Circle'} Collider 2D removed`);
    };
  }
  if (selectedItem.kind === 'sprite') {
    const slot = inspectorBody.querySelector('[data-schema-slot="sprite-renderer"]');
    const component = selectedItem.components && selectedItem.components['sprite-renderer'];
    if (slot && component) {
      const conveniences = document.createElement('div');
      conveniences.className = 'field-row sprite-geometry-tools';
      const assignedAsset = findSpriteAssetById(component.spriteAssetRef);
      const currentPivotPreset = Object.entries(OpusSpriteAuthoring.PIVOT_PRESETS)
        .find(([, value]) => Math.abs(value[0] - component.pivotX) < 1e-6 && Math.abs(value[1] - component.pivotY) < 1e-6)?.[0] || 'center';
      conveniences.innerHTML = `<label>Geometry Tools</label>
      <label style="display:flex;align-items:center;gap:6px;margin-bottom:7px"><input type="checkbox" data-sprite-aspect-lock${spriteAspectLock ? ' checked' : ''}> Lock Aspect Ratio (current size)</label>
      <div class="field-triple"><select data-sprite-pivot-preset>
        <option value="top-left"${currentPivotPreset === 'top-left' ? ' selected' : ''}>Top Left</option><option value="top-center"${currentPivotPreset === 'top-center' ? ' selected' : ''}>Top Center</option><option value="top-right"${currentPivotPreset === 'top-right' ? ' selected' : ''}>Top Right</option>
        <option value="left-center"${currentPivotPreset === 'left-center' ? ' selected' : ''}>Left Center</option><option value="center"${currentPivotPreset === 'center' ? ' selected' : ''}>Center</option><option value="right-center"${currentPivotPreset === 'right-center' ? ' selected' : ''}>Right Center</option>
        <option value="bottom-left"${currentPivotPreset === 'bottom-left' ? ' selected' : ''}>Bottom Left</option><option value="bottom-center"${currentPivotPreset === 'bottom-center' ? ' selected' : ''}>Bottom Center</option><option value="bottom-right"${currentPivotPreset === 'bottom-right' ? ' selected' : ''}>Bottom Right</option>
      </select><button type="button" data-sprite-apply-pivot class="toolbar-btn" style="margin-bottom:0">Apply Pivot</button><button type="button" data-sprite-source-aspect class="toolbar-btn" style="margin-bottom:0">Use Source Aspect</button></div>
      ${assignedAsset ? `<div class="field-pair"><button type="button" data-sprite-asset-pivot class="toolbar-btn">Use Asset Pivot</button><button type="button" data-sprite-natural-size class="toolbar-btn" title="Apply Natural Size from the assigned Sprite Asset">Use Natural Size</button></div><p class="field-help">Sprite Asset resolves to ${escapeHtml((sourceTextureForSpriteAsset(assignedAsset) || {}).name || 'missing Texture')}. Width and Height remain per-instance.</p>${component.renderMode === 'nine-slice' ? `<div class="nine-slice-renderer-status"><strong>Nine-Slice source:</strong> ${assignedAsset.nineSlice ? `guides ${assignedAsset.nineSlice.left}/${assignedAsset.nineSlice.right}/${assignedAsset.nineSlice.top}/${assignedAsset.nineSlice.bottom} px · natural sides ${(assignedAsset.nineSlice.left / assignedAsset.pixelsPerUnit).toFixed(3)}/${(assignedAsset.nineSlice.right / assignedAsset.pixelsPerUnit).toFixed(3)} world` : 'No guides — runtime uses Simple fallback'}</div>` : ''}` : component.sourceTexture ? '<button type="button" data-sprite-convert-legacy class="toolbar-btn">Convert Legacy Texture to Sprite Asset</button><p class="field-help">This Phase 011 Sprite still uses its direct Texture compatibility source.</p>' : ''}`;

      // Rehouse the reusable schema rows; ownership and controls remain the
      // same. These four headings are presentation only, not duplicate data.
      const fieldsHost = slot.querySelector('[data-component-fields]');
      const groups = {};
      for (const name of ['Source', 'Animation', 'Geometry', 'Appearance', 'Sorting', 'Parallax']) {
        const group = document.createElement('section');
        group.className = 'sprite-inspector-group';
        group.dataset.spriteInspectorGroup = name.toLowerCase();
        group.innerHTML = `<h4>${name}</h4>`;
        groups[name] = group;
      }
      const groupForField = {
        spriteAssetRef: 'Source', renderMode: 'Source', sourceTexture: 'Source', initialAnimationStateRef: 'Animation', initialDirection: 'Animation', playOnStart: 'Animation',
        width: 'Geometry', height: 'Geometry', pivotX: 'Geometry', pivotY: 'Geometry',
        tint: 'Appearance', visible: 'Appearance', flipX: 'Appearance', flipY: 'Appearance',
        sortingLayerRef: 'Sorting', orderInLayer: 'Sorting', parallaxLayerRef: 'Parallax',
      };
      for (const row of [...fieldsHost.querySelectorAll('[data-field-editor-row]')]) {
        groups[groupForField[row.dataset.fieldEditorRow] || 'Appearance'].appendChild(row);
      }
      const initialRow = groups.Animation.querySelector('[data-field-editor-row="initialAnimationStateRef"]');
      if (initialRow) initialRow.remove();
      component.animationStates = OpusAuthoringPlumbing.normalizeSpriteAnimationStates(component.animationStates);
      const stateOptions = component.animationStates.map((state) => `<option value="${escapeHtml(state.id)}"${component.initialAnimationStateRef === state.id ? ' selected' : ''}>${escapeHtml(state.name)} · ${escapeHtml(state.id)}</option>`).join('');
      const clipOptions = (selected) => `<option value="">(empty — static fallback)</option>${spriteAnimationClips.map((clip) => `<option value="${escapeHtml(clip.id)}"${selected === clip.id ? ' selected' : ''}>${escapeHtml(clip.name)}</option>`).join('')}`;
      const variantClipOptions = (selected) => `<option value="">Use Base Clip</option>${spriteAnimationClips.map((clip) => `<option value="${escapeHtml(clip.id)}"${selected === clip.id ? ' selected' : ''}>${escapeHtml(clip.name)}</option>`).join('')}`;
      const directionLabels = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', 'up-left': 'Up Left', 'up-right': 'Up Right', 'down-left': 'Down Left', 'down-right': 'Down Right' };
      const statePanel = document.createElement('div');
      statePanel.className = 'sprite-animation-states-editor';
      statePanel.innerHTML = `<div class="field-row"><label>Initial Animation State</label><select data-sprite-initial-state><option value="">None (static fallback)</option>${stateOptions}</select><p class="field-help">Stored as a stable renderer-local ID; display-name renames do not break it.</p></div>
        <div class="field-row"><label>Named Animation States</label>${component.animationStates.length ? component.animationStates.map((state) => { const used = new Set(state.directionalVariants.map((variant) => variant.direction)); const available = OpusAuthoringPlumbing.SPRITE_DIRECTIONS.filter((direction) => !used.has(direction)); return `<div class="asset-row sprite-state-directional" data-sprite-state-row="${escapeHtml(state.id)}"><input type="text" data-sprite-state-name="${escapeHtml(state.id)}" aria-label="Animation State name" value="${escapeHtml(state.name)}"><select data-sprite-state-clip="${escapeHtml(state.id)}" aria-label="Animation State base clip">${clipOptions(state.clipRef)}</select><div class="asset-row-meta">stable local ID ${escapeHtml(state.id)} · base Clip fallback</div><button type="button" data-sprite-state-remove="${escapeHtml(state.id)}">Remove State</button><div class="sprite-directional-variants"><strong>Directional Variants</strong>${state.directionalVariants.length ? state.directionalVariants.map((variant) => `<div class="sprite-direction-row" data-sprite-direction-row="${escapeHtml(state.id)}:${escapeHtml(variant.direction)}"><span>${escapeHtml(directionLabels[variant.direction] || variant.direction)}</span><select data-sprite-direction-clip="${escapeHtml(state.id)}:${escapeHtml(variant.direction)}" aria-label="${escapeHtml(directionLabels[variant.direction] || variant.direction)} Clip">${variantClipOptions(variant.clipRef)}</select><label><input type="checkbox" data-sprite-direction-mirror-x="${escapeHtml(state.id)}:${escapeHtml(variant.direction)}"${variant.mirrorX ? ' checked' : ''}> Mirror X</label><label><input type="checkbox" data-sprite-direction-mirror-y="${escapeHtml(state.id)}:${escapeHtml(variant.direction)}"${variant.mirrorY ? ' checked' : ''}> Mirror Y</label><button type="button" data-sprite-direction-remove="${escapeHtml(state.id)}:${escapeHtml(variant.direction)}">Remove</button></div>`).join('') : '<p class="field-help">No directional overrides; every direction uses the base Clip.</p>'}${available.length ? `<div class="field-pair"><select data-sprite-direction-add-select="${escapeHtml(state.id)}">${available.map((direction) => `<option value="${direction}">${directionLabels[direction]}</option>`).join('')}</select><button type="button" data-sprite-direction-add="${escapeHtml(state.id)}">+ Add Direction</button></div>` : '<p class="field-help">All eight directions are mapped.</p>'}</div></div>`; }).join('') : '<p class="onboarding-empty">No states yet. The static Sprite Asset remains visible.</p>'}<button type="button" class="toolbar-btn" data-sprite-state-add>Add Animation State</button></div>`;
      groups.Animation.appendChild(statePanel);
      groups.Geometry.appendChild(conveniences);
      const parallaxFactors = OpusAuthoringPlumbing.resolveParallaxFactors(component.parallaxLayerRef, parallaxLayers);
      const parallaxSummary = document.createElement('p');
      parallaxSummary.className = 'field-help';
      parallaxSummary.dataset.parallaxFactorSummary = '';
      parallaxSummary.textContent = parallaxFactors.missing
        ? `Missing layer ${component.parallaxLayerRef}; safe runtime fallback is X 1, Y 1 and the stored ID is preserved.`
        : `Effective factors: X ${parallaxFactors.factorX}, Y ${parallaxFactors.factorY}. Offset is applied only while playing.`;
      groups.Parallax.appendChild(parallaxSummary);
      fieldsHost.replaceChildren(groups.Source, groups.Animation, groups.Geometry, groups.Appearance, groups.Sorting, groups.Parallax);

      statePanel.querySelector('[data-sprite-initial-state]').onchange = (event) => { pushUndo(); component.initialAnimationStateRef = event.target.value || null; resetSpriteAnimationForItem(selectedItem, false); validateCurrentProject(); renderInspector(); };
      statePanel.querySelector('[data-sprite-state-add]').onclick = () => { pushUndo(); component.animationStates.push(OpusAuthoringPlumbing.createSpriteAnimationState(component.animationStates, { name: 'Animation State' })); renderInspector(); };
      statePanel.querySelectorAll('[data-sprite-state-name]').forEach((input) => {
        const state = component.animationStates.find((entry) => entry.id === input.dataset.spriteStateName);
        const originalName = state && state.name;
        input.onfocus = () => { if (!input.dataset.undoCaptured) { pushUndo(); input.dataset.undoCaptured = 'true'; } };
        input.oninput = () => {
          const name = input.value.trim();
          if (!state || !name || component.animationStates.some((entry) => entry.id !== state.id && entry.name.toLowerCase() === name.toLowerCase())) return;
          state.name = name;
          const option = statePanel.querySelector(`[data-sprite-initial-state] option[value="${state.id}"]`);
          if (option) option.textContent = `${state.name} · ${state.id}`;
        };
        input.onchange = () => {
          const name = input.value.trim();
          if (!state || !name || component.animationStates.some((entry) => entry.id !== state.id && entry.name.toLowerCase() === name.toLowerCase())) {
            showStatus(!name ? 'Animation State name cannot be empty' : `Animation State name "${name}" is already used`);
            renderInspector();
            return;
          }
          state.name = name;
          renderInspector();
          if (state.name !== originalName) showStatus(`Renamed state to "${name}"; stable ID unchanged`);
        };
      });
      statePanel.querySelectorAll('[data-sprite-state-clip]').forEach((select) => { select.onchange = () => { const state = component.animationStates.find((entry) => entry.id === select.dataset.spriteStateClip); if (!state) return; pushUndo(); state.clipRef = select.value || null; if (getCurrentSpriteAnimationState(selectedItem) === state.id) stopSpriteAnimation(selectedItem); validateCurrentProject(); }; });
      const directionKey = (value) => { const split = String(value || '').indexOf(':'); return { stateId: String(value || '').slice(0, split), direction: String(value || '').slice(split + 1) }; };
      statePanel.querySelectorAll('[data-sprite-direction-add]').forEach((button) => { button.onclick = () => { const state = component.animationStates.find((entry) => entry.id === button.dataset.spriteDirectionAdd); const select = statePanel.querySelector(`[data-sprite-direction-add-select="${button.dataset.spriteDirectionAdd}"]`); const direction = select && select.value; if (!state || !OpusAuthoringPlumbing.SPRITE_DIRECTIONS.includes(direction) || state.directionalVariants.some((variant) => variant.direction === direction)) return; pushUndo(); state.directionalVariants.push({ direction, clipRef: null, mirrorX: false, mirrorY: false }); renderInspector(); validateCurrentProject(); }; });
      statePanel.querySelectorAll('[data-sprite-direction-remove]').forEach((button) => { button.onclick = () => { const key = directionKey(button.dataset.spriteDirectionRemove); const state = component.animationStates.find((entry) => entry.id === key.stateId); if (!state) return; pushUndo(); state.directionalVariants = state.directionalVariants.filter((variant) => variant.direction !== key.direction); resetSpriteAnimationForItem(selectedItem, false); renderInspector(); validateCurrentProject(); showStatus(`${directionLabels[key.direction] || key.direction} now falls back to the State base Clip`); }; });
      statePanel.querySelectorAll('[data-sprite-direction-clip]').forEach((select) => { select.onchange = () => { const key = directionKey(select.dataset.spriteDirectionClip); const state = component.animationStates.find((entry) => entry.id === key.stateId); const variant = state && state.directionalVariants.find((entry) => entry.direction === key.direction); if (!variant) return; pushUndo(); variant.clipRef = select.value || null; resetSpriteAnimationForItem(selectedItem, false); validateCurrentProject(); showStatus(variant.clipRef ? `${directionLabels[key.direction]} uses ${findSpriteAnimationById(variant.clipRef)?.name || 'missing Clip'}` : `${directionLabels[key.direction]} uses the State base Clip`); }; });
      const bindMirror = (selector, keyName) => statePanel.querySelectorAll(selector).forEach((input) => { input.onchange = () => { const key = directionKey(input.dataset[keyName]); const state = component.animationStates.find((entry) => entry.id === key.stateId); const variant = state && state.directionalVariants.find((entry) => entry.direction === key.direction); if (!variant) return; pushUndo(); variant[keyName === 'spriteDirectionMirrorX' ? 'mirrorX' : 'mirrorY'] = input.checked; syncSpriteRenderer(selectedItem); }; });
      bindMirror('[data-sprite-direction-mirror-x]', 'spriteDirectionMirrorX');
      bindMirror('[data-sprite-direction-mirror-y]', 'spriteDirectionMirrorY');
      statePanel.querySelectorAll('[data-sprite-state-remove]').forEach((button) => { button.onclick = () => { const id = button.dataset.spriteStateRemove; const state = component.animationStates.find((entry) => entry.id === id); if (!state) return; const uses = countSpriteAnimationStateActionUses(selectedItem.id, id); if (uses && !confirm(`"${state.name}" is referenced by ${uses} Action${uses === 1 ? '' : 's'}. Remove it and leave repairable state IDs?`)) return; pushUndo(); component.animationStates = component.animationStates.filter((entry) => entry.id !== id); if (component.initialAnimationStateRef === id) component.initialAnimationStateRef = null; if (getCurrentSpriteAnimationState(selectedItem) === id) stopSpriteAnimation(selectedItem); renderInspector(); validateCurrentProject(); showStatus(`Removed Animation State "${state.name}"${uses ? '; Action references remain for repair' : ''}`); }; });

      conveniences.querySelector('[data-sprite-aspect-lock]').onchange = (event) => {
        spriteAspectLock = event.target.checked;
        syncSpriteDirectManipulation();
      };
      conveniences.querySelector('[data-sprite-apply-pivot]').onclick = () => {
        const target = selectedItem;
        const presetName = conveniences.querySelector('[data-sprite-pivot-preset]').value;
        pushUndo();
        const current = target && target.components && target.components['sprite-renderer'];
        if (!current) return;
        const preset = OpusSpriteAuthoring.pivotPreset(presetName);
        current.pivotX = preset.pivotX; current.pivotY = preset.pivotY; syncSpriteRenderer(target); renderInspector();
      };
      conveniences.querySelector('[data-sprite-source-aspect]').onclick = () => {
        const target = selectedItem;
        const current = target && target.components && target.components['sprite-renderer'];
        const currentAsset = current && findSpriteAssetById(current.spriteAssetRef);
        const texture = currentAsset ? sourceTextureForSpriteAsset(currentAsset) : findTextureAssetById(current && current.sourceTexture);
        if (!texture || !texture.image || !texture.image.width || !texture.image.height) { showStatus('Choose a decoded Texture Asset first'); return; }
        pushUndo();
        current.width = current.height * texture.image.width / texture.image.height;
        syncSpriteRenderer(target); renderInspector(); showStatus('Sprite width matched source aspect');
      };
      const assetPivot = conveniences.querySelector('[data-sprite-asset-pivot]');
      if (assetPivot) assetPivot.onclick = () => { const target = selectedItem; const current = target && target.components && target.components['sprite-renderer']; const currentAsset = current && findSpriteAssetById(current.spriteAssetRef); if (!current || !currentAsset) return; pushUndo(); current.pivotX = currentAsset.pivot[0]; current.pivotY = currentAsset.pivot[1]; syncSpriteRenderer(target); renderInspector(); showStatus('Applied Sprite Asset pivot'); };
      const naturalSize = conveniences.querySelector('[data-sprite-natural-size]');
      if (naturalSize) naturalSize.onclick = () => { const target = selectedItem; const current = target && target.components && target.components['sprite-renderer']; const currentAsset = current && findSpriteAssetById(current.spriteAssetRef); const natural = OpusAuthoringPlumbing.spriteNaturalSize(currentAsset, sourceTextureForSpriteAsset(currentAsset)); if (!natural) { showStatus('Natural size unavailable until the source Texture is repaired'); return; } pushUndo(); current.width = natural.width; current.height = natural.height; syncSpriteRenderer(target); renderInspector(); showStatus('Applied Sprite Asset natural size'); };
      const convertLegacy = conveniences.querySelector('[data-sprite-convert-legacy]');
      if (convertLegacy) convertLegacy.onclick = () => { const texture = findTextureAssetById(component.sourceTexture); if (!texture) { showStatus('Legacy Texture is missing; repair it before conversion'); return; } const spriteAsset = createSpriteAssetFromTexture(texture, { select: false }); pushUndo(); component.spriteAssetRef = spriteAsset.id; syncSpriteRenderer(selectedItem); renderInspector(); showStatus('Converted direct Texture source to a reusable Sprite Asset without changing appearance'); };
    }
  }
  const nameRow = document.createElement('div');
  nameRow.className = 'field-row';
  const autoLabel = itemLabel(selectedItem, placed.indexOf(selectedItem));
  nameRow.innerHTML = `<label for="f-name">Object name</label><input type="text" id="f-name" placeholder="${escapeHtml(autoLabel)}" value="${escapeHtml(selectedItem.name || '')}">`;
  inspectorBody.insertBefore(nameRow, inspectorBody.firstChild);
  bindObjectNameField(document.getElementById('f-name'),selectedItem);
  // One shared Hierarchy section for every hierarchy-capable kind (cube,
  // camera, spawner, emitter) rather than duplicating this block into each
  // kind's own inspector branch -- appended here, after the Name row, since
  // this is the one place renderInspector already runs for any single
  // selection regardless of kind.
  if (hierarchyCapable(selectedItem)) {
    const hierarchyRow = document.createElement('div');
    hierarchyRow.className = 'field-row';
    const candidates = placed.filter((p) => p !== selectedItem && hierarchyCapable(p) && !isDescendantOf(p.id, selectedItem));
    const options = candidates.map((p) => `<option value="${p.id}"${selectedItem.parentId === p.id ? ' selected' : ''}>${escapeHtml(itemDisplayName(p, placed.indexOf(p)))}</option>`).join('');
    hierarchyRow.innerHTML = `<label>Parent</label>
      <select id="f-parent"><option value="">None (root object)</option>${options}</select>`;
    inspectorBody.insertBefore(hierarchyRow, nameRow.nextSibling);
    document.getElementById('f-parent').onchange = (e) => {
      pushUndo();
      const newParentId = e.target.value;
      if (!newParentId) {
        unparentItem(selectedItem);
        showStatus('Unparented');
      } else {
        const parentItem = findItemById(newParentId);
        if (reparentItem(selectedItem, parentItem)) showStatus(`Parented to "${itemDisplayName(parentItem, placed.indexOf(parentItem))}"`);
        else renderInspector(); // rejected (cycle) -- reset the dropdown back to the actual current parent
      }
      renderSceneList();
    };
  }
  mountComponentLifecycleControls();
  mountAddComponentWorkflow();
  mountGameplayPresetWorkflow();
  mountPickupSetupWorkflow();
  mountEnvironmentZoneSetup();
  mountComponentPresetWorkflow();
}

