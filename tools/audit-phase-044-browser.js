'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), PORT = '8890';
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'qualification', 'phase-043', 'phase-043-project.json'), 'utf8'));
async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, PORT], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server timeout')), 10000); server.stdout.on('data', (data) => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const report = { phase: 44, status: 'FAIL', productSchemaChanged: false, cycles: [], pageErrors: [], consoleErrors: [], networkErrors: [], startedAt: new Date().toISOString() };
  try {
    for (let cycle = 1; cycle <= 20; cycle++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }), page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`cycle-${cycle}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`cycle-${cycle}: ${message.text()}`); });
      page.on('requestfailed', (request) => report.networkErrors.push(`cycle-${cycle}: ${request.url()} ${request.failure()?.errorText || ''}`));
      await page.goto(`http://127.0.0.1:${PORT}/editor/`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof loadProjectFull === 'function' && typeof OpusBody2D === 'object');
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
      await page.evaluate((data) => { loadProjectFull(data, 'Phase 044 qualification-only review'); selectItem(placed.find((item) => item.id === 'mover')); renderInspector(); }, fixture);
      const visibleTypes = await page.locator('[data-schema-slot="body-2d"] [data-field-editor-key="type"] option').allTextContents();
      const gravityFields = await page.locator('[data-schema-slot="body-2d"] [data-component-field="gravity"]').count();
      const roleHelp = await page.locator('[data-schema-slot="body-2d"] .body-2d-tools').innerText();
      assert(visibleTypes.some((text) => text.includes('Static')) && visibleTypes.some((text) => text.includes('Kinematic')));
      assert(!visibleTypes.some((text) => text.includes('Dynamic')) && gravityFields === 0);
      await page.addScriptTag({ path: path.join(ROOT, 'tools', 'phase-044-dynamic-prototype.js') });
      if (cycle === 1) { await page.locator('[data-schema-slot="body-2d"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(ROOT, 'phase-044-utility-browser.png'), fullPage: true }); }
      const result = await page.evaluate(() => {
        enterPlayMode(); app.pause();
        const mover = placed.find((item) => item.id === 'mover'), wall = placed.find((item) => item.id === 'wall'), sensor = placed.find((item) => item.id === 'sensor');
        mover.entity.position.set(0, 5, 0); wall.entity.position.set(0, -2, 0); wall.components['box-collider-2d'].size = [100, .2]; sensor.entity.position.set(0, 2, 0); updateHierarchyTransforms();
        const events = [], lifecycle = OpusTrigger2D.createTriggerLifecycle({ emit: (event) => { if (event.triggerObjectId === 'sensor' && event.targetObjectId === 'mover') events.push(event.eventType); } });
        const p = OpusPhase044Prototype.createPrototype(mover, { initialVelocity: [0, 0], gravity: [0, -9.81], translateWorld: translateBody2DWorld });
        for (let i = 0; i < 600; i++) { p.step(1 / 60, [wall], () => lifecycle.tick([mover, wall, sensor])); updateHierarchyTransforms(); }
        const proof = { y: mover.entity.position.y, velocity: p.velocity.slice(), cappedSweeps: p.manager.metrics.cappedSweeps, events, authoredTypeDuringPlay: mover.components['body-2d'].type };
        exitPlayMode(); proof.restoredY = mover.entity.position.y; proof.restoredType = mover.components['body-2d'].type;
        const saved = serializeProject(); loadProjectFull(JSON.parse(JSON.stringify(saved)), 'Phase 044 qualification reload'); proof.saveLoadExact = JSON.stringify(saved) === JSON.stringify(serializeProject());
        return proof;
      });
      assert(Math.abs(result.y + 1.4) < 1e-3, `cycle ${cycle} rest ${result.y}`);
      assert.strictEqual(result.velocity[1], 0); assert.strictEqual(result.cappedSweeps, 0);
      assert(result.events.includes('trigger2DEnter') && result.events.includes('trigger2DExit'));
      assert.strictEqual(result.restoredType, 'kinematic'); assert.strictEqual(result.restoredY, 0);
      assert(result.saveLoadExact);
      report.cycles.push({ cycle, visibleTypes, gravityFields, roleHelp, result }); await context.close();
    }
    assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.networkErrors, []);
    report.status = 'PASS';
  } finally { report.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(ROOT, 'phase-044-utility-browser.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.kill(); }
  console.log(`Phase 044 utility browser: ${report.status}; ${report.cycles.length}/20 cycles`);
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
