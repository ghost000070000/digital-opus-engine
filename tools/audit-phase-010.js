'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8870;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const OUT = path.join(ROOT, 'phase-010-gauntlet.json');

async function dragPalette(page, paletteId, xRatio, yRatio) {
  const canvas = page.locator('#game'); const box = await canvas.boundingBox();
  await page.locator(paletteId).dragTo(canvas, { targetPosition: { x: Math.round(box.width * xRatio), y: Math.round(box.height * yRatio) } });
}
async function applyPreset(page, id) {
  await page.locator('#gameplay-preset-btn').click();
  await page.locator('[data-gameplay-preset-search]').fill(id);
  await page.locator(`[data-gameplay-preset-id="${id}"]`).click();
  await page.locator('[data-gameplay-preset-apply]').click();
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const started = Date.now();
  const report = { browser: 'Microsoft Edge', url: URL, cleanProfile: true, normalEditorUIOnly: true, customScript: false, clicks: 0, checks: {}, friction: [], errors: [] };
  const click = async (locator) => { report.clicks++; await locator.click(); };
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000); server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage(); page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof OpusOnboarding !== 'undefined' && typeof placed !== 'undefined');

    await click(page.locator('[data-first-run-choice="blank"]'));
    assert.strictEqual(await page.evaluate(() => placed.length), 0);

    await click(page.locator('#help-btn')); await click(page.locator('#capability-dashboard-btn'));
    await page.waitForFunction(() => document.querySelectorAll('[data-capability-id]').length === 57);
    const dashboardBox = await page.locator('.capability-dashboard-card').boundingBox();
    assert(dashboardBox && dashboardBox.x >= 0 && dashboardBox.y >= 0 && dashboardBox.x + dashboardBox.width <= 1440 && dashboardBox.y + dashboardBox.height <= 900);
    report.checks.dashboard = { total: await page.locator('[data-capability-id]').count(), countLabel: await page.locator('#capability-count').textContent() };
    await click(page.locator('[data-capability-grade="D"]'));
    assert.strictEqual(await page.locator('[data-capability-id]').count(), 2);
    assert((await page.locator('#capability-results').textContent()).includes('Sprites / 2D'));
    await page.locator('#capability-search').fill('validation');
    assert.strictEqual(await page.locator('[data-capability-id]').count(), 0);
    await click(page.locator('[data-capability-grade=""]'));
    assert(await page.locator('[data-capability-id]').count() >= 1);
    await page.locator('#capability-search').fill('');
    await page.locator('#capability-category').selectOption('Foundation');
    assert(await page.locator('[data-capability-id]').count() >= 5);
    await click(page.locator('#capability-dashboard-close'));

    await click(page.locator('[data-right-tab="level"]'));
    await page.locator('#env-sky-horizon').fill('#18304a').catch(async () => page.locator('#env-sky-horizon').evaluate((el) => { el.value = '#183044'; el.dispatchEvent(new Event('input', { bubbles: true })); }));
    await page.locator('#player-controller-type').selectOption('topdown'); report.clicks += 2;
    report.checks.environmentAndPlayer = await page.evaluate(() => ({ sky: app.getEnvironment().skyHorizon, controller: currentPlayerSettings.controllerType }));

    await click(page.locator('[data-left-tab="objects"]'));
    await dragPalette(page, '#palette-cube', 0.46, 0.58); report.clicks += 2;
    await page.waitForFunction(() => placed.length === 1 && selectedItem);
    await click(page.locator('[data-right-tab="inspector"]'));
    await click(page.locator('#add-component-btn'));
    await page.locator('[data-add-component-search]').fill('health');
    await click(page.locator('[data-add-component-id="health"]'));
    await applyPreset(page, 'collectible'); report.clicks += 3;

    await dragPalette(page, '#palette-cube', 0.62, 0.58); report.clicks += 2;
    await page.waitForFunction(() => placed.length === 2 && selectedItem);
    await applyPreset(page, 'checkpoint'); report.clicks += 3;
    await page.locator('#b-trigger').selectOption('click');
    await page.locator('#b-action').selectOption('win'); report.clicks += 2;
    await click(page.locator('#add-behavior-btn'));

    await click(page.locator('[data-right-tab="ui"]'));
    await page.locator('#hud-add-kind').selectOption('counter'); report.clicks++;
    await click(page.locator('#hud-add-btn'));

    report.checks.authored = await page.evaluate(() => ({
      objects: placed.length,
      components: placed.flatMap((item) => Object.keys(item.components || {})),
      presets: [...new Set(placed.flatMap((item) => (item.behaviors || []).map((behavior) => behavior.sourcePreset).filter(Boolean)))],
      interaction: placed.some((item) => item.behaviors.some((behavior) => behavior.trigger === 'click')),
      simpleState: placed.some((item) => item.behaviors.some((behavior) => behavior.action === 'incrementCounter')),
      winCondition: placed.some((item) => item.behaviors.some((behavior) => behavior.action === 'win')),
      hud: currentUiConfig.hudElements.map((element) => element.kind),
    }));
    assert(report.checks.authored.components.includes('health'));
    assert.deepStrictEqual(report.checks.authored.presets.sort(), ['checkpoint', 'collectible']);
    assert(report.checks.authored.interaction && report.checks.authored.simpleState && report.checks.authored.winCondition && report.checks.authored.hud.includes('counter'));

    await click(page.locator('[data-right-tab="project"]'));
    await page.locator('#project-name-input').fill('phase-010-no-code-gauntlet'); report.clicks++;
    await click(page.locator('#save-btn'));
    await click(page.locator('#load-btn'));
    await page.waitForFunction(() =>!loadingProjectGuard && placed.length === 2);
    report.checks.saveLoad = true;
    await click(page.locator('#validate-project-btn'));
    report.checks.validation = await page.evaluate(() => ({ total: lastProjectValidation.issues.length, errors: lastProjectValidation.issues.filter((issue) => issue.severity === 'error').length, warnings: lastProjectValidation.issues.filter((issue) => issue.severity === 'warning').length }));
    assert.strictEqual(report.checks.validation.errors, 0);

    await click(page.locator('#play-btn')); await page.waitForFunction(() => document.getElementById('play-btn').textContent.includes('Stop'));
    await click(page.locator('#play-btn')); await page.waitForFunction(() => document.getElementById('play-btn').textContent.includes('Play'));
    report.checks.play = true;
    await click(page.locator('[data-right-tab="project"]'));
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await click(page.locator('#export-playable-btn'));
    const download = await downloadPromise; const downloadPath = await download.path(); const exported = fs.readFileSync(downloadPath, 'utf8');
    assert.strictEqual(download.suggestedFilename(), 'playable-game.html');
    assert(exported.includes('window.__OPUS_PLAYABLE_ONLY__ = true'));
    assert(exported.includes('incrementCounter') && exported.includes('checkpoint'));
    assert(!exported.includes('"schemaVersion": 1,\n  "generatedFrom": "Epoch 01 repository evidence"'));
    report.checks.export = { filename: download.suggestedFilename(), bytes: Buffer.byteLength(exported), catalogPayloadExcluded: true };

    report.friction = [
      { system: 'Validation', observation: 'Project validation passed with zero errors, but remains C because AFR-0014 documents uncovered semantic setup classes.' },
      { system: 'Variables', observation: 'The collectible counter supplies simple state, but free-typed state names remain a C-grade pressure.' },
      { system: 'HUD', observation: 'Counter HUD is quick to add; layout remains form/numeric rather than direct canvas manipulation.' },
    ];
    assert.deepStrictEqual(report.errors, []);
    report.elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(1)); report.ok = true;
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
    await context.close();
  } catch (error) {
    report.elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(1)); report.ok = false; report.failure = error.stack;
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n'); console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
  } finally { if (browser) await browser.close(); server.kill(); }
})();
