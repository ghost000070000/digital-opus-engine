// Phase 039: a first-party, authoring-only portable Tilemap/Chunk format.
// The format implementation is kept outside the runtime engine and is only
// embedded in Editable exports. Import is always verify -> preview -> one
// transaction; no parsed record reaches editor state before confirmation.
let pendingTilemapBundleAction = null;
let tilemapBundlePreviewGeneration = 0;
function captureTilemapBundleLease(rootReader) {
  return { generation: tilemapBundlePreviewGeneration, levelsOwner: levels, levelIndex: currentLevelIndex,
    project: JSON.stringify(captureAssetReplacementState().project),
    undoOwner: undoStack, redoOwner: redoStack, undoLength: undoStack.length, redoLength: redoStack.length,
    undoTail: undoStack[undoStack.length - 1], redoTail: redoStack[redoStack.length - 1],
    rootReader, root: rootReader ? JSON.stringify(rootReader()) : null };
}
function assertTilemapBundleLease(lease) {
  if (playMode) throw new Error('Stop Play before using a portable bundle preview.');
  if (!lease || lease.generation !== tilemapBundlePreviewGeneration) throw new Error('Portable bundle preview canceled or superseded; prepare a fresh preview.');
  if (lease.levelsOwner !== levels || lease.levelIndex !== currentLevelIndex || lease.undoOwner !== undoStack || lease.redoOwner !== redoStack ||
      lease.undoLength !== undoStack.length || lease.redoLength !== redoStack.length || lease.undoTail !== undoStack[undoStack.length - 1] || lease.redoTail !== redoStack[redoStack.length - 1] ||
      lease.project !== JSON.stringify(captureAssetReplacementState().project) || (lease.rootReader && lease.root !== JSON.stringify(lease.rootReader()))) {
    throw new Error('Portable bundle preview is stale; project, assets or history changed. Prepare a fresh preview.');
  }
}
function tilemapBundleProjectView() {
  return {
    tilesets: serializeTilesets(), spriteAssets: serializeSpriteAssets(new Set(spriteAssets.map((entry) => entry.id))),
    textures: serializeTextureAssets(new Set(textureAssets.map((entry) => entry.id))), prefabs: JSON.parse(JSON.stringify(prefabs)),
    meshAssets: serializeAssets(new Set(assets.map((entry) => entry.id))), audio: serializeAudioAssets(new Set(audioAssets.map((entry) => entry.id))),
    spriteAnimations: serializeSpriteAnimationClips(new Set(spriteAnimationClips.map((entry) => entry.id))),
    sortingLayers: orderedSpriteSortingLayers().map((layer) => ({ id: layer.id, name: layer.name, order: layer.order })),
    tilemapChunks: serializeTilemapChunks(),
    collisionLayers: JSON.parse(JSON.stringify(collisionLayers)),
  };
}
function bundleSafeName(value) { return String(value || 'tilemap').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tilemap'; }
function downloadTextFile(text, filename) { const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
function closeTilemapBundleModal(invalidate = true) { if (invalidate) tilemapBundlePreviewGeneration++; pendingTilemapBundleAction = null; const modal = document.getElementById('tilemap-bundle-modal'); modal.style.display = 'none'; document.getElementById('tilemap-bundle-summary').textContent = ''; document.getElementById('tilemap-bundle-warnings').textContent = ''; }
function openTilemapBundleModal(title, summary, warnings, confirmLabel, action) {
  pendingTilemapBundleAction = action; document.getElementById('tilemap-bundle-title').textContent = title;
  const rows = Object.entries(summary || {}).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: ${value}`);
  document.getElementById('tilemap-bundle-summary').textContent = rows.join(' · ');
  document.getElementById('tilemap-bundle-warnings').textContent = (warnings || []).join(' · ');
  document.getElementById('tilemap-bundle-confirm').textContent = confirmLabel;
  document.getElementById('tilemap-bundle-modal').style.display = 'flex';
}
async function previewTilemapBundleExport(rootKind, source) {
  try {
    if (playMode) throw new Error('Stop Play before preparing a portable bundle.');
    closeTilemapBundleModal();
    const rootReader = () => {
      if (!(rootKind === 'tilemap' ? placed : tilemapChunks).includes(source)) throw new Error('Portable bundle source was retired; prepare a fresh preview.');
      return rootKind === 'tilemap' ? serializeTilemapRecord(source) : OpusAuthoringPlumbing.normalizeTilemapChunk(source);
    };
    const lease = captureTilemapBundleLease(rootReader);
    showStatus('Preparing portable bundle…');
    const root = rootReader();
    const result = await OpusTilemapBundle.createBundle({ rootKind, root, project: tilemapBundleProjectView() });
    assertTilemapBundleLease(lease);
    const filename = `${bundleSafeName(source.name)}${result.extension}`;
    openTilemapBundleModal(`Export ${rootKind === 'tilemap' ? 'Tilemap' : 'Tilemap Chunk'}`, result.summary, [`SHA-256 ${result.sha256}`, 'Self-contained · canonical JSON · no ordinary scene objects'], 'Export Bundle', () => { assertTilemapBundleLease(lease); downloadTextFile(result.text, filename); showStatus(`Exported ${filename}`); });
  } catch (error) { showStatus(`Bundle export blocked: ${error.message}`); }
}
const assetPackFamilyLabels = { meshAssets: 'Model', textures: 'Texture', audio: 'Audio', spriteAssets: 'Sprite', spriteAnimations: 'Animation', tilesets: 'Tileset', tilemapChunks: 'Chunk', prefabs: 'Prefab', sortingLayers: 'Sorting Layer', collisionLayers: 'Collision Layer' };
function selectedAssetPackRoots() {
  return Array.from(document.getElementById('asset-pack-export-choices').querySelectorAll('input:checked')).map((input) => ({ collection: input.dataset.collection, id: input.value }));
}
function renderAssetPackExportChoices() {
  if (playMode) { showStatus('Stop Play before choosing assets for a portable pack.'); return; }
  closeTilemapBundleModal();
  const host = document.getElementById('asset-pack-export-choices');
  host.replaceChildren();
  const project = tilemapBundleProjectView();
  for (const [collection, family] of Object.entries(assetPackFamilyLabels)) {
    for (const record of project[collection] || []) {
      const id = collection === 'prefabs' ? record.name : record.id;
      const label = document.createElement('label'); label.style.display = 'block';
      const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.collection = collection; input.value = id;
      label.append(input, document.createTextNode(` ${family}: ${record.name || id}`)); host.append(label);
    }
  }
  if (!host.children.length) host.textContent = 'No library assets yet. Import or author assets first.';
}
function assetPackPermissionWarnings(dependencies) {
  return typeof projectHasScripts === 'function' && projectHasScripts(dependencies) ? [
    'Advanced logic requires Custom Script permission. Import disables approval; inspect the complete imported source in Project before enabling it. No package code runs during preview or import.',
    'Host-installed custom Action implementations are not included. Install matching trusted host metadata before copying Object-reference assemblies; missing implementations remain inert. This is not a sandbox or an executable plugin installer.',
  ] : [];
}
function previewPrefabPackage(prefab) {
  // Resolve the captured library owner on every lease check, never a later
  // occupant of the same palette index. Reuse the canonical pack pipeline.
  return previewAssetPackExport(() => {
    if (!prefabs.includes(prefab)) throw new Error('Prefab changed; choose its current Package button.');
    return [{ collection: 'prefabs', id: prefab.name }];
  });
}
async function previewAssetPackExport(readSelections = selectedAssetPackRoots) {
  try {
    if (playMode) throw new Error('Stop Play before preparing an asset pack.');
    closeTilemapBundleModal();
    const selections = readSelections();
    if (!selections.length) throw new Error('Choose at least one named library asset.');
    const lease = captureTilemapBundleLease(readSelections);
    showStatus('Preparing selected asset pack…');
    const result = await OpusTilemapBundle.createAssetPack({ project: tilemapBundleProjectView(), selections });
    assertTilemapBundleLease(lease);
    const summary = { 'Selected assets': result.summary.selected, 'Embedded files': result.summary.blobs };
    for (const [collection, family] of Object.entries(assetPackFamilyLabels)) summary[family] = result.summary[collection];
    const filename = `asset-pack${result.extension}`;
    openTilemapBundleModal('Export selected asset pack', summary, [`SHA-256 ${result.sha256}`, 'Self-contained selected assets and dependencies · no scene objects', ...assetPackPermissionWarnings(result.pack.content.dependencies)], 'Export Asset Pack', () => { assertTilemapBundleLease(lease); downloadTextFile(result.text, filename); showStatus(`Exported ${filename}`); });
  } catch (error) { showStatus(`Asset pack export blocked: ${error.message}`); }
}
function preflightAssetPackImport(verified) {
  // This is preparation only: no loaders, decoding, GPU allocation, scene
  // constructors, counters, persistence or history writes. Import Confirm
  // is mounted only after media validation and the retained lease recheck.
  if (playMode) throw new Error('Stop Play before preparing an asset pack import.');
  const retained = captureAssetReplacementState();
  validateAssetReplacementRetainedData(retained.project);
  const plan = OpusTilemapBundle.planAssetPackImport(verified, tilemapBundleProjectView());
  const d = plan.dependencies;
  const normalize = {
    spriteAssets: record => OpusAuthoringPlumbing.createSpriteAsset(record),
    spriteAnimations: record => OpusAuthoringPlumbing.createSpriteAnimationClip(record),
    tilesets: record => OpusAuthoringPlumbing.createTileset(record),
    tilemapChunks: record => OpusAuthoringPlumbing.normalizeTilemapChunk(record),
    sortingLayers: record => OpusAuthoringPlumbing.createSpriteSortingLayer(record.id, record.name, record.order),
    collisionLayers: record => OpusCollisionFilter2D.normalizeLayers([record]).find(layer => layer.id === record.id),
  };
  for (const [family, normalizeRecord] of Object.entries(normalize)) {
    for (const record of d[family]) assertAssetReplacementRetention(record, normalizeRecord(record), `incoming ${family}`);
  }
  validatePortableProjectAssetExtras({ assets: d.meshAssets, textures: d.textures, audio: d.audio });
  validateImportedPrefabs(d.prefabs);
  const knownKinds = new Set(['cube', 'sprite', 'tilemap', 'camera', 'spawner', 'emitter', 'light', 'path', 'terrain', 'water']);
  for (const prefab of d.prefabs) {
    if (!prefab.record) throw new Error('Incoming Prefab requires a supported root; use full Project transfer.');
    for (const record of [prefab.record, ...(prefab.records || [])]) {
      if (!knownKinds.has(record.kind === undefined ? 'cube' : record.kind)) throw new Error('Incoming Prefab has an unsupported object kind; use full Project transfer.');
    }
  }
  return plan;
}
async function prepareAssetPackResources(plan, lease) {
  // Validate before mounting Confirm. Decoded probes are never installed in
  // libraries and no GPU handle is allocated. Process sequentially so decoded
  // media can be reclaimed between probes; immutable encoded bytes remain.
  assertTilemapBundleLease(lease);
  let decodedBytes = 0;
  for (const record of plan.dependencies.meshAssets) {
    prepareModelAssetVariant(record, { allocate: false });
    assertTilemapBundleLease(lease);
  }
  for (const record of plan.dependencies.textures) {
    const image = await awaitAssetPackProbe(decodeTextureImage(record.dataURL), lease);
    assertTilemapBundleLease(lease);
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    const bytes = width * height * 4;
    if (!Number.isSafeInteger(bytes) || width <= 0 || height <= 0 || bytes > 64 * 1024 * 1024) throw new Error('Asset pack Texture decoded size exceeds64MiB or is invalid; project unchanged.');
    decodedBytes += bytes;
    if (decodedBytes > 128 * 1024 * 1024) throw new Error('Asset pack decoded media exceeds128MiB; split into smaller packs.');
  }
  for (const record of plan.dependencies.audio) {
    const audioBuffer = await awaitAssetPackProbe(app.audio.decodeAudio(dataURLToArrayBuffer(record.dataURL)), lease);
    assertTilemapBundleLease(lease);
    const report = analyzeAudioImport({ audioBuffer });
    if (report.issues.length) throw new Error('Asset pack Audio decode rejected: ' + report.issues.join(' '));
    decodedBytes += report.estimatedPCMBytes;
    if (decodedBytes > 128 * 1024 * 1024) throw new Error('Asset pack decoded media exceeds128MiB; split into smaller packs.');
  }
  assertTilemapBundleLease(lease);
  return { decodedBytes };
}
function awaitAssetPackProbe(promise, lease, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(deadline); clearInterval(poll); error ? reject(error) : resolve(value); };
    const deadline = setTimeout(() => finish(new Error('Asset pack decode timed out; project unchanged.')), timeoutMs);
    const poll = setInterval(() => { try { assertTilemapBundleLease(lease); } catch (error) { finish(error); } }, 100);
    Promise.resolve(promise).then(value => finish(null, value), error => finish(error));
  });
}
function validateAssetPackMediaBoundary(plan) {
  for (const record of plan.dependencies.meshAssets) if (record.type !== 'mesh') throw new Error('Skinned Models require full Project transfer until pack rig validation is qualified.');
  let bytes = 0;
  for (const record of plan.dependencies.textures) {
    if (!/^data:image\/png;base64,/i.test(record.dataURL)) throw new Error('Asset pack Texture import currently requires PNG; use full Project transfer for other image formats.');
    validateTexturePNGIntegrity(record.dataURL);
    const buffer = dataURLToArrayBuffer(record.dataURL), view = new DataView(buffer);
    if (buffer.byteLength < 33 || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) throw new Error('PNG requires a canonical initial IHDR; project unchanged.');
    const width = view.getUint32(16), height = view.getUint32(20), estimate = width * height * 4;
    if (!width || !height || !Number.isSafeInteger(estimate) || estimate > 64 * 1024 * 1024) throw new Error('Asset pack PNG dimensions exceed64MiB before decode; project unchanged.');
    bytes += estimate;
    if (bytes > 128 * 1024 * 1024) throw new Error('Asset pack PNG dimensions exceed128MiB before decode; split into smaller packs.');
  }
}
function commitAssetPackImport(verified, lease, preparedSignature, sourceLabel) {
  assertTilemapBundleLease(lease);
  const plan = preflightAssetPackImport(verified);
  validateAssetPackMediaBoundary(plan);
  if (JSON.stringify(plan) !== preparedSignature) throw new Error('Asset pack plan changed after preparation; prepare a fresh preview.');
  const state = captureAssetReplacementState(), before = state.history, target = JSON.parse(JSON.stringify(before));
  // Reuse complete retained-history/resource ownership, not the legacy bundle
  // restore which clears Model/Texture/Audio libraries. Existing Undo/Redo
  // propagates each of these independent additive variant markers.
  for (const snapshot of [before, target]) { snapshot._phase198ModelVariant = true; snapshot._phase198TextureVariant = true; snapshot._phase198AudioVariant = true; }
  for (const family of OpusTilemapBundle.PACK_COLLECTIONS) target[family].push(...JSON.parse(JSON.stringify(plan.dependencies[family])));
  if (plan.dependencies.prefabs.length) target.scriptsTrusted = false;
  restoreAssetReplacementSnapshot(target);
  if (typeof projectHasScripts === 'function' && projectHasScripts(plan.dependencies)) {
    scriptsTrusted = false; scriptTrustRevoked = true; scriptTrustSeen = true;
    closeScriptTrustReview(); renderScriptTrustControls();
  }
  undoStack.push(before); if (undoStack.length > MAX_HISTORY) undoStack.shift(); redoStack.length = 0; updateUndoRedoButtons();
  renderTilesetLibrary(); renderTilemapChunkLibrary(); renderPrefabPalette(); validateCurrentProject();
  showStatus(`Imported ${sourceLabel || 'asset pack'}; original assets retained, one Undo step, no scene objects added.`);
  return plan;
}
async function previewAssetPackImportFile(file) {
  try {
    if (playMode) throw new Error('Stop Play before preparing an asset pack import.');
    if (!file || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > OpusTilemapBundle.LIMITS.textBytes) throw new Error('Asset pack file exceeds64MiB or has an invalid size; project unchanged.');
    closeTilemapBundleModal(); const lease = captureTilemapBundleLease();
    const text = await file.text(); assertTilemapBundleLease(lease);
    const verified = await OpusTilemapBundle.verifyAssetPackText(text); assertTilemapBundleLease(lease);
    const plan = preflightAssetPackImport(verified); validateAssetPackMediaBoundary(plan);
    showStatus('Checking asset pack media…');
    await prepareAssetPackResources(plan, lease); assertTilemapBundleLease(lease);
    const signature = JSON.stringify(plan);
    openTilemapBundleModal('Import reusable asset pack', plan.summary, ['Keep both: original assets and references remain unchanged; incoming conflicts receive new identities.', 'Library only · no scene objects added', ...assetPackPermissionWarnings(plan.dependencies), ...plan.warnings], 'Import Asset Pack', () => commitAssetPackImport(verified, lease, signature, file.name));
  } catch (error) { showStatus(`Asset pack import rejected: ${error.message}`); }
}
function planTilemapBundleImport(verified) {
  const plan=OpusTilemapBundle.planImport(verified, tilemapBundleProjectView());
  // Imported dependencies must satisfy the same constructor prerequisites as
  // project reopening. Refuse before touching assets/history, not after Save.
  validateImportedPrefabs(plan.dependencies.prefabs);
  return plan;
}
function commitTilemapBundleImport(plan, sourceLabel) {
  if (playMode) throw new Error('Stop Play before importing a portable bundle.');
  const before = captureTilemapBundleSnapshot();
  try {
    const d = plan.dependencies;
    validateImportedPrefabs(d.prefabs);
    collisionLayers.push(...(d.collisionLayers || [])); renderCollisionLayerManager();
    loadAssets(d.meshAssets); loadTextureAssets(d.textures); loadSpriteAssets(d.spriteAssets); loadSpriteAnimationClips(d.spriteAnimations); loadTilesets(d.tilesets); loadAudioAssets(d.audio);
    for (const layer of d.sortingLayers || []) { spriteSortingLayers.push(OpusAuthoringPlumbing.createSpriteSortingLayer(layer.id, layer.name, layer.order)); reconcileSpriteSortingLayerIdCounter(layer.id); }
    const addedPrefabs = mergeBundledPrefabs(d.prefabs); if (addedPrefabs) scriptsTrusted = false;
    let imported;
    if (plan.rootKind === 'tilemap') {
      const record = { ...plan.root, id: generateItemId(), parentId: undefined, groupId: undefined };
      imported = instantiateTilemapRecord(record); imported.id = record.id; addPlaced(imported); selectItem(imported); syncCurrentLevelObjects();
    } else {
      imported = OpusAuthoringPlumbing.normalizeTilemapChunk(plan.root); tilemapChunks.push(imported); reconcileTilemapChunkIdCounter(imported.id); selectedTilemapChunkId = imported.id;
    }
    undoStack.push(before); if (undoStack.length > MAX_HISTORY) undoStack.shift(); redoStack.length = 0; updateUndoRedoButtons();
    renderTilesetLibrary(); renderTilemapChunkLibrary(); renderSpriteSortingLayerManager(); renderPrefabPalette(); validateCurrentProject();
    showStatus(`Imported ${sourceLabel || plan.rootKind} atomically${addedPrefabs ? '; imported scripts remain untrusted' : ''}`);
    return imported;
  } catch (error) {
    restoreTilemapBundleSnapshot(before);
    throw error;
  }
}
async function previewTilemapBundleImportFile(file) {
  try {
    if (playMode) throw new Error('Stop Play before preparing a portable bundle import.');
    closeTilemapBundleModal();
    const lease = captureTilemapBundleLease();
    const text = await file.text(); assertTilemapBundleLease(lease);
    const verified = await OpusTilemapBundle.verifyBundleText(text); assertTilemapBundleLease(lease);
    const plan = planTilemapBundleImport(verified);
    openTilemapBundleModal(`Import ${verified.bundle.rootKind === 'tilemap' ? 'Tilemap' : 'Tilemap Chunk'}`, plan.summary, plan.warnings.length ? plan.warnings : ['No identity collisions; incoming stable IDs will be preserved'], 'Import Atomically', () => { assertTilemapBundleLease(lease); return commitTilemapBundleImport(plan, file.name); });
  } catch (error) { showStatus(`Bundle import rejected: ${error.message}`); }
}
document.getElementById('tilemap-bundle-cancel').onclick = () => closeTilemapBundleModal();
document.getElementById('tilemap-bundle-confirm').onclick = () => { const action = pendingTilemapBundleAction; closeTilemapBundleModal(false); try { if (action) action(); } catch (error) { showStatus(`Bundle operation failed: ${error.message}`); } finally { tilemapBundlePreviewGeneration++; } };
document.getElementById('import-tilemap-bundle-btn').onclick = () => document.getElementById('import-tilemap-bundle-input').click();
document.getElementById('asset-pack-export-picker').ontoggle = (event) => { if (event.target.open) renderAssetPackExportChoices(); };
document.getElementById('asset-pack-refresh-btn').onclick = renderAssetPackExportChoices;
document.getElementById('asset-pack-export-btn').onclick = () => previewAssetPackExport();
document.getElementById('import-asset-pack-btn').onclick = () => document.getElementById('import-asset-pack-input').click();
document.getElementById('import-asset-pack-input').onchange = event => { const file = event.target.files && event.target.files[0]; event.target.value = ''; if (file) previewAssetPackImportFile(file); };
document.getElementById('import-tilemap-bundle-input').onchange = (event) => { const file = event.target.files && event.target.files[0]; event.target.value = ''; if (file) previewTilemapBundleImportFile(file); };
window.addEventListener('dragover', (event) => { if (Array.from(event.dataTransfer && event.dataTransfer.items || []).some((item) => item.kind === 'file')) event.preventDefault(); });
window.addEventListener('drop', (event) => { const file = Array.from(event.dataTransfer && event.dataTransfer.files || []).find((entry) => /\.opus-(tilemap|chunk)\.json$/i.test(entry.name)); if (file) { event.preventDefault(); previewTilemapBundleImportFile(file); } });

document.getElementById('export-btn').addEventListener('click', () => {
  try {
  const project = serializeProject();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'scene.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  const message='Project JSON download requested. Verify the downloaded file by restoring a copy; this does not prove a backup exists or change local save status.';
  document.getElementById('project-durability-detail').textContent=message;showStatus(message);
  }catch(error){showStatus('Backup generation failed: '+error.message+'. Keep this page open; current memory has not been replaced.');}
});

// Multiple named local projects, not the one hardcoded 'editor-project'
// slot -- `SaveSystem` already supported arbitrary slot names and now
// `.list()` (new: engine/src/16-save.js) can enumerate them, so this is
// purely an editor-side UI on top of existing/newly-exposed engine
// capability. This is the bounded slice of "multi-scene" actually built
// this batch: several independently-named LOCAL projects to switch
// between, not multiple levels loaded within one running project (a
// bigger, still-open architectural change -- see the final report).
function renderProjectMetaPanel() {
  document.getElementById('meta-title-input').value = projectMeta.title;
  document.getElementById('meta-author-input').value = projectMeta.author;
  document.getElementById('meta-version-input').value = projectMeta.version;
  document.getElementById('meta-description-input').value = projectMeta.description;
}
renderProjectMetaPanel();
renderSignalManager();
for (const [id, key] of [['meta-title-input', 'title'], ['meta-author-input', 'author'], ['meta-version-input', 'version'], ['meta-description-input', 'description']]) {
  document.getElementById(id).addEventListener('input', (e) => { projectMeta[key] = e.target.value; });
}

function spriteSortingLayerReferenceOwners(layerId) {
  const owners = [];
  const visit = (record) => {
    const component = record && record.components && record.components['sprite-renderer'];
    if (component && component.sortingLayerRef === layerId) owners.push(component);
  };
  for (const item of placed) visit(item);
  for (let index = 0; index < levels.length; index++) if (index !== currentLevelIndex) for (const record of levels[index].objects || []) visit(record);
  for (const prefab of prefabs) {
    if (prefab && Array.isArray(prefab.records)) for (const record of prefab.records) visit(record);
    else if (prefab && prefab.record) visit(prefab.record);
  }
  return owners;
}
function normalizeSpriteSortingLayerOrders() {
  orderedSpriteSortingLayers().forEach((layer, index) => { layer.order = index; });
}
function syncCollisionMaskVisibility(host, filter) {
  if (!host) return;
  const row = host.querySelector('[data-field-editor-row="collisionMaskRefs"]');
  if (row) row.hidden = filter.collisionMaskMode !== 'custom';
}
function mountCollisionFilterFields(host, filter) {
  const schema = OpusAuthoring.registry.get('box-collider-2d');
  OpusInspectorFields.mountSection(host, { id: 'tile-layer-filter', label: 'Tile Layer Collision Filtering', values: filter,
    fields: schema.fields.filter((field) => field.group === 'Collision Filtering').map((field) => ({ ...field, defaultValue: schema.defaults[field.key] })),
    optionsFor: () => collisionLayers.map((layer) => ({ value: layer.id, label: layer.name })), onBeforeChange: pushUndo,
    onChange: (field, value) => { filter[field.key] = value; if (filter.collisionMaskMode === 'all') filter.collisionMaskRefs = []; syncCollisionMaskVisibility(host, filter); validateCurrentProject(); },
  });
  syncCollisionMaskVisibility(host, filter);
}
function renderCollisionLayerManager() {
  const host = document.getElementById('collision-layer-list'); if (!host) return;
  const project = { collisionLayers, levels: levels.map((level, index) => index === currentLevelIndex ? { ...level, objects: placed } : level), prefabs };
  host.innerHTML = collisionLayers.map((layer, index) => {
    const reserved = layer.id === OpusCollisionFilter2D.DEFAULT_ID, use = OpusCollisionFilter2D.usage(project, layer.id);
    return `<div data-collision-layer="${escapeHtml(layer.id)}"><input aria-label="Collision Layer name" data-collision-name value="${escapeHtml(layer.name)}"${reserved ? ' disabled' : ''}><span>${use.primary.length} primary · ${use.masks.length} mask references</span><button data-collision-move="${index - 1}"${index === 0 ? ' disabled' : ''}>↑</button><button data-collision-move="${index + 1}"${index === collisionLayers.length - 1 ? ' disabled' : ''}>↓</button><select data-collision-replacement aria-label="Replacement Collision Layer"><option value="">Choose replacement…</option>${collisionLayers.filter((candidate) => candidate.id !== layer.id).map((candidate) => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)}</option>`).join('')}</select><button data-collision-delete${reserved ? ' disabled' : ''}>Delete</button></div>`;
  }).join('');
  document.getElementById('collision-layer-add').disabled = collisionLayers.length >= OpusCollisionFilter2D.MAX_LAYERS;
  const finish = (result) => { collisionLayers = project.collisionLayers; document.getElementById('collision-layer-status').textContent = result.ok ? 'Collision Layers updated.' : result.reason || 'Cannot apply this edit.'; renderCollisionLayerManager(); renderInspector(); validateCurrentProject(); };
  host.querySelectorAll('[data-collision-layer]').forEach((row) => {
    const id = row.dataset.collisionLayer;
    if (id !== OpusCollisionFilter2D.DEFAULT_ID) {
      row.insertAdjacentHTML('beforeend', '<button data-collision-rename style="grid-column:1 / -1">Rename Layer</button>');
      const rename = () => {
        const candidate = { collisionLayers: JSON.parse(JSON.stringify(collisionLayers)) };
        const result = OpusCollisionFilter2D.renameLayer(candidate, id, row.querySelector('[data-collision-name]').value);
        if (result.ok) { pushUndo(); project.collisionLayers = candidate.collisionLayers; }
        finish(result);
      };
      row.querySelector('[data-collision-rename]').onclick = rename;
      row.querySelector('[data-collision-name]').onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); rename(); } };
    }
    row.querySelectorAll('[data-collision-move]').forEach((button) => { button.onclick = () => { pushUndo(); finish(OpusCollisionFilter2D.reorderLayer(project, id, Number(button.dataset.collisionMove))); }; });
    row.querySelector('[data-collision-delete]').onclick = () => {
      const use = OpusCollisionFilter2D.usage(project, id), replacement = row.querySelector('[data-collision-replacement]').value;
      if (use.primary.length && !replacement) { document.getElementById('collision-layer-status').textContent = 'Choose an explicit primary replacement before deleting.'; return; }
      if (!confirm(`Delete this Collision Layer? Reassign ${use.primary.length} primary references and remove ${use.masks.length} mask memberships?`)) return;
      pushUndo(); finish(OpusCollisionFilter2D.deleteLayer(project, id, replacement, true));
    };
  });
  document.getElementById('collision-layer-add').onclick = () => { pushUndo(); finish(OpusCollisionFilter2D.addLayer(project, document.getElementById('collision-layer-new-name').value)); };
}
renderCollisionLayerManager();
function renderSpriteSortingLayerManager() {
  const host = document.getElementById('sprite-sorting-layer-list');
  if (!host) return;
  const ordered = orderedSpriteSortingLayers();
  host.innerHTML = ordered.map((layer, index) => `<div class="asset-row" data-sorting-layer-id="${escapeHtml(layer.id)}">
    <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:4px;align-items:center">
      <input type="text" data-sorting-layer-name="${escapeHtml(layer.id)}" aria-label="Sorting Layer name" value="${escapeHtml(layer.name)}"${layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID ? ' readonly aria-readonly="true"' : ''}>
      <button type="button" data-sorting-layer-up="${escapeHtml(layer.id)}" aria-label="Move ${escapeHtml(layer.name)} up"${index === 0 ? ' disabled' : ''}>↑</button>
      <button type="button" data-sorting-layer-down="${escapeHtml(layer.id)}" aria-label="Move ${escapeHtml(layer.name)} down"${index === ordered.length - 1 ? ' disabled' : ''}>↓</button>
      <button type="button" data-sorting-layer-delete="${escapeHtml(layer.id)}" aria-label="Delete ${escapeHtml(layer.name)}"${layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID ? ' disabled' : ''}>Delete</button>
    </div><div class="asset-row-meta">Order ${layer.order} · stable ID ${escapeHtml(layer.id)}</div></div>`).join('');
  host.querySelectorAll('[data-sorting-layer-name]').forEach((input) => {
    input.onchange = () => {
      const layer = spriteSortingLayers.find((entry) => entry.id === input.dataset.sortingLayerName);
      const name = input.value.trim();
      if (!layer || layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID) return;
      if (!name || spriteSortingLayers.some((entry) => entry.id !== layer.id && entry.name.toLowerCase() === name.toLowerCase())) {
        showStatus(!name ? 'Sorting Layer name cannot be empty' : `Sorting Layer name "${name}" is already used`);
        renderSpriteSortingLayerManager(); return;
      }
      layer.name = name;
      renderSpriteSortingLayerManager(); renderInspector();
      showStatus(`Renamed Sorting Layer to "${name}"; stable ID unchanged`);
    };
  });
  const move = (id, delta) => {
    const layer = spriteSortingLayers.find((entry) => entry.id === id);
    spriteSortingLayers = OpusAuthoringPlumbing.reorderSpriteSortingLayers(spriteSortingLayers, id, delta);
    syncAllSpriteSorting(); renderSpriteSortingLayerManager(); renderInspector();
    if (layer) showStatus(`Moved "${layer.name}" ${delta < 0 ? 'up' : 'down'}; Sprite order updated`);
  };
  host.querySelectorAll('[data-sorting-layer-up]').forEach((button) => { button.onclick = () => move(button.dataset.sortingLayerUp, -1); });
  host.querySelectorAll('[data-sorting-layer-down]').forEach((button) => { button.onclick = () => move(button.dataset.sortingLayerDown, 1); });
  host.querySelectorAll('[data-sorting-layer-delete]').forEach((button) => {
    button.onclick = () => {
      const layer = spriteSortingLayers.find((entry) => entry.id === button.dataset.sortingLayerDelete);
      if (!layer || layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID) return;
      const owners = spriteSortingLayerReferenceOwners(layer.id);
      const message = owners.length
        ? `"${layer.name}" is assigned to ${owners.length} Sprite${owners.length === 1 ? '' : 's'}. Reassign them to Default and delete this layer?`
        : `Delete unused Sprite Sorting Layer "${layer.name}"?`;
      if (!confirm(message)) { showStatus(`Kept Sorting Layer "${layer.name}"`); return; }
      for (const component of owners) component.sortingLayerRef = DEFAULT_SPRITE_SORTING_LAYER_ID;
      spriteSortingLayers = spriteSortingLayers.filter((entry) => entry.id !== layer.id);
      normalizeSpriteSortingLayerOrders(); syncAllSpriteSorting(); renderSpriteSortingLayerManager(); renderInspector();
      showStatus(`Deleted "${layer.name}"${owners.length ? ` and reassigned ${owners.length} Sprite${owners.length === 1 ? '' : 's'} to Default` : ''}`);
    };
  });
}
renderSpriteSortingLayerManager();
document.getElementById('sprite-sorting-layer-add-btn').addEventListener('click', () => {
  let number = spriteSortingLayers.length; let name = `Sorting Layer ${number}`;
  while (spriteSortingLayers.some((layer) => layer.name.toLowerCase() === name.toLowerCase())) name = `Sorting Layer ${++number}`;
  const layer = OpusAuthoringPlumbing.createSpriteSortingLayer(generateSpriteSortingLayerId(), name, spriteSortingLayers.length);
  spriteSortingLayers.push(layer); normalizeSpriteSortingLayerOrders(); renderSpriteSortingLayerManager(); renderInspector();
  showStatus(`Added Sprite Sorting Layer "${name}"`);
});

function parallaxLayerReferenceOwners(layerId) {
  const owners = [];
  const visit = (record) => {
    const component = record && record.components && record.components['sprite-renderer'];
    if (component && component.parallaxLayerRef === layerId) owners.push(component);
  };
  for (const item of placed) visit(item);
  for (let index = 0; index < levels.length; index++) if (index !== currentLevelIndex) for (const record of levels[index].objects || []) visit(record);
  for (const prefab of prefabs) for (const record of (prefab && prefab.records) || (prefab && prefab.record ? [prefab.record] : [])) visit(record);
  return owners;
}
function uniqueParallaxLayerName(seed) {
  const base = String(seed || 'Parallax Layer').trim() || 'Parallax Layer';
  let name = base; let suffix = 2;
  while (parallaxLayers.some((layer) => layer.name.toLowerCase() === name.toLowerCase())) name = `${base} ${suffix++}`;
  return name;
}
function renderParallaxLayerManager() {
  const host = document.getElementById('parallax-layer-list');
  if (!host) return;
  host.innerHTML = parallaxLayers.length ? parallaxLayers.map((layer) => `<div class="asset-row" data-parallax-layer-id="${escapeHtml(layer.id)}">
    <input type="text" data-parallax-name="${escapeHtml(layer.id)}" aria-label="Parallax Layer name" value="${escapeHtml(layer.name)}">
    <div class="field-pair"><label>X <input type="number" step="0.05" data-parallax-factor-x="${escapeHtml(layer.id)}" value="${escapeHtml(layer.factorX)}"></label><label>Y <input type="number" step="0.05" data-parallax-factor-y="${escapeHtml(layer.id)}" value="${escapeHtml(layer.factorY)}"></label></div>
    <div class="field-pair"><button type="button" data-parallax-duplicate="${escapeHtml(layer.id)}">Duplicate</button><button type="button" data-parallax-delete="${escapeHtml(layer.id)}">Delete</button></div>
    <div class="asset-row-meta">stable ID ${escapeHtml(layer.id)}</div></div>`).join('') : '<p class="onboarding-empty">No named layers. Sprites use normal world motion (1,1).</p>';
  host.querySelectorAll('[data-parallax-name]').forEach((input) => {
    // Keep the backing registry in step with the visible control before blur.
    // Save/export can be invoked while an editor field still owns focus, so an
    // onchange-only binding could serialize the previous value.
    input.oninput = () => {
      const layer = parallaxLayers.find((entry) => entry.id === input.dataset.parallaxName); const name = input.value.trim();
      if (layer && name && !parallaxLayers.some((entry) => entry.id !== layer.id && entry.name.toLowerCase() === name.toLowerCase())) layer.name = name;
    };
    input.onchange = () => {
    const layer = parallaxLayers.find((entry) => entry.id === input.dataset.parallaxName); const name = input.value.trim();
    if (!layer || !name || parallaxLayers.some((entry) => entry.id !== layer.id && entry.name.toLowerCase() === name.toLowerCase())) { showStatus(!name ? 'Parallax Layer name cannot be empty' : `Parallax Layer name "${name}" is already used`); renderParallaxLayerManager(); return; }
    layer.name = name; renderParallaxLayerManager(); renderInspector(); showStatus(`Renamed Parallax Layer to "${name}"; stable ID unchanged`);
  }; });
  const bindFactor = (selector, axis) => host.querySelectorAll(selector).forEach((input) => {
    input.oninput = () => {
      const layer = parallaxLayers.find((entry) => entry.id === input.dataset[axis === 'factorX' ? 'parallaxFactorX' : 'parallaxFactorY']); const value = Number(input.value);
      if (layer && input.value !== '' && Number.isFinite(value)) layer[axis] = value;
    };
    input.onchange = () => {
    const layer = parallaxLayers.find((entry) => entry.id === input.dataset[axis === 'factorX' ? 'parallaxFactorX' : 'parallaxFactorY']); const value = Number(input.value);
    if (!layer || !Number.isFinite(value)) { showStatus('Parallax factors must be finite numbers'); renderParallaxLayerManager(); return; }
    layer[axis] = value; renderParallaxLayerManager(); renderInspector(); showStatus(`Updated ${layer.name} to X ${layer.factorX}, Y ${layer.factorY}`);
  }; });
  bindFactor('[data-parallax-factor-x]', 'factorX'); bindFactor('[data-parallax-factor-y]', 'factorY');
  host.querySelectorAll('[data-parallax-duplicate]').forEach((button) => { button.onclick = () => {
    const source = parallaxLayers.find((entry) => entry.id === button.dataset.parallaxDuplicate); if (!source) return;
    const copy = OpusAuthoringPlumbing.createParallaxLayer(generateParallaxLayerId(), uniqueParallaxLayerName(`${source.name} Copy`), source.factorX, source.factorY);
    parallaxLayers.push(copy); renderParallaxLayerManager(); renderInspector(); showStatus(`Duplicated Parallax Layer as "${copy.name}"`);
  }; });
  host.querySelectorAll('[data-parallax-delete]').forEach((button) => { button.onclick = () => {
    const layer = parallaxLayers.find((entry) => entry.id === button.dataset.parallaxDelete); if (!layer) return;
    const owners = parallaxLayerReferenceOwners(layer.id);
    const message = owners.length ? `"${layer.name}" is assigned to ${owners.length} Sprite${owners.length === 1 ? '' : 's'}. Delete it and preserve repairable stored IDs? Runtime will safely use 1,1.` : `Delete unused Parallax Layer "${layer.name}"?`;
    if (!confirm(message)) { showStatus(`Kept Parallax Layer "${layer.name}"`); return; }
    parallaxLayers = parallaxLayers.filter((entry) => entry.id !== layer.id); renderParallaxLayerManager(); renderInspector(); validateCurrentProject();
    showStatus(`Deleted "${layer.name}"${owners.length ? `; ${owners.length} repairable Sprite reference${owners.length === 1 ? '' : 's'} preserved` : ''}`);
  }; });
}
renderParallaxLayerManager();
document.getElementById('parallax-layer-add-btn').addEventListener('click', () => {
  const name = uniqueParallaxLayerName('Parallax Layer'); const layer = OpusAuthoringPlumbing.createParallaxLayer(generateParallaxLayerId(), name, 0.5, 0.5);
  parallaxLayers.push(layer); renderParallaxLayerManager(); renderInspector(); showStatus(`Added Parallax Layer "${name}"`);
});

function renderProjectList() {
  const select = document.getElementById('project-list-select');
  const slots = app.save.list();
  if (slots.length === 0) {
    select.innerHTML = '<option value="">(no saved projects yet)</option>';
    return;
  }
  select.innerHTML = slots.map((s) => {
    const when = s.savedAt ? new Date(s.savedAt).toLocaleString() : 'unknown time';
    return `<option value="${escapeHtml(s.slot)}">${escapeHtml(s.slot)} — ${escapeHtml(when)}</option>`;
  }).join('');
}
renderProjectList();

// A saved revision is independent of Undo history, exports, snapshots and
// runtime saves. Observation must not call serializeProject(): that refreshes
// derived Terrain and synchronizes stored levels as an authoring operation.
var projectDurability;
function resetProjectDurability() {
  projectDurability={signature:null,slot:null,raw:null,error:null,baseline:null,pristineBeforePlay:false};
  renderProjectDurability();
}
// A freshly booted starter or freshly opened sample has never been saved, but
// it is not creator work either: leaving or switching must not warn about it.
// Panels re-apply loaded records after load and may reorder keys without any
// authored change, so the baseline is compared key-order-insensitively. Only
// evaluated on demand (unload, opening a sample, entering Play), never per tick.
function canonicalProjectSignature() {
  const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.keys(value).sort().reduce((out,key)=>{out[key]=sort(value[key]);return out;},{}):value;
  return JSON.stringify(sort(JSON.parse(projectAuthoredSignature())));
}
function markProjectPristine() {
  try{projectDurability.baseline=canonicalProjectSignature();projectDurability.pristineBeforePlay=true;}
  catch(error){projectDurability.baseline=null;projectDurability.pristineBeforePlay=false;}
}
function projectIsUntouchedBaseline() {
  if(!projectDurability||projectDurability.signature!==null||projectDurability.baseline===null)return false;
  if(playMode)return projectDurability.pristineBeforePlay===true;
  try{return canonicalProjectSignature()===projectDurability.baseline;}
  catch(error){return false;}
}
function projectAuthoredSignature() {
  const project=captureAssetReplacementState().project;
  // Redundant active-level/history views are not project changes. The complete
  // detached levels above already own scene/UI/logic/settings/scatter data.
  for(const key of ['scene','levelUi','levelLogic','scatterAuthoring','scriptsTrusted','currentLevelIndex','_phase039FullProject'])delete project[key];
  // Decoder-discovered image dimensions are caches of the embedded bytes, not
  // a new authored revision. Actual texture bytes/metadata and every Sprite's
  // authored region/size remain covered. Slow decode must not invent edits.
  for(const texture of project.textures||[]){delete texture.width;delete texture.height;}
  return JSON.stringify({...project,meta:projectMeta,playerPreferenceScope,
    levelTransition:levelTransitionConfig,parallaxLayers,
    nextMaterialAssetId,nextWeaponDefinitionId,nextItemDefId});
}
function projectHasUnsavedChanges() {
  if(!projectDurability||projectDurability.signature===null)return true;
  // A historical signature is not enough if its only known local record was
  // removed/replaced or storage cannot currently be read. Warn before leaving.
  try{if(!projectDurability.slot||localStorage.getItem(app.save.namespace+':'+projectDurability.slot)!==projectDurability.raw)return true;}
  catch(error){return true;}
  if(playMode)return projectDurability.dirtyBeforePlay!==false;
  try{return projectAuthoredSignature()!==projectDurability.signature;}
  catch(error){return true;}
}
function renderProjectDurability() {
  if(!projectDurability)return;
  const node=document.getElementById('project-save-state');if(!node)return;
  if(projectDurability.slot&&!projectDurability.saving){
    try{if(localStorage.getItem(app.save.namespace+':'+projectDurability.slot)!==projectDurability.raw)projectDurability.error='conflict';}
    catch(error){projectDurability.error='unavailable';}
  }
  let dirty=projectHasUnsavedChanges();
  if(!playMode)projectDurability.dirtyBeforePlay=dirty;
  const nextState=projectDurability.saving?'Saving':projectDurability.error==='unavailable'?'Storage Unavailable':projectDurability.error?'Save Failed':dirty?'Unsaved Changes':'Saved';
  if(node.textContent!==nextState)node.textContent=nextState; // do not repeatedly announce unchanged live-region text
  node.title=node.textContent==='Saved'?'Current authored content is saved as "'+projectDurability.slot+'" in this browser profile at '+location.origin+'. Not an off-device backup.':'Current memory may differ from the last readable local save. Back up Project JSON before leaving.';
}
window.addEventListener('beforeunload',event=>{
  if(!playableOnlyMode&&projectHasUnsavedChanges()&&!projectIsUntouchedBaseline()){event.preventDefault();event.returnValue='';}
});
window.addEventListener('storage',event=>{
  if(projectDurability?.slot&&(event.key===null||event.key===app.save.namespace+':'+projectDurability.slot)){projectDurability.error='conflict';renderProjectDurability();}
});
// Covers authoring paths without history entries as well as asynchronous media
// completion. Recheck synchronously at Save/unload; never infer from Undo count.
setInterval(()=>{if(!playMode&&!loadingProjectGuard)renderProjectDurability();},1500);
resetProjectDurability();

async function withProjectStorageLock(work) {
  // Cooperating editor tabs serialize canonical named saves/copies/deletes.
  // Without this browser capability, portable export stays available; do not
  // pretend a read/check/write sequence is a cross-tab atomic transaction.
  if(!navigator.locks?.request){const error=new Error('Safe local save coordination is unavailable. Use a supported browser on HTTPS/localhost, or Back Up Project JSON.');error.code='unavailable';throw error;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{return await navigator.locks.request('doengine:project-save:'+app.save.namespace,{mode:'exclusive',signal:controller.signal},work);}
  finally{clearTimeout(timer);}
}
document.getElementById('save-btn').addEventListener('click', async () => {
  if(playMode){showStatus('Stop Play before saving authored work. Runtime saves are separate.');return;}
  if(projectDurability.saving)return;
  const name = document.getElementById('project-name-input').value.trim() || 'editor-project';
  const detail=document.getElementById('project-durability-detail');
  const owner=projectDurability,root=levels;
  try {
    if(name.length>160)throw new Error('Choose a save name of at most160 characters.');
    owner.saving=true;document.getElementById('save-btn').disabled=true;
    document.getElementById('project-save-state').textContent='Saving';
    const expected=projectDurability.slot===name?projectDurability.raw:null;
    const data=JSON.parse(JSON.stringify(serializeProject())),signature=projectAuthoredSignature();
    const result=await withProjectStorageLock(()=>{
      if(playMode||levels!==root||projectDurability!==owner||projectAuthoredSignature()!==signature)return {ok:false,code:'interrupted'};
      return app.save.saveChecked(name,data,expected);
    });
    if(projectDurability!==owner){showStatus('Pending save cancelled: open document changed. Current document kept.');return;}
    owner.saving=false;
    if(!result.ok){
      projectDurability.error=result.code;
      const reasons={quota:'Browser storage is full.',unavailable:'Browser storage is unavailable.',serialization:'Project serialization failed.',write:'Browser storage write failed.',verification:'The saved record could not be verified.',interrupted:'Project changed while waiting to save. No stale revision was written; save the current revision again.',conflict:'This save name already exists or changed elsewhere. It was not overwritten. Choose a new name, or open the saved project first.', 'too-large':'This project exceeds the 16 Mi-character local save safety limit.'};
      const message=(reasons[result.code]||'Save failed.')+' Current in-memory work is still open. Back Up Project JSON now before leaving; verify the downloaded file. Local history is not an off-device backup.';
      detail.textContent=message;showStatus(message);renderProjectDurability();return;
    }
    // The saved baseline belongs to the immutable revision that was written,
    // not to any edits/async authoring completion arriving after that write.
    projectDurability={signature,slot:name,raw:result.raw,error:null,dirtyBeforePlay:false};
    const newerChanges=projectHasUnsavedChanges();
    detail.textContent=(newerChanges?'The queued revision was saved; newer changes remain unsaved. Save again or back up before leaving. ':'Current authored content is saved as "'+name+'". ')+'This browser profile and origin only; not an off-device backup. Back Up Project JSON, verify the file and keep a separate copy. Browsers may suppress leave-page warnings.';
    showStatus(`Saved as "${name}" in this browser only`+(newerChanges?'; newer changes remain unsaved.':''));
    markOnboardingProgress('save');renderProjectDurability();
    renderProjectList();
  } catch (err) {
    if(projectDurability!==owner){showStatus('Pending save ended after document replacement; current document kept.');return;}
    projectDurability.error=err.code||'serialization';owner.saving=false;renderProjectDurability();
    detail.textContent='Save failed: '+err.message+'. Current work remains in memory. Try Back Up Project JSON; keep this page open if export also fails.';
    showStatus(detail.textContent);
  }finally{
    owner.saving=false;document.getElementById('save-btn').disabled=false;
  }
});

document.getElementById('delete-project-btn').addEventListener('click', async () => {
  const select = document.getElementById('project-list-select');
  const name = select.value;
  if (!name) return;
  try{
    const key=app.save.namespace+':'+name,raw=localStorage.getItem(key);
    if(raw===null)throw new Error('Saved record is missing. Refresh the list.');
    if(!window.confirm('Delete browser-local saved project "'+name+'"? Current in-memory work is kept. This removes that local saved copy; download a backup first if needed.'))return;
    await withProjectStorageLock(()=>{
      if(localStorage.getItem(key)!==raw)throw new Error('Saved record changed; deletion refused.');
      localStorage.removeItem(key);if(localStorage.getItem(key)!==null)throw new Error('Deletion could not be verified.');
    });
    if(projectDurability.slot===name){projectDurability.signature=null;projectDurability.slot=null;projectDurability.raw=null;projectDurability.error=null;renderProjectDurability();}
    showStatus(`Deleted local save "${name}"; current in-memory work kept.`);renderProjectList();
  }catch(error){showStatus('Delete failed: '+error.message+'. Current work kept.');}
});

