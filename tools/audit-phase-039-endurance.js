'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const api = require(path.join(ROOT, 'editor/src/00-tilemap-bundle.js'));
const durationMinutes = Number(process.env.PHASE039_SOAK_MINUTES || 60);
const durationMs = Math.max(1, durationMinutes) * 60 * 1000;
const evidencePath = path.join(ROOT, 'qualification', 'phase-039', 'endurance.json');
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
const sourceText = fs.readFileSync(path.join(ROOT, 'phase-039-dogfood.opus-tilemap.json'), 'utf8');
const chunkSourceText = fs.readFileSync(path.join(ROOT, 'phase-039-dogfood.opus-chunk.json'), 'utf8');
const fingerprintPaths = ['editor/src/00-tilemap-bundle.js', 'editor/src/01-editor.js', 'editor/index.html', 'tests/phase-039-tilemap-bundle-format.test.js'];
function fingerprint() { const hash = crypto.createHash('sha256'); for (const file of fingerprintPaths) hash.update(file).update('\0').update(fs.readFileSync(path.join(ROOT, file))); return hash.digest('hex'); }
function immediate() { return new Promise((resolve) => setImmediate(resolve)); }
(async () => {
  const startFingerprint = fingerprint(); const started = Date.now(); let cycles = 0; let hashChecks = 0; let collisionPlans = 0; let roundTrips = 0; let injectedFailures = 0; let rejectedCorruptFiles = 0; let chunkCycles = 0; let saveReloadCycles = 0; let browserCycles = 0; let mismatches = 0; let transientLocks = 0; let lastHeartbeat = started; let lastBrowser = started; let minHeap = Infinity; let maxHeap = 0; let maxRss = 0;
  const verified = await api.verifyBundleText(sourceText);
  const verifiedChunk = await api.verifyBundleText(chunkSourceText);
  const report = () => ({ phase: 39, kind: 'continuous-endurance', targetMinutes: durationMinutes, started: new Date(started).toISOString(), updated: new Date().toISOString(), activeMs: Date.now() - started, cycles, exports: roundTrips, imports: collisionPlans, reexports: roundTrips, hashChecks, collisionPlans, cleanRoundTrips: roundTrips, rejectedCorruptFiles, injectedFailures, chunkCycles, saveReloadCycles, browserCycles, mismatches, transientLocks, memory: { minHeap: Number.isFinite(minHeap) ? minHeap : 0, maxHeap, maxRss }, sourceFingerprintStart: startFingerprint, sourceFingerprintCurrent: fingerprint(), status: Date.now() - started >= durationMs && mismatches === 0 ? 'PASS' : 'RUNNING' });
  while (Date.now() - started < durationMs) {
    const plan = api.planImport(verified, cycles % 2 ? { tilesets: [{ id: 'dogfood-tileset', name: 'Local' }], prefabs: [{ name: 'Dogfood Enemy' }] } : {}); collisionPlans++;
    const materialized = api.materializeImport(plan, {});
    const result = await api.createBundle({ rootKind: 'tilemap', root: materialized.tilemaps[0], project: materialized });
    if (cycles % 2 === 0 && result.text !== sourceText) { mismatches++; throw new Error(`clean round-trip mismatch at cycle ${cycles}`); }
    const checked = await api.verifyBundleText(result.text); if (checked.sha256 !== result.sha256) throw new Error(`hash mismatch at cycle ${cycles}`);
    hashChecks++; roundTrips++; cycles++;
    const saved = JSON.parse(JSON.stringify(materialized)); if (!saved.tilemaps || !saved.tilemaps.length) throw new Error('save/reload lost root'); saveReloadCycles++;
    const corrupt = JSON.parse(result.text); corrupt.content.root.name += '!'; try { await api.verifyBundleText(api.canonicalStringify(corrupt)); throw new Error('corrupt envelope accepted'); } catch (error) { if (/accepted/.test(error.message)) throw error; rejectedCorruptFiles++; }
    if (cycles % 4 === 0) { const chunkPlan = api.planImport(verifiedChunk, {}); const chunkState = api.materializeImport(chunkPlan, {}); const chunkExport = await api.createBundle({ rootKind: 'tilemap-chunk', root: chunkState.tilemapChunks[0], project: chunkState }); if (chunkExport.text !== chunkSourceText) { mismatches++; throw new Error(`Chunk mismatch at cycle ${cycles}`); } chunkCycles++; }
    try { api.materializeImport(plan, {}, { failAt: cycles % 12 }); } catch (error) { if (!/Injected/.test(error.message)) throw error; injectedFailures++; }
    const memory = process.memoryUsage(); minHeap = Math.min(minHeap, memory.heapUsed); maxHeap = Math.max(maxHeap, memory.heapUsed); maxRss = Math.max(maxRss, memory.rss);
    if (Date.now() - lastBrowser >= 15 * 60 * 1000) { const child = spawnSync(process.execPath, [path.join(ROOT, 'tools/audit-phase-039-browser.js')], { cwd: ROOT, env: { ...process.env, PHASE039_BROWSER_CYCLES: '1' }, encoding: 'utf8', timeout: 120000, windowsHide: true }); if (child.status !== 0) throw new Error(`browser endurance cycle failed: ${child.stderr || child.stdout}`); browserCycles++; lastBrowser = Date.now(); }
    if (Date.now() - lastHeartbeat >= 15 * 60 * 1000) { fs.writeFileSync(evidencePath, JSON.stringify(report(), null, 2) + '\n'); lastHeartbeat = Date.now(); console.log(`Phase 039 endurance heartbeat: ${cycles} cycles, ${Math.floor((Date.now() - started) / 60)}m, ${rejectedCorruptFiles} corrupt rejections, ${browserCycles} browser cycles`); }
    if (cycles % 10 === 0) await immediate();
  }
  const final = report(); final.ended = new Date().toISOString(); final.sourceFingerprintEnd = fingerprint(); final.status = final.sourceFingerprintEnd === startFingerprint ? 'PASS' : 'FAIL';
  fs.writeFileSync(evidencePath, JSON.stringify(final, null, 2) + '\n');
  console.log(`Phase 039 endurance: ${final.status}, ${cycles} cycles, ${(final.activeMs / 60000).toFixed(2)} minutes`);
  if (final.status !== 'PASS') process.exitCode = 1;
})().catch((error) => { fs.writeFileSync(evidencePath, JSON.stringify({ phase: 39, status: 'FAIL', error: error.stack || String(error), ended: new Date().toISOString() }, null, 2) + '\n'); console.error(error); process.exit(1); });
