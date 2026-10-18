'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-038', 'closure-artifacts');
const index = Number(process.argv[2] || 0);
const makeExports = process.argv.includes('export');
const retentionLabel = process.argv.find((value) => value.startsWith('retain='))?.slice(7) || null;
const port = String(8871 + (index % 5));

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static-root.js'), ROOT, port], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server timeout')), 10000);
    server.stdout.on('data', (buffer) => {
      if (String(buffer).includes('listening on')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once('error', reject);
  });

  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const pageErrors = [];
  const consoleErrors = [];
  const externalRequests = [];
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith(`http://127.0.0.1:${port}`) && !url.startsWith('data:') && !url.startsWith('blob:')) externalRequests.push(url);
    });
    await page.goto(`http://127.0.0.1:${port}/editor/`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof tilemapChunks !== 'undefined' && OpusAuthoringPlumbing.TILEMAP_CHUNK_VERSION === 1, { timeout: 60000 });
    if (await page.locator('#first-run-overlay').isVisible()) await page.locator('#first-run-skip').click();

    const result = await page.evaluate(async ({ index, makeExports }) => {
      const ts = OpusAuthoringPlumbing.createTileset({ id: 'ts', name: 'Tiles', tiles: [{ id: 'a', name: 'A', spriteAssetRef: 'missing' }] });
      const source = OpusAuthoringPlumbing.createTilemapRecord({ id: 's', name: 'Source', tilesetRef: 'ts' });
      OpusAuthoringPlumbing.setTilemapCell(source, source.layers[0].id, -2, 3, 'a');
      OpusAuthoringPlumbing.createSpawnMarker(source, { name: 'Spawn', x: -2, y: 3 });
      const chunk = OpusAuthoringPlumbing.captureTilemapChunk(source, {
        id: 'c', name: 'Browser Chunk', from: { x: -2, y: 3 }, to: { x: -1, y: 4 },
        layerIds: [source.layers[0].id], includeSpawnMarkers: true, tileset: ts,
      });
      const target = OpusAuthoringPlumbing.createTilemapRecord({ id: 't', name: 'Target', tilesetRef: 'ts' });
      const plan = OpusAuthoringPlumbing.planTilemapChunkStamp(chunk, target, ts, { x: index, y: -index }, { [chunk.layers[0].id]: target.layers[0].id }, []);
      const before = JSON.stringify(target);
      OpusAuthoringPlumbing.commitTilemapChunkStamp(target, plan);
      const after = JSON.stringify(target);
      const previewCommitParity = JSON.stringify({
        layers: OpusAuthoringPlumbing.serializeTilemapLayers(target),
        spawnMarkers: OpusAuthoringPlumbing.canonicalizeSpawnMarkers(target.spawnMarkers),
      }) === JSON.stringify(plan.result);
      target.layers = OpusAuthoringPlumbing.createTilemapRecord(JSON.parse(before)).layers;
      target.spawnMarkers = OpusAuthoringPlumbing.createTilemapRecord(JSON.parse(before)).spawnMarkers;
      const undoParity = JSON.stringify(target) === before;
      const restored = OpusAuthoringPlumbing.createTilemapRecord(JSON.parse(after));
      const redoParity = JSON.stringify(restored) === after;
      let editable = null;
      let playable = null;
      if (makeExports) {
        tilemapChunks = [chunk];
        tilesets = [ts];
        placed.length = 0;
        placed.push(instantiateTilemapRecord({ ...restored, position: [0, 1, 0], scale: [1, 1, 1], rotationY: 0 }));
        editable = await buildExportHTML(false);
        playable = await buildExportHTML(true);
      }
      return {
        valid: plan.valid,
        previewCommitParity,
        undoParity,
        redoParity,
        editable,
        playable,
        materializedCells: OpusAuthoringPlumbing.tilemapCellCount(restored),
        materializedMarkers: restored.spawnMarkers.length,
      };
    }, { index, makeExports });

    assert(result.valid && result.previewCommitParity && result.undoParity && result.redoParity);
    assert.deepStrictEqual(pageErrors, []);
    assert.deepStrictEqual(consoleErrors, []);
    assert.deepStrictEqual(externalRequests, []);

    const report = {
      status: 'PASS', index, makeExports, retentionLabel,
      previewCommitParity: true, undoRedo: true, saveLoad: true,
      materializedCells: result.materializedCells,
      materializedMarkers: result.materializedMarkers,
      pageErrors, consoleErrors, externalRequests,
      editableBytes: result.editable ? result.editable.length : 0,
      playableBytes: result.playable ? result.playable.length : 0,
      editableRetainsChunks: result.editable ? result.editable.includes('Browser Chunk') && result.editable.includes('tilemapChunks') : null,
      playableStripsChunks: result.playable ? result.playable.includes('"tilemapChunks":[]') && !result.playable.includes('Browser Chunk') : null,
    };
    if (makeExports) {
      assert(report.editableRetainsChunks);
      assert(report.playableStripsChunks);
      if (retentionLabel) {
        fs.mkdirSync(QUAL, { recursive: true });
        const editablePath = path.join(QUAL, `${retentionLabel}-editable.html`);
        const playablePath = path.join(QUAL, `${retentionLabel}-playable.html`);
        fs.writeFileSync(editablePath, result.editable);
        fs.writeFileSync(playablePath, result.playable);
        report.retainedArtifacts = [path.relative(ROOT, editablePath), path.relative(ROOT, playablePath)];
      }
    }
    console.log(JSON.stringify(report));
  } finally {
    if (context) await context.close();
    await browser.close();
    server.kill();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
