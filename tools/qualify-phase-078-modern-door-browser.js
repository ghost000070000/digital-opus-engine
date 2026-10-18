'use strict';
// Real browser/native controls and canonical Body2D ticks. Evaluate is read-only.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const authoring = require('../editor/src/00-authoring-schema');
const root = path.resolve(__dirname, '..');
const runId = 'modern-door-browser-' + new Date().toISOString().replace(/[-:.]/g, '');
const dir = path.join(root, 'qualification/phase-078', runId); fs.mkdirSync(dir, { recursive: true });
function component(id, overrides = {}) { const schema = authoring.registry.get(id); return { version: schema.version, ...authoring.stableClone(schema.defaults), ...overrides }; }
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'qualification/phase-042/phase-042-project.json')));
const camera = fixture.levels[0].objects.find(item => item.kind === 'camera');
function sprite(id, x, size, body) { return { id, name: id, kind: 'sprite', position: [x, 0, 0], scale: [1, 1, 1], rotationY: 0, behaviors: [], components: {
  'sprite-renderer': component('sprite-renderer', { width: size, height: size, tint: id === 'gate' ? '#27b5dd' : '#f6ce37' }),
  'box-collider-2d': component('box-collider-2d', { offset: [0, 0], size: [size, size] }),
  'body-2d': component('body-2d', body),
} }; }
fixture.levels[0].objects = [camera, sprite('gate', 3, 2, { type: 'static', linearVelocity: [0, 0] }), sprite('actor', 0, 1, { type: 'kinematic', linearVelocity: [.5, 0] })];
fixture.prefabs = []; fixture.levels[0].name = 'Modern Door Physical Lab';
fixture.world.ui.startScreen.enabled = false;
fixture.world.playerSettings.controllerType = 'topdown';
fixture.levels[0].playerSettings = fixture.world.playerSettings;
fixture.world.ui.hudElements = [['open', 'openDoor'], ['close', 'closeDoor'], ['toggle', 'toggleDoor'], ['save-game', 'saveGame'], ['load-game', 'loadGame']].map(([id, action], i) => ({
  id, kind: 'button', anchor: 'top-left', offsetX: 240, offsetY: 100 + i * 55, text: id, visible: true, buttonAction: action,
  buttonParams: action.endsWith('Game') ? { slot: runId } : { targetId: 'gate' },
}));
fixture.levels[0].ui = fixture.world.ui;
const fixturePath = path.join(dir, 'fixture.json'); fs.writeFileSync(fixturePath, JSON.stringify(fixture));
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), steps: [], pageErrors: [], consoleErrors: [], externalRequests: [], status: 'IN_PROGRESS' };
function record(label, observation) { proof.steps.push({ label, observedAt: new Date().toISOString(), observation }); fs.writeFileSync(path.join(dir, 'proof.json'), JSON.stringify(proof, null, 2)); }
async function observe(page) { return page.evaluate(() => {
  const gate = placed.find(item => item.id === 'gate'), actor = placed.find(item => item.id === 'actor'), state = doorGateState.get(gate);
  return { playing: playMode, paused: app.paused, actor: actor && { position: [actor.entity.position.x, actor.entity.position.y, actor.entity.position.z], body: JSON.parse(JSON.stringify(actor.components['body-2d'])) },
    gate: gate && { visible: gate.entity.visible, colliderEnabled: gate.components['box-collider-2d'].enabled, policy: JSON.parse(JSON.stringify(gate.components['door-gate'])), open: state?.open, colliderBaseline: state && { ...state.colliders } }, toast: document.getElementById('game-toast')?.textContent };
}); }
async function select(page, id) { await page.locator('[data-right-tab="scene"]').click(); const index = await page.evaluate(id => placed.findIndex(item => item.id === id), id); assert(index >= 0); await page.locator(`.scene-list-item[data-index="${index}"]`).click(); await page.locator('[data-right-tab="inspector"]').click(); }
async function setPolicy(page, key, value) { await page.locator(`[data-schema-slot="door-gate"] [data-component-field="${key}"]`).setChecked(value); }
async function drive(page, tier) {
  await page.waitForFunction(() => playMode && placed.some(item => item.id === 'actor'));
  const initial = await observe(page); assert.equal(initial.gate.visible, true); assert.equal(initial.gate.colliderEnabled, true); assert.equal(initial.gate.open, false);
  await page.waitForFunction(() => placed.find(item => item.id === 'actor').entity.position.x > 1.4);
  await page.waitForTimeout(800); const blocked = await observe(page);
  assert(blocked.actor.position[0] > 1.4 && blocked.actor.position[0] < 1.501, 'Actual Kinematic Body must stop against closed Static Sprite Door');
  record(tier + ' canonical Body2D movement blocked by closed Sprite Door', { initial, blocked });
  await page.screenshot({ path: path.join(dir, tier + '-closed-contact.png') });
  await page.locator('[data-hud-button="open"]').click(); const opened = await observe(page); assert.equal(opened.gate.colliderEnabled, false); assert.equal(opened.gate.visible, false); assert.equal(opened.gate.open, true);
  await page.waitForFunction(() => placed.find(item => item.id === 'actor').entity.position.x >= 2.7);
  await page.locator('[data-hud-button="close"]').click(); const occupied = await observe(page);
  assert(occupied.actor.position[0] > 2.5 && occupied.actor.position[0] < 4.5, 'Native Close occurs during real overlap');
  assert.equal(occupied.gate.open, true); assert.equal(occupied.gate.colliderEnabled, false); assert.equal(occupied.gate.visible, false); assert(occupied.toast.includes('Doorway occupied'));
  record(tier + ' native occupied Close refuses atomically; no player/actor displacement', occupied);
  await page.screenshot({ path: path.join(dir, tier + '-occupied-close.png') });
  await page.waitForFunction(() => placed.find(item => item.id === 'actor').entity.position.x > 4.65);
  await page.locator('[data-hud-button="close"]').click(); const clear = await observe(page); assert.equal(clear.gate.open, false); assert.equal(clear.gate.visible, true); assert.equal(clear.gate.colliderEnabled, true);
  record(tier + ' real actor crossed; clear Close restores authored enabled Collider', clear);
  await page.locator('[data-hud-button="toggle"]').click(); assert.equal((await observe(page)).gate.open, true);
  await page.locator('[data-hud-button="save-game"]').click();
  const saved = await page.evaluate(slot => new Opus.SaveSystem('doengine:playersave').load(slot), runId);
  assert.equal(saved.worldState?.[fixture.levels[0].id]?.gate?.doorOpen, true, 'Explicit Sprite Door persistence writes reached state');
  await page.locator('[data-hud-button="close"]').click(); assert.equal((await observe(page)).gate.colliderEnabled, true);
  await page.locator('[data-hud-button="load-game"]').click(); const loaded = await observe(page);
  assert.equal(loaded.gate.open, true); assert.equal(loaded.gate.visible, false); assert.equal(loaded.gate.colliderEnabled, false);
  record(tier + ' native Toggle/Game Save/Load restore Sprite Door physics, not only rendering', { savedDoorOpen: saved.worldState[fixture.levels[0].id].gate.doorOpen, loaded });
}
const server = http.createServer((request, response) => { const file = path.resolve(root, '.' + decodeURIComponent(request.url.split('?')[0])); if (!file.startsWith(root + path.sep)) { response.writeHead(403); return response.end(); } fs.readFile(file, (error, bytes) => { response.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); response.end(error ? 'Not found' : bytes); }); });
(async () => { let browser, page; try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: 'msedge', headless: true }); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  context.on('page', page => { page.on('pageerror', error => proof.pageErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') proof.consoleErrors.push(message.text()); }); page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + '/')) proof.externalRequests.push(request.url()); }); });
  page = await context.newPage(); await page.goto(origin + '/editor/index.html'); await page.waitForFunction(() => typeof serializeProject === 'function');
  if (await page.locator('#first-run-skip').isVisible()) await page.locator('#first-run-skip').click(); await page.locator('#import-project-input').setInputFiles(fixturePath); await page.waitForFunction(() => placed.some(item => item.id === 'gate'));
  await page.locator('[data-right-tab="level"]').click(); if (!await page.locator('#player-controller-type').isVisible()) await page.locator('[data-section="player"]').click(); await page.locator('#player-controller-type').selectOption('topdown');
  await select(page, 'gate'); await page.locator('#add-component-btn').click(); await page.locator('[data-add-component-search]').fill('door'); await page.locator('[data-add-component-id="door-gate"]').click(); await setPolicy(page, 'persistState', true);
  record('Native Add Door/Gate and explicit Remember State on existing Static Sprite', await observe(page));
  await setPolicy(page, 'startsOpen', true); await page.locator('#play-btn').click(); await page.waitForFunction(() => playMode);
  const startsOpen = await observe(page); assert.equal(startsOpen.gate.open, true); assert.equal(startsOpen.gate.colliderEnabled, false); record('Source native Starts Open disables real Collider before gameplay', startsOpen);
  await page.locator('#play-btn').click(); const stopped = await observe(page); assert.equal(stopped.gate.visible, true); assert.equal(stopped.gate.colliderEnabled, true); record('Stop restores authored visible Sprite and Collider', stopped);
  await select(page, 'gate'); await setPolicy(page, 'startsOpen', false); await page.locator('[data-schema-slot="door-gate"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(dir, 'authoring.png') });
  await page.locator('#play-btn').click(); await drive(page, 'Source');
  const authored = await page.evaluate(() => serializeProject().levels[0].objects.find(item => item.id === 'gate')); assert.equal(authored.components['box-collider-2d'].enabled, true); assert.equal(authored.components['door-gate'].startsOpen, false); record('Project serialization during open gameplay owns authored Collider state', { authored });
  await page.locator('#play-btn').click(); assert.equal((await observe(page)).gate.colliderEnabled, true);
  for (const [tier, button] of [['Editable', '#export-standalone-btn'], ['Playable', '#export-playable-btn']]) {
    await page.locator('[data-right-tab="project"]').click(); const [download] = await Promise.all([page.waitForEvent('download'), page.locator(button).click()]); const output = path.join(dir, tier + '.html'); await download.saveAs(output);
    const exported = await context.newPage(); await exported.goto(origin + '/' + path.relative(root, output).replace(/\\/g, '/')); await exported.waitForFunction(() => typeof serializeProject === 'function');
    if (tier === 'Editable') { if (!await exported.locator('#play-btn').isVisible()) await exported.locator('#chrome-toggle-btn').click(); await exported.locator('#play-btn').click(); } else if (await exported.locator('#start-overlay-btn').isVisible()) await exported.locator('#start-overlay-btn').click();
    await drive(exported, tier); await exported.close();
  }
  assert.deepStrictEqual(proof.pageErrors, []); assert.deepStrictEqual(proof.consoleErrors, []); assert.deepStrictEqual(proof.externalRequests, []);
  proof.finalFingerprint = require('./real-demo-program-state').fingerprint(); assert.equal(proof.finalFingerprint, proof.fingerprint); proof.status = 'NATIVE_MODERN_SPRITE_DOOR_PHYSICAL_SAVE_BOTH_EXPORTS_PASS';
} catch (error) { proof.status = 'OBSERVED_FAILURE_OR_AUTOMATION'; proof.failure = error.stack; proof.failureObservation = await observe(page).catch(() => null); await page?.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {}); process.exitCode = 1;
} finally { proof.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify({ runId, status: proof.status, steps: proof.steps.length, failure: proof.failure, observation: proof.failureObservation, pageErrors: proof.pageErrors, consoleErrors: proof.consoleErrors, externalRequests: proof.externalRequests })); await browser?.close(); server.close(); }
})();
