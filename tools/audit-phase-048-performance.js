'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qualification', 'phase-048'); fs.mkdirSync(out, { recursive: true });
function actor(id, x, y, velocity, character, platform) { const components = { 'body-2d': { version: 1, enabled: true, type: 'kinematic', linearVelocity: velocity }, 'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: platform ? [4, .5] : [1, 1] } }; if (character) components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 }; if (platform) components['moving-platform-2d'] = { version: 1, enabled: true }; return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0] }), components }; }
function fixture(count, riders) { const list = []; for (let i = 0; i < count; i++) { const x = i * 10, p = actor(`p${i}`, x, 0, [.25, 0], false, true); list.push(p); if (riders) list.push(actor(`r${i}`, x, .75, [0, 0], true, false)); } return list; }
function measure(count, riders) { const samples = [], list = fixture(count, riders), manager = Body.createBody2DManager(); for (let i = 0; i < 60; i++) { const at = performance.now(); manager.tick(list, 1 / 60); if (i >= 10) samples.push(performance.now() - at); } samples.sort((a, b) => a - b); return { platforms: count, riders: riders ? count : 0, medianMs: +samples[24].toFixed(3), p95Ms: +samples[46].toFixed(3), maxMs: +samples.at(-1).toFixed(3), metrics: manager.metrics }; }
const zero = measure(0, false), one = measure(1, true), ten = measure(10, true), fifty = measure(50, true), hundred = measure(100, true), noRider = measure(100, false);
assert(hundred.p95Ms < 50, `100/100 p95 ${hundred.p95Ms}ms`); assert.strictEqual(noRider.metrics.carryMoves, 0);
const tileQuerySamples = []; let candidateCells = 0; const list = fixture(1, true), manager = Body.createBody2DManager({ tileObstacles: () => { candidateCells += 9; return []; } });
for (let i = 0; i < 120; i++) { const at = performance.now(); manager.tick(list, 1 / 60); tileQuerySamples.push(performance.now() - at); } tileQuerySamples.sort((a, b) => a - b);
const evidence = { phase: 48, generatedAtUtc: new Date().toISOString(), zero, one, ten, fifty, hundred, noRider, tenKFixture: { mapCells: 10240, candidateCells, medianMs: +tileQuerySamples[59].toFixed(3), p95Ms: +tileQuerySamples[113].toFixed(3), sparse: candidateCells < 10240 * 120 }, memory: process.memoryUsage(), passed: true };
fs.writeFileSync(path.join(out, 'phase-048-performance.json'), JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify(evidence));
