'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'qualification', 'phase-048'), PORT = '8908', ORIGIN = `http://127.0.0.1:${PORT}`;
const variants = ['horizontal', 'elevator-up', 'elevator-down', 'diagonal', 'low-ceiling', 'two-riders', 'walk-off', 'one-way', 'moving-slope', '10k-map'];
async function waitServer(server) { await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server timeout')), 10000); server.stdout.on('data', (data) => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); server.once('exit', (code) => reject(new Error(`server exited ${code}`))); }); }
(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, PORT], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await waitServer(server);
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-unsafe-swiftshader'] });
  const report = { phase: 48, generatedAtUtc: new Date().toISOString(), browserCycles: 0, editableCycles: 0, playableCycles: 0, pageErrors: [], consoleErrors: [], externalRequests: [], stateReadbacks: [], screenshots: [], heaps: [], status: 'FAIL' };
  try {
    for (let cycle = 0; cycle < 30; cycle++) {
      const variant = variants[cycle % variants.length], tier = cycle % 3 === 0 ? 'editable' : 'playable';
      const file = `${String(variants.indexOf(variant) + 1).padStart(2, '0')}-${variant}-${tier}.html`;
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`${cycle}:${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`${cycle}:${message.text()}`); });
      page.on('request', (request) => { const url = request.url(); if (!url.startsWith(ORIGIN) && !url.startsWith('data:') && !url.startsWith('blob:')) report.externalRequests.push(url); });
      await page.goto(`${ORIGIN}/qualification/phase-048/export-campaign/${file}`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof OpusMovingPlatform2D === 'object' && typeof getCharacterCollision2DState === 'function' && typeof placed !== 'undefined');
      if (tier === 'editable') {
        const authoring = await page.evaluate(() => { const schema = OpusAuthoring.registry.get('moving-platform-2d'); return { id: schema.id, version: schema.version, fields: schema.ownedFields.slice(), discoverable: OpusAuthoring.discoverComponents({ kind: 'cube' }, 'moving platform').some((entry) => entry.schema.id === schema.id) }; });
        assert(authoring.discoverable && authoring.version === 1); report.editableCycles++;
      } else {
        await page.waitForFunction(() => playMode === true); report.playableCycles++;
      }
      await page.waitForTimeout(100);
      const readback = await page.evaluate(() => { const ids = ['phase-048-horizontal-rider', 'phase-048-up-rider', 'phase-048-slope-rider', 'phase-048-one-way-rider']; return ids.map((id) => { const object = placed.find((entry) => entry.id === id), state = getCharacterCollision2DState(id); return { id, position: object ? [object.entity.position.x, object.entity.position.y] : null, grounded: !!state.grounded, support: state.groundSupportId, moving: !!state.onMovingPlatform, velocity: state.groundSupportVelocity }; }); });
      assert(readback.every((item) => item.position && item.position.every(Number.isFinite)));
      report.stateReadbacks.push({ cycle, variant, tier, riders: readback });
      report.heaps.push(await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null));
      if (report.screenshots.length < 5 && ['horizontal', 'elevator-up', 'low-ceiling', 'one-way', 'moving-slope'].includes(variant)) { const name = `phase-048-${variant}.png`; await page.screenshot({ path: path.join(OUT, name) }); report.screenshots.push(name); }
      report.browserCycles++; await context.close();
    }
    assert.strictEqual(report.browserCycles, 30); assert(report.editableCycles >= 10 && report.playableCycles >= 10);
    assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.externalRequests, []);
    report.status = 'PASS';
  } finally {
    report.endedAtUtc = new Date().toISOString(); fs.writeFileSync(path.join(OUT, 'phase-048-browser.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.kill();
  }
  console.log(JSON.stringify({ status: report.status, browserCycles: report.browserCycles, editable: report.editableCycles, playable: report.playableCycles, screenshots: report.screenshots.length }));
})().catch((error) => { console.error(error); process.exit(1); });
