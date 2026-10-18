'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), { spawnSync } = require('child_process'), { performance } = require('perf_hooks');
const { fingerprint, files } = require('./phase-049-source-fingerprint.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qualification/phase-049');
const smoke = process.argv.includes('--smoke'), expectedArg = process.argv.indexOf('--expected'), expected = expectedArg < 0 ? null : process.argv[expectedArg + 1];
const prefix = smoke ? 'soak-smoke' : 'soak', statePath = path.join(out, `${prefix}-state.json`), resultPath = path.join(out, smoke ? 'soak-smoke-result.json' : 'phase-049-soak.json');
const startingFingerprint = fingerprint(); if (expected) assert.strictEqual(startingFingerprint, expected, 'Unexpected product source');
if (!smoke && fs.existsSync(statePath)) {
  const previous = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (previous.status === 'RUNNING') { let alive = false; try { process.kill(previous.pid, 0); alive = true; } catch (_) {} assert(!alive, 'Existing runner is alive; refusing duplicate'); }
}
const startedAtUtc = new Date().toISOString();
const state = { runId: `phase-049-soak-${startedAtUtc.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`, pid: process.pid, status: 'RUNNING', startedAtUtc, requiredActiveSeconds: smoke ? 10 : 3600, activeSeconds: 0, cycles: 0, completedWorkloads: 0, semanticFailures: 0, sourceFingerprint: startingFingerprint, sourceFiles: files, fingerprints: [{ milestone: 'start', activeSeconds: 0, fingerprint: startingFingerprint }], memory: [], browserCycles: [], workloadCounts: {}, latestWorkload: null };
function write(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function browserEvidence() {
  const observations = [];
  for (const name of fs.readdirSync(out).filter((name) => /^soak-browser-checkpoint-.*\.json$/.test(name))) {
    const report = JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
    if (report.runId !== state.runId || report.sourceFingerprint !== state.sourceFingerprint) continue;
    for (const cycle of report.cycles || []) {
      assert.strictEqual(cycle.status, 'PASS', 'In-run browser semantic failure');
      assert(new Date(cycle.cycleStartedAtUtc) >= new Date(startedAtUtc), 'Browser cycle predates run');
      assert(new Date(cycle.observedAtUtc) <= new Date(), 'Browser cycle has a future timestamp');
      if (!observations.some((prior) => prior.cycleStartedAtUtc === cycle.cycleStartedAtUtc && prior.file === cycle.file)) observations.push(cycle);
    }
    assert(!(report.browserErrors || []).length, 'Browser errors invalidate soak');
  }
  return observations;
}
function persist() {
  assert.strictEqual(fingerprint(), state.sourceFingerprint, 'Product source changed during qualification');
  state.browserCycles = browserEvidence(); state.updatedAtUtc = new Date().toISOString();
  state.memory.push({ activeSeconds: state.activeSeconds, atUtc: state.updatedAtUtc, ...process.memoryUsage() });
  write(statePath, state); write(path.join(out, `${prefix}-heartbeat.json`), { runId: state.runId, pid: state.pid, status: state.status, activeSeconds: state.activeSeconds, completedWorkloads: state.completedWorkloads, cycles: state.cycles, sourceFingerprint: state.sourceFingerprint, updatedAtUtc: state.updatedAtUtc, browserCycles: state.browserCycles.length });
}
function run(file, args = []) {
  state.latestWorkload = { file, startedAtUtc: new Date().toISOString() }; persist();
  const start = performance.now(); const result = spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  const elapsed = performance.now() - start; state.activeSeconds += elapsed / 1000;
  assert.strictEqual(result.status, 0, `${file}: ${result.error || result.stderr || result.stdout.slice(-4000)}`);
  state.completedWorkloads++; state.workloadCounts[file] = (state.workloadCounts[file] || 0) + 1;
  state.latestWorkload = { file, elapsedSeconds: elapsed / 1000, completedAtUtc: new Date().toISOString() }; persist();
  if (state.activeSeconds >= state.requiredActiveSeconds / 2 && !state.fingerprints.some((sample) => sample.milestone === 'midpoint')) state.fingerprints.push({ milestone: 'midpoint', activeSeconds: state.activeSeconds, fingerprint: fingerprint() });
}
try {
  if (!smoke) {
    for (const name of ['phase-049-filter-fuzz.json', 'phase-049-portability.json', 'phase-049-performance.json', 'phase-049-browser-campaign.json', 'phase-049-visible-authoring.json']) assert.strictEqual(JSON.parse(fs.readFileSync(path.join(out, name), 'utf8')).status, 'PASS', `Pre-soak gate not passed: ${name}`);
    const browser = JSON.parse(fs.readFileSync(path.join(out, 'phase-049-browser-campaign.json'), 'utf8')); assert(browser.cycles.length >= 30, 'Need 30 pre-soak browser cycles');
    assert.strictEqual(browser.sourceFingerprint, startingFingerprint, 'Browser campaign must qualify this frozen product');
    assert(!(browser.browserErrors || []).length, 'Pre-soak browser errors');
  }
  persist();
  while (true) {
    state.cycles++;
    run('tests/phase-049-collision-filtering.test.js');
    run('tools/audit-phase-049-filter-fuzz.js', smoke ? ['--smoke'] : []);
    run('tools/audit-phase-049-portability.js'); run('tools/audit-phase-049-performance.js');
    if (state.cycles % 4 === 0) { run('tests/phase-048-moving-platforms.test.js'); run('tests/phase-047-slopes-steps.test.js'); run('tests/phase-046-one-way-platforms.test.js'); }
    const browsersReady = smoke || ['editable', 'playable'].every((tier) => state.browserCycles.filter((cycle) => cycle.tier === tier).length >= 3);
    if (state.activeSeconds >= state.requiredActiveSeconds && browsersReady && (smoke || state.memory.length >= 20)) break;
  }
  state.fingerprints.push({ milestone: 'final', activeSeconds: state.activeSeconds, fingerprint: fingerprint() });
  state.status = 'PASS'; state.endedAtUtc = new Date().toISOString(); persist(); write(resultPath, state); console.log(JSON.stringify({ status: state.status, runId: state.runId, activeSeconds: state.activeSeconds, cycles: state.cycles }));
} catch (error) { state.status = 'FAIL'; state.semanticFailures++; state.error = error.stack; state.endedAtUtc = new Date().toISOString(); write(statePath, state); write(resultPath, state); console.error(error.stack); process.exitCode = 1; }
