'use strict';
const assert = require('assert'), C = require('../editor/src/00-collider-2d.js'), B = require('../editor/src/00-body-2d.js');
const T = require('../editor/src/00-character-tile-query.js'), P = require('../editor/src/00-authoring-plumbing.js');
const Trigger = require('../editor/src/00-trigger-collider-2d.js'), TopDown = require('../editor/src/00-topdown-controller-2d.js');
const idle = Object.freeze({ left: false, right: false, up: false, down: false });
function object(id, x, y, options = {}) {
  const components = { 'body-2d': { version: 1, enabled: true, type: options.static ? 'static' : 'kinematic', linearVelocity: [99, 99] },
    'box-collider-2d': { version: 1, enabled: true, size: options.size || [1, 1], offset: [0, 0] } };
  if (!options.static) components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: false,
    wallSlideMaxSpeed: 3, slopeHandlingEnabled: false, maxSlopeAngle: 50, stepHandlingEnabled: false, maxStepHeight: .5 };
  if (options.reject) Object.assign(components['box-collider-2d'], { version: 2, collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'custom', collisionMaskRefs: [] });
  return { id, kind: 'sprite', components, entity: { position: { x, y, z: 7 } }, worldMatrix: C.composeMatrix({ position: [x, y, 7] }) };
}
function scene(player, others = [], speed = 5, extra = {}) {
  const controller = TopDown.createTopDownController2D(), objects = [player, ...others], before = JSON.stringify(objects.map(o => o.components));
  let intent = [0, 0], calls = 0, ticks = 0;
  const manager = B.createBody2DManager({ ...extra, characterVelocity: actor => { assert.strictEqual(actor, player); calls++; return intent; } });
  function tick(dt, input = idle, lifecycle) {
    intent = controller.prepare({ speed }, input, dt, lifecycle); manager.tick(objects, dt); ticks++;
    controller.resolve(manager.getCharacterCollision2DState(player.id));
    assert.equal(calls, ticks); assert.equal(JSON.stringify(objects.map(o => o.components)), before); assert.equal(player.entity.position.z, 7);
    return manager.getCharacterCollision2DState(player.id);
  }
  return { player, objects, tick, manager };
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); } }
test('Real four-way movement and normalized diagonals preserve authored velocity andZ', () => {
  for (const [key, axis, expected] of [['right', 'x', 5], ['left', 'x', -5], ['up', 'y', 5], ['down', 'y', -5]]) {
    const run = scene(object('player', 0, 0)); run.tick(1, { ...idle, [key]: true }); assert.equal(run.player.entity.position[axis], expected);
  }
  const run = scene(object('player', 0, 0)); run.tick(1, { ...idle, right: true, up: true });
  assert(Math.abs(Math.hypot(run.player.entity.position.x, run.player.entity.position.y) - 5) < 1e-9);
});
test('Real highspeed corner blocks both axes and reports canonical contact', () => {
  const run = scene(object('player', 0, 0), [object('wall', 2, 0, { static: true, size: [1, 20] }), object('ceiling', 0, 2, { static: true, size: [20, 1] })], 1000);
  const state = run.tick(.2, { ...idle, right: true, up: true });
  assert(run.player.entity.position.x <= 1.0001 && run.player.entity.position.y <= 1.0001); assert(state.wallRight && state.ceiling);
});
test('Disabled platformer wallSlide preserves downward topdown speed at solidwall', () => {
  const run = scene(object('player', 0, 0), [object('wall', 1, 0, { static: true, size: [1, 20] })], 10);
  const state = run.tick(1, { ...idle, down: true }); assert.equal(run.player.entity.position.y, -10); assert(!state.wallSliding);
});
test('Phase049 rejected mask permits wall pass-through while acceptedwall blocks', () => {
  for (const reject of [false, true]) {
    const run = scene(object('player', 0, 0), [object('wall', 2, 0, { static: true, size: [1, 20], reject })]);
    run.tick(1, { ...idle, right: true }); assert(reject ? run.player.entity.position.x === 5 : run.player.entity.position.x <= 1.0001);
  }
});
test('Actual canonical Tile query blocks highspeedX andY without platformer flags', () => {
  const tileset = P.createTileset({ id: 'tiles', name: 'Tiles', cellSize: { width: 2, height: 1 }, tiles: [{ id: 'solid', name: 'Solid', collision: { mode: 'full-cell' } }] });
  const map = P.createTilemapRecord({ id: 'map', tilesetRef: 'tiles', layers: [{ id: 'base', name: 'Base', cells: [{ x: -2, y: 0, tileId: 'solid' }] }] });
  map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  for (const [x, y, key, axis, expected] of [[-10, .5, 'right', 'x', -4.5], [-3, 10, 'down', 'y', 1.5]]) {
    const run = scene(object('player', x, y), [], 1000, { tileObstacles: (actor, bounds) => T.query([map], [tileset], actor, bounds) });
    run.tick(.1, { ...idle, [key]: true }); assert(Math.abs(run.player.entity.position[axis] - expected) < .001);
  }
});
test('Actual Trigger observes finaladmitted position, not requested wallbypass', () => {
  for (const reject of [false, true]) {
    const run = scene(object('player', 0, 0), [object('wall', 2, 0, { static: true, size: [1, 20], reject })]);
    const sensor = object('sensor', 5, 0, { static: true }); sensor.components = { 'trigger-collider-2d': { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [1, 1], radius: 1 } };
    const events = [], lifecycle = Trigger.createTriggerLifecycle({ emit: event => events.push(event) });
    run.tick(1, { ...idle, right: true }); lifecycle.tick([run.player, sensor]);
    assert.equal(events.some(event => event.targetObjectId === 'player' && event.eventType === Trigger.ENTER), reject);
  }
});
test('Real normalizedrun equals across30/60/144 partitions without gravitydrift', () => {
  for (const hz of [30, 60, 144]) {
    const run = scene(object('player', 0, 0));
    for (let i = 0; i < hz; i++) run.tick(1 / hz, { ...idle, right: true, up: true });
    assert(Math.abs(run.player.entity.position.x - 5 / Math.sqrt(2)) < 1e-9); assert(Math.abs(run.player.entity.position.y - 5 / Math.sqrt(2)) < 1e-9);
    const before = { ...run.player.entity.position }; run.tick(.1); assert.deepStrictEqual(run.player.entity.position, before);
  }
});
test('Pause/freeze and opposinginput admit zero through actual Body path', () => {
  const run = scene(object('player', 0, 0));
  for (const lifecycle of [{ paused: true }, { frozen: true }]) run.tick(.1, { ...idle, up: true }, lifecycle);
  run.tick(.1, { left: true, right: true, up: true, down: true });
  assert.deepStrictEqual(run.player.entity.position, { x: 0, y: 0, z: 7 });
});
console.log(`Phase117 actual TopDown/Body integration: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
