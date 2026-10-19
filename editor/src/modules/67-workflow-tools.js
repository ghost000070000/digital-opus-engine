// ===== Workflow tools: copy logic, select similar, view bookmarks =====
// - Copy Logic / Paste Logic (Hierarchy right-click, Ctrl+K, Ctrl+Shift+C/V):
//   copies an object's Behaviors (incl. Graphs), Script and Object Variables
//   onto every selected object. References to the source object itself are
//   pointed at each receiving object, so "open myself" stays "open myself".
// - Select Similar (Hierarchy right-click): every object using the same
//   model, the same prefab, or the same base name.
// - View bookmarks: Shift+1…9 remembers the scene view, 1…9 returns to it
//   (per project and level, in this browser).

const LOGIC_CLIPBOARD_KEY = 'doengine:logic-clipboard';
let logicClipboard = null;

function logicCapable(item) { return !!item && (item.kind === 'cube' || item.kind === 'sprite'); }
function captureLogic(item) {
  if (!logicCapable(item)) return null;
  return JSON.parse(JSON.stringify({
    version: 1, sourceId: item.id, sourceName: item.name || '',
    behaviors: item.behaviors || [], script: item.script || null, variables: item.variables || {},
  }));
}
function rewriteSourceId(value, sourceId, targetId) {
  if (typeof value === 'string') return value === sourceId ? targetId : value;
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => rewriteSourceId(entry, sourceId, targetId));
  const out = {};
  for (const key of Object.keys(value)) out[key] = rewriteSourceId(value[key], sourceId, targetId);
  return out;
}
// Adds the copied logic to `target`; returns what changed.
function applyLogicTo(target, logic) {
  const report = { behaviors: 0, script: false, scriptKept: false, variables: 0 };
  if (!logicCapable(target) || !logic || target.id === logic.sourceId) return report;
  const behaviors = rewriteSourceId(logic.behaviors, logic.sourceId, target.id);
  target.behaviors = (target.behaviors || []).concat(behaviors);
  report.behaviors = behaviors.length;
  if (logic.script && logic.script.code && logic.script.code.trim()) {
    if (target.script && target.script.code && target.script.code.trim() && target.script.code !== logic.script.code) report.scriptKept = true;
    else { target.script = JSON.parse(JSON.stringify(logic.script)); report.script = true; }
  }
  for (const [key, value] of Object.entries(logic.variables || {})) {
    target.variables = target.variables || {};
    if (!Object.prototype.hasOwnProperty.call(target.variables, key)) { target.variables[key] = value; report.variables++; }
  }
  return report;
}
function copyLogic(item = selectedItem) {
  if (playMode) return false;
  const logic = captureLogic(item);
  if (!logic) { showStatus('Select one Cube, model or Sprite to copy its logic.'); return false; }
  logicClipboard = logic;
  try { localStorage.setItem(LOGIC_CLIPBOARD_KEY, JSON.stringify(logic)); } catch (error) { /* this tab only */ }
  const parts = [`${logic.behaviors.length} behavior${logic.behaviors.length === 1 ? '' : 's'}`];
  if (logic.script && logic.script.code && logic.script.code.trim()) parts.push('script');
  if (Object.keys(logic.variables).length) parts.push(`${Object.keys(logic.variables).length} variables`);
  showStatus(`Copied logic: ${parts.join(', ')} · select objects and Paste Logic`);
  return true;
}
function readLogicClipboard() {
  try { const stored = JSON.parse(localStorage.getItem(LOGIC_CLIPBOARD_KEY) || 'null'); if (stored && stored.version === 1) return stored; } catch (error) { /* fall back */ }
  return logicClipboard;
}
function pasteLogic(targets = [...selectedItems]) {
  if (playMode) return 0;
  const logic = readLogicClipboard();
  if (!logic) { showStatus('Nothing to paste yet: right-click an object and Copy Logic.'); return 0; }
  const receivers = targets.filter((item) => logicCapable(item) && item.id !== logic.sourceId);
  if (!receivers.length) { showStatus('Select other Cubes, models or Sprites to receive the logic.'); return 0; }
  pushUndo();
  let kept = 0;
  for (const item of receivers) if (applyLogicTo(item, logic).scriptKept) kept++;
  renderInspector();
  showStatus(`Pasted logic onto ${receivers.length} object${receivers.length === 1 ? '' : 's'}${kept ? ` · ${kept} kept their own script` : ''} · Undo removes it`);
  return receivers.length;
}

// --- Select similar ---
function baseName(name) { return String(name || '').replace(/\s*(?:#\s*)?\(?\d+\)?\s*$/, '').trim().toLowerCase(); }
function similarItems(item) {
  if (!item) return [];
  if (item.assetId) return placed.filter((other) => other.assetId === item.assetId);
  if (item.sourcePrefabName) return placed.filter((other) => other.sourcePrefabName === item.sourcePrefabName);
  const base = baseName(item.name);
  if (base) return placed.filter((other) => other.kind === item.kind && baseName(other.name) === base);
  return placed.filter((other) => other.kind === item.kind && !other.assetId && !!other.isTrigger === !!item.isTrigger && !!other.isSpawnPoint === !!item.isSpawnPoint);
}
function selectSimilar(item = selectedItem) {
  if (playMode || !item) return 0;
  const items = similarItems(item);
  selectedItems.clear();
  for (const other of items) selectedItems.add(other);
  selectedItem = item;
  syncSelectionMarkers(); renderSceneList(); renderInspector();
  showStatus(`Selected ${items.length} similar object${items.length === 1 ? '' : 's'}`);
  return items.length;
}

// --- View bookmarks ---
function viewBookmarkKey() {
  const project = (app.save && app.save.namespace) || 'default';
  const level = levels[currentLevelIndex] && levels[currentLevelIndex].id || String(currentLevelIndex);
  return `doengine:pref:view-bookmarks:${project}:${level}`;
}
function readViewBookmarks() { try { return JSON.parse(localStorage.getItem(viewBookmarkKey()) || '{}') || {}; } catch (error) { return {}; } }
function saveViewBookmark(slot) {
  const c = app.camera;
  if (c.mode !== 'orbit' || cameraViewState) { showStatus('Bookmarks remember the editor view; leave Camera View first.'); return false; }
  const all = readViewBookmarks();
  all[slot] = { target: [c.target.x, c.target.y, c.target.z], yaw: c.yaw, pitch: c.pitch, distance: c.distance };
  try { localStorage.setItem(viewBookmarkKey(), JSON.stringify(all)); } catch (error) { showStatus('Could not store the bookmark in this browser.'); return false; }
  showStatus(`Saved view ${slot} · press ${slot} to come back`);
  return true;
}
function recallViewBookmark(slot) {
  const view = readViewBookmarks()[slot];
  if (!view || !Array.isArray(view.target) || ![...view.target, view.yaw, view.pitch, view.distance].every(Number.isFinite)) { showStatus(`No view saved on ${slot} yet · Shift+${slot} saves one`); return false; }
  if (cameraViewState) { showStatus('Leave Camera View before jumping to a saved view.'); return false; }
  const c = app.camera;
  c.setTarget(null); c.setMode('orbit');
  c.target = new Opus.Vec3(...view.target); c.yaw = view.yaw; c.pitch = view.pitch; c.distance = view.distance;
  showStatus(`View ${slot}`);
  return true;
}
window.addEventListener('keydown', (event) => {
  if (playMode || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const match = /^Digit([1-9])$/.exec(event.code);
  if (!match) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  if ([...document.querySelectorAll('[role="dialog"]')].some((d) => !d.hidden && d.offsetParent !== null)) return;
  event.preventDefault();
  if (event.shiftKey) saveViewBookmark(match[1]); else recallViewBookmark(match[1]);
});
// Ctrl+Shift+C / Ctrl+Shift+V copy and paste logic.
window.addEventListener('keydown', (event) => {
  if (playMode || !(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key !== 'c' && key !== 'v') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  event.preventDefault();
  if (key === 'c') { if (selectedItems.size === 1) copyLogic(); else showStatus('Select one object to copy its logic.'); }
  else pasteLogic();
});
if (typeof COMMAND_PALETTE_ACTIONS !== 'undefined') {
  COMMAND_PALETTE_ACTIONS.push(
    { label: 'Copy Logic (behaviors, script, variables)', hint: 'Ctrl+Shift+C', run: () => copyLogic() },
    { label: 'Paste Logic onto Selection', hint: 'Ctrl+Shift+V', run: () => pasteLogic() },
    { label: 'Select Similar Objects', hint: 'Right-click', run: () => selectSimilar() },
  );
}
