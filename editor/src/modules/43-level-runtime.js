// The mid-PLAY counterpart to switchToLevel -- used by the Switch Level
// action (a gameplay-triggered transition, not an editor authoring action).
// Deliberately does NOT reset window.__gameState/undo/selection the way
// the editor-authoring path does: this happens mid-session, so score/lives
// must carry over (see the Switch Level action's own comment), and there's
// no editor selection or undo history to speak of during Play anyway.
function switchToLevelDuringPlay(index, equipmentSnapshot) {
  const carriedEquipment = equipmentSnapshot || capturePlayerEquipment();
  const transitionPressBarrier = captureInputContextPressVersions();
  releaseTouchInputControls();
  resetTransientScreens();
  signalRuntime.clear();
  if (body2DManager) body2DManager.clearCharacterCollision2DState();
  resetParallaxRuntime();
  if (trigger2DManager) trigger2DManager.reset();
  window.__currentTrigger2DEvent = null;
  restoreAuthoredBody2DTransforms();
  syncCurrentLevelObjects(true); // Explicit runtime level view; not project/export authoring.
  currentLevelIndex = index;
  playTriggers = [];
  // Wave 6B (Priority E): cancel every in-flight Sequence cleanly on Restart
  // Level / Switch Level (both funnel through here) -- a mid-cutscene Delay
  // must never fire its continuation into a level it no longer belongs to.
  // Scoped to sequence-tagged deferred calls specifically (`sequenceRun:
  // true`), leaving any unrelated deferred work (e.g. a Priority M death-
  // animation removal already in flight) undisturbed.
  runningSequenceIds = [];
  deferredCalls = deferredCalls.filter((d) => !d.sequenceRun);
  playerFrozen = false; // Cutscene Freeze belongs to the outgoing Level; destination OnStart may establish its own.
  activeCameraBlend = null; // Priority K: a mid-blend camera transition must never keep interpolating into a level it no longer belongs to
  activeCameraPath = null; // Wave 9C (Section 27): a mid-flight Camera Path must not keep sampling a Path object that no longer belongs to the current level either
  lastAppliedCameraItemId = null;
  loadScene(levels[index].objects);
  captureAuthoredBody2DTransforms();
  applyLevelEnvironment(index);
  applyLevelPlayerSettings(index);
  // resetTransientScreens retires the old context. Keep only pre-transition
  // press epochs blocked; never replay a Pause-menu tap on the fresh Player.
  if(inputContextRuntime)inputContextRuntime.blockedPressCodes=transitionPressBarrier;
  applyLevelUiConfig(index);
  applyLevelSequences(index);
  applyLevelObjectiveDefs(index);
  applyLevelScatterLayers(index);
  applyLevelAmbientAudio(index);
  startAmbientAudioForCurrentLevel();
  initFogZonesForCurrentLevel();
  preparePlacedForPlay();
  for (const item of placed) wireItemTrigger(item);
  // Wave 9B -- same fix as enterPlayMode's own (see its comment): the OLD
  // level's Player must be despawned and the NEW level's Player spawned
  // BEFORE this level's own Start behaviors run, so an Equip Item (or any
  // other Player-touching) Start behavior on the newly entered level acts
  // on a real, live Player instead of `null` or a about-to-be-destroyed one.
  despawnPlayer();
  spawnPlayer(computeSpawnPoint());
  // Rebuild only logical equipment through the existing inventory-checked path;
  // new-level Start Actions intentionally remain free to override it afterwards.
  restorePlayerEquipment(carriedEquipment);
  const authoredActiveCamera = placed.find((item) => item.kind === 'camera' && item.isActiveCamera);
  if (authoredActiveCamera) applyCameraPreset(authoredActiveCamera);
  captureParallaxReference();
  runStartBehaviors();
  renderLevelList();
}

document.getElementById('add-level-btn').addEventListener('click', () => {
  const name = document.getElementById('level-name-input').value.trim() || `Level ${levels.length + 1}`;
  syncCurrentLevelObjects();
  levels.push({ id: generateLevelId(), name, objects: [], environment: null, playerSettings: null, ui: null, description: '', ambientAudio: null, sequences: [], scatterLayers: [] });
  switchToLevel(levels.length - 1);
});
document.getElementById('rename-level-btn').addEventListener('click', () => {
  const index = Number(document.getElementById('level-select').value);
  const name = document.getElementById('level-name-input').value.trim();
  if (!name || Number.isNaN(index)) return;
  levels[index].name = name;
  renderLevelList();
});
document.getElementById('switch-level-btn').addEventListener('click', () => {
  const index = Number(document.getElementById('level-select').value);
  if (!Number.isNaN(index)) switchToLevel(index);
});
document.getElementById('delete-level-btn').addEventListener('click', () => {
  if (levels.length <= 1) { showStatus("Can't delete the only level"); return; }
  const index = Number(document.getElementById('level-select').value);
  if (Number.isNaN(index)) return;
  const deletedName = levels[index].name;
  levels.splice(index, 1);
  if (currentLevelIndex >= levels.length) currentLevelIndex = levels.length - 1;
  else if (index < currentLevelIndex) currentLevelIndex -= 1;
  else if (index === currentLevelIndex) {
    // The active level was deleted out from under itself -- load whichever
    // level now sits at that same slot instead of leaving `placed` pointing
    // at data that no longer exists anywhere in `levels`.
    currentLevelIndex = Math.min(index, levels.length - 1);
    loadScene(levels[currentLevelIndex].objects);
    applyLevelEnvironment(currentLevelIndex);
    applyLevelPlayerSettings(currentLevelIndex);
    applyLevelUiConfig(currentLevelIndex);
    applyLevelSequences(currentLevelIndex);
    applyLevelObjectiveDefs(currentLevelIndex);
  applyLevelScatterLayers(currentLevelIndex);
  }
  renderLevelList();
  showStatus(`Deleted "${deletedName}"`);
});
// Every object inside a duplicated level gets a FRESH id, with every
// internal reference (targetId/aiTargetId/lookAtTargetId/groupId/...)
// remapped to match -- otherwise the duplicate's behaviors/Node Graphs
// would keep pointing at the ORIGINAL level's objects by coincidence of
// sharing the same id strings. Fresh ids are guaranteed never to have
// existed before (monotonic counter), so a straightforward quoted-string
// swap across the whole serialized subtree is safe and exact -- no risk of
// a fresh id colliding with another old id mid-remap.
// Wave 6B (Priority M): optional second array (`extraArray`) -- when
// passed, IDs are collected from `objectsArray` exactly as before, but the
// substitution pass runs across BOTH arrays together, so any reference to a
// remapped object id living OUTSIDE `objectsArray` itself (a Sequence
// step's `cameraId`/`targetId` param, see Duplicate Level below) gets
// rewritten consistently too -- for free, via the same whole-JSON-string
// substitution trick, no separate per-field-name reference-walking code.
// Existing single-argument callers (Prefab instantiation) are unaffected:
// omitting `extraArray` returns exactly the old single-array shape.
function remapObjectIds(objectsArray, extraArray) {
  const idMap = new Map();
  for (const record of objectsArray) {
    if (record.id) idMap.set(record.id, generateItemId());
  }
  let json = JSON.stringify(extraArray !== undefined ? [objectsArray, extraArray] : objectsArray);
  const containsCustomActionData = json.includes('"custom_');
  for (const [oldId, newId] of idMap) json = json.split(`"${oldId}"`).join(`"${newId}"`);
  const parsed = JSON.parse(json);
  // Scene collections are editor-only labels, not reference-bearing records.
  // Preserve the complete component (including future/extension bytes) while
  // normal identity/parent/logic references continue using the shared remap.
  const copiedObjects = extraArray !== undefined ? parsed[0] : parsed;
  objectsArray.forEach((record, index) => {
    if (record.components && Object.prototype.hasOwnProperty.call(record.components, 'scene-collection')) {
      copiedObjects[index].components['scene-collection'] = JSON.parse(JSON.stringify(record.components['scene-collection']));
    }
  });
  // Keep the historical broad remap for built-ins. Custom Action parameters
  // are schema-owned: an Object reference moves, a text value equal to an ID
  // must not silently change. Missing host schemas retain inert bytes instead
  // of guessing which unknown fields might contain references.
  function restoreCustomParameters(original, copy) {
    if (!original || typeof original !== 'object' || !copy || typeof copy !== 'object') return;
    const type = [original.action, original.actionType, original.type].find(value => typeof value === 'string' && value.startsWith('custom_'));
    if (type) {
      const graphNode = original.type === type, params = graphNode ? original : original.params;
      if (params && typeof params === 'object' && !Array.isArray(params)) {
        const restored = JSON.parse(JSON.stringify(params));
        const definition = typeof ACTION_TYPES !== 'undefined' && Object.prototype.hasOwnProperty.call(ACTION_TYPES,type) ? ACTION_TYPES[type] : null;
        for (const field of definition?.fields || []) if (field.type === 'target' && typeof params[field.key] === 'string' && idMap.has(params[field.key])) restored[field.key] = idMap.get(params[field.key]);
        if (graphNode) {
          // Node IDs/flow edges keep the existing shared remap semantics.
          for (const key of Object.keys(copy)) if (key !== 'id') delete copy[key];
          for (const key of Object.keys(restored)) if (key !== 'id') Object.defineProperty(copy,key,{value:restored[key],enumerable:true,writable:true,configurable:true});
        } else copy.params = restored;
      }
      if (!graphNode && Object.prototype.hasOwnProperty.call(original,'param')) copy.param = original.param;
    }
    for (const key of Object.keys(original)) if (original[key] && typeof original[key] === 'object' && copy[key] && typeof copy[key] === 'object') restoreCustomParameters(original[key],copy[key]);
  }
  if (containsCustomActionData) restoreCustomParameters(extraArray !== undefined ? [objectsArray,extraArray] : objectsArray, parsed);
  return extraArray !== undefined ? { objects: parsed[0], extra: parsed[1] } : parsed;
}
// "<Name> Copy", then "<Name> Copy 2", "<Name> Copy 3", ... -- never two
// levels silently sharing a display name.
function collisionSafeLevelName(baseName) {
  let candidate = `${baseName} Copy`;
  let n = 2;
  while (levels.some((l) => l.name === candidate)) { candidate = `${baseName} Copy ${n}`; n += 1; }
  return candidate;
}
document.getElementById('duplicate-level-btn').addEventListener('click', () => {
  const index = Number(document.getElementById('level-select').value);
  if (Number.isNaN(index)) return;
  syncCurrentLevelObjects(); // capture any in-progress edits on the active level before cloning ANY level's data
  const src = levels[index];
  // Deep-cloned, not shared references -- editing the duplicate's objects/
  // environment/HUD later must never silently also edit the source's.
  // Wave 6B (Priority M): `sequences` included here too -- an earlier
  // version of this handler (matching the same gap `serializeProject` had,
  // see Priority E's own CHANGELOG entry) silently dropped every Sequence
  // on Duplicate Level, found by this exact priority's own asset-heavy
  // dogfood requirement, not assumed correct from reading the code alone.
  const clone = JSON.parse(JSON.stringify({ objects: src.objects, environment: src.environment, playerSettings: src.playerSettings, ui: src.ui, description: src.description, ambientAudio: src.ambientAudio, sequences: src.sequences, objectiveDefs: src.objectiveDefs, scatterLayers: src.scatterLayers }));
  // Remapping objects and sequences TOGETHER (not two separate passes) is
  // what lets a Sequence step's own `cameraId`/`targetId` param -- an object
  // id reference living OUTSIDE `objects` itself -- get rewritten to point
  // at the DUPLICATE's own remapped objects, not silently left pointing at
  // the original level's (or nothing, since a re-generated id would no
  // longer exist in either level otherwise).
  const remapped = remapObjectIds(clone.objects, { sequences: clone.sequences || [], platformerObjectRef: clone.playerSettings && clone.playerSettings.platformerObjectRef, topdownObjectRef: clone.playerSettings && clone.playerSettings.topdownObjectRef });
  clone.objects = remapped.objects;
  clone.sequences = remapped.extra.sequences;
  if (clone.playerSettings && Object.prototype.hasOwnProperty.call(clone.playerSettings, 'platformerObjectRef')) clone.playerSettings.platformerObjectRef = remapped.extra.platformerObjectRef;
  if (clone.playerSettings && Object.prototype.hasOwnProperty.call(clone.playerSettings, 'topdownObjectRef')) clone.playerSettings.topdownObjectRef = remapped.extra.topdownObjectRef;
  // Wave 9C (Section 5): Scatter Layer ids stay independent between the
  // source and the duplicate -- freshly generated here, then every cloned
  // object's own `scatterLayerId` tag is remapped to match, the same
  // "remap ids, then rewrite every reference to them together" approach
  // `remapObjectIds` already established for objects/sequences just above.
  if (Array.isArray(clone.scatterLayers) && clone.scatterLayers.length) {
    const layerIdMap = {};
    clone.scatterLayers = clone.scatterLayers.map((l) => {
      const newId = generateScatterLayerId();
      layerIdMap[l.id] = newId;
      return { ...l, id: newId };
    });
    for (const obj of clone.objects) { if (obj.scatterLayerId && layerIdMap[obj.scatterLayerId]) obj.scatterLayerId = layerIdMap[obj.scatterLayerId]; }
  }
  levels.splice(index + 1, 0, { id: generateLevelId(), name: collisionSafeLevelName(src.name), objects: clone.objects, environment: clone.environment, playerSettings: clone.playerSettings, ui: clone.ui, description: clone.description, ambientAudio: clone.ambientAudio, sequences: clone.sequences, objectiveDefs: clone.objectiveDefs, scatterLayers: clone.scatterLayers });
  if (startLevelIndex > index) startLevelIndex += 1;
  switchToLevel(index + 1);
  showStatus(`Duplicated "${src.name}"`);
});
document.getElementById('set-start-level-btn').addEventListener('click', () => {
  const index = Number(document.getElementById('level-select').value);
  if (Number.isNaN(index)) return;
  startLevelIndex = index;
  renderLevelList();
  showStatus(`"${levels[index].name}" is now the Start Level`);
});
function moveLevel(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= levels.length) return;
  syncCurrentLevelObjects();
  [levels[index], levels[target]] = [levels[target], levels[index]];
  // Every index-based reference (which level is open, which level Play
  // boots into) must move WITH its level, not silently point at whatever
  // now occupies that slot after the swap.
  const remap = (i) => (i === index ? target : i === target ? index : i);
  currentLevelIndex = remap(currentLevelIndex);
  startLevelIndex = remap(startLevelIndex);
  renderLevelList();
}
document.getElementById('move-level-up-btn').addEventListener('click', () => {
  const index = Number(document.getElementById('level-select').value);
  if (!Number.isNaN(index)) moveLevel(index, -1);
});
document.getElementById('move-level-down-btn').addEventListener('click', () => {
  const index = Number(document.getElementById('level-select').value);
  if (!Number.isNaN(index)) moveLevel(index, 1);
});

// Bundles every level (not just the active one) so Export/Save/Import
// carry a whole multi-level project, not just whatever happened to be
// loaded at the moment -- syncCurrentLevelObjects first, so the active
// level's in-progress edits are included, not a stale snapshot from the
// last switch.
// Project format identity (Wave 3) -- every export from here on stamps
// this; nothing pre-Wave-3 ever had it, which is exactly the signal
// normalizeProjectData below uses to route older shapes through migration
// instead of trusting them to already match the current shape.
const PROJECT_FORMAT = 'digital-opus-project';
const PROJECT_FORMAT_VERSION = 7;

function retainAuthoringAssetDependencies(deps,libraries){
  for(const [key,records] of Object.entries(libraries||{})){if(!(deps[key] instanceof Set))deps[key]=new Set();for(const record of Array.isArray(records)?records:[])if(typeof record?.id==='string'&&record.id)deps[key].add(record.id);}
  return deps;
}
function serializeProject(options) {
  // Wave 8 (Priority A): ONE dependency-collection pass feeds every
  // asset-kind serializer below -- prefabs (now including the full
  // recursive closure, Section 7), mesh/texture/audio assets -- instead of
  // four independent scans that could (and did -- see the collector's own
  // comment) silently disagree about what's actually referenced.
  const opts = options || {}; const includeTilesetAuthoring = opts.includeTilesets !== false;
  // Canonical authoring outputs are refreshed synchronously before Save or
  // either export. Playable never needs the Terrain resolver afterward.
  OpusAuthoringPlumbing.recomputeProjectTerrain(liveAutoTileProject());
  const deps = collectProjectDependencies(includeTilesetAuthoring);
  // Save and Editable retain the author's unplaced library assets. Playable
  // deliberately keeps the existing used-dependency pruning contract.
  if(includeTilesetAuthoring&&typeof retainAuthoringAssetDependencies==='function')retainAuthoringAssetDependencies(deps,{meshAssets:typeof assets==='undefined'?[]:assets,textureAssets:typeof textureAssets==='undefined'?[]:textureAssets,spriteAssets:typeof spriteAssets==='undefined'?[]:spriteAssets,spriteAnimations:typeof spriteAnimationClips==='undefined'?[]:spriteAnimationClips,audioAssets:typeof audioAssets==='undefined'?[]:audioAssets});
  if(typeof materialAssets!=='undefined')for(const material of materialAssets)if(material?.descriptor?.textureAssetRef)deps.textureAssets.add(material.descriptor.textureAssetRef);
  // Editable Save/Export retains complete Tileset authoring state. Playable
  // Export retains only Tilemaps' used Tile records and their Sprite/Texture
  // closure; unused authoring palette entries are intentionally pruned.
  if (includeTilesetAuthoring) for (const tileset of tilesets) {
    deps.tilesets.add(tileset.id);
    for (const tile of tileset.tiles || []) if (tile.spriteAssetRef) {
      deps.spriteAssets.add(tile.spriteAssetRef);
      const sprite = findSpriteAssetById(tile.spriteAssetRef); if (sprite && sprite.sourceTexture) deps.textureAssets.add(sprite.sourceTexture);
    }
  }
  if (includeTilesetAuthoring) for (const chunk of tilemapChunks) {
    if (chunk.tilesetRef) deps.tilesets.add(chunk.tilesetRef);
    for (const marker of chunk.spawnMarkers || []) if (marker.prefabRef) deps.prefabs.add(marker.prefabRef);
  }
  // Save/Editable retain unplaced reusable definitions; Playable keeps used-only pruning.
  const bundledPrefabs = JSON.parse(JSON.stringify(includeTilesetAuthoring ? prefabs : prefabs.filter((p) => deps.prefabs.has(p.name))));
  const exportLevels = levels.map((l) => {
    const objects = playMode ? authoredLevelObjectRecords(l) : l.objects;
    return { id: l.id, name: l.name, objects: includeTilesetAuthoring ? objects : (objects || []).map((object) => object && object.kind === 'tilemap' ? { ...object, layers: (object.layers || []).map((layer) => ({ ...layer, cells: (layer.cells || []).map((cell) => ({ x: cell.x, y: cell.y, tileId: cell.tileId })) })) } : object), environment: l.environment, playerSettings: l.playerSettings, ui: l.ui, description: l.description, ambientAudio: l.ambientAudio, sequences: l.sequences, objectiveDefs: l.objectiveDefs, scatterLayers: l.scatterLayers };
  });
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_FORMAT_VERSION,
    ...(typeof materialAssets!=='undefined'&&materialAssets.length?{materialAssets:copyMaterialAssets(materialAssets),nextMaterialAssetId}:{}),
    playerPreferenceScope: typeof playerPreferenceScope === 'undefined' ? undefined : OpusPlayerRebindScreen.copy(playerPreferenceScope),
    levels: exportLevels,
    currentLevelIndex,
    startLevelIndex,
    levelTransition: levelTransitionConfig,
    spriteSortingLayers: orderedSpriteSortingLayers().map((layer) => ({ id: layer.id, name: layer.name, order: layer.order })),
    collisionLayers: JSON.parse(JSON.stringify(collisionLayers)),
    parallaxLayers: parallaxLayers.map((layer) => ({ id: layer.id, name: layer.name, factorX: layer.factorX, factorY: layer.factorY })),
    prefabs: bundledPrefabs,
    componentPresets: includeTilesetAuthoring ? copyComponentPresetLibrary(componentPresets) : [],
    uiTemplates: includeTilesetAuthoring && typeof uiTemplates !== 'undefined' ? copyUiTemplateLibrary(uiTemplates) : [],
    cameraTemplates: includeTilesetAuthoring && typeof cameraTemplates !== 'undefined' ? copyCameraTemplateLibrary(cameraTemplates) : [],
    cinematicTemplates: typeof cinematicTemplates==='undefined'?[]:JSON.parse(JSON.stringify(cinematicTemplates)),
    controllerTemplates: includeTilesetAuthoring && typeof controllerTemplates !== 'undefined' ? copyControllerTemplateLibrary(controllerTemplates) : [],
    aiArchetypes: includeTilesetAuthoring && typeof aiArchetypes !== 'undefined' ? copyAiArchetypeLibrary(aiArchetypes) : [],
    combatEncounterTemplates: includeTilesetAuthoring && typeof combatEncounterTemplates !== 'undefined' ? copyCombatEncounterLibrary(combatEncounterTemplates) : [],
    // Referenced definitions are runtime data, not an editor-only cache.
    weaponDefinitions: typeof weaponDefinitions !== 'undefined' ? JSON.parse(JSON.stringify(weaponDefinitions)) : [],
    nextWeaponDefinitionId: typeof nextWeaponDefinitionId==='undefined'?1:nextWeaponDefinitionId,
    inputContexts: typeof inputContexts==='undefined'?undefined:copyInputContexts(inputContexts),
    inputDeviceMappings: typeof inputDeviceMappings==='undefined'?[]:copyInputDeviceMappings(inputDeviceMappings),
    inputActionSets: typeof inputActionSets==='undefined'?[]:copyInputActionSets(inputActionSets),
    inputActionAssets: typeof inputActionAssets==='undefined'?[]:copyInputActionAssets(inputActionAssets),
    inputActionAssetNextId: typeof nextInputActionAssetId==='undefined'?1:nextInputActionAssetId,
    graphFunctions: typeof OpusGraphSchema==='undefined'?JSON.parse(JSON.stringify(graphFunctions)):OpusGraphSchema.library(graphFunctions),
    signals: OpusSignals.copy(signalDefinitions),
    assets: serializeAssets(deps.meshAssets),
    textures: serializeTextureAssets(deps.textureAssets),
    spriteAssets: serializeSpriteAssets(deps.spriteAssets),
    spriteAnimations: serializeSpriteAnimationClips(deps.spriteAnimations),
    tilesets: includeTilesetAuthoring || deps.preserveUnknownGraphs ? serializeTilesets() : [...deps.tilesets].map((id) => {
      const source = findTilesetById(id); const used = deps.tileIdsByTileset.get(id) || new Set();
      return source ? OpusAuthoringPlumbing.createTileset({ ...source, tiles: (source.tiles || []).filter((tile) => used.has(tile.id)), autoTileSets: [], terrainBrushes: [] }) : null;
    }).filter(Boolean),
    tilemapChunks: includeTilesetAuthoring || deps.preserveUnknownGraphs ? serializeTilemapChunks() : [],
    audio: serializeAudioAssets(deps.audioAssets),
    meta: projectMeta,
    inputActionMap,
    itemDefs: JSON.parse(JSON.stringify(currentItemDefs)),
    nextItemDefId: typeof nextItemDefId==='undefined'?1:nextItemDefId,
    lootTables: copyLootLibrary(lootTables),
    inventoryTemplates: includeTilesetAuthoring && typeof inventoryTemplates!=='undefined'?copyInventoryTemplateLibrary(inventoryTemplates):[],
  };
}

