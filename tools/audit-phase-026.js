'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8876;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const PANEL = path.join(ROOT, 'tests', 'fixtures', 'phase-026-nine-slice-panel.png');
const ATLAS = path.join(ROOT, 'tests', 'fixtures', 'phase-026-nine-slice-atlas.png');
const OUT_DIR = path.join(ROOT, '.tmp-phase026');
const REPORT = path.join(ROOT, 'phase-026-export-proof.json');

async function inspectExport(browser, file, playableOnly) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const network = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof placed !== 'undefined' && placed.some((item) => item.name === 'Phase 026 Atlas')); 
  const runtime = await page.evaluate(() => {
    const byName = (name) => placed.find((item) => item.name === name);
    const describe = (name) => {
      const item = byName(name);
      const component = item.components['sprite-renderer'];
      syncSpriteRenderer(item);
      const cells = item.entity.spriteNineSliceCells;
      return {
        name,
        renderMode: component.renderMode,
        width: component.width,
        height: component.height,
        flipX: component.flipX,
        flipY: component.flipY,
        cellCount: cells ? cells.length : 0,
        finite: !cells || cells.every((cell) => Object.values(cell).flat().every((value) => typeof value !== 'number' || Number.isFinite(value))),
      };
    };
    const panel = spriteAssets.find((asset) => asset.name === 'Phase 026 Panel Asset');
    const atlas = spriteAssets.find((asset) => asset.name === 'Phase 026 Atlas Asset');
    return {
      objectCount: placed.filter((item) => item.kind === 'sprite').length,
      panelGuides: panel.nineSlice,
      atlasGuides: atlas.nineSlice,
      atlasRegion: atlas.sourceRect,
      atlasFiltering: atlas.filtering,
      sprites: [
        describe('Phase 026 Simple'),
        describe('Phase 026 Normal'),
        describe('Phase 026 Wide'),
        describe('Phase 026 Tall'),
        describe('Phase 026 Tiny'),
        describe('Phase 026 Flip X'),
        describe('Phase 026 Flip Y'),
        describe('Phase 026 Atlas'),
      ],
    };
  });
  const chromeVisible = await page.locator('#chrome-toggle-btn').isVisible();
  let editorOpened = false;
  let guideControlsVisible = false;
  if (!playableOnly && chromeVisible) {
    const start = page.locator('#start-overlay-btn');
    if (await start.isVisible()) await start.click();
    await page.locator('#chrome-toggle-btn').click();
    editorOpened = await page.locator('#app').evaluate((element) => !element.classList.contains('editor-hidden'));
    await page.locator('[data-left-tab="assets"]').click();
    await page.locator('[data-select-sprite-asset]').first().click();
    guideControlsVisible = await page.locator('[data-nine-slice-guide="left"]').isVisible();
  }
  const nineSlice = runtime.sprites.filter((sprite) => sprite.renderMode === 'nine-slice');
  const simple = runtime.sprites.find((sprite) => sprite.name === 'Phase 026 Simple');
  const tiny = runtime.sprites.find((sprite) => sprite.name === 'Phase 026 Tiny');
  const result = { file: path.relative(ROOT, file), bytes: fs.statSync(file).size, playableOnly, chromeVisible, editorOpened, guideControlsVisible, runtime, errors, network };
  result.pass = runtime.objectCount === 8 && JSON.stringify(runtime.panelGuides) === JSON.stringify({ left: 8, right: 16, top: 6, bottom: 12 }) &&
    JSON.stringify(runtime.atlasRegion) === JSON.stringify({ x: 32, y: 16, width: 64, height: 64 }) && runtime.atlasFiltering === 'nearest' &&
    simple.renderMode === 'simple' && simple.cellCount === 0 && nineSlice.length === 7 && nineSlice.every((sprite) => sprite.finite) &&
    nineSlice.filter((sprite) => sprite.name !== 'Phase 026 Tiny').every((sprite) => sprite.cellCount === 9) && tiny.cellCount >= 4 && tiny.cellCount <= 9 &&
    tiny.width === 0.15 && tiny.height === 0.12 && errors.length === 0 && network.length === 0 &&
    (playableOnly ? !chromeVisible : editorOpened && guideControlsVisible);
  await context.close();
  return result;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { phase: 26, url: URL, fixtures: [path.relative(ROOT, PANEL), path.relative(ROOT, ATLAS)], checks: {}, errors: [] };
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
    await page.locator('#import-sprite-input').setInputFiles(PANEL);
    await page.waitForFunction(() => spriteAssets.length === 1);
    await page.locator('#import-sprite-input').setInputFiles(ATLAS);
    await page.waitForFunction(() => spriteAssets.length === 2);
    await page.evaluate(() => {
      const panel = spriteAssets[0];
      const atlas = spriteAssets[1];
      panel.name = 'Phase 026 Panel Asset';
      panel.nineSlice = { left: 8, right: 16, top: 6, bottom: 12 };
      atlas.name = 'Phase 026 Atlas Asset';
      atlas.sourceRect = { x: 32, y: 16, width: 64, height: 64 };
      atlas.filtering = 'nearest';
      atlas.nineSlice = { left: 8, right: 16, top: 6, bottom: 12 };
      const specs = [
        ['Phase 026 Simple', panel, 'simple', 0.64, 0.64, false, false],
        ['Phase 026 Normal', panel, 'nine-slice', 2, 2, false, false],
        ['Phase 026 Wide', panel, 'nine-slice', 6, 1, false, false],
        ['Phase 026 Tall', panel, 'nine-slice', 1, 5, false, false],
        ['Phase 026 Tiny', panel, 'nine-slice', 0.15, 0.12, false, false],
        ['Phase 026 Flip X', panel, 'nine-slice', 3, 2, true, false],
        ['Phase 026 Flip Y', panel, 'nine-slice', 3, 2, false, true],
        ['Phase 026 Atlas', atlas, 'nine-slice', 4, 2, false, false],
      ];
      specs.forEach(([name, asset, renderMode, width, height, flipX, flipY], index) => {
        const item = placeSpriteAssetInstance(asset, new Opus.Vec3((index % 4) * 2, 1, Math.floor(index / 4) * 2));
        item.name = name;
        const component = item.components['sprite-renderer'];
        component.renderMode = renderMode;
        component.width = width;
        component.height = height;
        component.flipX = flipX;
        component.flipY = flipY;
        if (name === 'Phase 026 Atlas') { component.tint = '#d8f8ff'; component.opacity = 0.85; }
        syncSpriteRenderer(item);
      });
      renderSpriteLibrary();
      validateCurrentProject();
    });
    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#validate-project-btn').click();
    report.checks.validation = await page.locator('#project-validation-summary').textContent();
    assert(report.checks.validation.includes('No structured authoring issues'));
    await page.evaluate(() => { window.__phase026Exports = {}; downloadHTML = (html, filename) => { window.__phase026Exports[filename] = html; }; });
    await page.locator('#export-standalone-alt-btn').click();
    await page.waitForFunction(() => !!window.__phase026Exports['editable-game.html'], null, { timeout: 120000 });
    await page.locator('#export-playable-btn').click();
    await page.waitForFunction(() => !!window.__phase026Exports['playable-game.html'], null, { timeout: 120000 });
    const editablePath = path.join(OUT_DIR, 'phase-026-editable.html');
    const playablePath = path.join(OUT_DIR, 'phase-026-playable.html');
    fs.writeFileSync(editablePath, await page.evaluate(() => window.__phase026Exports['editable-game.html']));
    fs.writeFileSync(playablePath, await page.evaluate(() => window.__phase026Exports['playable-game.html']));
    await context.close();
    report.checks.editable = await inspectExport(browser, editablePath, false);
    report.checks.playable = await inspectExport(browser, playablePath, true);
    assert(report.checks.editable.pass);
    assert(report.checks.playable.pass);
    assert.deepStrictEqual(report.errors, []);
    report.ok = true;
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.ok = false;
    report.failure = error.stack;
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
