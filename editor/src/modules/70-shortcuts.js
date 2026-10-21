// ===== Keyboard shortcuts sheet =====
// Every editor shortcut in one place: press ? (outside text fields), use
// Ctrl+K → "Keyboard Shortcuts", or View ▾ → Keyboard shortcuts.

const EDITOR_SHORTCUTS = [
  ['Scene view', [
    ['Right-drag', 'Look around'], ['Right-drag + W A S D / Q E', 'Fly (Shift faster, wheel sets speed)'],
    ['Middle-drag', 'Pan'], ['Alt + drag', 'Orbit'], ['Wheel', 'Zoom'], ['F', 'Frame the selection'],
    ['Shift + 1…9', 'Save this view'], ['1…9', 'Go to a saved view'],
  ]],
  ['Moving objects', [
    ['W / E / R', 'Move / Rotate / Scale tool'], ['Drag the yellow square', 'Move along the ground'],
    ['Hold Ctrl while dragging', 'Flip grid snapping'], ['Hold V while dragging', 'Snap corners to nearby objects'],
    ['End', 'Drop the selection onto the surface below'], ['[ / ]', 'Nudge height'],
  ]],
  ['Editing', [
    ['Ctrl + Z / Ctrl + Y', 'Undo / Redo'], ['Ctrl + C / X / V', 'Copy / Cut / Paste objects'],
    ['Ctrl + D', 'Duplicate'], ['Delete', 'Delete the selection'], ['Esc', 'Deselect'],
    ['Ctrl + Shift + C / V', 'Copy / Paste logic (behaviors, script, variables)'],
    ['F2 or double-click a name', 'Rename in the Hierarchy'], ['Drag a number field', 'Scrub its value (Shift faster, Alt finer)'],
  ]],
  ['Play and tools', [
    ['P', 'Play'], ['Shift + P', 'Play from here'], ['Ctrl + K', 'Command palette'],
    ['Ctrl + Space (in Script editor)', 'Show suggestions'], ['?', 'This sheet'],
  ]],
];

function shortcutSheetHTML() {
  return `<div class="shortcut-card" role="document">
    <div class="shortcut-head"><h2 id="shortcut-title">Keyboard shortcuts</h2><button type="button" class="toolbar-btn" data-shortcut-close>Close</button></div>
    <div class="shortcut-groups">${EDITOR_SHORTCUTS.map(([group, rows]) => `<section><h3>${escapeHtml(group)}</h3><dl>${rows.map(([keys, what]) => `<dt>${escapeHtml(keys)}</dt><dd>${escapeHtml(what)}</dd>`).join('')}</dl></section>`).join('')}</div>
  </div>`;
}
function openShortcutSheet() {
  let overlay = document.getElementById('shortcut-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'shortcut-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'shortcut-title');
    overlay.innerHTML = shortcutSheetHTML();
    overlay.addEventListener('click', (event) => { if (event.target === overlay || event.target.closest('[data-shortcut-close]')) closeShortcutSheet(); });
    overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape' || event.key === '?') { event.preventDefault(); event.stopPropagation(); closeShortcutSheet(); } });
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;
  overlay.querySelector('[data-shortcut-close]').focus();
}
function closeShortcutSheet() {
  const overlay = document.getElementById('shortcut-overlay');
  if (overlay) overlay.hidden = true;
}
window.addEventListener('keydown', (event) => {
  if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || playMode) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  if ([...document.querySelectorAll('[role="dialog"]')].some((d) => d.id !== 'shortcut-overlay' && !d.hidden && d.offsetParent !== null)) return;
  event.preventDefault();
  const overlay = document.getElementById('shortcut-overlay');
  if (overlay && !overlay.hidden) closeShortcutSheet(); else openShortcutSheet();
});
document.getElementById('shortcut-sheet-btn')?.addEventListener('click', () => { document.getElementById('viewport-debug-menu')?.removeAttribute('open'); openShortcutSheet(); });
if (typeof COMMAND_PALETTE_ACTIONS !== 'undefined') COMMAND_PALETTE_ACTIONS.push({ label: 'Keyboard Shortcuts', hint: '?', run: () => openShortcutSheet() });
