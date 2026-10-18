'use strict';
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const fixture = require('../qualification/phase-046/phase-046-project.json');
const extended = process.env.PHASE046_EXTENDED_DOGFOOD === '1' ? require('../qualification/phase-046/phase-046-dogfood.json') : null;
const port = '8892';
async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, port], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('server timeout')), 10000); server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const report = { cycles: 0, pageErrors: [], consoleErrors: [], networkErrors: [], exports: {}, authoring: {} };
  try {
    for (let cycle = 0; cycle < Number(process.env.PHASE046_BROWSER_CYCLES || 20); cycle++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`cycle ${cycle + 1}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`cycle ${cycle + 1}: ${message.text()}`); });
      page.on('requestfailed', (request) => report.networkErrors.push(`cycle ${cycle + 1}: ${request.url()} ${request.failure()?.errorText || ''}`));
      await page.goto(`http://127.0.0.1:${port}/editor/`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof loadProjectFull === 'function' && !!globalThis.OpusOneWay2D);
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
      await page.evaluate((project) => loadProjectFull(project, 'Phase 046 browser audit'), fixture);
      const result = await page.evaluate(() => {
        const char = placed.find((item) => item.id === 'mover');
        const map = placed.find((item) => item.id === 'char-map');
        const scene = placed.find((item) => item.id === 'one-way-scene');
        const invisible = placed.find((item) => item.id === 'one-way-invisible');
        if (!char || !map || !scene || !invisible) throw Error('Phase 046 fixture failed to load');
        const beforePlay = [char.entity.position.x, char.entity.position.y, char.entity.position.z];
        enterPlayMode(); app.pause();
        function step(x, y, vx, vy, dt = .1) {
          char.entity.position.set(x, y, 0); char.components['body-2d'].linearVelocity = [vx, vy]; updateHierarchyTransforms();
          const move = body2DManager.tick(placed, dt, Array.from(body2DObjects)).find((entry) => entry.objectId === 'mover').result;
          return { x: char.entity.position.x, y: char.entity.position.y, state: getCharacterCollision2DState('mover'), move };
        }
        const sceneUp = step(0, -2, 0, 30), sceneDown = step(0, 5, 0, -100);
        char.components['body-2d'].linearVelocity = [0, 0]; body2DManager.tick(placed, .1, Array.from(body2DObjects));
        const standing = getCharacterCollision2DState('mover');
        char.components['body-2d'].linearVelocity = [-60, 0]; body2DManager.tick(placed, .1, Array.from(body2DObjects));
        const offEdge = getCharacterCollision2DState('mover');
        const tileUp = step(8.5, -1, 0, 30), tileDown = step(8.5, 5, 0, -100);
        const customDown = step(12.5, 5, 0, -100);
        exitPlayMode();
        const reset = getCharacterCollision2DState('mover');
        const restored = placed.find((item) => item.id === 'mover').entity.position;
        const restoredPosition = [restored.x, restored.y, restored.z];
        const saved = serializeProject({ includeTilesets: true });
        const savedComponent = saved.levels[0].objects.find((item) => item.id === 'one-way-scene').components['one-way-platform-2d'];
        const savedTile = saved.tilesets.find((set) => set.id === 'char-tiles').tiles.find((tile) => tile.id === 'one-way-full').collision;
        loadProjectFull(saved, 'Phase 046 save/reload');
        const reload = { scene: !!placed.find((item) => item.id === 'one-way-scene').components['one-way-platform-2d'], tile: tilesets.find((set) => set.id === 'char-tiles').tiles.find((tile) => tile.id === 'one-way-full').collision.oneWay };
        return { sceneUp, sceneDown, standing, offEdge, tileUp, tileDown, customDown, reset, beforePlay, restoredPosition, savedComponent, savedTile, reload, invisibleAlpha: invisible.entity.alpha };
      });
      assert(result.sceneUp.y > .9 && !result.sceneUp.state.ceiling, JSON.stringify(result));
      assert(Math.abs(result.sceneDown.y - 1) < 1e-3 && result.sceneDown.state.grounded, JSON.stringify(result));
      assert(result.standing.grounded && !result.offEdge.grounded && !result.offEdge.wallSliding, JSON.stringify(result));
      assert(result.tileUp.y > 1 && !result.tileUp.state.ceiling, JSON.stringify(result));
      assert(Math.abs(result.tileDown.y - 1.5) < 1e-3 && result.tileDown.state.grounded, JSON.stringify(result));
      assert(Math.abs(result.customDown.y - 1.1) < 1e-3 && result.customDown.state.grounded, JSON.stringify(result));
      assert(!result.reset.active && result.beforePlay.every((value, index) => value === result.restoredPosition[index]) && result.savedComponent.enabled && result.savedTile.oneWay && result.reload.scene && result.reload.tile && result.invisibleAlpha === 0, JSON.stringify(result));
      if (cycle === 0) {
        await page.evaluate(() => { selectItem(placed.find((item) => item.id === 'one-way-scene')); renderInspector(); });
        report.authoring.platformInspector = await page.locator('[data-schema-slot="one-way-platform-2d"]').innerText();
        assert(report.authoring.platformInspector.includes('Horizontal Surface: Ready'));
        report.authoring.selectedTopEdges = await page.locator('.one-way-top-edge').count();
        assert(report.authoring.selectedTopEdges > 0);
        report.authoring.paletteToggle = await page.evaluate(() => {
          openTilePalette('char-tiles'); activeTileId = 'one-way-full'; renderTilePalette();
          const tile = tilesets.find((set) => set.id === 'char-tiles').tiles.find((entry) => entry.id === 'one-way-full');
          const checkbox = document.querySelector('[data-tile-collision-one-way]');
          if (!checkbox?.checked || !document.querySelector('.tile-one-way-indicator')) throw Error('One-Way Tile Palette state missing');
          checkbox.click();
          if (tile.collision.oneWay || document.querySelector('.tile-one-way-indicator')) throw Error('One-Way Tile Palette disable failed');
          document.querySelector('[data-tile-collision-one-way]').click();
          if (!tile.collision.oneWay || !document.querySelector('.tile-one-way-indicator')) throw Error('One-Way Tile Palette restore failed');
          return true;
        });
        const exports = await page.evaluate(async () => ({ editable: await buildExportHTML(false), playable: await buildExportHTML(true) }));
        report.exports = { editableBytes: Buffer.byteLength(exports.editable), playableBytes: Buffer.byteLength(exports.playable), editableModule: exports.editable.includes('OpusOneWay2D'), playableModule: exports.playable.includes('OpusOneWay2D') };
        assert(report.exports.editableModule && report.exports.playableModule);
        for (const kind of ['editable', 'playable']) {
          const exported = await context.newPage();
          exported.on('pageerror', (error) => report.pageErrors.push(`${kind} export: ${error.message}`));
          await exported.route(`**/phase-046-${kind}-preview.html`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: exports[kind] }));
          await exported.goto(`http://127.0.0.1:${port}/phase-046-${kind}-preview.html`, { waitUntil: 'load' });
          await exported.waitForFunction(() => typeof OpusOneWay2D === 'object' && typeof getCharacterCollision2DState === 'function' && placed.some((item) => item.id === 'mover'));
          const state = await exported.evaluate(() => {
            const char = placed.find((item) => item.id === 'mover');
            char.entity.position.set(8.5, -1, 0); char.components['body-2d'].linearVelocity = [0, 30]; updateHierarchyTransforms();
            body2DManager.tick(placed, .1, Array.from(body2DObjects));
            const up = { y: char.entity.position.y, contact: getCharacterCollision2DState('mover') };
            char.entity.position.set(8.5, 5, 0); char.components['body-2d'].linearVelocity = [0, -100]; updateHierarchyTransforms();
            body2DManager.tick(placed, .1, Array.from(body2DObjects));
            return { up, down: { y: char.entity.position.y, contact: getCharacterCollision2DState('mover') } };
          });
          assert(state.up.y > 1 && !state.up.contact.ceiling, JSON.stringify(state));
          assert(Math.abs(state.down.y - 1.5) < 1e-3 && state.down.contact.grounded, JSON.stringify(state));
          report.exports[`${kind}PassedUp`] = true;
          report.exports[`${kind}Landed`] = true;
          await exported.close();
        }
        if (extended) {
          await page.evaluate((project) => loadProjectFull(project, 'Phase 046 extended dogfood'), extended);
          report.extended = await page.evaluate(() => ({ objects: placed.length, cells: placed.find((item) => item.id === 'scale-map').layers[0].cells.length, oneWayCells: placed.find((item) => item.id === 'scale-map').layers[0].cells.filter((cell) => cell.tileId === 'one-way-scale').length }));
          assert(report.extended.cells === 10240 && report.extended.oneWayCells > 1000);
        }
      }
      report.cycles++;
      await context.close();
    }
    assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.networkErrors, []);
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); server.kill(); }
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
