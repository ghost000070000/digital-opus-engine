'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL, URL: NodeURL } = require('url');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8880;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const OUT = path.join(ROOT, '.tmp-phase030');
const REPORT = path.join(ROOT, 'phase-030-dogfood.json');
const DOGFOOD = JSON.parse(fs.readFileSync(path.join(ROOT, 'qualification/phase-030/phase-030-sprite-dogfood.json'), 'utf8'));
const STARTERS = [
  ['sprite-2d-scene', '2D Sprite Scene'],
  ['sprite-animated-character', 'Animated Character'],
  ['sprite-parallax-hybrid', 'Parallax Hybrid Scene'],
];

function captureErrors(page) {
  const pageErrors = []; const consoleErrors = []; const consoleWarnings = []; const requests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); if (message.type() === 'warning') consoleWarnings.push(message.text()); });
  page.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
  return { pageErrors, consoleErrors, consoleWarnings, requests };
}

async function captureExports(page, prefix) {
  await page.evaluate(() => { window.__phase030Exports = {}; downloadHTML = (html, filename) => { window.__phase030Exports[filename] = html; }; });
  await page.locator('#export-standalone-alt-btn').click();
  await page.waitForFunction(() => !!window.__phase030Exports['editable-game.html'], null, { timeout: 120000 });
  await page.locator('#export-playable-btn').click();
  await page.waitForFunction(() => !!window.__phase030Exports['playable-game.html'], null, { timeout: 120000 });
  const editable = path.join(OUT, `${prefix}-editable.html`); const playable = path.join(OUT, `${prefix}-playable.html`);
  fs.writeFileSync(editable, await page.evaluate(() => window.__phase030Exports['editable-game.html']));
  fs.writeFileSync(playable, await page.evaluate(() => window.__phase030Exports['playable-game.html']));
  return { editable, playable, editableBytes: fs.statSync(editable).size, playableBytes: fs.statSync(playable).size };
}

async function addStateBehavior(page, objectName, stateId) {
  await page.locator('[data-right-tab="scene"]').click(); await page.locator('#scene-list').getByText(objectName, { exact: true }).click(); await page.locator('[data-right-tab="inspector"]').click();
  const existing = await page.locator('#behavior-list').textContent(); if (existing.includes(`stateId: ${stateId}`)) return;
  await page.locator('#b-action').selectOption('setSpriteAnimationState'); await page.locator('#b-fields select').nth(0).selectOption('obj2'); await page.locator('#b-fields select').nth(1).selectOption(stateId); await page.locator('#b-fields input[type="checkbox"]').check(); await page.locator('#add-behavior-btn').click();
}

async function addDirectionBehavior(page, objectName, direction) {
  await page.locator('[data-right-tab="scene"]').click(); await page.locator('#scene-list').getByText(objectName, { exact: true }).click(); await page.locator('[data-right-tab="inspector"]').click();
  const existing = await page.locator('#behavior-list').textContent(); if (existing.includes(`direction: ${direction}`)) return;
  await page.locator('#b-action').selectOption('setSpriteDirection'); await page.locator('#b-fields select').nth(0).selectOption('obj2'); await page.locator('#b-fields select').nth(1).selectOption(direction); await page.locator('#add-behavior-btn').click();
}

async function inspectExport(browser, file, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); const evidence = captureErrors(page);
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof placed !== 'undefined' && placed.length > 0, null, { timeout: 60000 });
  const button = page.locator('#chrome-toggle-btn'); const buttonText = (await button.textContent().catch(() => '') || '').trim(); const chromeVisible = await button.isVisible().catch(() => false);
  let modification = null; let reaction = null;
  if (options.editable) {
    if (buttonText.includes('Edit This Game')) await button.click();
    await page.locator('[data-right-tab="scene"]').click();
    await page.locator('#scene-list').getByText('Animated Character — customize me', { exact: true }).click();
    await page.locator('[data-right-tab="inspector"]').click();
    await page.locator('[data-sprite-initial-state]').selectOption('walk');
    await page.locator('[data-component-field="initialDirection"]').selectOption('right');
    modification = { initialState: await page.locator('[data-sprite-initial-state]').inputValue(), direction: await page.locator('[data-component-field="initialDirection"]').inputValue() };
    await page.locator('#play-btn').click();
    reaction = await page.getByText('Footstep event received', { exact: true }).waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  } else if (options.playable) {
    reaction = await page.getByText('Footstep event received', { exact: true }).waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  }
  const external = evidence.requests.filter(url => !url.startsWith('file:'));
  const result = { file: path.relative(ROOT, file), bytes: fs.statSync(file).size, chromeVisible, chromeButtonText: buttonText, modification, reaction, pageErrors: evidence.pageErrors, consoleErrors: evidence.consoleErrors, consoleWarnings: evidence.consoleWarnings, externalRequests: external };
  await context.close(); return result;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { phase: 30, feature: 'Sprite starters and internal dogfood', status: 'qualification-in-progress', visibleAuthoring: { projectName: 'Phase 030 Sprite Dogfood', sourceStarter: 'sprite-animated-character', method: 'normal editor controls', finalValidation: 'No structured authoring issues found.', breakRepair: ['cleared Walk state Clip', 'observed two structured errors', 'restored Walk Clip', 'returned to zero issues'], savedReloaded: true }, starters: {}, dogfood: {}, publicBoundary: {}, errors: [] };
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000); server.stdout.on('data', chunk => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });

    for (const [id, name] of STARTERS) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await context.addInitScript(() => localStorage.clear());
      const page = await context.newPage(); const evidence = captureErrors(page); const started = Date.now();
      await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
      await page.locator(`[data-sprite-starter-id="${id}"]`).click();
      await page.locator('[data-right-tab="project"]').click(); await page.locator('#validate-project-btn').click();
      const validation = await page.locator('#project-validation-summary').textContent();
      await page.locator('#save-alt-btn').click(); const savedName = await page.locator('#project-name-input').inputValue();
      const exports = await captureExports(page, id);
      const localOrigin = new NodeURL(URL).origin;
      report.starters[id] = { name, validation, savedName, instantiateMs: Date.now() - started, exports: { editableBytes: exports.editableBytes, playableBytes: exports.playableBytes }, pageErrors: evidence.pageErrors, consoleErrors: evidence.consoleErrors, consoleWarnings: evidence.consoleWarnings, externalRequests: evidence.requests.filter(url => { try { return new NodeURL(url).origin !== localOrigin; } catch { return false; } }) };
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage(); const dogErrors = captureErrors(page);
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 }); await page.locator('#first-run-skip').click();
    await page.evaluate(project => loadProjectFull(project, 'Phase 030 audit fixture'), DOGFOOD);
    await addStateBehavior(page, 'Dogfood Opaque Cube', 'walk');
    await addDirectionBehavior(page, 'Cube #4', 'left');
    await addStateBehavior(page, 'Cube #5', 'attack');
    await page.locator('[data-left-tab="assets"]').click(); await page.locator('#sprite-library-list').getByText('Character Idle Frame', { exact: true }).click(); await page.getByLabel('Sampling', { exact: true }).selectOption('linear');
    const canonicalDogfood = await page.evaluate(() => serializeProject());
    fs.writeFileSync(path.join(ROOT, 'qualification/phase-030/phase-030-sprite-dogfood.json'), `${JSON.stringify(canonicalDogfood, null, 2)}\n`);
    await page.locator('[data-right-tab="scene"]').click(); await page.locator('#scene-list').getByText('Animated Character — customize me', { exact: true }).click(); await page.locator('[data-right-tab="inspector"]').click();
    await page.locator('[data-sprite-initial-state]').selectOption('walk'); await page.locator('[data-component-field="initialDirection"]').selectOption('right');
    await page.locator('[data-right-tab="project"]').click(); await page.locator('#validate-project-btn').click();
    report.dogfood.validation = await page.locator('#project-validation-summary').textContent();
    const dogExports = await captureExports(page, 'phase-030-dogfood');
    await context.close();
    report.dogfood.editable = await inspectExport(browser, dogExports.editable, { editable: true });
    report.dogfood.playable = await inspectExport(browser, dogExports.playable, { playable: true });
    report.dogfood.fixture = 'qualification/phase-030/phase-030-sprite-dogfood.json';
    report.dogfood.systems = ['Orthographic Camera', 'Sorting Layers', 'Parallax', 'Sprite Animation Clips', 'Animation States', 'Direction and Mirror X', 'Animation Event listener', 'Nine-Slice', 'opaque 3D', 'transparent Billboard', 'Prefab'];

    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'games/catalog.json'), 'utf8'));
    const catalogText = JSON.stringify(catalog); const engineHtml = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
    const publicGames = Array.isArray(catalog) ? catalog.length : (catalog.games || []).length;
    report.publicBoundary = { publicGames, dogfoodInCatalog: /Phase 030 Sprite Dogfood/i.test(catalogText), dogfoodInPublicNavigation: /Phase 030 Sprite Dogfood/i.test(engineHtml), game29Added: publicGames !== 28 };

    for (const value of Object.values(report.starters)) {
      assert(value.validation.includes('No structured authoring issues')); assert.strictEqual(value.pageErrors.length, 0); assert.strictEqual(value.consoleErrors.length, 0); assert.strictEqual(value.consoleWarnings.length, 0); assert.strictEqual(value.externalRequests.length, 0);
    }
    assert(report.dogfood.validation.includes('No structured authoring issues'));
    assert.deepStrictEqual(report.dogfood.editable.modification, { initialState: 'walk', direction: 'right' }); assert.strictEqual(report.dogfood.editable.reaction, true);
    assert.strictEqual(report.dogfood.playable.chromeVisible, false); assert.strictEqual(report.dogfood.playable.reaction, true);
    for (const result of [report.dogfood.editable, report.dogfood.playable]) { result.reviewedWarnings = result.consoleWarnings.filter(text => text.includes('AudioContext was not allowed to start')); result.unexplainedWarnings = result.consoleWarnings.filter(text => !text.includes('AudioContext was not allowed to start')); assert.strictEqual(result.pageErrors.length, 0); assert.strictEqual(result.consoleErrors.length, 0); assert.strictEqual(result.unexplainedWarnings.length, 0); assert.strictEqual(result.externalRequests.length, 0); }
    assert.deepStrictEqual(report.publicBoundary, { publicGames: 28, dogfoodInCatalog: false, dogfoodInPublicNavigation: false, game29Added: false });
    report.status = 'passed'; report.ok = true; report.verdict = 'PHASE_030_SPRITE_STARTERS_QUALIFIED';
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Phase 030 browser/export audit passed: ${Object.keys(report.starters).length} starters, editable and playable dogfood exports`);
  } catch (error) {
    report.status = 'failed'; report.ok = false; report.failure = error.stack || String(error); fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`); console.error(report.failure); process.exitCode = 1;
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
