'use strict';
const assert = require('assert'), Abilities = require('../editor/src/00-controller-abilities'), Platformer = require('../editor/src/00-platformer-controller-2d'), Topdown = require('../editor/src/00-topdown-controller-2d'), Collider = require('../editor/src/00-collider-2d'), Body = require('../editor/src/00-body-2d');
function object(id, x, y, size, actor) {
  const components = { 'body-2d': { version: 1, enabled: true, type: actor ? 'kinematic' : 'static', linearVelocity: [0, 0] }, 'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size } };
  if (actor) components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: false, wallSlideMaxSpeed: 3, slopeHandlingEnabled: false, maxSlopeAngle: 50, stepHandlingEnabled: false, maxStepHeight: .5 };
  return { id, kind: 'sprite', components, entity: { position: { x, y, z: 7 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 7] }) };
}
function scene(family, bag) {
  const actor = object('actor', 0, 1, [1, 1], true); Object.assign(actor.components, bag);
  const objects = [actor, object('floor', 0, 0, [100, 1]), object('wall', 2, 2, [1, 8])], controller = family === 'platformer2d' ? Platformer.createPlatformerController2D() : Topdown.createTopDownController2D();
  const base = { moveSpeed: 5, gravity: 20, jumpSpeed: 8, jumpActionRef: 'jump' }, before = JSON.stringify(objects.map(x => x.components));
  let velocity = [0, 0], calls = 0, ticks = 0;
  const manager = Body.createBody2DManager({ characterVelocity: x => { assert.strictEqual(x, actor); calls++; return velocity; } });
  function tick(dt, { right = false, sprint = false, jump = false } = {}) {
    const config = Abilities.resolveControllerAbilities({ family, components: actor.components, controller: base }, { actionDown: () => sprint, actionPressed: () => jump });
    velocity = controller.prepare(config, family === 'platformer2d' ? { left: false, right, jumpPressed: config.jumpPressed } : { left: false, right, up: false, down: false }, dt, family === 'platformer2d' ? manager.getCharacterCollision2DState(actor.id) : undefined);
    manager.tick(objects, dt); ticks++; controller.resolve(manager.getCharacterCollision2DState(actor.id)); assert.equal(calls, ticks); assert.equal(JSON.stringify(objects.map(x => x.components)), before); assert.equal(actor.entity.position.z, 7);
    return manager.getCharacterCollision2DState(actor.id);
  }
  return { actor, tick };
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } }
for (const family of ['platformer2d', 'topdown2d']) test('Actual ' + family + ' high-speed Sprint remains blocked through sole Body at 30/60/144Hz', () => {
  for (const hz of [30, 60, 144]) { const run = scene(family, { 'sprint-ability': { version: 1, enabled: true, inputActionRef: 'sprint', speedMultiplier: 20 } }); run.tick(1 / hz); let wall = false; for (let i = 0; i < hz; i++) { const state = run.tick(1 / hz, { right: true, sprint: true }); wall ||= state.wallRight; assert(run.actor.entity.position.x <= 1.00001); } assert(wall); }
});
test('Actual explicitly disabled Jump stays on ground under repeated launch input with gravity intact', () => {
  const run = scene('platformer2d', { 'jump-ability': { version: 1, enabled: false, inputActionRef: 'jump', jumpSpeed: 12 } }); for (let i = 0; i < 120; i++) { run.tick(1 / 60, { jump: true }); assert(run.actor.entity.position.y <= 1.00001); } assert(Math.abs(run.actor.entity.position.y - 1) < .001);
});
test('Actual configured Jump leaves ground and returns through canonical contacts', () => {
  const run = scene('platformer2d', { 'jump-ability': { version: 1, enabled: true, inputActionRef: 'jump', jumpSpeed: 12 } }); run.tick(1 / 60); let peak = 1, airborne = false, landed = false;
  for (let i = 0; i < 150; i++) { const contact = run.tick(1 / 60, { jump: i === 0 }); peak = Math.max(peak, run.actor.entity.position.y); airborne ||= !contact.grounded; if (airborne && contact.grounded) landed = true; } assert(peak > 4); assert(landed);
});
console.log(`Phase119 actual Body composition: ${passed} PASS, ${failed} FAIL`); if (failed) process.exitCode = 1;
