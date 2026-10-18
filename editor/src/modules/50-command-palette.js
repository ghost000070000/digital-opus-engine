// --- Command Palette (Wave 4, Ctrl+K) --------------------------------
// A faster way to REACH functionality the editor already has, not a second
// implementation of any of it -- every entry below either clicks a real
// existing button (so it's the exact same code path a mouse click on that
// button would take) or calls a real existing function directly (the same
// ones the Add Object palette's drag-drop, tab-switching, and Undo/Redo
// keyboard shortcuts already call). "Add Object" entries place at a fixed
// point near the viewport's usual working area (a small offset per call so
// several adds in a row don't stack exactly on top of each other) since the
// Palette itself is a drag-drop source, not a click target -- placeItem is
// the same function the drop handler calls once a drag completes.
let cmdPaletteAddOffset = 0;
function cmdPlaceObject(type) {
  cmdPaletteAddOffset = (cmdPaletteAddOffset + 1) % 6;
  const point = new Opus.Vec3(cmdPaletteAddOffset * 1.2, 0, cmdPaletteAddOffset * 1.2);
  placeItem(type, point);
}
function cmdSelectRelative(direction) {
  if (playMode || !placed.length) { showStatus(playMode ? 'Stop Play before changing the authoring selection.' : 'No Objects in this level.'); return false; }
  const current = placed.indexOf(selectedItem);
  const start = current < 0 ? (direction > 0 ? -1 : 0) : current;
  selectItem(placed[(start + direction + placed.length) % placed.length]);
  return true;
}
function cmdClickExistingControl(id, unavailableMessage) {
  if (playMode) { showStatus('Stop Play before using this authoring command.'); return false; }
  const control = document.getElementById(id);
  if (!control || control.disabled) { showStatus(unavailableMessage || 'That command is not available in the current selection.'); return false; }
  control.click();
  return true;
}
const COMMAND_PALETTE_ACTIONS = [
  { label: 'Play', hint: 'P', run: () => document.getElementById('play-btn').click() },
  { label: 'Pause / Resume', hint: '', run: () => document.getElementById('pause-btn').click() },
  { label: 'Undo', hint: 'Ctrl+Z', run: () => document.getElementById('undo-btn').click() },
  { label: 'Redo', hint: 'Ctrl+Y', run: () => document.getElementById('redo-btn').click() },
  { label: 'Save Project', hint: '', run: () => document.getElementById('save-btn').click() },
  { label: 'Export Editable / Standalone Game', hint: 'Editable HTML', run: () => cmdClickExistingControl('export-standalone-btn') },
  { label: 'Export Playable Game', hint: 'Playable HTML', run: () => cmdClickExistingControl('export-playable-btn') },
  { label: 'Add Component', hint: 'Current single Object', run: () => { if (playMode) return; activateTab('right-tab', 'inspector'); cmdClickExistingControl('add-component-btn', 'Select one supported Object before adding a Component.'); } },
  { label: 'Apply Gameplay Preset', hint: 'Current single Object', run: () => { if (playMode) return; activateTab('right-tab', 'inspector'); cmdClickExistingControl('gameplay-preset-btn', 'Select one supported Object before applying a gameplay Preset.'); } },
  { label: 'Import Project JSON', hint: '', run: () => document.getElementById('import-project-btn').click() },
  { label: 'Duplicate Selected', hint: 'Ctrl+D', run: () => { if (!playMode && selectedItem) duplicateSelected(); } },
  { label: 'Delete Selected', hint: 'Del', run: () => { if (!playMode && selectedItem) deleteSelected(); } },
  { label: 'Deselect', hint: 'Esc', run: () => deselectAll() },
  { label: 'Select Next Object', hint: 'Level order · groups preserved', run: () => cmdSelectRelative(1) },
  { label: 'Select Previous Object', hint: 'Level order · groups preserved', run: () => cmdSelectRelative(-1) },
  { label: 'Go to Objects Tab', hint: '', run: () => activateTab('left-tab', 'objects') },
  { label: 'Go to Assets Tab', hint: '', run: () => activateTab('left-tab', 'assets') },
  { label: 'Go to Prefabs Tab', hint: '', run: () => activateTab('left-tab', 'prefabs') },
  { label: 'Go to Inspector Tab', hint: '', run: () => activateTab('right-tab', 'inspector') },
  { label: 'Go to Scene Tab', hint: '', run: () => activateTab('right-tab', 'scene') },
  { label: 'Go to Level Tab', hint: '', run: () => activateTab('right-tab', 'level') },
  { label: 'Go to UI Tab', hint: '', run: () => activateTab('right-tab', 'ui') },
  { label: 'Go to Project Tab', hint: '', run: () => activateTab('right-tab', 'project') },
  { label: 'Place Sprite', hint: 'Selected Sprite Asset', run: () => {
    const asset = findSpriteAssetById(selectedSpriteAssetId);
    if (!asset) { activateTab('left-tab', 'assets'); showStatus('Select a Sprite Asset first'); return; }
    armPlacement(OpusAuthoringPlumbing.createSpritePlacementPayload(asset.id), `Sprite "${asset.name}"`);
  } },
  ...PLACEABLE_TYPES.map((type) => ({
    label: `Add ${PALETTE_LABELS[type] || type}`, hint: 'Add Object', run: () => cmdPlaceObject(type),
  })),
];
let cmdPaletteActive = -1;
let cmdPaletteReturnFocus = null;
let cmdPaletteFiltered = COMMAND_PALETTE_ACTIONS;
const cmdPaletteOverlay = document.getElementById('command-palette-overlay');
const cmdPaletteInput = document.getElementById('command-palette-input');
const cmdPaletteListEl = document.getElementById('command-palette-list');
function renderCommandPalette() {
  // Matched word-by-word (every typed word must appear somewhere in the
  // label), not as one contiguous substring -- found live-testing "add
  // cube": the palette's own emoji icons (PALETTE_LABELS, e.g. "Add ▢
  // Cube") break substring contiguity between words, so a whole-string
  // `.includes()` match would silently fail on the most natural query for
  // exactly the "Add Object" commands this palette exists to reach.
  const words = cmdPaletteInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  cmdPaletteFiltered = words.length
    ? COMMAND_PALETTE_ACTIONS.filter((a) => { const label = a.label.toLowerCase(); return words.every((w) => label.includes(w)); })
    : COMMAND_PALETTE_ACTIONS;
  cmdPaletteActive = cmdPaletteFiltered.length ? 0 : -1;
  cmdPaletteListEl.innerHTML = cmdPaletteFiltered.length === 0
    ? `<div id="command-palette-empty">No matching command</div>`
    : cmdPaletteFiltered.map((a, i) => `<div id="command-palette-option-${i}" role="option" aria-selected="${i === 0}" class="cmd-item${i === 0 ? ' active' : ''}" data-cmd-index="${i}">${escapeHtml(a.label)}${a.hint ? `<span class="cmd-item-hint">${escapeHtml(a.hint)}</span>` : ''}</div>`).join('');
  if (cmdPaletteActive >= 0) cmdPaletteInput.setAttribute('aria-activedescendant', `command-palette-option-${cmdPaletteActive}`);
  else cmdPaletteInput.removeAttribute('aria-activedescendant');
}
function openCommandPalette() {
  if (!cmdPaletteOverlay.classList.contains('visible')) cmdPaletteReturnFocus = document.activeElement;
  cmdPaletteOverlay.classList.add('visible');
  cmdPaletteInput.setAttribute('aria-expanded', 'true');
  cmdPaletteInput.value = '';
  renderCommandPalette();
  cmdPaletteInput.focus();
}
function closeCommandPalette(restoreFocus = true) {
  cmdPaletteOverlay.classList.remove('visible');
  cmdPaletteInput.setAttribute('aria-expanded', 'false');
  cmdPaletteInput.removeAttribute('aria-activedescendant');
  cmdPaletteInput.blur();
  const target = cmdPaletteReturnFocus;
  cmdPaletteReturnFocus = null;
  if (restoreFocus && target && target.isConnected && target.getClientRects().length && !target.matches(':disabled')) target.focus();
}
function runActiveCommand() {
  const action = cmdPaletteFiltered[cmdPaletteActive];
  if (!action) return;
  closeCommandPalette(false);
  action.run();
}
cmdPaletteInput.addEventListener('input', renderCommandPalette);
cmdPaletteListEl.addEventListener('click', (e) => {
  const el = e.target.closest('[data-cmd-index]');
  if (!el) return;
  cmdPaletteActive = Number(el.dataset.cmdIndex);
  runActiveCommand();
});
cmdPaletteOverlay.addEventListener('click', (e) => { if (e.target === cmdPaletteOverlay) closeCommandPalette(); });
cmdPaletteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCommandPalette(); }
  else if (e.key === 'Tab') { e.preventDefault(); cmdPaletteInput.focus(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); if (cmdPaletteFiltered.length) { cmdPaletteActive = (cmdPaletteActive + 1) % cmdPaletteFiltered.length; renderCommandPaletteActiveOnly(); } }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (cmdPaletteFiltered.length) { cmdPaletteActive = (cmdPaletteActive - 1 + cmdPaletteFiltered.length) % cmdPaletteFiltered.length; renderCommandPaletteActiveOnly(); } }
  else if (e.key === 'Enter') { e.preventDefault(); runActiveCommand(); }
});
function renderCommandPaletteActiveOnly() {
  cmdPaletteListEl.querySelectorAll('.cmd-item').forEach((el) => {
    const active = Number(el.dataset.cmdIndex) === cmdPaletteActive;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', String(active));
    if (active) el.scrollIntoView({ block: 'nearest' });
  });
  if (cmdPaletteActive >= 0) cmdPaletteInput.setAttribute('aria-activedescendant', `command-palette-option-${cmdPaletteActive}`);
  else cmdPaletteInput.removeAttribute('aria-activedescendant');
}
// Global open shortcut -- Ctrl+K/Cmd+K, guarded the same way every other
// global shortcut in this file already is (never fires while actually
// typing in an unrelated field, never fires mid-Play).
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (cmdPaletteOverlay.classList.contains('visible')) closeCommandPalette();
    else if (!playMode) openCommandPalette();
  }
});

