'use strict';
// Makes walk-through props in the public example games solid, using the
// editor's own Inspector fits inside the real built game page, then writes the
// result into games/<id>.json: trees get "Fit Box to Trunk/Base"
// (meshTrunkItemCollider), floor-standing pipes get "Fit Box to Mesh".
// Players used to walk straight through both. Bushes, undergrowth and small
// edging rocks stay walk-through on purpose.
// Usage: node tools/apply-tree-trunk-colliders.js [--dry]   (needs a fresh dist/engine-site build)
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'dist', 'engine-site');
const dry = process.argv.includes('--dry');
const FITS = [[/^showcase-tree-/, 'meshTrunkItemCollider'], [/^showcase-pipe$/, 'meshFittedItemCollider']];
const fitFor = (assetId) => (FITS.find(([pattern]) => pattern.test(assetId || '')) || [])[1];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.resolve(site, '.' + u);
  if (!f.startsWith(site + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => { res.writeHead(e ? 404 : 200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(e ? '' : b); });
});
const round = (v) => Math.round(v * 1000) / 1000;
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'games', 'catalog.json'), 'utf8'));
  const summary = {};
  try {
    for (const game of catalog.games) {
      const file = path.join(root, 'games', game.file);
      const project = JSON.parse(fs.readFileSync(file, 'utf8'));
      const wanted = [];
      (project.levels || []).forEach((level, li) => level.objects.forEach((o) => { if (o.kind === 'cube' && fitFor(o.assetId) && o.solid !== true && o.visible !== false && !o.parentId) wanted.push({ li, id: o.id }); }));
      if (!wanted.length) continue;
      const page = await browser.newPage();
      await page.goto(origin + '/games/' + game.id + '.html', { timeout: 60000 });
      await page.waitForFunction(() => { try { return eval('Array.isArray(placed) && placed.length > 0 && typeof meshTrunkItemCollider === "function"'); } catch (e) { return false; } }, null, { timeout: 60000 });
      // Level 0 is what the page has loaded; other levels are skipped rather than guessed.
      const jobs = wanted.filter((w) => w.li === 0).map((w) => [w.id, fitFor(project.levels[0].objects.find((o) => o.id === w.id).assetId)]);
      const fitted = await page.evaluate((jobs) => eval(`(() => { const out = {}; for (const [id, fit] of ${JSON.stringify(jobs)}) { const item = placed.find((p) => p.id === id); if (!item || item.entity.solid) continue; const c = (fit === 'meshTrunkItemCollider' ? meshTrunkItemCollider : meshFittedItemCollider)(item, findAssetById(item.assetId)); if (c) out[id] = c; } return out; })()`), jobs);
      const ids = jobs;
      await page.close();
      let applied = 0;
      for (const o of project.levels[0].objects) {
        const c = fitted[o.id];
        if (!c) continue;
        o.solid = true;
        o.collider = { shape: 'box', size: { x: round(c.size.x), y: round(c.size.y), z: round(c.size.z) }, offset: { x: round(c.offset.x), y: round(c.offset.y), z: round(c.offset.z) } };
        applied++;
      }
      summary[game.id] = { trees: wanted.length, applied, skippedOtherLevels: wanted.length - ids.length };
      // Write-then-rename: rewriting an existing file in place intermittently
      // fails on this Windows checkout (errno -4094).
      if (applied && !dry) { fs.writeFileSync(file + '.tmp', JSON.stringify(project, null, 2) + '\n'); fs.renameSync(file + '.tmp', file); }
      console.log(game.id.padEnd(22), JSON.stringify(summary[game.id]));
    }
  } finally { await browser.close(); server.close(); }
})();
