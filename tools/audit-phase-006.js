'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8866;
const URL = `http://127.0.0.1:${PORT}/editor/?game=arsenal-run`;

async function selectSceneIndex(page, index) {
  await page.locator('[data-right-tab="scene"]').click();
  const row = page.locator(`.scene-list-item[data-index="${index}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.locator('[data-right-tab="inspector"]').click();
}

async function dragToCanvas(page, selector) {
  await page.locator('[data-left-tab="objects"]').click();
  const source = page.locator(selector);
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const canvasBox = await page.locator('#game').boundingBox();
  assert(sourceBox && canvasBox, `Cannot drag ${selector} to canvas`);
  await page.mouse.move(sourceBox.x + Math.min(18, sourceBox.width / 2), sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { steps: 8 });
  await page.mouse.up();
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof OpusInspectorFields !== 'undefined' && typeof OpusAuthoring !== 'undefined' && typeof placed !== 'undefined' && placed.length > 0 && projectMeta.title === 'Arsenal Run', null, { timeout: 60000 });
    if (await page.locator('#app').evaluate((element) => element.classList.contains('editor-hidden'))) await page.locator('#chrome-toggle-btn').click();

    report.checks.module = await page.evaluate(() => ({ fieldTypes: OpusInspectorFields.FIELD_TYPES.slice(), schemaTypes: OpusAuthoring.FIELD_TYPES.slice() }));
    assert.deepStrictEqual([...report.checks.module.fieldTypes].sort(), [...report.checks.module.schemaTypes].sort());

    const health = await page.evaluate(() => { const index = placed.findIndex((item) => item.health); return { index, id: index >= 0 ? placed[index].id : null }; });
    assert(health.index >= 0, 'Arsenal Run must include a Health object');
    await selectSceneIndex(page, health.index);
    const healthSlot = page.locator('[data-schema-slot="health"]');
    await healthSlot.waitFor({ state: 'visible' });
    const max = healthSlot.locator('[data-field-editor-key="max"]');
    const original = Number(await max.inputValue());
    report.checks.healthPresentation = {
      heading: (await healthSlot.locator('.field-editor-section-heading label').textContent()).trim(),
      category: (await healthSlot.locator('.field-editor-category').textContent()).trim(),
      label: (await healthSlot.locator('[data-field-editor-row="max"] label').textContent()).trim(),
      help: (await healthSlot.locator('[data-field-editor-row="max"] .schema-component-help').textContent()).trim(),
      required: await healthSlot.locator('[data-field-editor-row="max"] .field-editor-required').count() === 1,
      initialResetDisabled: await healthSlot.locator('[data-field-editor-reset="max"]').isDisabled(),
    };
    assert.strictEqual(report.checks.healthPresentation.heading, 'Health');
    assert.strictEqual(report.checks.healthPresentation.category, 'Gameplay');
    assert.strictEqual(report.checks.healthPresentation.label, 'Maximum Health *');
    assert(report.checks.healthPresentation.help && report.checks.healthPresentation.required);

    const undoBefore = await page.evaluate(() => undoStack.length);
    await max.fill(String(original + 7));
    report.checks.modified = await page.evaluate(() => ({
      component: selectedItem.components.health.max,
      runtime: selectedItem.health.max,
      undoDepth: undoStack.length,
    }));
    report.checks.modified.indicator = await healthSlot.locator('[data-field-editor-row="max"]').evaluate((element) => element.classList.contains('is-modified'));
    assert.strictEqual(report.checks.modified.component, original + 7);
    assert.strictEqual(report.checks.modified.runtime, original + 7);
    assert.strictEqual(report.checks.modified.undoDepth, undoBefore + 1);
    assert(report.checks.modified.indicator);
    await page.locator('#undo-btn').click();
    assert.strictEqual(await page.evaluate((id) => placed.find((item) => item.id === id).health.max, health.id), original);

    const healthIndexAfterUndo = await page.evaluate((id) => placed.findIndex((item) => item.id === id), health.id);
    await selectSceneIndex(page, healthIndexAfterUndo);
    const healthSlot2 = page.locator('[data-schema-slot="health"]');
    const max2 = healthSlot2.locator('[data-field-editor-key="max"]');
    await max2.fill('-12');
    await max2.blur();
    report.checks.numericPolicy = await page.evaluate(() => ({ input: document.querySelector('[data-schema-slot="health"] [data-field-editor-key="max"]').value, component: selectedItem.components.health.max, runtime: selectedItem.health.max }));
    assert.deepStrictEqual(report.checks.numericPolicy, { input: '0.01', component: 0.01, runtime: 0.01 });
    await healthSlot2.locator('[data-field-editor-reset="max"]').click();
    assert.strictEqual(await max2.inputValue(), '100');
    assert.strictEqual(await page.evaluate(() => selectedItem.components.health.max), 100);
    assert.strictEqual(await healthSlot2.locator('[data-field-editor-row="max"]').evaluate((element) => element.classList.contains('is-modified')), false);
    assert.strictEqual(await healthSlot2.locator('[data-field-editor-reset="max"]').isDisabled(), true);

    await max2.fill('');
    report.checks.invalidDraft = {
      issue: (await healthSlot2.locator('[data-field-editor-local-issues="max"] .authoring-issue').textContent()).trim(),
      valuePreserved: await page.evaluate(() => selectedItem.components.health.max),
      resetAvailable: !(await healthSlot2.locator('[data-field-editor-reset="max"]').isDisabled()),
    };
    assert(report.checks.invalidDraft.issue.includes('required'));
    assert.strictEqual(report.checks.invalidDraft.valuePreserved, 100);
    assert(report.checks.invalidDraft.resetAvailable);
    await healthSlot2.locator('[data-field-editor-reset="max"]').click();
    assert.strictEqual(await healthSlot2.locator('[data-field-editor-local-issues="max"] .authoring-issue').count(), 0);

    await dragToCanvas(page, '#palette-trigger');
    const trigger = page.locator('[data-schema-slot="trigger"]');
    await trigger.waitFor({ state: 'visible' });
    await trigger.locator('[data-field-editor-key="shape"]').selectOption('sphere');
    await trigger.locator('[data-field-editor-key="repeat"]').uncheck();
    report.checks.booleanEnum = await page.evaluate(() => ({ repeat: selectedItem.components.trigger.repeat, shape: selectedItem.components.trigger.shape }));
    assert.deepStrictEqual(report.checks.booleanEnum, { repeat: false, shape: 'sphere' });

    await dragToCanvas(page, '#palette-emitter');
    const emitter = page.locator('[data-schema-slot="particle-emitter"]');
    await emitter.waitFor({ state: 'visible' });
    const cap = emitter.locator('[data-field-editor-key="maxParticles"]');
    await cap.fill('999');
    await cap.blur();
    report.checks.integer = await page.evaluate(() => ({ input: document.querySelector('[data-schema-slot="particle-emitter"] [data-field-editor-key="maxParticles"]').value, component: selectedItem.components['particle-emitter'].maxParticles, runtime: selectedItem.handle.maxParticles }));
    assert.deepStrictEqual(report.checks.integer, { input: '500', component: 500, runtime: 500 });
    await emitter.locator('[data-field-editor-reset="maxParticles"]').click();
    assert.strictEqual(await page.evaluate(() => selectedItem.components['particle-emitter'].maxParticles), 200);

    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#project-name-input').fill('phase-006-ui-proof');
    await page.locator('#save-btn').click();
    await page.locator('#load-btn').click();
    await page.waitForFunction(() => !loadingProjectGuard && placed.some((item) => item.components && item.components.trigger));
    report.checks.saveLoad = await page.evaluate(() => ({ trigger: placed.some((item) => item.components && item.components.trigger), particle: placed.some((item) => item.components && item.components['particle-emitter']) }));
    assert(report.checks.saveLoad.trigger && report.checks.saveLoad.particle);
    report.checks.editableExport = await page.evaluate(async () => { const html = await buildExportHTML(false); return { hasFieldContract: html.includes('Digital Opus reusable Inspector field editors.'), hasComponentRecord: html.includes('"particle-emitter"') }; });
    assert(report.checks.editableExport.hasFieldContract && report.checks.editableExport.hasComponentRecord);

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
