'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8867;
const URL = `http://127.0.0.1:${PORT}/editor/?game=arsenal-run`;

async function selectSceneId(page, id) {
  await page.locator('[data-right-tab="scene"]').click();
  const index = await page.evaluate((objectId) => placed.findIndex((item) => item.id === objectId), id);
  assert(index >= 0, `Object ${id} no longer exists`);
  const row = page.locator(`.scene-list-item[data-index="${index}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.locator('[data-right-tab="inspector"]').click();
}

async function assertPickerFits(page, viewport) {
  const box = await page.locator('.add-component-dialog').boundingBox();
  const search = await page.locator('[data-add-component-search]').boundingBox();
  assert(box && search);
  assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height);
  assert(search.y >= box.y && search.y + search.height <= box.y + box.height);
  return { viewport, box: { width: Math.round(box.width), height: Math.round(box.height) }, searchVisible: true };
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { url: URL, checks: {}, errors: [] };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000);
      server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
      server.once('error', reject);
      server.once('exit', (code) => { if (code) reject(new Error(`Static server exited ${code}`)); });
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof OpusAuthoring !== 'undefined' && typeof placed !== 'undefined' && placed.length > 0 && projectMeta.title === 'Arsenal Run', null, { timeout: 60000 });
    if (await page.locator('#app').evaluate((element) => element.classList.contains('editor-hidden'))) await page.locator('#chrome-toggle-btn').click();

    const object = await page.evaluate(() => { const index = placed.findIndex((item) => item.kind === 'cube' && !item.health && !(item.components && item.components.health)); return { id: placed[index] && placed[index].id, index }; });
    assert(object.index >= 0, 'Arsenal Run needs a cube without Health');
    await selectSceneId(page, object.id);
    const opener = page.locator('#add-component-btn');
    await opener.waitFor({ state: 'visible' });
    report.checks.obviousPlacement = { label: (await opener.textContent()).trim(), visible: await opener.isVisible() };
    assert(report.checks.obviousPlacement.visible && report.checks.obviousPlacement.label.includes('Add Component'));

    await opener.focus();
    await page.keyboard.press('Enter');
    const search = page.locator('[data-add-component-search]');
    await search.waitFor({ state: 'visible' });
    assert.strictEqual(await search.evaluate((element) => document.activeElement === element), true);
    report.checks.size1366 = await assertPickerFits(page, { width: 1366, height: 768 });
    await search.fill('no-such-component');
    report.checks.noResults = (await page.locator('.add-component-empty').textContent()).trim();
    assert.strictEqual(report.checks.noResults, 'No matching components.');
    await page.keyboard.press('Escape');
    assert.strictEqual(await opener.evaluate((element) => document.activeElement === element), true);
    assert.strictEqual(await page.evaluate((id) => selectedItem && selectedItem.id === id, object.id), true);

    const undoBefore = await page.evaluate(() => undoStack.length);
    await page.keyboard.press('Space');
    await search.fill('hea');
    const result = page.locator('[data-add-component-id="health"]');
    await result.waitFor({ state: 'visible' });
    report.checks.search = { label: (await result.locator('.add-component-result-title').textContent()).trim(), help: (await result.locator('.add-component-result-help').textContent()).trim() };
    assert.strictEqual(report.checks.search.label, 'Health');
    assert(report.checks.search.help.length > 0);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const healthSlot = page.locator('[data-schema-slot="health"]');
    await healthSlot.waitFor({ state: 'visible' });
    report.checks.add = await page.evaluate((id) => { const item = placed.find((entry) => entry.id === id); return { selected: selectedItem && selectedItem.id === id, component: item.components.health, runtime: item.health, undoDepth: undoStack.length }; }, object.id);
    assert(report.checks.add.selected);
    assert.deepStrictEqual(report.checks.add.component, { version: 1, max: 100, current: 100 });
    assert.deepStrictEqual(report.checks.add.runtime, { max: 100, current: 100 });
    assert.strictEqual(report.checks.add.undoDepth, undoBefore + 1);
    assert.strictEqual(await healthSlot.evaluate((element) => document.activeElement === element), true);

    await page.locator('#add-component-btn').click();
    report.checks.allPresent = (await page.locator('.add-component-empty').textContent()).trim();
    assert.strictEqual(report.checks.allPresent, 'All available components are already on this object.');
    await page.locator('[data-add-component-search]').fill('health');
    const already = page.locator('[data-add-component-id="health"]');
    report.checks.alreadyAdded = { disabled: await already.isDisabled(), reason: (await already.locator('.add-component-result-reason').textContent()).trim() };
    assert(report.checks.alreadyAdded.disabled && report.checks.alreadyAdded.reason === 'Already added.');
    await page.keyboard.press('Escape');

    const max = page.locator('[data-schema-slot="health"] [data-field-editor-key="max"]');
    await max.fill('130');
    await max.blur();
    assert.strictEqual(await page.evaluate((id) => placed.find((item) => item.id === id).components.health.max, object.id), 130);
    assert.strictEqual(await page.evaluate(() => undoStack.length), undoBefore + 2);
    await page.locator('#undo-btn').click();
    assert.strictEqual(await page.evaluate((id) => placed.find((item) => item.id === id).components.health.max, object.id), 100);
    report.checks.undoField = true;

    await page.locator('#undo-btn').click();
    report.checks.undoAdd = await page.evaluate((id) => { const item = placed.find((entry) => entry.id === id); return !item.health && !(item.components && item.components.health); }, object.id);
    assert(report.checks.undoAdd);
    await page.locator('#redo-btn').click();
    report.checks.redoAdd = await page.evaluate((id) => { const item = placed.find((entry) => entry.id === id); return item.components.health; }, object.id);
    assert.deepStrictEqual(report.checks.redoAdd, { version: 1, max: 100, current: 100 });

    await selectSceneId(page, object.id);
    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#project-name-input').fill('phase-007-ui-proof');
    await page.locator('#save-btn').click();
    await page.locator('#load-btn').click();
    await page.waitForFunction((id) => !loadingProjectGuard && placed.some((item) => item.id === id && item.components && item.components.health), object.id);
    report.checks.saveLoad = await page.evaluate((id) => placed.find((item) => item.id === id).components.health, object.id);
    assert.deepStrictEqual(report.checks.saveLoad, { version: 1, max: 100, current: 100 });

    await page.locator('#validate-project-btn').click();
    report.checks.validation = await page.evaluate((id) => ({ ran: !!lastProjectValidation, healthIssues: lastProjectValidation.issues.filter((entry) => entry.objectId === id && entry.componentId === 'health').length }), object.id);
    assert(report.checks.validation.ran && report.checks.validation.healthIssues === 0);

    await selectSceneId(page, object.id);
    await page.locator('#prefab-name-input').fill('Phase 007 Add Component Proof');
    await page.locator('#save-prefab-btn').click();
    report.checks.prefab = await page.evaluate(() => prefabs.find((entry) => entry.name === 'Phase 007 Add Component Proof').record.components.health);
    assert.deepStrictEqual(report.checks.prefab, { version: 1, max: 100, current: 100 });
    const beforeDuplicate = await page.evaluate(() => placed.length);
    await page.locator('#duplicate-btn').click();
    report.checks.duplicate = await page.evaluate(() => selectedItem.components.health);
    assert.deepStrictEqual(report.checks.duplicate, { version: 1, max: 100, current: 100 });
    assert.strictEqual(await page.evaluate(() => placed.length), beforeDuplicate + 1);

    report.checks.exports = await page.evaluate(async () => {
      const [editable, playable] = await Promise.all([buildExportHTML(false), buildExportHTML(true)]);
      return [editable, playable].map((html) => ({ picker: html.includes('All available components are already on this object.'), component: html.includes('"health":{"current":100,"max":100,"version":1}') || html.includes('"health":{"version":1,"max":100,"current":100}') }));
    });
    assert(report.checks.exports.every((entry) => entry.picker && entry.component));

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('#add-component-btn').click();
    report.checks.size1920 = await assertPickerFits(page, { width: 1920, height: 1080 });
    await page.keyboard.press('Escape');
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
