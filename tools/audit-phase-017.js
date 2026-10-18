'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8873;
const URL = `http://127.0.0.1:${PORT}/editor/`;
const PIXEL = path.join(ROOT, 'tests', 'fixtures', 'phase-017-pixel-art.png');
const TRANSPARENT = path.join(ROOT, 'tests', 'fixtures', 'phase-014-transparent-sprite.png');
const OUT = path.join(ROOT, 'phase-017-dogfood.json');
const SHOT = path.join(ROOT, 'phase-017-filtering-proof.png');

async function setField(page, key, value) {
  const field = page.locator(`[data-component-id="sprite-renderer"] [data-field-editor-key="${key}"]`);
  await field.evaluate((element, next) => {
    element.value = String(next);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function setTransform(page, axis, value) {
  const field = page.locator(`[data-sprite-transform="${axis}"]`);
  await field.fill(String(value));
  await field.dispatchEvent('input');
}
async function place(page, assetId, name, x) {
  await page.locator(`[data-place-sprite-asset="${assetId}"]`).click();
  await page.locator('#f-name').fill(name); await page.locator('#f-name').dispatchEvent('input');
  await setTransform(page, 'px', x); await setTransform(page, 'py', 2); await setTransform(page, 'pz', 0);
  await setField(page, 'width', 3); await setField(page, 'height', 3);
  return page.evaluate(() => selectedItem.id);
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { url: URL, fixture: path.relative(ROOT, PIXEL), checks: {}, errors: [] };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000);
      server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
      server.once('error', reject);
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof placed !== 'undefined' && typeof spriteAssets !== 'undefined');
    if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
    if (await page.locator('#app').evaluate((el) => el.classList.contains('editor-hidden'))) await page.locator('#chrome-toggle-btn').click();
    await page.locator('[data-left-tab="assets"]').click();

    await page.locator('#import-sprite-input').setInputFiles(PIXEL);
    await page.waitForFunction(() => spriteAssets.length === 1);
    const pixelAsset = await page.evaluate(() => spriteAssets[0].id);
    assert.strictEqual(await page.locator('[data-field-editor-key="filtering"]').inputValue(), 'linear');
    await page.locator('[data-field-editor-key="filtering"]').selectOption('nearest');
    await page.locator(`[data-duplicate-sprite-asset="${pixelAsset}"]`).click();
    const smoothAsset = await page.evaluate(() => selectedSpriteAssetId);
    await page.locator('[data-field-editor-key="filtering"]').selectOption('linear');
    report.checks.assetModes = await page.evaluate(([a, b]) => spriteAssets.filter((asset) => asset.id === a || asset.id === b).map((asset) => ({ id: asset.id, sourceTexture: asset.sourceTexture, filtering: asset.filtering, hasBytes: 'dataURL' in asset || 'image' in asset })), [pixelAsset, smoothAsset]);
    assert.deepStrictEqual(report.checks.assetModes.map((x) => x.filtering).sort(), ['linear', 'nearest']);
    assert.strictEqual(new Set(report.checks.assetModes.map((x) => x.sourceTexture)).size, 1);
    assert(report.checks.assetModes.every((x) => !x.hasBytes));

    const pixelObject = await place(page, pixelAsset, 'Pixel Nearest Proof', -2);
    const smoothObject = await place(page, smoothAsset, 'Pixel Smooth Proof', 2);
    await page.evaluate(() => { app.camera.setTarget(null); app.camera.setMode('fixed'); app.camera.setFixedOptions({ eye: new Opus.Vec3(0, 2, 8), target: new Opus.Vec3(0, 2, 0) }); });
    await page.waitForTimeout(300);
    report.checks.sharedSourceRuntime = await page.evaluate(([a, b]) => { const first = placed.find((item) => item.id === a); const second = placed.find((item) => item.id === b); return { sameTextureHandle: first.entity.texture === second.entity.texture, firstSampling: first.entity.textureSampling, secondSampling: second.entity.textureSampling, widths: [first.components['sprite-renderer'].width, second.components['sprite-renderer'].width] }; }, [pixelObject, smoothObject]);
    assert.strictEqual(report.checks.sharedSourceRuntime.sameTextureHandle, true);
    assert.deepStrictEqual([report.checks.sharedSourceRuntime.firstSampling, report.checks.sharedSourceRuntime.secondSampling], ['nearest', 'linear']);
    await page.locator('#game').screenshot({ path: SHOT });

    await page.locator('[data-left-tab="assets"]').click();
    await page.locator('#import-sprite-input').setInputFiles(TRANSPARENT);
    await page.waitForFunction(() => spriteAssets.length === 3);
    const transparentAsset = await page.evaluate(() => selectedSpriteAssetId);
    assert.strictEqual(await page.locator('[data-field-editor-key="filtering"]').inputValue(), 'linear');
    const transparentObject = await place(page, transparentAsset, 'Smooth Transparent Proof', 0);
    await setTransform(page, 'py', -1);
    await page.evaluate(() => {
      selectedItem.components['sprite-renderer'].opacity = 0.35;
      syncSpriteRenderer(selectedItem);
      renderInspector();
    });
    report.checks.opacityBeforePrefab = await page.evaluate(() => ({ value: selectedItem.components['sprite-renderer'].opacity, alpha: selectedItem.entity.alpha }));
    await page.locator('#sprite-prefab-name').fill('Phase 017 Transparent Sprite');
    await page.locator('#sprite-save-prefab').click();
    report.checks.opacityPrefab = await page.evaluate((id) => { const item = placed.find((entry) => entry.id === id); const prefab = prefabs.find((entry) => entry.name === 'Phase 017 Transparent Sprite'); return { runtimeAlpha: item.entity.alpha, componentOpacity: item.components['sprite-renderer'].opacity, prefabOpacity: prefab.record.components['sprite-renderer'].opacity }; }, transparentObject);
    assert.strictEqual(report.checks.opacityPrefab.runtimeAlpha, 0.35);
    assert.strictEqual(report.checks.opacityPrefab.prefabOpacity, 0.35);

    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#project-name-input').fill('phase-017-browser-dogfood');
    await page.locator('#save-alt-btn').click();
    await page.locator('#load-btn').click();
    await page.waitForFunction(() => placed.some((item) => item.name === 'Pixel Nearest Proof'));
    report.checks.saveLoad = await page.evaluate(() => ({ pixel: spriteAssets.find((a) => a.filtering === 'nearest').filtering, smooth: spriteAssets.find((a) => a.filtering === 'linear').filtering, opacity: placed.find((item) => item.name === 'Smooth Transparent Proof').components['sprite-renderer'].opacity }));
    assert.deepStrictEqual(report.checks.saveLoad, { pixel: 'nearest', smooth: 'linear', opacity: 0.35 });
    await page.locator('#validate-project-btn').click();
    assert((await page.locator('#project-validation-summary').textContent()).includes('No structured authoring issues'));

    await page.locator('#play-btn').click(); await page.waitForFunction(() => document.getElementById('play-btn').textContent.includes('Stop'));
    await page.locator('#play-btn').click(); await page.waitForFunction(() => document.getElementById('play-btn').textContent.includes('Play'));
    report.checks.playStop = true;

    for (const [selector, key] of [['#export-standalone-alt-btn', 'editable'], ['#export-playable-btn', 'playable']]) {
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
      await page.locator(selector).click();
      const download = await downloadPromise;
      const downloadPath = await download.path();
      const html = fs.readFileSync(downloadPath, 'utf8');
      report.checks[key] = { filename: download.suggestedFilename(), bytes: Buffer.byteLength(html), hasNearest: html.includes('"filtering":"nearest"'), hasOpacity: html.includes('"opacity":0.35') };
      assert(report.checks[key].hasNearest && report.checks[key].hasOpacity);
    }
    report.checks.screenshot = path.relative(ROOT, SHOT);
    assert.deepStrictEqual(report.errors, []);
    report.ok = true;
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    await context.close();
  } catch (error) {
    report.ok = false; report.failure = error.stack;
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
