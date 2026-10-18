'use strict';
// Canonical package utility/trust dogfood, not a new package or plugin loader.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), runId = 'package-permission-' + new Date().toISOString().replace(/[-:.]/g, ''), dir = path.join(root, 'qualification/phase-228', runId);
fs.mkdirSync(dir, { recursive: true });
const proof = { runId, startedAt: new Date().toISOString(), fingerprint: require('./real-demo-program-state').fingerprint(), errors: [], external: [] };
const server = http.createServer((req, res) => { const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); } fs.readFile(file, (err, bytes) => { res.writeHead(err ? 404 : 200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(err ? 'Not found' : bytes); }); });
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); browser = await chromium.launch({ channel: 'msedge', headless: true });
    const observe = q => { q.setDefaultTimeout(12000); q.on('pageerror', e => proof.errors.push(e.stack)); q.on('dialog', d => d.accept()); q.on('request', r => { if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(r.url())) proof.external.push(r.url()); }); };
    let p = await browser.newPage({ viewport: { width: 1280, height: 960 } }); observe(p);
    await p.goto('http://127.0.0.1:' + server.address().port + '/editor/index.html'); await p.waitForFunction(() => typeof captureAssetReplacementState === 'function'); if (await p.locator('#first-run-skip').isVisible()) await p.locator('#first-run-skip').click();
    const project = require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project; project.meta.title = 'Private228 advanced package source';
    const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16); return c.toDataURL('image/png'); }); for (const texture of project.textures || []) texture.dataURL = png;
    project.levels[0].objects.find(o => o.id === 'obj3').behaviors = [{ trigger: 'start', action: 'script', params: { code: 'window.__phase228Package = (window.__phase228Package || 0) + 1;' } }, { trigger: 'start', action: 'custom_absent', params: { unknown: 'retain' } }];
    const file = path.join(dir, 'source.json'); fs.writeFileSync(file, JSON.stringify(project)); await p.locator('#import-project-input').setInputFiles(file); await p.waitForFunction(() => projectMeta.title === 'Private228 advanced package source');
    await p.locator('[data-right-tab="scene"]').click(); const index = await p.evaluate(() => placed.findIndex(o => o.id === 'obj3')); await p.locator('.scene-list-item[data-index="' + index + '"]').click(); await p.locator('[data-right-tab="inspector"]').click(); await p.locator('#sprite-prefab-name').fill('Advanced island'); await p.locator('#sprite-save-prefab').click();
    await p.locator('[data-left-tab="prefabs"]').click(); await p.locator('[data-export-prefab-package]').last().click(); await p.locator('#tilemap-bundle-confirm').waitFor({ state: 'visible' });
    const download = p.waitForEvent('download'); download.catch(() => {}); await p.locator('#tilemap-bundle-confirm').click(); const pack = path.join(dir, 'advanced.opus-assets.json'); await (await download).saveAs(pack);
    const target = JSON.parse(JSON.stringify(project)); target.meta.title = 'Private228 target'; target.prefabs = []; target.levels[0].objects.find(o => o.id === 'obj3').behaviors = [];
    await p.close(); p = await browser.newPage({ viewport: { width: 1280, height: 960 } }); observe(p); await p.goto('http://127.0.0.1:' + server.address().port + '/editor/index.html'); await p.waitForFunction(() => typeof captureAssetReplacementState === 'function'); if (await p.locator('#first-run-skip').isVisible()) await p.locator('#first-run-skip').click();
    const targetFile = path.join(dir, 'target.json'); fs.writeFileSync(targetFile, JSON.stringify(target)); await p.locator('#import-project-input').setInputFiles(targetFile); await p.waitForFunction(() => projectMeta.title === 'Private228 target');
    await p.locator('[data-right-tab="project"]').click(); if (!await p.locator('#script-trust-project-btn').isVisible()) await p.locator('[data-section="importexport"]').click(); await p.locator('#script-trust-project-btn').click(); await p.locator('#script-trust-agree').check(); await p.locator('#script-trust-confirm').click(); assert.equal(await p.evaluate(() => scriptsTrusted), true);
    const snap = () => p.evaluate(() => ({ project: JSON.stringify(serializeProject()), trusted: scriptsTrusted, revoked: scriptTrustRevoked, seen: scriptTrustSeen, undo: undoStack.length, redo: redoStack.length }));
    const before = await snap(); await p.locator('#import-asset-pack-input').setInputFiles(pack); await p.locator('#tilemap-bundle-confirm').waitFor({ state: 'visible' });
    proof.preview = await p.locator('#tilemap-bundle-modal').innerText(); assert.deepStrictEqual(await snap(), before);
    assert.match(proof.preview, /Custom Script permission/);
    await p.screenshot({ path: path.join(dir, 'Advanced-package-review.png') });
    await p.locator('#tilemap-bundle-cancel').click(); assert.deepStrictEqual(await snap(), before);
    await p.locator('#import-asset-pack-input').setInputFiles(pack); await p.locator('#tilemap-bundle-confirm').click();
    proof.imported = await snap(); assert.equal(proof.imported.trusted, false); assert.equal(proof.imported.revoked, true); assert.equal(proof.imported.seen, true); assert.equal(proof.imported.undo, before.undo + 1);
    await p.locator('#undo-btn').click(); assert.equal((await snap()).project, before.project); assert.equal((await snap()).trusted, false, 'Undo cannot undo permission revocation'); await p.locator('#redo-btn').click(); assert.equal((await snap()).project, proof.imported.project); assert.equal((await snap()).trusted, false);
    await p.locator('[data-left-tab="prefabs"]').click(); const pi = await p.evaluate(() => prefabs.findIndex(f => f.name === 'Advanced island')), label = p.locator('#palette-prefab-' + pi + ' > span'); await label.scrollIntoViewIfNeeded(); const box = await label.boundingBox(), game = await p.locator('#game').boundingBox();
    await p.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await p.mouse.down(); await p.mouse.move(game.x + game.width * .75, game.y + game.height * .65, { steps: 16 }); await p.mouse.up();
    await p.locator('#play-btn').click(); await p.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await p.evaluate(() => window.__phase228Package || 0), 0); await p.keyboard.press('Escape'); await p.locator('#play-btn').click(); await p.waitForFunction(() => !playMode);
    await p.locator('#script-trust-enable-btn').click(); assert.match(await p.locator('#script-trust-code').textContent(), /__phase228Package/); assert.match(await p.locator('#script-trust-code').textContent(), /custom_absent/); await p.locator('#script-trust-agree').check(); await p.locator('#script-trust-confirm').click();
    await p.locator('#play-btn').click(); await p.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await p.evaluate(() => window.__phase228Package), 1);
    if (process.argv.includes('--exports')) {
      await p.keyboard.press('Escape'); await p.locator('#play-btn').click(); await p.waitForFunction(() => !playMode);
      const portable = q => q.evaluate(() => JSON.parse(JSON.stringify(serializeProject()))), complete = await portable(p), name = 'Private228-' + runId;
      await p.locator('[data-right-tab="project"]').click(); if (!await p.locator('#project-name-input').isVisible()) await p.locator('[data-section="save"]').click(); await p.locator('#project-name-input').fill(name); await p.locator('#save-btn').click(); assert.deepStrictEqual(await p.evaluate(name => app.save.load(name), name), complete);
      await p.reload(); await p.waitForFunction(() => typeof captureAssetReplacementState === 'function'); if (!await p.locator('#play-btn').isVisible()) await p.locator('#chrome-toggle-btn').click(); await p.waitForFunction(() => !playMode);
      await p.locator('#project-home-btn').click(); await p.locator('#project-home-search').fill(name); await p.getByRole('button', { name: 'Open ' + name, exact: true }).click(); assert.deepStrictEqual(await portable(p), complete); assert.equal(await p.evaluate(() => scriptsTrusted), false);
      const exportFile = async (q, selector, tier) => { await q.locator('[data-right-tab="project"]').click(); if (!await q.locator(selector).isVisible()) await q.locator('[data-section="importexport"]').click(); const pending = q.waitForEvent('download', { timeout: 30000 }); pending.catch(() => {}); await require('./native-export-review')(q, selector); const output = path.join(dir, tier + '.html'); await (await pending).saveAs(output); return output; };
      const outputs = [{ tier: 'Editable', file: await exportFile(p, '#export-standalone-btn', 'Editable') }, { tier: 'Playable', file: await exportFile(p, '#export-playable-btn', 'Playable') }]; proof.fileTiers = [];
      for (const output of outputs) {
        const q = await browser.newPage({ viewport: { width: 1280, height: 960 } }); q.setDefaultTimeout(15000); q.on('pageerror', e => proof.errors.push(e.stack)); q.on('dialog', d => d.accept()); q.on('request', r => { if (!/^(file:|data:|blob:)/.test(r.url())) proof.external.push(r.url()); });
        try {
          await q.goto(require('url').pathToFileURL(output.file).href); await q.locator('#script-trust-launch-gate').waitFor({ state: 'visible' }); assert.equal(await q.evaluate(() => playMode), false); assert.equal(await q.evaluate(() => scriptsTrusted), false); if (output.tier === 'Editable') assert.deepStrictEqual(await portable(q), complete);
          await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase228Package || 0), 0);
          await q.locator('#script-trust-runtime-access').click(); assert.match(await q.locator('#script-trust-code').textContent(), /__phase228Package/); await q.locator('#script-trust-agree').check(); await q.locator('#script-trust-confirm').click(); await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase228Package), 1);
          await q.locator('#script-trust-runtime-access').click(); await q.locator('#script-trust-review-revoke').click(); await q.locator('#script-trust-launch-play').click(); await q.waitForFunction(() => playMode && simElapsed > .05); assert.equal(await q.evaluate(() => window.__phase228Package), 1);
          proof.fileTiers.push({ tier: output.tier, disabledCounter: 0, explicitApprovalCounter: 1, revokedCounter: 1, hostImplementationAbsent: await q.evaluate(() => Opus.ActionExtensions.list().length === 0) });
          if (output.tier === 'Editable') { await q.locator('#script-trust-runtime-access').click(); await q.locator('#script-trust-close').click(); await q.locator('#script-trust-launch-edit').click(); outputs.push({ tier: 'ReexportPlayable', file: await exportFile(q, '#export-playable-btn', 'ReexportPlayable') }); }
        } finally { await q.close(); }
      }
      proof.persistence = 'Full named Save/reload/HomeOpen preserves imported library, independently placed owner, unknown host params; permission not stored.';
    }
    assert.deepStrictEqual(proof.errors, []); assert.deepStrictEqual(proof.external, []); proof.status = 'CANONICAL_ADVANCED_PACKAGE_DISCLOSURE_CANCEL_IMPORT_REVOCATION_UNDO_REDO_AND_EXPLICIT_APPROVAL_PASS';
  } catch (error) { proof.status = 'FAIL'; proof.failure = error.stack; process.exitCode = 1; }
  finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); proof.endedAt = new Date().toISOString(); proof.resourcesClosed = true; fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify({ ...proof, imported: proof.imported && { ...proof.imported, project: '[full portable JSON preserved in results.json]' } })); }
})();
