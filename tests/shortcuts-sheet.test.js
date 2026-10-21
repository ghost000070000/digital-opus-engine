'use strict';
// The shortcuts sheet lists the editor's shortcuts, and each listed shortcut is actually wired somewhere.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/70-shortcuts.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function shortcutSheetHTML')) + ';this.list = EDITOR_SHORTCUTS;', ctx);
const keys = ctx.list.flatMap(([, rows]) => rows.map(([k]) => k));
assert(keys.length >= 25, 'covers the shortcut set');
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).map((f) => fs.readFileSync(path.join(root, 'editor/src/modules', f), 'utf8')).join('\n');
const wired = {
  'F': "event.code === 'KeyF'", 'End': "event.key !== 'End'", 'Hold V while dragging': "event.code !== 'KeyV'",
  'Hold Ctrl while dragging': 'function setGizmoSnapCtrlHeld', 'Shift + 1…9': 'saveViewBookmark(match[1])', 'Shift + P': 'startPlayFromHere()',
  'Ctrl + C / X / V': "if (key === 'v') pasteClipboard();", 'Ctrl + Shift + C / V': 'pasteLogic();', 'F2 or double-click a name': "event.key !== 'F2'",
  'Ctrl + Space (in Script editor)': "event.code === 'Space'", 'Drag a number field': 'numberScrubValue(',
};
for (const [key, marker] of Object.entries(wired)) {
  assert(keys.includes(key), `listed: ${key}`);
  assert(modules.includes(marker), `wired: ${key}`);
}
assert(source.includes("event.key !== '?'") && fs.readFileSync(path.join(root, 'editor/index.html'), 'utf8').includes('id="shortcut-sheet-btn"'), 'opened by ? and the View menu');
const order = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(order.indexOf('70-shortcuts.js') < order.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Shortcuts sheet: listed and wired PASS');
