'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-042');
const fixture = JSON.parse(fs.readFileSync(path.join(QUAL, 'phase-042-project.json'), 'utf8'));
const port = '8884';
async function bootLifecycle(page) {
  return page.evaluate(() => {
    if (!playMode) enterPlayMode();
    if (!app.paused) app.pause();
    const triggerObject = placed.find((object) => object.id === 'trigger-box');
    const target = placed.find((object) => object.id === 'target-box');
    trigger2DManager.reset(); window.__trigger2DEventLog = [];
    target.entity.position.x = 4; updateHierarchyTransforms(); trigger2DManager.tick(placed);
    target.entity.position.x = -3; updateHierarchyTransforms(); trigger2DManager.tick(placed);
    trigger2DManager.tick(placed);
    target.entity.position.x = 4; updateHierarchyTransforms(); trigger2DManager.tick(placed);
    target.entity.position.x = -3; updateHierarchyTransforms(); trigger2DManager.tick(placed);
    const matching = window.__trigger2DEventLog.filter((event) => event.triggerObjectId === triggerObject.id && event.targetObjectId === target.id);
    return { sequence: matching.map((event) => event.eventType), frozen: matching.every(Object.isFrozen), stableIds: matching.every((event) => event.componentId === 'trigger-collider-2d'), pairs: trigger2DManager.activePairCount(), metrics: { ...trigger2DManager.metrics } };
  });
}
async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, port], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server timeout')), 10000); server.stdout.on('data', (data) => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const report = { phase: 42, status: 'FAIL', cycles: [], workflow: {}, exports: {}, pageErrors: [], consoleErrors: [], networkErrors: [], generatedAt: new Date().toISOString() };
  let editable; let playable;
  try {
    for (let index = 0; index < 20; index++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }); const page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`cycle-${index + 1}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`cycle-${index + 1}: ${message.text()}`); });
      page.on('requestfailed', (request) => report.networkErrors.push(`cycle-${index + 1}: ${request.url()} ${request.failure()?.errorText || ''}`));
      const started = Date.now(); await page.goto(`http://127.0.0.1:${port}/editor/`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof loadProjectFull === 'function' && typeof OpusTrigger2D === 'object');
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
      await page.evaluate((data) => loadProjectFull(data, 'Phase 042 browser qualification'), fixture);
      await page.waitForFunction(() => placed.some((object) => object.id === 'trigger-box'));
      await page.evaluate(() => { app.camera.setProjection('orthographic'); app.camera.setOrthographicHeight(14); app.camera.setFixedOptions({ eye:new Opus.Vec3(0,0,20),target:new Opus.Vec3(0,0,0),up:new Opus.Vec3(0,1,0) }); app.camera.setMode('fixed'); });
      if (index === 0) {
        await page.evaluate(() => { selectItem(placed.find((object) => object.id === 'disabled-target')); renderInspector(); });
        await page.locator('#add-component-btn').click(); await page.locator('[data-add-component-search]').fill('Trigger Collider 2D'); await page.locator('[data-add-component-id="trigger-collider-2d"]').click();
        report.workflow.addThroughVisibleControls = await page.evaluate(() => !!placed.find((object) => object.id === 'disabled-target').components['trigger-collider-2d']);
        const shape = page.locator('[data-schema-slot="trigger-collider-2d"] [data-field-editor-key="shape"]'); await shape.selectOption('circle');
        report.workflow.shapeSwitchRetainsBox = await page.evaluate(() => { const component=placed.find((object)=>object.id==='disabled-target').components['trigger-collider-2d']; return component.shape==='circle'&&Array.isArray(component.size)&&component.size.length===2; });
        await page.evaluate(() => { selectItem(placed.find((object) => object.id === 'trigger-box')); renderInspector(); syncCollider2DOverlay(); });
        report.workflow.distinctGizmo = await page.locator('#collider-2d-frame .collider-shape.trigger').count() > 0;
        report.workflow.triggerHandles = await page.locator('#collider-2d-handles .collider-2d-handle.trigger').count();
        await page.screenshot({ path: path.join(QUAL, 'phase-042-editor.png'), fullPage: true });
      }
      const lifecycle = await bootLifecycle(page); assert.deepStrictEqual(lifecycle.sequence, ['trigger2DEnter', 'trigger2DStay', 'trigger2DExit', 'trigger2DEnter']); assert(lifecycle.frozen && lifecycle.stableIds);
      const roundTrip = await page.evaluate(() => { if (playMode) exitPlayMode(); const before=serializeProject(); loadProjectFull(JSON.parse(JSON.stringify(before)),'Phase 042 reload'); return { equal:JSON.stringify(before)===JSON.stringify(serializeProject()), errors:validateCurrentProject().issues.filter((issue)=>issue.severity==='error').length }; });
      assert(roundTrip.equal); assert.strictEqual(roundTrip.errors, 0);
      if (index === 0) [editable, playable] = await page.evaluate(async () => Promise.all([buildExportHTML(false), buildExportHTML(true)]));
      report.cycles.push({ cycle: index + 1, loadMs: Date.now() - started, lifecycle, roundTrip }); await context.close();
    }
    fs.writeFileSync(path.join(QUAL, 'phase-042-editable.html'), editable); fs.writeFileSync(path.join(QUAL, 'phase-042-playable.html'), playable);
    for (const kind of ['editable', 'playable']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`${kind}: ${error.message}`)); page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`${kind}: ${message.text()}`); });
      const started = Date.now(); await page.goto(`http://127.0.0.1:${port}/qualification/phase-042/phase-042-${kind}.html`, { waitUntil: 'load' }); await page.waitForFunction(() => typeof OpusTrigger2D === 'object' && placed.some((object) => object.id === 'trigger-box'));
      const lifecycle = await bootLifecycle(page); assert.deepStrictEqual(lifecycle.sequence, ['trigger2DEnter', 'trigger2DStay', 'trigger2DExit', 'trigger2DEnter']);
      const overlay = await page.evaluate(() => { const value=document.getElementById('collider-2d-overlay'); return !!value&&getComputedStyle(value).display!=='none'&&value.classList.contains('active'); });
      report.exports[kind] = { bytes: Buffer.byteLength(kind === 'editable' ? editable : playable), bootMs: Date.now() - started, lifecycle, authoringOverlayVisible: overlay };
      await page.screenshot({ path: path.join(QUAL, `phase-042-${kind}.png`) }); await context.close();
    }
    assert(report.workflow.addThroughVisibleControls && report.workflow.shapeSwitchRetainsBox && report.workflow.distinctGizmo && report.workflow.triggerHandles >= 2);
    assert(!report.exports.playable.authoringOverlayVisible); assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.networkErrors, []); report.status = 'PASS';
  } finally {
    report.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(QUAL, 'browser-campaign.json'), JSON.stringify(report, null, 2) + '\n'); fs.writeFileSync(path.join(ROOT, 'phase-042-export-proof.json'), JSON.stringify({ phase:42,status:report.status,exports:report.exports,sequence:['trigger2DEnter','trigger2DStay','trigger2DExit','trigger2DEnter'],publicCatalog:false }, null, 2) + '\n'); await browser.close(); server.kill();
  }
  console.log(`Phase 042 browser: ${report.status}; ${report.cycles.length}/20 isolated cycles`);
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
