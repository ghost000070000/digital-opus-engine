'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), runId = 'scene-collections-' + new Date().toISOString().replace(/[-:.]/g, ''), dir = path.join(root, 'qualification/phase-229', runId); fs.mkdirSync(dir, { recursive: true });
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), errors: [], external: [] };
const server = http.createServer((req, res) => { const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); } fs.readFile(file, (e, b) => { res.writeHead(e ? 404 : 200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(e ? 'Not found' : b); }); });
(async () => { let browser; try {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); browser = await chromium.launch({ channel: 'msedge', headless: true }); const p = await browser.newPage({ viewport: { width: 1280, height: 960 } }); p.setDefaultTimeout(10000); p.on('pageerror', e => proof.errors.push(e.stack)); p.on('dialog', d => d.accept()); p.on('request', r => { if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(r.url())) proof.external.push(r.url()); });
  await p.goto('http://127.0.0.1:' + server.address().port + '/editor/index.html'); await p.waitForFunction(() => typeof serializeProject === 'function'); if (await p.locator('#first-run-skip').isVisible()) await p.locator('#first-run-skip').click();
  const project = require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project; project.meta.title = 'Private229 large authoring scene'; const seed = project.levels[0].objects.find(o => o.id === 'obj3');
  for (let i = 0; i < 512; i++) project.levels[0].objects.push({ ...JSON.parse(JSON.stringify(seed)), id: 'obj' + (1000 + i), name: (i === 17 ? 'Lantern' : i === 211 ? 'Bridge' : i === 400 ? 'Fern' : 'Prop') + ' ' + i, position: [(i % 32) * 3, Math.floor(i / 32) * 3, 0], behaviors: [] });
  const file = path.join(dir, 'private-large-scene.json'); fs.writeFileSync(file, JSON.stringify(project)); await p.locator('#import-project-input').setInputFiles(file); await p.waitForFunction(() => projectMeta.title === 'Private229 large authoring scene'); await p.locator('[data-right-tab="scene"]').click();
  proof.baseline = { authoredObjects: await p.evaluate(() => placed.length), visibleRows: await p.locator('.scene-list-item').count(), collectionControlPresent: await p.locator('#scene-collection-filter').count() };
  assert(proof.baseline.authoredObjects >= 520); assert.equal(proof.baseline.visibleRows, proof.baseline.authoredObjects);
  const snap = () => p.evaluate(() => JSON.stringify(serializeProject()));
  for (const [i, name] of ['Lantern 17', 'Bridge 211', 'Fern 400'].entries()) { await p.locator('[data-right-tab="scene"]').click(); await p.locator('#scene-search').fill(name); assert.equal(await p.locator('.scene-list-item').count(), 1); await p.locator('.scene-list-item').click({ modifiers: i ? ['Shift'] : [] }); }
  assert.equal(await p.evaluate(() => selectedItems.size), 3);
  assert.equal(proof.baseline.collectionControlPresent, 1, 'No persistent collection UI for unrelated non-grouped Objects');
  await p.locator('[data-right-tab="scene"]').click(); await p.locator('#scene-collections > summary').click();
  await p.locator('#scene-collection-name').fill('Roadside'); const before = await snap(), count = await p.evaluate(() => undoStack.length); await p.locator('#scene-collection-assign').click(); const assigned = await snap();
  assert.equal(await p.evaluate(() => undoStack.length), count + 1); assert.equal(await p.locator('.scene-list-item').count(), 3); assert.equal(await p.evaluate(() => placed.filter(o => o.components?.['scene-collection']?.name === 'Roadside').length), 3);
  await p.locator('#undo-btn').click(); assert.equal(await snap(), before); await p.locator('#redo-btn').click(); assert.equal(await snap(), assigned);
  await p.locator('#scene-collection-filter').selectOption('name:Roadside'); await p.locator('#scene-collection-select').click(); assert.equal(await p.evaluate(() => selectedItems.size), 3);
  await p.locator('#scene-collection-name').fill('Landmarks'); await p.locator('#scene-collection-rename').click(); assert.equal(await p.evaluate(() => placed.filter(o => o.components?.['scene-collection']?.name === 'Landmarks').length), 3);
  await p.screenshot({ path: path.join(dir, 'Large-scene-collection.png') });
  // ID-shaped collection labels remain text through canonical Prefab remapping.
  await p.locator('#scene-collection-name').fill('obj1017'); await p.locator('#scene-collection-rename').click();
  await p.locator('#scene-search').fill('Lantern 17'); await p.locator('.scene-list-item').click();
  await p.locator('#sprite-prefab-name').fill('Collection Lantern'); await p.locator('#sprite-save-prefab').click();
  await p.locator('[data-left-tab="prefabs"]').click();
  const priorIds = await p.evaluate(() => placed.map(o => o.id)), beforePrefab = await snap();
  const index = await p.evaluate(() => prefabs.findIndex(o => o.name === 'Collection Lantern'));
  const label = p.locator('#palette-prefab-' + index + ' > span'); await label.scrollIntoViewIfNeeded();
  const box = await label.boundingBox(), canvas = await p.locator('#game').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
  await p.mouse.move(canvas.x + canvas.width * .7, canvas.y + canvas.height * .65, { steps: 12 }); await p.mouse.up();
  await p.waitForFunction(ids => placed.some(o => !ids.includes(o.id)), priorIds);
  const copyId = await p.evaluate(ids => placed.find(o => !ids.includes(o.id)).id, priorIds);
  assert.equal(await p.evaluate(id => placed.find(o => o.id === id).components['scene-collection'].name, copyId), 'obj1017');
  const afterPrefab = await snap(); await p.locator('#undo-btn').click(); assert.equal(await snap(), beforePrefab); await p.locator('#redo-btn').click(); assert.equal(await snap(), afterPrefab);
  const editMode = async q => { if (!await q.locator('#play-btn').isVisible()) await q.locator('#chrome-toggle-btn').click(); if (await q.evaluate(() => playMode)) { await q.keyboard.press('Escape'); await q.locator('#play-btn').click(); await q.waitForFunction(() => !playMode); } };
  const saveName = 'Collections ' + runId;
  await p.locator('[data-right-tab="project"]').click(); if (!await p.locator('#project-name-input').isVisible()) await p.locator('[data-section="save"]').click();
  await p.locator('#project-name-input').fill(saveName); const portable = await snap(); await p.locator('#save-btn').click();
  await p.reload(); await p.waitForFunction(() => typeof serializeProject === 'function'); await editMode(p);
  await p.locator('#project-home-btn').click(); await p.locator('#project-home-search').fill(saveName); await p.getByRole('button', { name: 'Open ' + saveName, exact: true }).click();
  assert.equal(await snap(), portable);
  const exportFile = async (q, selector, name) => { await q.locator('[data-right-tab="project"]').click(); if (!await q.locator(selector).isVisible()) await q.locator('[data-section="importexport"]').click(); const pending = q.waitForEvent('download'); await require('./native-export-review')(q, selector); const file = path.join(dir, name + '.html'); await (await pending).saveAs(file); return file; };
  const outputs = [{ name: 'Editable', file: await exportFile(p, '#export-standalone-btn', 'Editable') }, { name: 'Playable', file: await exportFile(p, '#export-playable-btn', 'Playable') }];
  proof.exports = [];
  for (const output of outputs) {
    const q = await browser.newPage({ viewport: { width: 1280, height: 960 } }); q.on('pageerror', e => proof.errors.push(e.stack)); q.on('dialog', d => d.accept()); q.on('request', r => { if (!/^(file:|data:|blob:)/.test(r.url())) proof.external.push(r.url()); });
    try {
      await q.goto(require('url').pathToFileURL(output.file).href); await q.waitForFunction(() => typeof serializeProject === 'function');
      assert.deepStrictEqual(await q.evaluate(() => JSON.parse(JSON.stringify(serializeProject()))), JSON.parse(portable));
      if (output.name === 'Editable') {
        await editMode(q); await q.locator('[data-right-tab="scene"]').click(); await q.locator('#scene-collections > summary').click(); await q.locator('#scene-collection-filter').selectOption('name:obj1017'); assert.equal(await q.locator('.scene-list-item').count(), 4);
        outputs.push({ name: 'ReexportPlayable', file: await exportFile(q, '#export-playable-btn', 'ReexportPlayable') });
      } else {
        await q.waitForFunction(() => playMode && !app.paused && body2DManager.getCharacterCollision2DState('obj2')?.grounded);
        await q.locator('#game').click(); const start = await q.evaluate(() => ({ time: simElapsed, x: placed.find(o => o.id === 'obj2').entity.position.x }));
        await q.keyboard.down('KeyD'); try { await q.waitForFunction(t => simElapsed >= t, start.time + .25); } finally { await q.keyboard.up('KeyD'); }
        assert(await q.evaluate(x => placed.find(o => o.id === 'obj2').entity.position.x > x + .3, start.x));
      }
      proof.exports.push(output.name + ': full portable project retained; ' + (output.name === 'Editable' ? 'collection filtering4 and reexport PASS' : 'native D movement/ground support PASS'));
    } finally { await q.close(); }
  }
  await p.locator('[data-right-tab="scene"]').click(); await p.locator('#scene-collections > summary').click(); await p.locator('#scene-collection-filter').selectOption('name:obj1017'); await p.locator('#scene-collection-select').click();
  const beforeFilter = await snap(); await p.locator('#scene-collection-filter').selectOption('__none'); assert.equal(await snap(), beforeFilter); assert.equal(await p.locator('.scene-list-item').count(), 517);
  await p.locator('[data-right-tab="level"]').click(); await p.locator('#duplicate-level-btn').click(); await p.waitForFunction(() => levels.length === 2);
  assert.equal(await p.evaluate(() => placed.filter(o => o.components?.['scene-collection']?.name === 'obj1017').length), 4);
  await p.locator('[data-right-tab="scene"]').click(); await p.locator('#scene-collection-filter').selectOption('name:obj1017');
  await p.locator('#scene-collection-name').fill('Copy Level only'); const beforeRename = await snap(); await p.locator('#scene-collection-rename').click(); const afterRename = await snap();
  assert.equal(await p.evaluate(() => serializeProject().levels[0].objects.filter(o => o.components?.['scene-collection']?.name === 'obj1017').length), 4);
  assert.equal(await p.evaluate(() => placed.filter(o => o.components?.['scene-collection']?.name === 'Copy Level only').length), 4);
  await p.locator('#undo-btn').click(); assert.equal(await snap(), beforeRename); await p.locator('#redo-btn').click(); assert.equal(await snap(), afterRename);
  proof.levelBoundary = 'Canonical Duplicate Level preserves ID-shaped text on4 independent memberships; rename affects only active Level, full project UndoRedo PASS; filter is authored-data read-only';
  proof.result = { total: await p.evaluate(() => placed.length), collectionRows: await p.locator('.scene-list-item').count(), selected: await p.evaluate(() => selectedItems.size) };
  assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []); proof.status = 'NATIVE_LARGE_SCENE_COLLECTION_AUTHORING_PREFAB_LITERAL_HISTORY_SAVELOAD_ALL_FILE_EXPORTS_PASS_NOT_PHASE_QUALIFIED';
} catch (e) { proof.status = 'FAIL'; proof.failure = e.stack; process.exitCode = 1; } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); proof.resourcesClosed = true; proof.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof)); } })();
