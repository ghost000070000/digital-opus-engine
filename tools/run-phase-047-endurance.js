'use strict';
// Fresh, active four-hour Phase 047 qualification. Every audit is a real
// deterministic workload; no unattended sleep is counted as progress.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { performance } = require('perf_hooks');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Slope = require('../editor/src/00-character-slope-2d.js');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'qualification', 'phase-047');
const smoke = process.argv.includes('--smoke');
const targetActiveMs = smoke ? 10000 : 14430000;
const statePath = path.join(outDir, smoke ? 'endurance-smoke.json' : 'endurance-state.json');
const finalPath = path.join(outDir, smoke ? 'endurance-smoke-result.json' : 'phase-047-endurance.json');
const productFiles = [
  ...fs.readdirSync(path.join(root, 'editor', 'src')).filter((name) => name.endsWith('.js')).map((name) => `editor/src/${name}`),
  'editor/index.html', 'build/build-engine-site.js', 'build/build-games-site.js', 'build/build-games.js',
  'build/export-template.js', 'no-code-capabilities.json', 'authoring-friction.json',
].sort();
function fingerprint() { const hash = crypto.createHash('sha256'); for (const file of productFiles) { hash.update(file); hash.update('\0'); hash.update(fs.readFileSync(path.join(root, file))); hash.update('\0'); } return hash.digest('hex'); }
const runId = `phase-047-endurance-${new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z')}`;
const startedAtUtc = new Date().toISOString();
const sourceStart = fingerprint();
const metrics = { geometryCases: 0, triangleComparisons: 0, slopeMoves: 0, stepCases: 0, tileQueryComparisons: 0,
  tileCandidates: 0, tileCollisionCells: 0, focusedRuns: 0, triggerRuns: 0, chunkRuns: 0, bundleRuns: 0,
  exportBuilds: 0, inProcessRampMoves: 0, groundedTicks: 0, slopeGroundedTicks: 0, browserCycles: 0 };
const state = { runId, startedAtUtc, status: 'ACTIVE', targetActiveMs, activeMs: 0, excludedPauseMs: 0,
  sourceFingerprintStart: sourceStart, sourceFingerprintMidpoint: null, sourceFingerprintFinal: null,
  midpointAtUtc: null, threeHourAtUtc: null, cycle: 0, metrics, memoryObservations: [], failures: [] };
let nextHeartbeatMs = 900000, lastHeartbeat = performance.now();
function writeState() { state.updatedAtUtc = new Date().toISOString(); fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n'); }
function checkSource() { const current = fingerprint(); if (current !== sourceStart) throw new Error(`Product-source fingerprint changed: ${sourceStart} -> ${current}`); }
function recordMemory(label) { const usage = process.memoryUsage(); state.memoryObservations.push({ atUtc: new Date().toISOString(), activeMs: Math.round(state.activeMs), label,
  heapUsed: usage.heapUsed, rss: usage.rss, external: usage.external }); }
function account(started) { const elapsed = performance.now() - started; if (elapsed > 180000) { state.activeMs += 180000; state.excludedPauseMs += elapsed - 180000; }
  else state.activeMs += elapsed; }
function execute(file, args = []) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [path.join(root, file), ...args], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  account(started);
  if (result.error || result.status !== 0) throw new Error(`${file}: ${result.error || result.stderr || result.stdout || `exit ${result.status}`}`);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  const last = lines[lines.length - 1];
  let data = null; try { data = JSON.parse(last); } catch { /* Regression files use human-readable output. */ }
  checkSource(); recordMemory(file);
  return data;
}
function rampProbe() {
  const started = performance.now();
  const angle = Math.PI / 6;
  const ramp = { id: 'ramp', kind: 'cube', entity: { position: { x: 0, y: 0, z: 0 } },
    worldMatrix: Collider.composeMatrix({ position: [0, 0, 0], rotation: angle }), components: {
      'body-2d': { version: 1, enabled: true, type: 'static', linearVelocity: [0, 0] },
      'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [4, 1] } } };
  const surface = Slope.surfaceFromShape(Collider.enumerateCollider2DWorldShapes(ramp)[0], 'ramp');
  const x = -1, y = (surface.planeD - surface.normal.x * x + Math.abs(surface.normal.x) * .5 + surface.normal.y * .5) / surface.normal.y;
  for (let i = 0; i < 1000; i++) {
    const actor = { id: `m${i}`, kind: 'cube', entity: { position: { x, y, z: 0 } },
      worldMatrix: Collider.composeMatrix({ position: [x, y, 0] }), components: {
        'body-2d': { version: 1, enabled: true, type: 'kinematic', linearVelocity: [1, 0] },
        'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [1, 1] },
        'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3,
          slopeHandlingEnabled: true, maxSlopeAngle: 50, stepHandlingEnabled: true, maxStepHeight: .5 } } };
    const manager = Body.createBody2DManager();
    const result = manager.tick([actor, ramp], .1)[0].result;
    const state = manager.getCharacterCollision2DState(actor.id);
    if (Math.abs(result.actualDelta.x - .1) > 1e-5 || !state.grounded || !state.onSlope || state.groundSupportId !== 'ramp')
      throw new Error(`Ramp reference mismatch at ${i}: ${JSON.stringify({ result, state })}`);
    metrics.inProcessRampMoves++; metrics.groundedTicks++; metrics.slopeGroundedTicks++;
  }
  account(started); recordMemory('in-process-ramp');
}
function checkpoint() {
  if (!state.midpointAtUtc && state.activeMs >= 7200000) { state.midpointAtUtc = new Date().toISOString(); state.sourceFingerprintMidpoint = fingerprint(); }
  if (!state.threeHourAtUtc && state.activeMs >= 10800000) state.threeHourAtUtc = new Date().toISOString();
  if (state.activeMs >= nextHeartbeatMs || performance.now() - lastHeartbeat >= 900000) {
    writeState(); console.log(JSON.stringify({ runId, cycle: state.cycle, activeSeconds: Math.floor(state.activeMs / 1000), memoryObservations: state.memoryObservations.length, status: state.status }));
    nextHeartbeatMs += 900000; lastHeartbeat = performance.now();
  }
}
try {
  writeState();
  while (state.activeMs < targetActiveMs) {
    state.cycle++;
    const geometry = execute('tools/audit-phase-047-slope-geometry-fuzz.js', smoke ? ['1000', '500'] : []);
    metrics.geometryCases += geometry.geometryCases; metrics.triangleComparisons += geometry.overlapCases;
    const movement = execute('tools/audit-phase-047-slope-movement-fuzz.js', smoke ? ['1000'] : []);
    metrics.slopeMoves += movement.cases;
    const steps = execute('tools/audit-phase-047-step-fuzz.js', smoke ? ['1000'] : []);
    metrics.stepCases += steps.cases;
    const query = execute('tools/audit-phase-047-slope-tile-query-fuzz.js', smoke ? ['1000'] : []);
    metrics.tileQueryComparisons += query.cases;
    const perf = execute('tools/audit-phase-047-10k-performance.js');
    metrics.tileCandidates += perf.candidateCells; metrics.tileCollisionCells += perf.collisionCells;
    rampProbe();
    execute('tests/phase-047-slopes-steps.test.js'); metrics.focusedRuns++;
    if (state.cycle % 4 === 0 && !smoke) {
      execute('tests/phase-042-trigger-collider.test.js'); metrics.triggerRuns++;
      execute('tests/phase-038-tilemap-chunks.test.js'); metrics.chunkRuns++;
      execute('tests/phase-039-tilemap-bundle-format.test.js'); metrics.bundleRuns++;
      execute('tools/build-phase-047-dogfood.js'); metrics.exportBuilds++;
    }
    checkpoint();
    if (smoke) break;
  }
  checkSource(); state.sourceFingerprintFinal = fingerprint();
  if (!smoke && (state.activeMs < 14400000 || !state.midpointAtUtc || !state.threeHourAtUtc || state.memoryObservations.length < 40))
    throw new Error('Endurance completion criteria were not met');
  state.status = 'COMPLETE'; state.finishedAtUtc = new Date().toISOString(); writeState(); fs.writeFileSync(finalPath, JSON.stringify(state, null, 2) + '\n');
  console.log(JSON.stringify({ runId, status: state.status, activeSeconds: Math.floor(state.activeMs / 1000), cycles: state.cycle,
    memoryObservations: state.memoryObservations.length, fingerprintStable: state.sourceFingerprintFinal === sourceStart }));
} catch (error) {
  state.status = 'FAILED'; state.finishedAtUtc = new Date().toISOString(); state.failures.push({ atUtc: state.finishedAtUtc, message: String(error && error.stack || error) });
  writeState(); fs.writeFileSync(finalPath, JSON.stringify(state, null, 2) + '\n'); console.error(error); process.exitCode = 1;
}
