// Local standalone browser audit. Captures unmodified rendered frames and real input sessions.
// Example: node tools/audit-catalog.js --phase baseline --seconds 24 --workers 2
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, s, i, all) => s.startsWith('--') ? [...a, [s.slice(2), all[i + 1]]] : a, []));
const phase = args.phase || 'after';
const seconds = Number(args.seconds || 24);
const minimumSim = Number(args['min-sim'] ?? 20);
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'games/catalog.json')));
const selected = catalog.games.filter(g => !args.ids || args.ids.split(',').includes(g.id));
const prefix = phase === 'baseline' ? 'rehabilitation-evidence/baseline-builds' : 'dist/games';
const outRoot = path.join(ROOT, 'rehabilitation-evidence', phase);
fs.mkdirSync(outRoot, { recursive: true });
async function state(page) {
  return page.evaluate(() => ({
    title: document.title, text: document.body.innerText,
    state: typeof gameState !== 'undefined' ? gameState : window.__gameState,
    playtime: window.__gamePlaytimeSeconds,
    simulationSeconds: typeof simElapsed !== 'undefined' ? simElapsed : null,
    ended: typeof gameEnded !== 'undefined' ? gameEnded : null,
    player: typeof player !== 'undefined' && player && player.entity ? { position: player.entity.position, visible: player.entity.visible, controller: player.controllerType, health: player.health } : null,
    camera: typeof app !== 'undefined' ? { position: app.camera.position, mode: app.camera.mode } : null,
    audio: typeof app !== 'undefined' && app.audio ? { enabled: app.audio.enabled } : null,
    objectives: window.__gameObjectives,
    inventory: window.__gameInventory,
    helpers: typeof placed !== 'undefined' ? placed.filter(o => o.isTrigger || o.isWaypoint || o.isSpawnPoint || o.kind === 'camera' || o.kind === 'spawner' || o.kind === 'light').filter(o=>o.entity && o.entity.visible).map(o=>o.name||o.id) : [],
  }));
}
async function audit(browser, g) {
  const dest = path.join(outRoot, g.id);
  fs.mkdirSync(dest, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => requests.push({ url: r.url(), error: r.failure() }));
  const report = { id: g.id, phase, url: `http://localhost:8837/${prefix}/${g.id}.html`, startedAt: new Date().toISOString(), seconds, input: [], errors, failedRequests: requests, frames: [] };
  try {
    await page.goto(report.url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(800);
    report.start = await state(page);
    await page.screenshot({ path: path.join(dest, 'start.png') });
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, phase === 'baseline' ? 'rehabilitation-evidence/baseline-games' : 'games', g.file)));
    const l = (p.levels || [p])[p.startLevelIndex || 0];
    const start = l.ui && l.ui.startScreen;
    if (start && start.enabled) {
      const btn = page.getByRole('button', { name: start.buttonText || 'Start', exact: true });
      await btn.first().click({ timeout: 20000 });
    }
    await page.waitForTimeout(1000);
    report.frames.push(await state(page));
    await page.screenshot({ path: path.join(dest, 'opening.png') });
    // Bounded representative session: movement, lateral navigation, interaction,
    // jump, attack/reload and pause/resume. Never teleport, disable AI or edit state.
    const segments = [ ['w', 0.12], ['d', 0.10], ['w', 0.15], ['a', 0.10], ['s', 0.08], ['w', 0.10], ['d', 0.05] ];
    for (let i = 0; i < segments.length; i++) {
      const [key, part] = segments[i];
      report.input.push({ key, milliseconds: Math.round(seconds * part * 1000) });
      await page.keyboard.down(key);
      if (i === 2) await page.keyboard.down('Space');
      await page.waitForTimeout(seconds * part * 1000);
      await page.keyboard.up(key);
      await page.keyboard.up('Space');
      await page.keyboard.press('f');
      if (i === 1 || i === 4) await page.keyboard.press('q');
      if (i === 4) await page.keyboard.press('r');
      if (i === 2) {
        report.frames.push(await state(page));
        await page.screenshot({ path: path.join(dest, 'gameplay.png') });
      }
    }
    await page.waitForTimeout(seconds * .30 * 1000);
    // Software rendering can advance simulation more slowly than wall time.
    // Extend the real-input session to at least 20 simulation seconds while
    // the game remains active; an observed outcome legitimately ends play.
    const extensionStart = Date.now();
    while (Date.now() - extensionStart < 90000) {
      const progress = await state(page);
      if (progress.ended || (progress.playtime || progress.simulationSeconds || 0) >= minimumSim) break;
      await page.keyboard.down('a');
      await page.waitForTimeout(700);
      await page.keyboard.up('a');
      await page.keyboard.press('f');
      await page.keyboard.press('q');
      report.input.push({ key: 'a', milliseconds: 700, reason: 'Extend representative simulation time' });
    }
    report.frames.push(await state(page));
    await page.screenshot({ path: path.join(dest, 'highlight.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    report.pause = (await page.locator('body').innerText()).slice(0, 2500);
    await page.screenshot({ path: path.join(dest, 'pause.png') });
    report.completed = true;
  } catch (e) { report.failure = e.stack; report.completed = false; }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(dest, 'audit.json'), JSON.stringify(report, null, 2));
  await context.close();
  console.log(`${g.id}: ${report.completed ? 'captured' : 'FAILED'}; errors=${errors.length}; ${report.frames.at(-1)?.state}`);
  return report;
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: Number(args.workers || 2) }, async () => { while (next < selected.length) results.push(await audit(browser, selected[next++])); }));
  await browser.close();
  results.sort((a, b) => catalog.games.findIndex(g => g.id === a.id) - catalog.games.findIndex(g => g.id === b.id));
  fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(`AUDIT ${phase}: ${results.filter(r => r.completed).length}/${results.length} completed, ${results.reduce((n,r)=>n+r.errors.length,0)} page errors`);
  if (results.some(r=>!r.completed || r.errors.length)) process.exitCode = 1;
})();

