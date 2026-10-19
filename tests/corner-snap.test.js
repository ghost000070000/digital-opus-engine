'use strict';
// Corner snapping: nearest corner pair within the pixel threshold, and wiring into drags.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = { window: { addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } };
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), c);
const O = c.window.Opus;
const source = fs.readFileSync(path.join(root, 'editor/src/modules/66-corner-snap.js'), 'utf8');
const ctx = { Opus: O, Math };
vm.createContext(ctx);
vm.runInContext(source.slice(0, source.indexOf('function hideCornerSnapMarker')), ctx);

const a = ctx.boxCorners({ min: [-1, 0, -1], max: [1, 1, 1] });
assert.strictEqual(a.length, 8, 'eight corners');
// Top-down projection: 10 px per world unit.
const project = (v) => ({ x: v.x * 10, y: v.z * 10 });
const b = ctx.boxCorners({ min: [1.05, 0, 1.1], max: [2.05, 1, 2.1] });
const snap = ctx.findCornerSnap(b, a, project, 16);
assert(snap, 'close corners snap');
const delta = snap.to.sub(snap.from);
assert(Math.abs(delta.x + 0.05) < 1e-9 && Math.abs(delta.z + 0.1) < 1e-9, 'moves by exactly the corner gap');
assert.strictEqual(ctx.findCornerSnap(ctx.boxCorners({ min: [3, 0, 3], max: [4, 1, 4] }), a, project, 16), null, 'far corners do not');
assert.strictEqual(ctx.findCornerSnap(b, a, () => null, 16), null, 'off-screen corners do not');

const gizmo = fs.readFileSync(path.join(root, 'editor/src/modules/09-selection-and-gizmo.js'), 'utf8');
assert.strictEqual((gizmo.match(/typeof applyCornerSnap === 'function'\) applyCornerSnap\(dragState\)/g) || []).length, 2, 'both the surface and the plain drag snap corners');
assert(source.includes("event.code !== 'KeyV'") && source.includes("window.addEventListener('blur'"), 'V while held, always released');
const modules = fs.readdirSync(path.join(root, 'editor/src/modules')).sort();
assert(modules.indexOf('66-corner-snap.js') < modules.findIndex((f) => /onboarding\.js$/.test(f)));
console.log('Corner snap: corner pairs, threshold, wiring PASS');
