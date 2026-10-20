'use strict';
// Walk-over pads: Launch Player / Teleport Player actions, the pad trigger box, saving, palette.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = { window: { addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } };
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), c);
const O = c.window.Opus;
const actions = fs.readFileSync(path.join(root, 'editor/src/modules/24-actions.js'), 'utf8');
const grab = (name) => { const start = actions.indexOf(`  ${name}: {`); let depth = 0, i = actions.indexOf('{', start); for (; i < actions.length; i++) { if (actions[i] === '{') depth++; else if (actions[i] === '}' && --depth === 0) break; } return actions.slice(actions.indexOf('{', start), i + 1); };
const entity = new O.Entity({ mesh: O.Mesh.cube(), position: new O.Vec3(0, 1, 0) });
const ctx = { Opus: O, Math, Number, parseFloat, app: { audio: { playBlip() {} } }, placed: [], player: { entity, velocity: new O.Vec3(2, 0, 3) } };
ctx.findItemById = (id) => ctx.placed.find((i) => i.id === id) || null;
ctx.itemPosition = (item) => item.entity.position;
Object.assign(ctx, { Set, WeakMap, Infinity, localStorage: { getItem: () => null } });
vm.createContext(ctx);
const surface = fs.readFileSync(path.join(root, 'editor/src/modules/55-surface-snap.js'), 'utf8');
vm.runInContext(surface.slice(0, surface.indexOf('(function mountSurfaceSnapToggle')), ctx);
vm.runInContext(`this.launch = ${grab('launchPlayer')}; this.teleport = ${grab('teleportPlayer')};`, ctx);

ctx.launch.exec({ force: 14 });
assert.strictEqual(ctx.player.velocity.y, 14, 'thrown upward');
assert(ctx.player.velocity.x === 2 && ctx.player.velocity.z === 3, 'keeps running speed');
ctx.launch.exec({ force: 999 });
assert.strictEqual(ctx.player.velocity.y, 60, 'bounded');

const pad = { id: 'b', kind: 'cube', padTrigger: true, entity: new O.Entity({ mesh: O.Mesh.cube(), position: new O.Vec3(10, 0.04, 0), scale: new O.Vec3(1.6, 0.08, 1.6) }) };
const crate = { id: 'c', kind: 'cube', entity: new O.Entity({ mesh: O.Mesh.cube(), position: new O.Vec3(-10, 0.5, 0), scale: new O.Vec3(2, 1, 2) }) };
ctx.placed.push(pad, crate);
ctx.teleport.exec({ targetId: 'b' }, null);
const p = ctx.player.entity.position;
assert(Math.hypot(p.x - 10, p.z) > 0.8 + 0.9 - 1e-9, 'lands beside the pad, clear of its box');
assert(Math.abs(p.y - (0.08 + 1.2)) < 1e-6, 'above its top');
assert.strictEqual(ctx.player.velocity.length(), 0, 'movement stops');
ctx.teleport.exec({ targetId: 'c' }, null);
assert(Math.hypot(ctx.player.entity.position.x + 10, ctx.player.entity.position.z) > 1.5 * 2 + 0.5 - 1e-9, 'clear of a plain object\'s touch sphere');
ctx.player.entity.position = new O.Vec3(0, 1, 0);
ctx.teleport.exec({ targetId: 'missing' }, null);
assert.strictEqual(ctx.player.entity.position.x, 0, 'no destination: no move');

const runtime = fs.readFileSync(path.join(root, 'editor/src/modules/30-play-mode-runtime.js'), 'utf8');
assert(runtime.includes('const padBox = item.padTrigger ?') && runtime.includes('...(padBox || shapeOptions)'), 'pads trigger on their footprint, not a wide sphere');
const ser = fs.readFileSync(path.join(root, 'editor/src/modules/36-scene-serialization.js'), 'utf8');
assert.strictEqual((ser.match(/padTrigger: item\.padTrigger \|\| undefined/g) || []).length, 2);
assert.strictEqual((ser.match(/padTrigger: record\.padTrigger === true \|\| undefined/g) || []).length, 2);
const html = fs.readFileSync(path.join(root, 'editor/index.html'), 'utf8');
for (const id of ['jumpPad', 'teleporterPair', 'finishLine']) assert(html.includes(`id="palette-ready-${id}"`), id + ' in the palette');
console.log('Gameplay pads: launch, teleport clearance, pad trigger box, saving, palette PASS');
