'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), runId = 'action-transfer-' + new Date().toISOString().replace(/[-:.]/g, ''), dir = path.join(root, 'qualification/phase-227', runId);
fs.mkdirSync(dir, { recursive: true });
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), errors: [], external: [], observations: [] };
const server = http.createServer((req, res) => { const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); } fs.readFile(file, (err, bytes) => { res.writeHead(err ? 404 : 200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(err ? 'Not found' : bytes); }); });
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); browser = await chromium.launch({ channel: 'msedge', headless: true });
    const observe = (p, offline = false) => { p.setDefaultTimeout(15000); p.on('pageerror', e => proof.errors.push(e.stack)); p.on('dialog', d => d.accept()); p.on('request', r => { if (!(offline ? /^(file:|data:|blob:)/ : /^(http:\/\/127\.0\.0\.1:|data:|blob:)/).test(r.url())) proof.external.push(r.url()); }); };
    const portable = p => p.evaluate(() => JSON.parse(JSON.stringify(serializeProject())));
    const diagnostic = p => p.evaluate(() => JSON.parse(JSON.stringify(captureAssetReplacementState().project)));
    const one = async (p, label, action) => { const before = await diagnostic(p), count = await p.evaluate(() => undoStack.length); await action(); const after = await diagnostic(p); assert.equal(await p.evaluate(() => undoStack.length), count + 1, label); await p.locator('#undo-btn').click(); assert.deepStrictEqual(await diagnostic(p), before); await p.locator('#redo-btn').click(); assert.deepStrictEqual(await diagnostic(p), after); };
    // Explicit developer host installation, NOT bytes restored from project JSON.
    const installHost = p => p.evaluate(() => Opus.ActionExtensions.register('custom_bonus', { label: 'Award Host Bonus', help: 'Private host counter. Host code is installed separately, never embedded automatically.', fields: [{ key: 'amount', label: 'Amount', type: 'number' }, { key: 'subject', label: 'Subject', type: 'target' }, { key: 'literal', label: 'Literal text', type: 'text' }], exec(params) { window.__phase227Bonus = (window.__phase227Bonus || 0) + params.amount; } }));
    const p = await browser.newPage({ viewport: { width: 1280, height: 960 } }); observe(p);
    await p.goto('http://127.0.0.1:' + server.address().port + '/editor/index.html'); await p.waitForFunction(() => !!window.Opus?.ActionExtensions); if (await p.locator('#first-run-skip').isVisible()) await p.locator('#first-run-skip').click();
    const project = require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project; project.meta.title = 'Private227 transfer';
    project.levels[0].objects.find(o => o.id === 'obj3').behaviors = [{ trigger: 'start', action: 'custom_bonus', params: { amount: 7, futureParameter: 'retain' } }, { trigger: 'start', action: 'graph', graph: { graphVersion: 1, nodes: [{ id: 'bonus', type: 'custom_bonus', x: 60, y: 220, amount: 3 }], edges: [{ from: 'start', to: 'bonus', kind: 'next' }] } }];
    if (process.argv.includes('--references')) {
      const owner = project.levels[0].objects.find(o => o.id === 'obj3'), target = project.levels[0].objects.find(o => o.id === 'obj4');
      owner.groupId = target.groupId = 'group227'; target.behaviors = [];
      Object.assign(owner.behaviors[0].params, { subject: 'obj4', literal: 'obj4', futureLiteral: 'obj4' });
      Object.assign(owner.behaviors[1].graph.nodes[0], { subject: 'obj4', literal: 'obj4', futureLiteral: 'obj4' });
    }
    const file = path.join(dir, 'project.json'); fs.writeFileSync(file, JSON.stringify(project)); await p.locator('#import-project-input').setInputFiles(file); await p.waitForFunction(() => projectMeta.title === 'Private227 transfer'); await installHost(p);
    await p.locator('[data-right-tab="scene"]').click(); const index = await p.evaluate(() => placed.findIndex(o => o.id === 'obj3')); await p.locator('.scene-list-item[data-index="' + index + '"]').click(); await p.locator('[data-right-tab="inspector"]').click();
    await p.locator(process.argv.includes('--references') ? '#prefab-name-input' : '#sprite-prefab-name').fill('Host Bonus Island'); await one(p, 'Prefab capture', () => p.locator(process.argv.includes('--references') ? '#save-prefab-btn' : '#sprite-save-prefab').click());
    await p.locator('[data-left-tab="prefabs"]').click(); const pi = await p.evaluate(() => prefabs.findIndex(f => f.name === 'Host Bonus Island')), label = p.locator('#palette-prefab-' + pi + ' > span'); await label.scrollIntoViewIfNeeded();
    const ids = await p.evaluate(() => placed.map(o => o.id)), box = await label.boundingBox(), view = await p.locator('#game').boundingBox();
    await one(p, 'Independent Prefab placement', async () => { await p.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await p.mouse.down(); await p.mouse.move(view.x + view.width * .75, view.y + view.height * .65, { steps: 16 }); await p.mouse.up(); await p.waitForFunction(ids => placed.some(o => !ids.includes(o.id)), ids); });
    const copyId = await p.evaluate(ids => placed.find(o => !ids.includes(o.id)).id, ids), complete = await portable(p), name = 'Private227-' + runId;
    if (process.argv.includes('--references')) {
      proof.references = await p.evaluate(id => { const root = placed.find(o => o.id === id), target = placed.find(o => o.groupId === root.groupId && o.id !== root.id); return { copyId: root.id, targetId: target?.id, behavior: root.behaviors[0].params, graph: root.behaviors[1].graph.nodes[0] }; }, copyId);
      assert.notEqual(proof.references.targetId, 'obj4');
      for (const params of [proof.references.behavior, proof.references.graph]) { assert.equal(params.subject, proof.references.targetId); assert.equal(params.literal, 'obj4'); assert.equal(params.futureLiteral, 'obj4'); }
    }
    for (const id of ['obj3', copyId]) assert.equal(complete.levels[0].objects.find(o => o.id === id).behaviors[0].params.futureParameter, 'retain');
    await p.locator('[data-right-tab="project"]').click(); if (!await p.locator('#project-name-input').isVisible()) await p.locator('[data-section="save"]').click(); await p.locator('#project-name-input').fill(name); await p.locator('#save-btn').click(); assert.deepStrictEqual(await p.evaluate(name => app.save.load(name), name), complete);
    await p.reload(); await p.waitForFunction(() => !!window.Opus?.ActionExtensions); if (!await p.locator('#play-btn').isVisible()) await p.locator('#chrome-toggle-btn').click(); await p.waitForFunction(() => !playMode);
    await p.locator('#project-home-btn').click(); await p.locator('#project-home-search').fill(name); await p.getByRole('button', { name: 'Open ' + name, exact: true }).click(); assert.deepStrictEqual(await portable(p), complete); assert.equal(await p.evaluate(() => Opus.ActionExtensions.list().length), 0); assert.equal(await p.evaluate(() => scriptsTrusted), false);
    proof.observations.push('Native Prefab capture and independent placement each exact one Undo/full UndoRedo; named Save/reload/HomeOpen retains full project, future parameters and unknown host action IDs; callbacks/approval are not persisted.');
    await installHost(p);
    const exportFile = async (q, selector, tier) => { await q.locator('[data-right-tab="project"]').click(); if (!await q.locator(selector).isVisible()) await q.locator('[data-section="importexport"]').click(); const pending = q.waitForEvent('download', { timeout: 30000 }); pending.catch(() => {}); await q.locator(selector).click(); await q.locator('#export-preflight-dialog').waitFor({ state: 'visible' }); proof.lastExportReview = { tier, text: await q.locator('#export-preflight-dialog').innerText() }; assert.match(proof.lastExportReview.text, /Host-installed custom Action implementations are not embedded/); assert(await q.locator('#export-preflight-confirm').isEnabled()); await q.locator('#export-preflight-confirm').click(); const output = path.join(dir, tier + '.html'); await (await pending).saveAs(output); return output; };
    const outputs = [{ tier: 'Editable', file: await exportFile(p, '#export-standalone-btn', 'Editable') }, { tier: 'Playable', file: await exportFile(p, '#export-playable-btn', 'Playable') }];
    for (const output of outputs) {
      const q = await browser.newPage({ viewport: { width: 1280, height: 960 } }); observe(q, true);
      try {
        await q.goto(require('url').pathToFileURL(output.file).href); await q.waitForFunction(() => !!window.Opus?.ActionExtensions); await q.locator('#script-trust-launch-gate').waitFor({ state: 'visible' });
        assert.equal(await q.evaluate(() => Opus.ActionExtensions.list().length), 0); assert.equal(await q.evaluate(() => playMode), false); assert.equal(await q.evaluate(() => scriptsTrusted), false);
        const saved = await portable(q); if (output.tier === 'Editable') assert.deepStrictEqual(saved, complete);
        for (const id of ['obj3', copyId]) assert.deepStrictEqual(saved.levels[0].objects.find(o => o.id === id), complete.levels[0].objects.find(o => o.id === id));
        await q.locator('#script-trust-launch-review').click(); assert.match(await q.locator('#script-trust-code').textContent(), /custom_bonus/); await q.locator('#script-trust-agree').check(); await q.locator('#script-trust-confirm').click();
        await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase227Bonus || 0), 0);
        proof.observations.push({ tier: output.tier, missingHostApprovedStillInert: true, feedback: await q.locator('#game-toast').textContent() });
        assert.match(proof.observations.at(-1).feedback, /Unavailable custom Action/);
        await q.locator('#script-trust-runtime-access').click(); await q.locator('#script-trust-close').click();
        // A developer must explicitly install the same host extension in each
        // generated page. This test does not imply automatic executable export.
        await installHost(q); await q.locator('#script-trust-launch-review').click(); assert.match(await q.locator('#script-trust-code').textContent(), /__phase227Bonus/); await q.locator('#script-trust-agree').check(); await q.locator('#script-trust-confirm').click();
        await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase227Bonus), 20);
        await q.locator('#script-trust-runtime-access').click(); await q.locator('#script-trust-review-revoke').click(); await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase227Bonus), 20);
        proof.observations.push({ tier: output.tier, hostInstalledExplicitlyNotEmbedded: true, ownerIds: ['obj3', copyId], approvedCounter: 20, revokedCounter: 20 });
        if (output.tier === 'Editable') { await q.locator('#script-trust-runtime-access').click(); await q.locator('#script-trust-close').click(); await q.locator('#script-trust-launch-edit').click(); outputs.push({ tier: 'ReexportPlayable', file: await exportFile(q, '#export-playable-btn', 'ReexportPlayable') }); }
      } finally { await q.close(); }
    }
    assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []); proof.status = 'HOST_API_TRANSFER_EXPLICIT_REINSTALL_ALL_FILE_TIERS_PASS_NOT_AUTOMATIC_CODE_PORTABILITY';
  } catch (error) { proof.status = 'FAIL'; proof.failure = error.stack; process.exitCode = 1; }
  finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); proof.endedAt = new Date().toISOString(); proof.resourcesClosed = true; fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof)); }
})();
