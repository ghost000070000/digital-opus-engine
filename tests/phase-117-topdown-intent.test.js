'use strict';
const assert = require('assert'), TopDown = require('../editor/src/00-topdown-controller-2d.js');
const config = Object.freeze({ speed: 5 }), idle = Object.freeze({ left: false, right: false, up: false, down: false });
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); } }
test('Actual pure intent uses four worldXY cardinal directions without dt scaling', () => {
  const controller = TopDown.createTopDownController2D();
  for (const [key, expected] of [['left', [-5, 0]], ['right', [5, 0]], ['up', [0, 5]], ['down', [0, -5]]]) {
    assert.deepStrictEqual(controller.prepare(config, { ...idle, [key]: true }, .01), expected);
    assert.deepStrictEqual(controller.prepare(config, { ...idle, [key]: true }, .5), expected);
  }
});
test('Opposing actions cancel and diagonals do not increase speed', () => {
  const controller = TopDown.createTopDownController2D();
  assert.deepStrictEqual(controller.prepare(config, { left: true, right: true, up: true, down: true }, .1), [0, 0]);
  const result = controller.prepare(config, { ...idle, right: true, up: true }, .1);
  assert(Math.abs(Math.hypot(...result) - 5) < 1e-12); assert.equal(result[0], result[1]);
  assert.deepStrictEqual(controller.prepare(config, { ...idle, left: true, right: true, up: true }, .1), [0, 5]);
});
test('Actual intent integrates equally across30/60/144 host partitions', () => {
  for (const hz of [30, 60, 144]) {
    const controller = TopDown.createTopDownController2D(); let x = 0, y = 0;
    for (let i = 0; i < hz; i++) { const v = controller.prepare(config, { ...idle, right: true, up: true }, 1 / hz); x += v[0] / hz; y += v[1] / hz; }
    assert(Math.abs(x - 5 / Math.sqrt(2)) < 1e-10); assert(Math.abs(y - x) < 1e-10);
  }
});
test('Malformed config/input/dt fail closed and snapshots cannot mutate intent', () => {
  const controller = TopDown.createTopDownController2D();
  for (const bad of [null, {}, { speed: 0 }, { speed: -2 }, { speed: Infinity }, { speed: '5' }]) assert.deepStrictEqual(controller.prepare(bad, idle, .1), [0, 0]);
  for (const dt of [0, -1, NaN, Infinity]) assert.deepStrictEqual(controller.prepare(config, idle, dt), [0, 0]);
  assert.deepStrictEqual(controller.prepare(config, { ...idle, up: 1 }, .1), [0, 0]);
  const result = controller.prepare(config, { ...idle, up: true }, .1); result[1] = 99;
  const state = controller.getState(); state.velocity[1] = 99; assert.deepStrictEqual(controller.getState().velocity, [0, 5]);
});
test('Pause/freeze/reset clear transient intent with unchanged authored tuning', () => {
  const controller = TopDown.createTopDownController2D(), before = JSON.stringify(config);
  for (const lifecycle of [{ paused: true }, { frozen: true }]) {
    controller.prepare(config, { ...idle, up: true }, .1);
    assert.deepStrictEqual(controller.prepare(config, { ...idle, up: true }, .1, lifecycle), [0, 0]);
  }
  controller.prepare(config, { ...idle, right: true }, .1); controller.reset();
  assert.deepStrictEqual(controller.getState().velocity, [0, 0]); assert.equal(JSON.stringify(config), before);
});
test('Contact response reports blocked axes without persistentinput or gravitystate', () => {
  const controller = TopDown.createTopDownController2D();
  controller.prepare(config, { ...idle, right: true, up: true }, .1);
  controller.resolve({ active: true, grounded: false, ceiling: true, wallLeft: false, wallRight: true });
  assert.deepStrictEqual(controller.getState().velocity, [0, 0]);
  assert.deepStrictEqual(controller.prepare(config, { ...idle, left: true }, .1), [-5, 0]);
  controller.resolve({ active: false }); assert.deepStrictEqual(controller.getState().velocity, [0, 0]);
});
console.log(`Phase117 actual TopDown intent: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
