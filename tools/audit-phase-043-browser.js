'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), QUAL = path.join(ROOT, 'qualification', 'phase-043');
const fixture = JSON.parse(fs.readFileSync(path.join(QUAL, 'phase-043-project.json'), 'utf8'));
const port = '8886';
async function simulate(page) {
  return page.evaluate(() => {
    if (!playMode) enterPlayMode();
    if (!app.paused) app.pause();
    const mover = placed.find((item) => item.id === 'mover'), wall = placed.find((item) => item.id === 'wall'), parented = placed.find((item) => item.id === 'parented-mover'), parent = placed.find((item) => item.id === 'parent');
    mover.entity.position.set(0, 0, 0); updateHierarchyTransforms();
    const originalX = mover.entity.position.x, originalY = mover.entity.position.y;
    const parentedBefore = { x: parented.entity.position.x, y: parented.entity.position.y };
    trigger2DManager.reset(); window.__trigger2DEventLog = [];
    const before = { ...body2DManager.metrics };
    const moves = body2DManager.tick(placed, .1, Array.from(body2DObjects));
    updateHierarchyTransforms(); trigger2DManager.tick(placed, Array.from(trigger2DObjects));
    const parentedAfter = { x: parented.entity.position.x, y: parented.entity.position.y };
    const firstEvents = window.__trigger2DEventLog.filter((event) => event.triggerObjectId === 'sensor' && event.targetObjectId === 'mover').map((event) => event.eventType);
    body2DManager.tick(placed, .1, Array.from(body2DObjects)); updateHierarchyTransforms(); trigger2DManager.tick(placed, Array.from(trigger2DObjects));
    const secondEvents = window.__trigger2DEventLog.filter((event) => event.triggerObjectId === 'sensor' && event.targetObjectId === 'mover').map((event) => event.eventType);
    const blockedEvents = window.__trigger2DEventLog.filter((event) => event.triggerObjectId === 'blocked-sensor' && event.targetObjectId === 'mover');
    const actual = { x: mover.entity.position.x, y: mover.entity.position.y };
    const authoredVelocity = mover.components['body-2d'].linearVelocity.slice();
    const wallPosition = { ...wall.entity.position };
    const originalParentScale = parent.entity.scale.clone(); parent.entity.scale.set(0, originalParentScale.y, originalParentScale.z);
    updateHierarchyTransforms();
    const singularMove = body2DManager.tick(placed, .1, Array.from(body2DObjects)).find((entry) => entry.objectId === 'parented-mover').result;
    parent.entity.scale.set(originalParentScale.x, originalParentScale.y, originalParentScale.z); updateHierarchyTransforms();
    parent.entity.scale.set(-originalParentScale.x, originalParentScale.y, originalParentScale.z); updateHierarchyTransforms();
    const mirroredBefore = { x: parented.entity.position.x, y: parented.entity.position.y };
    body2DManager.tick(placed, .1, Array.from(body2DObjects)); updateHierarchyTransforms();
    const mirroredAfter = { x: parented.entity.position.x, y: parented.entity.position.y };
    parent.entity.scale.set(originalParentScale.x, originalParentScale.y, originalParentScale.z); updateHierarchyTransforms();
    exitPlayMode();
    return { originalX, originalY, actual, restored: { x: mover.entity.position.x, y: mover.entity.position.y },
      restoredBody: JSON.parse(JSON.stringify(mover.components['body-2d'])), authoredVelocity, wallPosition,
      parentedBefore, parentedAfter, singularMove, mirroredBefore, mirroredAfter,
      firstEvents, secondEvents, blockedEvents: blockedEvents.length, move: moves.find((entry) => entry.objectId === 'mover').result,
      metrics: { candidates: body2DManager.metrics.candidates - before.candidates, broadRejects: body2DManager.metrics.broadRejects - before.broadRejects, narrowTests: body2DManager.metrics.narrowTests - before.narrowTests } };
  });
}
async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, port], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server timeout')), 10000); server.stdout.on('data', (data) => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const report = { phase: 43, status: 'FAIL', cycles: [], workflow: {}, exports: {}, pageErrors: [], consoleErrors: [], networkErrors: [], startedAt: new Date().toISOString() };
  let editable, playable;
  try {
    for (let index = 0; index < 20; index++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }), page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`cycle-${index + 1}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`cycle-${index + 1}: ${message.text()}`); });
      page.on('requestfailed', (request) => report.networkErrors.push(`cycle-${index + 1}: ${request.url()} ${request.failure()?.errorText || ''}`));
      await page.goto(`http://127.0.0.1:${port}/editor/`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof loadProjectFull === 'function' && typeof OpusBody2D === 'object');
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
      await page.evaluate((data) => loadProjectFull(data, 'Phase 043 browser qualification'), fixture);
      await page.waitForFunction(() => placed.some((item) => item.id === 'mover'));
      if (index === 0) {
        await page.evaluate(() => { selectItem(placed.find((item) => item.id === 'authoring-probe')); renderInspector(); });
        await page.locator('#add-component-btn').click(); await page.locator('[data-add-component-search]').fill('Body 2D'); await page.locator('[data-add-component-id="body-2d"]').click();
        report.workflow.addThroughVisibleControls = await page.evaluate(() => !!placed.find((item) => item.id === 'authoring-probe').components['body-2d']);
        report.workflow.noColliderHelp = await page.locator('[data-schema-slot="body-2d"] .body-2d-tools').innerText();
        assert(report.workflow.noColliderHelp.includes('Add Box Collider 2D or Circle Collider 2D'));
        await page.locator('[data-schema-slot="body-2d"] [data-field-editor-key="type"]').selectOption('kinematic');
        report.workflow.typeSwitch = await page.evaluate(() => placed.find((item) => item.id === 'authoring-probe').components['body-2d'].type === 'kinematic');
        report.workflow.velocityControls = await page.locator('[data-schema-slot="body-2d"] [data-component-field="linearVelocity"]').count();
        await page.evaluate(() => { app.camera.setProjection('orthographic'); app.camera.setOrthographicHeight(18); app.camera.setFixedOptions({ eye: new Opus.Vec3(0, 0, 24), target: new Opus.Vec3(0, 0, 0), up: new Opus.Vec3(0, 1, 0) }); app.camera.setMode('fixed'); selectItem(placed.find((item) => item.id === 'mover')); renderInspector(); });
        await page.locator('[data-schema-slot="body-2d"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(QUAL, 'phase-043-editor.png'), fullPage: true });
      }
      const simulation = await simulate(page);
      assert(simulation.move.blockedX, 'Static wall did not block X');
      assert(simulation.actual.x > 2 && simulation.actual.x < 2.5, `unexpected contact ${simulation.actual.x}`);
      assert(simulation.actual.y > simulation.originalY, 'Y slide absent');
      assert(Math.abs(simulation.parentedAfter.x - simulation.parentedBefore.x - .1) < 1e-5, 'parented world X motion');
      assert(Math.abs(simulation.parentedAfter.y - simulation.parentedBefore.y) < 1e-5, 'parented world Y drift');
      assert.deepStrictEqual(simulation.singularMove.actualDelta, { x: 0, y: 0 });
      assert(Math.abs(simulation.mirroredAfter.x - simulation.mirroredBefore.x - .1) < 1e-5, 'mirrored-parent world X motion');
      assert(Math.abs(simulation.mirroredAfter.y - simulation.mirroredBefore.y) < 1e-5, 'mirrored-parent world Y drift');
      assert.deepStrictEqual(simulation.firstEvents, ['trigger2DEnter']);
      assert(simulation.secondEvents.includes('trigger2DStay'));
      assert.strictEqual(simulation.blockedEvents, 0);
      assert.deepStrictEqual(simulation.restored, { x: simulation.originalX, y: simulation.originalY });
      assert.strictEqual(simulation.restoredBody.type, 'kinematic');
      assert.deepStrictEqual(simulation.restoredBody.linearVelocity, [50, 10]);
      assert.deepStrictEqual(simulation.authoredVelocity, [50, 10]);
      const roundTrip = await page.evaluate(() => { const before = serializeProject(); loadProjectFull(JSON.parse(JSON.stringify(before)), 'Phase 043 reload'); return { exact: JSON.stringify(before) === JSON.stringify(serializeProject()), errors: validateCurrentProject().issues.filter((issue) => issue.severity === 'error').length }; });
      assert(roundTrip.exact); assert.strictEqual(roundTrip.errors, 0);
      if (index === 0) [editable, playable] = await page.evaluate(async () => Promise.all([buildExportHTML(false), buildExportHTML(true)]));
      report.cycles.push({ cycle: index + 1, simulation, roundTrip }); await context.close();
    }
    fs.writeFileSync(path.join(QUAL, 'phase-043-editable.html'), editable); fs.writeFileSync(path.join(QUAL, 'phase-043-playable.html'), playable);
    for (const kind of ['editable', 'playable']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`${kind}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`${kind}: ${message.text()}`); });
      page.on('requestfailed', (request) => report.networkErrors.push(`${kind}: ${request.url()} ${request.failure()?.errorText || ''}`));
      await page.goto(`http://127.0.0.1:${port}/qualification/phase-043/phase-043-${kind}.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof OpusBody2D === 'object' && placed.some((item) => item.id === 'mover'));
      const simulation = await simulate(page);
      assert(simulation.move.blockedX && simulation.actual.y > simulation.originalY);
      assert.deepStrictEqual(simulation.firstEvents, ['trigger2DEnter']);
      report.exports[kind] = { bytes: Buffer.byteLength(kind === 'editable' ? editable : playable), simulation };
      await page.screenshot({ path: path.join(QUAL, `phase-043-${kind}.png`) }); await context.close();
    }
    assert(report.workflow.addThroughVisibleControls && report.workflow.typeSwitch && report.workflow.velocityControls >= 2);
    assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.networkErrors, []);
    report.status = 'PASS';
  } finally {
    report.endedAt = new Date().toISOString();
    fs.writeFileSync(path.join(QUAL, 'browser-campaign.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(ROOT, 'phase-043-export-proof.json'), JSON.stringify({ phase: 43, status: report.status, exports: report.exports, publicCatalog: false }, null, 2) + '\n');
    await browser.close(); server.kill();
  }
  console.log(`Phase 043 browser: ${report.status}; ${report.cycles.length}/20 isolated cycles`);
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
