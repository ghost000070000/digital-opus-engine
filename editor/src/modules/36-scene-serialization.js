// Shared by serializeScene AND "Save as Prefab" -- a prefab is exactly one
// cube's serialized record, minus position, so there's exactly one place
// that knows how to turn a live item into portable data.
// Dogfood (Signal Relay) fix: strips the runtime-only fields a State
// Machine AI's own tick writes directly onto its `movement` object at play
// time (`wanderTarget`/`wanderTimer` for Wander; kept as an explicit
// per-field allowlist deletion, not a generic "any key not in the authored
// schema" filter, so a future movement type's own runtime field just needs
// adding here, matching the existing per-field whitelist convention this
// whole record already follows). Deep-clones `states` (never mutates the
// live array) so the object still ticking in `placed` is unaffected by a
// Save happening mid-session.
function sanitizeAiStatesForSave(states) {
  if (!Array.isArray(states)) return states;
  return states.map((s) => {
    const clone = JSON.parse(JSON.stringify(s));
    if (clone?.movement) { delete clone.movement.wanderTarget; delete clone.movement.wanderTimer; }
    return clone;
  });
}
function serializeCubeRecord(item) {
  const authoringItem = authoredHealthSerializationTarget(item);
  const tag = item.assetId ? 'asset' : meshTag(item.entity.mesh);
  const record = {
    kind: 'cube',
    id: item.id,
    name: item.name,
    position: [item.entity.position.x, item.entity.position.y, item.entity.position.z],
    scale: [item.entity.scale.x, item.entity.scale.y, item.entity.scale.z],
    color: item.entity.color.slice(),
    rotationY: item.entity.rotationY,
    // Full XYZ orientation (Wave 5) -- omitted entirely for a pure-yaw
    // object (every pre-Wave-5 save, and any object nobody has pitched or
    // rolled), so an untouched object's record stays byte-for-byte
    // identical to before this feature existed. Present (and authoritative
    // over `rotationY` on load) only once an object genuinely has pitch/roll.
    quaternion: hasPitchOrRoll(item.entity) ? quatToArray(item.entity.quaternion) : undefined,
    behaviors: cloneBehaviors(item.behaviors),
    spin: item.entity.spin || 0,
    patrol: item.entity.patrol ? {
      axis: item.entity.patrol.axis,
      range: item.entity.patrol.range,
      speed: item.entity.patrol.speed,
      phase: item.entity.patrol.phase,
      base: [item.entity.patrol.base.x, item.entity.patrol.base.y, item.entity.patrol.base.z],
    } : null,
    // targetId (Follow Object/Face Target) and waypointNames/loop/pingpong
    // (Patrol Route) were previously silently DROPPED by this whitelist --
    // a Follow Object enemy retargeted onto something other than the
    // Player would revert to Follow-the-Player on the very next Save/Load,
    // with no error. Found and fixed while adding Patrol Route's own
    // fields, which would otherwise have shipped with the exact same gap.
    ai: item.entity.ai ? (() => {
      const captured = OpusAiBrain.captureLegacy(item.entity.ai);
      if (captured.ok) return captured.record.config;
      // Retain malformed historical authoring without adopting it as a Brain.
      const retained = JSON.parse(JSON.stringify(item.entity.ai));
      const base = item.entity.ai.base;
      if (base && [base.x, base.y, base.z].every(Number.isFinite)) retained.base = [base.x, base.y, base.z];
      return retained;
    })() : null,
    // Phase 002: Health remains legacy-backed at runtime while the same
    // authoring data also rides in record.components.health. Keeping this
    // field preserves old readers/exports during incremental migration.
    health: authoringItem.health ? { current: authoringItem.health.current, max: authoringItem.health.max } : undefined,
    mesh: tag,
    isTrigger: item.isTrigger || undefined,
    triggerRepeat: item.isTrigger ? item.triggerRepeat !== false : undefined,
    triggerShape: item.isTrigger && item.triggerShape === 'sphere' ? 'sphere' : undefined,
    isWaypoint: item.isWaypoint || undefined,
    isPathPoint: item.isPathPoint || undefined,
    pathId: item.isPathPoint ? item.pathId : undefined,
    isRamp: item.isRamp || undefined,
    isBillboard: item.isBillboard || undefined,
    billboardMode: (item.isBillboard && item.billboardMode === 'cylindrical') ? 'cylindrical' : undefined,
    spritePassRelation: item.spritePassRelation || item.entity.spritePassRelation || 'behind-sprites',
    // Wave 6 (Priority K): the linked-prefab reference -- see the
    // instantiation call sites' own comment for why this is root-only and
    // manual-sync-only, never automatically propagated.
    sourcePrefabName: item.sourcePrefabName || undefined,
    // Wave 6 (Priority M): opt-in clip-name-driven Idle/Walk/Run/Attack/Death.
    characterAnimSync: item.characterAnimSync || undefined,
    characterAnimRoles: item.characterAnimRoles===undefined?undefined:JSON.parse(JSON.stringify(item.characterAnimRoles)),
    isSpawnPoint: item.isSpawnPoint || undefined,
    isDefaultSpawn: item.isSpawnPoint ? (item.isDefaultSpawn || undefined) : undefined,
    groupId: item.groupId || undefined,
    solid: item.entity.solid || undefined,
    collider: item.collider ? { shape: item.collider.shape, enabled: item.collider.enabled === false ? false : undefined, offset: item.collider.offset, size: item.collider.size, radius: item.collider.radius } : undefined,
    tags: (item.tags && item.tags.length) ? item.tags.slice() : undefined,
    textureAssetId: item.textureAssetId || undefined,
    textureDisabled: item.textureDisabled || undefined,
    // Transform hierarchy (Wave 4). Local fields are plain numbers/arrays,
    // never live Vec3 references -- parentId is a stable id, not an object
    // pointer, so this stays plain portable data with no circular references
    // even when the hierarchy itself has depth.
    parentId: item.parentId || undefined,
    // Wave 7 (Priority A): socketName, saved alongside parentId -- an item
    // attached to a socket IS a hierarchy child (same parentId field), just
    // with this one extra marker telling resolveWorldTransform which of the
    // parent's animated joints to splice into the composition.
    socketName: item.socketName || undefined,
    // Wave 7 (Priority E): OFF by default (undefined, matching every other
    // "omit at default" field in this whitelist) -- opts this object into
    // World State Save Game persistence.
    persistRuntimeState: item.persistRuntimeState || undefined,
    carryable: item.carryable || undefined,
    variables: (item.variables && Object.keys(item.variables).length) ? item.variables : undefined,
    prefabParams: (item.prefabParams && Object.keys(item.prefabParams).length) ? item.prefabParams : undefined,
    localPosition: item.localPosition ? [item.localPosition.x, item.localPosition.y, item.localPosition.z] : undefined,
    localRotationY: (item.parentId && !item.localQuat) ? (item.localRotationY || 0) : undefined,
    localQuat: (item.parentId && item.localQuat) ? quatToArray(item.localQuat) : undefined,
    localScale: item.localScale ? [item.localScale.x, item.localScale.y, item.localScale.z] : undefined,
    // Materials 2.0 -- omitted entirely at defaults so an untouched cube's
    // saved record is byte-for-byte identical to before this feature existed.
    unlit: item.entity.unlit || undefined,
    alpha: (item.entity.alpha !== undefined && item.entity.alpha !== 1) ? item.entity.alpha : undefined,
    emissiveColor: (item.entity.emissiveIntensity) ? item.entity.emissiveColor.slice() : undefined,
    emissiveIntensity: item.entity.emissiveIntensity || undefined,
    uvScale: (item.entity.uvScale && (item.entity.uvScale[0] !== 1 || item.entity.uvScale[1] !== 1)) ? item.entity.uvScale.slice() : undefined,
    uvOffset: (item.entity.uvOffset && (item.entity.uvOffset[0] !== 0 || item.entity.uvOffset[1] !== 0)) ? item.entity.uvOffset.slice() : undefined,
    // Property Animation clips -- plain data (keyframe values are arrays/
    // numbers, never live Vec3s), deep-cloned so a duplicate/reload never
    // aliases the source's track arrays. Runtime playback state (`_anim`)
    // is deliberately NOT included here -- see the definition above.
    animationClips: (item.animationClips && item.animationClips.length) ? JSON.parse(JSON.stringify(item.animationClips)) : undefined,
    // Waypoint Graph connections (Wave 4) -- an array of other Waypoints'
    // stable ids, plain strings, so it rides through the exact same
    // remapObjectIds() whole-JSON id-remapping mechanism Prefabs/Duplicate
    // Level already use for every other internal reference, with zero
    // connections-specific remap code.
    connections: item.connections === undefined ? undefined : JSON.parse(JSON.stringify(item.connections)),
    // Wave 9C -- REAL BUG found live dogfooding Forest Range's Scatter
    // Layer Save/Reload: `scatterLayerId` (Wave 8's own ownership tag) was
    // never added to this whitelist, so it was silently dropped by every
    // Save/export since Scatter ownership was introduced -- a generated
    // object still LOOKED owned in the current in-memory session (Erase
    // Scatter Layer worked fine right after painting), but a fresh reload
    // of the exact same saved project produced 0 objects any layer
    // recognized as its own. Exactly the finding-#48 failure mode this
    // whitelist's own comments warn about, which slipped through anyway.
    scatterLayerId: item.scatterLayerId || undefined,
  };
  const components = OpusAuthoring.serializeComponents(authoringItem);
  if (components) record.components = components;
  if (tag === 'custom') {
    const arrays = Opus.Mesh.toArrays(item.entity.mesh);
    record.customMesh = {
      positions: Array.from(arrays.positions),
      normals: Array.from(arrays.normals),
      indices: Array.from(arrays.indices),
    };
  } else if (tag === 'asset') {
    record.assetId = item.assetId; // the shared payload lives in project.assets, not here
    // Wave 6 (Priority C): which clip THIS instance is playing is
    // per-instance state (two placed copies of the same animated asset can
    // play different clips, or one can be frozen while the other loops), so
    // it lives on the record, not the shared asset payload. Omitted when
    // absent/at the asset's own clip-0 default -- an untouched instance's
    // saved record stays unaffected by this field existing at all.
    if (item.entity.skin && item.entity.animationClip !== 0) record.animationClip = item.entity.animationClip;
    if (item.entity.skin && item.entity.animationBlendTime !== 0) record.animationBlendTime = item.entity.animationBlendTime;
  }
  return record;
}

// One shared record-shape function for any placed item, cube or not --
// factored out of serializeScene so prefab saving (below) can reuse the
// exact same shape instead of a second, drifting implementation.
function serializeItemRecord(item) {
  const record=serializeBaseItemRecord(item);if(item.signalPrefabInstanceId)record.signalPrefabInstanceId=item.signalPrefabInstanceId;return record;
}
function serializeBaseItemRecord(item) {
  if (item.kind === 'cube') return serializeCubeRecord(item);
  if (item.kind === 'sprite') return serializeSpriteRecord(item);
  if (item.kind === 'tilemap') return serializeTilemapRecord(item);
  // Wave 8 (Priority I): a Path's own container item has no `options`
  // shape at all (unlike camera/spawner/emitter/light below) -- its own
  // fields (`pointIds`/`loop`/`smooth`) ARE the record, no position/
  // direction vectors to convert.
  if (item.kind === 'path') {
    const record = { kind: 'path', id: item.id, name: item.name, pointIds: (item.pointIds || []).slice(), loop: item.loop || undefined, smooth: item.smooth || undefined };
    const components = OpusAuthoring.serializeComponents(item);
    if (components) record.components = components;
    return record;
  }
  const opts = item.options;
  const record = {
    kind: item.kind,
    id: item.id,
    name: item.name,
    groupId: item.groupId || undefined,
    isActiveCamera: item.kind === 'camera' && item.isActiveCamera ? true : undefined,
    sourcePrefabName: item.sourcePrefabName || undefined,
    options: {
      ...opts,
      position: opts.position ? [opts.position.x, opts.position.y, opts.position.z] : undefined,
      direction: opts.direction ? [opts.direction.x, opts.direction.y, opts.direction.z] : undefined,
    },
    parentId: item.parentId || undefined,
    // Wave 7 (Priority A): socketName, saved alongside parentId -- an item
    // attached to a socket IS a hierarchy child (same parentId field), just
    // with this one extra marker telling resolveWorldTransform which of the
    // parent's animated joints to splice into the composition.
    socketName: item.socketName || undefined,
    // Wave 7 (Priority E): OFF by default (undefined, matching every other
    // "omit at default" field in this whitelist) -- opts this object into
    // World State Save Game persistence.
    persistRuntimeState: item.persistRuntimeState || undefined,
    carryable: item.carryable || undefined,
    variables: (item.variables && Object.keys(item.variables).length) ? item.variables : undefined,
    prefabParams: (item.prefabParams && Object.keys(item.prefabParams).length) ? item.prefabParams : undefined,
    localPosition: item.localPosition ? [item.localPosition.x, item.localPosition.y, item.localPosition.z] : undefined,
    localRotationY: (item.parentId && !item.localQuat) ? (item.localRotationY || 0) : undefined,
    localQuat: (item.parentId && item.localQuat) ? quatToArray(item.localQuat) : undefined,
    localScale: item.localScale ? [item.localScale.x, item.localScale.y, item.localScale.z] : undefined,
  };
  const components = OpusAuthoring.serializeComponents(item);
  if (components) record.components = components;
  return record;
}

function serializeTilemapRecord(item) {
  return {
    kind: 'tilemap', version: 6, id: item.id, name: item.name || 'Tilemap',
    sourcePrefabName: item.sourcePrefabName || undefined,
    prefabParams: item.prefabParams ? JSON.parse(JSON.stringify(item.prefabParams)) : undefined,
    position: [item.entity.position.x, item.entity.position.y, item.entity.position.z],
    scale: [item.entity.scale.x, item.entity.scale.y, item.entity.scale.z],
    rotationY: item.entity.rotationY,
    quaternion: hasPitchOrRoll(item.entity) ? quatToArray(item.entity.quaternion) : undefined,
    tilesetRef: item.tilesetRef || null,
    layers: OpusAuthoringPlumbing.serializeTilemapLayers(item),
    sortingLayerRef: item.sortingLayerRef || DEFAULT_SPRITE_SORTING_LAYER_ID,
    orderInLayer: Number.isInteger(item.orderInLayer) ? item.orderInLayer : 0,
    spawnMarkers: OpusAuthoringPlumbing.canonicalizeSpawnMarkers(item.spawnMarkers),
    groupId: item.groupId || undefined, parentId: item.parentId || undefined,
    localPosition: item.localPosition ? [item.localPosition.x, item.localPosition.y, item.localPosition.z] : undefined,
    localRotationY: (item.parentId && !item.localQuat) ? (item.localRotationY || 0) : undefined,
    localQuat: (item.parentId && item.localQuat) ? quatToArray(item.localQuat) : undefined,
    localScale: item.localScale ? [item.localScale.x, item.localScale.y, item.localScale.z] : undefined,
  };
}

function instantiateTilemapRecord(record) {
  const entity = app.addEntity({ mesh: spriteMesh, color: [1, 1, 1], position: new Opus.Vec3(...(record.position || [0, 1, 0])), scale: new Opus.Vec3(...(record.scale || [1, 1, 1])), rotationY: record.rotationY || 0 });
  if (record.quaternion) entity.quaternion = quatFromArray(record.quaternion);
  const item = Object.assign(OpusAuthoringPlumbing.createTilemapRecord(record), {
    entity,
    sourcePrefabName: record.sourcePrefabName || undefined,
    prefabParams: record.prefabParams ? JSON.parse(JSON.stringify(record.prefabParams)) : undefined,
    groupId: record.groupId || undefined, parentId: record.parentId || undefined,
    localPosition: record.localPosition ? new Opus.Vec3(...record.localPosition) : undefined,
    localRotationY: record.parentId ? (record.localRotationY || 0) : undefined,
    localQuat: record.parentId && record.localQuat ? quatFromArray(record.localQuat) : undefined,
    localScale: record.localScale ? new Opus.Vec3(...record.localScale) : undefined,
  });
  syncTilemapRenderer(item); return item;
}

function serializeSpriteRecord(item) {
  item = authoredHealthSerializationTarget(item);
  const record = {
    kind: 'sprite', id: item.id, name: item.name,
    animationClips: item.animationClips?.length ? JSON.parse(JSON.stringify(item.animationClips)) : undefined,
    position: [item.entity.position.x, item.entity.position.y, item.entity.position.z],
    scale: [item.entity.scale.x, item.entity.scale.y, item.entity.scale.z],
    rotationY: item.entity.rotationY,
    quaternion: hasPitchOrRoll(item.entity) ? quatToArray(item.entity.quaternion) : undefined,
    behaviors: cloneBehaviors(item.behaviors), groupId: item.groupId || undefined,
    // Phase 016: Sprite uses the same linked-prefab bookkeeping as every
    // other prefab-capable object. Omitting these fields made a Sprite look
    // correct after reload while silently losing Update From Prefab and
    // allowing the prefab definition to be pruned from an export.
    sourcePrefabName: item.sourcePrefabName || undefined,
    prefabParams: (item.prefabParams && Object.keys(item.prefabParams).length) ? { ...item.prefabParams } : undefined,
    parentId: item.parentId || undefined, socketName: item.socketName || undefined,
    localPosition: item.localPosition ? [item.localPosition.x, item.localPosition.y, item.localPosition.z] : undefined,
    localRotationY: (item.parentId && !item.localQuat) ? (item.localRotationY || 0) : undefined,
    localQuat: (item.parentId && item.localQuat) ? quatToArray(item.localQuat) : undefined,
    localScale: item.localScale ? [item.localScale.x, item.localScale.y, item.localScale.z] : undefined,
  };
  const components = OpusAuthoring.serializeComponents(item);
  if (components) record.components = components;
  return record;
}

function instantiateSpriteRecord(record, position) {
  const entity = app.addEntity({ mesh: spriteMesh, color: [1, 1, 1], position, scale: new Opus.Vec3(...(record.scale || [1, 1, 1])), rotationY: record.rotationY || 0 });
  if (record.quaternion) entity.quaternion = quatFromArray(record.quaternion);
  const item = {
    kind: 'sprite', entity, behaviors: cloneBehaviors(record.behaviors),
    animationClips: record.animationClips ? JSON.parse(JSON.stringify(record.animationClips)) : [],
    _spriteAnimationPlayback: null,
    sourcePrefabName: record.sourcePrefabName || undefined,
    prefabParams: record.prefabParams ? { ...record.prefabParams } : undefined,
    groupId: record.groupId || undefined, parentId: record.parentId || undefined, socketName: record.socketName || undefined,
    localPosition: record.localPosition ? new Opus.Vec3(...record.localPosition) : undefined,
    localRotationY: record.parentId ? (record.localRotationY || 0) : undefined,
    localQuat: (record.parentId && record.localQuat) ? quatFromArray(record.localQuat) : undefined,
    localScale: record.localScale ? new Opus.Vec3(...record.localScale) : undefined,
  };
  OpusAuthoring.applyRecord(record, item);
  OpusAuthoring.ensureComponent(item, 'sprite-renderer');
  syncSpriteRenderer(item);
  if (playMode) resetSpriteAnimationForItem(item, true);
  return item;
}
function serializeScene() {
  // Spawn Prefab/projectiles are session furniture, not authoring mutations.
  // Game-world Save deliberately reads placed directly and keeps live state.
  const records = placed.filter(item => !playMode || !item.runtimeSpawned).map(serializeItemRecord);
  return playMode ? includeAuthoredDeaths(records, arguments[0] !== true) : records;
}

// The inverse of serializeCubeRecord -- builds a fresh placed item (a new
// engine entity, NOT yet added to `placed` or given an id) from a cube
// record, at the given position. Shared by loadScene (position = the
// record's own saved position) and prefab placement (position = wherever
// the user drops it), so there's one place that knows how to reconstruct a
// cube item from data, instead of two reconstructions drifting apart.
function instantiateCubeRecord(record, position, originDelta = null) {
  let mesh = cubeMesh;
  if (record.mesh === 'mine') mesh = mineMesh;
  else if (record.mesh === 'boost') mesh = boostMesh;
  else if (record.mesh === 'wedge') mesh = wedgeMesh;
  else if (record.mesh === 'billboard') mesh = billboardMesh;
  else if (record.mesh === 'custom' && record.customMesh) {
    mesh = Opus.Mesh.fromArrays(
      new Float32Array(record.customMesh.positions),
      new Float32Array(record.customMesh.normals),
      new Uint16Array(record.customMesh.indices),
    );
  } else if (record.mesh === 'asset' && record.assetId) {
    const asset = findAssetById(record.assetId);
    // Missing asset (e.g. a project.assets bundle that failed to load) --
    // falls back to a visible placeholder rather than throwing and aborting
    // the whole scene load, so the rest of the level still comes in intact.
    mesh = asset ? getAssetMeshHandle(asset) : cubeMesh;
  }
  const entity = app.addEntity({
    // Wave 8 (Priority C dogfood, a real bug found via Prefab Parameters'
    // own Color binding): `.slice()`, not the SAME array reference from
    // `record`. `record` (a prefab's own stored record, or a normal
    // instantiate-from-save-data record) is reused for EVERY instance
    // spawned/instantiated from it -- `Entity` stores whatever color array
    // it's given directly (no internal clone), so multiple entities built
    // from the same record used to share ONE mutable color array. A
    // parameter binding (or anything else) mutating one instance's own
    // `entity.color[i]` in place therefore silently repainted EVERY other
    // instance built from the same record too, including ones spawned
    // earlier. Reproduced live: 3 waves of a "ConfigurableEnemy" prefab
    // spawned with 3 different Color parameter overrides all ended up the
    // LAST wave's own color. Fixed with `.slice()` here, the one place
    // every cube-kind instantiation path (palette placement, Spawner,
    // runtime Spawn Prefab, Save/Load) already funnels through.
    mesh, color: record.color.slice(), position, scale: new Opus.Vec3(...record.scale), rotationY: record.rotationY,
  });
  // Full XYZ orientation (Wave 5) -- present only on a record that has
  // genuine pitch/roll (see hasPitchOrRoll's own comment); overrides the
  // Y-only `rotationY` already applied above. A pre-Wave-5 record has no
  // `quaternion` field at all, so `entity.quaternion` stays exactly the
  // pure-Y quaternion the constructor's own `rotationY` param already set.
  if (record.quaternion) entity.quaternion = quatFromArray(record.quaternion);
  if (record.spin) entity.spin = record.spin;
  if (record.patrol) entity.patrol = { ...record.patrol, base: new Opus.Vec3(...record.patrol.base) };
  // `sanitizeAiStatesForSave` on the load side too, defensively -- a project
  // saved before this fix existed (or one hand-edited/round-tripped
  // outside the editor) can already have a polluted plain-object
  // `wanderTarget` baked into `states[*].movement` on disk; loading it
  // straight through would carry that same non-Vec3 object into a fresh
  // session and throw on the very first wander tick.
  if (record.ai) {
    const authoredAi = JSON.parse(JSON.stringify(record.ai));
    entity.ai = { ...authoredAi, base: new Opus.Vec3(...record.ai.base), states: record.ai.mode === 'stateMachine' ? sanitizeAiStatesForSave(authoredAi.states) : authoredAi.states };
  }
  if (record.solid) entity.solid = true;
  // Wave 6 (Priority C): App.addEntity already set entity.skin/animationClip
  // (defaulting to clip 0) if this asset is a skinned mesh -- override the
  // default ONLY when the record explicitly saved a different clip for
  // THIS instance (see serializeCubeRecord's own comment on why that's
  // per-instance, not per-asset).
  if (entity.skin && record.animationClip !== undefined) entity.animationClip = record.animationClip;
  if (entity.skin && Object.prototype.hasOwnProperty.call(record, 'animationBlendTime')) entity.animationBlendTime = record.animationBlendTime;
  const meshAsset = record.assetId ? findAssetById(record.assetId) : null;
  const textureAssetId = record.textureDisabled?null:record.textureAssetId || (meshAsset && meshAsset.textureAssetId);
  if (textureAssetId) {
    const texAsset = findTextureAssetById(textureAssetId);
    if (texAsset) applyTextureToEntity(entity, texAsset);
  }
  if (record.unlit) entity.unlit = true;
  if (record.alpha !== undefined) entity.alpha = record.alpha;
  entity.spritePassRelation = Opus.normalizeSpritePassRelation(record.spritePassRelation);
  if (record.emissiveColor) entity.emissiveColor = record.emissiveColor.slice();
  if (record.emissiveIntensity) entity.emissiveIntensity = record.emissiveIntensity;
  if (record.uvScale) entity.uvScale = record.uvScale.slice();
  if (record.uvOffset) entity.uvOffset = record.uvOffset.slice();
  const animationClips = record.animationClips ? JSON.parse(JSON.stringify(record.animationClips)) : undefined;
  const item = {
    kind: 'cube', entity, behaviors: cloneBehaviors(record.behaviors),
    isTrigger: record.isTrigger || undefined, triggerRepeat: record.triggerRepeat !== false,
    triggerShape: record.triggerShape === 'sphere' ? 'sphere' : undefined,
    collider: record.collider ? JSON.parse(JSON.stringify(record.collider)) : undefined,
    isWaypoint: record.isWaypoint || undefined,
    isPathPoint: record.isPathPoint || undefined,
    pathId: record.isPathPoint ? record.pathId : undefined,
    isRamp: record.isRamp || undefined,
    isBillboard: record.isBillboard || undefined,
    billboardMode: record.billboardMode === 'cylindrical' ? 'cylindrical' : 'full',
    spritePassRelation: record.spritePassRelation || 'behind-sprites',
    sourcePrefabName: record.sourcePrefabName || undefined,
    characterAnimSync: record.characterAnimSync || undefined,
    characterAnimRoles: record.characterAnimRoles===undefined?undefined:JSON.parse(JSON.stringify(record.characterAnimRoles)),
    isSpawnPoint: record.isSpawnPoint || undefined,
    isDefaultSpawn: record.isDefaultSpawn || undefined,
    tags: record.tags ? record.tags.slice() : undefined,
    assetId: record.assetId || undefined,
    textureAssetId: record.textureAssetId || undefined,
    textureDisabled: record.textureDisabled || undefined,
    parentId: record.parentId || undefined,
    socketName: record.socketName || undefined,
    persistRuntimeState: record.persistRuntimeState || undefined,
    carryable: record.carryable || undefined,
    // Wave 8 (Priority B): a plain copy, not a shared reference -- each
    // revived instance (including every member of a Duplicate/Array/Scatter
    // batch built from the SAME source record) gets its own independent
    // `variables` object, never one shared mutable object two instances
    // could silently cross-contaminate through.
    variables: record.variables ? { ...record.variables } : undefined,
    // Dogfood (Signal Relay) fix: a second, untouched copy of the AUTHORED
    // variables, kept alongside the live/mutable `variables` above. Play
    // mutates `variables` in place on this SAME item object (Stop/Play does
    // not rebuild `placed` from records), so without a separate baseline
    // there was nothing for enterPlayMode's fresh-session reset to restore
    // `variables` back to -- every other piece of runtime state
    // (gameState/worldState/objectives/flags/inventory/equipment/held
    // object/...) already resets on every fresh Play, but an object's own
    // `setObjectVariable` writes silently leaked from one Play attempt into
    // the next. See the matching reset in enterPlayMode.
    _authoredVariables: record.variables ? { ...record.variables } : {},
    prefabParams: record.prefabParams ? { ...record.prefabParams } : undefined,
    localPosition: record.localPosition ? new Opus.Vec3(...record.localPosition) : undefined,
    localRotationY: record.parentId ? (record.localRotationY || 0) : undefined,
    localQuat: (record.parentId && record.localQuat) ? quatFromArray(record.localQuat) : undefined,
    localScale: record.localScale ? new Opus.Vec3(...record.localScale) : undefined,
    animationClips,
    connections: record.connections === undefined ? undefined : JSON.parse(JSON.stringify(record.connections)),
    scatterLayerId: record.scatterLayerId || undefined, // Wave 9C -- see serializeCubeRecord's own comment; this is the read-back half of that same fix
  };
  OpusAuthoring.applyRecord(record, item);
  if (entity.ai) {
    const captured = OpusAiBrain.captureLegacy(entity.ai);
    if (captured.ok) {
      const config = captured.record.config;
      const delta = originDelta || (Array.isArray(record.position) && record.position.length === 3
        ? new Opus.Vec3(position.x - record.position[0], position.y - record.position[1], position.z - record.position[2])
        : new Opus.Vec3(0, 0, 0));
      if (Array.isArray(config.base) && [delta.x, delta.y, delta.z].every(Number.isFinite)) {
        config.base = config.base.map((v, i) => v + [delta.x, delta.y, delta.z][i]);
      }
      entity.ai = { ...config, base: new Opus.Vec3(...(config.base || [position.x, position.y, position.z])) };
      const brain = OpusAiBrain.inspect(item.components?.['ai-brain']);
      if (brain.ok) {
        brain.record.config = JSON.parse(JSON.stringify(config));
        item.components['ai-brain'] = brain.record;
      }
    }
  }
  return item;
}

// The non-cube counterpart to instantiateCubeRecord -- camera/spawner/
// emitter and environment records. Environment pieces remain outside ordinary
// entity hierarchy, but multi-selection Prefab capture can include them.
// Builds a fresh item, NOT yet added to
// `placed` or given an id/name/groupId (caller's job, same contract as
// instantiateCubeRecord) -- shared by loadScene and Prefabs 2.0 instantiation
// so there is exactly one place that knows how to reconstruct each kind.
function instantiateItemFromRecord(record) {
  if (record.kind === 'sprite') return instantiateSpriteRecord(record, new Opus.Vec3(...record.position));
  if (record.kind === 'tilemap') return instantiateTilemapRecord(record);
  if (record.kind === 'terrain' || record.kind === 'water') {
    // Independent edit grids/layers for each reusable environment instance.
    const options = JSON.parse(JSON.stringify(record.options || {}));
    if (options.position) options.position = new Opus.Vec3(...options.position);
    const handle = record.kind === 'terrain' ? app.createTerrain(options) : app.createWater(options);
    const item = OpusAuthoring.applyRecord(record, { kind: record.kind, handle, options });
    if (record.kind === 'terrain') syncTerrainLayerTextures(item);
    return item;
  }
  const opts = { ...record.options };
  if(record.kind==='light'&&Array.isArray(opts.color))opts.color=opts.color.slice();
  if (opts.position) opts.position = new Opus.Vec3(...opts.position);
  if (opts.direction) opts.direction = new Opus.Vec3(...opts.direction);
  const hierarchyFields = {
    sourcePrefabName: record.sourcePrefabName || undefined,
    parentId: record.parentId || undefined,
    socketName: record.socketName || undefined,
    persistRuntimeState: record.persistRuntimeState || undefined,
    carryable: record.carryable || undefined,
    // Wave 8 (Priority B): a plain copy, not a shared reference -- each
    // revived instance (including every member of a Duplicate/Array/Scatter
    // batch built from the SAME source record) gets its own independent
    // `variables` object, never one shared mutable object two instances
    // could silently cross-contaminate through.
    variables: record.variables ? { ...record.variables } : undefined,
    _authoredVariables: record.variables ? { ...record.variables } : {}, // see instantiateCubeRecord's own comment on this field
    prefabParams: record.prefabParams ? { ...record.prefabParams } : undefined,
    localPosition: record.localPosition ? new Opus.Vec3(...record.localPosition) : undefined,
    localRotationY: record.parentId ? (record.localRotationY || 0) : undefined,
    localQuat: (record.parentId && record.localQuat) ? quatFromArray(record.localQuat) : undefined,
    localScale: record.localScale ? new Opus.Vec3(...record.localScale) : undefined,
  };
  // Wave 8 (Priority I): a Path has no entity/handle at all -- its own
  // point markers (ordinary `kind:'cube'` records elsewhere in the same
  // level) carry the actual positions; this container just remembers
  // which marker ids, in what order.
  if (record.kind === 'path') return OpusAuthoring.applyRecord(record, { kind: 'path', name: record.name, pointIds: (record.pointIds || []).slice(), loop: record.loop || false, smooth: record.smooth || false });
  if (record.kind === 'camera') {
    const cameraOptions = normalizeCameraOptions(opts);
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.95, 0.75, 0.15], position: cameraOptions.position.clone(), scale: new Opus.Vec3(0.45, 0.45, 0.7) });
    return OpusAuthoring.applyRecord(record, { kind: 'camera', entity, options: cameraOptions, isActiveCamera: !!record.isActiveCamera, ...hierarchyFields });
  }
  if (record.kind === 'spawner') {
    const entity = app.addEntity({ mesh: cubeMesh, color: [0.95, 0.5, 0.2], position: opts.position.clone(), scale: new Opus.Vec3(0.5, 1.2, 0.5) });
    return OpusAuthoring.applyRecord(record, { kind: 'spawner', entity, options: opts, ...hierarchyFields });
  }
  if (record.kind === 'light') {
    const isSpot = opts.lightType === 'spot';
    const entity = app.addEntity({ mesh: cubeMesh, color: isSpot ? [1, 0.85, 0.3] : [1, 0.95, 0.6], position: opts.position.clone(), scale: new Opus.Vec3(0.35, 0.35, 0.35) });
    const lightHandle = app.createLight({ type: opts.lightType, position: opts.position.clone(), color: opts.color, intensity: opts.intensity, range: opts.range, angle: opts.angle, direction: opts.direction, enabled: opts.enabled });
    return OpusAuthoring.applyRecord(record, { kind: 'light', entity, options: opts, lightHandle, ...hierarchyFields });
  }
  // emitter
  const handle = app.createEmitter(opts);
  return OpusAuthoring.applyRecord(record, { kind: 'emitter', handle, options: opts, ...hierarchyFields });
}

function loadScene(data) {
  validateImportedSceneRecords(data, 'Scene');
  deselectAll();
  for (const item of placed.slice()) {
    if (item.kind === 'cube' || item.kind === 'sprite' || item.kind === 'tilemap') app.scene.remove(item.entity);
    else if (item.kind === 'terrain') app.removeTerrain(item.handle);
    else if (item.kind === 'water') app.removeWater(item.handle);
    else if (item.kind === 'emitter') app.removeEmitter(item.handle);
    else if (item.kind === 'camera') app.scene.remove(item.entity);
    else if (item.kind === 'spawner') app.scene.remove(item.entity);
    else if (item.kind === 'light') { app.scene.remove(item.entity); app.removeLight(item.lightHandle); }
  }
  placed.length = 0;
  trigger2DObjects.clear();
  body2DObjects.clear();

  for (const record of data) {
    let item;
    if (record.kind === 'cube') {
      item = instantiateCubeRecord(record, new Opus.Vec3(...record.position));
    } else if (record.kind === 'sprite' || record.kind === 'tilemap' || record.kind === 'camera' || record.kind === 'spawner' || record.kind === 'emitter' || record.kind === 'light' || record.kind === 'path') {
      item = instantiateItemFromRecord(record);
    } else {
      const opts = { ...record.options };
      if (opts.position) opts.position = new Opus.Vec3(...opts.position);
      const handle = record.kind === 'terrain' ? app.createTerrain(opts) : app.createWater(opts);
      item = { kind: record.kind, handle, options: opts };
      if (record.kind === 'terrain') syncTerrainLayerTextures(item);
    }
    item.id = record.id;
    item.name = record.name;
    item.groupId = record.groupId;
    item.signalPrefabInstanceId = record.signalPrefabInstanceId;
    addPlaced(item);
  }
  hierarchyTickToken++; // force a fresh resolve pass so every parented item's entity.* reflects its loaded local transform immediately, not next frame
  updateHierarchyTransforms();
  renderSceneList();
}

