'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8878;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const OUT = path.join(ROOT, '.tmp-phase028');
const REPORT = path.join(ROOT, 'phase-028-export-proof.json');

async function inspect(browser, file, playableOnly) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); const errors = []; const network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof placed !== 'undefined' && placed.some(item => item.name === 'Phase 028 Orthographic'));
  const proof = await page.evaluate(() => {
    const perspective = placed.find(item => item.name === 'Phase 028 Perspective');
    const orthographic = placed.find(item => item.name === 'Phase 028 Orthographic');
    applyCameraPreset(orthographic);
    const matrixZ10 = Array.from(app.camera.projectionMatrix(16 / 9).m);
    orthographic.entity.position.z = 30; orthographic.options.position.z = 30; applyCameraPreset(orthographic);
    const matrixZ30 = Array.from(app.camera.projectionMatrix(16 / 9).m);
    const bounds = app.camera.orthographicBounds(16 / 9);
    const rayA = app.camera.screenPointToRay(-1, 0, 16 / 9);
    const rayB = app.camera.screenPointToRay(1, 0, 16 / 9);
    applyCameraPreset(perspective);
    return {
      cameraCount: placed.filter(item => item.kind === 'camera').length,
      spriteCount: placed.filter(item => item.kind === 'sprite').length,
      billboardCount: placed.filter(item => item.isBillboard).length,
      meshCount: placed.filter(item => item.kind === 'cube' && !item.isBillboard).length,
      perspective: { projection: perspective.options.projection, fov: perspective.options.fovDegrees },
      orthographic: { projection: orthographic.options.projection, height: orthographic.options.orthographicHeight, active: orthographic.isActiveCamera, version: orthographic.options.version },
      bounds, zInvariant: matrixZ10[0] === matrixZ30[0] && matrixZ10[5] === matrixZ30[5],
      parallelRays: rayA.direction.x === rayB.direction.x && rayA.direction.y === rayB.direction.y && rayA.direction.z === rayB.direction.z,
      activeProjectionAfterSwitch: app.camera.projection,
    };
  });
  const chromeVisible = await page.locator('#chrome-toggle-btn').isVisible();
  let editorOpened = false; let inspectorReady = false;
  if (!playableOnly) {
    const start = page.locator('#start-overlay-btn'); if (await start.isVisible()) await start.click();
    if (chromeVisible) await page.locator('#chrome-toggle-btn').click();
    editorOpened = await page.locator('#app').evaluate(el => !el.classList.contains('editor-hidden'));
    await page.locator('[data-right-tab="scene"]').click(); await page.getByText('Phase 028 Orthographic', { exact: true }).click();
    await page.locator('[data-right-tab="inspector"]').click();
    inspectorReady = await page.locator('#f-projection').isVisible() && await page.locator('#f-ortho-height').isVisible();
  }
  const result = { file: path.relative(ROOT, file), bytes: fs.statSync(file).size, playableOnly, chromeVisible, editorOpened, inspectorReady, proof, errors, network };
  result.pass = proof.cameraCount === 2 && proof.spriteCount >= 2 && proof.billboardCount === 1 && proof.meshCount >= 1 &&
    proof.perspective.projection === 'perspective' && proof.orthographic.projection === 'orthographic' && proof.orthographic.height === 12 && proof.orthographic.active && proof.orthographic.version === 2 &&
    Math.abs(proof.bounds.width - (12 * 16 / 9)) < 1e-9 && proof.bounds.height === 12 && proof.zInvariant && proof.parallelRays && proof.activeProjectionAfterSwitch === 'perspective' &&
    errors.length === 0 && network.length === 0 && (playableOnly ? !chromeVisible : editorOpened && inspectorReady);
  await context.close(); return result;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser; const report = { phase: 28, url: URL, checks: {}, errors: [] };
  try {
    await new Promise((resolve, reject) => { const timer=setTimeout(()=>reject(new Error('Static server did not start')),10000); server.stdout.on('data',chunk=>{if(String(chunk).includes('listening on')){clearTimeout(timer);resolve();}}); server.once('error',reject); });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 }); await page.waitForFunction(() => typeof placeItem === 'function');
    if (await page.locator('#first-run-skip').isVisible()) await page.locator('#first-run-skip').click();
    await page.evaluate(() => {
      placeItem('camera', new Opus.Vec3(-2, 1.6, 8)); selectedItem.name = 'Phase 028 Perspective'; selectedItem.options.mode = 'fixed'; selectedItem.options.rotationDegrees = {x:0,y:0,z:0};
      placeItem('camera2d', new Opus.Vec3(0, 0, 0)); selectedItem.name = 'Phase 028 Orthographic'; selectedItem.options.orthographicHeight = 12;
      placeItem('sprite', new Opus.Vec3(-2, 1, 0)); selectedItem.name = 'Phase 028 Sprite Near';
      placeItem('sprite', new Opus.Vec3(2, 1, -8)); selectedItem.name = 'Phase 028 Sprite Far';
      placeItem('billboard', new Opus.Vec3(0, 1, -2)); selectedItem.name = 'Phase 028 Billboard';
      placeItem('cube', new Opus.Vec3(0, .5, -4)); selectedItem.name = 'Phase 028 Mesh';
      syncCurrentLevelObjects();
    });
    await page.locator('[data-right-tab="project"]').click(); await page.locator('#validate-project-btn').click();
    report.checks.validation = await page.locator('#project-validation-summary').textContent(); assert(report.checks.validation.includes('No structured authoring issues'));
    await page.evaluate(() => { window.__phase028Exports={}; downloadHTML=(html,filename)=>{window.__phase028Exports[filename]=html;}; });
    await page.locator('#export-standalone-alt-btn').click(); await page.waitForFunction(() => !!window.__phase028Exports['editable-game.html'], null, { timeout: 120000 });
    await page.locator('#export-playable-btn').click(); await page.waitForFunction(() => !!window.__phase028Exports['playable-game.html'], null, { timeout: 120000 });
    const editable=path.join(OUT,'phase-028-editable.html'), playable=path.join(OUT,'phase-028-playable.html');
    fs.writeFileSync(editable, await page.evaluate(() => window.__phase028Exports['editable-game.html'])); fs.writeFileSync(playable, await page.evaluate(() => window.__phase028Exports['playable-game.html'])); await context.close();
    report.checks.editable=await inspect(browser,editable,false); report.checks.playable=await inspect(browser,playable,true);
    assert(report.checks.editable.pass); assert(report.checks.playable.pass); assert.deepStrictEqual(report.errors,[]); report.ok=true;
    fs.writeFileSync(REPORT, `${JSON.stringify(report,null,2)}\n`); console.log(`Phase 028 export audit passed: editable ${report.checks.editable.bytes} bytes, playable ${report.checks.playable.bytes} bytes`);
  } catch (error) { report.ok=false; report.failure=error.stack; fs.writeFileSync(REPORT,`${JSON.stringify(report,null,2)}\n`); console.error(error.stack||error); process.exitCode=1; }
  finally { if(browser) await browser.close(); server.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
