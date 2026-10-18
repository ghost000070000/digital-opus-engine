'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { performance } = require('perf_hooks');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'qualification', 'phase-047');
const expectedFingerprint = '3cfde42145c71a44e90ae37f793db454d3acd3a10e466e250bf46e25a8a293b6';
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

function tail(value, lines = 24) {
  return String(value || '').trim().split(/\r?\n/).slice(-lines).join('\n');
}

const gates = [];
function run(name, file, args = []) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [path.join(root, file), ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const record = {
    name, command: `node ${file}${args.length ? ` ${args.join(' ')}` : ''}`,
    status: result.status === 0 && !result.error ? 'PASS' : 'FAIL',
    exitCode: result.status, durationMs: Math.round(performance.now() - started),
    stdoutTail: tail(result.stdout), stderrTail: tail(result.stderr),
  };
  gates.push(record);
  process.stdout.write(`${record.status} ${name} (${record.durationMs}ms)\n`);
  if (record.status !== 'PASS') throw new Error(`${name} failed: ${record.stderrTail || record.stdoutTail || result.error}`);
  return record;
}

function walk(directory, accept, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    const relative = path.relative(root, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', 'dist'].includes(entry.name)) walk(full, accept, output);
    } else if (accept(relative)) output.push(full);
  }
  return output;
}

function standaloneGate(name, fn) {
  const started = performance.now();
  try {
    const details = fn();
    const record = { name, status: 'PASS', durationMs: Math.round(performance.now() - started), details };
    gates.push(record); process.stdout.write(`PASS ${name} (${record.durationMs}ms)\n`); return record;
  } catch (error) {
    const record = { name, status: 'FAIL', durationMs: Math.round(performance.now() - started), error: String(error.stack || error) };
    gates.push(record); process.stdout.write(`FAIL ${name}\n`); throw error;
  }
}

const startedAtUtc = new Date().toISOString();
const startFingerprint = fingerprint();
const evidence = { startedAtUtc, expectedFingerprint, startFingerprint, gates, status: 'ACTIVE' };

try {
  if (startFingerprint !== expectedFingerprint) throw new Error(`Fingerprint mismatch: ${startFingerprint}`);
  for (let phase = 47; phase >= 31; phase--) {
    const padded = String(phase).padStart(3, '0');
    const match = fs.readdirSync(path.join(root, 'tests')).find((name) => name.startsWith(`phase-${padded}-`) && name.endsWith('.test.js'));
    if (!match) throw new Error(`Missing focused test for Phase ${padded}`);
    run(`Phase ${padded} focused`, `tests/${match}`);
  }
  run('Integrated suite', 'tests/run-tests.js');
  run('Engine build', 'build/build.js');
  run('Public games build', 'build/build-games.js');
  run('Engine site build', 'build/build-engine-site.js');
  run('Games site build', 'build/build-games-site.js');
  run('Public site path/link checks', 'tests/public-site-build.test.js');
  run('Onboarding', 'tests/phase-009-onboarding.test.js');
  run('Editor onboarding stability', 'tests/editor-onboarding-stability.test.js');
  run('Control stabilization', 'tests/game-control-stabilization.test.js');
  run('Collision stabilization', 'tests/game-collision-stabilization.test.js');
  run('Capability dashboard', 'tests/phase-010-capability-dashboard.test.js');
  run('Friction registry', 'tests/phase-004-authoring-friction.test.js');
  run('Final Bundle additive recheck', 'tests/phase-039-tilemap-bundle-format.test.js');
  run('10k Tilemap performance', 'tools/audit-phase-047-10k-performance.js');
  run('Character performance', 'tools/audit-phase-047-character-performance.js');
  run('Final visual and exported-editor recheck', 'tools/run-phase-047-visual-closure.js', ['--repaired']);

  standaloneGate('Retained final visuals', () => {
    const visualDir = path.join(outDir, 'visual-closure');
    const copies = {
      '02-uphill-after.png': 'final-uphill.png',
      '05-tile-slope-after.png': 'final-tile-slope.png',
      '11-stairs-after.png': 'final-stairs.png',
      '14-too-steep-blocked.png': 'final-too-steep.png',
    };
    for (const [source, destination] of Object.entries(copies)) fs.copyFileSync(path.join(visualDir, source), path.join(visualDir, destination));
    return Object.values(copies);
  });

  standaloneGate('Syntax', () => {
    const files = walk(root, (relative) => relative.endsWith('.js') && !relative.startsWith('qualification/'));
    for (const file of files) {
      const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`${path.relative(root, file)}: ${result.stderr}`);
    }
    return { filesChecked: files.length };
  });

  standaloneGate('JSON', () => {
    const files = walk(outDir, (relative) => relative.endsWith('.json'));
    for (const file of files) JSON.parse(fs.readFileSync(file, 'utf8'));
    return { filesParsed: files.length };
  });

  standaloneGate('Diff', () => {
    const result = spawnSync('git', ['diff', '--check'], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stdout || result.stderr);
    return { command: 'git diff --check', output: tail(result.stdout || result.stderr) };
  });

  const finalFingerprint = fingerprint();
  if (finalFingerprint !== expectedFingerprint) throw new Error(`Final fingerprint mismatch: ${finalFingerprint}`);
  evidence.finalFingerprint = finalFingerprint;
  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error.stack || error); evidence.finalFingerprint = fingerprint();
} finally {
  evidence.endedAtUtc = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'phase-047-repaired-post-gates.json'), JSON.stringify(evidence, null, 2) + '\n');
}

if (evidence.status !== 'PASS') { console.error(evidence.error); process.exitCode = 1; }
else console.log(JSON.stringify({ status: evidence.status, gates: gates.length, finalFingerprint: evidence.finalFingerprint }));
