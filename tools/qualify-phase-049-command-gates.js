'use strict';
// This records command gates only. Native browser acceptance and the final verdict
// still require a human-readable evidence review; this script cannot grant READY.
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto'), zlib = require('zlib');
const { spawnSync } = require('child_process');
const { fingerprint, files } = require('./phase-049-source-fingerprint.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qualification/phase-049');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const frozen = fingerprint(), post = process.argv.includes('--post');
const proof = { status: 'RUNNING', sourceFingerprint: frozen, startedAtUtc: new Date().toISOString(), gates: [] };
function run(script, args = []) {
  const startedAtUtc = new Date().toISOString();
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  const name = script.replace(/[\\/]/g, '-');
  fs.writeFileSync(path.join(out, `${post ? 'post' : 'pre'}-${name}.log`), (result.stdout || '') + (result.stderr || ''));
  assert.strictEqual(result.status, 0, `${script}: ${result.error || result.stderr || 'failed; see saved log'}`);
  assert.strictEqual(fingerprint(), frozen, 'Product changed during command gates');
  proof.gates.push({ script, args, status: 'PASS', startedAtUtc, endedAtUtc: new Date().toISOString() });
}
try {
  const browser = read('qualification/phase-049/phase-049-browser-campaign.json');
  assert.strictEqual(browser.status, 'PASS'); assert.strictEqual(browser.sourceFingerprint, frozen); assert(browser.cycles.length >= 30); assert(!(browser.browserErrors || []).length);
  assert.strictEqual(read('qualification/phase-049/phase-049-visible-authoring.json').status, 'PASS');
  const exported = read('qualification/phase-049/phase-049-export-proof.json');
  for (const artifact of exported.artifacts) {
    const bytes = fs.readFileSync(path.join(out, 'export-campaign', artifact.file));
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), artifact.sha256, 'Exact export bytes changed');
    assert(browser.cycles.some((cycle) => cycle.file === artifact.file && cycle.status === 'PASS'), `Export not browser-qualified: ${artifact.file}`);
  }
  exported.status = 'BROWSER_QUALIFIED'; exported.sourceFingerprint = frozen; exported.browserEvidence = 'phase-049-browser-campaign.json';
  write('phase-049-export-proof.json', exported);
  if (post) {
    const soak = read('qualification/phase-049/phase-049-soak.json'), state = read('qualification/phase-049/soak-state.json');
    assert.strictEqual(soak.runId, state.runId); assert.strictEqual(soak.status, 'PASS'); assert.strictEqual(soak.sourceFingerprint, frozen);
    assert(soak.activeSeconds >= 3600 && soak.semanticFailures === 0 && soak.memory.length >= 20);
    for (const tier of ['editable', 'playable']) assert(soak.browserCycles.filter((cycle) => cycle.tier === tier).length >= 3);
    for (const milestone of ['start', 'midpoint', 'final']) assert(soak.fingerprints.some((sample) => sample.milestone === milestone && sample.fingerprint === frozen));
    proof.soakRunId = soak.runId;
  }
  run('tests/run-tests.js');
  run('tools/audit-phase-049-filter-fuzz.js'); run('tools/audit-phase-049-portability.js'); run('tools/audit-phase-049-performance.js');
  run('build/build-engine-site.js'); run('build/build-games-site.js');
  run('tools/authoring-friction-report.js', ['--write']); run('tools/build-capability-dashboard.js', ['--write']);
  for (const file of files.filter((file) => file.endsWith('.js'))) run('--check', [file]);
  const catalog = read('games/catalog.json'); assert.strictEqual(catalog.games.length, 28);
  const jsonFiles = ['no-code-capabilities.json', 'authoring-friction.json', 'games/catalog.json', 'qualification/phase-049/phase-049-project.json', ...catalog.games.map((game) => 'games/' + game.file)];
  for (const file of jsonFiles) read(file);
  const diff = spawnSync('git', ['diff', '--check'], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(path.join(out, `${post ? 'post' : 'pre'}-diff-check.log`), (diff.stdout || '') + (diff.stderr || ''));
  assert.strictEqual(diff.status, 0, 'Whitespace errors in diff');
  const engine = fs.readFileSync(path.join(root, 'dist/opus-engine.js'));
  proof.engine = { rawBytes: engine.length, gzipBytes: zlib.gzipSync(engine).length, baselineRawBytes: 168984, baselineGzipBytes: 43457 };
  proof.publicGameCount = 28; proof.jsonValidated = jsonFiles; proof.status = post ? 'POST_COMMAND_GATES_PASS' : 'PRE_SOAK_COMMAND_GATES_PASS';
  proof.endedAtUtc = new Date().toISOString(); write(post ? 'phase-049-post-command-gates.json' : 'phase-049-pre-soak-gates.json', proof);
  console.log(JSON.stringify({ status: proof.status, sourceFingerprint: frozen, gates: proof.gates.length }));
} catch (error) {
  proof.status = 'FAIL'; proof.error = error.stack; write(post ? 'phase-049-post-command-gates.json' : 'phase-049-pre-soak-gates.json', proof); console.error(error.stack); process.exitCode = 1;
}
