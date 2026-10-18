'use strict';
const assert = require('assert');
const Platformer = require('../editor/src/00-platformer-controller-2d.js');
const config = Object.freeze({ speed: 5, gravity: 20, jumpSpeed: 8 });
const input = Object.freeze({ left: false, right: false, jumpPressed: false });
const contact = options => ({ active: true, grounded: false, ceiling: false,
  wallLeft: false, wallRight: false, ...options });
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); } }
test('Actual module free fall and run are independent of 30/60/144 partitions', () => {
  for (const hz of [30, 60, 144]) {
    const controller = Platformer.createPlatformerController2D(); let x = 0, y = 0;
    for (let i = 0; i < hz; i++) {
      const velocity = controller.prepare(config, { ...input, right: true }, 1 / hz, contact());
      x += velocity[0] / hz; y += velocity[1] / hz; controller.resolve(contact());
    }
    assert(Math.abs(x - 5) < 1e-10); assert(Math.abs(y + 10) < 1e-10);
    assert(Math.abs(controller.getState().velocity[1] + 20) < 1e-10);
  }
});
test('First unknown-contact Jump defers until actual grounded response', () => {
  const controller = Platformer.createPlatformerController2D();
  assert(controller.prepare(config, { ...input, jumpPressed: true }, .01, { active: false })[1] < 0);
  assert(controller.getState().pendingInitialJump);
  controller.resolve(contact({ grounded: true }));
  assert(controller.prepare(config, input, .01, contact({ grounded: true }))[1] > 7);
  assert(!controller.getState().pendingInitialJump);
});
test('Initial pending Jump is discarded by known airborne contact; no air jump', () => {
  const controller = Platformer.createPlatformerController2D();
  controller.prepare(config, { ...input, jumpPressed: true }, .01, { active: false });
  controller.resolve(contact());
  assert(controller.prepare(config, input, .01, contact())[1] < 0);
  controller.resolve(contact({ grounded: true }));
  assert(controller.prepare(config, input, .01, contact({ grounded: true }))[1] < 0);
});
test('Actual canonical ceiling and walls cancel only velocity into their surface', () => {
  const controller = Platformer.createPlatformerController2D();
  controller.prepare(config, { ...input, right: true, jumpPressed: true }, .01, contact({ grounded: true }));
  controller.resolve(contact({ ceiling: true, wallRight: true }));
  assert.deepStrictEqual(controller.getState().velocity, [0, 0]);
  assert(controller.prepare(config, { ...input, left: true }, .01, contact({ wallRight: true }))[0] < 0);
});
test('Ground contact cancels descent but not launch; both directions cancel input', () => {
  const controller = Platformer.createPlatformerController2D();
  controller.prepare(config, input, .1, contact()); controller.resolve(contact({ grounded: true }));
  assert.equal(controller.getState().velocity[1], 0);
  controller.prepare(config, { left: true, right: true, jumpPressed: true }, .01, contact({ grounded: true }));
  controller.resolve(contact({ grounded: true }));
  assert.equal(controller.getState().velocity[0], 0); assert(controller.getState().velocity[1] > 0);
});
test('Pause/freeze/reset clear pending Jump and velocity without mutating configuration', () => {
  const controller = Platformer.createPlatformerController2D(), before = JSON.stringify(config);
  for (const lifecycle of [{ paused: true }, { frozen: true }]) {
    controller.prepare(config, { ...input, jumpPressed: true }, .01, { active: false });
    assert.deepStrictEqual(controller.prepare(config, input, .01, null, lifecycle), [0, 0]);
    assert(!controller.getState().pendingInitialJump);
  }
  controller.prepare(config, input, .01, contact()); controller.reset();
  assert.deepStrictEqual(controller.getState().velocity, [0, 0]);
  assert.equal(JSON.stringify(config), before);
});
test('Malformed config/input/dt and invalid contacts remain inert and finite', () => {
  for (const bad of [null, { ...config, speed: 0 }, { ...config, gravity: Infinity }, { ...config, jumpSpeed: '8' }]) {
    const controller = Platformer.createPlatformerController2D();
    assert.deepStrictEqual(controller.prepare(bad, input, .01, contact()), [0, 0]);
  }
  const controller = Platformer.createPlatformerController2D();
  for (const dt of [NaN, 0, -1, Infinity]) assert.deepStrictEqual(controller.prepare(config, input, dt, contact()), [0, 0]);
  assert.deepStrictEqual(controller.prepare(config, { ...input, left: 1 }, .1, contact()), [0, 0]);
  controller.prepare(config, input, .1, contact()); controller.resolve({ active: true, grounded: true });
  assert.deepStrictEqual(controller.getState().velocity, [0, 0]);
});
test('Returned snapshots and intent arrays cannot mutate private state', () => {
  const controller = Platformer.createPlatformerController2D(), actualContact = contact();
  const velocity = controller.prepare(config, input, .1, actualContact); velocity[1] = 999;
  actualContact.grounded = true; const snapshot = controller.getState(); snapshot.velocity[1] = 999;
  assert.equal(controller.getState().velocity[1], -2); assert(!controller.getState().grounded);
});
console.log(`Phase116 actual platformer intent: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
