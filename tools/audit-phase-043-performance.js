'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const collider = require('../editor/src/00-collider-2d.js');
const body2d = require('../editor/src/00-body-2d.js');
const ROOT = path.resolve(__dirname, '..'), QUAL = path.join(ROOT, 'qualification', 'phase-043');
function object(id, x, y, type, vx) { return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [x, y, 0] }), components: { 'body-2d': { version: 1, enabled: true, type, linearVelocity: [vx, 0] }, [collider.BOX_ID]: { version: 1, enabled: true, offset: [0, 0], size: [1, 1] } } }; }
function fixture(kinematics, statics) { const values = []; for (let i = 0; i < kinematics; i++) values.push(object(`m${i}`, i % 10, Math.floor(i / 10) * 3, 'kinematic', 1)); for (let i = 0; i < statics; i++) values.push(object(`s${i}`, 100 + i % 50 * 3, Math.floor(i / 50) * 3, 'static', 0)); return values; }
function measure(kinematics, statics) {
  const times = [], metrics = [];
  for (let repeat = 0; repeat < 7; repeat++) {
    const objects = fixture(kinematics, statics), manager = body2d.createBody2DManager();
    const before = performance.now(); manager.tick(objects, .1, objects); times.push(Number((performance.now() - before).toFixed(3))); metrics.push({ ...manager.metrics });
  }
  times.sort((a, b) => a - b);
  return { kinematics, statics, minMs: times[0], medianMs: times[3], metrics: metrics[3] };
}
const report = { phase: 43, status: 'PASS', fixtures: [measure(0, 1000), measure(1, 1000), measure(10, 1000), measure(50, 500)], generatedAt: new Date().toISOString() };
assert.strictEqual(report.fixtures[0].metrics.candidates, 0);
assert.strictEqual(report.fixtures[0].metrics.staticShapeResolutions, 0);
assert(report.fixtures[3].medianMs < 50, `50x500 median ${report.fixtures[3].medianMs} ms exceeds 50 ms`);
fs.mkdirSync(QUAL, { recursive: true }); fs.writeFileSync(path.join(QUAL, 'kinematic-performance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
