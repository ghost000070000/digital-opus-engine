'use strict';
// Hierarchy tools: row icons per object type, context-menu availability, and wiring.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/62-hierarchy-tools.js'), 'utf8');
const ctx = { placed: [], selectedItems: new Set(), copySelection() {}, pasteClipboard() {} };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function enhanceSceneList')) + source.slice(source.indexOf('function sceneMenuEntries'), source.indexOf("sceneListEl.addEventListener('contextmenu'")), ctx);

const icon = (item) => ctx.sceneListIcon(item)[1];
assert.strictEqual(icon({ kind: 'cube' }), 'Cube');
assert.strictEqual(icon({ kind: 'cube', assetId: 'asset1' }), 'Model');
assert.strictEqual(icon({ kind: 'cube', isSpawnPoint: true }), 'Player start');
assert.strictEqual(icon({ kind: 'cube', isTrigger: true }), 'Trigger volume');
assert.strictEqual(icon({ kind: 'terrain' }), 'Terrain');
assert.strictEqual(icon({ kind: 'light' }), 'Light');
assert.strictEqual(icon({ kind: 'mystery' }), 'mystery', 'unknown kinds still get a label');

const child = { id: 'kid', parentId: 'p' }, loose = { id: 'x' };
ctx.selectedItems = new Set([child]);
const entries = (item) => Object.fromEntries(ctx.sceneMenuEntries(item).map((e) => [e.label, e.enabled]));
assert.strictEqual(entries(child).Unparent, true, 'a parented object can be unparented');
assert.strictEqual(entries(loose).Unparent, false);
assert.strictEqual(entries(child).Rename, true);
ctx.selectedItems = new Set([child, loose]);
assert.strictEqual(entries(child).Rename, false, 'rename needs a single object');
assert.strictEqual(entries(child).Delete, true);

const list = fs.readFileSync(path.join(root, 'editor/src/modules/10-scene-list.js'), 'utf8');
assert(list.includes("if (typeof enhanceSceneList === 'function') enhanceSceneList();"), 'rows are enhanced after every render');
assert(source.includes('performance.now() - sceneLastClick.at < 450') || source.includes('now - sceneLastClick.at < 450'), 'double-click survives the re-render of the first click');
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('62-hierarchy-tools.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Hierarchy tools: icons, menu availability, wiring PASS');
