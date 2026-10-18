'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8875;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'phase-018-atlas.png');
const OUT_DIR = path.join(ROOT, '.tmp-phase025');
const REPORT = path.join(ROOT, 'phase-025-export-proof.json');

async function inspectExport(browser, file, playableOnly) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  const network = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof placed !== 'undefined' && placed.some((item) => item.name === 'Phase 025 Export Hero'));
  const runtime = await page.evaluate(() => {
    const hero = placed.find((item) => item.name === 'Phase 025 Export Hero');
    const component = hero.components['sprite-renderer'];
    Opus.setSpriteAnimationState(hero, 'walk', { restartIfActive: true });
    Opus.setSpriteDirection(hero, 'right');
    OpusAuthoringPlumbing.advanceSpriteAnimation(hero._spriteAnimationPlayback, findSpriteAnimationById(hero._spriteAnimationPlayback.clipId), 0.05);
    const right = { clipId: hero._spriteAnimationPlayback.clipId, elapsedMs: hero._spriteAnimationPlayback.elapsedMs };
    Opus.setSpriteDirection(hero, 'left');
    const left = { clipId: hero._spriteAnimationPlayback.clipId, elapsedMs: hero._spriteAnimationPlayback.elapsedMs, mirrorX: hero._spriteAnimationPlayback.directionMirrorX };
    Opus.setSpriteDirection(hero, 'up');
    const up = { clipId: hero._spriteAnimationPlayback.clipId, elapsedMs: hero._spriteAnimationPlayback.elapsedMs };
    return {
      initialDirection: component.initialDirection,
      stateIds: component.animationStates.map((state) => state.id),
      right, left, up,
      direction: Opus.getSpriteDirection(hero),
    };
  });
  const chromeVisible = await page.locator('#chrome-toggle-btn').isVisible();
  let editorOpened = false;
  if (!playableOnly && chromeVisible) {
    const start = page.locator('#start-overlay-btn');
    if (await start.isVisible()) await start.click();
    await page.locator('#chrome-toggle-btn').click();
    editorOpened = await page.locator('#app').evaluate((element) => !element.classList.contains('editor-hidden'));
  }
  const result = { file: path.relative(ROOT, file), bytes: fs.statSync(file).size, playableOnly, chromeVisible, editorOpened, runtime, errors, network };
  result.pass = runtime.initialDirection === 'down' && runtime.stateIds.join(',') === 'idle,walk,attack' &&
    runtime.right.clipId === runtime.left.clipId && runtime.right.elapsedMs === runtime.left.elapsedMs && runtime.left.mirrorX === true &&
    runtime.up.clipId === 'phase025-walk-up' && runtime.up.elapsedMs === 0 && runtime.direction === 'up' &&
    errors.length === 0 && network.length === 0 && (playableOnly ? !chromeVisible : editorOpened);
  await context.close();
  return result;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { phase: 25, url: URL, fixture: path.relative(ROOT, FIXTURE), checks: {}, errors: [] };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000);
      server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
      server.once('error', reject);
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof placed !== 'undefined' && typeof spriteAssets !== 'undefined');
    if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
    await page.locator('[data-left-tab="assets"]').click();
    await page.locator('#import-sprite-input').setInputFiles(FIXTURE);
    await page.waitForFunction(() => spriteAssets.length === 1);
    const assetId = await page.evaluate(() => spriteAssets[0].id);
    await page.locator(`[data-place-sprite-asset="${assetId}"]`).click();
    if (!(await page.locator('#f-name').isVisible())) await page.locator('#game').click({ position: { x: 500, y: 350 } });
    await page.locator('#f-name').waitFor({ state: 'visible' });
    await page.locator('#f-name').fill('Phase 025 Export Hero');
    await page.evaluate((spriteAssetRef) => {
      const makeClip = (id, name, mode, events = []) => OpusAuthoringPlumbing.createSpriteAnimationClip({
        id, name, folder: '', tags: [], playbackMode: mode,
        frames: [{ spriteAsset: spriteAssetRef, durationMs: 100, events }],
      });
      spriteAnimationClips.push(
        makeClip('phase025-idle-right', 'Idle Right', 'loop'),
        makeClip('phase025-walk-right', 'Walk Right', 'loop', [{ id: 'footstep', name: 'Footstep' }]),
        makeClip('phase025-walk-up', 'Walk Up', 'loop', [{ id: 'step-up', name: 'Step Up' }]),
        makeClip('phase025-walk-down', 'Walk Down', 'loop'),
        makeClip('phase025-attack-right', 'Attack Right', 'once'),
      );
      const component = selectedItem.components['sprite-renderer'];
      component.version = 7;
      component.flipX = false;
      component.flipY = false;
      component.initialDirection = 'down';
      component.playOnStart = true;
      component.initialAnimationStateRef = 'idle';
      component.animationStates = [
        { id: 'idle', name: 'Idle', clipRef: 'phase025-idle-right', directionalVariants: [{ direction: 'left', clipRef: null, mirrorX: true, mirrorY: false }] },
        { id: 'walk', name: 'Walk', clipRef: 'phase025-walk-right', directionalVariants: [
          { direction: 'left', clipRef: null, mirrorX: true, mirrorY: false },
          { direction: 'up', clipRef: 'phase025-walk-up', mirrorX: false, mirrorY: false },
          { direction: 'down', clipRef: 'phase025-walk-down', mirrorX: false, mirrorY: false },
        ] },
        { id: 'attack', name: 'Attack', clipRef: 'phase025-attack-right', directionalVariants: [{ direction: 'left', clipRef: null, mirrorX: true, mirrorY: false }] },
      ];
      resetSpriteAnimationForItem(selectedItem, true);
      renderInspector();
      validateCurrentProject();
    }, assetId);
    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#validate-project-btn').click();
    report.checks.validation = await page.locator('#project-validation-summary').textContent();
    report.checks.validationItems = await page.locator('#project-validation-list .project-validation-item').allTextContents();
    assert(report.checks.validation.includes('No structured authoring issues'));
    await page.evaluate(() => { window.__phase025Exports = {}; downloadHTML = (html, filename) => { window.__phase025Exports[filename] = html; }; });
    await page.locator('#export-standalone-alt-btn').click();
    await page.waitForFunction(() => !!window.__phase025Exports['editable-game.html'], null, { timeout: 120000 });
    await page.locator('#export-playable-btn').click();
    await page.waitForFunction(() => !!window.__phase025Exports['playable-game.html'], null, { timeout: 120000 });
    const editablePath = path.join(OUT_DIR, 'phase-025-editable.html');
    const playablePath = path.join(OUT_DIR, 'phase-025-playable.html');
    fs.writeFileSync(editablePath, await page.evaluate(() => window.__phase025Exports['editable-game.html']));
    fs.writeFileSync(playablePath, await page.evaluate(() => window.__phase025Exports['playable-game.html']));
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
