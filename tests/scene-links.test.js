'use strict';
// Scene links: which objects a piece of logic targets (behaviors and graph
// nodes, cycle-safe), merged per object pair, and the scene picker choosing an
// option the way a person would.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/61-scene-links.js'), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));

const door = { id: 'obj2', name: 'Door', kind: 'cube' };
const cyclic = { note: 'runtime' }; cyclic.self = cyclic;
const lever = { id: 'obj1', name: 'Lever', kind: 'cube', behaviors: [
  { trigger: 'interact', action: 'changeColor', params: { targetId: 'obj2', color: '#ff0000' } },
  { trigger: 'interact', action: 'setVisibility', params: { targetId: 'obj2' }, _runtime: cyclic },
  { trigger: 'start', action: 'graph', graph: { nodes: [{ id: 'n1', type: 'moveTo', targetId: 'obj3', _state: cyclic }] } },
] };
const lift = { id: 'obj3', name: 'Lift', kind: 'cube', parentId: 'obj2' };
const plate = { id: 'obj4', name: 'Plate', kind: 'cube', behaviors: [{ trigger: 'enter', action: 'setVisibility', params: { targetId: 'obj1' } }] };
const ctx = {
  Math, Map, Set, WeakSet, ArrayBuffer, Object, Array, String, JSON,
  placed: [lever, door, lift, plate],
  ACTION_TYPES: { changeColor: { label: 'Change Color' }, setVisibility: { label: 'Set Object Visibility' } },
  GRAPH_NODE_TYPES: { moveTo: { label: 'Move To' } },
  localStorage: { getItem: () => null }, Event: class { constructor(type) { this.type = type; } },
};
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function decorateObjectSelects')) + source.slice(source.indexOf('// --- Link lines ---'), source.indexOf('function linkAnchor')), ctx);

const links = ctx.sceneLinksFor(lever);
assert.deepStrictEqual(plain(links.outgoing.map((l) => [l.target.name, l.label])), [['Door', 'Change Color · Set Object Visibility'], ['Lift', 'Move To']], 'one arrow per target, all actions listed, graph nodes included, cycles ignored');
assert.deepStrictEqual(plain(links.incoming.map((l) => [l.source.name, l.label])), [['Plate', 'Set Object Visibility']], 'objects that target it are found');
assert.deepStrictEqual(plain(ctx.itemLogicLinks(lift).map((l) => l.label)), ['Parent'], 'parents are known but not drawn as logic');
assert.strictEqual(ctx.sceneLinksFor(lift).outgoing.length, 0);

// The picker only chooses options the field actually offers, and fires the field's own events.
const fired = [];
const select = { value: '', options: [{ value: '', disabled: false }, { value: 'obj2', disabled: false }, { value: 'obj4', disabled: true }], dispatchEvent: (e) => fired.push(e.type) };
assert.strictEqual(ctx.applyScenePick(select, door).ok, true);
assert.strictEqual(select.value, 'obj2');
assert.deepStrictEqual(fired, ['input', 'change']);
assert.strictEqual(ctx.applyScenePick(select, plate).ok, false, 'unavailable choices are refused');
assert.strictEqual(ctx.applyScenePick(select, null).ok, false);

// Wiring.
assert(fs.readFileSync(path.join(root, 'editor/src/modules/25-action-forms.js'), 'utf8').includes(`data-object-ref="1"`), 'object dropdowns are tagged for the picker');
assert(!/^function itemLabel\(/m.test(source), 'does not shadow the editor\'s own itemLabel');
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('61-scene-links.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Scene links: logic targets, merged arrows, incoming links, scene picker PASS');
