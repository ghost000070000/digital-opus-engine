'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8879;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const OUT = path.join(ROOT, '.tmp-phase029');
const REPORT = path.join(ROOT, 'phase-029-dogfood.json');

async function inspectExport(browser, file, playableOnly) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(); const errors = []; const network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof placed !== 'undefined' && placed.some(item => item.name === 'Phase 029 Front Billboard'));
  const proof = await page.evaluate(() => {
    const records = serializeScene();
    const behind = records.find(record => record.name === 'Phase 029 Behind Mesh');
    const front = records.find(record => record.name === 'Phase 029 Front Billboard');
    const sprite = records.find(record => record.name === 'Phase 029 Sprite');
    return {
      behind: behind && behind.spritePassRelation,
      front: front && front.spritePassRelation,
      frontBillboard: front && front.isBillboard,
      spriteOwnsRelation: !!(sprite && Object.prototype.hasOwnProperty.call(sprite, 'spritePassRelation')),
      runtimeFront: placed.find(item => item.name === 'Phase 029 Front Billboard').entity.spritePassRelation,
    };
  });
  const chromeVisible = await page.locator('#chrome-toggle-btn').isVisible();
  let inspectorReady = true;
  if (!playableOnly) {
    const start = page.locator('#start-overlay-btn'); if (await start.isVisible()) await start.click();
    if (chromeVisible) await page.locator('#chrome-toggle-btn').click();
    await page.locator('[data-right-tab="scene"]').click(); await page.locator('#scene-list').getByText('Phase 029 Front Billboard', { exact: true }).click();
    await page.locator('[data-right-tab="inspector"]').click();
    inspectorReady = await page.locator('#f-sprite-pass-relation').isVisible();
  }
  const result = { file: path.relative(ROOT, file), bytes: fs.statSync(file).size, playableOnly, chromeVisible, inspectorReady, proof, errors, network };
  result.pass = proof.behind === 'behind-sprites' && proof.front === 'in-front-of-sprites' && proof.frontBillboard && !proof.spriteOwnsRelation && proof.runtimeFront === 'in-front-of-sprites' && errors.length === 0 && network.length === 0 && (playableOnly || inspectorReady);
  await context.close(); return result;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser; const report = { phase: 29, url: URL, status: 'qualification-in-progress', checks: {}, limitations: ['Bounded two-band alpha transparency; universal order-independent transparency remains out of scope.'], errors: [] };
  try {
    await new Promise((resolve, reject) => { const timer=setTimeout(()=>reject(new Error('Static server did not start')),10000); server.stdout.on('data',chunk=>{if(String(chunk).includes('listening on')){clearTimeout(timer);resolve();}}); server.once('error',reject); });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 }); await page.waitForFunction(() => typeof placeItem === 'function');
    if (await page.locator('#first-run-skip').isVisible()) await page.locator('#first-run-skip').click();
    await page.evaluate(() => {
      placeItem('sprite', new Opus.Vec3(0, 1, 0)); selectedItem.name = 'Phase 029 Sprite';
      placeItem('cube', new Opus.Vec3(-1, 1, -1)); selectedItem.name = 'Phase 029 Behind Mesh'; selectedItem.entity.alpha = .45; selectedItem.spritePassRelation = 'behind-sprites'; selectedItem.entity.spritePassRelation = 'behind-sprites';
      placeItem('billboard', new Opus.Vec3(1, 1, 1)); selectedItem.name = 'Phase 029 Front Billboard'; selectedItem.entity.alpha = .45; selectedItem.spritePassRelation = 'in-front-of-sprites'; selectedItem.entity.spritePassRelation = 'in-front-of-sprites';
      placeItem('cube', new Opus.Vec3(0, 1, 2)); selectedItem.name = 'Phase 029 Opaque'; selectedItem.spritePassRelation = 'in-front-of-sprites'; selectedItem.entity.spritePassRelation = 'in-front-of-sprites';
      placeItem('camera', new Opus.Vec3(0, 2, 10)); selectedItem.name = 'Phase 029 Perspective'; selectedItem.options.mode='fixed'; selectedItem.options.rotationDegrees={x:0,y:0,z:0};
      placeItem('camera2d', new Opus.Vec3(0, 2, 10)); selectedItem.name = 'Phase 029 Orthographic';
      syncCurrentLevelObjects();
    });
    await page.locator('[data-right-tab="scene"]').click(); await page.locator('#scene-list').getByText('Phase 029 Front Billboard', { exact: true }).click(); await page.locator('[data-right-tab="inspector"]').click();
    report.checks.inspector = {
      relationVisible: await page.locator('#f-sprite-pass-relation').isVisible(),
      value: await page.locator('#f-sprite-pass-relation').inputValue(),
      label: await page.locator('[data-hybrid-layering="eligible"]').textContent(),
    };
    await page.locator('[data-right-tab="scene"]').click(); await page.locator('#scene-list').getByText('Phase 029 Sprite', { exact: true }).click(); await page.locator('[data-right-tab="inspector"]').click();
    report.checks.spriteReadOnly = await page.locator('[data-hybrid-layer-summary="sprite"]').textContent();
    await page.locator('[data-right-tab="project"]').click();
    report.checks.projectHelp = await page.locator('[data-hybrid-layering-help]').textContent();
    await page.locator('#validate-project-btn').click(); report.checks.validation = await page.locator('#project-validation-summary').textContent();
    report.checks.cameraSwitch = await page.evaluate(() => {
      const p=placed.find(item=>item.name==='Phase 029 Perspective'), o=placed.find(item=>item.name==='Phase 029 Orthographic'), f=placed.find(item=>item.name==='Phase 029 Front Billboard');
      applyCameraPreset(p); syncBillboards(); const perspective={ projection:app.camera.projection, relation:f.entity.spritePassRelation, quat:[f.entity.quaternion.x,f.entity.quaternion.y,f.entity.quaternion.z,f.entity.quaternion.w] };
      applyCameraPreset(o); syncBillboards(); const orthographic={ projection:app.camera.projection, relation:f.entity.spritePassRelation, quat:[f.entity.quaternion.x,f.entity.quaternion.y,f.entity.quaternion.z,f.entity.quaternion.w] };
      return { perspective, orthographic };
    });
    await page.evaluate(() => { window.__phase029Exports={}; downloadHTML=(html,filename)=>{window.__phase029Exports[filename]=html;}; });
    await page.locator('#export-standalone-alt-btn').click(); await page.waitForFunction(() => !!window.__phase029Exports['editable-game.html'], null, { timeout: 120000 });
    await page.locator('#export-playable-btn').click(); await page.waitForFunction(() => !!window.__phase029Exports['playable-game.html'], null, { timeout: 120000 });
    const editable=path.join(OUT,'phase-029-editable.html'), playable=path.join(OUT,'phase-029-playable.html');
    fs.writeFileSync(editable, await page.evaluate(() => window.__phase029Exports['editable-game.html'])); fs.writeFileSync(playable, await page.evaluate(() => window.__phase029Exports['playable-game.html']));
    report.checks.duplicate = await page.evaluate(() => { const source=placed.find(item=>item.name==='Phase 029 Front Billboard'); selectItem(source); duplicateSelected(); return { relation:selectedItem.spritePassRelation, runtime:selectedItem.entity.spritePassRelation, billboard:selectedItem.isBillboard }; });
    report.checks.stress = await page.evaluate(async () => {
      const base = placed.find(item=>item.name==='Phase 029 Sprite'); const spriteRecord=serializeSpriteRecord(base); const started=performance.now();
      for(let i=0;i<999;i++){ const record=JSON.parse(JSON.stringify(spriteRecord)); record.id=undefined; record.name=`Stress Sprite ${i}`; record.position=[(i%40)-20,Math.floor(i/40)*.04,-5]; addPlaced(instantiateSpriteRecord(record,new Opus.Vec3(...record.position))); }
      for(let i=0;i<250;i++){ const e=app.addEntity({mesh:cubeMesh,color:[.2,.7,1],position:new Opus.Vec3((i%25)-12,1,-2),scale:new Opus.Vec3(.2,.2,.2)}); e.alpha=.4; e.spritePassRelation='behind-sprites'; addPlaced({kind:'cube',entity:e,behaviors:[],spritePassRelation:'behind-sprites'}); }
      for(let i=0;i<250;i++){ const e=app.addEntity({mesh:cubeMesh,color:[1,.4,.3],position:new Opus.Vec3((i%25)-12,2,2),scale:new Opus.Vec3(.2,.2,.2)}); e.alpha=.4; e.spritePassRelation='in-front-of-sprites'; addPlaced({kind:'cube',entity:e,behaviors:[],spritePassRelation:'in-front-of-sprites'}); }
      for(let i=0;i<249;i++){ const e=app.addEntity({mesh:cubeMesh,color:[.5,.5,.5],position:new Opus.Vec3((i%25)-12,0,-4),scale:new Opus.Vec3(.2,.2,.2)}); addPlaced({kind:'cube',entity:e,behaviors:[],spritePassRelation:'behind-sprites'}); }
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return { sprites:placed.filter(item=>item.kind==='sprite').length, behind:placed.filter(item=>item.kind==='cube'&&item.entity.alpha<1&&item.entity.spritePassRelation==='behind-sprites').length, front:placed.filter(item=>item.kind==='cube'&&item.entity.alpha<1&&item.entity.spritePassRelation==='in-front-of-sprites').length, opaque:placed.filter(item=>item.kind==='cube'&&item.entity.alpha>=1).length, elapsedMs:performance.now()-started };
    });
    await context.close();
    report.checks.editable = await inspectExport(browser, editable, false); report.checks.playable = await inspectExport(browser, playable, true);
    assert(report.checks.inspector.relationVisible && report.checks.inspector.value === 'in-front-of-sprites');
    assert(report.checks.spriteReadOnly.includes('read-only')); assert(report.checks.projectHelp.includes('Opaque 3D')); assert(report.checks.validation.includes('No structured authoring issues'));
    assert.strictEqual(report.checks.cameraSwitch.perspective.projection,'perspective'); assert.strictEqual(report.checks.cameraSwitch.orthographic.projection,'orthographic');
    assert.deepStrictEqual(report.checks.duplicate,{relation:'in-front-of-sprites',runtime:'in-front-of-sprites',billboard:true});
    assert(report.checks.stress.sprites >= 1000 && report.checks.stress.behind >= 250 && report.checks.stress.front >= 250 && report.checks.stress.opaque >= 250);
    assert(report.checks.editable.pass && report.checks.playable.pass); assert.deepStrictEqual(report.errors,[]);
    report.status='passed'; report.ok=true;
    fs.writeFileSync(REPORT, `${JSON.stringify(report,null,2)}\n`); console.log(`Phase 029 browser/export/stress audit passed: ${report.checks.stress.sprites} sprites, ${report.checks.stress.behind} behind, ${report.checks.stress.front} front, ${report.checks.stress.opaque} opaque`);
  } catch (error) { report.status='failed'; report.ok=false; report.failure=error.stack; fs.writeFileSync(REPORT,`${JSON.stringify(report,null,2)}\n`); console.error(error.stack||error); process.exitCode=1; }
  finally { if(browser) await browser.close(); server.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
