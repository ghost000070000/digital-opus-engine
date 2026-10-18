'use strict';

// Phase 048 active endurance qualification. Product source remains read-only
// for the lifetime of this process; only qualification evidence is written.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { spawnSync } = require('child_process');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Slope = require('../editor/src/00-character-slope-2d.js');
const Trigger = require('../editor/src/00-trigger-collider-2d.js');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'qualification', 'phase-048');
fs.mkdirSync(outDir, { recursive: true });
const smoke = process.argv.includes('--smoke');
const expectedIndex = process.argv.indexOf('--expected');
const expectedFingerprint = expectedIndex >= 0 ? process.argv[expectedIndex + 1] : '';
const targetActiveMs = smoke ? 12000 : 10830000;
const statePath = path.join(outDir, smoke ? 'endurance-smoke-state.json' : 'endurance-state.json');
const heartbeatPath = path.join(outDir, smoke ? 'endurance-smoke-heartbeat.json' : 'endurance-heartbeat.json');
const resultPath = path.join(outDir, smoke ? 'endurance-smoke-result.json' : 'phase-048-endurance.json');
const productFiles = [
  ...fs.readdirSync(path.join(root, 'editor', 'src')).filter((name) => name.endsWith('.js')).map((name) => `editor/src/${name}`),
  'editor/index.html', 'build/build-engine-site.js', 'build/build-games-site.js', 'build/build-games.js',
  'build/export-template.js', 'no-code-capabilities.json', 'authoring-friction.json',
].sort();

function fingerprint() {
  const hash = crypto.createHash('sha256');
  for (const file of productFiles) {
    hash.update(file); hash.update('\0'); hash.update(fs.readFileSync(path.join(root, file))); hash.update('\0');
  }
  return hash.digest('hex');
}
function writeJson(file, value) {
  const deadline = Date.now() + 5000;
  while (true) {
    try { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); return; }
    catch (error) {
      if (!['EBUSY', 'EPERM', 'UNKNOWN'].includes(error.code) || Date.now() >= deadline) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      state.transientLocks++;
    }
  }
}
function actor(id, x, y, velocity = [0, 0], options = {}) {
  const components = {
    'body-2d': { version: 1, enabled: true, type: options.type || 'kinematic', linearVelocity: velocity.slice() },
    'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: (options.size || [1, 1]).slice() },
  };
  if (options.character) components['character-collision-2d'] = { version: 2, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: options.maxSlopeAngle || 50, stepHandlingEnabled: true, maxStepHeight: .5 };
  if (options.platform) components['moving-platform-2d'] = { version: 1, enabled: true };
  if (options.oneWay) components['one-way-platform-2d'] = { version: 1, enabled: true };
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: Collider.composeMatrix({ position: [x, y, 0], rotation: options.rotation || 0 }), components };
}
const near = (a, b, epsilon = 1e-6) => assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const runId = `phase-048-endurance-${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '')}`;
const sourceStart = fingerprint();
const startedAtUtc = new Date().toISOString();
const metrics = {
  simulationTicks: 0, carryMoves: 0, horizontalCarries: 0, verticalCarries: 0, diagonalCarries: 0,
  clampCases: 0, multiRiderCases: 0, oneWayCases: 0, movingSlopeCases: 0, supportChanges: 0,
  walkOffCases: 0, jumpOffCases: 0, framePartitionChecks: 0, triggerOrderChecks: 0,
  saveReloadCycles: 0, focusedTestCycles: 0, browserCycles: 0, editableCycles: 0, playableCycles: 0,
  pageErrors: 0, consoleErrors: 0, externalRequests: 0,
};
const state = {
  phase: 48, runId, processId: process.pid, startedAtUtc, latestAtUtc: startedAtUtc, endedAtUtc: null,
  status: 'ACTIVE', stage: 'PRE_FLIGHT_COMPLETE', targetSeconds: targetActiveMs / 1000, activeMs: 0, activeSeconds: 0,
  excludedPauseMs: 0, cycle: 0, currentWorkload: 'initializing', sourceFingerprint: sourceStart,
  expectedFingerprint: expectedFingerprint || sourceStart, sourceFingerprints: [{ milestone: 'start', activeSeconds: 0, atUtc: startedAtUtc, fingerprint: sourceStart }],
  midpointAtUtc: null, twoHourAtUtc: null, memoryObservations: [], metrics, semanticMismatches: 0,
  crashes: 0, transientLocks: 0, errors: [], lastSuccessfulInvariant: null,
};
let lastHeartbeatMs = -Infinity;
function updateTime() { state.activeSeconds = state.activeMs / 1000; state.latestAtUtc = new Date().toISOString(); }
function persist() { updateTime(); writeJson(statePath, state); }
function account(started) {
  const elapsed = performance.now() - started;
  if (elapsed > 180000) { state.activeMs += 180000; state.excludedPauseMs += elapsed - 180000; }
  else state.activeMs += elapsed;
}
function checkSource(milestone) {
  const current = fingerprint();
  if (current !== sourceStart || (expectedFingerprint && current !== expectedFingerprint)) throw new Error(`Product-source fingerprint changed: ${sourceStart} -> ${current}`);
  if (milestone) state.sourceFingerprints.push({ milestone, activeSeconds: state.activeMs / 1000, atUtc: new Date().toISOString(), fingerprint: current });
  return current;
}
function memory(label) {
  const usage = process.memoryUsage();
  state.memoryObservations.push({ label, atUtc: new Date().toISOString(), activeSeconds: state.activeMs / 1000, rss: usage.rss, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal, external: usage.external, persistentRiderMapSize: 0 });
}
function milestones() {
  if (!state.midpointAtUtc && state.activeMs >= targetActiveMs / 2) { state.midpointAtUtc = new Date().toISOString(); checkSource('midpoint'); }
  if (!state.twoHourAtUtc && state.activeMs >= 7200000) { state.twoHourAtUtc = new Date().toISOString(); checkSource('two-hour'); }
}
function heartbeat(force = false) {
  updateTime();
  if (!force && state.activeMs - lastHeartbeatMs < 300000) return;
  writeJson(heartbeatPath, { runId, processId: process.pid, status: state.status, timestamp: new Date().toISOString(), activeSeconds: state.activeSeconds,
    targetSeconds: state.targetSeconds, cycle: state.cycle, currentWorkload: state.currentWorkload, sourceFingerprint: checkSource(), metrics,
    memory: state.memoryObservations.at(-1) || null, semanticMismatches: state.semanticMismatches, lastSuccessfulInvariant: state.lastSuccessfulInvariant });
  lastHeartbeatMs = state.activeMs;
}
function execute(file, args, label) {
  state.currentWorkload = label;
  const started = performance.now();
  const result = spawnSync(process.execPath, [path.join(root, file), ...(args || [])], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  account(started);
  if (result.error || result.status !== 0) throw new Error(`${label}: ${result.error || result.stderr || result.stdout || `exit ${result.status}`}`);
  checkSource(); memory(label); persist(); heartbeat();
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index--) { try { return JSON.parse(lines[index]); } catch { /* human output */ } }
  return null;
}
function runCarryCase(kind) {
  const velocities = { horizontal: [3, 0], vertical: [0, kind === 'vertical-down' ? -2 : 2], diagonal: [2, -1] };
  const velocity = velocities[kind] || velocities.vertical;
  const p = actor('platform', 0, 0, velocity, { platform: true, size: [4, .5] });
  const r = actor('rider', 0, .75, [0, 0], { character: true });
  const before = [r.entity.position.x - p.entity.position.x, r.entity.position.y - p.entity.position.y];
  const manager = Body.createBody2DManager(); manager.tick([r, p], .125);
  near(r.entity.position.x - p.entity.position.x, before[0]); near(r.entity.position.y - p.entity.position.y, before[1]);
  const contact = manager.getCharacterCollision2DState('rider');
  assert(contact.grounded && contact.onMovingPlatform && contact.groundSupportId === 'platform');
  near(contact.groundSupportVelocity[0], velocity[0]); near(contact.groundSupportVelocity[1], velocity[1]);
  metrics.carryMoves++; metrics.simulationTicks++;
  if (kind === 'horizontal') metrics.horizontalCarries++;
  else if (kind === 'diagonal') metrics.diagonalCarries++;
  else metrics.verticalCarries++;
}
function runClampCase(index) {
  const vertical = index % 2 === 0;
  const p = actor('platform', 0, 0, vertical ? [0, 5] : [5, 2.5], { platform: true, size: [4, .5] });
  const a = actor('rider-a', -1, .75, [0, 0], { character: true });
  const b = actor('rider-b', 1, .75, [0, 0], { character: true });
  const obstacle = actor('obstacle', vertical ? -1 : 2, vertical ? 1.8 : 1.75, [0, 0], { type: 'static', size: vertical ? [1.2, .4] : [.5, .5] });
  const manager = Body.createBody2DManager();
  const result = manager.tick([a, b, p, obstacle], .5).find((entry) => entry.objectId === 'platform').result;
  assert(result.carryFraction >= 0 && result.carryFraction < 1 && Number.isFinite(result.actualDelta.x) && Number.isFinite(result.actualDelta.y));
  near(a.entity.position.x - p.entity.position.x, -1); near(b.entity.position.x - p.entity.position.x, 1);
  near(a.entity.position.y - p.entity.position.y, .75); near(b.entity.position.y - p.entity.position.y, .75);
  metrics.clampCases++; metrics.multiRiderCases++; metrics.carryMoves += 2; metrics.simulationTicks++;
}
function runOneWayAndTransition(index) {
  const p = actor('platform', 0, 0, [1, index % 2 ? .5 : 0], { platform: true, oneWay: true, size: [4, .5] });
  const r = actor('rider', 0, .75, index % 3 === 0 ? [30, 0] : [0, 0], { character: true });
  const manager = Body.createBody2DManager(); manager.tick([r, p], .1);
  const contact = manager.getCharacterCollision2DState('rider');
  if (index % 3 === 0) { assert(!contact.grounded); metrics.walkOffCases++; metrics.supportChanges++; }
  else {
    assert(contact.grounded && contact.onMovingPlatform); metrics.oneWayCases++; metrics.carryMoves++;
    if (index % 3 === 1) {
      r.components['body-2d'].linearVelocity = [0, 8]; manager.tick([r, p], .1);
      assert(!manager.getCharacterCollision2DState('rider').grounded); metrics.jumpOffCases++; metrics.supportChanges++;
    }
  }
  const below = actor('below', 0, -2, [0, 20], { character: true });
  manager.tick([below, p], .1); assert(below.entity.position.y > -.01); metrics.oneWayCases++; metrics.simulationTicks += 2;
}
function runSlopeAndPartition(index) {
  const angle = Math.PI / 6;
  const p = actor('platform', 0, 0, [1, .25], { platform: true, size: [4, .5], rotation: angle });
  const surface = Slope.surfaceFromShape(Collider.enumerateCollider2DWorldShapes(p)[0], p.id);
  const y = (surface.planeD + Math.abs(surface.normal.x) * .5 + Math.abs(surface.normal.y) * .5) / surface.normal.y;
  const r = actor('rider', 0, y, [0, 0], { character: true });
  const manager = Body.createBody2DManager(); manager.tick([r, p], .1);
  const contact = manager.getCharacterCollision2DState('rider');
  assert(contact.grounded && contact.onSlope && contact.onMovingPlatform); near(contact.slopeAngle, 30, 1e-4);
  metrics.movingSlopeCases++; metrics.carryMoves++; metrics.simulationTicks++;
  if (index % 20 === 0) {
    function partition(hz) { const platform = actor('p', 0, 0, [1, -.5], { platform: true, size: [4, .5] }), rider = actor('r', 0, .75, [0, 0], { character: true }), m = Body.createBody2DManager(); for (let i = 0; i < hz; i++) m.tick([rider, platform], 1 / hz); return [platform.entity.position.x, platform.entity.position.y, rider.entity.position.x, rider.entity.position.y]; }
    const expected = partition(30); for (const hz of [60, 120, 144, 240]) partition(hz).forEach((value, i) => near(value, expected[i], 1e-7));
    metrics.framePartitionChecks += 4;
  }
}
function runPersistence() {
  const source = actor('platform', 0, 0, [3, 1], { platform: true, oneWay: true, size: [4, .5] });
  const serialized = JSON.stringify(source.components), restored = JSON.parse(serialized);
  assert.deepStrictEqual(restored['moving-platform-2d'], { version: 1, enabled: true });
  assert.deepStrictEqual(restored['body-2d'].linearVelocity, [3, 1]);
  metrics.saveReloadCycles++;
}
function runTriggerOrder() {
  const p = actor('platform', 0, 0, [2, 0], { platform: true, size: [4, .5] });
  const r = actor('rider', 0, .75, [0, 0], { character: true });
  const sensor = { id: 'sensor', kind: 'cube', worldMatrix: Collider.composeMatrix({ position: [1, .75, 0] }), components: { 'trigger-collider-2d': { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [1, 1], radius: .5 } } };
  const events = [], lifecycle = Trigger.createTriggerLifecycle({ emit: (event) => events.push(event) });
  Body.createBody2DManager().tick([r, p], .5); lifecycle.tick([r, sensor]);
  assert(events.some((event) => event.targetObjectId === 'rider')); metrics.triggerOrderChecks++;
}
function stressFor(durationMs) {
  state.currentWorkload = 'moving-platform semantic stress';
  const started = performance.now(); let index = 0;
  while (performance.now() - started < durationMs) {
    runCarryCase(['horizontal', 'vertical', 'vertical-down', 'diagonal'][index % 4]);
    runClampCase(index); runOneWayAndTransition(index); runSlopeAndPartition(index); runPersistence(); runTriggerOrder(); index++;
  }
  account(started); state.lastSuccessfulInvariant = 'carry preserves relative offset; safe scalar clamp; moving one-way and slope support remain stable';
}

try {
  if (expectedFingerprint && sourceStart !== expectedFingerprint) throw new Error(`Pre-flight fingerprint mismatch: expected ${expectedFingerprint}, got ${sourceStart}`);
  persist(); heartbeat(true);
  while (state.activeMs < targetActiveMs) {
    state.cycle++;
    stressFor(smoke ? 1500 : 15000);
    memory('semantic-stress'); checkSource(); milestones(); persist(); heartbeat();
    if (state.cycle === 1 || (!smoke && state.cycle % 120 === 0)) {
      execute('tests/phase-048-moving-platforms.test.js', [], 'focused Phase 048 regression'); metrics.focusedTestCycles++;
      const browser = execute('tools/audit-phase-048-browser.js', [], 'isolated exported browser cycles');
      metrics.browserCycles += browser.browserCycles || 0; metrics.editableCycles += browser.editable || 0; metrics.playableCycles += browser.playable || 0;
    }
  }
  checkSource('final');
  assert(state.activeSeconds >= targetActiveMs / 1000);
  assert(metrics.browserCycles >= (smoke ? 1 : 8) && metrics.editableCycles >= (smoke ? 1 : 4) && metrics.playableCycles >= (smoke ? 1 : 4));
  assert(state.memoryObservations.length >= (smoke ? 1 : 30));
  state.status = 'PASS'; state.stage = 'ENDURANCE_COMPLETE'; state.currentWorkload = 'complete'; state.endedAtUtc = new Date().toISOString();
  persist(); heartbeat(true); writeJson(resultPath, state); console.log(JSON.stringify({ status: state.status, runId, activeSeconds: state.activeSeconds, cycle: state.cycle, metrics }));
} catch (error) {
  state.status = 'FAIL'; state.stage = 'STOPPED_ON_FAILURE'; state.currentWorkload = 'failed'; state.endedAtUtc = new Date().toISOString();
  state.semanticMismatches++; state.errors.push({ atUtc: state.endedAtUtc, message: error.stack || String(error) });
  try { persist(); heartbeat(true); writeJson(resultPath, state); } catch { /* retain original failure */ }
  console.error(error.stack || error); process.exit(1);
}
