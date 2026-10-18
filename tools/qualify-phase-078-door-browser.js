'use strict';
// Native editor authoring and native game input. Browser evaluate is read-only.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const runId = 'door-browser-' + new Date().toISOString().replace(/[-:.]/g, '');
const dir = path.join(root, 'qualification/phase-078', runId);
fs.mkdirSync(dir, { recursive: true });
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'qualification/phase-070/event-game-browser-20261010T020420627Z/fixture.json')));
fixture.levels[0].objects = [
  { id: 'gate', kind: 'cube', name: 'Workshop Gate', position: [0, 1.5, -3], scale: [10, 3, .5], color: [.25, .75, .85], behaviors: [] },
  { id: 'spawn', kind: 'cube', name: 'Safe Spawn', position: [0, .5, 0], scale: [.5, .9, .5], color: [.9, .8, .3], isSpawnPoint: true, isDefaultSpawn: true, behaviors: [] },
];
fixture.prefabs = [];
const hud = [['open', 'openDoor'], ['close', 'closeDoor'], ['toggle', 'toggleDoor'], ['save-game', 'saveGame'], ['load-game', 'loadGame']];
fixture.world.ui.hudElements = hud.map(([id, action], i) => ({ id, kind: 'button', anchor: 'top-left', offsetX: 240, offsetY: 100 + i * 55, text: id, visible: true, buttonAction: action, buttonParams: action.endsWith('Game') ? { slot: runId } : { targetId: 'gate' } }));
fixture.world.ui.startScreen.enabled = false;
fixture.levels[0].ui = fixture.world.ui;
fixture.world.playerSettings.controllerType = 'topdown';
fixture.levels[0].playerSettings = fixture.world.playerSettings;
const fixturePath = path.join(dir, 'fixture.json');
fs.writeFileSync(fixturePath, JSON.stringify(fixture));
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), steps: [], pageErrors: [], consoleErrors: [], externalRequests: [], status: 'IN_PROGRESS' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(error ? 'Not found' : bytes); });
});
function record(label, data = {}) { proof.steps.push({ label, observedAt: new Date().toISOString(), ...data }); fs.writeFileSync(path.join(dir, 'proof.json'), JSON.stringify(proof, null, 2)); }
async function select(page, id) {
  await page.locator('[data-right-tab="scene"]').click();
  const index = await page.evaluate(id => placed.findIndex(item => item.id === id), id);
  assert(index >= 0, 'Named Object must really exist');
  await page.locator(`.scene-list-item[data-index="${index}"]`).click();
  await page.locator('[data-right-tab="inspector"]').click();
}
async function add(page, id) { await page.locator('#add-component-btn').click(); await page.locator('[data-add-component-search]').fill(id); await page.locator(`[data-add-component-id="${id}"]`).click(); }
async function field(page, component, key, value) {
  const input = page.locator(`[data-schema-slot="${component}"] [data-component-field="${key}"]`);
  if (typeof value === 'boolean') await input.setChecked(value);
  else { await input.fill(String(value)); await input.press('Tab'); }
}
async function observe(page) {
  return page.evaluate(() => {
    const door = placed.find(item => item.id === 'gate');
    return { playing: playMode, player: player && { controller: player.controllerType, position: [player.entity.position.x, player.entity.position.y, player.entity.position.z] }, door: door && { visible: door.entity.visible, solid: door.entity.solid, components: JSON.parse(JSON.stringify(door.components || {})) }, nearest: nearestInteractable?.id };
  });
}
async function driveLegacyDoor(page, tier) {
  await page.waitForFunction(() => playMode && player?.controllerType === 'topdown');
  const initial = await observe(page); assert.equal(initial.door.visible, true); assert.equal(initial.door.solid, true);
  await page.keyboard.down('w'); await page.waitForFunction(() => player.entity.position.z < -1); await page.waitForTimeout(500); await page.keyboard.up('w');
  const blocked = await observe(page);
  assert(blocked.player.position[2] > -2.8 && blocked.player.position[2] < -1, 'Closed Gate must visibly stop actual movement before the panel');
  record(tier + ' actual W movement stops at closed legacy solid Gate', { initial, blocked });
  await page.screenshot({ path: path.join(dir, tier + '-closed-contact.png') });
  await page.keyboard.press('f'); await page.waitForFunction(() => placed.find(item => item.id === 'gate').entity.visible === false);
  await page.keyboard.down('w');
  await page.waitForFunction(() => player.entity.position.z < -2.85);
  await page.locator('[data-hud-button="close"]').click();
  const occupied = await observe(page); assert.equal(occupied.door.visible, false, 'Closing must refuse to reintroduce solid geometry through the controlled Player');
  record(tier + ' On Interact Open Door uses Self; occupied Close refuses', occupied);
  await page.screenshot({ path: path.join(dir, tier + '-occupied-close.png') });
  await page.waitForFunction(() => player.entity.position.z < -5); await page.keyboard.up('w');
  await page.locator('[data-hud-button="close"]').click(); assert.equal((await observe(page)).door.visible, true);
  await page.keyboard.down('s'); await page.waitForFunction(() => player.entity.position.z > -5.2); await page.waitForTimeout(650); await page.keyboard.up('s');
  const reverseBlocked = await observe(page); assert(reverseBlocked.player.position[2] < -3.3, 'Closed Gate must block return from the other side');
  record(tier + ' Open Gate permits crossing; Close blocks reverse movement', reverseBlocked);
  await page.locator('[data-hud-button="toggle"]').click(); assert.equal((await observe(page)).door.visible, false);
  await page.locator('[data-hud-button="save-game"]').click();
  const save = await page.evaluate(slot => new Opus.SaveSystem('doengine:playersave').load(slot), runId); assert(save, 'Native Save Game creates a real save');
  await page.locator('[data-hud-button="close"]').click(); assert.equal((await observe(page)).door.visible, true);
  await page.locator('[data-hud-button="load-game"]').click(); assert.equal((await observe(page)).door.visible, false, 'Opt-in remembered Door state must restore from actual Game Save');
  const savedDoorState = save.worldState?.[fixture.levels[0].id]?.gate?.doorOpen;
  assert.equal(savedDoorState, true, 'Actual Game Save must own the opted-in Door open state');
  record(tier + ' native Toggle, opt-in Game Save and Load restore open state', { observed: await observe(page), savedDoorState });
  await page.screenshot({ path: path.join(dir, tier + '-gameplay.png') });
}
(async () => {
  let browser, page;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    context.on('page', p => {
      p.on('pageerror', error => proof.pageErrors.push(error.message));
      p.on('console', message => { if (message.type() === 'error') proof.consoleErrors.push(message.text()); });
      p.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + '/')) proof.externalRequests.push(request.url()); });
    });
    page = await context.newPage(); await page.goto(origin + '/editor/index.html'); await page.waitForFunction(() => typeof serializeProject === 'function');
    if (await page.locator('#first-run-skip').isVisible()) await page.locator('#first-run-skip').click();
    await page.locator('#import-project-input').setInputFiles(fixturePath); await page.waitForFunction(() => placed.some(item => item.id === 'gate'));
    await page.locator('[data-right-tab="level"]').click();
    if (!await page.locator('#player-controller-type').isVisible()) await page.locator('[data-section="player"]').click();
    await page.locator('#player-controller-type').selectOption('topdown');
    await select(page, 'gate'); await page.locator('#f-solid').setChecked(true); await add(page, 'door-gate');
    const baseline = await page.evaluate(() => JSON.parse(JSON.stringify(placed.find(item => item.id === 'gate').components['door-gate'])));
    assert.equal(baseline.startsOpen, false); assert.equal(baseline.persistState, false);
    await field(page, 'door-gate', 'startsOpen', true); await page.locator('#undo-btn').click();
    assert.equal(await page.evaluate(() => placed.find(item => item.id === 'gate').components['door-gate'].startsOpen), false);
    await page.locator('#redo-btn').click(); await select(page, 'gate');
    assert.equal(await page.evaluate(() => placed.find(item => item.id === 'gate').components['door-gate'].startsOpen), true);
    record('Native Add Door/Gate, meaningful defaults and Starts Open Undo/Redo');
    await page.locator('#play-btn').click(); await page.waitForFunction(() => playMode && player); assert.equal((await observe(page)).door.visible, false); await page.locator('#play-btn').click();
    await select(page, 'gate'); await field(page, 'door-gate', 'startsOpen', false); await field(page, 'door-gate', 'persistState', true);
    await add(page, 'interactable'); await field(page, 'interactable', 'range', 5); await field(page, 'interactable', 'prompt', 'Open Gate');
    await page.locator('#b-action-search').fill('openDoor'); await page.locator('#b-action').selectOption('openDoor');
    assert.equal(await page.locator('#b-fields [data-field="targetId"]').evaluate(element => element.tagName), 'SELECT');
    await page.locator('#b-trigger').selectOption('interact'); await page.locator('#add-behavior-btn').click();
    record('Native On Interact → Open Door Action uses discoverable typed Self target');
    await page.locator('[data-schema-slot="door-gate"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(dir, 'authoring.png') });
    await page.locator('#duplicate-btn').click(); await field(page, 'door-gate', 'startsOpen', true);
    assert.equal(await page.evaluate(() => placed.find(item => item.id === 'gate').components['door-gate'].startsOpen), false);
    await page.locator('#undo-btn').click(); await page.locator('#undo-btn').click(); await select(page, 'gate');
    await page.locator('#prefab-name-input').fill(runId); await page.locator('#save-prefab-btn').click();
    assert.equal(await page.evaluate(name => prefabs.find(prefab => prefab.name === name).record.components['door-gate'].persistState, runId), true);
    record('Native duplicate owns independent configuration and Prefab captures authored Door data');
    await page.locator('#play-btn').click(); await driveLegacyDoor(page, 'Source'); await page.locator('#play-btn').click();
    await select(page, 'gate'); assert.equal((await observe(page)).door.visible, true); assert.equal((await observe(page)).door.components['door-gate'].startsOpen, false);
    record('Stop restores authored closed Door independently from remembered Game Save');
    await field(page, 'door-gate', 'enabled', false); await page.locator('#play-btn').click(); await page.locator('[data-hud-button="open"]').click(); assert.equal((await observe(page)).door.visible, true); await page.locator('#play-btn').click();
    await select(page, 'gate'); await field(page, 'door-gate', 'enabled', true);
    await page.locator('[data-component-remove="door-gate"]').click(); await page.locator('#undo-btn').click(); await select(page, 'gate');
    assert.equal((await observe(page)).door.components['door-gate'].persistState, true); record('Disabled Door is inert; native Remove/Undo restores exact policy');
    await page.locator('[data-right-tab="project"]').click(); await page.locator('#project-name-input').fill(runId); await page.locator('#save-btn').click();
    const saved = await page.evaluate(() => JSON.stringify(serializeProject().levels[0].objects)); await page.reload(); await page.waitForFunction(() => typeof serializeProject === 'function');
    if (await page.locator('#first-run-skip').isVisible()) await page.locator('#first-run-skip').click();
    if (!await page.locator('[data-right-tab="project"]').isVisible()) await page.locator('#chrome-toggle-btn').click();
    await page.locator('[data-right-tab="project"]').click(); await page.locator('#project-list-select').selectOption(runId); await page.locator('#load-btn').click();
    assert.equal(await page.evaluate(() => JSON.stringify(serializeProject().levels[0].objects)), saved); record('Native project Save/reopen preserves exact authored objects, not runtime open state');
    for (const [tier, button] of [['Editable', '#export-standalone-btn'], ['Playable', '#export-playable-btn']]) {
      await page.locator('[data-right-tab="project"]').click(); const [download] = await Promise.all([page.waitForEvent('download'), page.locator(button).click()]);
      const output = path.join(dir, tier + '.html'); await download.saveAs(output);
      const exported = await context.newPage(); await exported.goto(origin + '/' + path.relative(root, output).replace(/\\/g, '/')); await exported.waitForFunction(() => typeof serializeProject === 'function');
      if (tier === 'Editable') { if (!await exported.locator('#play-btn').isVisible()) await exported.locator('#chrome-toggle-btn').click(); await exported.locator('#play-btn').click(); }
      else if (await exported.locator('#start-overlay-btn').isVisible()) await exported.locator('#start-overlay-btn').click();
      await driveLegacyDoor(exported, tier); await exported.close();
    }
    assert.deepStrictEqual(proof.pageErrors, []); assert.deepStrictEqual(proof.consoleErrors, []); assert.deepStrictEqual(proof.externalRequests, []);
    proof.status = 'NATIVE_DOOR_CUBE_COLLISION_HISTORY_SAVE_EXPORT_PASS';
  } catch (error) { proof.status = 'OBSERVED_FAILURE_OR_AUTOMATION'; proof.failure = error.stack; proof.failureObservation = await observe(page).catch(() => null); await page?.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {}); process.exitCode = 1; }
  finally { proof.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify({ runId, status: proof.status, steps: proof.steps.length, failure: proof.failure, observation: proof.failureObservation, pageErrors: proof.pageErrors, consoleErrors: proof.consoleErrors, externalRequests: proof.externalRequests })); await browser?.close(); server.close(); }
})();
