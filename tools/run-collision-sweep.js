'use strict';
// Headless driver for tools/playtest-collision-sweep.js across the public
// games of a built site. Usage:
//   node tools/run-collision-sweep.js [siteDir=dist/engine-site] [seconds=25] [ids,comma,separated]
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const site = path.resolve(root, process.argv[2] || 'dist/engine-site');
const seconds = Number(process.argv[3] || 25);
const only = process.argv[4] ? process.argv[4].split(',') : null;
const sweepCode = fs.readFileSync(path.join(__dirname, 'playtest-collision-sweep.js'), 'utf8');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.resolve(site, '.' + u);
  if (!f.startsWith(site + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => { res.writeHead(e ? 404 : 200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(e ? 'Not found' : b); });
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const catalog = JSON.parse(fs.readFileSync(path.join(site, 'games', 'catalog.json'), 'utf8'));
  const results = {};
  try {
    for (const game of catalog.games) {
      if (only && !only.includes(game.id)) continue;
      const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
      try {
        await page.goto(origin + '/games/' + game.id + '.html', { timeout: 60000 });
        await page.waitForSelector('#start-overlay-btn', { state: 'visible', timeout: 30000 });
        await page.click('#start-overlay-btn');
        await page.waitForFunction(() => { try { return eval('playMode && player && player.entity && !app.paused'); } catch (e) { return false; } }, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.evaluate(sweepCode);
        const r = await page.evaluate(([s, seed]) => window.__collisionSweep({ seconds: s, seed }), [seconds, Number(process.env.SWEEP_SEED || 7)]);
        results[game.id] = { ...r, errors };
      } catch (e) {
        results[game.id] = { error: String(e.message).split('\n')[0].slice(0, 200), errors };
      }
      const r = results[game.id];
      const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
      console.log(game.id.padEnd(22), r.error ? 'ERROR ' + r.error : `${r.controller} dist=${r.distance} samples=${r.samples} stuck=${r.stuckSamples} falls=${r.falls} solidPen=${sum(r.solidPenetration)} ghost=${sum(r.visualGhost)}`);
      await page.close();
    }
  } finally {
    await browser.close(); server.close();
  }
  const out = path.join(root, 'qualification', 'collision-sweep-' + new Date().toISOString().replace(/[:.]/g, '') + '.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('report ->', path.relative(root, out));
})();
