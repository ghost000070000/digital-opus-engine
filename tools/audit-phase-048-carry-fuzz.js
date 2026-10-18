'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'qualification', 'phase-048');
fs.mkdirSync(out, { recursive: true });
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ s >>> 15, 1 | s) + 0x6d2b79f5 | 0, ((s ^ s >>> 7) >>> 0) / 4294967296)); }
function actor(id, x, y, velocity, options = {}) { const components = {
  'body-2d': { version: 1, enabled: true, type: options.type || 'kinematic', linearVelocity: velocity.slice() },
  'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: (options.size || [1, 1]).slice() } };
  if (options.character) components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 };
  if (options.platform) components['moving-platform-2d'] = { version: 1, enabled: true };
  if (options.oneWay) components['one-way-platform-2d'] = { version: 1, enabled: true };
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0] }), components }; }
const seeds = Array.from({ length: 20 }, (_, i) => 0x480000 + i * 7919);
let carryOperations = 0, obstructionOperations = 0, supportTransitions = 0, oneWayRelativeCases = 0, mismatches = 0;
for (const seed of seeds) {
  const random = rng(seed);
  for (let i = 0; i < 25000; i++) {
    const vx = (random() * 2 - 1) * 20, vy = (random() * 2 - 1) * 20, dt = .001 + random() * .05;
    const p = actor('platform', 0, 0, [vx, vy], { platform: true, size: [4, .5] });
    const r = actor('rider', (random() * 2 - 1) * 1.4, .75, [0, 0], { character: true });
    const before = { x: r.entity.position.x - p.entity.position.x, y: r.entity.position.y - p.entity.position.y };
    const manager = Body.createBody2DManager(); manager.tick([r, p], dt);
    const after = { x: r.entity.position.x - p.entity.position.x, y: r.entity.position.y - p.entity.position.y };
    if (![p.entity.position.x, p.entity.position.y, r.entity.position.x, r.entity.position.y].every(Number.isFinite) || Math.abs(after.x - before.x) > 1e-7 || Math.abs(after.y - before.y) > 1e-7) mismatches++;
    carryOperations++;
  }
  for (let i = 0; i < 12500; i++) {
    const horizontal = random() < .5, speed = 1 + random() * 50, dt = .01 + random() * .1;
    const p = actor('platform', 0, 0, horizontal ? [speed, 0] : [0, speed], { platform: true, size: [4, .5] });
    const r = actor('rider', 0, .75, [0, 0], { character: true });
    const wall = actor('wall', horizontal ? 2.25 + random() : 0, horizontal ? .75 : 1.75 + random(), [0, 0], { type: 'static', size: horizontal ? [.4, 1] : [4, .4] });
    const manager = Body.createBody2DManager(); const result = manager.tick([r, p, wall], dt).find((entry) => entry.objectId === 'platform').result;
    assert(result.carryFraction >= 0 && result.carryFraction <= 1 && Number.isFinite(result.actualDelta.x) && Number.isFinite(result.actualDelta.y));
    for (const a of Collider.enumerateCollider2DWorldShapes(r)) for (const b of Collider.enumerateCollider2DWorldShapes(wall)) if (Body.separation(a, b) < -Body.CONTACT_EPSILON * 2) mismatches++;
    obstructionOperations++;
  }
  for (let i = 0; i < 12500; i++) {
    const oneWay = random() < .5, p = actor('platform', 0, 0, [(random() * 2 - 1) * 4, (random() * 2 - 1) * 4], { platform: true, oneWay, size: [4, .5] });
    const r = actor('rider', 0, .75, [random() < .2 ? 8 : 0, random() < .2 ? 8 : 0], { character: true });
    const manager = Body.createBody2DManager(); manager.tick([r, p], 1 / 60); const first = manager.getCharacterCollision2DState('rider'); manager.tick([r, p], 1 / 60); const second = manager.getCharacterCollision2DState('rider');
    assert(Object.isFrozen(first) && Object.isFrozen(second) && Array.isArray(second.groundSupportVelocity));
    supportTransitions += 2;
  }
  for (let i = 0; i < 5000; i++) {
    const characterDy = (random() * 2 - 1) * 10, platformDy = (random() * 2 - 1) * 10;
    const relativeDy = characterDy - platformDy;
    assert(Number.isFinite(relativeDy));
    // Upward relative motion must not be classified as a descending landing.
    const descending = relativeDy < 0;
    if (descending !== (characterDy - platformDy < 0)) mismatches++;
    oneWayRelativeCases++;
  }
}
const evidence = { phase: 48, generatedAtUtc: new Date().toISOString(), seeds, carryOperations, obstructionOperations, supportTransitions, oneWayRelativeCases,
  totalOperations: carryOperations + obstructionOperations + supportTransitions + oneWayRelativeCases, mismatches, passed: mismatches === 0 };
fs.writeFileSync(path.join(out, 'phase-048-fuzz.json'), JSON.stringify(evidence, null, 2) + '\n');
if (mismatches) throw new Error(`${mismatches} Phase 048 fuzz mismatches`);
console.log(JSON.stringify(evidence));
