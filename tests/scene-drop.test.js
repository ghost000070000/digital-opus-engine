'use strict';
// Dropped imports are laid out from the drop point across the view, each
// resting on the surface below it (real engine Entity + surface module).
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = { window: { addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } };
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), c);
const O = c.window.Opus;
const surface = fs.readFileSync(path.join(root, 'editor/src/modules/55-surface-snap.js'), 'utf8');
const drop = fs.readFileSync(path.join(root, 'editor/src/modules/57-scene-drop.js'), 'utf8');
const box = (name, pos, scale) => ({ id: name, name, kind: 'cube', entity: new O.Entity({ mesh: O.Mesh.cube(), position: new O.Vec3(...pos), scale: new O.Vec3(...scale) }) });
const camera = new O.Camera(); camera.yaw = 0; camera.pitch = 0.5; // looking down -Z, so "across the view" is +X
const ctx = {
  Opus: O, Math, Number, Set, WeakMap, Infinity, NaN, localStorage: { getItem: () => null, setItem() {} },
  app: { camera }, placed: [], selectedItems: new Set(), selectedItem: null, playMode: false,
  collectDescendants: () => [], syncSelectionMarkers() {}, renderSceneList() {}, renderInspector() {},
};
vm.createContext(ctx);
vm.runInContext(surface.slice(0, surface.indexOf('(function mountSurfaceSnapToggle')), ctx);
vm.runInContext(drop.slice(drop.indexOf('// Lay newly imported'), drop.indexOf('async function importFilesIntoScene')), ctx);

const ground = box('ground', [0, -0.25, 0], [40, 0.5, 40]);
const table = box('table', [3, 1, 0], [2, 2, 2]);
const a = box('a', [0, 1, 0], [1, 1, 1]), b = box('b', [0, 1, 0], [1, 2, 1]);
ctx.placed.push(ground, table, a, b);
ctx.arrangeDroppedItems([a, b], new O.Vec3(0, 0, 0));
assert(Math.abs(a.entity.position.x) < 1e-9 && Math.abs(a.entity.position.y - 0.5) < 1e-9, 'first model at the drop point, on the ground');
assert(Math.abs(b.entity.position.x - 1.5) < 1e-9, 'second model beside it, across the view, with a gap');
assert(Math.abs(b.entity.position.y - 1) < 1e-9, 'second model rests on the ground too');
ctx.arrangeDroppedItems([a], new O.Vec3(3, 2, 0));
assert(Math.abs(a.entity.position.y - 2.5) < 1e-9, 'dropped onto the table, it rests on the table top');
assert.strictEqual(ctx.selectedItem, a);
// Wiring: drops on the canvas go through the import batch; bundles keep their own importer.
assert(drop.includes("runAssetImportBatch(files, images && target ? 'texture' : 'auto')"));
assert(drop.includes('.opus-(tilemap|chunk)'));
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('57-scene-drop.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Scene drop: layout from the drop point, resting on surfaces, wiring PASS');
