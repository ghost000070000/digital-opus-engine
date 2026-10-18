'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.OPUS_SOAK_PORT || '8897';
const minutes = Number(process.env.OPUS_SOAK_MINUTES || 30);
const ids = ['arsenal-run', 'power-grid', 'signal-relay', 'silent-sector', 'relic-frontier'];
const projects = Object.fromEntries(ids.map(id => [id, JSON.parse(fs.readFileSync(path.join(ROOT, `games/${id}.json`), 'utf8'))]));
(async () => {
  const started = Date.now(), deadline = started + minutes * 60000;
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, PORT], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('soak server timeout')), 10000); server.stdout.on('data', data => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const results = [], errors = [];
  try {
    let cycle = 0;
    while (Date.now() < deadline) {
      const id = ids[cycle % ids.length], project = projects[id], level = project.levels[project.startLevelIndex || 0];
      const context = await browser.newContext({ viewport: cycle % 2 ? { width: 960, height: 600 } : { width: 1280, height: 720 } });
      const page = await context.newPage();
      const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(`http://127.0.0.1:${PORT}/dist/games/${id}.html`, { waitUntil: 'load', timeout: 60000 });
      if (level.ui?.startScreen?.enabled) await page.locator('#start-overlay-btn').click();
      await page.waitForTimeout(250);
      const before = await page.evaluate(() => ({ x: player.entity.position.x, y: player.entity.position.y, z: player.entity.position.z }));
      await page.keyboard.down('w'); await page.waitForTimeout(350); await page.keyboard.up('w');
      await page.keyboard.down('w'); await page.keyboard.down('d'); await page.waitForTimeout(250); await page.keyboard.up('d'); await page.keyboard.up('w');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      const after = await page.evaluate(() => ({ position: { x: player.entity.position.x, y: player.entity.position.y, z: player.entity.position.z }, heldInputs: app.input.keys.size }));
      const finite = Object.values(after.position).every(Number.isFinite);
      const pass = finite && after.heldInputs === 0 && pageErrors.length === 0;
      results.push({ cycle: cycle + 1, id, before, after, pageErrors, pass });
      if (!pass) errors.push({ cycle: cycle + 1, id, pageErrors, after });
      await context.close();
      cycle++;
      if (cycle % 10 === 0) console.log(`Soak ${cycle} cycles; ${((Date.now() - started) / 60000).toFixed(1)}/${minutes} minutes; errors ${errors.length}`);
    }
  } finally { await browser.close(); server.kill(); }
  const evidence = { generatedAt: new Date().toISOString(), requestedMinutes: minutes, actualMinutes: (Date.now() - started) / 60000, ids, cycles: results.length, errors, results, pass: (Date.now() - started) >= minutes * 60000 && results.length > 0 && errors.length === 0 };
  fs.writeFileSync(path.join(ROOT, 'gameplay-editor-stabilization-soak.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`Gameplay/editor soak: ${evidence.pass ? 'PASS' : 'FAIL'}; ${evidence.actualMinutes.toFixed(1)} minutes; ${evidence.cycles} cycles; ${errors.length} errors`);
  if (!evidence.pass) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
