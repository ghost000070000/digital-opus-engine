'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8863;
const URL = `http://127.0.0.1:${PORT}/editor/?game=arsenal-run`;

async function selectObject(page, id) {
  await page.locator('[data-right-tab="scene"]').click();
  const index = await page.evaluate((objectId) => placed.findIndex((item) => item.id === objectId), id);
  assert(index >= 0, `Object ${id} must exist`);
  await page.locator(`.scene-list-item[data-index="${index}"]`).click();
  await page.locator('[data-right-tab="inspector"]').click();
}

async function addMoveBehavior(page, targetId) {
  await page.locator('#b-action').selectOption('moveObject');
  await page.locator('#b-fields [data-field="targetId"]').selectOption(targetId);
  await page.locator('#b-fields [data-field="dx"]').fill('1');
  await page.locator('#add-behavior-btn').click();
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
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof OpusAuthoringPlumbing !== 'undefined' && projectMeta.title === 'Arsenal Run');
    if (await page.locator('#app').evaluate((el) => el.classList.contains('editor-hidden'))) await page.locator('#chrome-toggle-btn').click();

    report.checks.assets = await page.evaluate(() => ({
      types: OpusAuthoringPlumbing.assetTypes.listTypes().map((type) => type.id),
      mesh: assets.length, texture: textureAssets.length, audio: audioAssets.length,
      validMesh: assets.length ? OpusAuthoringPlumbing.assetTypes.validate(assets[0], 'mesh').length === 0 : false,
      validTexture: textureAssets.length ? OpusAuthoringPlumbing.assetTypes.validate(textureAssets[0], 'texture').length === 0 : false,
      validAudio: audioAssets.length ? OpusAuthoringPlumbing.assetTypes.validate(audioAssets[0], 'audio').length === 0 : false,
    }));
    assert.deepStrictEqual(report.checks.assets.types, ['mesh', 'texture', 'audio']);
    assert(report.checks.assets.mesh && report.checks.assets.texture && report.checks.assets.audio);
    assert(report.checks.assets.validMesh && report.checks.assets.validTexture && report.checks.assets.validAudio);
    await page.locator('[data-left-tab="assets"]').click();
    report.checks.assetLibraryRows = await page.locator('.asset-row').count();
    assert(report.checks.assetLibraryRows >= 3);

    const ids = await page.evaluate(() => {
      const source = placed.find((item) => item.health && item.kind === 'cube');
      const candidates = placed.filter((item) => item.kind === 'cube' && item.id !== source.id);
      return { source: source.id, target: candidates[0].id, repair: candidates[1].id };
    });
    await selectObject(page, ids.source);
    await page.locator('[data-schema-slot="health"]').waitFor({ state: 'visible' });
    await addMoveBehavior(page, ids.target);
    report.checks.optionService = await page.locator('#b-fields [data-field="targetId"] option').evaluateAll((options) => options.map((o) => o.value));
    assert(report.checks.optionService.includes(ids.target));

    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#validate-project-btn').click();
    report.checks.validReference = await page.evaluate((targetId) => !lastProjectValidation.issues.some((entry) => entry.code === 'dangling-reference' && entry.referenceValue === targetId), ids.target);
    assert(report.checks.validReference);

    await selectObject(page, ids.target);
    await page.locator('#delete-btn').click();
    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#validate-project-btn').click();
    const dangling = await page.evaluate((targetId) => {
      const index = lastProjectValidation.issues.findIndex((entry) => entry.code === 'dangling-reference' && entry.referenceValue === targetId);
      return { index, issue: index >= 0 ? lastProjectValidation.issues[index] : null };
    }, ids.target);
    assert(dangling.issue && dangling.issue.objectId === ids.source);
    report.checks.dangling = dangling.issue;
    await page.locator(`[data-validation-issue="${dangling.index}"]`).click();
    assert.strictEqual(await page.evaluate(() => selectedItem && selectedItem.id), ids.source);
    report.checks.issueFocus = true;

    const behaviorIndex = await page.evaluate((targetId) => selectedItem.behaviors.findIndex((b) => b.action === 'moveObject' && b.params && b.params.targetId === targetId), ids.target);
    assert(behaviorIndex >= 0);
    await page.locator(`#behavior-list button[data-index="${behaviorIndex}"]`).click();
    await addMoveBehavior(page, ids.repair);
    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#validate-project-btn').click();
    report.checks.repaired = await page.evaluate((targetId) => !lastProjectValidation.issues.some((entry) => entry.code === 'dangling-reference' && entry.referenceValue === targetId), ids.target);
    assert(report.checks.repaired);

    await page.locator('#project-name-input').fill('phase-003-ui-proof');
    await page.locator('#save-btn').click();
    await page.locator('#load-btn').click();
    await page.waitForFunction(() => !loadingProjectGuard);
    report.checks.saveLoad = await page.evaluate(({ source, repair }) => {
      const object = placed.find((item) => item.id === source);
      return object.behaviors.some((b) => b.action === 'moveObject' && b.params && b.params.targetId === repair);
    }, ids);
    assert(report.checks.saveLoad);

    await page.evaluate(() => { window.__phase003Exports = []; downloadHTML = (html, filename) => window.__phase003Exports.push({ html, filename }); });
    await page.locator('#export-playable-btn').click();
    await page.waitForFunction(() => window.__phase003Exports.length === 1, null, { timeout: 60000 });
    await page.locator('#export-standalone-alt-btn').click();
    await page.waitForFunction(() => window.__phase003Exports.length === 2, null, { timeout: 60000 });
    report.checks.exports = await page.evaluate(() => window.__phase003Exports.map((entry) => ({ filename: entry.filename, hasPlumbing: entry.html.includes('Digital Opus bounded authoring plumbing'), hasReference: entry.html.includes('moveObject') })));
    assert(report.checks.exports.every((entry) => entry.hasPlumbing && entry.hasReference));
    assert.deepStrictEqual(report.errors, []);
    report.ok = true;
    console.log(JSON.stringify(report, null, 2));
    await context.close();
  } catch (error) {
    report.ok = false; report.failure = error.stack; console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
