'use strict';
// Native authoring and actual Player input; evaluate only observes live state.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), runId = 'platform-browser-' + new Date().toISOString().replace(/[-:.]/g, '');
const dir = path.join(root, 'qualification/phase-079', runId); fs.mkdirSync(dir, { recursive: true });
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'qualification/phase-070/event-game-browser-20261010T020420627Z/fixture.json')));
fixture.levels[0].objects = [
  { id: 'platform', kind: 'cube', name: 'Rider Platform', position: [0, 1, 0], scale: [6, .5, 6], color: [.2, .75, .85], behaviors: [] },
  { id: 'ground', kind: 'cube', name: 'Safe Ground', position: [0, -.5, 0], scale: [50, 1, 50], color: [.35, .45, .3], solid: true, behaviors: [] },
  { id: 'spawn', kind: 'cube', name: 'Platform Spawn', position: [0, 1.25, 0], scale: [.5, .9, .5], color: [.9, .8, .2], isSpawnPoint: true, isDefaultSpawn: true, behaviors: [] },
];
fixture.prefabs = [];
fixture.world.ui.hudElements = [['start', 'startPlatformMotion'], ['stop-motion', 'stopAnimation']].map(([id, action], i) => ({ id, kind: 'button', anchor: 'top-left', offsetX: 240, offsetY: 100 + i * 55, text: id, visible: true, buttonAction: action, buttonParams: { targetId: 'platform' } }));
fixture.world.ui.startScreen.enabled = false; fixture.levels[0].ui = fixture.world.ui;
fixture.world.playerSettings.controllerType = 'thirdperson'; fixture.world.playerSettings.jumpEnabled = true; fixture.levels[0].playerSettings = fixture.world.playerSettings;
const fixturePath = path.join(dir, 'fixture.json'); fs.writeFileSync(fixturePath, JSON.stringify(fixture));
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), steps: [], pageErrors: [], consoleErrors: [], externalRequests: [], status: 'IN_PROGRESS' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(error ? 'Not found' : bytes); });
});
function record(label, data = {}) { proof.steps.push({ label, observedAt: new Date().toISOString(), ...data }); fs.writeFileSync(path.join(dir, 'proof.json'), JSON.stringify(proof, null, 2)); }
async function select(page, id) { await page.locator('[data-right-tab="scene"]').click(); const index = await page.evaluate(id => placed.findIndex(item => item.id === id), id); assert(index >= 0); await page.locator(`.scene-list-item[data-index="${index}"]`).click(); await page.locator('[data-right-tab="inspector"]').click(); }
async function add(page, id) { await page.locator('#add-component-btn').click(); await page.locator('[data-add-component-search]').fill(id); await page.locator(`[data-add-component-id="${id}"]`).click(); }
async function field(page, key, value) { const input = page.locator(`[data-schema-slot="moving-platform-3d"] [data-component-field="${key}"]`); if (typeof value === 'boolean') await input.setChecked(value); else if (key === 'axis') await input.selectOption(value); else await input.fill(String(value)); }
async function observe(page) {
  return page.evaluate(() => {
    const platform = placed.find(item => item.id === 'platform');
    return { playing: playMode, paused: app.paused, controller: player?.controllerType, grounded: typeof thirdPersonGrounded === 'boolean' ? thirdPersonGrounded : null,
      player: player && [player.entity.position.x, player.entity.position.y, player.entity.position.z], playerScale: player && [player.entity.scale.x, player.entity.scale.y, player.entity.scale.z],
      platform: platform && [platform.entity.position.x, platform.entity.position.y, platform.entity.position.z], policy: platform?.components?.['moving-platform-3d'],
      authoredPlatform: serializeProject().levels[0].objects.find(item => item.id === 'platform')?.position, generatedClip: !!platform?._anim?.componentClip,
      parentId: platform?.parentId || null, localPosition: platform?.localPosition && [platform.localPosition.x, platform.localPosition.y, platform.localPosition.z],
      authoredClips: platform?.animationClips?.length || 0, behaviors: platform?.behaviors?.length || 0 };
  });
}
async function driveCarry(page, tier) {
  await page.waitForFunction(() => playMode && player?.controllerType === 'thirdperson' && thirdPersonGrounded);
  const before = await observe(page);
  await page.waitForFunction(() => placed.find(item => item.id === 'platform').entity.position.x > 1.2);
  const carried = await observe(page);
  const platformDelta = carried.platform[0] - before.platform[0], playerDelta = carried.player[0] - before.player[0];
  assert(platformDelta > .5, 'The live platform must actually translate'); assert(Math.abs(platformDelta - playerDelta) < .15, 'A standing Player must inherit actual platform translation');
  assert(Math.abs(carried.player[1] - carried.playerScale[1] / 2 - (carried.platform[1] + .25)) < .08, 'Player feet must remain supported on the actual platform top');
  assert.deepStrictEqual(carried.authoredPlatform, [0, 1, 0], 'Project serialization during Play must not bake component runtime motion');
  record(tier + ' actual grounded Player carries with translating Solid platform', { before, carried, platformDelta, playerDelta });
  await page.screenshot({ path: path.join(dir, tier + '-standing-carry.png') });
  await page.keyboard.press('Escape'); await page.waitForFunction(() => app.paused);
  const paused = await observe(page); await page.waitForTimeout(300); const frozen = await observe(page);
  assert.deepStrictEqual(frozen.platform, paused.platform); assert.deepStrictEqual(frozen.player, paused.player);
  await page.locator('#pause-resume-btn').click(); await page.waitForFunction(() => !app.paused);
  record(tier + ' native Pause freezes both motion and supported rider');
  await page.keyboard.down('w');
  await page.waitForFunction(() => { const p = placed.find(item => item.id === 'platform'); return Math.hypot(player.entity.position.x - p.entity.position.x, player.entity.position.z - p.entity.position.z) > 4.5 && player.entity.position.y < 1 && thirdPersonGrounded; });
  await page.keyboard.up('w'); const walkedOff = await observe(page); assert(walkedOff.player[1] < carried.player[1] - .5, 'Walking off must release support and fall toward safe ground');
  record(tier + ' actual W input walks off; rider releases support instead of remaining glued', walkedOff);
  await page.screenshot({ path: path.join(dir, tier + '-walk-off.png') });
}
(async () => {
  let browser, page;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ channel: 'msedge', headless: true }); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    context.on('page', p => { p.on('pageerror', error => proof.pageErrors.push(error.message)); p.on('console', message => { if (message.type() === 'error') proof.consoleErrors.push(message.text()); }); p.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + '/')) proof.externalRequests.push(request.url()); }); });
    page = await context.newPage(); await page.goto(origin + '/editor/index.html'); await page.waitForFunction(() => typeof serializeProject === 'function'); if (await page.locator('#first-run-skip').isVisible()) await page.locator('#first-run-skip').click();
    await page.locator('#import-project-input').setInputFiles(fixturePath); await page.waitForFunction(() => placed.some(item => item.id === 'platform'));
    await page.locator('[data-right-tab="level"]').click(); if (!await page.locator('#player-controller-type').isVisible()) await page.locator('[data-section="player"]').click(); await page.locator('#player-controller-type').selectOption('thirdperson'); await page.locator('#player-jump-enabled').setChecked(true);
    await select(page, 'platform'); await page.locator('#f-solid').setChecked(true); await add(page, 'moving-platform-3d');
    const baseline = await page.evaluate(() => JSON.parse(JSON.stringify(placed.find(item => item.id === 'platform').components['moving-platform-3d']))); assert.equal(baseline.autoplay, false); assert.equal(baseline.enabled, true);
    await field(page, 'distance', 2); await page.locator('[data-schema-slot="moving-platform-3d"] [data-component-field="distance"]').press('Tab'); await page.locator('#undo-btn').click(); assert.equal(await page.evaluate(() => placed.find(item => item.id === 'platform').components['moving-platform-3d'].distance), baseline.distance);
    await page.locator('#redo-btn').click(); await select(page, 'platform'); assert.equal(await page.evaluate(() => placed.find(item => item.id === 'platform').components['moving-platform-3d'].distance), 2);
    await field(page, 'axis', 'x'); await field(page, 'duration', 2); record('Native Add Moving Platform 3D, meaningful defaults, typed Axis and Distance Undo/Redo');
    await page.locator('#play-btn').click(); await page.waitForFunction(() => playMode && player); await page.waitForTimeout(300); assert.deepStrictEqual((await observe(page)).platform, [0, 1, 0]);
    await page.locator('[data-hud-button="start"]').click(); await page.waitForFunction(() => placed.find(item => item.id === 'platform').entity.position.x > .3); assert.equal((await observe(page)).generatedClip, true); await page.locator('#play-btn').click();
    assert.deepStrictEqual((await observe(page)).platform, [0, 1, 0]); record('Start Automatically defaults off; native Start Platform Motion works; Stop restores authored position');
    await select(page, 'platform'); await field(page, 'autoplay', true); await field(page, 'enabled', false); await page.locator('#play-btn').click(); await page.waitForTimeout(300); assert.deepStrictEqual((await observe(page)).platform, [0, 1, 0]); await page.locator('#play-btn').click();
    await select(page, 'platform'); await field(page, 'enabled', true); record('Disabled Platform remains inert even with Start Automatically configured');
    await page.locator('#duplicate-btn').click(); await field(page, 'distance', 9); assert.equal(await page.evaluate(() => placed.find(item => item.id === 'platform').components['moving-platform-3d'].distance), 2);
    await page.locator('#undo-btn').click(); await page.locator('#undo-btn').click(); await select(page, 'platform'); await page.locator('#prefab-name-input').fill(runId); await page.locator('#save-prefab-btn').click();
    assert.equal(await page.evaluate(name => prefabs.find(prefab => prefab.name === name).record.components['moving-platform-3d'].distance, runId), 2); record('Native duplicate owns independent travel; Prefab captures authored component only');
    await page.locator('[data-schema-slot="moving-platform-3d"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(dir, 'authoring.png') });
    await page.locator('#play-btn').click(); await driveCarry(page, 'Source'); await page.locator('#play-btn').click(); assert.deepStrictEqual((await observe(page)).platform, [0, 1, 0]);
    await select(page, 'platform'); await page.locator('#f-parent').selectOption('ground'); await select(page, 'platform');
    assert.equal((await observe(page)).parentId, 'ground'); assert.deepStrictEqual((await observe(page)).platform, [0, 1, 0]);
    await page.locator('#play-btn').click(); await driveCarry(page, 'Source-parented'); await page.locator('#play-btn').click();
    assert.equal((await observe(page)).parentId, 'ground'); assert.deepStrictEqual((await observe(page)).platform, [0, 1, 0]);
    record('Native Parent To selection retains world motion, real carry and authored hierarchy after Stop', await observe(page));
    await select(page, 'platform'); await page.locator('[data-component-remove="moving-platform-3d"]').click(); await page.locator('#undo-btn').click(); await select(page, 'platform'); assert.equal((await observe(page)).policy.autoplay, true); record('Native Remove/Undo and Stop preserve authored motion configuration and position');
    await page.locator('[data-right-tab="project"]').click(); await page.locator('#project-name-input').fill(runId); await page.locator('#save-btn').click(); const saved = await page.evaluate(() => JSON.stringify(serializeProject().levels[0].objects));
    await page.reload(); await page.waitForFunction(() => typeof serializeProject === 'function'); if (await page.locator('#first-run-skip').isVisible()) await page.locator('#first-run-skip').click(); if (!await page.locator('[data-right-tab="project"]').isVisible()) await page.locator('#chrome-toggle-btn').click();
    await page.locator('[data-right-tab="project"]').click(); await page.locator('#project-list-select').selectOption(runId); await page.locator('#load-btn').click(); assert.equal(await page.evaluate(() => JSON.stringify(serializeProject().levels[0].objects)), saved); record('Native project Save/reopen preserves exact authored platform and motion data');
    for (const [tier, button] of [['Editable', '#export-standalone-btn'], ['Playable', '#export-playable-btn']]) {
      await page.locator('[data-right-tab="project"]').click(); const [download] = await Promise.all([page.waitForEvent('download'), page.locator(button).click()]); const file = path.join(dir, tier + '.html'); await download.saveAs(file);
      const exported = await context.newPage(); await exported.goto(origin + '/' + path.relative(root, file).replace(/\\/g, '/')); await exported.waitForFunction(() => typeof serializeProject === 'function');
      if (tier === 'Editable') { if (!await exported.locator('#play-btn').isVisible()) await exported.locator('#chrome-toggle-btn').click(); await exported.locator('#play-btn').click(); } else if (await exported.locator('#start-overlay-btn').isVisible()) await exported.locator('#start-overlay-btn').click();
      await driveCarry(exported, tier); await exported.close();
    }
    assert.deepStrictEqual(proof.pageErrors, []); assert.deepStrictEqual(proof.consoleErrors, []); assert.deepStrictEqual(proof.externalRequests, []); proof.status = 'NATIVE_PLATFORM_3D_CARRY_AUTHORING_EXPORT_PASS';
  } catch (error) { proof.status = 'OBSERVED_FAILURE_OR_AUTOMATION'; proof.failure = error.stack; proof.failureObservation = await observe(page).catch(() => null); await page?.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {}); process.exitCode = 1; }
  finally { proof.endedAt = new Date().toISOString(); proof.finalFingerprint = require('./real-demo-program-state').fingerprint(); fs.writeFileSync(path.join(dir, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify({ runId, status: proof.status, steps: proof.steps.length, fingerprint: proof.fingerprint, finalFingerprint: proof.finalFingerprint, failure: proof.failure, observation: proof.failureObservation, pageErrors: proof.pageErrors, consoleErrors: proof.consoleErrors, externalRequests: proof.externalRequests })); await browser?.close(); server.close(); }
})();
