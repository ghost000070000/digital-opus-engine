'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require.resolve('../editor/src/01-editor.js'), 'utf8');
const input = { value: 'Roadside' }, c = { placed: [], selectedItems: new Set(), playMode: false, history: 0,
  document: { getElementById: () => input }, pushUndo() { c.history++; }, renderInspector() {}, showStatus(message) { c.message = message; } };
vm.createContext(c);
vm.runInContext("let sceneCollectionFilter = '', sceneListFilter = '';" + source.slice(source.indexOf('function sceneCollectionName('), source.indexOf('function renderSceneCollectionControls(')) + source.slice(source.indexOf('function changeSceneCollection('), source.indexOf('// Collections use the component serializer')), c);
c.renderSceneList = () => {};
const setFilter = value => vm.runInContext('sceneCollectionFilter = ' + JSON.stringify(value), c);
const a = { id: 'obj1', position: [1, 2, 3] }, b = { id: 'obj2', parentId: 'obj1' };
c.placed = [a, b]; c.selectedItems = new Set([a, b]);
assert(c.changeSceneCollection('assign')); assert.equal(c.history, 1); assert.deepStrictEqual(a.position, [1, 2, 3]); assert.equal(b.parentId, 'obj1');
assert(!c.changeSceneCollection('assign')); assert.equal(c.history, 1);
setFilter('name:Roadside'); assert(c.sceneCollectionMatches(a)); setFilter('__none'); assert(!c.sceneCollectionMatches(a));
input.value = 'Landmarks'; setFilter('name:Roadside'); assert(c.changeSceneCollection('rename')); assert.equal(c.history, 2); assert.equal(c.sceneCollectionName(b), 'Landmarks');
c.playMode = true; assert(!c.changeSceneCollection('clear')); assert.equal(c.history, 2); c.playMode = false;
c.selectedItems = new Set([{ id: 'retired' }]); assert(!c.changeSceneCollection('assign')); assert.equal(c.history, 2);
c.selectedItems = new Set([a]); a.components['scene-collection'].extension = { retained: true };
assert(!c.changeSceneCollection('clear')); assert.equal(c.history, 2);
input.value = 'New'; assert(c.changeSceneCollection('assign')); assert(a.components['scene-collection'].extension.retained);
a.components['scene-collection'] = { version: 99, name: 'Future' }; const before = JSON.stringify(a);
assert(!c.changeSceneCollection('assign')); assert.equal(JSON.stringify(a), before); setFilter('__none'); assert(c.sceneCollectionMatches(a));
input.value = ' '; assert(!c.changeSceneCollection('assign'));
console.log('Phase229 collections: one history, no-op/Play/stale/invalid/extension guards, filtering and unchanged parenting/poses PASS');
let next = 90; c.generateItemId = () => 'obj' + next++;
vm.runInContext(source.slice(source.indexOf('function remapObjectIds('), source.indexOf('// "<Name> Copy"')), c);
for (const membership of [{ version: 1, name: 'obj4', extension: { literal: 'obj4' } }, { version: 99, name: 'obj4', future: ['obj4'] }]) {
  const original = [{ id: 'obj4', components: { 'scene-collection': membership } }, { id: 'obj5', parentId: 'obj4' }];
  const before = JSON.stringify(original), copy = c.remapObjectIds(original);
  assert.notEqual(copy[0].id, 'obj4'); assert.equal(copy[1].parentId, copy[0].id);
  assert.equal(JSON.stringify(copy[0].components['scene-collection']), JSON.stringify(membership), 'Collection is editor-only literal metadata, never an Object reference');
  copy[0].components['scene-collection'].name = 'Changed'; assert.equal(JSON.stringify(original), before);
}
console.log('Phase229 collection literal/unknown metadata survives identity remap independently PASS');
const schema = require('../editor/src/00-authoring-schema');
for (const membership of [{ version: 1, name: 'Roadside', extension: { retained: true } }, { version: 99, name: 'Future', bytes: ['obj4'] }, null]) {
  const owner = { kind: 'sprite', components: { 'scene-collection': membership } }, saved = schema.serializeComponents(owner), copy = { kind: 'sprite' };
  schema.applyRecord({ components: saved }, copy); assert.deepStrictEqual(copy.components['scene-collection'], membership);
}
c.placed = Array.from({ length: 128 }, (_, i) => ({ id: 'cap' + i, components: { 'scene-collection': { version: 1, name: 'Collection' + i } } }));
c.selectedItems = new Set([c.placed[0]]); const atCap = JSON.stringify(c.placed), history = c.history;
input.value = 'New129'; assert(!c.changeSceneCollection('assign')); assert.equal(JSON.stringify(c.placed), atCap); assert.equal(c.history, history);
setFilter('name:Collection0'); input.value = 'Collection1'; assert(!c.changeSceneCollection('rename')); assert.equal(JSON.stringify(c.placed), atCap);
assert(c.changeSceneCollection('assign')); assert.equal(c.sceneCollectionName(c.placed[0]), 'Collection1');
console.log('Phase229 canonical schema future/extension/null retention and bounded mutation/explicit merge guards PASS');
