// ===== Hierarchy tools =====
// The Hierarchy (scene list) gains:
// - a small type icon on every row,
// - rename in place: double-click a name, or F2 with one object selected,
// - double-click a row's icon or empty area to frame that object in the viewport,
// - a right-click menu: Rename, Focus, Duplicate, Copy, Paste, Unparent, Delete,
// - the selected row scrolls into view when you click objects in the scene.

function sceneListIcon(item) {
  if (item.kind === 'cube') {
    if (item.isSpawnPoint) return ['⚑', 'Player start'];
    if (item.isTrigger) return ['⬚', 'Trigger volume'];
    if (item.isWaypoint || item.isPathPoint) return ['•', 'Point'];
    if (item.isRamp) return ['◺', 'Ramp'];
    if (item.assetId) return ['◆', 'Model'];
    return ['▢', 'Cube'];
  }
  return ({ sprite: ['🖼', 'Sprite'], light: ['💡', 'Light'], camera: ['🎥', 'Camera'], terrain: ['⛰', 'Terrain'], water: ['〜', 'Water'], path: ['〰', 'Path'], tilemap: ['▦', 'Tilemap'], emitter: ['✦', 'Particles'] })[item.kind] || ['·', item.kind || 'Object'];
}
function sceneListRowItem(row) { return row ? placed[Number(row.dataset.index)] || null : null; }
function sceneListRowFor(item) {
  const index = placed.indexOf(item);
  return index < 0 ? null : sceneListEl.querySelector(`.scene-list-item[data-index="${index}"]`);
}

function enhanceSceneList() {
  for (const row of sceneListEl.querySelectorAll('.scene-list-item')) {
    const item = sceneListRowItem(row);
    if (!item || row.querySelector('.scene-list-icon')) continue;
    const [glyph, label] = sceneListIcon(item);
    const icon = document.createElement('span');
    icon.className = 'scene-list-icon';
    icon.textContent = glyph;
    icon.title = label;
    row.querySelector('.scene-list-item-name')?.before(icon);
  }
  const selectedRow = selectedItem ? sceneListRowFor(selectedItem) : null;
  if (selectedRow && !sceneRename) selectedRow.scrollIntoView?.({ block: 'nearest' });
}

// --- Rename in place ---
let sceneRename = null; // { item, input }
function startSceneRename(item) {
  if (playMode || !item) return false;
  const row = sceneListRowFor(item);
  const nameEl = row && row.querySelector('.scene-list-item-name');
  if (!nameEl) return false;
  const input = document.createElement('input');
  input.className = 'scene-list-rename';
  input.value = item.name || nameEl.textContent;
  input.setAttribute('aria-label', 'Object name');
  input.maxLength = 120;
  nameEl.replaceWith(input);
  sceneRename = { item, input };
  input.focus();
  input.select();
  const finish = (commit) => {
    if (!sceneRename || sceneRename.input !== input) return;
    sceneRename = null;
    const name = input.value.trim();
    if (commit && name && name !== (item.name || '') && placed.includes(item)) {
      pushUndo();
      item.name = name;
      showStatus(`Renamed to "${name}"`);
    }
    renderSceneList();
    if (selectedItem === item) renderInspector();
  };
  input.addEventListener('keydown', (event) => {
    event.stopPropagation(); // typing never triggers editor shortcuts
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (event) => event.stopPropagation());
  return true;
}

// The first click re-renders the list, so the browser's dblclick never
// arrives; detect a second click on the same row ourselves.
let sceneLastClick = null; // { id, at }
sceneListEl.addEventListener('click', (event) => {
  if (playMode || sceneRename) return;
  const row = event.target.closest('.scene-list-item');
  const item = sceneListRowItem(row);
  if (!item || event.target.closest('button')) { sceneLastClick = null; return; }
  const now = performance.now();
  const second = sceneLastClick && sceneLastClick.id === item.id && now - sceneLastClick.at < 450 && !event.shiftKey;
  sceneLastClick = second ? null : { id: item.id, at: now };
  if (!second) return;
  event.stopImmediatePropagation(); // keep the current selection and row
  if (event.target.closest('.scene-list-item-name')) startSceneRename(item);
  else { if (!selectedItems.has(item)) selectItem(item); focusViewportSelection(); }
}, true);
window.addEventListener('keydown', (event) => {
  if (playMode || event.key !== 'F2' || sceneRename) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (selectedItems.size !== 1 || !selectedItem) return;
  event.preventDefault();
  startSceneRename(selectedItem);
});

// --- Right-click menu ---
let sceneMenu = null;
function closeSceneMenu() { sceneMenu?.remove(); sceneMenu = null; }
function sceneMenuEntries(item) {
  const one = selectedItems.size === 1;
  return [
    { label: 'Rename', hint: 'F2', enabled: one, run: () => startSceneRename(item) },
    { label: 'Focus', hint: 'F', enabled: true, run: () => focusViewportSelection() },
    { label: 'Duplicate', hint: 'Ctrl+D', enabled: true, run: () => duplicateSelected() },
    { label: 'Copy', hint: 'Ctrl+C', enabled: typeof copySelection === 'function', run: () => copySelection(false) },
    { label: 'Paste', hint: 'Ctrl+V', enabled: typeof pasteClipboard === 'function', run: () => pasteClipboard() },
    { label: 'Select Similar', hint: '', enabled: typeof selectSimilar === 'function', run: () => selectSimilar(item) },
    { label: 'Copy Logic', hint: 'Ctrl+Shift+C', enabled: one && typeof copyLogic === 'function', run: () => copyLogic(item) },
    { label: 'Paste Logic', hint: 'Ctrl+Shift+V', enabled: typeof pasteLogic === 'function', run: () => pasteLogic() },
    { label: 'Unparent', hint: '', enabled: one && !!item.parentId, run: () => { pushUndo(); unparentItem(item); renderSceneList(); renderInspector(); showStatus('Moved to the top level'); } },
    { label: 'Delete', hint: 'Del', enabled: true, danger: true, run: () => deleteSelected() },
  ];
}
sceneListEl.addEventListener('contextmenu', (event) => {
  const row = event.target.closest('.scene-list-item');
  const item = sceneListRowItem(row);
  if (!item || playMode) return;
  event.preventDefault();
  if (!selectedItems.has(item)) selectItem(item);
  closeSceneMenu();
  const menu = document.createElement('div');
  menu.className = 'scene-context-menu';
  menu.setAttribute('role', 'menu');
  for (const entry of sceneMenuEntries(item)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.disabled = !entry.enabled;
    if (entry.danger) button.classList.add('danger');
    button.innerHTML = `<span>${escapeHtml(entry.label)}</span><kbd>${escapeHtml(entry.hint)}</kbd>`;
    button.addEventListener('click', () => { closeSceneMenu(); entry.run(); });
    menu.appendChild(button);
  }
  document.body.appendChild(menu);
  const width = menu.offsetWidth, height = menu.offsetHeight;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - width - 8)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - height - 8)}px`;
  sceneMenu = menu;
  menu.querySelector('button:not([disabled])')?.focus();
});
window.addEventListener('pointerdown', (event) => { if (sceneMenu && !sceneMenu.contains(event.target)) closeSceneMenu(); }, true);
window.addEventListener('keydown', (event) => { if (sceneMenu && event.key === 'Escape') { event.stopImmediatePropagation(); closeSceneMenu(); } }, true);
window.addEventListener('blur', closeSceneMenu);
