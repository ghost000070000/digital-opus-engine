'use strict';

// Real-browser characterization for the bounded Phase 002 schema seam.
// It drives the shipped editor controls (including palette drag/drop), then
// only reads in-memory state to assert what those controls actually changed.
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8862;
const URL = `http://127.0.0.1:${PORT}/editor/?game=arsenal-run`;

async function dragToCanvas(page, selector) {
  const source = page.locator(selector);
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const canvasBox = await page.locator('#game').boundingBox();
  assert(sourceBox && canvasBox, `Cannot drag ${selector} to the canvas`);
  await page.mouse.move(sourceBox.x + Math.min(18, sourceBox.width / 2), sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function selectSceneIndex(page, index) {
  await page.locator('[data-right-tab="scene"]').click();
  const row = page.locator(`.scene-list-item[data-index="${index}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.locator('[data-right-tab="inspector"]').click();
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let browser;
  const report = { url: URL, checks: {}, errors: [] };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000);
      server.stdout.on('data', (chunk) => {
        if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); }
      });
      server.once('error', reject);
      server.once('exit', (code) => { if (code) reject(new Error(`Static server exited ${code}`)); });
    });

    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof placed !== 'undefined' && placed.length > 0 && typeof OpusAuthoring !== 'undefined' && projectMeta.title === 'Arsenal Run', null, { timeout: 60000 });
    if (await page.locator('#app').evaluate((element) => element.classList.contains('editor-hidden'))) {
      await page.locator('#chrome-toggle-btn').click();
    }

    report.checks.registry = await page.evaluate(() => ({
      ids: OpusAuthoring.registry.list().map((schema) => schema.id),
      fieldTypes: OpusAuthoring.FIELD_TYPES.slice(),
    }));
    assert.deepStrictEqual(report.checks.registry.ids, ['health', 'particle-emitter', 'trigger']);

    const healthIndex = await page.evaluate(() => placed.findIndex((item) => item.health));
    assert(healthIndex >= 0, 'Arsenal Run must expose a legacy Health object');
    await selectSceneIndex(page, healthIndex);
    const healthSlot = page.locator('[data-schema-slot="health"]');
    await healthSlot.waitFor({ state: 'visible' });
    const healthMax = healthSlot.locator('[data-component-field="max"]');
    const originalMax = Number(await healthMax.inputValue());
    await healthMax.fill(String(originalMax + 7));
    await healthMax.blur();
    report.checks.healthInspector = await page.evaluate(() => ({
      component: selectedItem.components.health,
      legacy: selectedItem.health,
      issues: OpusAuthoring.validateTarget(selectedItem),
    }));
    assert.strictEqual(report.checks.healthInspector.component.max, originalMax + 7);
    assert.strictEqual(report.checks.healthInspector.legacy.max, originalMax + 7);
    assert.deepStrictEqual(report.checks.healthInspector.issues, []);

    const beforeDuplicate = await page.evaluate(() => placed.length);
    await page.locator('#duplicate-btn').click();
    const afterDuplicate = await page.evaluate(() => placed.length);
    assert.strictEqual(afterDuplicate, beforeDuplicate + 1);
    report.checks.duplicate = await page.evaluate(() => ({
      independentBag: selectedItem.components !== placed[placed.length - 2].components,
      component: selectedItem.components.health,
    }));
    assert(report.checks.duplicate.independentBag);
    await page.locator('#undo-btn').click();
    assert.strictEqual(await page.evaluate(() => placed.length), beforeDuplicate);
    await page.locator('#redo-btn').click();
    assert.strictEqual(await page.evaluate(() => placed.length), afterDuplicate);
    report.checks.undoRedo = { beforeDuplicate, afterDuplicate, undoRestored: true, redoRestored: true };

    // Redo reconstructs the scene and intentionally clears selection.
    await selectSceneIndex(page, afterDuplicate - 1);
    await page.locator('#prefab-name-input').fill('Phase 002 Health Proof');
    await page.locator('#save-prefab-btn').click();
    await page.locator('[data-left-tab="prefabs"]').click();
    const proofPrefabIndex = await page.evaluate(() => prefabs.findIndex((prefab) => prefab.name === 'Phase 002 Health Proof'));
    assert(proofPrefabIndex >= 0, 'Save as Prefab must create the named proof prefab');
    const beforePrefabDrop = await page.evaluate(() => placed.length);
    await dragToCanvas(page, `#palette-prefab-${proofPrefabIndex}`);
    await page.waitForFunction((count) => placed.length === count + 1, beforePrefabDrop);
    report.checks.prefab = await page.evaluate(() => ({
      savedRecord: prefabs.find((prefab) => prefab.name === 'Phase 002 Health Proof').record.components.health,
      instance: selectedItem.components.health,
      independentBag: selectedItem.components !== placed[placed.length - 2].components,
    }));
    assert.deepStrictEqual(report.checks.prefab.instance, report.checks.prefab.savedRecord);
    assert(report.checks.prefab.independentBag);

    await page.locator('[data-left-tab="objects"]').click();
    await dragToCanvas(page, '#palette-trigger');
    const triggerSlot = page.locator('[data-schema-slot="trigger"]');
    await triggerSlot.waitFor({ state: 'visible' });
    await triggerSlot.locator('[data-component-field="shape"]').selectOption('sphere');
    await triggerSlot.locator('[data-component-field="repeat"]').uncheck();
    report.checks.triggerInspector = await page.evaluate(() => ({ component: selectedItem.components.trigger, shape: selectedItem.triggerShape, repeat: selectedItem.triggerRepeat }));
    assert.strictEqual(report.checks.triggerInspector.shape, 'sphere');
    assert.strictEqual(report.checks.triggerInspector.repeat, false);

    await dragToCanvas(page, '#palette-emitter');
    const emitterSlot = page.locator('[data-schema-slot="particle-emitter"]');
    await emitterSlot.waitFor({ state: 'visible' });
    await emitterSlot.locator('[data-component-field="rate"]').fill('-1');
    await emitterSlot.locator('[data-component-field="rate"]').blur();
    report.checks.creatorValidation = {
      issueCount: await emitterSlot.locator('.authoring-issue').count(),
      runtimeRate: await page.evaluate(() => selectedItem.handle.rate),
    };
    assert(report.checks.creatorValidation.issueCount > 0);
    assert.strictEqual(report.checks.creatorValidation.runtimeRate, 0);
    await emitterSlot.locator('[data-component-field="rate"]').fill('37');
    await emitterSlot.locator('[data-component-field="rate"]').blur();
    await emitterSlot.locator('[data-component-field="maxParticles"]').fill('144');
    await emitterSlot.locator('[data-component-field="maxParticles"]').blur();
    report.checks.particleInspector = await page.evaluate(() => ({ component: selectedItem.components['particle-emitter'], options: { rate: selectedItem.options.rate, maxParticles: selectedItem.options.maxParticles }, handle: { rate: selectedItem.handle.rate, maxParticles: selectedItem.handle.maxParticles } }));
    assert.strictEqual(report.checks.particleInspector.options.rate, 37);
    assert.strictEqual(report.checks.particleInspector.handle.maxParticles, 144);

    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#project-name-input').fill('phase-002-ui-proof');
    await page.locator('#save-btn').click();
    await page.locator('#load-btn').click();
    await page.waitForFunction(() => !loadingProjectGuard && placed.some((item) => item.components && item.components.trigger));
    report.checks.saveLoad = await page.evaluate(() => ({
      health: placed.filter((item) => item.components && item.components.health).length,
      trigger: placed.filter((item) => item.components && item.components.trigger).length,
      particle: placed.filter((item) => item.components && item.components['particle-emitter']).length,
    }));
    assert(report.checks.saveLoad.health > 0 && report.checks.saveLoad.trigger > 0 && report.checks.saveLoad.particle > 0);

    await page.evaluate(() => {
      window.__phase002Exports = [];
      downloadHTML = (html, filename) => window.__phase002Exports.push({ html, filename });
    });
    await page.locator('#export-playable-btn').click();
    await page.waitForFunction(() => window.__phase002Exports.length === 1, null, { timeout: 60000 });
    await page.locator('#export-standalone-alt-btn').click();
    await page.waitForFunction(() => window.__phase002Exports.length === 2, null, { timeout: 60000 });
    report.checks.exports = await page.evaluate(() => window.__phase002Exports.map((entry) => ({
      filename: entry.filename,
      bytes: new Blob([entry.html]).size,
      hasSchemaModule: entry.html.includes('Digital Opus authoring schema/component seam.'),
      hasHealthRecord: entry.html.includes('"components":{"health":{'),
      playableOnly: (entry.html.match(/<script>window\.__OPUS_EMBEDDED_PROJECT__[\s\S]*?<\/script>/) || [''])[0].includes('window.__OPUS_PLAYABLE_ONLY__ = true'),
    })));
    assert(report.checks.exports.every((entry) => entry.hasSchemaModule && entry.hasHealthRecord));
    assert(report.checks.exports.some((entry) => entry.filename === 'playable-game.html' && entry.playableOnly));
    assert(report.checks.exports.some((entry) => entry.filename === 'editable-game.html' && !entry.playableOnly));
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
