'use strict';
// Explicit UI regression fixture: synthetic endGame calls test only the modal.
// This is NOT gameplay-completion evidence and produces no showcase screenshots.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const output = path.join(ROOT, 'rehabilitation-evidence', 'modal-regression');
  fs.mkdirSync(output, { recursive: true });
  const report = { method: 'Synthetic ending UI fixture only; real Start/canvas/Restart clicks, no force clicks, no gameplay verdict, no public screenshots.', buildSHA256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'dist/games/arsenal-run.html'))).digest('hex'), cases: [], errors: [] };
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto('http://localhost:8837/dist/games/arsenal-run.html', { waitUntil: 'load', timeout: 60000 });
    for (const result of ['win', 'lose']) {
      await page.locator('#start-overlay-btn').click();
      await page.locator('canvas').click({ position: { x: 640, y: 360 } });
      await page.waitForFunction(() => document.pointerLockElement !== null, { timeout: 5000 });
      const before = await page.evaluate(() => ({ locked: document.pointerLockElement === canvas, ended: gameEnded }));
      assert(before.locked && !before.ended, 'actual canvas click must lock the live first-person session');
      await page.evaluate(ending => endGame(ending), result);
      await page.waitForFunction(() => document.pointerLockElement === null, { timeout: 5000 });
      const title = await page.locator('#end-overlay-title').textContent();
      await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }), page.getByRole('button', { name: 'Restart', exact: true }).click()]);
      await page.locator('#start-overlay.visible').waitFor({ state: 'visible', timeout: 10000 });
      const after = await page.evaluate(() => ({ ended: gameEnded, locked: !!document.pointerLockElement, title: document.querySelector('#start-overlay-title').textContent }));
      assert(!after.ended && !after.locked && after.title === 'Arsenal Run', 'normal Restart click must restore the fresh Start Screen');
      report.cases.push({ syntheticEnding: result, title, pointerReleased: true, ordinaryRestartClick: true, freshStartScreen: after.title });
    }
    assert.deepStrictEqual(report.errors, []);
    report.ok = true;
  } catch (error) {
    report.ok = false; report.failure = error.stack; throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

