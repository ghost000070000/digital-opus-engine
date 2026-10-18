'use strict';
// Private fixture; the only Custom Script effect is an ephemeral window counter.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), runId = 'script-trust-' + new Date().toISOString().replace(/[-:.]/g, ''), dir = path.join(root, process.argv.includes('--beta-revision-1')?'qualification/beta-revision-1':'qualification/phase-226', runId);
fs.mkdirSync(dir, { recursive: true });
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), errors: [], external: [] };
const server = http.createServer((req, res) => { const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); } fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(error ? 'Not found' : bytes); }); });
(async () => {
  let browser, p, accept = true, dialogCount = 0;
  try {
    const project = require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project;
    project.meta.title = 'Private226 benign script trust';
    project.levels[0].objects.find(item => item.id === 'obj3').behaviors = [{ trigger: 'start', action: 'script', params: { code: 'window.__phase226BenignCounter = (window.__phase226BenignCounter || 0) + 1;' } }];
    if (process.argv.includes('--owners')) {
      const current = project.levels[0];
      current.objects.find(item => item.id === 'obj3').behaviors = [{ trigger: 'start', action: 'graph', graph: { graphVersion: 1, nodes: [{ id: 'trust-graph-script', type: 'script', code: 'window.__phase226Graph = (window.__phase226Graph || 0) + 1;' }], edges: [{ from: 'start', to: 'trust-graph-script', kind: 'next' }] } }];
      current.objects.find(item => item.id === 'obj4').behaviors = [{ trigger: 'start', action: 'playSequence', params: { sequenceId: 'trust-sequence' } }];
      current.sequences = [{ id: 'trust-sequence', name: 'Trust action owner', steps: [{ kind: 'action', actionType: 'script', params: { code: 'window.__phase226Sequence = (window.__phase226Sequence || 0) + 1;' } }] }];
      const other = JSON.parse(JSON.stringify(current)); other.id = 'trust-other-level'; other.name = 'Other script level'; other.sequences = [];
      for (const item of other.objects) item.behaviors = [];
      other.objects.find(item => item.id === 'obj3').behaviors = [{ trigger: 'start', action: 'script', params: { code: 'window.__phase226OtherLevel = (window.__phase226OtherLevel || 0) + 1;' } }];
      project.levels.push(other);
    }
    const file = path.join(dir, 'private-script.json'); fs.writeFileSync(file, JSON.stringify(project));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); browser = await chromium.launch({ channel: 'msedge', headless: true });
    p = await browser.newPage({ viewport: { width: 1280, height: 960 } }); p.setDefaultTimeout(12000); p.on('dialog', async dialog => { dialogCount++; await (accept ? dialog.accept() : dialog.dismiss()); });
    p.on('pageerror', error => proof.errors.push(error.stack)); p.on('request', request => { if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(request.url())) proof.external.push(request.url()); });
    await p.goto('http://127.0.0.1:' + server.address().port + '/editor/index.html'); await p.waitForFunction(() => typeof captureAssetReplacementState === 'function');
    if (await p.locator('#first-run-skip').isVisible()) await p.locator('#first-run-skip').click();
    await p.locator('#import-project-input').setInputFiles(file); await p.locator('[data-backup-replace]').click(); await p.waitForFunction(() => projectMeta.title === 'Private226 benign script trust');
    proof.loaded = await p.evaluate(() => ({ trusted: scriptsTrusted, detected: projectHasScripts(levels[currentLevelIndex].objects), banner: document.getElementById('script-trust-banner').classList.contains('visible'), counter: window.__phase226BenignCounter || 0 }));
    if (process.argv.includes('--owners')) {
      const counts = () => p.evaluate(() => ({ graph: window.__phase226Graph || 0, sequence: window.__phase226Sequence || 0, other: window.__phase226OtherLevel || 0 }));
      const play = async () => { await p.locator('#play-btn').click(); await p.waitForFunction(() => playMode && simElapsed > .05); };
      const stop = async () => { await p.keyboard.press('Escape'); await p.locator('#play-btn').click(); await p.waitForFunction(() => !playMode); };
      await play(); assert.deepStrictEqual(await counts(), { graph: 0, sequence: 0, other: 0 }); await stop();
      const option = async name => p.evaluate(name => Array.from(document.getElementById('level-select').options).find(option => option.textContent.includes(name))?.value, name);
      const startHere = async () => { await p.locator('[data-right-tab="level"]').click(); await p.locator('#set-start-level-btn').click(); };
      await p.locator('#level-select').selectOption(await option('Other script level')); await startHere(); await play(); assert.deepStrictEqual(await counts(), { graph: 0, sequence: 0, other: 0 }); await stop();
      await p.locator('#script-trust-enable-btn').click(); await p.locator('#script-trust-agree').check(); await p.locator('#script-trust-confirm').click();
      await play(); assert.deepStrictEqual(await counts(), { graph: 0, sequence: 0, other: 1 }); await stop();
      await p.locator('#level-select').selectOption(await option(project.levels[0].name)); await startHere(); await play(); assert.deepStrictEqual(await counts(), { graph: 1, sequence: 1, other: 1 }); await stop();
      await p.locator('#script-trust-revoke-btn').click(); await play(); assert.deepStrictEqual(await counts(), { graph: 1, sequence: 1, other: 1 }); await stop();
      proof.owners = await counts(); proof.status = 'NATIVE_GRAPH_SEQUENCE_AND_OTHER_LEVEL_SHARED_SCRIPT_OWNER_DEFAULT_DENY_APPROVE_REVOKE_PASS_NOT_PHASE_QUALIFIED';
      assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []); return;
    }
    if (process.argv.includes('--boundary-red') || process.argv.includes('--boundary')) {
      await p.locator('[data-right-tab="scene"]').click(); const index = await p.evaluate(() => placed.findIndex(item => item.id === 'obj3')); await p.locator('.scene-list-item[data-index="' + index + '"]').click(); await p.locator('[data-right-tab="inspector"]').click();
      await p.locator('#sprite-prefab-name').fill('Retained script from other document'); await p.locator('#sprite-save-prefab').click();
      await p.locator('#script-trust-enable-btn').click(); await p.locator('#script-trust-agree').check(); await p.locator('#script-trust-confirm').click(); assert.equal(await p.evaluate(() => scriptsTrusted), true);
      const foreign = require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project; foreign.meta.title = 'Private226 foreign no-script document'; const foreignFile = path.join(dir, 'foreign.json'); fs.writeFileSync(foreignFile, JSON.stringify(foreign));
      await p.locator('#import-project-input').setInputFiles(foreignFile); await p.locator('[data-backup-replace]').click(); await p.waitForFunction(() => projectMeta.title === 'Private226 foreign no-script document');
      proof.foreign = await p.evaluate(() => ({ trusted: scriptsTrusted, retained: prefabs.some(prefab => prefab.name === 'Retained script from other document'), requiresTrust: projectHasScripts(serializeProject()) }));
      await p.locator('[data-left-tab="prefabs"]').click(); const prefabIndex = await p.evaluate(() => prefabs.findIndex(prefab => prefab.name === 'Retained script from other document')), label = p.locator('#palette-prefab-' + prefabIndex + ' > span'); await label.scrollIntoViewIfNeeded(); const box = await label.boundingBox(), view = await p.locator('#game').boundingBox(), oldIds = await p.evaluate(() => placed.map(item => item.id));
      await p.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await p.mouse.down(); await p.mouse.move(view.x + view.width * .7, view.y + view.height * .65, { steps: 16 }); await p.mouse.up(); await p.waitForFunction(ids => placed.some(item => !ids.includes(item.id)), oldIds);
      await p.locator('#play-btn').click(); await p.waitForFunction(() => playMode && simElapsed > .05); proof.foreignPlay = await p.evaluate(() => ({ trusted: scriptsTrusted, counter: window.__phase226BenignCounter || 0 }));
      const red = process.argv.includes('--boundary-red'); assert.equal(proof.foreign.trusted, red); assert.equal(proof.foreignPlay.counter, red ? 1 : 0);
      proof.status = red ? 'HISTORICAL_RED_APPROVAL_CARRIED_INTO_FOREIGN_NO_SCRIPT_DOCUMENT_RETAINED_PREFAB_EXECUTES' : 'NATIVE_FOREIGN_NO_SCRIPT_DOCUMENT_RETAINS_PREFAB_BUT_NOT_APPROVAL_PASS_NOT_PHASE_QUALIFIED';
      assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []); return;
    }
    if (process.argv.includes('--lifecycle')) {
      const snap = () => p.evaluate(() => JSON.parse(JSON.stringify({ project: serializeProject(), undo: undoStack.length, redo: redoStack.length, storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])) })));
      const before = await snap(); await p.locator('#script-trust-enable-btn').click();
      assert.match(await p.locator('#script-trust-dialog').innerText(), /not a security sandbox/);
      assert.match(await p.locator('#script-trust-code').textContent(), /__phase226BenignCounter/);
      assert(await p.locator('#script-trust-confirm').isDisabled()); await p.keyboard.press('Control+z'); assert.deepStrictEqual(await snap(), before);
      await p.screenshot({ path: path.join(dir, 'Read-only-permission-review.png') });
      await p.locator('#script-trust-close').click(); assert.deepStrictEqual(await snap(), before); assert.equal(await p.evaluate(() => scriptsTrusted), false);
      await p.locator('#script-trust-enable-btn').click(); await p.locator('#script-trust-agree').check(); accept = false; await p.locator('#script-trust-confirm').click();
      assert.equal(await p.evaluate(() => scriptsTrusted), false); assert.deepStrictEqual(await snap(), before);
      accept = true; await p.locator('#script-trust-confirm').click(); assert.equal(await p.evaluate(() => scriptsTrusted), true); assert.deepStrictEqual(await snap(), before);
      await p.locator('#play-btn').click(); await p.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await p.evaluate(() => window.__phase226BenignCounter), 1);
      await p.locator('#script-trust-revoke-btn').click(); assert.match(await p.locator('#status-msg').textContent(), /Stop Play/); assert.equal(await p.evaluate(() => scriptsTrusted), true);
      await p.keyboard.press('Escape'); await p.locator('#play-btn').click(); await p.waitForFunction(() => !playMode);
      const portableBeforePack = await p.evaluate(() => JSON.parse(JSON.stringify(serializeProject())));
      const pack = await require('../editor/src/00-tilemap-bundle').createAssetPack({ project: { sortingLayers: [{ id: 'trust-history-layer', name: 'Permission history probe', order: 2 }] }, selections: [{ collection: 'sortingLayers', id: 'trust-history-layer' }] });
      const packFile = path.join(dir, 'history.opus-assets.json'); fs.writeFileSync(packFile, pack.text);
      await p.locator('#import-asset-pack-input').setInputFiles(packFile); await p.locator('#tilemap-bundle-confirm').click();
      assert.equal(await p.evaluate(() => undoStack.at(-1).scriptsTrusted), true);
      await p.locator('#script-trust-revoke-btn').click(); assert.equal(await p.evaluate(() => scriptsTrusted), false);
      await p.locator('#undo-btn').click(); assert.equal(await p.evaluate(() => scriptsTrusted), false); assert.deepStrictEqual(await p.evaluate(() => JSON.parse(JSON.stringify(serializeProject()))), portableBeforePack);
      await p.locator('#redo-btn').click(); assert.equal(await p.evaluate(() => scriptsTrusted), false, 'Redo cannot restore revoked permission'); await p.locator('#undo-btn').click(); assert.equal(await p.evaluate(() => scriptsTrusted), false);
      await p.locator('#play-btn').click(); await p.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await p.evaluate(() => window.__phase226BenignCounter), 1, 'Revocation survives full-history Undo and blocks next Start');
      await p.keyboard.press('Escape'); await p.locator('#play-btn').click(); await p.waitForFunction(() => !playMode);
      await p.locator('#script-trust-enable-btn').click(); await p.locator('#script-trust-agree').check();
      const other = JSON.parse(JSON.stringify(project)); other.meta.title = 'Private226 replaced after review'; const otherFile = path.join(dir, 'replacement.json'); fs.writeFileSync(otherFile, JSON.stringify(other));
      await p.locator('#import-project-input').setInputFiles(otherFile); await p.locator('[data-backup-replace]').click(); await p.waitForFunction(() => projectMeta.title === 'Private226 replaced after review'); const replaced = await snap(), count = dialogCount;
      await p.locator('#script-trust-confirm').click(); assert.equal(dialogCount, count); assert.equal(await p.evaluate(() => scriptsTrusted), false); assert.deepStrictEqual(await snap(), replaced);
      assert.match(await p.locator('#script-trust-review-status').textContent(), /stale|changed|superseded/);
      proof.status = 'NATIVE_READ_ONLY_REVIEW_CANCEL_EXPLICIT_APPROVAL_PLAY_GUARD_REVOKE_UNDO_AND_STALE_DOCUMENT_REFUSAL_PASS_NOT_PHASE_QUALIFIED';
      proof.lifecycle = { readOnlyReview: true, cancelUnchanged: true, explicitApprovalExecutesOnlyOnPlay: true, playGuard: true, revokedUndoCannotApprove: true, staleDocumentCannotApprove: true };
      assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []); return;
    }
    if (process.argv.includes('--revoke-red')) {
      await p.locator('#script-trust-enable-btn').click();
      const pack = await require('../editor/src/00-tilemap-bundle').createAssetPack({ project: { sortingLayers: [{ id: 'trust-history-layer', name: 'Permission history probe', order: 2 }] }, selections: [{ collection: 'sortingLayers', id: 'trust-history-layer' }] });
      const packFile = path.join(dir, 'history.opus-assets.json'); fs.writeFileSync(packFile, pack.text);
      await p.locator('#import-asset-pack-input').setInputFiles(packFile); await p.locator('#tilemap-bundle-confirm').click();
      proof.beforeRevoke = await p.evaluate(() => ({ trusted: scriptsTrusted, undo: undoStack.length, tailTrust: undoStack.at(-1)?.scriptsTrusted }));
      // Isolated revocation-state adversary. Actual mounted Undo performs the
      // history restore; no permission is given to any external script/source.
      await p.evaluate(() => { scriptsTrusted = false; }); await p.locator('#undo-btn').click();
      proof.afterRevokeUndo = await p.evaluate(() => ({ trusted: scriptsTrusted }));
    }
    await p.locator('#play-btn').click(); await p.waitForFunction(() => playMode && simElapsed > .05);
    proof.play = await p.evaluate(() => ({ trusted: scriptsTrusted, counter: window.__phase226BenignCounter || 0 }));
    await p.screenshot({ path: path.join(dir, 'Imported-script-trust.png') });
    if (process.argv.includes('--revoke-red')) {
      assert.equal(proof.afterRevokeUndo.trusted, true); assert.equal(proof.play.counter, 1);
      proof.status = 'HISTORICAL_RED_NATIVE_UNDO_RESTORES_PREVIOUS_SCRIPT_APPROVAL_AFTER_REVOCATION';
    } else if (process.argv.includes('--red')) {
      assert.equal(proof.loaded.trusted, true); assert.equal(proof.loaded.banner, false); assert.equal(proof.play.counter, 1);
      proof.status = 'HISTORICAL_RED_NATIVE_IMPORTED_SPRITE_MODERN_SCRIPT_EXECUTES_WITHOUT_APPROVAL';
    } else {
      assert.equal(proof.loaded.trusted, false); assert.equal(proof.loaded.banner, true); assert.equal(proof.play.counter, 0);
      proof.status = 'NATIVE_IMPORTED_SPRITE_MODERN_SCRIPT_DEFAULT_DENY_PASS_NOT_PHASE_QUALIFIED';
    }
    assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []);
  } catch (error) { proof.status = 'FAIL'; proof.failure = error.stack; process.exitCode = 1; }
  finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); proof.endedAt = new Date().toISOString(); proof.resourcesClosed = true; fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof)); }
})();
