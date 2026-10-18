'use strict';
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const fixture = require('../qualification/phase-045/phase-045-project.json');
const extendedDogfood = process.env.PHASE045_EXTENDED_DOGFOOD === '1' ? require('../qualification/phase-045/phase-045-dogfood.json') : null;
const port = '8891';
async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, port], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('server timeout')), 10000); server.stdout.on('data', (data) => { if (String(data).includes('listening on')) { clearTimeout(timer); resolve(); } }); server.once('error', reject); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const report = { cycles: 0, pageErrors: [], consoleErrors: [], networkErrors: [], characterStates: [], exports: {} };
  try {
    for (let cycle = 0; cycle < Number(process.env.PHASE045_BROWSER_CYCLES || 20); cycle++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(`cycle ${cycle + 1}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`cycle ${cycle + 1}: ${message.text()}`); });
      page.on('requestfailed', (request) => report.networkErrors.push(`cycle ${cycle + 1}: ${request.url()} ${request.failure()?.errorText || ''}`));
      await page.goto(`http://127.0.0.1:${port}/editor/`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof loadProjectFull === 'function' && !!globalThis.OpusCharacterTileQuery);
      if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();
      await page.evaluate((project) => loadProjectFull(project, 'Phase 045 browser audit'), fixture);
      const result = await page.evaluate(() => {
        const char = placed.find((item) => item.id === 'mover');
        const map = placed.find((item) => item.id === 'char-map');
        if (!char || !map) throw Error('fixture failed to load');
        enterPlayMode(); app.pause();
        const child = placed.find((item) => item.id === 'parented-character');
        const parentedBefore = { worldX: child.entity.position.x, worldY: child.entity.position.y, localX: child.localPosition.x, localY: child.localPosition.y };
        body2DManager.moveCharacter2D(child, { x: .1, y: 0 }, .1, []);
        const parentedDelta = { worldX: child.entity.position.x - parentedBefore.worldX, worldY: child.entity.position.y - parentedBefore.worldY,
          localX: child.localPosition.x - parentedBefore.localX, localY: child.localPosition.y - parentedBefore.localY };
        char.entity.position.set(0, 5, 0); updateHierarchyTransforms();
        body2DManager.tick(placed, .1, Array.from(body2DObjects));
        const wallState = getCharacterCollision2DState('mover');
        const wallPosition = { x: char.entity.position.x, y: char.entity.position.y };
        char.entity.position.set(-4.5, 3, 0); char.components['body-2d'].linearVelocity = [0, -20]; updateHierarchyTransforms();
        body2DManager.tick(placed, .1, Array.from(body2DObjects));
        const floorState = getCharacterCollision2DState('mover');
        const floorPosition = { x: char.entity.position.x, y: char.entity.position.y };
        exitPlayMode();
        const reset = getCharacterCollision2DState('mover');
        const restoredPosition = { x: char.entity.position.x, y: char.entity.position.y };
        const restoredVelocity = char.components['body-2d'].linearVelocity.slice();
        const saved = serializeProject({ includeTilesets: true });
        const savedCharacter = !!saved.levels?.[0]?.objects?.find((o) => o.id === 'mover')?.components?.['character-collision-2d'];
        const savedLayer = saved.levels?.[0]?.objects?.find((o) => o.id === 'char-map')?.layers?.[0]?.collisionEnabled;
        loadProjectFull(saved, 'Phase 045 save/reload cycle');
        return { wallState, wallPosition, floorState, floorPosition, parentedDelta, reset, restoredPosition, restoredVelocity, savedCharacter, savedLayer,
          reloadedCharacter: !!placed.find((o) => o.id === 'mover')?.components?.['character-collision-2d'],
          reloadedLayer: placed.find((o) => o.id === 'char-map')?.layers?.[0]?.collisionEnabled };
      });
      assert(result.wallState.wallSliding && result.wallState.wallRight, JSON.stringify(result));
      assert(Math.abs(result.wallPosition.y - 4.7) < 1e-3, JSON.stringify(result));
      assert(result.floorState.grounded && !result.floorState.wallSliding, JSON.stringify(result));
      assert(Math.abs(result.floorPosition.y - 1.5) < 1e-3, JSON.stringify(result));
      assert(!result.reset.active && result.savedCharacter && result.savedLayer === true && result.reloadedCharacter && result.reloadedLayer === true, JSON.stringify(result));
      assert(Math.abs(result.restoredPosition.x) < 1e-8 && Math.abs(result.restoredPosition.y - 5) < 1e-8 && result.restoredVelocity[0] === 30, JSON.stringify(result));
      assert(Math.abs(result.parentedDelta.worldX - .1) < 1e-5 && Math.abs(result.parentedDelta.worldY) < 1e-5 && Math.abs(result.parentedDelta.localY) > 1e-5, JSON.stringify(result));
      if (cycle === 0) {
        await page.evaluate(() => { selectItem(placed.find((item) => item.id === 'mover')); renderInspector(); });
        report.authoring = { inspector: await page.locator('[data-schema-slot="character-collision-2d"]').count(), requirements: await page.locator('[data-schema-slot="character-collision-2d"]').innerText() };
        await page.evaluate(() => { const map = placed.find((item) => item.id === 'char-map'); selectItem(map); selectTilemapLayer(map, 'floor'); renderInspector(); });
        const layerToggle = page.locator('#tilemap-layer-collision-enabled');
        assert(await layerToggle.isChecked()); await layerToggle.uncheck();
        assert.strictEqual(await page.evaluate(() => placed.find((item) => item.id === 'char-map').layers[0].collisionEnabled), false);
        await page.evaluate(() => undo());
        assert.strictEqual(await page.evaluate(() => placed.find((item) => item.id === 'char-map').layers[0].collisionEnabled), true);
        report.authoring.layerToggleUndo = true;
        const exports = await page.evaluate(async () => ({ editable: await buildExportHTML(false), playable: await buildExportHTML(true) }));
        report.exports = { editableBytes: Buffer.byteLength(exports.editable), playableBytes: Buffer.byteLength(exports.playable), editableModule: exports.editable.includes('OpusCharacterTileQuery'), playableModule: exports.playable.includes('OpusCharacterTileQuery') };
        assert(report.exports.editableModule && report.exports.playableModule);
        for (const kind of ['editable', 'playable']) {
          const exportedPage = await context.newPage();
          exportedPage.on('pageerror', (error) => report.pageErrors.push(`${kind} export: ${error.message}`));
          await exportedPage.route(`**/phase-045-${kind}-preview.html`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: exports[kind] }));
          await exportedPage.goto(`http://127.0.0.1:${port}/phase-045-${kind}-preview.html`, { waitUntil: 'load' });
          await exportedPage.waitForFunction(() => typeof OpusCharacterTileQuery === 'object' && typeof getCharacterCollision2DState === 'function' && placed.some((item) => item.id === 'mover'));
          const state = await exportedPage.evaluate(() => {
            const char = placed.find((item) => item.id === 'mover'); char.entity.position.set(-4.5, 1.5, 0); char.components['body-2d'].linearVelocity = [0, -20]; updateHierarchyTransforms();
            body2DManager.tick(placed, .1, Array.from(body2DObjects)); return getCharacterCollision2DState('mover');
          });
          report.exports[`${kind}Grounded`] = state.grounded;
          assert(state.grounded, JSON.stringify(state));
          await exportedPage.close();
        }
        if (extendedDogfood) {
          await page.evaluate((project) => loadProjectFull(project, 'Phase 045 extended dogfood'), extendedDogfood);
          report.extendedDogfood = await page.evaluate(() => {
            const scale = placed.find((item) => item.id === 'scale-map');
            const mover = placed.find((item) => item.id === 'mover');
            enterPlayMode(); app.pause(); mover.entity.position.set(-4.5, 1.5, 0); mover.components['body-2d'].linearVelocity = [0, -20]; updateHierarchyTransforms();
            const before = body2DManager.metrics.candidates;
            body2DManager.tick(placed, .1, Array.from(body2DObjects));
            const result = { objects: placed.length, populatedCells: scale.layers[0].cells.length, grounded: getCharacterCollision2DState('mover').grounded,
              bodyCandidates: body2DManager.metrics.candidates - before };
            exitPlayMode(); return result;
          });
          assert(report.extendedDogfood.objects === 10 && report.extendedDogfood.populatedCells === 10240 && report.extendedDogfood.grounded, JSON.stringify(report.extendedDogfood));
        }
      }
      report.characterStates.push({ wall: result.wallState, floor: result.floorState });
      report.cycles++;
      await context.close();
    }
    assert.deepStrictEqual(report.pageErrors, []); assert.deepStrictEqual(report.consoleErrors, []); assert.deepStrictEqual(report.networkErrors, []);
    console.log(JSON.stringify({ ...report, characterStates: report.characterStates.slice(0, 1) }, null, 2));
  } finally { await browser.close(); server.kill(); }
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
