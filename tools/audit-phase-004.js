'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8864;
const URL = `http://127.0.0.1:${PORT}/editor/?game=arsenal-run`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlV8AAAAASUVORK5CYII=', 'base64');

async function selectObject(page, id) {
  await page.locator('[data-right-tab="scene"]').click();
  const index = await page.evaluate((objectId) => placed.findIndex((item) => item.id === objectId), id);
  assert(index >= 0, `Object ${id} must exist`);
  await page.locator(`.scene-list-item[data-index="${index}"]`).click();
  await page.locator('[data-right-tab="inspector"]').click();
}

async function addBehavior(page, action, fields) {
  await page.locator('#b-action').selectOption(action);
  for (const [key, value] of Object.entries(fields)) {
    const field = page.locator(`#b-fields [data-field="${key}"]`);
    const tag = await field.evaluate((element) => element.tagName);
    if (tag === 'SELECT') await field.selectOption(String(value));
    else await field.fill(String(value));
  }
  await page.locator('#add-behavior-btn').click();
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { url: URL, workflows: {}, observations: {}, errors: [] };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000);
      server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
      server.once('error', reject);
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof OpusAuthoringPlumbing !== 'undefined' && projectMeta.title === 'Arsenal Run');
    if (await page.locator('#app').evaluate((element) => element.classList.contains('editor-hidden'))) await page.locator('#chrome-toggle-btn').click();

    // A. Create a gameplay object and add behavior, entirely through the UI.
    await page.locator('[data-left-tab="objects"]').click();
    const beforeCount = await page.evaluate(() => placed.length);
    const paletteBox = await page.locator('#palette-cube').boundingBox();
    const canvasBox = await page.locator('#game').boundingBox();
    assert(paletteBox && canvasBox);
    await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.58, canvasBox.y + canvasBox.height * 0.62, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction((count) => placed.length === count + 1 && selectedItem, beforeCount);
    const sourceId = await page.evaluate(() => selectedItem.id);
    await page.locator('[data-right-tab="inspector"]').click();
    await addBehavior(page, 'message', { text: 'Phase 004 workflow proof' });
    const behaviorCreated = await page.evaluate((id) => {
      const item = placed.find((entry) => entry.id === id);
      return item && item.behaviors.some((behavior) => behavior.action === 'message' && behavior.param === 'Phase 004 workflow proof');
    }, sourceId);
    assert(behaviorCreated);
    report.workflows.createGameplayObject = { sourceId, objectCreated: true, behaviorCreated: true };

    // B. Configure a structured cross-object reference and preflight it.
    const targetId = await page.evaluate((id) => placed.find((item) => item.kind === 'cube' && item.id !== id).id, sourceId);
    await addBehavior(page, 'moveObject', { targetId, dx: 1 });
    const optionCount = await page.locator('#b-fields [data-field="targetId"] option').count();
    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#validate-project-btn').click();
    const referenceValid = await page.evaluate(({ sourceId: source, targetId: target }) => {
      const item = placed.find((entry) => entry.id === source);
      return item.behaviors.some((behavior) => behavior.action === 'moveObject' && behavior.params.targetId === target)
        && !lastProjectValidation.issues.some((issue) => issue.objectId === source && issue.referenceValue === target);
    }, { sourceId, targetId });
    assert(referenceValid && optionCount > 1);
    report.workflows.crossObjectReference = { sourceId, targetId, optionCount, referenceValid, preflightRun: true };

    // C. Import a real image file, inspect its library affordances, then use it on the object.
    await page.locator('[data-left-tab="assets"]').click();
    const textureCount = await page.evaluate(() => textureAssets.length);
    await page.locator('#import-texture-input').setInputFiles({ name: 'phase-004-proof.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction((count) => textureAssets.length === count + 1, textureCount);
    const textureId = await page.evaluate(() => textureAssets.find((asset) => asset.sourceFilename === 'phase-004-proof.png').id);
    const textureRow = page.locator(`[data-texture-id="${textureId}"]`);
    await textureRow.waitFor({ state: 'visible' });
    const rowActions = await textureRow.locator('button').allTextContents();
    assert.deepStrictEqual(rowActions.map((text) => text.trim()), ['Rename', 'Delete']);
    await selectObject(page, sourceId);
    await page.locator('#f-texture').selectOption(textureId);
    await page.waitForFunction(({ source, texture }) => placed.find((item) => item.id === source).textureAssetId === texture, { source: sourceId, texture: textureId });
    const textureApplied = await page.evaluate(({ source, texture }) => placed.find((item) => item.id === source).textureAssetId === texture, { source: sourceId, texture: textureId });
    assert(textureApplied);
    report.workflows.importAndUseAsset = { filename: 'phase-004-proof.png', textureId, imported: true, rowActions: rowActions.map((text) => text.trim()), textureApplied };

    report.observations = {
      duplicated: [
        { id: 'AFR-0021', canonical: 'AFR-0003', workflow: 'A' },
        { id: 'AFR-0022', canonical: 'AFR-0003', workflow: 'B' },
      ],
      new: [{ id: 'AFR-0023', workflow: 'C', evidence: 'Texture row exposes Rename/Delete but no apply-to-selected action.' }],
    };
    assert.deepStrictEqual(report.errors, []);
    report.ok = true;
    console.log(JSON.stringify(report, null, 2));
    await context.close();
  } catch (error) {
    report.ok = false;
    report.failure = error.stack;
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
