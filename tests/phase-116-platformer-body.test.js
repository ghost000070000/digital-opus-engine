'use strict';
const assert = require('assert');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Platformer = require('../editor/src/00-platformer-controller-2d.js');
const config = Object.freeze({ speed: 5, gravity: 20, jumpSpeed: 8 });
const neutral = Object.freeze({ left: false, right: false, jumpPressed: false });
function object(id, x, y, options = {}) {
  const components = {
    'body-2d': { version: 1, enabled: true, type: options.static ? 'static' : 'kinematic', linearVelocity: options.velocity || [0, 0] },
    'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: options.size || [1, 1] }
  };
  if (options.character) components['character-collision-2d'] = { version: 2, enabled: true,
    wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true,
    maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 };
  if (options.oneWay) components['one-way-platform-2d'] = { version: 1, enabled: true };
  if (options.moving) components['moving-platform-2d'] = { version: 1, enabled: true };
  if (options.reject) Object.assign(components['box-collider-2d'], { version: 2,
    collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'custom', collisionMaskRefs: [] });
  return { id, kind: 'sprite', components, entity: { position: { x, y, z: 7 } },
    worldMatrix: Collider.composeMatrix({ position: [x, y, 7] }) };
}
function scene(actor, others, tuning = config) {
  const objects = [actor, ...others], controller = Platformer.createPlatformerController2D();
  let intent = [0, 0], calls = 0, ticks = 0;
  const before = JSON.stringify(objects.map(item => item.components));
  const manager = Body.createBody2DManager({ characterVelocity: item => {
    assert.strictEqual(item, actor); calls++; return intent;
  } });
  function tick(dt, input = neutral, lifecycle) {
    intent = controller.prepare(tuning, input, dt, manager.getCharacterCollision2DState(actor.id), lifecycle);
    manager.tick(objects, dt); ticks++;
    controller.resolve(manager.getCharacterCollision2DState(actor.id));
    assert.equal(calls, ticks, 'One provider admission for each real Body tick');
    assert.equal(JSON.stringify(objects.map(item => item.components)), before, 'Authored components unchanged');
    assert.equal(actor.entity.position.z, 7, 'XY movement preserves Z');
    return manager.getCharacterCollision2DState(actor.id);
  }
  return { actor, objects, manager, controller, tick };
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); } }
test('First-frame press uses real initial ground contact then jumps and lands', () => {
  const actor = object('player', 0, 1, { character: true, velocity: [99, 99] });
  const run = scene(actor, [object('floor', 0, 0, { static: true, size: [100, 1] })]);
  assert(run.tick(1 / 60, { ...neutral, jumpPressed: true }).grounded);
  run.tick(1 / 60); assert(actor.entity.position.y > 1.1);
  let peak = actor.entity.position.y;
  for (let i = 0; i < 90; i++) { run.tick(1 / 60); peak = Math.max(peak, actor.entity.position.y); }
  assert(peak > 2.5); assert(Math.abs(actor.entity.position.y - 1) < .001);
  assert(run.manager.getCharacterCollision2DState(actor.id).grounded);
});
test('Real ceiling ends ascent and real tall wall blocks run without component writes', () => {
  const actor = object('player', 0, 1, { character: true });
  const run = scene(actor, [object('floor', 0, 0, { static: true, size: [100, 1] }),
    object('ceiling', 0, 3, { static: true, size: [20, 1] }),
    object('wall', 2, 2, { static: true, size: [1, 8] })]);
  run.tick(1 / 60); let ceilingSeen = false, wallSeen = false;
  for (let i = 0; i < 90; i++) {
    const state = run.tick(1 / 60, { ...neutral, right: true, jumpPressed: i === 0 });
    if (state.ceiling) { ceilingSeen = true; assert(run.controller.getState().velocity[1] <= 0); }
    wallSeen ||= state.wallRight;
    assert(actor.entity.position.y <= 2.0001); assert(actor.entity.position.x <= 1.0001);
  }
  assert(ceilingSeen && wallSeen);
});
test('Phase049 rejecting mask actually permits intended wall pass-through', () => {
  const actor = object('player', 0, 1, { character: true });
  const run = scene(actor, [object('floor', 0, 0, { static: true, size: [100, 1] }),
    object('filtered-wall', 2, 2, { static: true, size: [1, 8], reject: true })]);
  for (let i = 0; i < 60; i++) run.tick(1 / 60, { ...neutral, right: true });
  assert(Math.abs(actor.entity.position.x - 5) < .001); assert(Math.abs(actor.entity.position.y - 1) < .001);
});
test('Actual one-way platform permits ascent and catches descending player', () => {
  const actor = object('player', 0, 0, { character: true });
  const run = scene(actor, [object('floor', 0, -1, { static: true, size: [100, 1] }),
    object('one-way', 0, .5, { static: true, oneWay: true, size: [10, .25] })]);
  run.tick(1 / 60); let peak = 0;
  for (let i = 0; i < 120; i++) {
    run.tick(1 / 60, { ...neutral, jumpPressed: i === 0 }); peak = Math.max(peak, actor.entity.position.y);
  }
  assert(peak > 1.5); assert(Math.abs(actor.entity.position.y - 1.125) < .001);
  assert.equal(run.manager.getCharacterCollision2DState(actor.id).groundSupportId, 'one-way');
});
test('Moving-platform carry composes with actual transient run exactly once', () => {
  const actor = object('player', 0, .75, { character: true });
  const run = scene(actor, [object('platform', 0, 0, { moving: true, velocity: [2, 0], size: [100, .5] })]);
  for (let i = 0; i < 60; i++) run.tick(1 / 60, { ...neutral, right: true });
  assert(Math.abs(actor.entity.position.x - 7) < .001); assert(Math.abs(actor.entity.position.y - .75) < .001);
  assert.equal(run.manager.getCharacterCollision2DState(actor.id).groundSupportId, 'platform');
});
test('Real run/jump/landing is bounded across 30/60/144 partitions', () => {
  const results = [];
  for (const hz of [30, 60, 144]) {
    const actor = object('player', 0, 1, { character: true });
    const run = scene(actor, [object('floor', 0, 0, { static: true, size: [100, 1] })]);
    run.tick(1 / hz); let peak = 1;
    for (let i = 0; i < hz * 2; i++) {
      run.tick(1 / hz, { ...neutral, right: true, jumpPressed: i === 0 });
      peak = Math.max(peak, actor.entity.position.y);
    }
    assert(Math.abs(actor.entity.position.x - 10) < .001); assert(Math.abs(actor.entity.position.y - 1) < .001);
    assert(run.manager.getCharacterCollision2DState(actor.id).grounded); results.push(peak);
  }
  assert(Math.max(...results) - Math.min(...results) < .012);
});
test('Pause/freeze intent is inert in actual Body path and reset clears launch', () => {
  const actor = object('player', 0, 1, { character: true });
  const run = scene(actor, [object('floor', 0, 0, { static: true, size: [100, 1] })]);
  run.tick(.01);
  for (const lifecycle of [{ frozen: true }, { paused: true }]) {
    const before = { ...actor.entity.position };
    run.tick(.01, { ...neutral, right: true, jumpPressed: true }, lifecycle);
    assert.deepStrictEqual(actor.entity.position, before);
    assert.deepStrictEqual(run.controller.getState().velocity, [0, 0]);
    assert(!run.controller.getState().pendingInitialJump);
  }
  run.controller.reset(); run.tick(.01); assert(Math.abs(actor.entity.position.y - 1) < .001);
});
console.log(`Phase116 actual Platformer/Body integration: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
