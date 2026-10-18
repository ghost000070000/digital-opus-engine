'use strict';
const assert = require('assert');
const { resolveControllerAbilities: resolve } = require('../editor/src/00-controller-abilities.js');
const Platformer = require('../editor/src/00-platformer-controller-2d.js');
const TopDown = require('../editor/src/00-topdown-controller-2d.js');
const controller = Object.freeze({ moveSpeed: 5, gravity: 20, jumpSpeed: 8, jumpActionRef: 'jump' });
const jump = Object.freeze({ version: 1, enabled: true, inputActionRef: 'abilityJump', jumpSpeed: 10 });
const sprint = Object.freeze({ version: 1, enabled: true, inputActionRef: 'sprint', speedMultiplier: 2 });
const source = components => ({ family: 'platformer2d', controller, components });
const contact = grounded => ({ active: true, grounded, ceiling: false, wallLeft: false, wallRight: false });
const idle = { left: false, right: false, jumpPressed: false };
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); } }

test('Absent abilities preserve actual historical platformer tuning and named Jump', () => {
  const calls = [];
  const result = resolve(source({}), { actionPressed: id => { calls.push(id); return true; } });
  assert.deepStrictEqual(result, { speed: 5, gravity: 20, jumpSpeed: 8, jumpEnabled: true, jumpPressed: true });
  assert.deepStrictEqual(calls, ['jump']);
});
test('Enabled abilities override only transient speed and Jump tuning via their typed Actions', () => {
  const calls = [];
  const result = resolve(source({ 'jump-ability': jump, 'sprint-ability': sprint }), {
    actionPressed: id => { calls.push(['pressed', id]); return true; },
    actionDown: id => { calls.push(['down', id]); return true; }
  });
  assert.deepStrictEqual(result, { speed: 10, gravity: 20, jumpSpeed: 10, jumpEnabled: true, jumpPressed: true });
  assert.deepStrictEqual(calls, [['pressed', 'abilityJump'], ['down', 'sprint']]);
});
test('Disabled Jump explicitly suppresses legacy fallback; disabled Sprint keeps base speed', () => {
  let calls = 0;
  const result = resolve(source({ 'jump-ability': { ...jump, enabled: false }, 'sprint-ability': { ...sprint, enabled: false } }), {
    actionPressed: () => { calls++; return true; }, actionDown: () => { calls++; return true; }
  });
  assert.equal(result.jumpEnabled, false); assert.equal(result.jumpPressed, false);
  assert.equal(result.gravity, 20); assert.equal(result.speed, 5); assert.equal(calls, 0);
});
test('Present malformed and future Jump records suppress launch without suppressing gravity/run', () => {
  for (const bad of [null, {}, { ...jump, version: 2 }, { ...jump, enabled: 1 }, { ...jump, inputActionRef: '' },
    { ...jump, jumpSpeed: 0 }, { ...jump, jumpSpeed: Infinity }, { ...jump, jumpSpeed: '10' }]) {
    let calls = 0;
    const result = resolve(source({ 'jump-ability': bad }), { actionPressed: () => { calls++; return true; } });
    assert.equal(result.jumpEnabled, false); assert.equal(result.jumpPressed, false);
    assert.equal(result.speed, 5); assert.equal(result.gravity, 20); assert.equal(calls, 0);
  }
});
test('Unavailable, throwing and nonboolean Action results never launch or Sprint', () => {
  for (const callback of [undefined, () => undefined, () => null, () => 1, () => { throw Error('unavailable'); }]) {
    const result = resolve(source({ 'jump-ability': jump, 'sprint-ability': sprint }), { actionPressed: callback, actionDown: callback });
    assert.equal(result.jumpEnabled, false); assert.equal(result.jumpPressed, false); assert.equal(result.speed, 5);
  }
  const released = resolve(source({ 'jump-ability': jump }), { actionPressed: () => false });
  assert.equal(released.jumpEnabled, true); assert.equal(released.jumpPressed, false);
});
test('Invalid Sprint tuning and overflow retain finite ordinary speed', () => {
  for (const bad of [null, {}, { ...sprint, version: 2 }, { ...sprint, inputActionRef: ' ' },
    { ...sprint, speedMultiplier: .5 }, { ...sprint, speedMultiplier: Infinity }, { ...sprint, speedMultiplier: '2' }]) {
    let calls = 0;
    const result = resolve(source({ 'sprint-ability': bad }), { actionDown: () => { calls++; return true; } });
    assert.equal(result.speed, 5); assert.equal(calls, 0);
  }
  const result = resolve({ ...source({ 'sprint-ability': { ...sprint, speedMultiplier: Number.MAX_VALUE } }),
    controller: { ...controller, moveSpeed: Number.MAX_VALUE } }, { actionDown: () => true });
  assert.equal(result.speed, Number.MAX_VALUE); assert(Number.isFinite(result.speed));
});
test('Top-down supports Sprint but never calls Jump; unsupported legacy families are inert', () => {
  let jumpCalls = 0;
  const result = resolve({ ...source({ 'jump-ability': jump, 'sprint-ability': sprint }), family: 'topdown2d' }, {
    actionPressed: () => { jumpCalls++; return true; }, actionDown: () => true
  });
  assert.deepStrictEqual(result, { speed: 10, gravity: 0, jumpSpeed: 0, jumpEnabled: false, jumpPressed: false });
  assert.equal(jumpCalls, 0);
  for (const family of ['firstperson', 'thirdperson', 'topdown', 'hovercraft', 'unknown']) {
    assert.deepStrictEqual(resolve({ ...source({ 'jump-ability': jump, 'sprint-ability': sprint }), family }, {
      actionPressed: () => { throw Error('must not call'); }, actionDown: () => { throw Error('must not call'); }
    }), { speed: 0, gravity: 0, jumpSpeed: 0, jumpEnabled: false, jumpPressed: false });
  }
});
test('Fresh results and composition never mutate authored controller/components', () => {
  const bag = Object.freeze({ 'jump-ability': jump, 'sprint-ability': sprint }), before = JSON.stringify(source(bag));
  const result = resolve(source(bag), { actionPressed: () => true, actionDown: () => true }); result.speed = 123;
  assert.equal(JSON.stringify(source(bag)), before);
  assert.equal(resolve(source(bag), { actionDown: () => true, actionPressed: () => true }).speed, 10);
});
test('Explicit disable clears queued initial Jump without resetting actual airborne state', () => {
  const actual = Platformer.createPlatformerController2D();
  actual.prepare({ speed: 5, gravity: 20, jumpSpeed: 8 }, { ...idle, jumpPressed: true }, .01, { active: false });
  assert(actual.getState().pendingInitialJump);
  actual.resolve(contact(true));
  const config = resolve(source({ 'jump-ability': { ...jump, enabled: false } }));
  assert(actual.prepare(config, { ...idle, jumpPressed: true }, .01, contact(true))[1] < 0);
  assert(!actual.getState().pendingInitialJump);
  actual.resolve(contact(false));
  actual.prepare({ speed: 5, gravity: 20, jumpSpeed: 8 }, { ...idle, jumpPressed: true }, .01, contact(true));
  const beforeVy = actual.getState().velocity[1];
  actual.prepare(config, idle, .01, contact(false));
  assert(Math.abs(actual.getState().velocity[1] - (beforeVy - .2)) < 1e-12);
});
test('Actual module composition preserves run/freefall/jump across 30/60/144 partitions', () => {
  for (const hz of [30, 60, 144]) {
    const actual = Platformer.createPlatformerController2D(); let x = 0, y = 0;
    for (let i = 0; i < hz; i++) {
      const config = resolve(source({ 'jump-ability': jump, 'sprint-ability': sprint }), {
        actionDown: () => true, actionPressed: () => i === 0
      });
      const v = actual.prepare(config, { ...idle, right: true, jumpPressed: config.jumpPressed }, 1 / hz, contact(i === 0));
      x += v[0] / hz; y += v[1] / hz; actual.resolve(contact(false));
    }
    assert(Math.abs(x - 10) < 1e-10); assert(Math.abs(y) < 1e-10);
  }
});
test('Actual Top-down Sprint maintains normalized diagonal partitions with one prepare per tick', () => {
  for (const hz of [30, 60, 144]) {
    const actual = TopDown.createTopDownController2D(); let x = 0, y = 0, ticks = 0;
    for (let i = 0; i < hz; i++) {
      const config = resolve({ ...source({ 'sprint-ability': sprint }), family: 'topdown2d' }, { actionDown: () => true });
      const v = actual.prepare(config, { left: false, right: true, up: true, down: false }, 1 / hz); ticks++;
      x += v[0] / hz; y += v[1] / hz;
    }
    assert.equal(ticks, hz); assert(Math.abs(x - 10 / Math.sqrt(2)) < 1e-10); assert(Math.abs(x - y) < 1e-10);
  }
});
test('Invalid optional Jump policy fails closed; omitted policy preserves qualified historical Jump', () => {
  const actual = Platformer.createPlatformerController2D();
  assert.deepStrictEqual(actual.prepare({ speed: 5, gravity: 20, jumpSpeed: 8, jumpEnabled: 'false' }, idle, .01, contact(true)), [0, 0]);
  assert(actual.prepare({ speed: 5, gravity: 20, jumpSpeed: 8 }, { ...idle, jumpPressed: true }, .01, contact(true))[1] > 7);
});
console.log(`Phase119 actual controller abilities: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
