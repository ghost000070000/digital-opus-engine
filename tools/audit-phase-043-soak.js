'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), QUAL = path.join(ROOT, 'qualification', 'phase-043'), port = '8887';
const minutes = Number(process.argv[2] || process.env.PHASE043_SOAK_MINUTES || 30);
const fixture = JSON.parse(fs.readFileSync(path.join(QUAL, 'phase-043-project.json'), 'utf8'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, port], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server timeout')), 10000); server.stdout.on('data', (data) => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const report = { phase: 43, status: 'FAIL', targetMinutes: minutes, startedAt: new Date().toISOString(), ticks: 0, moves: 0, blockedX: 0, blockedY: 0, candidates: 0, broadRejects: 0, narrowTests: 0, sweeps: 0, cappedSweeps: 0, enter: 0, stay: 0, exit: 0, browserCycles: 0, saveReloads: 0, playRestarts: 0, prefabCycles: 0, editableBuilds: 0, playableBuilds: 0, memorySamples: [], heartbeats: [], pageErrors: [], consoleErrors: [], networkErrors: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage();
    page.on('pageerror', (error) => report.pageErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('requestfailed', (request) => report.networkErrors.push(`${request.url()} ${request.failure()?.errorText || ''}`));
    const boot = async () => {
      await page.goto(`http://127.0.0.1:${port}/editor/`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof loadProjectFull === 'function' && typeof OpusBody2D === 'object');
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
      await page.evaluate((data) => { loadProjectFull(data, 'Phase 043 soak'); enterPlayMode(); app.pause(); trigger2DManager.reset(); window.__trigger2DEventLog = []; }, fixture);
      report.browserCycles++;
    };
    await boot(); const start = Date.now(), end = start + minutes * 60000;
    let nextHeartbeat = start + 10 * 60000, nextReload = start + 2 * 60000, nextRestart = start + 3 * 60000, nextPrefab = start + 90 * 1000, nextExport = start + 5 * 60000, iteration = 0;
    while (Date.now() < end) {
      const batch = await page.evaluate((iteration) => {
        const mover = placed.find((item) => item.id === 'mover'), wall = placed.find((item) => item.id === 'wall'), parent = placed.find((item) => item.id === 'parent');
        const before = { ...body2DManager.metrics }; window.__trigger2DEventLog = [];
        for (let tick = 0; tick < 25; tick++) {
          const n = iteration * 25 + tick;
          mover.entity.position.set(0, 0, 0);
          mover.components['body-2d'].type = n % 71 === 0 ? 'static' : 'kinematic';
          mover.components['body-2d'].linearVelocity = n % 4 === 0 ? [90, 0] : n % 4 === 1 ? [50, 10] : n % 4 === 2 ? [50, -10] : [0, 12];
          wall.components['body-2d'].enabled = n % 37 !== 0;
          parent.entity.position.x = 12 + Math.sin(n / 20);
          updateHierarchyTransforms(); body2DManager.tick(placed, .1, Array.from(body2DObjects)); updateHierarchyTransforms(); trigger2DManager.tick(placed, Array.from(trigger2DObjects));
        }
        const after = body2DManager.metrics, log = window.__trigger2DEventLog;
        const counts = { enter: log.filter((event) => event.eventType === 'trigger2DEnter').length, stay: log.filter((event) => event.eventType === 'trigger2DStay').length, exit: log.filter((event) => event.eventType === 'trigger2DExit').length };
        window.__trigger2DEventLog = [];
        return { ticks: 25, ...counts, moves: after.moves - before.moves, blockedX: after.blockedX - before.blockedX, blockedY: after.blockedY - before.blockedY, candidates: after.candidates - before.candidates, broadRejects: after.broadRejects - before.broadRejects, narrowTests: after.narrowTests - before.narrowTests, sweeps: after.sweeps - before.sweeps, cappedSweeps: after.cappedSweeps - before.cappedSweeps, heap: performance.memory && performance.memory.usedJSHeapSize || null };
      }, iteration++);
      for (const key of ['ticks', 'moves', 'blockedX', 'blockedY', 'candidates', 'broadRejects', 'narrowTests', 'sweeps', 'cappedSweeps', 'enter', 'stay', 'exit']) report[key] += batch[key];
      const now = Date.now();
      if (now >= nextHeartbeat) { const heartbeat = { minute: Number(((now - start) / 60000).toFixed(2)), ticks: report.ticks, moves: report.moves, blockedX: report.blockedX, enter: report.enter, heap: batch.heap }; report.heartbeats.push(heartbeat); console.log(`Phase 043 soak heartbeat ${heartbeat.minute}/${minutes} min; ${heartbeat.ticks} ticks`); nextHeartbeat += 10 * 60000; }
      if (now >= nextReload) { const proof = await page.evaluate(() => { exitPlayMode(); const saved = serializeProject(); loadProjectFull(JSON.parse(JSON.stringify(saved)), 'Phase 043 soak reload'); enterPlayMode(); app.pause(); return { x: placed.find((item) => item.id === 'mover').entity.position.x, errors: validateCurrentProject().issues.filter((issue) => issue.severity === 'error').length }; }); assert.deepStrictEqual(proof, { x: 0, errors: 0 }); report.saveReloads++; nextReload += 2 * 60000; }
      if (now >= nextRestart) { const proof = await page.evaluate(() => { exitPlayMode(); enterPlayMode(); app.pause(); return placed.find((item) => item.id === 'mover').entity.position.x; }); assert.strictEqual(proof, 0); report.playRestarts++; nextRestart += 3 * 60000; }
      if (now >= nextPrefab) { const proof = await page.evaluate(() => { const prefab = prefabs.find((entry) => entry.name === 'Phase 043 Kinematic Prefab'); const spawned = spawnPrefabAssembly(prefab, new Opus.Vec3(20, 20, 0), {}, 43); const members = spawned.members; const kept = members.some((item) => item.components && item.components['body-2d']); members.forEach((item) => removeItemFromScene(item)); return kept && members.every((item) => !body2DObjects.has(item)); }); assert(proof); report.prefabCycles++; nextPrefab += 90 * 1000; }
      if (now >= nextExport) { const sizes = await page.evaluate(async () => (await Promise.all([buildExportHTML(false), buildExportHTML(true)])).map((value) => value.length)); assert(sizes.every((size) => size > 100000)); report.editableBuilds++; report.playableBuilds++; nextExport += 5 * 60000; }
      if (iteration % 40 === 0) report.memorySamples.push({ minute: Number(((now - start) / 60000).toFixed(2)), heap: batch.heap });
      await sleep(20);
    }
    report.actualMinutes = (Date.now() - start) / 60000;
    report.final = await page.evaluate(() => { exitPlayMode(); return { x: placed.find((item) => item.id === 'mover').entity.position.x, errors: validateCurrentProject().issues.filter((issue) => issue.severity === 'error').length, heap: performance.memory && performance.memory.usedJSHeapSize || null }; });
    assert(report.actualMinutes >= minutes); assert.strictEqual(report.final.x, 0); assert.strictEqual(report.final.errors, 0);
    assert(report.blockedX > 0 && report.enter > 0 && report.stay > 0 && report.exit > 0);
    assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.networkErrors, []);
    report.status = 'PASS'; await context.close();
  } finally { report.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(QUAL, 'browser-soak.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.kill(); }
  console.log(`Phase 043 soak: ${report.status}; ${report.actualMinutes.toFixed(2)} minutes; ${report.ticks} ticks`);
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
