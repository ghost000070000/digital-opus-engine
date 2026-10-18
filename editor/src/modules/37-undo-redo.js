// --- Undo / redo ---
// Reuses the existing snapshot history rather than introducing an isolated
// Palette command stack. Phase 031 extends each snapshot with Tileset Assets;
// historical array-only snapshots remain loadable.

const MAX_HISTORY = 50;
const undoStack = [];
const redoStack = [];

function updateUndoRedoButtons() {
  document.getElementById('undo-btn').disabled = undoStack.length === 0;
  document.getElementById('redo-btn').disabled = redoStack.length === 0;
}

function captureAnimationEventAssets() {
  return assets.filter(asset => asset && asset.type === 'skinnedMesh').map(asset => ({
    assetId: asset.id,
    hasEvents: Object.prototype.hasOwnProperty.call(asset, 'animationEvents'),
    events: asset.animationEvents === undefined ? undefined : JSON.parse(JSON.stringify(asset.animationEvents)),
  }));
}
function restoreAnimationEventAssets(records) {
  if (!Array.isArray(records)) return; // Old history never owned this metadata.
  for (const record of records) {
    const matches = assets.filter(asset => asset && asset.type === 'skinnedMesh' && asset.id === record.assetId);
    if (matches.length !== 1) continue;
    if (record.hasEvents) matches[0].animationEvents = record.events === undefined ? undefined : JSON.parse(JSON.stringify(record.events));
    else delete matches[0].animationEvents;
  }
}
function captureScatterAuthoringSnapshot() {
  return typeof currentScatterLayers==='undefined'?undefined:{levelId:levels[currentLevelIndex]?.id,layers:JSON.parse(JSON.stringify(currentScatterLayers)),selectedId:typeof selectedScatterLayerId==='undefined'?null:selectedScatterLayerId};
}
function captureEditorSnapshot() { return { animationEventAssets: typeof captureAnimationEventAssets==='undefined'?undefined:captureAnimationEventAssets(), materialAssets: typeof materialAssets==='undefined'?[]:copyMaterialAssets(materialAssets), environmentAuthoring: typeof captureEnvironmentAuthoringSnapshot==='undefined'?undefined:captureEnvironmentAuthoringSnapshot(), levelTransition: typeof levelTransitionConfig==='undefined'?undefined:JSON.parse(JSON.stringify(levelTransitionConfig)), socketAssets: typeof assets==='undefined'?[]:assets.filter(asset=>asset&&asset.type==='skinnedMesh').map(asset=>({assetId:asset.id,hasSockets:Object.prototype.hasOwnProperty.call(asset,'sockets'),sockets:asset.sockets===undefined?undefined:JSON.parse(JSON.stringify(asset.sockets))})), combatEncounterTemplates: typeof combatEncounterTemplates==='undefined'?[]:copyCombatEncounterLibrary(combatEncounterTemplates), weaponDefinitions: typeof weaponDefinitions==='undefined'?[]:JSON.parse(JSON.stringify(weaponDefinitions)), aiArchetypes: typeof aiArchetypes==='undefined'?[]:copyAiArchetypeLibrary(aiArchetypes), controllerTemplates: typeof controllerTemplates==='undefined'?[]:copyControllerTemplateLibrary(controllerTemplates), cinematicTemplates: typeof cinematicTemplates==='undefined'?[]:JSON.parse(JSON.stringify(cinematicTemplates)), cameraTemplates: typeof cameraTemplates==='undefined'?[]:copyCameraTemplateLibrary(cameraTemplates), inputContexts: typeof inputContexts==='undefined'?undefined:copyInputContexts(inputContexts), inputDeviceMappings: typeof inputDeviceMappings==='undefined'?[]:copyInputDeviceMappings(inputDeviceMappings), inputActionSets: typeof inputActionSets==='undefined'?[]:copyInputActionSets(inputActionSets), inputActionAssetNextId: typeof nextInputActionAssetId==='undefined'?1:nextInputActionAssetId, inputActionAssets: typeof inputActionAssets==='undefined'?[]:copyInputActionAssets(inputActionAssets), inputActionMap: typeof inputActionMap==='undefined'?{}:{...inputActionMap}, componentPresets: copyComponentPresetLibrary(componentPresets), uiTemplates: typeof uiTemplates==='undefined'?[]:copyUiTemplateLibrary(uiTemplates), inventoryTemplates: typeof inventoryTemplates==='undefined'?[]:copyInventoryTemplateLibrary(inventoryTemplates), lootTables: typeof lootTables==='undefined'?[]:copyLootLibrary(lootTables), itemDefs: typeof currentItemDefs==='undefined'?[]:JSON.parse(JSON.stringify(currentItemDefs)), scene: JSON.parse(JSON.stringify(serializeScene())), levelLogic: captureLevelLogicSnapshot(), scatterAuthoring: typeof currentScatterLayers==='undefined'?undefined:captureScatterAuthoringSnapshot(), levelUi: typeof currentUiConfig==='undefined'?null:captureLevelUiSnapshot(), signals: typeof signalDefinitions==='undefined'?[]:OpusSignals.copy(signalDefinitions), graphFunctions: typeof OpusGraphSchema==='undefined'?JSON.parse(JSON.stringify(graphFunctions)):OpusGraphSchema.library(graphFunctions), tilesets: serializeTilesets(), tilemapChunks: serializeTilemapChunks(), playerSettings: JSON.parse(JSON.stringify(currentPlayerSettings)), collisionLayers: JSON.parse(JSON.stringify(collisionLayers)), collisionFilterLevels: JSON.parse(JSON.stringify(levels)), collisionFilterPrefabs: JSON.parse(JSON.stringify(prefabs)) }; }
function captureTilemapBundleSnapshot() {
  return {
    materialAssets: typeof materialAssets==='undefined'?[]:copyMaterialAssets(materialAssets),
    _phase039FullProject: true,
    inputContexts: typeof inputContexts==='undefined'?undefined:copyInputContexts(inputContexts),
    inputActionAssetNextId: typeof nextInputActionAssetId==='undefined'?1:nextInputActionAssetId,
    inputDeviceMappings: typeof inputDeviceMappings==='undefined'?[]:copyInputDeviceMappings(inputDeviceMappings),
    inputActionSets: typeof inputActionSets==='undefined'?[]:copyInputActionSets(inputActionSets),
    inputActionAssets: typeof inputActionAssets==='undefined'?[]:copyInputActionAssets(inputActionAssets),
    inputActionMap: typeof inputActionMap==='undefined'?{}:{...inputActionMap},
    itemDefs: typeof currentItemDefs==='undefined'?[]:JSON.parse(JSON.stringify(currentItemDefs)),
    lootTables: typeof lootTables==='undefined'?[]:copyLootLibrary(lootTables),
    inventoryTemplates: typeof inventoryTemplates==='undefined'?[]:copyInventoryTemplateLibrary(inventoryTemplates),
    // History owns portable records, never live variables/override/behavior maps.
    scene: JSON.parse(JSON.stringify(serializeScene())), tilesets: serializeTilesets(), tilemapChunks: serializeTilemapChunks(),
    levelLogic: captureLevelLogicSnapshot(),
    scatterAuthoring: typeof currentScatterLayers==='undefined'?undefined:{levelId:levels[currentLevelIndex]?.id,layers:JSON.parse(JSON.stringify(currentScatterLayers)),selectedId:typeof selectedScatterLayerId==='undefined'?null:selectedScatterLayerId},
    levelUi: typeof currentUiConfig==='undefined'?null:captureLevelUiSnapshot(),
    textures: serializeTextureAssets(new Set(textureAssets.map((entry) => entry.id))),
    spriteAssets: serializeSpriteAssets(new Set(spriteAssets.map((entry) => entry.id))),
    spriteAnimations: serializeSpriteAnimationClips(new Set(spriteAnimationClips.map((entry) => entry.id))),
    meshAssets: serializeAssets(new Set(assets.map((entry) => entry.id))),
    audio: serializeAudioAssets(new Set(audioAssets.map((entry) => entry.id))),
    prefabs: JSON.parse(JSON.stringify(prefabs)),
    componentPresets: copyComponentPresetLibrary(componentPresets),
    uiTemplates: typeof uiTemplates === 'undefined' ? [] : copyUiTemplateLibrary(uiTemplates),
    cameraTemplates: typeof cameraTemplates === 'undefined' ? [] : copyCameraTemplateLibrary(cameraTemplates),
    cinematicTemplates: typeof cinematicTemplates==='undefined'?[]:JSON.parse(JSON.stringify(cinematicTemplates)),
    controllerTemplates: typeof controllerTemplates === 'undefined' ? [] : copyControllerTemplateLibrary(controllerTemplates),
    aiArchetypes: typeof aiArchetypes === 'undefined' ? [] : copyAiArchetypeLibrary(aiArchetypes),
    combatEncounterTemplates: typeof combatEncounterTemplates === 'undefined' ? [] : copyCombatEncounterLibrary(combatEncounterTemplates),
    weaponDefinitions: typeof weaponDefinitions === 'undefined' ? [] : JSON.parse(JSON.stringify(weaponDefinitions)),
    signals: OpusSignals.copy(signalDefinitions),
    graphFunctions: typeof OpusGraphSchema==='undefined'?JSON.parse(JSON.stringify(graphFunctions)):OpusGraphSchema.library(graphFunctions),
    sortingLayers: orderedSpriteSortingLayers().map((layer) => ({ id: layer.id, name: layer.name, order: layer.order })),
    collisionLayers: JSON.parse(JSON.stringify(collisionLayers)),
    scriptsTrusted,
  };
}
function captureLevelLogicSnapshot() {
  const index=typeof currentLevelIndex==='undefined'?-1:currentLevelIndex,level=levels[index];
  if(!level)return null;
  return JSON.parse(JSON.stringify({levelId:level.id,sequences:typeof currentSequences==='undefined'?level.sequences||[]:currentSequences,objectiveDefs:typeof currentObjectiveDefs==='undefined'?level.objectiveDefs||[]:currentObjectiveDefs}));
}
function captureLevelUiSnapshot() {
  const level = levels[currentLevelIndex];
  return level ? { levelId: level.id, ui: copyUiConfig(currentUiConfig) } : null;
}
function restoreLevelUiSnapshot(snapshot) {
  if (!snapshot || !snapshot.ui) return;
  const index = levels.findIndex(level => level.id === snapshot.levelId);
  if (index < 0) return;
  levels[index].ui = copyUiConfig(snapshot.ui);
  if (index === currentLevelIndex) applyLevelUiConfig(index);
}
function restoreLevelLogicSnapshot(logic) {
  if(!logic||!Array.isArray(logic.sequences)||!Array.isArray(logic.objectiveDefs))return;
  const index=levels.findIndex(level=>level.id===logic.levelId);if(index<0)return;
  levels[index].sequences=JSON.parse(JSON.stringify(logic.sequences));
  levels[index].objectiveDefs=JSON.parse(JSON.stringify(logic.objectiveDefs));
  if(index===currentLevelIndex){applyLevelSequences(index);applyLevelObjectiveDefs(index);}
}
function restoreTilemapBundleSnapshot(snapshot) {
  if(typeof materialAssets!=='undefined'&&Array.isArray(snapshot.materialAssets))materialAssets=copyMaterialAssets(snapshot.materialAssets);
  if(typeof inputContexts!=='undefined' && Object.prototype.hasOwnProperty.call(snapshot,'inputContexts'))inputContexts=copyInputContexts(snapshot.inputContexts);
  if(typeof nextInputActionAssetId!=='undefined')reconcileInputActionAssetIds(snapshot);
  if(typeof inputDeviceMappings!=='undefined' && Array.isArray(snapshot.inputDeviceMappings))inputDeviceMappings=copyInputDeviceMappings(snapshot.inputDeviceMappings);
  if(typeof inputActionSets!=='undefined' && Array.isArray(snapshot.inputActionSets))inputActionSets=copyInputActionSets(snapshot.inputActionSets);
  componentPresets = copyComponentPresetLibrary(snapshot.componentPresets);
  if (Array.isArray(snapshot.uiTemplates)) uiTemplates = copyUiTemplateLibrary(snapshot.uiTemplates);
  if (Array.isArray(snapshot.cameraTemplates)) cameraTemplates = copyCameraTemplateLibrary(snapshot.cameraTemplates);
  if (snapshot && Array.isArray(snapshot.cinematicTemplates)) cinematicTemplates = JSON.parse(JSON.stringify(snapshot.cinematicTemplates));
  if (Array.isArray(snapshot.controllerTemplates)) controllerTemplates = copyControllerTemplateLibrary(snapshot.controllerTemplates);
  if (Array.isArray(snapshot.aiArchetypes)) aiArchetypes = copyAiArchetypeLibrary(snapshot.aiArchetypes);
  if (Array.isArray(snapshot.combatEncounterTemplates)) combatEncounterTemplates = copyCombatEncounterLibrary(snapshot.combatEncounterTemplates);
  if (Array.isArray(snapshot.weaponDefinitions)) weaponDefinitions = JSON.parse(JSON.stringify(snapshot.weaponDefinitions));
  if (Array.isArray(snapshot.inputActionAssets)) inputActionAssets = copyInputActionAssets(snapshot.inputActionAssets);
  if(snapshot.inputActionMap && !Array.isArray(snapshot.inputActionMap)) { inputActionMap={...snapshot.inputActionMap}; renderInputActionPanel(); }
  if(!snapshot._phase197ReuseLibraries){assets=[];textureAssets=[];audioAssets=[];}
  spriteAssets = []; spriteAnimationClips = []; tilesets = []; tilemapChunks = [];
  prefabs = JSON.parse(JSON.stringify(snapshot.prefabs || []));
  savePrefabs();
  graphFunctions = OpusGraphSchema.library(snapshot.graphFunctions || []);
  signalRuntime.clear();signalDefinitions=OpusSignals.copy(snapshot.signals);renderSignalManager();
  spriteSortingLayers = OpusAuthoringPlumbing.normalizeSpriteSortingLayers(snapshot.sortingLayers);
  collisionLayers = OpusCollisionFilter2D.normalizeLayers(snapshot.collisionLayers);
  loadAssets(snapshot.meshAssets); loadTextureAssets(snapshot.textures); loadSpriteAssets(snapshot.spriteAssets); loadSpriteAnimationClips(snapshot.spriteAnimations);
  loadTilesets(snapshot.tilesets); loadTilemapChunks(snapshot.tilemapChunks); loadAudioAssets(snapshot.audio);
  // Authored history may restore a conservative imported state, but it must
  // never grant a permission explicitly revoked outside the history system.
  scriptsTrusted = (typeof scriptTrustRevoked === 'undefined' || !scriptTrustRevoked) && snapshot.scriptsTrusted !== false;
  if (typeof renderScriptTrustControls === 'function') renderScriptTrustControls();
  loadScene(snapshot.scene || []); renderPrefabPalette(); renderSpriteSortingLayerManager();
  if (typeof OpusHudBindings !== 'undefined' && !playMode) renderHudElementList();
  if(typeof refreshInputConflictDiagnostics==='function')refreshInputConflictDiagnostics();
}
function loadEditorSnapshot(snapshot) {
  if(snapshot?._phase197AssetReplacement){restoreAssetReplacementSnapshot(snapshot);return;}
  if(typeof materialAssets!=='undefined'&&Array.isArray(snapshot?.materialAssets))materialAssets=copyMaterialAssets(snapshot.materialAssets);
  if(typeof inputContexts!=='undefined' && snapshot && Object.prototype.hasOwnProperty.call(snapshot,'inputContexts'))inputContexts=copyInputContexts(snapshot.inputContexts);
  if(typeof nextInputActionAssetId!=='undefined')reconcileInputActionAssetIds(snapshot);
  if(typeof inputDeviceMappings!=='undefined' && snapshot && Array.isArray(snapshot.inputDeviceMappings))inputDeviceMappings=copyInputDeviceMappings(snapshot.inputDeviceMappings);
  if(typeof inputActionSets!=='undefined' && snapshot && Array.isArray(snapshot.inputActionSets))inputActionSets=copyInputActionSets(snapshot.inputActionSets);
  if (snapshot && Array.isArray(snapshot.uiTemplates)) uiTemplates = copyUiTemplateLibrary(snapshot.uiTemplates);
  if (snapshot && Array.isArray(snapshot.cameraTemplates)) cameraTemplates = copyCameraTemplateLibrary(snapshot.cameraTemplates);
  if (snapshot && Array.isArray(snapshot.cinematicTemplates)) cinematicTemplates = JSON.parse(JSON.stringify(snapshot.cinematicTemplates));
  if (snapshot && Array.isArray(snapshot.controllerTemplates)) controllerTemplates = copyControllerTemplateLibrary(snapshot.controllerTemplates);
  if (snapshot && Array.isArray(snapshot.aiArchetypes)) aiArchetypes = copyAiArchetypeLibrary(snapshot.aiArchetypes);
  if (snapshot && Array.isArray(snapshot.combatEncounterTemplates)) combatEncounterTemplates = copyCombatEncounterLibrary(snapshot.combatEncounterTemplates);
  if (snapshot && Array.isArray(snapshot.weaponDefinitions)) weaponDefinitions = JSON.parse(JSON.stringify(snapshot.weaponDefinitions));
  if (snapshot && Array.isArray(snapshot.inputActionAssets)) inputActionAssets = copyInputActionAssets(snapshot.inputActionAssets);
  if (snapshot && snapshot.inputActionMap && !Array.isArray(snapshot.inputActionMap)) { inputActionMap = {...snapshot.inputActionMap}; renderInputActionPanel(); }
  if (snapshot && Array.isArray(snapshot.componentPresets)) componentPresets = copyComponentPresetLibrary(snapshot.componentPresets);
  if (snapshot && Array.isArray(snapshot.itemDefs)) { currentItemDefs = JSON.parse(JSON.stringify(snapshot.itemDefs)); renderItemDefList(); }
  if (snapshot && Object.prototype.hasOwnProperty.call(snapshot,'lootTables')) { lootTables = copyLootLibrary(snapshot.lootTables); renderLootTableList(); }
  if (snapshot && Object.prototype.hasOwnProperty.call(snapshot,'inventoryTemplates')) { inventoryTemplates = copyInventoryTemplateLibrary(snapshot.inventoryTemplates); renderInventoryTemplateLibrary(); }
  if(snapshot&&Array.isArray(snapshot.signals)){signalRuntime.clear();signalDefinitions=OpusSignals.copy(snapshot.signals);renderSignalManager();}
  if (snapshot && Array.isArray(snapshot.graphFunctions)) graphFunctions = OpusGraphSchema.library(snapshot.graphFunctions);
  if (snapshot && !Array.isArray(snapshot)) collisionLayers = OpusCollisionFilter2D.normalizeLayers(snapshot.collisionLayers);
  if (snapshot && snapshot.collisionFilterLevels) levels = JSON.parse(JSON.stringify(snapshot.collisionFilterLevels));
  if(snapshot && snapshot.environmentAuthoring)restoreEnvironmentAuthoringSnapshot(snapshot.environmentAuthoring);
  if (snapshot && snapshot.collisionFilterPrefabs) { prefabs = JSON.parse(JSON.stringify(snapshot.collisionFilterPrefabs)); savePrefabs(); }
  if (snapshot && snapshot.levelLogic) restoreLevelLogicSnapshot(snapshot.levelLogic);
  if (snapshot && snapshot.scatterAuthoring) {
    const saved=snapshot.scatterAuthoring,index=levels.findIndex(l=>l.id===saved.levelId);
    if (index>=0 && Array.isArray(saved.layers)) {
      levels[index].scatterLayers=JSON.parse(JSON.stringify(saved.layers));
      if (index===currentLevelIndex) { currentScatterLayers=JSON.parse(JSON.stringify(saved.layers));selectedScatterLayerId=currentScatterLayers.some(l=>l.id===saved.selectedId)?saved.selectedId:currentScatterLayers[0]?.id||null;scatterBrushDragState=null;renderScatterLayerPanel(); }
    }
  }
  if (snapshot && snapshot.levelUi) restoreLevelUiSnapshot(snapshot.levelUi);
  if(snapshot && snapshot.levelTransition){
    levelTransitionConfig=JSON.parse(JSON.stringify(snapshot.levelTransition));
    if(typeof renderLevelTransitionSettings==='function')renderLevelTransitionSettings();
  }
  if (snapshot && Array.isArray(snapshot.animationEventAssets)) restoreAnimationEventAssets(snapshot.animationEventAssets);
  // Socket history owns only shared authored metadata, never mesh/skin handles.
  // Older snapshots without this field retain their historical behavior.
  if (snapshot && Array.isArray(snapshot.socketAssets) && typeof assets !== 'undefined') {
    for (const record of snapshot.socketAssets) {
      const matches = assets.filter(asset => asset.id === record.assetId && asset.type === 'skinnedMesh');
      if (matches.length !== 1) continue;
      if (record.hasSockets) matches[0].sockets = record.sockets === undefined ? undefined : JSON.parse(JSON.stringify(record.sockets));
      else delete matches[0].sockets;
    }
  }
  // Scene-only history previously left authored player visual/body settings
  // untouched. Preserve legacy snapshots, and restore independent settings
  // when the new snapshot explicitly owns them (including Undo/Redo of Fit).
  if (snapshot && snapshot.playerSettings) {
    currentPlayerSettings = JSON.parse(JSON.stringify(snapshot.playerSettings));
    if (levels[currentLevelIndex]) levels[currentLevelIndex].playerSettings = JSON.parse(JSON.stringify(currentPlayerSettings));
    renderPlayerSettingsPanel();
  }
  renderCollisionLayerManager();
  if (snapshot && snapshot._phase039FullProject) { restoreTilemapBundleSnapshot(snapshot); return; }
  if (Array.isArray(snapshot)) { loadScene(snapshot); if (typeof OpusHudBindings !== 'undefined' && !playMode) renderHudElementList(); if(typeof refreshInputConflictDiagnostics==='function')refreshInputConflictDiagnostics();return; }
  loadScene(snapshot && Array.isArray(snapshot.scene) ? snapshot.scene : []);
  tilesets = (snapshot && snapshot.tilesets || []).map((tileset) => OpusAuthoringPlumbing.createTileset(tileset));
  tilemapChunks = (snapshot && snapshot.tilemapChunks || []).map((chunk) => OpusAuthoringPlumbing.normalizeTilemapChunk(chunk));
  for (const tileset of tilesets) reconcileTilesetIdCounter(tileset.id);
  if (activeTilesetId && !findTilesetById(activeTilesetId)) { activeTilesetId = null; activeTileId = null; document.getElementById('tile-palette-modal').classList.remove('visible'); }
  renderTilesetLibrary(); renderTilemapChunkLibrary(); if (activeTilesetId) renderTilePalette();
  renderCollisionLayerManager();
  // UI snapshots are restored before scene records. Rebuild source choices only
  // after the restored Actions/Graph declarations exist, including Undo/Redo.
  if (typeof OpusHudBindings !== 'undefined' && !playMode) renderHudElementList();
  if(typeof refreshInputConflictDiagnostics==='function')refreshInputConflictDiagnostics();
}

function pushUndo() {
  undoStack.push(captureEditorSnapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  updateUndoRedoButtons();
}

function undo() {
  if(typeof authoringFixtureCapture!=='undefined')authoringFixtureCapture=null;
  if (undoStack.length === 0) return;
  if(undoStack[undoStack.length-1]?._phase197AssetReplacement){
    if(playMode){showStatus('Stop Play before restoring asset replacement history.');return;}
    const target=undoStack[undoStack.length-1];let current;
    try{current=captureAssetReplacementState().history;if(target._phase198AudioVariant)current._phase198AudioVariant=true;if(target._phase198TextureVariant)current._phase198TextureVariant=true;if(target._phase198ModelVariant)current._phase198ModelVariant=true;loadEditorSnapshot(target);}catch(error){updateUndoRedoButtons();showStatus(error.message||'Asset replacement Undo unavailable.');return;}
    undoStack.pop();redoStack.push(current);
    updateUndoRedoButtons();showStatus('Undo');return;
  }
  const target = undoStack.pop();
  if (target && target._phase039FullProject) redoStack.push(captureTilemapBundleSnapshot());
  else redoStack.push(captureEditorSnapshot());
  loadEditorSnapshot(target);
  updateUndoRedoButtons();
  showStatus('Undo');
}

function redo() {
  if(typeof authoringFixtureCapture!=='undefined')authoringFixtureCapture=null;
  if (redoStack.length === 0) return;
  if(redoStack[redoStack.length-1]?._phase197AssetReplacement){
    if(playMode){showStatus('Stop Play before restoring asset replacement history.');return;}
    const target=redoStack[redoStack.length-1];let current;
    try{current=captureAssetReplacementState().history;if(target._phase198AudioVariant)current._phase198AudioVariant=true;if(target._phase198TextureVariant)current._phase198TextureVariant=true;if(target._phase198ModelVariant)current._phase198ModelVariant=true;loadEditorSnapshot(target);}catch(error){updateUndoRedoButtons();showStatus(error.message||'Asset replacement Redo unavailable.');return;}
    redoStack.pop();undoStack.push(current);
    updateUndoRedoButtons();showStatus('Redo');return;
  }
  const target = redoStack.pop();
  if (target && target._phase039FullProject) undoStack.push(captureTilemapBundleSnapshot());
  else undoStack.push(captureEditorSnapshot());
  loadEditorSnapshot(target);
  updateUndoRedoButtons();
  showStatus('Redo');
}

document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('redo-btn').addEventListener('click', redo);
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  else if (e.key === 'd' && !playMode && selectedItem) { e.preventDefault(); duplicateSelected(); }
});
updateUndoRedoButtons();

// Escape to deselect, Delete/Backspace to delete the selection, [ / ] to
// nudge a selected cube's height -- drag-to-move covers X/Z, but Y still
// meant the number field even for a quick lift. All mouse-only otherwise
// (click empty space; the inspector's Delete/number fields) even after
// drag-to-move made the viewport itself the primary way to work with an
// object. Guarded against typing in a field so this can't eat a keystroke
// meant for the message/script textarea or a number input.
window.addEventListener('keydown', (e) => {
  if (playMode) return;
  const tag = document.activeElement && document.activeElement.tagName;
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (e.key === 'Escape') {
    if (isTyping) document.activeElement.blur();
    else deselectAll();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping && selectedItem) {
    e.preventDefault();
    deleteSelected();
  } else if ((e.key === '[' || e.key === ']') && !isTyping && selectedItems.size > 0) {
    const cubes = [...selectedItems].filter((item) => item.kind === 'cube' || item.kind === 'sprite');
    if (cubes.length === 0) return;
    e.preventDefault();
    if (!e.repeat) pushUndo();
    const delta = e.key === ']' ? 0.25 : -0.25;
    for (const item of cubes) item.entity.position.y += delta;
    renderInspector();
  }
});

// Wave 8 (Priority A, Sections 3-7): the ONE generic project dependency
// collector, replacing four independently hand-maintained scanners
// (usedPrefabNames/usedPrefabNamesFromPlayerSettings below, plus one each
// inline in serializeAssets/serializeTextureAssets/serializeAudioAssets)
// that each had to be separately remembered and updated every time a new
// reference-shaped field was added -- confirmed to have already silently
// missed THREE real reference shapes before this fix (Player Visual's own
// `visual.assetId`, an AI State Machine state's own `attack.attackPrefab`,
// and an Animation Event's own `sound` action `audioAssetId` -- see
// API-FRICTION.md #70-72), not assumed from reading the code alone: each
// was verified live by constructing a project where that field was the
// ONLY reference to some asset/prefab and confirming the old scanner
// dropped it silently.
//
// Declarative where practical (Section 6): any `{action, params}`-shaped
// object -- an ordinary fixed-dropdown Behavior, a Node Graph action node
// (whose field values live directly ON the node, not nested under
// `params` -- `runGraphActionNode` calls `executeAction(node.type, node,
// item)`), or an Animation Event -- is scanned via `ACTION_TYPES[action]
// .fields`'s own declared `type` (`'prefab'` -> prefabs, `'audioAsset'`
// -> audio), ONE field-type table, not a hand-copied case per action. This
// is not a general reflection framework (Section 6's own explicit
// boundary): it only ever reads the two field `type`s that are actually
// asset-shaped; every other field type (`text`/`number`/`select`/`target`/
// `objectiveRef`/...) is deliberately never touched here, since a `target`
// is an Object ID reference (a different, already-stable concern this
// collector doesn't need to solve -- Object IDs never travel across an
// export the way prefab/asset library entries do).
const DEPENDENCY_FIELD_BUCKETS = { prefab: 'prefabs', audioAsset: 'audioAssets' };
function createAssetDependencyTrace(dep, maxEdges = 4096) {
  const seen=new Set(),limit=Number.isInteger(maxEdges)&&maxEdges>=0?Math.min(maxEdges,4096):4096;
  const trace={owner:{label:'Project definitions'},edges:[],truncated:false,record(bucket,id){
    if(typeof id!=='string'||!id)return;const owner={...this.owner},key=JSON.stringify([bucket,id,owner]);if(seen.has(key))return;
    if(this.edges.length>=limit){this.truncated=true;return;}seen.add(key);this.edges.push({bucket,id,owner});
  }};
  for(const [bucket,set] of Object.entries(dep))if(set instanceof Set){const add=set.add;set.add=function(id){trace.record(bucket,id);return add.call(this,id);};}
  return trace;
}
function captureAssetDependencyLevels() {
  // Inspection never synchronizes the stored level or borrows live settings.
  // Play has session-only state: require Stop before inspecting authored edits.
  if(playMode)throw new Error('Stop Play to inspect authored asset dependencies.');
  return levels.map((level,index)=>JSON.parse(JSON.stringify(index===currentLevelIndex?{
    ...level,objects:serializeScene(),playerSettings:currentPlayerSettings,
    ui:copyUiConfig(currentUiConfig),ambientAudio:currentAmbientAudioConfig,
    sequences:currentSequences,scatterLayers:currentScatterLayers
  }:level)));
}
function captureAssetReplacementLibraryMetadata(portable,live,transientKeys) {
  const excluded=new Set(transientKeys),seen=new Set(),metadata=[],byId=new Map();
  for(const entry of live||[]){const id=entry?.id;if(!byId.has(id))byId.set(id,[]);byId.get(id).push(entry);}
  const records=(portable||[]).map(record=>{
    const matches=byId.get(record.id)||[];
    if(seen.has(record.id)||matches.length>1)throw new Error('Asset library identity is ambiguous; replacement unchanged.');seen.add(record.id);
    const values={};for(const key of Object.keys(matches[0]||{})){
      if(excluded.has(key)||Object.prototype.hasOwnProperty.call(record,key))continue;
      if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsafe asset metadata key; replacement unchanged.');
      const value=matches[0][key];if(value===undefined)continue;
      try{const encoded=JSON.stringify(value,(name,item)=>{if(typeof item==='function'||typeof item==='symbol'||typeof item==='bigint'||(typeof item==='number'&&!Number.isFinite(item)))throw new Error();return item;});values[key]=JSON.parse(encoded);}
      catch(error){throw new Error('Unknown asset metadata is not safely serializable; replacement unchanged.');}
    }
    metadata.push({id:record.id,values:JSON.parse(JSON.stringify(values))});
    return JSON.parse(JSON.stringify({...record,...values}));
  });return {records,metadata};
}
function restoreAssetReplacementLibraryMetadata(saved) {
  const collections={meshAssets:assets,textures:textureAssets,audio:audioAssets};
  for(const [family,records]of Object.entries(saved||{})){
    const byId=new Map();for(const record of collections[family]||[]){const id=record.id;if(!byId.has(id))byId.set(id,[]);byId.get(id).push(record);}
    for(const entry of records||[]){
    const matches=byId.get(entry.id)||[];
    if(matches.length!==1)throw new Error('Asset metadata restoration has ambiguous identity.');
    for(const [key,value]of Object.entries(JSON.parse(JSON.stringify(entry.values))))Object.defineProperty(matches[0],key,{value,writable:true,enumerable:true,configurable:true});
    }
  }
}
function validateAssetReplacementLibraryMetadata(snapshot) {
  const blocked=['__proto__','constructor','prototype','id','meshHandle','textureHandle','image','audioBuffer','pendingCallbacks','decodeError'];
  const sidecar=snapshot._phase197LibraryMetadata;
  if(!sidecar||typeof sidecar!=='object'||Array.isArray(sidecar))throw new Error('Invalid asset metadata history; project unchanged.');
  for(const [family,entries]of Object.entries(snapshot._phase197LibraryMetadata||{})){
    if(!['meshAssets','textures','audio'].includes(family)||!Array.isArray(entries)||!Array.isArray(snapshot[family]))throw new Error('Invalid asset metadata history; project unchanged.');
    const structural=family==='meshAssets'?['type','positions','normals','indices','uvs','joints','weights','skin']:['dataURL'];
    const counts=new Map();for(const record of snapshot[family]){const id=record?.id;counts.set(id,(counts.get(id)||0)+1);}
    const ids=new Set();for(const entry of entries){
      if(!entry||typeof entry.id!=='string'||ids.has(entry.id)||counts.get(entry.id)!==1||!entry.values||typeof entry.values!=='object'||Array.isArray(entry.values)||Object.keys(entry.values).some(key=>blocked.includes(key)||structural.includes(key)))throw new Error('Invalid asset metadata history; project unchanged.');
      ids.add(entry.id);
    }
  }
}
function captureAssetReplacementState() {
  if(playMode)throw new Error('Stop Play before preparing an authored asset replacement.');
  const authoredLevels=captureAssetDependencyLevels(),bundle=captureTilemapBundleSnapshot();
  const retained={
    meshAssets:captureAssetReplacementLibraryMetadata(bundle.meshAssets,typeof assets==='undefined'?[]:assets,['meshHandle']),
    textures:captureAssetReplacementLibraryMetadata(bundle.textures,typeof textureAssets==='undefined'?[]:textureAssets,['image','textureHandle','pendingCallbacks','decodeError']),
    audio:captureAssetReplacementLibraryMetadata(bundle.audio,typeof audioAssets==='undefined'?[]:audioAssets,['audioBuffer','pendingCallbacks','decodeError'])
  };
  const metadata={};for(const [family,result]of Object.entries(retained)){bundle[family]=result.records;metadata[family]=result.metadata;}
  const environmentAuthoring=captureEnvironmentAuthoringSnapshot();
  if(authoredLevels[currentLevelIndex]){
    authoredLevels[currentLevelIndex].objectiveDefs=JSON.parse(JSON.stringify(currentObjectiveDefs));
    authoredLevels[currentLevelIndex].environment=JSON.parse(JSON.stringify({...authoredLevels[currentLevelIndex].environment,...environmentAuthoring.environment}));
  }
  // The historical bundle snapshot does not own complete stored levels. Add
  // explicit independent ownership for a future cross-level transaction, and
  // keep the preview draft separate from history and live project libraries.
  const history=JSON.parse(JSON.stringify({...bundle,_phase197AssetReplacement:true,_phase197LibraryMetadata:metadata,
    collisionFilterLevels:authoredLevels,currentLevelIndex,startLevelIndex,
    playerSettings:currentPlayerSettings}));
  const project=JSON.parse(JSON.stringify({...bundle,levels:authoredLevels,
    assets:bundle.meshAssets,currentLevelIndex,startLevelIndex}));
  return {project,history};
}
function assertAssetReplacementRetention(raw,portable,label) {
  const clone=value=>JSON.parse(JSON.stringify(value,(key,item)=>{
    if(['__proto__','constructor','prototype'].includes(key)||typeof item==='function'||typeof item==='symbol'||typeof item==='bigint'||(typeof item==='number'&&!Number.isFinite(item)))throw new Error('Unsupported retained data in '+label+'; replacement unchanged.');return item;
  }));
  let original,canonical;try{original=clone(raw);canonical=clone(portable);}catch(error){throw new Error('Unsupported retained data in '+label+'; replacement unchanged.');}
  const retained=(before,after)=>{
    if(before===null||typeof before!=='object')return before===after;
    if(!after||typeof after!=='object'||Array.isArray(before)!==Array.isArray(after))return false;
    if(Array.isArray(before)&&before.length!==after.length)return false;
    return Object.keys(before).every(key=>Object.prototype.hasOwnProperty.call(after,key)&&retained(before[key],after[key]));
  };
  if(!retained(original,canonical))throw new Error('Unsupported retained fields or version in '+label+'; replacement unchanged.');
}
function validateAssetReplacementRetainedData(project) {
  // Refuse a lossy normalized-library roundtrip before restoring anything.
  const families=[
    ['spriteAssets',typeof spriteAssets==='undefined'?[]:spriteAssets],['spriteAnimations',typeof spriteAnimationClips==='undefined'?[]:spriteAnimationClips],
    ['tilesets',typeof tilesets==='undefined'?[]:tilesets],['tilemapChunks',typeof tilemapChunks==='undefined'?[]:tilemapChunks],
    ['componentPresets',typeof componentPresets==='undefined'?[]:componentPresets],['uiTemplates',typeof uiTemplates==='undefined'?[]:uiTemplates],
    ['inputActionAssets',typeof inputActionAssets==='undefined'?[]:inputActionAssets],['inputActionSets',typeof inputActionSets==='undefined'?[]:inputActionSets],
    ['inputDeviceMappings',typeof inputDeviceMappings==='undefined'?[]:inputDeviceMappings],['inputContexts',typeof inputContexts==='undefined'?undefined:inputContexts],
    ['inventoryTemplates',typeof inventoryTemplates==='undefined'?[]:inventoryTemplates],['lootTables',typeof lootTables==='undefined'?[]:lootTables],
    ['signals',typeof signalDefinitions==='undefined'?[]:signalDefinitions],['graphFunctions',typeof graphFunctions==='undefined'?[]:graphFunctions],
    ['sortingLayers',typeof spriteSortingLayers==='undefined'?[]:spriteSortingLayers],['collisionLayers',typeof collisionLayers==='undefined'?[]:collisionLayers]
  ];
  for(const [family,raw]of families)if(raw!==undefined)assertAssetReplacementRetention(raw,project[family]||[],family);
  const knownKinds=new Set(['cube','sprite','tilemap','camera','spawner','emitter','light','path','terrain','water']);
  const inspect=record=>{if(!record||!knownKinds.has(record.kind===undefined?'cube':record.kind))throw new Error('Unsupported retained object kind; replacement unchanged.');};
  for(const level of project.levels||[])for(const record of level.objects||[])inspect(record);
  for(const prefab of project.prefabs||[])for(const record of prefab.records||(prefab.record?[prefab.record]:[]))inspect(record);
  for(const asset of project.assets||[])if(asset.type&&asset.type!=='mesh'&&asset.type!=='skinnedMesh')throw new Error('Unsupported retained Model type; replacement unchanged.');
}
function prepareAssetReplacementCommit(state,selection) {
  // Re-plan against a fresh capture. Never trust a retained draft or a display-
  // truncated owner list as a writable transaction.
  if(playMode)throw new Error('Stop Play before applying authored replacement.');
  if(!selection||typeof selection.baseSignature!=='string'||JSON.stringify(state.project)!==selection.baseSignature)
    throw new Error('Project changed after preview. Preview the replacement again; project unchanged.');
  const plan=createKnownAssetReplacementPreview(state.project,selection.type,selection.sourceId,selection.targetId);
  if(!plan.ok)throw new Error(plan.reason);
  if(!plan.changes.length)return {noop:true,changes:[]};
  validateAssetReplacementRetainedData(state.project);
  const draft=plan.draft,active=draft.levels?.[draft.currentLevelIndex];
  if(!active||!Number.isInteger(draft.currentLevelIndex)||!Array.isArray(active.objects)||!state.history?._phase197AssetReplacement||!state.history?._phase039FullProject)
    throw new Error('Invalid active level or complete replacement history; project unchanged.');
  const history=JSON.parse(JSON.stringify(state.history));
  // Only canonical bundle fields already owned by the capture may be copied.
  // The project aliases assets/levels are translated explicitly below.
  const special=new Set(['scene','meshAssets','collisionFilterLevels','playerSettings','levelUi','levelLogic','scatterAuthoring','_phase197LibraryMetadata']);
  for(const key of Object.keys(history))if(!special.has(key)&&!key.startsWith('_')&&Object.prototype.hasOwnProperty.call(draft,key))history[key]=JSON.parse(JSON.stringify(draft[key]));
  history.meshAssets=JSON.parse(JSON.stringify(draft.assets));
  history.collisionFilterLevels=JSON.parse(JSON.stringify(draft.levels));
  history.scene=JSON.parse(JSON.stringify(active.objects));
  history.playerSettings=JSON.parse(JSON.stringify(active.playerSettings||{}));
  history.levelUi={levelId:active.id,ui:JSON.parse(JSON.stringify(active.ui||{}))};
  history.levelLogic={levelId:active.id,sequences:JSON.parse(JSON.stringify(active.sequences||[])),objectiveDefs:JSON.parse(JSON.stringify(active.objectiveDefs||[]))};
  history.scatterAuthoring={...history.scatterAuthoring,levelId:active.id,layers:JSON.parse(JSON.stringify(active.scatterLayers||[]))};
  return {noop:false,history,changes:JSON.parse(JSON.stringify(plan.changes))};
}
function prepareAssetReplacementLibraryReuse(snapshot) {
  const families=[
    ['meshAssets',assets,serializeAssets(new Set(assets.map(record=>record.id))),['id','type','positions','normals','indices','uvs','joints','weights','skin']],
    ['textures',textureAssets,serializeTextureAssets(new Set(textureAssets.map(record=>record.id))),['id','dataURL']],
    ['audio',audioAssets,serializeAudioAssets(new Set(audioAssets.map(record=>record.id))),['id','dataURL']]
  ],plan=[];
  for(const [family,live,portable,structural]of families){
    const audioVariant=(family==='audio'&&snapshot._phase198AudioVariant===true)||(family==='textures'&&snapshot._phase198TextureVariant===true)||(family==='meshAssets'&&snapshot._phase198ModelVariant===true);
    const saved=snapshot[family];if(!Array.isArray(saved)||(!audioVariant&&saved.length!==live.length))throw new Error('Replacement history requires unchanged asset libraries; project unchanged.');
    const liveById=new Map(),portableById=new Map();
    for(const [records,index]of [[live,liveById],[portable,portableById]])for(const record of records){const id=record.id;if(!index.has(id))index.set(id,[]);index.get(id).push(record);}
    const ids=new Set();for(const record of saved){
      const matches=liveById.get(record?.id)||[],current=portableById.get(record?.id)||[];
      if(audioVariant&&record&&typeof record.id==='string'&&record.id&&!ids.has(record.id)&&matches.length===0&&current.length===0){
        if(family==='meshAssets')prepareModelAssetVariant(record,{allocate:false});
        else if(typeof record.dataURL!=='string'||record.dataURL.length>96*1024*1024)throw new Error('Invalid retained resource variant bytes; project unchanged.');
        ids.add(record.id);continue;
      }
      if(!record||ids.has(record.id)||matches.length!==1||current.length!==1||JSON.stringify(structural.map(key=>record[key]))!==JSON.stringify(structural.map(key=>current[0][key])))throw new Error('Replacement history requires unchanged asset libraries and source bytes/geometry; project unchanged.');
      ids.add(record.id);plan.push({live:matches[0],record,structural,authoredKeys:Object.keys(current[0])});
    }
  }return plan;
}
function applyAssetReplacementSnapshot(saved,reuse) {
  if(saved._phase198ModelVariant===true){const ids=new Set(saved.meshAssets.map(record=>record.id));assets=assets.filter(record=>ids.has(record.id));}
  if(saved._phase198AudioVariant===true){const ids=new Set(saved.audio.map(record=>record.id));audioAssets=audioAssets.filter(record=>ids.has(record.id));}
  if(saved._phase198TextureVariant===true){const ids=new Set(saved.textures.map(record=>record.id));textureAssets=textureAssets.filter(record=>ids.has(record.id));}
  for(const entry of reuse)for(const key of new Set([...entry.authoredKeys,...Object.keys(entry.record)])){if(entry.structural.includes(key))continue;let value=entry.record[key];if(value===undefined){if(['tags','sockets','animationEvents'].includes(key))value=[];else if(key==='folder')value='';}Object.defineProperty(entry.live,key,{value:value===undefined?undefined:JSON.parse(JSON.stringify(value)),writable:true,enumerable:true,configurable:true});}
  currentLevelIndex=saved.currentLevelIndex;startLevelIndex=saved.startLevelIndex;
  saved._phase197ReuseLibraries=true;saved._phase197AssetReplacement=false;loadEditorSnapshot(saved);
  if(saved._phase197LibraryMetadata)restoreAssetReplacementLibraryMetadata(saved._phase197LibraryMetadata);
  applyLevelAmbientAudio(currentLevelIndex);applyLevelEnvironment(currentLevelIndex);
  applyLevelObjectiveDefs(currentLevelIndex);renderLevelList();
}
function releaseRetiredModelAssets(records) {
  for(const record of records)if(record.meshHandle){try{if(app.releaseMesh(record.meshHandle))record.meshHandle=null;}catch(error){showStatus('Model history restored; retired GPU resource release failed.');}}
}
function restoreAssetReplacementSnapshot(snapshot) {
  if(playMode)throw new Error('Stop Play before restoring asset replacement history.');
  const saved=JSON.parse(JSON.stringify(snapshot)),records=saved.collisionFilterLevels;
  if(!saved._phase197AssetReplacement||!saved._phase039FullProject||!Array.isArray(records)||!records.length||
    !Number.isInteger(saved.currentLevelIndex)||saved.currentLevelIndex<0||saved.currentLevelIndex>=records.length||
    !Number.isInteger(saved.startLevelIndex)||saved.startLevelIndex<0||saved.startLevelIndex>=records.length||
    records.some(level=>!level||typeof level.id!=='string'||!level.id)||new Set(records.map(level=>level.id)).size!==records.length)
    throw new Error('Invalid complete asset replacement history; project unchanged.');
  if(saved._phase197LibraryMetadata)validateAssetReplacementLibraryMetadata(saved);
  if(saved._phase198AudioVariant===true)validatePortableProjectAssetExtras({audio:saved.audio});
  if(saved._phase198TextureVariant===true)validatePortableProjectAssetExtras({textures:saved.textures});
  if(saved._phase198ModelVariant===true)validatePortableProjectAssetExtras({assets:saved.meshAssets});
  const reuse=prepareAssetReplacementLibraryReuse(saved);
  validateImportedSceneRecords(saved.scene,'Asset replacement history');
  for(const level of records)validateImportedSceneRecords(level.objects||[],'Level '+level.id);
  validateImportedPrefabs(saved.prefabs);
  // Set the restored level ownership before the canonical loader applies its
  // level UI/logic/settings. The legacy bundle path still owns library revival;
  // this marker is cleared only in an independent copy to avoid recursion.
  const rollback=captureAssetReplacementState().history,storedLevels=JSON.parse(JSON.stringify(levels));
  const storedTextureAssets=typeof textureAssets==='undefined'?null:textureAssets,storedAudioAssets=typeof audioAssets==='undefined'?null:audioAssets;
  const storedModelAssets=typeof assets==='undefined'?null:assets;
  if(saved._phase198AudioVariant===true)rollback._phase198AudioVariant=true;
  if(saved._phase198TextureVariant===true)rollback._phase198TextureVariant=true;
  if(saved._phase198ModelVariant===true)rollback._phase198ModelVariant=true;
  const retiredTextures=saved._phase198TextureVariant===true?textureAssets.filter(record=>!saved.textures.some(target=>target.id===record.id)):[];
  const retiredModels=saved._phase198ModelVariant===true?assets.filter(record=>!saved.meshAssets.some(target=>target.id===record.id)):[];
  try{applyAssetReplacementSnapshot(saved,reuse);}
  catch(error){
    const failedTextures=saved._phase198TextureVariant===true?textureAssets.filter(record=>!storedTextureAssets.includes(record)):[];
    const failedModels=saved._phase198ModelVariant===true?assets.filter(record=>!storedModelAssets.includes(record)):[];
    if(saved._phase198TextureVariant===true)textureAssets=storedTextureAssets;
    if(saved._phase198AudioVariant===true)audioAssets=storedAudioAssets;
    if(saved._phase198ModelVariant===true)assets=storedModelAssets;
    try{applyAssetReplacementSnapshot(rollback,prepareAssetReplacementLibraryReuse(rollback));levels=storedLevels;renderLevelList();}
    catch(recovery){throw new Error('Asset replacement rollback failed; stop authoring and preserve this session. '+(error.message||error)+' / '+(recovery.message||recovery));}
    for(const record of failedTextures)if(record.textureHandle){try{app.destroyTexture(record.textureHandle);record.textureHandle=null;}catch(disposal){showStatus('Previous authored state restored; failed-attempt GPU resource disposal failed.');}}
    if(failedModels.length)releaseRetiredModelAssets(failedModels);
    throw new Error('Asset replacement failed; previous authored state restored. '+(error.message||error));
  }
  // Disposal follows successful scene restoration so rollback can reuse old handles.
  for(const record of retiredTextures)if(record.textureHandle){try{app.destroyTexture(record.textureHandle);record.textureHandle=null;}catch(error){showStatus('Texture variant history restored; retired GPU resource disposal failed.');}}
  if(retiredModels.length)releaseRetiredModelAssets(retiredModels);
}
function createUnusedAssetPreview(rows, edges, uncertainty = {}) {
  // Diagnostic only: no canonical serialization, resource access or writable
  // references escape this projection. A candidate is never deletion authority.
  const counts=new Map(),owners=new Map();
  for(const row of rows){const key=JSON.stringify([row.bucket,row.id]);counts.set(key,(counts.get(key)||0)+1);}
  for(const edge of edges){const key=JSON.stringify([edge.bucket,edge.id]);if(!owners.has(key))owners.set(key,[]);owners.get(key).push(edge);}
  const incomplete=!!(uncertainty.truncated||uncertainty.unknownContent||uncertainty.reusableRecipes);
  return rows.map(row=>{
    const key=JSON.stringify([row.bucket,row.id]),links=owners.get(key)||[],known=links.filter(edge=>!edge.owner?.retainedOnly);
    let status,reason;
    if(row.missing){status='uncertain';reason='Missing typed reference; repair the owner, not the library.';}
    else if(counts.get(key)!==1){status='uncertain';reason='Duplicate typed identity; ownership is ambiguous.';}
    else if(row.bucket==='tilemapChunks'){status='uncertain';reason='Reusable Chunk recipe; stamps materialize cells without a persistent Chunk reference.';}
    else if(known.length){status='known-reference';reason=known.length+' recorded owner/dependency links (including reusable definitions and transitive asset dependencies).';}
    else if(incomplete||links.length){status='uncertain';reason='No known owner, but unknown content, incomplete tracing or reusable recipes prevent an unused verdict.';}
    else {status='candidate';reason='No recorded typed owner in this snapshot. Partial known-field coverage only; not proven safe to delete.';}
    return {bucket:row.bucket,id:row.id,name:row.name,status,reason};
  });
}
function hasUncertainAssetPreviewContent(records, maxNodes = 20000) {
  // Unknown Script can select assets dynamically. Bound inspection and treat
  // malformed/cyclic/future content as uncertainty, never as absence of usage.
  const queue=[records],seen=new Set();let nodes=0;
  while(queue.length){const value=queue.pop();if(!value||typeof value!=='object')continue;
    if(seen.has(value))return true;seen.add(value);if(++nodes>maxNodes)return true;
    if(value.action==='script'||value.type==='script')return true;
    for(const item of Object.values(value))if(item&&typeof item==='object')queue.push(item);
  }return false;
}
function refreshAssetDependencyViewer() {
  const select=document.getElementById('asset-dependency-select'),body=document.getElementById('asset-dependency-body');
  const status=document.getElementById('asset-dependency-status');if(!select||!body||!status)return;
  const cleanup=document.getElementById('asset-unused-preview');
  const cleanupStatus=document.getElementById('asset-unused-status'),cleanupFilter=document.getElementById('asset-unused-filter');
  if(cleanupStatus)cleanupStatus.textContent='Preview unavailable; Refresh after Stop.';
  if(cleanupFilter){cleanupFilter.onchange=null;cleanupFilter.disabled=true;}
  select.replaceChildren();body.textContent='';select.onchange=null;if(cleanup)cleanup.textContent='Preview unavailable; Refresh after Stop.';
  try {
    const inspection={levels:captureAssetDependencyLevels()},dep=collectProjectDependencies(true,inspection);
    const collections={meshAssets:assets,textureAssets,spriteAssets,spriteAnimations:spriteAnimationClips,tilesets,audioAssets,prefabs};
    const labels={meshAssets:'Model',textureAssets:'Texture',spriteAssets:'Sprite',spriteAnimations:'Sprite animation',tilesets:'Tileset',audioAssets:'Audio',prefabs:'Prefab'};
    const entries=new Map();let limited=false;
    const add=(bucket,id,name,missing)=>{if(typeof id!=='string'||!id)return;const key=JSON.stringify([bucket,id]);if(entries.has(key))return;if(entries.size>=4096){limited=true;return;}entries.set(key,{bucket,id,name:name||id,missing});};
    for(const [bucket,records]of Object.entries(collections))for(const record of records||[])if(record)add(bucket,bucket==='prefabs'?record.name:record.id,record.name,false);
    for(const edge of inspection.edges)add(edge.bucket,edge.id,edge.id,true);
    const rows=Array.from(entries.values());
    if(cleanup){
      // Existing collector intentionally does not scan every unused Prefab or
      // Chunk recipe. Conservatively expose that coverage gap rather than
      // treating Playable pruning as a cleanup oracle.
      const previewRows=[];
      for(const [bucket,records]of Object.entries({...collections,tilemapChunks:typeof tilemapChunks==='undefined'?[]:tilemapChunks})){
        for(const record of records||[])if(record&&typeof (bucket==='prefabs'?record.name:record.id)==='string')previewRows.push({bucket,id:bucket==='prefabs'?record.name:record.id,name:record.name||record.id});
      }
      // Missing traced identities are diagnostics too, not library candidates.
      previewRows.push(...rows.filter(row=>row.missing));
      const capped=previewRows.slice(0,4096),preview=createUnusedAssetPreview(capped,inspection.edges,{
        truncated:inspection.truncated||limited||previewRows.length>4096,
        unknownContent:dep.preserveUnknownGraphs||hasUncertainAssetPreviewContent([inspection.levels,prefabs,graphFunctions]),
        reusableRecipes:prefabs.length>0||(typeof tilemapChunks!=='undefined'&&tilemapChunks.length>0)
      });
      const totals={candidate:0,'known-reference':0,uncertain:0};for(const row of preview)totals[row.status]++;
      if(cleanupStatus)cleanupStatus.textContent=totals.candidate+' candidates · '+totals['known-reference']+' known-reference · '+totals.uncertain+' uncertain. Snapshot only; Refresh after edits.'+(inspection.truncated||limited||previewRows.length>4096?' Incomplete trace/display (maximum4096 entries).':'');
      const renderCleanup=()=>{
        const category=cleanupFilter?.value||'all',visible=category==='all'?preview:preview.filter(row=>row.status===category);
        cleanup.textContent='Read-only cleanup preview. Candidates are not deletion recommendations.\n'+(visible.length?visible.map(row=>(labels[row.bucket]||({tilemapChunks:'Chunk'})[row.bucket]||row.bucket)+' · '+row.name+' ['+row.id+'] — '+row.status+'\n'+row.reason).join('\n\n'):'No entries in this category. Absence is not a safe deletion verdict.');
        cleanup.scrollTop=0;
      };
      if(cleanupFilter){cleanupFilter.disabled=false;cleanupFilter.onchange=renderCleanup;}renderCleanup();
    }
    const nameCounts=new Map();for(const row of rows){const key=JSON.stringify([row.bucket,row.name]);nameCounts.set(key,(nameCounts.get(key)||0)+1);}
    for(const [index,row]of rows.entries()){const option=document.createElement('option');option.value=String(index);if(option.dataset){option.dataset.assetId=row.id;option.dataset.assetBucket=row.bucket;}option.textContent=(labels[row.bucket]||row.bucket)+' · '+row.name+(nameCounts.get(JSON.stringify([row.bucket,row.name]))>1?' ['+row.id+']':'')+(row.missing?' — missing':'');select.appendChild(option);}
    const render=()=>{const row=rows[Number(select.value)];if(!row){body.textContent='No project assets or typed references.';return;}
      const owners=inspection.edges.filter(e=>e.bucket===row.bucket&&e.id===row.id),outgoing=inspection.edges.filter(e=>row.bucket==='prefabs'?e.owner.prefabName===row.id:e.owner.assetId===row.id&&e.owner.assetType===({meshAssets:'mesh',spriteAssets:'sprite',spriteAnimations:'sprite-animation',tilesets:'tileset',textureAssets:'texture',audioAssets:'audio'}[row.bucket]));
      body.textContent=(labels[row.bucket]||row.bucket)+' · '+row.name+'\nID: '+row.id+(row.missing?'\nMissing typed reference; no replacement was made.':'')+'\n\nRecorded owners:\n'+(owners.length?owners.map(e=>(e.owner.retainedOnly?'Retained conservatively: ':'')+e.owner.label).join('\n'):'No recorded owner in this snapshot. Not a deletion recommendation.')+'\n\nDependencies owned by this asset / Prefab:\n'+(outgoing.length?outgoing.map(e=>(labels[e.bucket]||e.bucket)+' · '+(entries.get(JSON.stringify([e.bucket,e.id]))?.name||e.id)+' ['+e.id+']').join('\n'):'No recorded outgoing dependency.');
    };
    select.onchange=()=>{render();if(typeof refreshAssetReplacementTargets==='function')refreshAssetReplacementTargets();};render();
    if(typeof refreshAssetReplacementTargets==='function')refreshAssetReplacementTargets();
    status.textContent=rows.length+' entries · '+inspection.edges.length+' recorded owner links.'+(inspection.truncated||limited?' Display limit reached; results are incomplete.':'')+(dep.preserveUnknownGraphs?' Unknown content requires conservative retention; these links are not proven usage.':'')+' Read-only snapshot; Refresh after edits. Derived links show asset-to-asset ownership, not a flattened usage count.';
  }catch(error){status.textContent=error.message||'Dependency inspection unavailable; project unchanged.';if(typeof refreshAssetReplacementTargets==='function')refreshAssetReplacementTargets();}
}
function cancelAssetReplacementPreview() {
  assetReplacementPreviewSelection=null;
  const apply=document.getElementById('asset-replacement-apply');if(apply)apply.disabled=true;
  const body=document.getElementById('asset-replacement-body'),status=document.getElementById('asset-replacement-status');
  if(body)body.textContent='';if(status)status.textContent='Preview cleared. Project and history unchanged.';
}
function refreshAssetReplacementTargets() {
  const target=document.getElementById('asset-replacement-target');if(!target)return;
  cancelAssetReplacementPreview();target.replaceChildren();target.onchange=cancelAssetReplacementPreview;
  const source=document.getElementById('asset-dependency-select')?.selectedOptions?.[0];
  const records=({meshAssets:assets,textureAssets,spriteAssets,spriteAnimations:spriteAnimationClips,audioAssets})[source?.dataset?.assetBucket];
  const empty=document.createElement('option');empty.value='';empty.textContent=records?'Choose same-type replacement':'Select a supported Model, Texture, Sprite, Animation or Audio source';target.appendChild(empty);
  for(const record of records||[]){if(!record||record.id===source.dataset.assetId)continue;const option=document.createElement('option');option.value=record.id;option.textContent=(record.name||record.id)+' ['+record.id+']';target.appendChild(option);}
}
function previewAssetReplacementSelection() {
  const status=document.getElementById('asset-replacement-status'),body=document.getElementById('asset-replacement-body');if(!status||!body)return;
  cancelAssetReplacementPreview();
  try{
    if(playMode)throw new Error('Stop Play before previewing authored replacement.');
    const source=document.getElementById('asset-dependency-select')?.selectedOptions?.[0],target=document.getElementById('asset-replacement-target')?.value;
    const type=({meshAssets:'mesh',textureAssets:'texture',spriteAssets:'sprite',spriteAnimations:'sprite-animation',audioAssets:'audio'})[source?.dataset?.assetBucket];
    const state=captureAssetReplacementState(),plan=createKnownAssetReplacementPreview(state.project,type,source?.dataset?.assetId,target);
    if(!plan.ok)throw new Error(plan.reason);
    const label=change=>{
      const level=plan.draft.levels?.find(l=>l.id===change.levelId),object=level?.objects?.find(o=>o.id===change.objectId);
      return [level?.name||change.levelId,object?.name||change.objectId,change.prefabName?'Prefab '+change.prefabName:null,change.assetId?'Asset '+change.assetId:null,change.functionId?'Function '+change.functionId:null,change.field].filter(Boolean).join(' · ');
    };
    assetReplacementPreviewSelection={type,sourceId:source.dataset.assetId,targetId:target,baseSignature:JSON.stringify(state.project)};
    const apply=document.getElementById('asset-replacement-apply');if(apply)apply.disabled=!plan.changes.length;
    status.textContent=plan.changes.length+' known typed reference changes previewed. Partial known-field coverage; Apply revalidates before changing anything. Project and history unchanged.';
    const targetLabel=document.getElementById('asset-replacement-target')?.selectedOptions?.[0]?.textContent||target;
    body.textContent='Source: '+source.textContent+'\nTarget: '+targetLabel+'\n\n'+(plan.changes.length?plan.changes.slice(0,200).map(label).join('\n'):'No known typed references change.')+(plan.changes.length>200?'\nShowing first200 affected locations; preview count includes all known changes.':'');
  }catch(error){status.textContent=(error.message||'Replacement preview unavailable.')+' Project unchanged.';}
}
function applyAssetReplacementSelection() {
  const status=document.getElementById('asset-replacement-status');if(!status)return;
  try{
    if(playMode)throw new Error('Stop Play before applying authored replacement.');
    const selection=assetReplacementPreviewSelection;
    const source=document.getElementById('asset-dependency-select')?.selectedOptions?.[0],target=document.getElementById('asset-replacement-target')?.value;
    const type=({meshAssets:'mesh',textureAssets:'texture',spriteAssets:'sprite',spriteAnimations:'sprite-animation',audioAssets:'audio'})[source?.dataset?.assetBucket];
    if(!selection||source?.dataset?.assetId!==selection.sourceId||type!==selection.type||target!==selection.targetId)throw new Error('Preview the selected replacement first.');
    const state=captureAssetReplacementState(),plan=prepareAssetReplacementCommit(state,selection);
    if(plan.noop){cancelAssetReplacementPreview();status.textContent='No known typed references change. Project and history unchanged.';return;}
    restoreAssetReplacementSnapshot(plan.history);
    undoStack.push(state.history);if(undoStack.length>MAX_HISTORY)undoStack.shift();redoStack.length=0;updateUndoRedoButtons();
    cancelAssetReplacementPreview();refreshAssetDependencyViewer();
    status.textContent='Applied '+plan.changes.length+' known typed reference changes. Original assets retained. One Undo step.';
  }catch(error){cancelAssetReplacementPreview();status.textContent=error.message||'Replacement failed; project unchanged.';}
}
function collectProjectDependencies(includeUiAuthoring = true, inspection = null) {
  if (!inspection) syncCurrentLevelObjects();
  const dependencyLevels = inspection ? inspection.levels : levels;
  const dep = { prefabs: new Set(), meshAssets: new Set(), textureAssets: new Set(), spriteAssets: new Set(), spriteAnimations: new Set(), tilesets: new Set(), tileIdsByTileset: new Map(), audioAssets: new Set() };
  const trace=inspection?createAssetDependencyTrace(dep,inspection.maxEdges):null;
  // Retain every possible outcome, not just whichever preview selected.
  for(const table of typeof lootTables==='undefined'?[]:Array.isArray(lootTables)?lootTables:[]){
    if(trace)trace.owner={label:'Loot Table '+(table?.name||table?.id||'Unnamed'),definitionType:'lootTable',definitionId:table?.id||null};
    for(const entry of Array.isArray(table?.entries)?table.entries:[])if(entry?.kind==='prefab'&&typeof entry.prefabName==='string')dep.prefabs.add(entry.prefabName);
  }
  function scanActionParams(actionType, params) {
    const def = Object.prototype.hasOwnProperty.call(ACTION_TYPES, actionType) ? ACTION_TYPES[actionType] : null;
    if (!def || !params) return;
    for (const f of def.fields) {
      const bucketName = DEPENDENCY_FIELD_BUCKETS[f.type];
      if (bucketName && params[f.key]) dep[bucketName].add(params[f.key]);
    }
  }
  function scanGraph(graph) {
    if(typeof OpusGraphSchema!=='undefined'&&!OpusGraphSchema.canExecute(graph))dep.preserveUnknownGraphs=true;
    if (!graph || !Array.isArray(graph.nodes)) return;
    for (const node of graph.nodes) {
      if(!node||typeof node!=='object')continue;
      if(typeof GRAPH_NODE_TYPES!=='undefined'&&!GRAPH_NODE_TYPES[node.type])dep.preserveUnknownGraphs=true;
      if (node.type === 'graph' || node.type === 'dialogueTree') continue; // no ACTION_TYPES entry to look field metadata up against
      scanActionParams(node.type, node); // graph nodes store field values directly on themselves
    }
  }
  // Definitions are project content even when currently uncalled. Their canonical
  // Action dependencies must survive editor saves and standalone exports too.
  for (const definition of graphFunctions) { if(trace)trace.owner={label:'Graph Function '+(definition?.name||definition?.id||'Unnamed'),definitionType:'graphFunction',definitionId:definition?.id||null};scanGraph(definition?.graph); }
  // Item Definitions are portable project content, including assets referenced
  // only by inventory presentation or their existing canonical Use Action.
  for (const definition of typeof currentItemDefs === 'undefined' ? [] : currentItemDefs) {
    if (!definition) continue;
    if(trace)trace.owner={label:'Item '+(definition.name||definition.id||'Unnamed'),definitionType:'item',definitionId:definition.id||null};
    if (definition.iconTextureAssetId) dep.textureAssets.add(definition.iconTextureAssetId);
    if (definition.useAction) scanActionParams(definition.useAction.action, definition.useAction.params);
  }
  for (const record of typeof inventoryTemplates==='undefined'?[]:Array.isArray(inventoryTemplates)?inventoryTemplates:[]) {
    if(trace)trace.owner={label:'Inventory Template '+(record?.name||record?.id||'Unnamed'),definitionType:'inventoryTemplate',definitionId:record?.id||null};
    if(record?.settings?.iconTextureAssetId)dep.textureAssets.add(record.settings.iconTextureAssetId);
    if(record?.settings?.useAction)scanActionParams(record.settings.useAction.action,record.settings.useAction.params);
  }
  function scanBehaviors(behaviors) {
    for (const b of behaviors || []) {
      if (b.trigger === 'spriteAnimationEvent' && b.eventRef && b.eventRef.clipId) dep.spriteAnimations.add(b.eventRef.clipId);
      if (b.action === 'graph') scanGraph(b.graph);
      else scanActionParams(b.action, behaviorParams(b, ACTION_TYPES[b.action]));
    }
  }
  function scanAnimationEvents(events) {
    if (!Array.isArray(events)) { dep.preserveUnknownGraphs = true; return; }
    for (const ev of events) {
      if (!ev || typeof ev !== 'object' || Array.isArray(ev) || !Object.prototype.hasOwnProperty.call(ACTION_TYPES, ev.action) || ev.params !== undefined && (!ev.params || typeof ev.params !== 'object' || Array.isArray(ev.params))) { dep.preserveUnknownGraphs = true; continue; }
      scanActionParams(ev.action, ev.params);
    }
  }
  // The one place both AI reference shapes (Simple-AI's own `ai.attackPrefab`
  // and a State Machine state's own `attack.attackPrefab`, Wave 7 Priority
  // D) are scanned together -- the exact gap the second State-Machine-only
  // shape fell through before this fix.
  function scanAi(ai) {
    if (!ai) return;
    if (ai.attackEnabled && ai.attackPrefab) dep.prefabs.add(ai.attackPrefab);
    for (const s of Array.isArray(ai.states) ? ai.states : []) {
      if (!s || typeof s !== 'object') continue;
      if (s.attack && s.attack.attackEnabled && s.attack.attackPrefab) dep.prefabs.add(s.attack.attackPrefab);
      for (const ea of Array.isArray(s.entryActions) ? s.entryActions : []) {
        if (ea && typeof ea === 'object') scanActionParams(ea.action, ea.params);
      }
    }
  }
  if(includeUiAuthoring)for(const record of typeof combatEncounterTemplates==='undefined'?[]:combatEncounterTemplates){
    if(trace)trace.owner={label:'Combat Encounter Template '+(record?.name||record?.id||'Unnamed'),definitionType:'combatEncounterTemplate',definitionId:record?.id||null};
    const state=inspectCombatEncounterTemplate(record);
    if(state.ok&&state.record.tuning.prefabName)dep.prefabs.add(state.record.tuning.prefabName);
    else if(!state.ok)dep.preserveUnknownGraphs=true;
  }
  if(includeUiAuthoring)for(const record of typeof aiArchetypes==='undefined'?[]:aiArchetypes){
    if(trace)trace.owner={label:'AI Archetype '+(record?.name||record?.id||'Unnamed'),definitionType:'aiArchetype',definitionId:record?.id||null};
    const state=inspectAiArchetype(record);
    if(state.ok){
      scanAi(state.record.brain.config);
      for(const slot of [state.record.brain.config,...(state.record.brain.config.states||[]).map(s=>s.attack).filter(Boolean)])if(slot.attackPrefab)dep.prefabs.add(slot.attackPrefab);
    }else dep.preserveUnknownGraphs=true;
  }
  // Wave 8 (Priority C/Section 23): a prefab parameter override may itself
  // be a Prefab/Mesh/Texture/Audio reference (e.g. an `attackPrefab`-bound
  // parameter overridden per-instance or per-Spawner-wave) -- resolved
  // against the SOURCE PREFAB's own `parameters` definition (which alone
  // knows each param's declared `type`) to know which bucket a given
  // override value belongs in, since `prefabParams` itself is just
  // `{paramId: value}` with no type info inline.
  function scanPrefabParams(sourcePrefabName, prefabParams) {
    if (!prefabParams) return;
    const prefab = prefabs.find((p) => p.name === sourcePrefabName);
    if (!prefab || !prefab.parameters) return;
    for (const param of prefab.parameters) {
      const value = prefabParams[param.id];
      if (value == null) continue;
      if (param.type === 'prefabReference') dep.prefabs.add(value);
      else if (param.type === 'meshAsset') dep.meshAssets.add(value);
      else if (param.type === 'textureAsset') dep.textureAssets.add(value);
      else if (param.type === 'audioAsset') dep.audioAssets.add(value);
    }
  }
  function scanObjectRecord(record) {
    const previousOwner=trace?.owner;if(trace)trace.owner={...previousOwner,label:previousOwner.label+' / Object '+(record.name||record.id||record.kind),objectId:record.id||null};
    // Linked assemblies are not restricted to Cube/Sprite roots. In
    // particular, a grouped lighting rig must retain its reusable definition.
    if(record.kind!=='cube'&&record.kind!=='sprite'&&record.sourcePrefabName){dep.prefabs.add(record.sourcePrefabName);scanPrefabParams(record.sourcePrefabName,record.prefabParams);}
    if (record.kind === 'cube') {
      if (record.mesh === 'asset' && record.assetId) dep.meshAssets.add(record.assetId);
      if (record.textureAssetId) dep.textureAssets.add(record.textureAssetId);
      scanAi(record.ai);
      const brain = OpusAiBrain.inspect(record.components?.['ai-brain']);
      if (brain.ok) scanAi(brain.record.config);
      else if (Object.prototype.hasOwnProperty.call(record.components || {}, 'ai-brain')) {
        // Unknown authored data stays inert, but its opaque references must
        // remain recoverable. Reuse the conservative unknown-content closure.
        dep.preserveUnknownGraphs = true;
      }
      scanBehaviors(record.behaviors);
      // Post-Wave-9 dogfood -- REAL BUG found live building Signal Relay:
      // a placed instance LINKED to a prefab (`sourcePrefabName`) never
      // added that prefab's own name to `dep.prefabs` -- only a Spawner/
      // AI-attack/weapon-projectile REFERENCE to a prefab name did. A
      // prefab used only for ordinary linked placement (the Wave 6
      // flagship "place from the palette, Duplicate for more, Update From
      // Prefab to re-sync" workflow -- exactly what a real game creator
      // does with a reusable prop) was therefore silently dropped from
      // every Save/Export, even though its PLACED INSTANCES still render
      // correctly (their own resolved fields are baked into the record) --
      // it's continued AUTHORING (Update From Prefab / further Duplicate)
      // after a reload that silently broke, since the prefab definition
      // itself, including its own `parameters`, was simply gone.
      if (record.sourcePrefabName) { dep.prefabs.add(record.sourcePrefabName); scanPrefabParams(record.sourcePrefabName, record.prefabParams); }
    } else if (record.kind === 'sprite') {
      const renderer = record.components && record.components['sprite-renderer'];
      if (renderer) for (const state of OpusAuthoringPlumbing.normalizeSpriteAnimationStates(renderer.animationStates)) {
        if(trace&&state.clipRef)trace.record('spriteAnimations',state.clipRef);
        if (state.clipRef && findSpriteAnimationById(state.clipRef)) dep.spriteAnimations.add(state.clipRef);
        if(trace)for(const variant of state.directionalVariants)if(variant.clipRef)trace.record('spriteAnimations',variant.clipRef);
        for (const variant of state.directionalVariants) if (variant.clipRef && findSpriteAnimationById(variant.clipRef)) dep.spriteAnimations.add(variant.clipRef);
      }
      if(trace&&renderer?.spriteAssetRef)trace.record('spriteAssets',renderer.spriteAssetRef);
      if (renderer && renderer.spriteAssetRef && findSpriteAssetById(renderer.spriteAssetRef)) dep.spriteAssets.add(renderer.spriteAssetRef);
      else if (renderer && renderer.sourceTexture) dep.textureAssets.add(renderer.sourceTexture);
      // A placed linked Sprite must retain its prefab definition for later
      // authoring, exactly like the cube branch above. The Sprite Asset is
      // still shared independently through the component reference.
      if (record.sourcePrefabName) { dep.prefabs.add(record.sourcePrefabName); scanPrefabParams(record.sourcePrefabName, record.prefabParams); }
      scanBehaviors(record.behaviors);
    } else if (record.kind === 'tilemap') {
      if (record.sourcePrefabName) { dep.prefabs.add(record.sourcePrefabName); scanPrefabParams(record.sourcePrefabName, record.prefabParams); }
      for (const marker of record.spawnMarkers || []) if (marker && marker.prefabRef) dep.prefabs.add(marker.prefabRef);
      if (record.tilesetRef) {
        dep.tilesets.add(record.tilesetRef);
        if (!dep.tileIdsByTileset.has(record.tilesetRef)) dep.tileIdsByTileset.set(record.tilesetRef, new Set());
        const used = dep.tileIdsByTileset.get(record.tilesetRef); for (const layer of record.layers || []) for (const cell of layer.cells || []) if (cell && cell.tileId) used.add(cell.tileId);
      }
    } else if (record.kind === 'terrain') {
      for (const id of terrainLayerTextureIds(record)) dep.textureAssets.add(id);
    } else if (record.kind === 'spawner' && record.options && record.options.prefabName) {
      dep.prefabs.add(record.options.prefabName);
      // Wave 9D (Priority A/Section 9-10): a Spawner's own per-wave
      // `paramOverrides` reuses the SAME `scanPrefabParams` helper the
      // instance-override scan above already calls -- exactly the reuse
      // that helper's own comment already anticipated ("per-Spawner-wave")
      // but this branch had never actually been wired to call.
      scanPrefabParams(record.options.prefabName, record.options.paramOverrides);
    }
    if(trace)trace.owner=previousOwner;
  }
  // Player Settings carry their own project-LEVEL reference fields (not
  // attached to any one placed object) -- Fixed Weapon's prefab, the
  // Player Visual's own skinned mesh asset (the fix this collector exists
  // for), and Wave 7's Equipment defs (a visual asset + an optional
  // Projectile-mode weapon prefab per item).
  function scanPlayerSettings(ps) {
    if (!ps) return;
    for (const owner of [ps.weapon,...(ps.equipmentDefs||[]).map(eq=>eq?.weapon)]) {
      if (!owner || owner.definitionRef === undefined || owner.definitionRef === '') continue;
      const state=typeof OpusWeaponDefinitions==='undefined'?{ok:false}:OpusWeaponDefinitions.resolve(owner,typeof weaponDefinitions==='undefined'?[]:weaponDefinitions);
      if(state.ok)scanWeaponAssets(state.config);else dep.preserveUnknownGraphs=true;
    }
    if (ps.footstepAudioAssetId) dep.audioAssets.add(ps.footstepAudioAssetId);
    if (ps.weapon && ps.weapon.enabled && ps.weapon.prefabName) dep.prefabs.add(ps.weapon.prefabName);
    // Wave 9 (Priority A/Section 105): Weapons 2.0's own new asset
    // reference -- the authored Empty Sound -- flows through this SAME
    // generic Player Settings scan, not a feature-specific scanner
    // (Section 105's explicit "do not add feature-specific bundling
    // scanners"). Fixed Weapon's own Empty Sound.
    if (ps.weapon && ps.weapon.emptySoundAssetId) dep.audioAssets.add(ps.weapon.emptySoundAssetId);
    if (ps.weapon && ps.weapon.fireAudioAssetId) dep.audioAssets.add(ps.weapon.fireAudioAssetId);
    if (ps.weapon && ps.weapon.impactAudioAssetId) dep.audioAssets.add(ps.weapon.impactAudioAssetId);
    if (ps.visual && ps.visual.assetId) dep.meshAssets.add(ps.visual.assetId);
    for (const eq of ps.equipmentDefs || []) {
      if (eq.assetId) dep.meshAssets.add(eq.assetId);
      if (eq.weapon && eq.weapon.mode === 'projectile' && eq.weapon.prefabName) dep.prefabs.add(eq.weapon.prefabName);
      if (eq.weapon && eq.weapon.emptySoundAssetId) dep.audioAssets.add(eq.weapon.emptySoundAssetId);
      if (eq.weapon && eq.weapon.fireAudioAssetId) dep.audioAssets.add(eq.weapon.fireAudioAssetId);
      if (eq.weapon && eq.weapon.impactAudioAssetId) dep.audioAssets.add(eq.weapon.impactAudioAssetId);
    }
  }
  function scanWeaponAssets(config) {
    if(config.prefabName)dep.prefabs.add(config.prefabName);
    for(const key of ['fireAudioAssetId','emptySoundAssetId','impactAudioAssetId'])if(config[key])dep.audioAssets.add(config[key]);
  }
  // Named assets remain reusable after Save; unused authoring assets retain dependencies too.
  for(const record of typeof weaponDefinitions==='undefined'?[]:weaponDefinitions){
    if(trace)trace.owner={label:'Weapon Definition '+(record?.name||record?.id||'Unnamed'),definitionType:'weaponDefinition',definitionId:record?.id||null};
    const state=typeof OpusWeaponDefinitions==='undefined'?{ok:false}:OpusWeaponDefinitions.inspect(record);
    if(state.ok)scanWeaponAssets(state.record.config);else dep.preserveUnknownGraphs=true;
  }
  if (includeUiAuthoring && typeof uiTemplates !== 'undefined') for (const template of uiTemplates) {
    if(trace)trace.owner={label:'UI Template '+(template?.name||template?.id||'Unnamed'),definitionType:'uiTemplate',definitionId:template?.id||null};
    for (const element of Array.isArray(template?.elements) ? template.elements : []) {
      if (element?.kind === 'image' && element.textureAssetId) dep.textureAssets.add(element.textureAssetId);
      if (element?.kind === 'button') scanActionParams(element.buttonAction, element.buttonParams || {});
    }
  }
  for (const level of dependencyLevels) {
    if(trace)trace.owner={label:'Level '+(level.name||level.id||'Unnamed'),levelId:level.id||null};
    for (const record of playMode ? authoredLevelObjectRecords(level) : level.objects) scanObjectRecord(record);
    if (level.sequences !== undefined && !Array.isArray(level.sequences)) dep.preserveUnknownGraphs = true;
    for (const sequence of Array.isArray(level.sequences) ? level.sequences : []) {
      if (!sequence || !Array.isArray(sequence.steps)) { dep.preserveUnknownGraphs = true; continue; }
      for (const step of sequence.steps) {
        if (!step || typeof step !== 'object' || Array.isArray(step)) { dep.preserveUnknownGraphs = true; continue; }
        if (step.kind === 'delay') continue;
        if (step.kind !== undefined && step.kind !== 'action' || !Object.prototype.hasOwnProperty.call(ACTION_TYPES,step.actionType) || step.params !== undefined && (!step.params || typeof step.params !== 'object' || Array.isArray(step.params))) { dep.preserveUnknownGraphs = true; continue; }
        scanActionParams(step.actionType, step.params);
      }
    }
    scanPlayerSettings(level.playerSettings);
    if (level.ambientAudio && level.ambientAudio.audioAssetId) dep.audioAssets.add(level.ambientAudio.audioAssetId);
    if (level.ui && level.ui.winAudioAssetId) dep.audioAssets.add(level.ui.winAudioAssetId);
    if (level.ui && level.ui.loseAudioAssetId) dep.audioAssets.add(level.ui.loseAudioAssetId);
    for (const element of level.ui?.hudElements || []) {
      if (element?.kind === 'image' && element.textureAssetId) dep.textureAssets.add(element.textureAssetId);
      if (element?.kind === 'button') scanActionParams(element.buttonAction, element.buttonParams || {});
    }
    // Wave 9C (Priority A/Section 9): Scatter Layer prefab sources flow
    // through this SAME generic per-level scan -- no `usedScatterPrefabNames()`
    // or other feature-specific scanner. A Layer's generated INSTANCES are
    // already ordinary placed cube records (scanned by `scanObjectRecord`
    // above via their own `assetId`/prefab-instance fields); this covers
    // the Layer's own DEFINITION referencing a prefab with zero generated
    // instances yet (e.g. authored, then only ever Undo'd/never painted).
    for (const layer of level.scatterLayers || []) {
      for (const source of layer.sources || []) { if (source.prefabName) dep.prefabs.add(source.prefabName); }
    }
  }
  // Every currently-loaded skinned asset may carry its own Animation Events
  // (asset-level metadata, Wave 7 Priority B) -- scanned unconditionally for
  // every asset (not just ones already known-used), since an event's own
  // action (e.g. `sound`) is what might be the ONLY thing pulling in an
  // audio dependency in the first place.
  for (const asset of assets) if (asset.animationEvents !== undefined) { if(trace)trace.owner={label:'Mesh animation events '+(asset.name||asset.id),assetType:'mesh',assetId:asset.id};scanAnimationEvents(asset.animationEvents); }
  // Recursive prefab closure (Section 7): a bundled prefab's own record(s)
  // may themselves reference further prefabs/assets (a nested Spawner, a
  // nested Behavior, nested AI) -- repeat until no new prefab name is
  // discovered. `visitedPrefabs` guards cycles (a prefab chain that
  // eventually references itself is scanned exactly once, never looped
  // forever).
  const visitedPrefabs = new Set();
  let frontier = Array.from(dep.prefabs);
  while (frontier.length > 0) {
    const name = frontier.pop();
    if (visitedPrefabs.has(name)) continue;
    visitedPrefabs.add(name);
    const prefab = prefabs.find((p) => p.name === name);
    if (!prefab) continue;
    if(trace)trace.owner={label:'Prefab '+name,prefabName:name};
    const records = prefab.records || (prefab.record ? [prefab.record] : []);
    for (const record of records) {
      const before = dep.prefabs.size;
      scanObjectRecord(record);
      if (dep.prefabs.size > before) for (const n of dep.prefabs) if (!visitedPrefabs.has(n)) frontier.push(n);
    }
    // A prefab's own parameter DEFAULTS (not just an instance's override)
    // may themselves be Prefab/Mesh/Texture/Audio references -- real even
    // if no placed instance ever overrides that parameter.
    for (const param of prefab.parameters || []) {
      if (param.default == null) continue;
      if (param.type === 'prefabReference' && !visitedPrefabs.has(param.default)) { dep.prefabs.add(param.default); frontier.push(param.default); }
      else if (param.type === 'meshAsset') dep.meshAssets.add(param.default);
      else if (param.type === 'textureAsset') dep.textureAssets.add(param.default);
      else if (param.type === 'audioAsset') dep.audioAssets.add(param.default);
    }
  }
  // Mesh-owned textures must survive Save/Export too, including Player
  // Visual and equipment assets with no ordinary placed instance.
  for (const id of dep.meshAssets) {
    const asset = findAssetById(id);
    if(trace)trace.owner={label:'Mesh '+(asset?.name||id),assetType:'mesh',assetId:id};
    if (asset && asset.textureAssetId) dep.textureAssets.add(asset.textureAssetId);
  }
  // Phase 003: one bounded derived-asset dependency hook. Current Mesh,
  // Texture and Audio adapters return no additional dependencies, so all
  // existing packaging remains unchanged. A later registered derived type
  // (Sprite -> Texture, Atlas -> Texture) can declare dependencies without
  // adding another feature-specific project scanner.
  const registeredAssetCollections = { mesh: assets, texture: textureAssets, sprite: spriteAssets, 'sprite-animation': spriteAnimationClips, tileset: tilesets, audio: audioAssets };
  const dependencyBuckets = { mesh: dep.meshAssets, texture: dep.textureAssets, sprite: dep.spriteAssets, 'sprite-animation': dep.spriteAnimations, tileset: dep.tilesets, audio: dep.audioAssets };
  // Unknown graph semantics cannot safely prove assets unused. Preserve available
  // authoring content rather than destructively pruning a recoverable project.
  if(dep.preserveUnknownGraphs){if(trace)trace.owner={label:'Conservative unknown-content retention',retainedOnly:true};for(const [kind,collection] of Object.entries(registeredAssetCollections))for(const asset of collection)if(asset?.id)dependencyBuckets[kind].add(asset.id);for(const prefab of prefabs)if(prefab?.name)dep.prefabs.add(prefab.name);for(const set of tilesets)dep.tileIdsByTileset.set(set.id,new Set((set.tiles||[]).map(t=>t.id)));}
  const queue = [];
  for (const [assetType, ids] of Object.entries(dependencyBuckets)) for (const id of ids) queue.push({ assetType, id });
  const visitedRegisteredDependencies = new Set();
  while (queue.length) {
    const current = queue.shift();
    const key = `${current.assetType}:${current.id}`;
    if (visitedRegisteredDependencies.has(key)) continue;
    visitedRegisteredDependencies.add(key);
    const asset = (registeredAssetCollections[current.assetType] || []).find((entry) => entry.id === current.id);
    if (!asset) continue;
    if(trace)trace.owner={label:current.assetType+' '+(asset.name||current.id),assetType:current.assetType,assetId:current.id};
    const dependencies = current.assetType === 'tileset' && dep.tileIdsByTileset.has(current.id)
      ? (asset.tiles || []).filter((tile) => dep.tileIdsByTileset.get(current.id).has(tile.id) && tile.spriteAssetRef).map((tile) => ({ assetType: 'sprite', id: tile.spriteAssetRef }))
      : OpusAuthoringPlumbing.assetTypes.getDependencies(asset, current.assetType);
    for (const dependency of dependencies) {
      const bucket = dependencyBuckets[dependency.assetType];
      if (!bucket || !dependency.id) continue;
      if(trace)trace.record(Object.keys(dep).find(name=>dep[name]===bucket),dependency.id);
      if (!bucket.has(dependency.id)) bucket.add(dependency.id);
      queue.push(dependency);
    }
  }
  if(inspection){inspection.edges=trace.edges;inspection.truncated=trace.truncated;inspection.preserveUnknownGraphs=!!dep.preserveUnknownGraphs;}
  return dep;
}

// Wave 8: the two hand-maintained scanners that used to live here
// (`usedPrefabNames`/`usedPrefabNamesFromPlayerSettings`) are superseded by
// `collectProjectDependencies()` above and were removed rather than kept
// dead -- every call site now goes through the one collector.

