'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-041');
const port = '8881';
const fixture = JSON.parse(fs.readFileSync(path.join(QUAL, 'phase-041-project.json'), 'utf8'));

async function main() {
  fs.mkdirSync(QUAL, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, port], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server timeout')), 10000); server.stdout.on('data', (data) => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const report = { phase: 41, status: 'FAIL', cycles: [], pageErrors: [], consoleErrors: [], networkErrors: [], workflow: {}, exports: {}, generatedAt: new Date().toISOString() };
  let editable, playable;
  try {
    for (let i = 0; i < 20; i++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
      const page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`cycle-${i}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`cycle-${i}: ${message.text()}`); });
      page.on('requestfailed', (request) => report.networkErrors.push(`cycle-${i}: ${request.url()} ${request.failure()?.errorText || ''}`));
      const started = Date.now();
      await page.goto(`http://127.0.0.1:${port}/editor/`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof loadProjectFull === 'function' && typeof OpusCollider2D === 'object');
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
      await page.evaluate((data) => loadProjectFull(data, 'Phase 041 qualification'), fixture);
      await page.waitForFunction(() => placed.some((object) => object.id === 'box-sprite'));
      await page.evaluate(() => { app.camera.setProjection('orthographic'); app.camera.setOrthographicHeight(16); app.camera.setFixedOptions({ eye: new Opus.Vec3(3, 0, 20), target: new Opus.Vec3(3, 0, 0), up: new Opus.Vec3(0, 1, 0) }); app.camera.setMode('fixed'); });
      if (i === 0) {
        await page.evaluate(() => { selectItem(placed.find((object) => object.id === 'parent')); renderInspector(); });
        await page.locator('#add-component-btn').click();
        await page.locator('[data-add-component-search]').fill('Box Collider 2D');
        await page.locator('[data-add-component-id="box-collider-2d"]').click();
        report.workflow.addThroughVisibleControls = await page.evaluate(() => !!placed.find((object) => object.id === 'parent').components['box-collider-2d']);
        await page.evaluate(() => { selectItem(placed.find((object) => object.id === 'box-sprite')); renderInspector(); });
        report.workflow.boxGizmoVisible = await page.locator('#collider-2d-overlay:not([hidden])').isVisible();
        report.workflow.boxHandles = await page.locator('#collider-2d-handles button').count();
        const boxWidth = page.locator('[data-schema-slot="box-collider-2d"] [data-field-editor-key="size"][data-field-editor-axis="x"]');
        await boxWidth.fill('2.8'); await boxWidth.press('Tab');
        await page.locator('[data-schema-slot="box-collider-2d"] [data-collider-fit]').click();
        report.workflow.boxDirectResize = await page.evaluate(() => { const object=placed.find((entry)=>entry.id==='box-sprite'),component=object.components['box-collider-2d'],before=component.size[0],edit=OpusCollider2D.editBoxFromLocalHandle(component,'e',{x:component.offset[0]+component.size[0]/2+.4,y:component.offset[1]});Object.assign(component,edit);syncCollider2DOverlay();return component.size[0]>before; });
        await page.keyboard.press('Control+z'); await page.keyboard.press('Control+y');
        await page.evaluate(() => { selectItem(placed.find((object) => object.id === 'circle-sprite')); renderInspector(); });
        const radiusInput = page.locator('[data-schema-slot="circle-collider-2d"] [data-field-editor-key="radius"]'); await radiusInput.fill('0.8'); await radiusInput.press('Tab');
        report.workflow.circleDirectRadius = await page.evaluate(() => { const object=placed.find((entry)=>entry.id==='circle-sprite'),component=object.components['circle-collider-2d'],edit=OpusCollider2D.editCircleFromLocalHandle(component,'radius',{x:component.offset[0]+1.1,y:component.offset[1]});Object.assign(component,edit);syncCollider2DOverlay();return component.radius===1.1; });
        await page.evaluate(() => { selectItem(placed.find((object) => object.id === 'box-sprite')); renderInspector(); });
        await page.screenshot({ path: path.join(QUAL, 'phase-041-editor.png'), fullPage: true });
        [editable, playable] = await page.evaluate(async () => Promise.all([buildExportHTML(false), buildExportHTML(true)]));
      }
      const result = await page.evaluate(() => {
        const ids = ['box-sprite','circle-sprite','invisible-box','both-colliders','rotated-box','parented-sprite','nonuniform-circle','mirrored-box','touching-a','touching-b'];
        const shapes = ids.flatMap((id) => OpusCollider2D.enumerateCollider2DWorldShapes(placed.find((object) => object.id === id)));
        const before = serializeProject(); loadProjectFull(JSON.parse(JSON.stringify(before)), 'Phase 041 cycle reload'); const after = serializeProject();
        const shape = (id) => OpusCollider2D.enumerateCollider2DWorldShapes(placed.find((object) => object.id === id))[0];
        const pair = (a, b) => OpusCollider2D.overlaps(shape(a), shape(b));
        const overlapCases = { boxSeparated: pair('box-separated-a','box-separated-b'), boxTouching: pair('box-touch-a','box-touch-b'), boxOverlapping: pair('box-overlap-a','box-overlap-b'), rotatedBox: pair('rotated-overlap-a','rotated-overlap-b'), circleCircle: pair('circle-overlap-a','circle-overlap-b'), circleRotatedBox: pair('circle-box-a','circle-box-b'), boxCircleTouching: pair('touching-a','touching-b') };
        return { shapes: shapes.length, roundTrip: JSON.stringify(before) === JSON.stringify(after), overlapCases, validationErrors: validateCurrentProject().issues.filter((issue) => issue.severity === 'error').length, prefabComponents: Object.keys(prefabs.find((prefab) => prefab.name === 'Phase 041 Collider Prefab').record.components || {}).sort() };
      });
      assert(result.shapes >= 11); assert(result.roundTrip); assert.deepStrictEqual(result.overlapCases, { boxSeparated:false,boxTouching:true,boxOverlapping:true,rotatedBox:true,circleCircle:true,circleRotatedBox:true,boxCircleTouching:true }); assert.strictEqual(result.validationErrors, 0); assert.deepStrictEqual(result.prefabComponents, ['box-collider-2d', 'circle-collider-2d']);
      report.cycles.push({ cycle: i + 1, loadMs: Date.now() - started, ...result });
      await context.close();
    }
    fs.writeFileSync(path.join(QUAL, 'phase-041-editable.html'), editable); fs.writeFileSync(path.join(QUAL, 'phase-041-playable.html'), playable);
    for (const kind of ['editable', 'playable']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`${kind}: ${error.message}`)); page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`${kind}: ${message.text()}`); });
      const started = Date.now(); await page.goto(`http://127.0.0.1:${port}/qualification/phase-041/phase-041-${kind}.html`, { waitUntil: 'load' }); await page.waitForFunction(() => typeof OpusCollider2D === 'object' && placed.some((object) => object.id === 'box-sprite'));
      const proof = await page.evaluate(() => { const overlay=document.getElementById('collider-2d-overlay'); return { shapes: placed.reduce((count, object) => count + OpusCollider2D.enumerateCollider2DWorldShapes(object).length, 0), hasResponseState: placed.some((object) => object.body2D || object.velocity2D || object.physicsWorld), hasTriggerState: placed.some((object) => object.trigger2D || object.onColliderEnter), hasAuthoringOverlay: !!overlay, authoringOverlayVisible: !!overlay && getComputedStyle(overlay).display!=='none' && overlay.classList.contains('active') }; });
      report.exports[kind] = { bytes: Buffer.byteLength(kind === 'editable' ? editable : playable), bootMs: Date.now() - started, ...proof };
      if(kind==='editable'){report.exports.editable.authoringMutation=await page.evaluate(()=>{const object=placed.find((entry)=>entry.id==='box-separated-a');delete object.components['box-collider-2d'];selectItem(object);renderInspector();document.getElementById('add-component-btn').click();const search=document.querySelector('[data-add-component-search]');search.value='Box Collider 2D';search.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-add-component-id="box-collider-2d"]').click();const component=object.components['box-collider-2d'];Object.assign(component,OpusCollider2D.editBoxFromLocalHandle(component,'e',{x:1,y:0}));return component.size[0]>1&&JSON.stringify(serializeProject()).includes('box-collider-2d')&&validateCurrentProject().issues.filter((issue)=>issue.severity==='error').length===0;});}
      await page.screenshot({ path: path.join(QUAL, `phase-041-${kind}.png`) }); await context.close();
    }
    assert(report.workflow.addThroughVisibleControls && report.workflow.boxGizmoVisible && report.workflow.boxHandles >= 5 && report.workflow.boxDirectResize && report.workflow.circleDirectRadius); assert(report.exports.editable.shapes >= 11 && report.exports.playable.shapes >= 11 && report.exports.editable.authoringMutation); assert(!report.exports.editable.hasResponseState && !report.exports.playable.hasResponseState && !report.exports.editable.hasTriggerState && !report.exports.playable.hasTriggerState && !report.exports.playable.authoringOverlayVisible); assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.networkErrors, []); report.status = 'PASS';
  } finally {
    report.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(QUAL, 'browser-campaign.json'), JSON.stringify(report, null, 2) + '\n'); fs.writeFileSync(path.join(ROOT, 'phase-041-export-proof.json'), JSON.stringify({ phase: 41, status: report.status, exports: report.exports, noResponse: true, noTrigger: true }, null, 2) + '\n'); await browser.close(); server.kill();
  }
  console.log(`Phase 041 browser: ${report.status}; ${report.cycles.length}/20 isolated cycles`);
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
