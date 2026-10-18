'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8869;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const OUT = path.join(ROOT, 'phase-009-dogfood.json');

async function applyCollectible(page) {
  await page.locator('#gameplay-preset-btn').click();
  const search = page.locator('[data-gameplay-preset-search]');
  await search.fill('collectible');
  await page.locator('[data-gameplay-preset-id="collectible"]').click();
  await page.locator('[data-gameplay-preset-apply]').click();
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const started = Date.now();
  const report = { url: URL, browser: 'Microsoft Edge', cleanProfile: true, clicks: 0, authoredSteps: 0, checks: {}, confusingPoints: [], frictionDiscovered: [], errors: [] };
  const click = async (locator) => { report.clicks++; await locator.click(); };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000);
      server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
      server.once('error', reject);
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof OpusOnboarding !== 'undefined' && typeof placed !== 'undefined');

    const welcome = page.locator('#first-run-overlay');
    assert(await welcome.isVisible());
    report.checks.firstRun = { visible: true, focusedChoice: await page.locator('[data-first-run-choice="blank"]').evaluate((el) => document.activeElement === el) };
    assert(report.checks.firstRun.focusedChoice);
    const welcomeBox = await page.locator('.onboarding-card').boundingBox();
    assert(welcomeBox && welcomeBox.x >= 0 && welcomeBox.y >= 0 && welcomeBox.x + welcomeBox.width <= 1366 && welcomeBox.y + welcomeBox.height <= 768);
    await click(page.locator('#first-run-skip'));
    assert(!(await welcome.isVisible()));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof OpusOnboarding !== 'undefined');
    assert(!(await welcome.isVisible()));
    report.checks.skip = true;

    await page.evaluate(() => localStorage.removeItem(OpusOnboarding.STORAGE_KEY));
    await page.reload({ waitUntil: 'load' });
    await welcome.waitFor({ state: 'visible' });
    await click(page.locator('[data-first-run-choice="guided"]'));
    await page.locator('#onboarding-coach').waitFor({ state: 'visible' });
    assert.strictEqual(await page.evaluate(() => placed.length), 0);
    assert.strictEqual(await page.locator('#project-name-input').inputValue(), 'guided-first-game');
    report.checks.guidedBlank = true;

    const canvas = page.locator('#game');
    const canvasBox = await canvas.boundingBox();
    await page.locator('#palette-cube').dragTo(canvas, { targetPosition: { x: Math.round(canvasBox.width * 0.52), y: Math.round(canvasBox.height * 0.55) } });
    report.clicks += 2; report.authoredSteps++;
    await page.waitForFunction(() => placed.length === 1 && selectedItem);
    await page.locator('#f-x').fill('2'); await page.locator('#f-x').dispatchEvent('input'); report.clicks++; report.authoredSteps++;
    await click(page.locator('#add-component-btn'));
    await page.locator('[data-add-component-search]').fill('health');
    await click(page.locator('[data-add-component-id="health"]')); report.authoredSteps++;
    await applyCollectible(page); report.clicks += 3; report.authoredSteps++;
    await page.waitForFunction(() => OpusOnboarding.evaluate(onboardingSnapshot(), onboardingStore.read()).completedCount >= 4);

    await click(page.locator('#save-btn')); report.authoredSteps++;
    const beforeReload = await page.evaluate(() => ({ count: placed.length, progress: OpusOnboarding.evaluate(onboardingSnapshot(), onboardingStore.read()).completedCount }));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof placed !== 'undefined' && placed.length === 1 && !document.getElementById('onboarding-coach').hidden);
    const afterReload = await page.evaluate(() => ({ count: placed.length, progress: OpusOnboarding.evaluate(onboardingSnapshot(), onboardingStore.read()).completedCount, project: document.getElementById('project-name-input').value }));
    assert.strictEqual(afterReload.count, beforeReload.count);
    assert(afterReload.progress >= beforeReload.progress);
    assert.strictEqual(afterReload.project, 'guided-first-game');
    report.checks.resume = { beforeReload, afterReload };

    await click(page.locator('[data-right-tab="level"]'));
    await page.locator('#player-controller-type').selectOption('thirdperson'); report.clicks++; report.authoredSteps++;
    await click(page.locator('[data-right-tab="ui"]'));
    await page.locator('#hud-add-kind').selectOption('counter'); report.clicks++;
    await click(page.locator('#hud-add-btn')); report.authoredSteps++;
    await click(page.locator('#play-btn')); report.authoredSteps++;
    await page.waitForFunction(() => document.getElementById('play-btn').textContent.includes('Stop'));
    await click(page.locator('#play-btn'));
    await page.waitForFunction(() => document.getElementById('play-btn').textContent.includes('Play'));
    await click(page.locator('#save-btn'));

    await click(page.locator('[data-right-tab="project"]'));
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await click(page.locator('#export-playable-btn')); report.authoredSteps++;
    const download = await downloadPromise;
    assert.strictEqual(download.suggestedFilename(), 'playable-game.html');
    const downloadPath = await download.path();
    const exported = fs.readFileSync(downloadPath, 'utf8');
    assert(exported.includes('window.__OPUS_PLAYABLE_ONLY__ = true'));
    assert(exported.includes('OpusOnboarding'));
    assert(exported.includes('incrementCounter'));
    await page.waitForFunction(() => onboardingStore.read().tutorial.completed === true);
    report.checks.finalExport = { filename: download.suggestedFilename(), bytes: Buffer.byteLength(exported), playableOnly: true };
    report.checks.saveLoad = await page.evaluate(() => !!app.save.load('guided-first-game'));
    report.checks.runtimeIsolation = await page.evaluate(() => { const project = serializeProject(); const text = JSON.stringify(project); return !text.includes('digital-opus:onboarding') && !text.includes('firstRunSeen') && !text.includes('tutorial'); });
    report.checks.finalProgress = await page.evaluate(() => onboardingStore.read().tutorial);
    assert(report.checks.saveLoad && report.checks.runtimeIsolation && report.checks.finalProgress.completed);

    await click(page.locator('#help-btn'));
    assert(await page.locator('#editor-help-overlay').isVisible());
    await click(page.locator('#editor-help-close'));
    await page.locator('[data-right-tab="inspector"]').click();
    const contextual = page.locator('[data-help-topic="inspector"]');
    await click(contextual);
    assert((await page.locator('#editor-help-topics').textContent()).includes('Inspector'));
    await page.keyboard.press('Escape');
    report.checks.help = true;

    report.confusingPoints = [
      'Objects are placed by dragging from the Palette; the coach highlight makes this interaction discoverable.',
      'Player is level-scoped and appears on Play, so the guide points to Level → Player Controller instead of implying a Palette object.',
      'Playable Export is nested under Project; Show me and contextual Help expose the exact control.',
    ];
    assert.deepStrictEqual(report.errors, []);
    report.elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(1));
    report.ok = true;
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    await context.close();
  } catch (error) {
    report.ok = false; report.failure = error.stack; report.elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(1));
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
  } finally { if (browser) await browser.close(); server.kill(); }
})();
