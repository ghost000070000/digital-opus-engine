'use strict';
// Copy/paste logic (self references retargeted, scripts never overwritten,
// variables merged), select similar, and view bookmark storage.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/67-workflow-tools.js'), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));
const ctx = { JSON, Object, Array, String, placed: [] };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function copyLogic')) + source.slice(source.indexOf('// --- Select similar ---'), source.indexOf('function selectSimilar')), ctx);

const lever = { id: 'obj1', kind: 'cube', name: 'Lever', behaviors: [
  { trigger: 'interact', action: 'setVisibility', params: { targetId: 'obj1', visible: false } },
  { trigger: 'interact', action: 'changeColor', params: { targetId: 'obj9' } },
], script: { code: 'function onStart(ctx) {}' }, variables: { charge: 3 } };
const logic = ctx.captureLogic(lever);
lever.behaviors[0].params.visible = true; // the copy is independent of later edits
const crate = { id: 'obj2', kind: 'cube', behaviors: [{ trigger: 'click', action: 'toast', params: {} }], variables: { charge: 9 } };
const report = plain(ctx.applyLogicTo(crate, logic));
assert.deepStrictEqual(report, { behaviors: 2, script: true, scriptKept: false, variables: 0 });
assert.strictEqual(crate.behaviors.length, 3, 'appended after its own behaviors');
assert.strictEqual(crate.behaviors[1].params.targetId, 'obj2', '"this object" now means the receiver');
assert.strictEqual(crate.behaviors[1].params.visible, false, 'copied at copy time');
assert.strictEqual(crate.behaviors[2].params.targetId, 'obj9', 'other objects stay targeted');
assert.strictEqual(crate.variables.charge, 9, 'existing variables are kept');
const scripted = { id: 'obj3', kind: 'cube', script: { code: 'function onUpdate(ctx, dt) {}' } };
assert.strictEqual(ctx.applyLogicTo(scripted, logic).scriptKept, true, 'an existing script is never overwritten');
assert.strictEqual(scripted.script.code, 'function onUpdate(ctx, dt) {}');
assert.strictEqual(ctx.applyLogicTo(lever, logic).behaviors, 0, 'never onto the source itself');
assert.strictEqual(ctx.applyLogicTo({ id: 'l', kind: 'light' }, logic).behaviors, 0, 'only objects that can hold logic');

// Select similar: same model, else same prefab, else same base name.
const items = [
  { id: 'a', kind: 'cube', assetId: 'asset1' }, { id: 'b', kind: 'cube', assetId: 'asset1' }, { id: 'c', kind: 'cube', assetId: 'asset2' },
  { id: 'd', kind: 'cube', name: 'Crate #2' }, { id: 'e', kind: 'cube', name: 'Crate 14' }, { id: 'f', kind: 'cube', name: 'Barrel' },
  { id: 'g', kind: 'cube', sourcePrefabName: 'Torch' }, { id: 'h', kind: 'cube', sourcePrefabName: 'Torch' },
];
ctx.placed.push(...items);
const ids = (item) => plain(ctx.similarItems(item).map((i) => i.id));
assert.deepStrictEqual(ids(items[0]), ['a', 'b']);
assert.deepStrictEqual(ids(items[3]), ['d', 'e'], 'numbered copies share a base name');
assert.deepStrictEqual(ids(items[6]), ['g', 'h']);
assert.strictEqual(ctx.baseName('Cube #12'), 'cube');

const tools = fs.readFileSync(path.join(root, 'editor/src/modules/62-hierarchy-tools.js'), 'utf8');
assert(tools.includes("label: 'Select Similar'") && tools.includes("label: 'Copy Logic'") && tools.includes("label: 'Paste Logic'"), 'in the Hierarchy menu');
assert(source.includes('/^Digit([1-9])$/') && source.includes('if (event.shiftKey) saveViewBookmark(match[1]); else recallViewBookmark(match[1]);'));
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('67-workflow-tools.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Workflow tools: copy/paste logic, select similar, view bookmarks PASS');
