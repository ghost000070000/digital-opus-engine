'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(path.join(ROOT, 'dist/opus-engine.js'), 'utf8');
const context = { window: {}, document: { addEventListener() {}, removeEventListener() {}, hidden: false }, localStorage: { getItem() { return null; }, setItem() {} }, Float32Array, Uint16Array, Uint32Array, Uint8Array, DataView, ArrayBuffer, TextDecoder, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64') };
context.window.addEventListener = () => {}; context.window.removeEventListener = () => {};
vm.runInNewContext(bundle, context);
const Opus = context.window.Opus;
let seed = 0x5eed1234;
function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 0x100000000; }
function finite(result) { return ['correctedPosition', 'correctedVelocity'].every(key => ['x', 'y', 'z'].every(axis => Number.isFinite(result[key][axis]))); }
console.log('Game collision stabilization tests');
const wall = { center: new Opus.Vec3(0, 0, 0), half: new Opus.Vec3(0.05, 2, 4), quat: Opus.Quat.identity() };
const swept = Opus.Physics.resolveSweptOrientedBoxCollision(new Opus.Vec3(-4, 0, 0), new Opus.Vec3(4, 0, 0), new Opus.Vec3(80, 0, 0), 0.5, wall);
assert(swept.collided && swept.correctedPosition.x < 0, 'thin-wall sweep must stop tunneling');
const sphere = Opus.Physics.resolveSphereCollision(new Opus.Vec3(0.1, 0, 0), new Opus.Vec3(-2, 0, 0), 0.5, new Opus.Vec3(0, 0, 0), 1);
assert(sphere.collided && finite(sphere), 'sphere overlap must resolve finitely');
let collisions = 0;
for (let i = 0; i < 100000; i++) {
  const start = new Opus.Vec3(random() * 20 - 10, random() * 4 - 2, random() * 20 - 10);
  const velocity = new Opus.Vec3(random() * 40 - 20, 0, random() * 40 - 20);
  const end = start.clone().add(velocity.clone().scale(1 / 30));
  const box = { center: new Opus.Vec3(random() * 8 - 4, 0, random() * 8 - 4), half: new Opus.Vec3(0.05 + random() * 2, 2, 0.05 + random() * 2), quat: Opus.Quat.fromEuler(0, random() * Math.PI, 0) };
  const result = Opus.Physics.resolveSweptOrientedBoxCollision(start, end, velocity, 0.25 + random() * 0.75, box);
  assert(finite(result), `non-finite collision result at iteration ${i}`);
  if (result.collided) collisions++;
}
assert(collisions > 0, 'fuzz corpus must exercise collision responses');
console.log(`Game collision stabilization: thin wall PASS; sphere PASS; 100000 deterministic cases PASS (${collisions} contacts)`);
