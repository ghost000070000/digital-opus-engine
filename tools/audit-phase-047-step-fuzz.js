'use strict';
const assert = require('assert');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
let seed = 0x47de57e9;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function between(a, b) { return a + (b - a) * random(); }
function actor(id, x, y, size, velocity, type, character = false) {
  const components = { 'body-2d': { version: 1, enabled: true, type, linearVelocity: velocity },
    'box-collider-2d': { version: 1, enabled: true, size, offset: [0, 0] } };
  if (character) components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3,
    slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 };
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0] }), components };
}
const cases = Number(process.argv[2]) || 500000;
let ascents = 0, descents = 0, ceilings = 0;
for (let i = 0; i < cases; i++) {
  const height = between(.03, 1.05), charHeight = between(.45, 1.8), charWidth = between(.4, 1.4);
  const xDistance = between(.6, 2.1), descending = !!(i & 1);
  let character, obstacles;
  if (descending) {
    const high = actor('high', -1, -.5, [2, 1], [0, 0], 'static');
    const low = actor('low', 1, -.5 - height, [2, 1], [0, 0], 'static');
    character = actor('m', -.5, charHeight / 2, [charWidth, charHeight], [xDistance, 0], 'kinematic', true);
    obstacles = [high, low];
  } else {
    const floor = actor('floor', 0, -.5, [8, 1], [0, 0], 'static');
    const ledge = actor('ledge', 1, height / 2, [1, height], [0, 0], 'static');
    character = actor('m', 0, charHeight / 2, [charWidth, charHeight], [xDistance, 0], 'kinematic', true);
    obstacles = [floor, ledge];
    if (random() < .33) {
      const clearance = between(.01, .8);
      obstacles.push(actor('ceiling', .5, charHeight + clearance + .1, [3, .2], [0, 0], 'static'));
      ceilings++;
    }
  }
  const initial = Collider.enumerateCollider2DWorldShapes(character)[0];
  if (obstacles.some((object) => Body.separation(initial, Collider.enumerateCollider2DWorldShapes(object)[0]) < -1e-5)) continue;
  const manager = Body.createBody2DManager();
  const result = manager.tick([character, ...obstacles], 1)[0].result;
  assert(Number.isFinite(result.actualDelta.x) && Number.isFinite(result.actualDelta.y));
  if (result.actualDelta.y > 0) { ascents++; assert(result.actualDelta.y <= .5 + .0002, `up ${i}: ${result.actualDelta.y}`); }
  if (result.actualDelta.y < 0) { descents++; assert(result.actualDelta.y >= -.5 - .0002, `down ${i}: ${result.actualDelta.y}`); }
  const final = Collider.enumerateCollider2DWorldShapes(character)[0];
  for (const object of obstacles) {
    const separation = Body.separation(final, Collider.enumerateCollider2DWorldShapes(object)[0]);
    assert(separation >= -2e-4, `penetration ${i}: ${object.id} ${separation} ${JSON.stringify(result)}`);
  }
}
console.log(JSON.stringify({ audit: 'phase-047-step-fuzz', seed: '0x47de57e9', cases, ascents, descents, ceilings, passed: true }));
