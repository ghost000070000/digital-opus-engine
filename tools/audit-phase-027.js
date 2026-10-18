'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8877;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'phase-026-nine-slice-panel.png');
const OUT_DIR = path.join(ROOT, '.tmp-phase027');
const REPORT = path.join(ROOT, 'phase-027-export-proof.json');

async function inspectExport(browser, file, playableOnly) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = []; const network = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof placed !== 'undefined' && placed.some((item) => item.name === 'Phase 027 Foreground'));
  const runtime = await page.evaluate(() => {
    const rows = placed.filter((item) => item.kind === 'sprite').map((item) => {
      const component = item.components['sprite-renderer'];
      const before = [item.entity.position.x, item.entity.position.y, item.entity.position.z];
      const factors = OpusAuthoringPlumbing.resolveParallaxFactors(component.parallaxLayerRef, parallaxLayers);
      const offset = OpusAuthoringPlumbing.spriteParallaxOffset({ x: 20, y: 10 }, { x: 0, y: 0 }, factors);
      const after = [item.entity.position.x, item.entity.position.y, item.entity.position.z];
      return { name: item.name, ref: component.parallaxLayerRef, renderMode: component.renderMode, before, after, factors, offset };
    });
    return { layers: parallaxLayers, rows };
  });
  const chromeVisible = await page.locator('#chrome-toggle-btn').isVisible();
  let editorOpened = false; let managerVisible = false; let pickerVisible = false;
  if (!playableOnly && chromeVisible) {
    const start = page.locator('#start-overlay-btn');
    if (await start.isVisible()) await start.click();
    await page.locator('#chrome-toggle-btn').click();
    editorOpened = await page.locator('#app').evaluate((element) => !element.classList.contains('editor-hidden'));
    await page.locator('[data-right-tab="project"]').click();
    managerVisible = await page.locator('#parallax-layer-list').isVisible();
    await page.locator('[data-right-tab="scene"]').click();
    await page.getByText('Phase 027 Far', { exact: true }).click();
    await page.locator('[data-right-tab="inspector"]').click();
    pickerVisible = await page.getByRole('combobox', { name: 'Parallax Layer' }).isVisible();
  }
  const byName = Object.fromEntries(runtime.rows.map((row) => [row.name, row]));
  const expectedLayers = [
    ['far', 'Far Sky', .1, .1], ['mountains', 'Distant Mountains', .45, .45],
    ['trees', 'Trees', .6, .6], ['foreground', 'Foreground', 1.2, 1.2], ['lock-x', 'Screen Lock X', 0, 1],
  ];
  const layersPass = expectedLayers.every(([id, name, factorX, factorY]) => runtime.layers.some((layer) => layer.id === id && layer.name === name && layer.factorX === factorX && layer.factorY === factorY));
  const transformsPass = runtime.rows.every((row) => JSON.stringify(row.before) === JSON.stringify(row.after));
  const result = { file: path.relative(ROOT, file), bytes: fs.statSync(file).size, playableOnly, chromeVisible, editorOpened, managerVisible, pickerVisible, runtime, errors, network };
  result.pass = layersPass && transformsPass && runtime.rows.length === 6 &&
    byName['Phase 027 World'].factors.factorX === 1 && byName['Phase 027 World'].offset.x === 0 &&
    byName['Phase 027 Lock X'].offset.x === 20 && Math.abs(byName['Phase 027 Foreground'].offset.x + 4) < 1e-9 &&
    byName['Phase 027 Nine-Slice'].renderMode === 'nine-slice' && errors.length === 0 && network.length === 0 &&
    (playableOnly ? !chromeVisible : editorOpened && managerVisible && pickerVisible);
  await context.close();
  return result;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { phase: 27, url: URL, fixture: path.relative(ROOT, FIXTURE), checks: {}, errors: [] };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000);
      server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
      server.once('error', reject);
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof placed !== 'undefined' && typeof spriteAssets !== 'undefined');
    if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
    await page.locator('[data-left-tab="assets"]').click();
    await page.locator('#import-sprite-input').setInputFiles(FIXTURE);
    await page.waitForFunction(() => spriteAssets.length === 1);
    await page.evaluate(() => {
      const asset = spriteAssets[0];
      asset.name = 'Phase 027 Proof Asset'; asset.nineSlice = { left: 8, right: 16, top: 6, bottom: 12 };
      parallaxLayers = [
        OpusAuthoringPlumbing.createParallaxLayer('far', 'Far Sky', .1, .1),
        OpusAuthoringPlumbing.createParallaxLayer('mountains', 'Distant Mountains', .45, .45),
        OpusAuthoringPlumbing.createParallaxLayer('trees', 'Trees', .6, .6),
        OpusAuthoringPlumbing.createParallaxLayer('foreground', 'Foreground', 1.2, 1.2),
        OpusAuthoringPlumbing.createParallaxLayer('lock-x', 'Screen Lock X', 0, 1),
      ];
      const specs = [
        ['Phase 027 Far', 'far', 'simple'], ['Phase 027 Mountains', 'mountains', 'simple'],
        ['Phase 027 Trees', 'trees', 'simple'], ['Phase 027 Foreground', 'foreground', 'simple'],
        ['Phase 027 Lock X', 'lock-x', 'simple'], ['Phase 027 World', null, 'simple'],
      ];
      specs.forEach(([name, ref, renderMode], index) => {
        const item = placeSpriteAssetInstance(asset, new Opus.Vec3(index * 2, index, -index));
        item.name = name; const component = item.components['sprite-renderer'];
        component.parallaxLayerRef = ref; component.renderMode = renderMode;
        if (name === 'Phase 027 Mountains') { component.renderMode = 'nine-slice'; item.name = 'Phase 027 Nine-Slice'; }
        syncSpriteRenderer(item);
      });
      renderParallaxLayerManager(); validateCurrentProject();
    });
    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#validate-project-btn').click();
    report.checks.validation = await page.locator('#project-validation-summary').textContent();
    assert(report.checks.validation.includes('No structured authoring issues'));
    await page.evaluate(() => { window.__phase027Exports = {}; downloadHTML = (html, filename) => { window.__phase027Exports[filename] = html; }; });
    await page.locator('#export-standalone-alt-btn').click();
    await page.waitForFunction(() => !!window.__phase027Exports['editable-game.html'], null, { timeout: 120000 });
    await page.locator('#export-playable-btn').click();
    await page.waitForFunction(() => !!window.__phase027Exports['playable-game.html'], null, { timeout: 120000 });
    const editablePath = path.join(OUT_DIR, 'phase-027-editable.html');
    const playablePath = path.join(OUT_DIR, 'phase-027-playable.html');
    fs.writeFileSync(editablePath, await page.evaluate(() => window.__phase027Exports['editable-game.html']));
    fs.writeFileSync(playablePath, await page.evaluate(() => window.__phase027Exports['playable-game.html']));
    await context.close();
    report.checks.editable = await inspectExport(browser, editablePath, false);
    report.checks.playable = await inspectExport(browser, playablePath, true);
    assert(report.checks.editable.pass); assert(report.checks.playable.pass); assert.deepStrictEqual(report.errors, []);
    report.ok = true;
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Phase 027 export audit passed: editable ${report.checks.editable.bytes} bytes, playable ${report.checks.playable.bytes} bytes`);
  } catch (error) {
    report.ok = false; report.failure = error.stack;
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.error(error.stack || error); process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
