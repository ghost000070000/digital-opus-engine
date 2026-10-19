// ===== Copy / Cut / Paste =====
// Ctrl+C copies the selection (with everything parented under it), Ctrl+X
// cuts it, Ctrl+V pastes. Pastes land under the mouse when it is over the
// viewport (resting on surfaces when surface snap is on), otherwise beside
// the original. The clipboard lives in this browser, so it works across
// levels, projects and tabs; the Models, Textures, Sprites and Audio the
// objects use travel with them, and ids that clash with different assets in
// the target project are renamed rather than silently reusing the wrong one.
const EDITOR_CLIPBOARD_KEY = 'doengine:clipboard';
let editorClipboard = null; // last payload copied in this tab
let clipboardPasteCount = 0;
let clipboardPointer = null; // { x, y } while the pointer is over the viewport

function clipboardWalkStrings(value, visit) {
  if (typeof value === 'string') { visit(value); return; }
  if (!value || typeof value !== 'object') return;
  if (ArrayBuffer.isView(value)) return;
  if (Array.isArray(value)) { for (const entry of value) clipboardWalkStrings(entry, visit); return; }
  for (const key of Object.keys(value)) clipboardWalkStrings(value[key], visit);
}
function clipboardRewriteIds(value, map) {
  if (!map.size) return value;
  if (typeof value === 'string') return map.has(value) ? map.get(value) : value;
  if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) return value.map((entry) => clipboardRewriteIds(entry, map));
  const out = {};
  for (const key of Object.keys(value)) out[key] = clipboardRewriteIds(value[key], map);
  return out;
}
// Asset ids referenced anywhere in the records (and by those assets in turn).
function clipboardAssetIds(records) {
  const pools = { meshAssets: assets, textureAssets, spriteAssets, audioAssets };
  const known = Object.fromEntries(Object.entries(pools).map(([bucket, list]) => [bucket, new Map(list.map((a) => [a.id, a]))]));
  const used = { meshAssets: new Set(), textureAssets: new Set(), spriteAssets: new Set(), audioAssets: new Set() };
  const queue = [records];
  while (queue.length) {
    clipboardWalkStrings(queue.pop(), (s) => {
      for (const bucket of Object.keys(known)) {
        if (!used[bucket].has(s) && known[bucket].has(s)) {
          used[bucket].add(s);
          const asset = known[bucket].get(s);
          // Follow an asset's own small references (a model's texture, a sprite's image).
          queue.push(Object.fromEntries(Object.entries(asset).filter(([, v]) => typeof v === 'string' && v.length < 200)));
        }
      }
    });
  }
  return used;
}
function buildClipboardPayload(selection, primary) {
  const members = [];
  const seen = new Set();
  for (const item of selection) {
    for (const member of [item, ...collectDescendants(item)]) if (!seen.has(member)) { seen.add(member); members.push(member); }
  }
  if (!members.length) return null;
  const records = JSON.parse(JSON.stringify(members.map(serializeItemRecord)));
  const used = clipboardAssetIds(records);
  const root = primary && seen.has(primary) ? primary : members[0];
  return {
    version: 1, kind: 'opus-objects', copiedAt: Date.now(), rootId: root.id, records,
    assets: {
      textureAssets: serializeTextureAssets(used.textureAssets), spriteAssets: serializeSpriteAssets(used.spriteAssets),
      audioAssets: serializeAudioAssets(used.audioAssets), meshAssets: serializeAssets(used.meshAssets),
    },
  };
}
function storeClipboardPayload(payload) {
  editorClipboard = payload;
  try { localStorage.setItem(EDITOR_CLIPBOARD_KEY, JSON.stringify(payload)); return true; }
  catch (error) {
    // Too big for browser storage with its media: keep the objects so other
    // levels and tabs of this project can still paste them.
    try { localStorage.setItem(EDITOR_CLIPBOARD_KEY, JSON.stringify({ ...payload, assets: {}, assetsOmitted: true })); } catch (inner) { /* this tab only */ }
    return false;
  }
}
function readClipboardPayload() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(EDITOR_CLIPBOARD_KEY) || 'null'); } catch (error) { stored = null; }
  const valid = (p) => p && p.kind === 'opus-objects' && p.version === 1 && Array.isArray(p.records) && p.records.length;
  if (valid(editorClipboard) && (!valid(stored) || editorClipboard.copiedAt >= stored.copiedAt)) return editorClipboard;
  return valid(stored) ? stored : null;
}

// Which clipboard assets to load, and which ids must be renamed because the
// target project already uses them for something else.
function planClipboardAssets(bundle) {
  const map = new Map(), load = { textureAssets: [], audioAssets: [], spriteAssets: [], meshAssets: [] };
  const sameMesh = (a, b) => a.name === b.name && a.sourceFilename === b.sourceFilename && (a.positions?.length || 0) === (b.positions?.length || 0) && (a.indices?.length || 0) === (b.indices?.length || 0);
  const sameMedia = (a, b) => a.dataURL === b.dataURL;
  const sameSprite = (a, b) => JSON.stringify(OpusAuthoringPlumbing.createSpriteAsset(a)) === JSON.stringify(clipboardRewriteIds(b, map));
  const steps = [
    ['textureAssets', (id) => findTextureAssetById(id), sameMedia, generateTextureId],
    ['audioAssets', (id) => findAudioAssetById(id), sameMedia, generateAudioId],
    ['spriteAssets', (id) => findSpriteAssetById(id), sameSprite, generateSpriteAssetId],
    ['meshAssets', (id) => findAssetById(id), sameMesh, generateAssetId],
  ];
  for (const [bucket, find, same, generate] of steps) {
    for (const record of (bundle && bundle[bucket]) || []) {
      if (!record || typeof record.id !== 'string') continue;
      const existing = find(record.id);
      if (existing && same(existing, record)) continue;
      let id = record.id;
      if (existing) { do { id = generate(); } while (find(id)); map.set(record.id, id); }
      load[bucket].push({ ...clipboardRewriteIds({ ...record, id: undefined }, map), id });
    }
  }
  return { map, load };
}

function clipboardPastePoint(payload) {
  if (clipboardPointer && typeof screenSurfaceHit === 'function') {
    const hit = screenSurfaceHit(clipboardPointer.x, clipboardPointer.y, null);
    if (hit) return { point: hit.point, surfaceY: hit.point.y };
  }
  const root = payload.records.find((r) => r.id === payload.rootId) || payload.records[0];
  const pos = root.position || root.options?.position || [0, 0, 0];
  clipboardPasteCount = clipboardPasteCount % 8 + 1;
  return { point: new Opus.Vec3(pos[0] + 1.5 * clipboardPasteCount, pos[1], pos[2] + 1.5 * clipboardPasteCount), surfaceY: null };
}

function copySelection(cut = false) {
  if (playMode) { showStatus('Stop Play before copying objects.'); return false; }
  if (!selectedItems.size) { showStatus('Select objects to copy.'); return false; }
  const payload = buildClipboardPayload([...selectedItems], selectedItem);
  if (!payload) return false;
  const withMedia = storeClipboardPayload(payload);
  const count = payload.records.length, noun = count === 1 ? 'object' : 'objects';
  if (cut) { // remove exactly what was copied, children included
    for (const item of [...selectedItems]) for (const child of collectDescendants(item)) selectedItems.add(child);
    deleteSelected();
  }
  showStatus(`${cut ? 'Cut' : 'Copied'} ${count} ${noun}${withMedia ? '' : ' (media too large for other projects; this project can still paste)'} · Ctrl+V pastes`);
  return true;
}
function pasteClipboard() {
  if (playMode) { showStatus('Stop Play before pasting objects.'); return null; }
  const payload = readClipboardPayload();
  if (!payload) { showStatus('Nothing to paste yet. Select objects and press Ctrl+C.'); return null; }
  const { map, load } = planClipboardAssets(payload.assets);
  let records = clipboardRewriteIds(JSON.parse(JSON.stringify(payload.records)), map);
  const missing = new Set();
  clipboardWalkStrings(records, (s) => { if (/^asset\d+$/.test(s) && !findAssetById(s) && !load.meshAssets.some((a) => a.id === s)) missing.add(s); });
  if (missing.size && payload.assetsOmitted) { showStatus('These objects use models that were too large to carry between projects. Paste them in the project they came from.'); return null; }
  // A level keeps exactly one default Spawn Point and one active Camera.
  if (placed.some((p) => p.isDefaultSpawn)) for (const r of records) if (r.isDefaultSpawn) r.isDefaultSpawn = false;
  if (placed.some((p) => p.isActiveCamera)) for (const r of records) if (r.isActiveCamera) r.isActiveCamera = false;
  const { point, surfaceY } = clipboardPastePoint(payload);
  pushUndo();
  loadTextureAssets(load.textureAssets); loadAudioAssets(load.audioAssets); loadSpriteAssets(load.spriteAssets); loadAssets(load.meshAssets);
  let newItems;
  try { newItems = instantiatePrefabAssembly({ records, rootId: payload.rootId }, point); }
  catch (error) { showStatus('Paste failed: ' + error.message); return null; }
  const signalOwners = new Set(records.map((r) => r.signalPrefabInstanceId).filter(Boolean));
  newItems.forEach((item, index) => {
    // Ordinary objects stay ordinary; only pasted prefab instances keep a signal scope.
    if (!records[index] || !signalOwners.size) delete item.signalPrefabInstanceId;
  });
  for (const item of newItems) addPlaced(item);
  hierarchyTickToken++;
  updateHierarchyTransforms();
  if (surfaceY !== null && typeof restNewItemsOnSurface === 'function') restNewItemsOnSurface(newItems, surfaceY);
  selectedItems.clear();
  for (const item of newItems) selectedItems.add(item);
  selectedItem = newItems.find((item) => item.id === newItems._newRootId) || newItems[0] || null;
  syncSelectionMarkers();
  renderSceneList();
  renderInspector();
  if (map.size || load.meshAssets.length || load.textureAssets.length || load.audioAssets.length || load.spriteAssets.length) {
    if (typeof refreshAssetDiscovery === 'function') refreshAssetDiscovery();
  }
  const brought = load.meshAssets.length + load.textureAssets.length + load.audioAssets.length + load.spriteAssets.length;
  showStatus(`Pasted ${newItems.length} object${newItems.length === 1 ? '' : 's'}${brought ? ` and ${brought} asset${brought === 1 ? '' : 's'}` : ''} · Undo removes ${newItems.length === 1 ? 'it' : 'them'}`);
  return newItems;
}

canvas.addEventListener('pointermove', (event) => { clipboardPointer = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerleave', () => { clipboardPointer = null; });
window.addEventListener('keydown', (event) => {
  if (playMode || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  const key = event.key.toLowerCase();
  if (key !== 'c' && key !== 'x' && key !== 'v') return;
  const active = document.activeElement, tag = active && active.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active?.isContentEditable) return;
  if ([...document.querySelectorAll('[role="dialog"]')].some((d) => !d.hidden && d.offsetParent !== null)) return; // dialogs keep their own copy/paste
  if ((key === 'c' || key === 'x') && String(window.getSelection?.() || '')) return; // copying page text
  event.preventDefault();
  if (key === 'v') pasteClipboard(); else copySelection(key === 'x');
});
if (typeof COMMAND_PALETTE_ACTIONS !== 'undefined') {
  COMMAND_PALETTE_ACTIONS.push(
    { label: 'Copy Selection', hint: 'Ctrl+C', run: () => copySelection(false) },
    { label: 'Cut Selection', hint: 'Ctrl+X', run: () => copySelection(true) },
    { label: 'Paste', hint: 'Ctrl+V', run: () => pasteClipboard() },
  );
}
