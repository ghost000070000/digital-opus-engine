'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const collider = require('../editor/src/00-collider-2d.js');
const body2d = require('../editor/src/00-body-2d.js');
const ROOT = path.resolve(__dirname, '..'), QUAL = path.join(ROOT, 'qualification', 'phase-043');
const box = (w, h) => ({ version: 1, enabled: true, offset: [0, 0], size: [w, h] });
const circle = (r) => ({ version: 1, enabled: true, offset: [0, 0], radius: r });
const body = (type, velocity = [0, 0]) => ({ version: 1, enabled: true, type, linearVelocity: velocity });
function object(id, x, y, shape, kind, rotation = 0) {
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [x, y, 0], rotation }), components: { 'body-2d': body(kind), [shape.kind === 'box' ? collider.BOX_ID : collider.CIRCLE_ID]: shape.value } };
}
function rng(seed) { let state = seed >>> 0; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; }
function separation(a, b) { return Math.min(...collider.enumerateCollider2DWorldShapes(a).flatMap((left) => collider.enumerateCollider2DWorldShapes(b).map((right) => body2d.separation(left, right)))); }
function shape(random, thin = false) { return random() < .5 ? { kind: 'box', value: box(thin ? .005 + random() * .05 : .2 + random() * 2, .2 + random() * 4) } : { kind: 'circle', value: circle(.1 + random() * 1.5) }; }
function failure(seed, index, m, wall, delta, result, reason) { return { seed, index, reason, mover: { x: m.entity.position.x, y: m.entity.position.y, components: m.components }, wall: { x: wall.entity.position.x, y: wall.entity.position.y, components: wall.components }, delta, result }; }
function main() {
  const report = { phase: 43, status: 'FAIL', seeds: 20, cases: 0, shapePairs: { 'box/box': 0, 'box/circle': 0, 'circle/box': 0, 'circle/circle': 0 }, thinWalls: 0, framePartitions: 0, triggerChecks: 0, failures: [], startedAt: new Date().toISOString() };
  for (let seed = 1; seed <= 20; seed++) {
    const random = rng(seed * 0x9e3779b9);
    for (let i = 0; i < 25100; i++) {
      const moverShape = shape(random), wallShape = shape(random, i % 5 === 0);
      const key = `${moverShape.kind}/${wallShape.kind}`; report.shapePairs[key]++;
      const m = object('mover', 0, 0, moverShape, 'kinematic');
      const wall = object('wall', 2 + random() * 8, (random() - .5) * 8, wallShape, 'static', wallShape.kind === 'box' ? (random() - .5) * 1.4 : 0);
      if (separation(m, wall) < 1e-4) continue;
      const delta = { x: (random() - .1) * (i % 5 === 0 ? 100 : 15), y: (random() - .5) * 12 };
      const wallBefore = wall.worldMatrix.slice(), velocityBefore = m.components['body-2d'].linearVelocity.slice();
      const entry = { object: wall, shapes: collider.enumerateCollider2DWorldShapes(wall) };
      const manager = body2d.createBody2DManager();
      const result = manager.moveKinematicBody2D(m, delta, [entry]);
      const gap = separation(m, wall);
      if (gap < -2e-6 || wallBefore.some((value, index) => value !== wall.worldMatrix[index]) || !Number.isFinite(m.entity.position.x) || !Number.isFinite(m.entity.position.y) || result.actualDelta.x * delta.x < -1e-8 || result.actualDelta.y * delta.y < -1e-8 || Math.abs(result.actualDelta.x) > Math.abs(delta.x) + 1e-8 || Math.abs(result.actualDelta.y) > Math.abs(delta.y) + 1e-8 || JSON.stringify(m.components['body-2d'].linearVelocity) !== JSON.stringify(velocityBefore)) {
        report.failures.push(failure(seed, i, m, wall, delta, result, `gap=${gap}`)); break;
      }
      if (i % 500 === 0) {
        const replay = object('mover', 0, 0, moverShape, 'kinematic');
        const same = body2d.createBody2DManager().moveKinematicBody2D(replay, delta, [entry]);
        if (JSON.stringify(result) !== JSON.stringify(same)) { report.failures.push(failure(seed, i, m, wall, delta, result, 'nondeterministic replay')); break; }
      }
      if (i % 1000 === 0) {
        const split = object('mover', 0, 0, moverShape, 'kinematic'); const splitManager = body2d.createBody2DManager();
        for (let step = 0; step < 8; step++) splitManager.moveKinematicBody2D(split, { x: delta.x / 8, y: delta.y / 8 }, [entry]);
        const splitGap = separation(split, wall);
        if (splitGap < -2e-6) { report.failures.push(failure(seed, i, split, wall, delta, null, `frame partition penetration=${splitGap}`)); break; }
        report.framePartitions++;
      }
      if (i % 5 === 0) report.thinWalls++;
      report.cases++;
    }
    if (report.failures.length) break;
  }
  // Separate Body/Trigger checks use the same final-position rule as the
  // runtime tick: movement is committed before Trigger pair evaluation.
  const trigger = require('../editor/src/00-trigger-collider-2d.js');
  for (let i = 0; i < 1000; i++) {
    const m = object('mover', 0, 0, { kind: 'box', value: box(1, 1) }, 'kinematic');
    const sensor = object('sensor', 2, 0, { kind: 'box', value: box(1, 1) }, 'static');
    sensor.components = { [trigger.COMPONENT_ID]: { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [1, 1], radius: .5 } };
    const events = []; const lifecycle = trigger.createTriggerLifecycle({ emit: (event) => events.push(event.eventType) });
    body2d.createBody2DManager().moveKinematicBody2D(m, { x: 1 + (i % 3) * .5, y: 0 }, []);
    lifecycle.tick([m, sensor]);
    const shouldEnter = collider.enumerateCollider2DWorldShapes(m).some((shape) => collider.overlaps(shape, trigger.resolveTriggerWorldShape(sensor, sensor.components[trigger.COMPONENT_ID])));
    if ((events.includes(trigger.ENTER)) !== shouldEnter) { report.failures.push({ triggerCase: i, reason: 'Body/Trigger final state mismatch' }); break; }
    report.triggerChecks++;
  }
  report.status = report.failures.length ? 'FAIL' : 'PASS'; report.endedAt = new Date().toISOString();
  fs.mkdirSync(QUAL, { recursive: true }); fs.writeFileSync(path.join(QUAL, 'kinematic-fuzz.json'), JSON.stringify(report, null, 2) + '\n');
  assert.strictEqual(report.failures.length, 0, JSON.stringify(report.failures[0]));
  assert(report.cases >= 500000, `only ${report.cases} cases`);
  console.log(`Phase 043 fuzz: ${report.status}; ${report.cases} cases, ${report.framePartitions} partitions, ${report.triggerChecks} Body/Trigger checks`);
}
main();
