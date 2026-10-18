'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const evidence = { phase: 39, kind: 'phase-011-through-039-regression', started: new Date().toISOString(), suites: [], passed: 0, total: 0, status: 'FAIL' };
for (let phase = 11; phase <= 39; phase++) {
  const prefix = `phase-${String(phase).padStart(3, '0')}-`;
  const file = fs.readdirSync(path.join(ROOT, 'tests')).find((name) => name.startsWith(prefix) && name.endsWith('.test.js'));
  if (!file) throw new Error(`Missing focused suite for Phase ${phase}`);
  const result = spawnSync(process.execPath, [path.join(ROOT, 'tests', file)], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) { process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || ''); throw new Error(`${file} failed`); }
  const matches = [...String(result.stdout).matchAll(/(\d+)\/(\d+)/g)]; const last = matches[matches.length - 1];
  if (!last) throw new Error(`Could not read count from ${file}`);
  const passed = Number(last[1]); const total = Number(last[2]); if (passed !== total) throw new Error(`${file} reported ${passed}/${total}`);
  evidence.suites.push({ phase, file, passed, total }); evidence.passed += passed; evidence.total += total;
}
evidence.ended = new Date().toISOString(); evidence.status = 'PASS';
fs.mkdirSync(path.join(ROOT, 'qualification', 'phase-039'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'qualification', 'phase-039', 'focused-regression.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`Phase 011–039 regression: ${evidence.passed}/${evidence.total} across ${evidence.suites.length} suites`);
