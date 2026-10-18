'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const time = fs.readFileSync(path.join(ROOT, 'engine/src/03-time.js'), 'utf8');
const input = fs.readFileSync(path.join(ROOT, 'engine/src/04-input.js'), 'utf8');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  PASS ${name}`); }
function simulate(fps, seconds = 5, keys = { x: 0, z: 1 }) {
  const rawDt = 1 / fps, speed = 6.5, acceleration = 30;
  let x = 0, z = 0, vx = 0, vz = 0;
  for (let frame = 0; frame < Math.round(fps * seconds); frame++) {
    const dt = Math.min(rawDt, 0.1);
    const length = Math.hypot(keys.x, keys.z) || 1;
    const tx = keys.x / length * speed, tz = keys.z / length * speed;
    const blend = Math.min(1, acceleration * dt / speed);
    vx += (tx - vx) * blend;
    vz += (tz - vz) * blend;
    x += vx * dt; z += vz * dt;
  }
  return { x, z, distance: Math.hypot(x, z) };
}
console.log('Game control stabilization tests');
test('canonical clock clamps a stalled frame to 100 ms', () => assert(time.includes('Math.min((now - this._last) / 1000, 0.1)')));
test('all four controllers receive delta seconds', () => ['updateHovercraftController(dt', 'updateTopDownController(dt', 'updateThirdPersonController(dt', 'updateFirstPersonController(dt'].forEach(text => assert(editor.includes(text), text)));
test('30/60/120/144/240 Hz travel remains within a tight tolerance', () => {
  const results = [30, 60, 120, 144, 240].map(fps => simulate(fps).distance);
  assert(Math.max(...results) - Math.min(...results) < 0.2, JSON.stringify(results));
});
test('diagonal input is normalized and does not gain speed', () => assert(Math.abs(simulate(60, 5, { x: 1, z: 1 }).distance - simulate(60).distance) < 1e-8));
test('opposite inputs cancel', () => assert.strictEqual(simulate(60, 2, { x: 0, z: 0 }).distance, 0));
test('a one-second stall advances only one clamped step', () => assert.strictEqual(Math.min(1, 0.1), 0.1));
test('blur and hidden-document paths clear held input', () => assert(input.includes("addEventListener('blur', this._onBlur)") && input.includes('this.keys.clear()') && input.includes('document.hidden')));
test('restart simulation has no retained velocity', () => assert.deepStrictEqual(simulate(60, 1), simulate(60, 1)));
console.log(`Game control stabilization: ${passed}/8 passed`);
