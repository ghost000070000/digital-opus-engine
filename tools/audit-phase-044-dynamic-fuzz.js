'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Trigger = require('../editor/src/00-trigger-collider-2d.js');
const { createPrototype } = require('./phase-044-dynamic-prototype.js');
const ROOT = path.resolve(__dirname, '..');
const box = (w, h) => ({ version: 1, enabled: true, offset: [0, 0], size: [w, h] });
const circle = (r) => ({ version: 1, enabled: true, offset: [0, 0], radius: r });
const body = (type, velocity = [0, 0]) => ({ version: 1, enabled: true, type, linearVelocity: velocity });
function object(id, x, y, shape, type, rotation = 0) { return { id, kind: 'cube', rotation, entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0], rotation }), components: { 'body-2d': body(type), [shape.kind === 'box' ? Collider.BOX_ID : Collider.CIRCLE_ID]: shape.value } }; }
function rng(seed) { let state = seed >>> 0; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; }
function shape(random, thin = false) { return random() < .5 ? { kind: 'box', value: box(thin ? .005 + random() * .05 : .2 + random() * 2, .2 + random() * 4) } : { kind: 'circle', value: circle(.1 + random() * 1.5) }; }
function minSeparation(a, b) { return Math.min(...Collider.enumerateCollider2DWorldShapes(a).flatMap((left) => Collider.enumerateCollider2DWorldShapes(b).map((right) => Body.separation(left, right)))); }
function capTrace(seed, index, m, wall, velocity, gravity, dt, result, caps, pair, finalGap) { return { seed, index, pair, moverStart: { x: 0, y: 0 }, moverFinal: { x: m.entity.position.x, y: m.entity.position.y }, moverCollider: m.components[Collider.BOX_ID] || m.components[Collider.CIRCLE_ID], wall: { x: wall.entity.position.x, y: wall.entity.position.y, rotation: wall.rotation, collider: wall.components[Collider.BOX_ID] || wall.components[Collider.CIRCLE_ID] }, velocity, gravity, dt, requestedDelta: result.requestedDelta, actualDelta: result.move.actualDelta, blockedX: result.move.blockedX, blockedY: result.move.blockedY, finalGap, caps }; }
function main() {
  const report = { phase: 44, status: 'FAIL', productSchemaChanged: false, seeds: 20, movementCases: 0, shapePairs: { 'box/box': 0, 'box/circle': 0, 'circle/box': 0, 'circle/circle': 0 }, capByShapePair: { 'box/box': 0, 'box/circle': 0, 'circle/box': 0, 'circle/circle': 0 }, thinWallCases: 0, deterministicReplays: 0, framePartitions: 0, parentCases: 0, restBodies: 0, restTicks: 0, restCapHits: 0, triggerChecks: 0, cappedSweeps: 0, capExamples: [], failures: [], startedAt: new Date().toISOString() };
  for (let seed = 1; seed <= 20; seed++) {
    const random = rng(seed * 0x9e3779b9);
    for (let index = 0; index < 25100; index++) {
      const a = shape(random), b = shape(random, index % 5 === 0), rotation = b.kind === 'box' ? (random() - .5) * 1.4 : 0;
      const m = object('mover', 0, 0, a, 'kinematic'), wall = object('wall', 2 + random() * 8, (random() - .5) * 8, b, 'static', rotation);
      if (minSeparation(m, wall) < 1e-4) continue;
      const velocity = [(random() - .1) * (index % 5 === 0 ? 800 : 120), (random() - .5) * 120];
      const gravity = [(random() - .5) * 30, (random() - .5) * 30], dt = .02 + random() * .08;
      const wallBefore = wall.worldMatrix.slice(), p = createPrototype(m, { initialVelocity: velocity, gravity });
      const result = p.step(dt, [wall]), gap = minSeparation(m, wall);
      report.shapePairs[`${a.kind}/${b.kind}`]++;
      if (index % 5 === 0) report.thinWallCases++;
      if (p.manager.metrics.cappedSweeps) { report.cappedSweeps += p.manager.metrics.cappedSweeps; report.capByShapePair[`${a.kind}/${b.kind}`] += p.manager.metrics.cappedSweeps; if (report.capExamples.length < 100) report.capExamples.push(capTrace(seed, index, m, wall, velocity, gravity, dt, result, p.manager.metrics.cappedSweeps, `${a.kind}/${b.kind}`, gap)); }
      if (gap < -2e-6 || wall.worldMatrix.some((value, i) => value !== wallBefore[i]) || !Number.isFinite(m.entity.position.x) || !Number.isFinite(m.entity.position.y) || p.velocity.some((value) => !Number.isFinite(value))) { report.failures.push({ seed, index, gap, velocity, gravity, dt, result }); break; }
      if (index % 1000 === 0) {
        const replay = object('mover', 0, 0, a, 'kinematic'), q = createPrototype(replay, { initialVelocity: velocity, gravity }), same = q.step(dt, [wall]);
        if (JSON.stringify(result) !== JSON.stringify(same)) { report.failures.push({ seed, index, reason: 'nondeterministic replay' }); break; }
        report.deterministicReplays++;
      }
      report.movementCases++;
    }
    if (report.failures.length) break;
  }
  for (let i = 0; i < 2000 && !report.failures.length; i++) {
    const m = object('rest-mover', 0, 2 + i % 3, { kind: i % 2 ? 'circle' : 'box', value: i % 2 ? circle(.5) : box(1, 1) }, 'kinematic');
    const wall = object('rest-floor', 0, -1, { kind: 'box', value: box(20, .2) }, 'static');
    const p = createPrototype(m, { gravity: [0, -9.81] });
    for (let step = 0; step < 120; step++) { p.step(.1, [wall]); report.restTicks++; }
    report.restBodies++; report.restCapHits += p.manager.metrics.cappedSweeps;
    if (minSeparation(m, wall) < -2e-6 || Math.abs(p.velocity[1]) > 1e-8) { report.failures.push({ restBody: i, y: m.entity.position.y, vy: p.velocity[1] }); break; }
  }
  for (let i = 0; i < 1000 && !report.failures.length; i++) {
    const m = object('partition-mover', 0, 4 + i % 3, { kind: 'circle', value: circle(.5) }, 'kinematic');
    const n = object('partition-mover', 0, 4 + i % 3, { kind: 'circle', value: circle(.5) }, 'kinematic');
    const wall = object('partition-floor', 0, -1, { kind: 'box', value: box(20, .2) }, 'static');
    const a = createPrototype(m), b = createPrototype(n);
    for (let step = 0; step < 10; step++) a.step(.1, [wall]);
    for (let step = 0; step < 20; step++) b.step(.05, [wall]);
    if (Math.abs(m.entity.position.y - n.entity.position.y) > 2e-5 || minSeparation(m, wall) < -2e-6 || minSeparation(n, wall) < -2e-6) { report.failures.push({ partitionCase: i, yA: m.entity.position.y, yB: n.entity.position.y }); break; }
    report.framePartitions++;
  }
  for (let i = 0; i < 1000 && !report.failures.length; i++) {
    const m = object('parented', 0, 0, { kind: 'box', value: box(.5, .5) }, 'kinematic');
    const angle = i * .031, sx = i % 2 ? -2 : 2, sy = 1.5, local = { x: 0, y: 0 };
    const translateWorld = (object, delta) => {
      if (i % 101 === 0) return false;
      const c = Math.cos(angle), s = Math.sin(angle), dx = (c * delta.x + s * delta.y) / sx, dy = (-s * delta.x + c * delta.y) / sy;
      local.x += dx; local.y += dy;
      object.entity.position.x = c * sx * local.x - s * sy * local.y;
      object.entity.position.y = s * sx * local.x + c * sy * local.y;
      object.worldMatrix[12] = object.entity.position.x; object.worldMatrix[13] = object.entity.position.y;
      return true;
    };
    const p = createPrototype(m, { gravity: [0, -9.81], translateWorld });
    const r = p.step(.1);
    if (!Number.isFinite(m.entity.position.x) || !Number.isFinite(m.entity.position.y) || (i % 101 !== 0 && (Math.abs(m.entity.position.x - r.requestedDelta.x) > 1e-8 || Math.abs(m.entity.position.y - r.requestedDelta.y) > 1e-8)) || (i % 101 === 0 && p.rejectedTranslations !== 1)) { report.failures.push({ parentCase: i, r }); break; }
    report.parentCases++;
  }
  for (let i = 0; i < 1000 && !report.failures.length; i++) {
    const m = object('trigger-mover', 0, 0, { kind: 'box', value: box(1, 1) }, 'kinematic');
    const sensor = object('sensor', 2, 0, { kind: 'box', value: box(1, 1) }, 'static');
    sensor.components = { [Trigger.COMPONENT_ID]: { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [1, 1], radius: .5 } };
    const events = [], lifecycle = Trigger.createTriggerLifecycle({ emit: (event) => events.push(event.eventType) });
    const p = createPrototype(m, { initialVelocity: [10 + i % 10, 0], gravity: [0, 0] });
    p.step(.1, [], () => lifecycle.tick([m, sensor]));
    const overlap = Collider.enumerateCollider2DWorldShapes(m).some((shape) => Collider.overlaps(shape, Trigger.resolveTriggerWorldShape(sensor, sensor.components[Trigger.COMPONENT_ID])));
    if (events.includes(Trigger.ENTER) !== overlap) { report.failures.push({ triggerCase: i, events, overlap }); break; }
    report.triggerChecks++;
  }
  report.status = report.failures.length ? 'FAIL' : 'PASS'; report.endedAt = new Date().toISOString();
  fs.writeFileSync(path.join(ROOT, 'phase-044-dynamic-fuzz.json'), JSON.stringify(report, null, 2) + '\n');
  assert.strictEqual(report.failures.length, 0, JSON.stringify(report.failures[0]));
  assert(report.movementCases >= 500000, `only ${report.movementCases} cases`);
  console.log(`Phase 044 Dynamic fuzz: ${report.status}; ${report.movementCases} cases; ${report.cappedSweeps} caps; ${report.restCapHits} rest caps`);
}
main();
