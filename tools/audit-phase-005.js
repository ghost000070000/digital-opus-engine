'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8865;
const URL = `http://127.0.0.1:${PORT}/editor/?game=arsenal-run`;

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve-static-root.js'), ROOT, String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  const report = { url: URL, surfaces: {}, metadata: {}, compatibility: {}, errors: [] };
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
    await page.waitForFunction(() => typeof OpusAuthoringLanguage !== 'undefined' && typeof ACTION_TYPES !== 'undefined');
    if (await page.locator('#app').evaluate((element) => element.classList.contains('editor-hidden'))) await page.locator('#chrome-toggle-btn').click();

    await page.locator('[data-right-tab="scene"]').click();
    const index = await page.evaluate(() => placed.findIndex((item) => item.kind === 'cube'));
    assert(index >= 0);
    await page.locator(`.scene-list-item[data-index="${index}"]`).click();
    await page.locator('[data-right-tab="inspector"]').click();

    const behaviorAction = await page.locator('#b-action option[value="moveObject"]').textContent();
    const behaviorEvent = await page.locator('#b-trigger option[value="enter"]').textContent();
    report.surfaces.behavior = { moveObject: behaviorAction.trim(), enter: behaviorEvent.trim() };
    assert.strictEqual(report.surfaces.behavior.moveObject, 'Move Object');
    assert.strictEqual(report.surfaces.behavior.enter, 'On Trigger Enter');

    await page.locator('#b-action').selectOption('graph');
    await page.locator('#add-behavior-btn').click();
    await page.locator('#graph-modal').waitFor({ state: 'visible' });
    const graphAction = (await page.locator('#graph-toolbar-buttons [data-node-type="moveObject"]').textContent()).trim();
    const graphCondition = (await page.locator('#graph-toolbar-buttons [data-node-type="isFlagTrue"]').textContent()).trim();
    report.surfaces.visualGraph = { moveObject: graphAction, isFlagTrue: graphCondition };
    assert.strictEqual(graphAction, report.surfaces.behavior.moveObject);
    assert.strictEqual(graphCondition, 'Flag Is Set');
    await page.locator('#graph-cancel-btn').click();

    await page.locator('[data-right-tab="project"]').click();
    const sequenceAction = (await page.locator('#sequence-add-step-type option[value="moveObject"]').textContent()).trim();
    report.surfaces.sequence = { moveObject: sequenceAction };
    assert.strictEqual(sequenceAction, report.surfaces.behavior.moveObject);

    await page.locator('[data-right-tab="inspector"]').click();
    report.surfaces.inspector = {
      tab: (await page.locator('[data-right-tab="inspector"]').textContent()).trim(),
      hasBehaviors: await page.locator('#behavior-list').count() === 1,
      hasTransform: await page.locator('#f-x').count() === 1,
    };
    assert(report.surfaces.inspector.hasBehaviors && report.surfaces.inspector.hasTransform);

    await page.locator('[data-left-tab="objects"]').click();
    report.surfaces.palette = {
      billboard: (await page.locator('#palette-billboard').textContent()).trim(),
      door: (await page.locator('#palette-door').textContent()).trim(),
      projectile: (await page.locator('#palette-projectilePreset').textContent()).trim(),
    };
    assert(report.surfaces.palette.billboard.includes('World-Space Billboard'));
    assert(report.surfaces.palette.door.includes('Sliding Door'));
    assert(report.surfaces.palette.projectile.includes('Projectile Starter'));

    report.metadata = await page.evaluate(() => {
      const actions = Object.entries(ACTION_TYPES);
      return {
        taxonomyCount: OpusAuthoringLanguage.TAXONOMY.length,
        categories: OpusAuthoringLanguage.CATEGORIES.slice(),
        actionCount: actions.length,
        actionIdsUnique: new Set(actions.map(([id]) => id)).size === actions.length,
        actionMetadataComplete: actions.every(([id, definition]) => definition.id === id && definition.label && definition.category && definition.help && Array.isArray(definition.aliases)),
        graphConditionCount: Object.values(GRAPH_NODE_TYPES).filter((entry) => entry.kind === 'condition').length,
        aiConditionCount: AI_CONDITION_TYPES.length,
        paletteCount: document.querySelectorAll('#left-tab-objects .palette-item').length,
        componentIds: OpusAuthoringLanguage.COMPONENTS.map((entry) => entry.id),
        schemaIds: OpusAuthoring.registry.list().map((entry) => entry.id),
      };
    });
    assert.strictEqual(report.metadata.taxonomyCount, 13);
    assert(report.metadata.actionCount > 70 && report.metadata.actionIdsUnique && report.metadata.actionMetadataComplete);
    assert.deepStrictEqual(report.metadata.componentIds.slice().sort(), report.metadata.schemaIds.slice().sort());

    report.compatibility = await page.evaluate(() => ({
      moveObjectId: OpusAuthoringLanguage.resolveActionId('Move Object (relative)', ACTION_TYPES),
      playAudioId: OpusAuthoringLanguage.resolveActionId('Play Audio', ACTION_TYPES),
      directStableId: OpusAuthoringLanguage.resolveActionId('setVisibility', ACTION_TYPES),
      stableKeysStillExist: ['moveObject', 'sound', 'setVisibility', 'script'].every((id) => Boolean(ACTION_TYPES[id])),
    }));
    assert.deepStrictEqual(report.compatibility, { moveObjectId: 'moveObject', playAudioId: 'sound', directStableId: 'setVisibility', stableKeysStillExist: true });
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
