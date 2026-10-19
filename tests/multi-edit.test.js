'use strict';
// Multi-object editing math on real engine entities: shared values, writes,
// align, distribute and randomize; children are left to follow their parents.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = { window: { addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } };
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), c);
const O = c.window.Opus;
const surface = fs.readFileSync(path.join(root, 'editor/src/modules/55-surface-snap.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'editor/src/modules/59-multi-edit.js'), 'utf8');
const box = (id, pos, s, extra = {}) => ({ id, kind: 'cube', entity: new O.Entity({ mesh: O.Mesh.cube(), position: new O.Vec3(...pos), scale: new O.Vec3(s, s, s) }), ...extra });
const ctx = { Opus: O, Math, Number, Set, WeakMap, Infinity, NaN, localStorage: { getItem: () => null, setItem() {} }, placed: [], findItemById: (id) => ctx.placed.find((i) => i.id === id) };
vm.createContext(ctx);
vm.runInContext(surface.slice(0, surface.indexOf('(function mountSurfaceSnapToggle')), ctx);
vm.runInContext(source.slice(0, source.indexOf('function multiEditCommit')), ctx);
const near = (a, b) => Math.abs(a - b) < 1e-6;

const a = box('a', [0, 0.5, 0], 1), b = box('b', [3, 1, 1], 2), d = box('d', [9, 0.5, -2], 1), child = box('kid', [3, 3, 1], 1, { parentId: 'b' });
ctx.placed.push(a, b, d, child);
const selection = new Set([a, b, d, child]);
const moving = ctx.multiEditTransformItems(selection);
assert.deepStrictEqual(JSON.parse(JSON.stringify(moving.map((i) => i.id))), ['a', 'b', 'd'], 'parented children follow their parents instead of being moved twice');

// Shared values: blank (null) when they differ.
assert.strictEqual(ctx.multiEditShared(moving, (i) => ctx.multiEditRead(i, 'position', 'y')), null);
assert.strictEqual(ctx.multiEditShared(moving, (i) => ctx.multiEditRead(i, 'rotation', 'y')), 0);
for (const item of moving) ctx.multiEditWrite(item, 'rotation', 'y', 90);
assert(moving.every((i) => near(ctx.multiEditRead(i, 'rotation', 'y'), 90)), 'rotation writes keep the other axes');

// Align bottoms: every bottom at the lowest bottom (0).
b.entity.position.y = 4;
ctx.alignItems(moving, 'y', 'min');
assert(near(a.entity.position.y, 0.5) && near(b.entity.position.y, 1) && near(d.entity.position.y, 0.5));
// Align right sides on X.
ctx.alignItems(moving, 'x', 'max');
assert(near(a.entity.position.x + 0.5, 9.5) && near(b.entity.position.x + 1, 9.5), 'high sides line up');
// Distribute: even centres between the outermost two.
a.entity.position.x = 0; b.entity.position.x = 1; d.entity.position.x = 10;
ctx.distributeItems(moving, 'x');
assert(near(b.entity.position.x, 5), 'middle object moves to the middle');
assert.strictEqual(ctx.distributeItems([a, b], 'x'), false, 'needs at least three objects');

// Randomize with a fixed sequence.
let n = 0; const rng = () => [0.25, 0.5, 0.75, 0][n++ % 4];
ctx.randomizeItems([a], 'rotation', rng);
assert(near(ctx.multiEditRead(a, 'rotation', 'y'), 90), 'random turn around Y');
ctx.randomizeItems([d], 'scale', rng); // 0.8 + 0.5 * 0.4 = 1.0
ctx.randomizeItems([d], 'scale', rng); // 0.8 + 0.75 * 0.4 = 1.1
assert(near(d.entity.scale.x, 1.1) && near(d.entity.scale.y, 1.1), 'uniform random size');

// Wiring: the multi-selection Inspector mounts it; boot order.
assert(fs.readFileSync(path.join(root, 'editor/src/modules/33-inspector.js'), 'utf8').includes("if (typeof mountMultiEditSection === 'function') mountMultiEditSection(inspectorBody);"));
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('59-multi-edit.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Multi-edit: shared values, writes, align, distribute, randomize PASS');
