'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8868;
const URL = `http://127.0.0.1:${PORT}/editor/?game=arsenal-run`;

async function selectSceneId(page, id) {
  await page.locator('[data-right-tab="scene"]').click();
  const index = await page.evaluate((objectId) => placed.findIndex((item) => item.id === objectId), id);
  assert(index >= 0, `Object ${id} no longer exists`);
  const row = page.locator(`.scene-list-item[data-index="${index}"]`);
  await row.scrollIntoViewIfNeeded(); await row.click();
  await page.locator('[data-right-tab="inspector"]').click();
}

async function openPreset(page, query) {
  await page.locator('#gameplay-preset-btn').click();
  const search = page.locator('[data-gameplay-preset-search]');
  await search.waitFor({ state: 'visible' });
  await search.fill(query);
  return search;
}

async function applyPreset(page, presetId, values = {}) {
  await openPreset(page, presetId);
  await page.locator(`[data-gameplay-preset-id="${presetId}"]`).click();
  for (const [id, value] of Object.entries(values)) {
    const control = page.locator(`[data-preset-parameter="${id}"]`);
    if (await control.evaluate((element) => element.tagName === 'SELECT')) await control.selectOption(String(value));
    else if (await control.getAttribute('type') === 'checkbox') await control.setChecked(!!value);
    else await control.fill(String(value));
  }
  const label = (await page.locator('[data-gameplay-preset-apply]').textContent()).trim();
  await page.locator('[data-gameplay-preset-apply]').click();
  return label;
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { url: URL, checks: {}, dogfood: { manualFallbacks: [] }, errors: [] };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server did not start')), 10000);
      server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
      server.once('error', reject); server.once('exit', (code) => { if (code) reject(new Error(`Static server exited ${code}`)); });
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof OpusGameplayPresets !== 'undefined' && typeof placed !== 'undefined' && placed.length > 5 && projectMeta.title === 'Arsenal Run', null, { timeout: 60000 });
    if (await page.locator('#app').evaluate((element) => element.classList.contains('editor-hidden'))) await page.locator('#chrome-toggle-btn').click();

    const ids = await page.evaluate(() => placed.filter((item) => item.kind === 'cube').slice(0, 7).map((item) => item.id));
    assert.strictEqual(ids.length, 7, 'dogfood needs seven ordinary cubes');
    await selectSceneId(page, ids[0]);
    const opener = page.locator('#gameplay-preset-btn');
    report.checks.entry = { visible: await opener.isVisible(), label: (await opener.textContent()).trim() };
    assert(report.checks.entry.visible && report.checks.entry.label.includes('Gameplay Preset'));

    await opener.focus(); await page.keyboard.press('Enter');
    const search = page.locator('[data-gameplay-preset-search]');
    assert.strictEqual(await search.evaluate((element) => document.activeElement === element), true);
    const box = await page.locator('.gameplay-preset-dialog').boundingBox();
    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1366 && box.y + box.height <= 768);
    report.checks.size1366 = { width: Math.round(box.width), height: Math.round(box.height) };
    await search.fill('does not exist');
    assert.strictEqual((await page.locator('.gameplay-preset-results .gameplay-preset-empty').textContent()).trim(), 'No matching gameplay presets.');
    await page.keyboard.press('Escape');
    assert.strictEqual(await opener.evaluate((element) => document.activeElement === element), true);
    assert.strictEqual(await page.evaluate((id) => selectedItem.id === id, ids[0]), true);

    const undoBefore = await page.evaluate(() => undoStack.length);
    const firstLabel = await applyPreset(page, 'damage-zone', { damage: 23, cooldown: 2.5 });
    assert.strictEqual(firstLabel, 'Apply Preset');
    report.checks.damageApply = await page.evaluate((id) => { const item = placed.find((p) => p.id === id); return { behaviors: item.behaviors.filter((b) => b.action === 'damagePlayer'), undoDepth: undoStack.length, selected: selectedItem.id === id }; }, ids[0]);
    assert.strictEqual(report.checks.damageApply.behaviors.length, 1);
    assert.deepStrictEqual(report.checks.damageApply.behaviors[0].params, { amount: 23, cooldown: 2.5 });
    assert.strictEqual(report.checks.damageApply.undoDepth, undoBefore + 1);
    assert(report.checks.damageApply.selected);

    const updateLabel = await applyPreset(page, 'damage-zone', { damage: 31, cooldown: 1 });
    assert.strictEqual(updateLabel, 'Update Existing Setup');
    report.checks.idempotence = await page.evaluate((id) => { const matches = placed.find((p) => p.id === id).behaviors.filter((b) => b.action === 'damagePlayer'); return { count: matches.length, params: matches[0].params, undoDepth: undoStack.length }; }, ids[0]);
    assert.strictEqual(report.checks.idempotence.count, 1);
    assert.deepStrictEqual(report.checks.idempotence.params, { amount: 31, cooldown: 1 });
    assert.strictEqual(report.checks.idempotence.undoDepth, undoBefore + 2);
    await page.locator('#undo-btn').click();
    assert.strictEqual(await page.evaluate((id) => placed.find((p) => p.id === id).behaviors.find((b) => b.action === 'damagePlayer').params.amount, ids[0]), 23);
    await page.locator('#redo-btn').click();
    assert.strictEqual(await page.evaluate((id) => placed.find((p) => p.id === id).behaviors.find((b) => b.action === 'damagePlayer').params.amount, ids[0]), 31);
    report.checks.undoRedo = true;

    const loop = [
      [ids[1], 'collectible', { counter: 'coins', destroyOnCollect: true }],
      [ids[2], 'checkpoint', {}],
      [ids[3], 'moving-platform', { axis: 'x', distance: 5, duration: 2 }],
      [ids[4], 'opening-door', { axis: 'y', distance: 3, duration: 1 }],
      [ids[5], 'spawn-point', { makeDefault: true }],
      [ids[6], 'basic-enemy', { speed: 3, detectionRadius: 10, health: 80, contactDamage: 9, cooldown: 1 }],
    ];
    for (const [id, query, values] of loop) { await selectSceneId(page, id); await applyPreset(page, query, values); }
    report.dogfood.outputs = await page.evaluate((objectIds) => objectIds.map((id) => { const item = placed.find((p) => p.id === id); return { id, behaviors: (item.behaviors || []).map((b) => b.action), clips: (item.animationClips || []).map((c) => c.name), health: item.health || null, ai: item.entity.ai ? item.entity.ai.type : null, spawn: !!item.isSpawnPoint }; }), ids);
    assert(report.dogfood.outputs.some((o) => o.behaviors.includes('incrementCounter')));
    assert(report.dogfood.outputs.some((o) => o.behaviors.includes('setCheckpoint')));
    assert(report.dogfood.outputs.some((o) => o.clips.includes('Preset Platform Patrol')));
    assert(report.dogfood.outputs.some((o) => o.ai === 'follow' && o.health.max === 80));
    assert(report.dogfood.outputs.some((o) => o.spawn));
    report.dogfood.manualFallbacks = ['Selected/placed seven ordinary scene objects because presets configure existing objects.', 'Used the sample project’s existing Player; Player creation is not a Phase 008 preset.'];
    report.dogfood.customScript = false;

    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#project-name-input').fill('phase-008-preset-proof');
    await page.locator('#save-btn').click(); await page.locator('#load-btn').click();
    await page.waitForFunction((id) => !loadingProjectGuard && placed.some((item) => item.id === id && item.behaviors && item.behaviors.some((b) => b.action === 'damagePlayer')), ids[0]);
    report.checks.saveLoad = true;
    await selectSceneId(page, ids[6]);
    await page.locator('#prefab-name-input').fill('Phase 008 Enemy Proof'); await page.locator('#save-prefab-btn').click();
    report.checks.prefab = await page.evaluate(() => { const p = prefabs.find((entry) => entry.name === 'Phase 008 Enemy Proof'); return { health: p.record.components.health, ai: p.record.ai.type, behavior: p.record.behaviors[0].action }; });
    assert.deepStrictEqual(report.checks.prefab.health, { version: 1, max: 80, current: 80 });
    const countBefore = await page.evaluate(() => placed.length); await page.locator('#duplicate-btn').click();
    report.checks.duplicate = await page.evaluate(() => ({ health: selectedItem.health, ai: selectedItem.entity.ai.type, behavior: selectedItem.behaviors[0].action, count: placed.length }));
    assert.strictEqual(report.checks.duplicate.count, countBefore + 1);

    report.checks.exports = await page.evaluate(async () => { const files = await Promise.all([buildExportHTML(false), buildExportHTML(true)]); return files.map((html) => ({ registry: html.includes('GameplayPresetRegistry'), picker: html.includes('Apply Gameplay Preset'), data: html.includes('Preset Platform Patrol') && html.includes('damagePlayer') })); });
    assert(report.checks.exports.every((entry) => entry.registry && entry.picker && entry.data));
    await page.locator('[data-right-tab="project"]').click();
    await page.locator('#validate-project-btn').click();
    report.checks.validation = await page.evaluate(() => ({ ran: !!lastProjectValidation, errors: lastProjectValidation.issues.filter((i) => i.severity === 'error').length }));
    assert(report.checks.validation.ran);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('[data-right-tab="inspector"]').click(); await page.locator('#gameplay-preset-btn').click();
    const wide = await page.locator('.gameplay-preset-dialog').boundingBox();
    assert(wide && wide.x >= 0 && wide.y >= 0 && wide.x + wide.width <= 1920 && wide.y + wide.height <= 1080);
    report.checks.size1920 = { width: Math.round(wide.width), height: Math.round(wide.height) };
    await page.keyboard.press('Escape');
    assert.deepStrictEqual(report.errors, []);
    report.ok = true; console.log(JSON.stringify(report, null, 2));
    await context.close();
  } catch (error) {
    report.ok = false; report.failure = error.stack; console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
  } finally { if (browser) await browser.close(); server.kill(); }
})();
