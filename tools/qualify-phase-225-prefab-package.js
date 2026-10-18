'use strict';
// Private browser only. Author and transfer through mounted UI; evaluate observes
// canonical state, with isolated stale-owner/Play adversaries explicitly labelled.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const crossProjectCollections = process.argv.includes('--collections');
const root = path.resolve(__dirname, '..'), runId = (crossProjectCollections ? 'multi-project-library-' : 'prefab-package-') + new Date().toISOString().replace(/[-:.]/g, '');
const dir = path.join(root, crossProjectCollections ? 'qualification/phase-230' : 'qualification/phase-225', runId); fs.mkdirSync(dir, { recursive: true });
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), errors: [], external: [], observations: [] };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(error ? 'Not found' : bytes); });
});
(async () => {
  let browser, p;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    p = await browser.newPage({ viewport: { width: 1280, height: 960 } }); p.setDefaultTimeout(12000);
    p.on('pageerror', error => proof.errors.push(error.stack));
    p.on('request', request => { if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(request.url())) proof.external.push(request.url()); });
    p.on('dialog', dialog => dialog.accept());
    const snap = () => p.evaluate(() => JSON.parse(JSON.stringify({ project: captureAssetReplacementState().project, undo: undoStack.length, redo: redoStack.length, storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])) })));
    await p.goto('http://127.0.0.1:' + server.address().port + '/editor/index.html');
    await p.waitForFunction(() => typeof captureAssetReplacementState === 'function');
    if (await p.locator('#first-run-skip').isVisible()) await p.locator('#first-run-skip').click();
    const project = require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project;
    project.meta.title = 'Private225 source';
    if (crossProjectCollections) {
      const island = project.levels[0].objects.find(item => item.id === 'obj3');
      island.components = { ...island.components, 'scene-collection': { version: 1, name: 'obj3', extension: { literal: 'obj3' } } };
    }
    // The qualified pack media boundary is PNG, not the starter's SVG data URI.
    // Private fixture retains the exact Sprite/dependency identities and authoring
    // shape; only source Texture bytes become an actual supported encoded PNG.
    const png = await p.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#3aaf9f'; ctx.fillRect(0, 0, 32, 32); return canvas.toDataURL('image/png'); });
    for (const texture of project.textures || []) texture.dataURL = png;
    const file = path.join(dir, 'source.json'); fs.writeFileSync(file, JSON.stringify(project));
    await p.locator('#import-project-input').setInputFiles(file); await p.waitForFunction(() => projectMeta.title === 'Private225 source');
    await p.locator('[data-left-tab="prefabs"]').click(); assert.equal(await p.locator('[data-export-prefab-package]').count(), 0);
    const emptyBefore = await snap(); const [emptyChooser] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-import-prefab-package]').click()]);
    await emptyChooser.setFiles([]); assert.deepStrictEqual(await snap(), emptyBefore);
    proof.observations.push('Empty Prefab library exposes a native Import file chooser; cancelling it preserves complete project/history/storage.');
    await p.locator('[data-right-tab="scene"]').click();
    const index = await p.evaluate(() => placed.findIndex(item => item.name === 'Start island'));
    await p.locator('.scene-list-item[data-index="' + index + '"]').click(); await p.locator('[data-right-tab="inspector"]').click();
    await p.locator('#sprite-prefab-name').fill('Reusable island ✓'); await p.locator('#sprite-save-prefab').click();
    await p.waitForFunction(() => prefabs.some(prefab => prefab.name === 'Reusable island ✓'));
    await p.locator('[data-left-tab="prefabs"]').click();
    const packageButton = p.locator('[data-export-prefab-package]').last(); await packageButton.scrollIntoViewIfNeeded();
    const before = await snap(); await packageButton.click();
    await p.waitForFunction(() => document.getElementById('tilemap-bundle-modal').style.display !== 'none' || statusEl.textContent.startsWith('Asset pack export blocked:'));
    assert(await p.locator('#tilemap-bundle-confirm').isVisible(), await p.locator('#status-msg').textContent());
    assert.equal(await p.evaluate(() => paletteDragState), null, 'Package button cannot begin a placement drag');
    assert.deepStrictEqual(await snap(), before); await p.locator('#tilemap-bundle-cancel').click(); assert.deepStrictEqual(await snap(), before);
    await p.screenshot({ path: path.join(dir, 'Prefab-palette.png') });
    await p.setViewportSize({ width: 920, height: 780 }); await packageButton.scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(dir, 'Prefab-palette-narrow.png') }); await p.setViewportSize({ width: 1280, height: 960 });
    await packageButton.click(); const [download] = await Promise.all([p.waitForEvent('download'), p.locator('#tilemap-bundle-confirm').click()]);
    const packFile = path.join(dir, 'island.opus-assets.json'); await download.saveAs(packFile);
    const verified = await require('../editor/src/00-tilemap-bundle').verifyAssetPackText(fs.readFileSync(packFile, 'utf8'));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(verified.pack.content.selections)), [{ collection: 'prefabs', id: 'Reusable island ✓' }]);
    assert.deepStrictEqual(await snap(), before);
    proof.observations.push('Native Sprite→Save as Prefab→palette Package: Cancel and actual download preserve complete authored project/history/storage, no accidental placement; verified canonical exact single-Prefab root with transitive dependencies.');
    // Ordinary import into a second project with the same Prefab/asset identities
    // deliberately exercises keep-both. Never use a human browser profile.
    const target = await p.evaluate(() => JSON.parse(JSON.stringify(serializeProject()))); target.meta.title = 'Private225 target';
    const targetFile = path.join(dir, 'target.json'); fs.writeFileSync(targetFile, JSON.stringify(target));
    await packageButton.click(); await p.locator('#tilemap-bundle-confirm').waitFor({ state: 'visible' });
    await p.locator('#import-project-input').setInputFiles(targetFile); await p.waitForFunction(() => projectMeta.title === 'Private225 target');
    const exportStale = await snap(); await p.locator('#tilemap-bundle-confirm').click();
    assert.match(await p.locator('#status-msg').textContent(), /stale|retired|changed|superseded/); assert.deepStrictEqual(await snap(), exportStale);
    proof.observations.push('Native Package preview then canonical project replacement retires captured Prefab owner; stale Confirm refuses without target/history/storage mutation.');
    await p.locator('[data-left-tab="prefabs"]').click(); const retained = await snap();
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-import-prefab-package]').click()]); await chooser.setFiles(packFile);
    await p.waitForFunction(() => document.getElementById('tilemap-bundle-modal').style.display !== 'none' || statusEl.textContent.startsWith('Asset pack import rejected:'));
    assert(await p.locator('#tilemap-bundle-confirm').isVisible(), await p.locator('#status-msg').textContent());
    await p.locator('#tilemap-bundle-cancel').click(); assert.deepStrictEqual(await snap(), retained);
    await p.locator('#import-asset-pack-input').setInputFiles(packFile); await p.locator('#tilemap-bundle-confirm').waitFor({ state: 'visible' });
    await p.locator('#import-project-input').setInputFiles(targetFile); await p.waitForFunction(() => projectMeta.title === 'Private225 target');
    const importStale = await snap(); await p.locator('#tilemap-bundle-confirm').click();
    assert.match(await p.locator('#status-msg').textContent(), /stale|retired|changed|superseded/); assert.deepStrictEqual(await snap(), importStale);
    proof.observations.push('Native package import preview then canonical project replacement refuses stale Confirm without target/history/storage mutation.');
    const beforePlay = await snap(); await p.locator('#play-btn').click(); await p.waitForFunction(() => playMode);
    // Source keeps editor chrome visible in Play. Exercise real mounted controls.
    await p.locator('[data-export-prefab-package]').first().click(); assert.match(await p.locator('#status-msg').textContent(), /Stop Play/);
    assert(await p.locator('#tilemap-bundle-modal').isHidden());
    await p.locator('[data-import-prefab-package]').click(); assert.match(await p.locator('#status-msg').textContent(), /Stop Play/);
    await p.locator('#import-asset-pack-input').setInputFiles(packFile); await p.waitForFunction(() => statusEl.textContent.startsWith('Asset pack import rejected: Stop Play'));
    await p.keyboard.press('Escape'); await p.locator('#play-btn').click(); await p.waitForFunction(() => !playMode);
    assert.deepStrictEqual(await snap(), beforePlay);
    proof.observations.push('Native source Play Package/Import controls and direct file-input path refuse; Stop restores exact authored project/history/storage.');
    const retainedAfterAdversaries = await snap();
    const [secondChooser] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-import-prefab-package]').click()]); await secondChooser.setFiles(packFile); await p.locator('#tilemap-bundle-confirm').click();
    await p.waitForFunction(() => prefabs.some(prefab => prefab.name === 'Reusable island ✓-2'));
    const imported = await snap(); assert.equal(imported.undo, retainedAfterAdversaries.undo + 1); assert.deepStrictEqual(imported.project.levels, retainedAfterAdversaries.project.levels);
    assert.deepStrictEqual(imported.project.prefabs.slice(0, retainedAfterAdversaries.project.prefabs.length), retainedAfterAdversaries.project.prefabs);
    await p.locator('#undo-btn').click(); assert.deepStrictEqual((await snap()).project, retainedAfterAdversaries.project);
    await p.locator('#redo-btn').click(); assert.deepStrictEqual((await snap()).project, imported.project);
    proof.observations.push('Native palette Import file chooser/Cancel exact; second-project conflicting package Confirm preserves original Prefab/scenes, adds one Undo, whole UndoRedo exact.');
    const importedName = 'Reusable island ✓-2', originalIsland = imported.project.levels[0].objects.find(item => item.id === 'obj3');
    const priorIds = await p.evaluate(() => placed.map(item => item.id));
    const importedIndex = await p.evaluate(name => prefabs.findIndex(prefab => prefab.name === name), importedName);
    const label = p.locator('#palette-prefab-' + importedIndex + ' > span'); await label.scrollIntoViewIfNeeded();
    const box = await label.boundingBox(), view = await p.locator('#game').boundingBox();
    await p.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await p.mouse.down();
    await p.mouse.move(view.x + view.width * .75, view.y + view.height * .65, { steps: 16 }); await p.mouse.up();
    await p.waitForFunction(ids => placed.some(item => !ids.includes(item.id)), priorIds);
    const placedCopy = await snap(); assert.equal(placedCopy.undo, imported.undo + 1);
    const copyId = await p.evaluate(ids => placed.find(item => !ids.includes(item.id)).id, priorIds);
    if (crossProjectCollections) {
      assert.deepStrictEqual(await p.evaluate(id => JSON.parse(JSON.stringify(placed.find(item => item.id === id).components['scene-collection'])), copyId), { version: 1, name: 'obj3', extension: { literal: 'obj3' } });
      proof.observations.push('Phase230 distinct-project conflict/keep-both package import and independent placement preserve Scene collection ID-shaped labels and extension bytes; no new shared runtime/library owner.');
    }
    await p.locator('#undo-btn').click(); assert.deepStrictEqual((await snap()).project, imported.project);
    await p.locator('#redo-btn').click(); assert.deepStrictEqual((await snap()).project, placedCopy.project);
    await p.locator('[data-right-tab="scene"]').click(); const copyIndex = await p.evaluate(id => placed.findIndex(item => item.id === id), copyId);
    await p.locator('.scene-list-item[data-index="' + copyIndex + '"]').click(); await p.locator('[data-right-tab="inspector"]').click();
    await p.locator('[data-sprite-transform="px"]').fill('24'); await p.locator('[data-sprite-transform="px"]').press('Tab');
    const edited = await snap(); assert.equal(edited.undo, placedCopy.undo + 1);
    assert.deepStrictEqual(edited.project.levels[0].objects.find(item => item.id === 'obj3'), originalIsland);
    await p.locator('#undo-btn').click(); assert.deepStrictEqual((await snap()).project, placedCopy.project);
    await p.locator('#redo-btn').click(); assert.deepStrictEqual((await snap()).project, edited.project);
    const portableEdited = await p.evaluate(() => JSON.parse(JSON.stringify(serializeProject())));
    const saveName = 'Package persistence ' + runId;
    await p.locator('[data-right-tab="project"]').click(); if (!await p.locator('#project-name-input').isVisible()) await p.locator('[data-section="save"]').click();
    await p.locator('#project-name-input').fill(saveName); await p.locator('#save-btn').click();
    const editMode = async q => { if (!await q.locator('#play-btn').isVisible()) await q.locator('#chrome-toggle-btn').click(); if (await q.evaluate(() => playMode)) { await q.keyboard.press('Escape'); await q.locator('#play-btn').click(); await q.waitForFunction(() => !playMode); } };
    await p.reload(); await p.waitForFunction(() => typeof captureAssetReplacementState === 'function'); await editMode(p);
    await p.locator('#project-home-btn').click(); await p.locator('#project-home-search').fill(saveName); await p.getByRole('button', { name: 'Open ' + saveName, exact: true }).click();
    assert.deepStrictEqual(await p.evaluate(() => JSON.parse(JSON.stringify(serializeProject()))), portableEdited);
    // Script trust is transient session state, not a field in portable projects.
    // Keep exact diagnostic UndoRedo above; compare canonical portable data across
    // document reload rather than assuming the imported-session trust bit persists.
    proof.observations.push('Transferred Prefab native independent placement/edit24 each adds one Undo with exact whole-project UndoRedo; original island retained; complete library/dependency/scene content survives ordinary Save/browserreload/Home Open.');
    const downloadExport = async (q, selector, name) => {
      await q.locator('[data-right-tab="project"]').click(); if (!await q.locator(selector).isVisible()) await q.locator('[data-section="importexport"]').click();
      const pending = q.waitForEvent('download'); await require('./native-export-review')(q, selector);
      const output = path.join(dir, name + '.html'); await (await pending).saveAs(output); assert(fs.statSync(output).size > 100000); return output;
    };
    const editableFile = await downloadExport(p, '#export-standalone-btn', 'Editable');
    const playableFile = await downloadExport(p, '#export-playable-btn', 'Playable');
    if (process.argv.includes('--exports')) {
      const outputs = [{ tier: 'Editable', file: editableFile }, { tier: 'Playable', file: playableFile }];
      for (const output of outputs) {
        const q = await browser.newPage({ viewport: { width: 1280, height: 960 } });
        q.on('pageerror', error => proof.errors.push(error.stack)); q.on('dialog', dialog => dialog.accept());
        q.on('request', request => { if (!/^(file:|data:|blob:)/.test(request.url())) proof.external.push(request.url()); });
        try {
          await q.goto(require('url').pathToFileURL(output.file).href); await q.waitForFunction(() => typeof captureAssetReplacementState === 'function');
          if (output.tier === 'Editable') {
            await editMode(q); assert.deepStrictEqual(await q.evaluate(() => JSON.parse(JSON.stringify(serializeProject()))), portableEdited);
            await q.locator('[data-right-tab="ui"]').click(); if (!await q.locator('#hud-element-list').isVisible()) await q.locator('[data-section="hud"]').click();
            const field = q.locator('#hud-element-list [data-hud-id="platformer-guide"] [data-hud-field="offsetX"]');
            const before = await q.evaluate(() => JSON.parse(JSON.stringify(captureAssetReplacementState().project))); await field.fill('29'); await field.press('Tab');
            const after = await q.evaluate(() => JSON.parse(JSON.stringify(captureAssetReplacementState().project)));
            await q.locator('#undo-btn').click(); assert.deepStrictEqual(await q.evaluate(() => JSON.parse(JSON.stringify(captureAssetReplacementState().project))), before);
            await q.locator('#redo-btn').click(); assert.deepStrictEqual(await q.evaluate(() => JSON.parse(JSON.stringify(captureAssetReplacementState().project))), after);
            const reexport = await downloadExport(q, '#export-playable-btn', 'ReviewedPlayable'); outputs.push({ tier: 'Re-exported Playable', file: reexport });
            proof.observations.push('Actual file Editable retains full transferred/independently edited Prefab project, supports native HUD29 authoring/whole UndoRedo and produces an actual retained-composer Playable re-export.');
          } else {
            await q.waitForFunction(() => playMode);
            const ids = await q.evaluate(() => serializeProject().levels[0].objects.map(item => item.id)); assert(ids.includes(copyId));
            assert(await q.locator('[data-import-prefab-package]').isHidden(), 'Playable hides editor package authoring');
            await q.waitForFunction(() => playMode && !app.paused && body2DManager.getCharacterCollision2DState('obj2')?.grounded);
            assert.equal(await q.evaluate(id => placed.find(item => item.id === id).sourcePrefabName, copyId), importedName);
            await q.locator('#game').click(); const start = await q.evaluate(() => ({ time: simElapsed, x: placed.find(item => item.id === 'obj2').entity.position.x }));
            await q.keyboard.down('KeyD'); try { await q.waitForFunction(time => simElapsed >= time, start.time + .25); } finally { await q.keyboard.up('KeyD'); }
            const actual = await q.evaluate(() => { const position = placed.find(item => item.id === 'obj2').entity.position; return { x: position.x, y: position.y }; });
            assert(actual.x > start.x + .3 && actual.y > -2, 'Actual native platformer movement/support');
            await q.screenshot({ path: path.join(dir, output.tier + '-native-movement.png') });
            proof.observations.push({ tier: output.tier, label: 'Actual offline Play retains independent transferred copy; native D movement/support with editor package authoring hidden.', start, actual });
          }
        } finally { await q.close(); }
      }
    }
    await p.screenshot({ path: path.join(dir, 'Prefab-package.png') });
    assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []);
    proof.status = 'NATIVE_PREFAB_PACKAGE_DISCOVERY_TRANSFER_HISTORY_PASS_NOT_PHASE_QUALIFIED';
  } catch (error) { proof.status = 'FAIL'; proof.failure = error.stack; if (p) { proof.feedback = await p.locator('#status-msg').textContent().catch(() => null); await p.screenshot({ path: path.join(dir, 'Failure.png') }).catch(() => {}); } process.exitCode = 1; }
  finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); proof.endedAt = new Date().toISOString(); proof.resourcesClosed = true; fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof)); }
})();
