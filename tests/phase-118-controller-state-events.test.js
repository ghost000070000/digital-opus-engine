'use strict';
const assert = require('assert'), API = require('../editor/src/00-controller-state-events.js');
const owner = {}, sample = (position, extra = {}) => ({ owner, session: 1, family: 'platformer2d', position, grounded: true, ...extra });
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); } }
test('Actual module silently seeds initial grounded state and emits once per actual motionedge', () => {
  const events = [], service = API.createControllerStateEvents({ emit: p => events.push(p.event) });
  service.sample(sample([0, 0, 0]), .1); assert.equal(events.length, 0);
  service.sample(sample([1, 0, 0]), .1); service.sample(sample([2, 0, 0]), .1);
  service.sample(sample([2, 0, 0]), .1); service.sample(sample([2, 0, 0]), .1);
  assert.deepStrictEqual(events, ['moving', 'idle']);
});
test('Airborne includes walkingoffedge and Landed occurs only after actualgrounded edge', () => {
  const events = [], service = API.createControllerStateEvents({ emit: p => events.push(p.event) });
  service.sample(sample([0, 0, 0]), .1);
  service.sample(sample([0, -1, 0], { grounded: false }), .1);
  service.sample(sample([0, -2, 0], { grounded: false }), .1);
  service.sample(sample([0, -2, 0]), .1);
  assert.deepStrictEqual(events, ['airborne', 'landed']); assert(!API.EVENTS.includes('jump'));
});
test('Actual planar conventions exclude Platformergravity butinclude TopdownXY and legacyXZ', () => {
  for (const [family, changed, expected] of [['platformer2d', [0, 1, 0], false], ['topdown2d', [0, 1, 0], true],
    ['firstperson', [0, 1, 0], false], ['thirdperson', [0, 0, 1], true], ['topdown', [0, 0, 1], true], ['hovercraft', [1, 0, 0], true]]) {
    const events = [], service = API.createControllerStateEvents({ emit: p => events.push(p.event) });
    service.sample(sample([0, 0, 0], { family }), .1); service.sample(sample(changed, { family }), .1);
    assert.equal(events.includes('moving'), expected, family);
  }
});
test('Familieswithout verticalgrounding cannot manufactureairborne orlanded', () => {
  for (const family of ['topdown2d', 'topdown', 'hovercraft']) {
    const events = [], service = API.createControllerStateEvents({ emit: p => events.push(p.event) });
    service.sample(sample([0, 0, 0], { family }), .1);
    service.sample(sample([0, 0, 0], { family, grounded: false }), .1);
    service.sample(sample([0, 0, 0], { family }), .1);
    assert.deepStrictEqual(events, []); assert.equal(service.getState().grounded, null);
  }
});
test('Heldintent withoutresolved displacement produces no movingevents; carry does', () => {
  const events = [], service = API.createControllerStateEvents({ emit: p => events.push(p.event) });
  service.sample(sample([0, 0, 0]), .1);
  service.sample(sample([0, 0, 0], { rightHeld: true }), .1); assert.equal(events.length, 0);
  service.sample(sample([1, 0, 0], { rightHeld: false }), .1); assert.deepStrictEqual(events, ['moving']);
});
test('Pause reseeds silently and cannot replaytransition afterresume', () => {
  const events = [], service = API.createControllerStateEvents({ emit: p => events.push(p.event) });
  service.sample(sample([0, 0, 0]), .1);
  service.sample(sample([1, -1, 0], { grounded: false }), .1, { paused: true });
  service.sample(sample([1, -1, 0], { grounded: false }), .1); assert.equal(events.length, 0);
  service.sample(sample([1, -1, 0], { grounded: false }), .1); assert.equal(events.length, 0);
});
test('Identity session family and reset changes seed silently', () => {
  const events = [], service = API.createControllerStateEvents({ emit: p => events.push(p.event) });
  service.sample(sample([0, 0, 0]), .1);
  service.sample(sample([9, 9, 9], { owner: {} }), .1);
  service.sample(sample([9, 9, 9], { session: 2 }), .1);
  service.sample(sample([9, 9, 9], { family: 'topdown2d' }), .1);
  service.reset(); service.sample(sample([9, 9, 9]), .1); assert.deepStrictEqual(events, []);
});
test('Malformed unknownfamily positions dt session and contact failclosedreset', () => {
  for (const bad of [{ family: 'unknown' }, { position: [Infinity, 0, 0] }, { position: [0, 0] }, { session: -1 }, { grounded: 'true' }, { owner: null }]) {
    const service = API.createControllerStateEvents(); service.sample(sample([0, 0, 0]), .1);
    assert.equal(service.sample(sample([0, 0, 0], bad), .1), null); assert.equal(service.getState(), null);
  }
  for (const dt of [NaN, Infinity, 0, -1]) assert.equal(API.createControllerStateEvents().sample(sample([0, 0, 0]), dt), null);
});
test('Callback reset invalidatesremaining oldbatch and doesnot replay', () => {
  const events = []; let service;
  service = API.createControllerStateEvents({ emit: p => { events.push(p.event); service.reset(); } });
  service.sample(sample([0, 0, 0]), .1); service.sample(sample([1, 1, 0], { grounded: false }), .1);
  assert.deepStrictEqual(events, ['moving']); assert.equal(service.getState(), null);
  service.sample(sample([2, 2, 0], { grounded: false }), .1); assert.deepStrictEqual(events, ['moving']);
});
test('Callback reentry and externalownership invalidation suppressstale secondedge', () => {
  const events = []; let current = true, service;
  service = API.createControllerStateEvents({ isCurrent: () => current, emit: p => { events.push(p.event); current = false; } });
  service.sample(sample([0, 0, 0]), .1); service.sample(sample([1, 1, 0], { grounded: false }), .1);
  assert.deepStrictEqual(events, ['moving']);
  const reentry = []; let other;
  other = API.createControllerStateEvents({ emit: p => { reentry.push(p.event); other.sample(sample([5, 5, 0], { owner: {} }), .1); } });
  other.sample(sample([0, 0, 0]), .1); other.sample(sample([1, 1, 0], { grounded: false }), .1);
  assert.deepStrictEqual(reentry, ['moving']);
});
test('Payload snapshots immutable and source samples/positions unchanged', () => {
  let payload; const service = API.createControllerStateEvents({ emit: p => { payload = p; } });
  const initial = sample([0, 0, 0]), changed = sample([1, 0, 0]); const before = JSON.stringify(changed);
  service.sample(initial, .1); service.sample(changed, .1);
  assert(Object.isFrozen(payload) && Object.isFrozen(payload.position));
  assert.equal(JSON.stringify(changed), before); const state = service.getState(); state.position[0] = 99;
  assert.equal(service.getState().position[0], 1);
});
test('Threshold is speed based ratherthan refreshrate dependent', () => {
  for (const hz of [30, 60, 144]) {
    const events = [], service = API.createControllerStateEvents({ emit: p => events.push(p.event) });
    service.sample(sample([0, 0, 0]), 1 / hz); service.sample(sample([1 / hz, 0, 0]), 1 / hz);
    assert.deepStrictEqual(events, ['moving']);
  }
});
console.log(`Phase118 actual resolved controller edges: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
