'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const output = path.join(ROOT, 'gameplay-feel-evidence', 'human-cleanup');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const results = [];
  for (const key of ['w', 's', 'a', 'd']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:8837/dist/games/forest-range.html', { waitUntil: 'load', timeout: 60000 });
    await page.locator('#start-overlay-btn').click();
    await page.waitForTimeout(1100);
    const before = await page.evaluate(() => {
      const terrain = placed.find(item => item.kind === 'terrain');
      const p = player.entity.position;
      const directions = Array.from({ length: 16 }, (_, index) => {
        const angle = index * Math.PI * 2 / 16;
        const x = p.x + Math.sin(angle) * 2;
        const z = p.z + Math.cos(angle) * 2;
        return { angle, x, z, height: terrain.handle.sampleHeight(x, z) };
      });
      const routeSamples = [
        [-8, -6], [-7.5, -5.75], [-7, -5.5], [-6.5, -5], [-6, -4.5], [-5, -4],
      ].map(([x, z]) => ({ x, z, height: terrain.handle.sampleHeight(x, z) }));
      return { position: p, velocity: player.velocity, rotationY: player.entity.rotationY, basis: app.camera.getBasis(), terrainHeight: terrain.handle.sampleHeight(p.x, p.z), directions, routeSamples };
    });
    await page.keyboard.down(key);
    const samples = [];
    for (let index = 0; index < 10; index++) {
      await page.waitForTimeout(100);
      samples.push(await page.evaluate(() => ({ position: player.entity.position, velocity: player.velocity, grounded: thirdPersonGrounded, basis: app.camera.getBasis() })));
    }
    await page.keyboard.up(key);
    const after = samples.at(-1);
    results.push({ key: key.toUpperCase(), before, after, samples, errors, distanceXZ: Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z) });
    await page.close();
  }
  await browser.close();
  const report = { generatedAt: new Date().toISOString(), method: 'Fresh standalone per key; native keyboard input; read-only telemetry', results };
  fs.writeFileSync(path.join(output, 'forest-opening.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(results.map(result => ({ key: result.key, distanceXZ: result.distanceXZ, before: result.before.position, after: result.after.position, velocity: result.after.velocity })), null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
