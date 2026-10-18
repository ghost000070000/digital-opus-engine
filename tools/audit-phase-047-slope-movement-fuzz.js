'use strict';
const assert = require('assert');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Slope = require('../editor/src/00-character-slope-2d.js');
let seed = 0x47aabbcc;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function between(a, b) { return a + (b - a) * random(); }
function actor(id, x, y, size, velocity, type, rotation = 0, character = false) {
  const components = { 'body-2d': { version: 1, enabled: true, type, linearVelocity: velocity },
    'box-collider-2d': { version: 1, enabled: true, size, offset: [0, 0] } };
  if (character) components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: true,
    wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 };
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0], rotation }), components };
}
const cases = Number(process.argv[2]) || 500000;
let grounded = 0, steep = 0, slopeFollow = 0;
for (let i = 0; i < cases; i++) {
  const angle = between(-1.02, 1.02), width = between(2, 10), height = between(.2, 1.5);
  const ramp = actor('ramp', 0, 0, [width, height], [0, 0], 'static', angle);
  const surface = Slope.surfaceFromShape(Collider.enumerateCollider2DWorldShapes(ramp)[0], 'ramp');
  const moverSize = [between(.2, 1.2), between(.3, 1.7)];
  const x = between(surface.p0.x + moverSize[0] * .5, surface.p1.x - moverSize[0] * .5);
  const n = surface.normal;
  const y = (surface.planeD - n.x * x + Math.abs(n.x) * moverSize[0] / 2 + n.y * moverSize[1] / 2) / n.y;
  const dx = between(-1.2, 1.2), dy = random() < .25 ? between(-1.2, 0) : 0;
  const character = actor('m', x, y, moverSize, [dx, dy], 'kinematic', 0, true);
  const before = Collider.enumerateCollider2DWorldShapes(character)[0];
  const obstacle = Collider.enumerateCollider2DWorldShapes(ramp)[0];
  if (Body.separation(before, obstacle) < -1e-5) continue; // Reject illegal initial corner geometry.
  const manager = Body.createBody2DManager();
  const result = manager.tick([character, ramp], 1)[0].result;
  const after = Collider.enumerateCollider2DWorldShapes(character)[0];
  const penetration = Body.separation(after, obstacle);
  assert(penetration >= -2e-4, `case ${i}: penetration=${penetration} angle=${angle} dx=${dx} dy=${dy} result=${JSON.stringify(result)}`);
  assert(Number.isFinite(result.actualDelta.x) && Number.isFinite(result.actualDelta.y));
  const state = manager.getCharacterCollision2DState('m');
  if (state.grounded) {
    grounded++;
    if (state.onSlope) {
      slopeFollow++;
      assert(state.groundNormal && Math.abs(Math.hypot(...state.groundNormal) - 1) < 1e-7);
      assert(Math.abs(state.slopeAngle - surface.angle) < 1e-5);
      assert(Slope.supportGap([after], surface) <= 5e-4);
    }
  }
  if (surface.angle > 50) { steep++; assert(!state.onSlope); }
}
console.log(JSON.stringify({ audit: 'phase-047-slope-movement', seed: '0x47aabbcc', cases, grounded, slopeFollow, steep, passed: true }));
