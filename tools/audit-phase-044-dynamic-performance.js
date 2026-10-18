'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const Collider = require('../editor/src/00-collider-2d.js');
const { createPrototype } = require('./phase-044-dynamic-prototype.js');
const ROOT = path.resolve(__dirname, '..');
const box = (size = [1, 1]) => ({ version: 1, enabled: true, offset: [0, 0], size });
const body = (type) => ({ version: 1, enabled: true, type, linearVelocity: [0, 0] });
function object(id, x, y, type, size = [1, 1]) { return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0] }), components: { 'body-2d': body(type), [Collider.BOX_ID]: box(size) } }; }
function fixture(dynamicCount, staticCount, resting = false) {
  const statics = Array.from({ length: staticCount }, (_, i) => resting ? object(`floor${i}`, i * 4, -1, 'static', [2, .2]) : object(`wall${i}`, 100 + i * 4, 0, 'static'));
  const entries = statics.map((entry) => ({ object: entry, shapes: Collider.enumerateCollider2DWorldShapes(entry) }));
  const dynamic = Array.from({ length: dynamicCount }, (_, i) => { const mover = object(`dynamic${i}`, resting ? i * 4 : i % 10, resting ? -.4 : 0, 'kinematic'); return createPrototype(mover, { gravity: [0, -9.81] }); });
  for (let i = 0; i < 5; i++) for (const p of dynamic) p.step(1 / 60, [], null, entries);
  const samples = [];
  for (let i = 0; i < 15; i++) { const start = performance.now(); for (const p of dynamic) p.step(1 / 60, [], null, entries); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  const metrics = dynamic.reduce((out, p) => { for (const key of ['candidates', 'broadRejects', 'narrowTests', 'sweeps', 'cappedSweeps']) out[key] += p.manager.metrics[key]; return out; }, { candidates: 0, broadRejects: 0, narrowTests: 0, sweeps: 0, cappedSweeps: 0 });
  return { dynamics: dynamicCount, statics: staticCount, resting, minMs: +samples[0].toFixed(3), medianMs: +samples[7].toFixed(3), maxMs: +samples.at(-1).toFixed(3), metrics };
}
const report = { phase: 44, status: 'FAIL', phase043ReferenceMedianMs: { '1x1000': 9.112, '10x1000': 13.812, '50x500': 8.924 }, fixtures: [fixture(1, 1000), fixture(10, 1000), fixture(50, 500), fixture(100, 100, true)], generatedAt: new Date().toISOString() };
report.status = report.fixtures[2].medianMs < 50 && report.fixtures[3].medianMs < 50 && report.fixtures[3].metrics.cappedSweeps === 0 ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(ROOT, 'phase-044-dynamic-performance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
assert.strictEqual(report.status, 'PASS');
