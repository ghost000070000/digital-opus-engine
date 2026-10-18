'use strict';
// Native script-bearing creator/persistence/file-export workflow. Script effects
// are only an ephemeral window counter; all browser contexts are disposable.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), runId = 'script-transfer-' + new Date().toISOString().replace(/[-:.]/g, ''), dir = path.join(root, process.argv.includes('--beta-revision-1')?'qualification/beta-revision-1':'qualification/phase-226', runId);
fs.mkdirSync(dir, { recursive: true });
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), errors: [], external: [], observations: [] };
const server = http.createServer((req, res) => { const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); } fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(error ? 'Not found' : bytes); }); });
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); browser = await chromium.launch({ channel: 'msedge', headless: true });
    const observe = (p, offline = false) => { p.setDefaultTimeout(15000); p.on('pageerror', error => proof.errors.push(error.stack)); p.on('dialog', dialog => dialog.accept()); p.on('request', request => { if (!(offline ? /^(file:|data:|blob:)/ : /^(http:\/\/127\.0\.0\.1:|data:|blob:)/).test(request.url())) proof.external.push(request.url()); }); };
    const portable = p => p.evaluate(() => JSON.parse(JSON.stringify(serializeProject())));
    const diagnostic = p => p.evaluate(() => JSON.parse(JSON.stringify(captureAssetReplacementState().project)));
    const one = async (p, label, action) => { const before = await diagnostic(p), count = await p.evaluate(() => undoStack.length); await action(); const after = await diagnostic(p); assert.equal(await p.evaluate(() => undoStack.length), count + 1, label); await p.locator('#undo-btn').click(); assert.deepStrictEqual(await diagnostic(p), before, label + ' full Undo'); await p.locator('#redo-btn').click(); assert.deepStrictEqual(await diagnostic(p), after, label + ' full Redo'); };
    const p = await browser.newPage({ viewport: { width: 1280, height: 960 } }); observe(p);
    await p.goto('http://127.0.0.1:' + server.address().port + '/editor/index.html'); await p.waitForFunction(() => typeof captureAssetReplacementState === 'function'); if (await p.locator('#first-run-skip').isVisible()) await p.locator('#first-run-skip').click();
    const project = require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project; project.meta.title = 'Private226 script transfer';
    project.levels[0].objects.find(item => item.id === 'obj3').behaviors = [{ trigger: 'start', action: 'script', params: { code: 'window.__phase226TransferCounter = (window.__phase226TransferCounter || 0) + 1;' } }];
    const input = path.join(dir, 'private-project.json'); fs.writeFileSync(input, JSON.stringify(project)); await p.locator('#import-project-input').setInputFiles(input); await p.locator('[data-backup-replace]').click(); await p.waitForFunction(() => projectMeta.title === 'Private226 script transfer'); assert.equal(await p.evaluate(() => scriptsTrusted), false);
    await p.locator('[data-right-tab="scene"]').click(); const index = await p.evaluate(() => placed.findIndex(item => item.id === 'obj3')); await p.locator('.scene-list-item[data-index="' + index + '"]').click(); await p.locator('[data-right-tab="inspector"]').click();
    await p.locator('#sprite-prefab-name').fill('Private script island'); await one(p, 'Script-bearing Sprite Prefab capture', () => p.locator('#sprite-save-prefab').click());
    await p.locator('[data-left-tab="prefabs"]').click(); const prefabIndex = await p.evaluate(() => prefabs.findIndex(prefab => prefab.name === 'Private script island')), label = p.locator('#palette-prefab-' + prefabIndex + ' > span'); await label.scrollIntoViewIfNeeded();
    const beforeIds = await p.evaluate(() => placed.map(item => item.id)), box = await label.boundingBox(), view = await p.locator('#game').boundingBox();
    await one(p, 'Independent script-bearing Prefab placement', async () => { await p.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await p.mouse.down(); await p.mouse.move(view.x + view.width * .75, view.y + view.height * .65, { steps: 16 }); await p.mouse.up(); await p.waitForFunction(ids => placed.some(item => !ids.includes(item.id)), beforeIds); });
    const copyId = await p.evaluate(ids => placed.find(item => !ids.includes(item.id)).id, beforeIds), complete = await portable(p);
    assert.equal(complete.levels[0].objects.find(item => item.id === copyId).behaviors[0].action, 'script'); assert(!Object.hasOwn(complete, 'scriptsTrusted')); assert(!Object.hasOwn(complete, 'scriptTrustRevoked'));
    const name = 'Private script save ' + runId; await p.locator('[data-right-tab="project"]').click(); if (!await p.locator('#project-name-input').isVisible()) await p.locator('[data-section="save"]').click(); await p.locator('#project-name-input').fill(name); await p.locator('#save-btn').click();
    await p.waitForFunction(()=>!projectDurability.saving);assert.deepStrictEqual(await p.evaluate(name => app.save.load(name), name), complete);
    await p.reload(); await p.waitForFunction(() => typeof captureAssetReplacementState === 'function'); if (!await p.locator('#play-btn').isVisible()) await p.locator('#chrome-toggle-btn').click(); await p.waitForFunction(() => !playMode);
    await p.locator('#project-home-btn').click(); await p.locator('#project-home-search').fill(name); await p.getByRole('button', { name: 'Open ' + name, exact: true }).click(); assert.deepStrictEqual(await portable(p), complete); assert.equal(await p.evaluate(() => scriptsTrusted), false);
    proof.observations.push('Native script-bearing Sprite capture/independent placement each exact one Undo/full UndoRedo; ordinary named Save/browserreload/HomeOpen retains complete portable project/Prefab/code and no stored approval, default denied.');
    const exportFile = async (q, selector, tier) => {
      await q.locator('[data-right-tab="project"]').click(); if (!await q.locator(selector).isVisible()) await q.locator('[data-section="importexport"]').click();
      const pending = q.waitForEvent('download', { timeout: 30000 }); pending.catch(() => {});
      try { await require('./native-export-review')(q, selector); const file = path.join(dir, tier + '.html'); await (await pending).saveAs(file); assert(fs.statSync(file).size > 100000); return file; }
      catch (error) { proof.exportFailure = { tier, feedback: await q.locator('#status-msg').textContent().catch(() => null), preflight: await q.locator('#export-preflight-dialog').innerText().catch(() => null) }; await q.screenshot({ path: path.join(dir, tier + '-export-failure.png') }); throw error; }
    };
    const outputs = [{ tier: 'Editable', file: await exportFile(p, '#export-standalone-btn', 'Editable') }, { tier: 'Playable', file: await exportFile(p, '#export-playable-btn', 'Playable') }];
    for (const output of outputs) {
      const q = await browser.newPage({ viewport: { width: 1280, height: 960 } }); observe(q, true);
      try {
        await q.goto(require('url').pathToFileURL(output.file).href); await q.waitForFunction(() => typeof captureAssetReplacementState === 'function'); await q.locator('#script-trust-launch-gate').waitFor({ state: 'visible' });
        assert.equal(await q.evaluate(() => playMode), false); assert.equal(await q.evaluate(() => scriptsTrusted), false); assert.equal(await q.evaluate(() => window.__phase226TransferCounter || 0), 0);
        const retained = await portable(q); if (output.tier === 'Editable') assert.deepStrictEqual(retained, complete);
        if (output.tier !== 'Editable') assert(await q.locator('#script-trust-launch-edit').isHidden(), 'Playable choice cannot expose editor access');
        for (const id of ['obj3', copyId]) assert.deepStrictEqual(retained.levels[0].objects.find(item => item.id === id), complete.levels[0].objects.find(item => item.id === id));
        await q.screenshot({ path: path.join(dir, output.tier + '-default-permission.png') });
        await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase226TransferCounter || 0), 0);
        await q.locator('#script-trust-runtime-access').click(); await q.locator('#script-trust-dialog').waitFor({ state: 'visible' }); assert.equal(await q.evaluate(() => playMode), false); assert.match(await q.locator('#script-trust-code').textContent(), /__phase226TransferCounter/);
        await q.locator('#script-trust-agree').check(); await q.locator('#script-trust-confirm').click(); assert.equal(await q.evaluate(() => window.__phase226TransferCounter || 0), 0);
        await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase226TransferCounter), 2, 'Both independent owners execute only after explicit approval and Start');
        await q.locator('#script-trust-runtime-access').click(); await q.locator('#script-trust-review-revoke').click(); assert.equal(await q.evaluate(() => scriptsTrusted), false);
        await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase226TransferCounter), 2, 'Revoked session cannot execute on next Start');
        proof.observations.push({ tier: output.tier, label: 'Actual offline file boot default-denied gate; explicit disabled Start runs no code; Stop/review/ack/confirm/Start runs both independent owners exactly once; Stop/revoke/Start leaves counter unchanged. Permission never embedded or persisted.', owners: ['obj3', copyId], finalCounter: 2 });
        if (output.tier === 'Editable') {
          await q.locator('#script-trust-runtime-access').click(); await q.locator('#script-trust-close').click(); await q.locator('#script-trust-launch-edit').click(); assert.equal(await q.evaluate(() => playMode), false);
          await q.locator('[data-right-tab="ui"]').click(); if (!await q.locator('#hud-element-list').isVisible()) await q.locator('[data-section="hud"]').click();
          const field = q.locator('#hud-element-list [data-hud-id="platformer-guide"] [data-hud-field="offsetX"]'); await one(q, 'Editable ordinary HUD33 authoring', async () => { await field.fill('33'); await field.press('Tab'); });
          outputs.push({ tier: 'ReviewedPlayable', file: await exportFile(q, '#export-playable-btn', 'ReviewedPlayable') });
        }
      } finally { await q.close(); }
    }
    assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []); proof.status = 'NATIVE_SCRIPT_PREFAB_HISTORY_SAVE_RELOAD_OFFLINE_EXPORT_DEFAULT_DENY_REVIEW_ENABLE_REVOKE_AND_REEXPORT_PASS_NOT_PHASE_QUALIFIED';
  } catch (error) { proof.status = 'FAIL'; proof.failure = error.stack; process.exitCode = 1; }
  finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); proof.endedAt = new Date().toISOString(); proof.resourcesClosed = true; fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof)); }
})();
