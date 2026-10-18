'use strict';
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ROOT = path.resolve(__dirname, '..');
const QUAL = path.join(ROOT, 'qualification', 'phase-040');
const p = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const format = require(path.join(ROOT, 'editor/src/00-tilemap-bundle.js'));
const project = require(path.join(ROOT, 'phase-040-10k-project.json'));
const tilemap = project.levels[0].objects.find((o) => o.kind === 'tilemap');
const tileset = project.tilesets[0];
const clone = (v) => JSON.parse(JSON.stringify(v));
const q = (values, percentile) => { const sorted = values.slice().sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile))]; };
const stats = (values) => ({ samples: values.length, medianMs: q(values, .5), p95Ms: q(values, .95), p99Ms: q(values, .99), maxMs: Math.max(...values) });
const time = (fn) => { const start = performance.now(); const value = fn(); return { value, ms: performance.now() - start }; };

async function main() {
  fs.mkdirSync(QUAL, { recursive: true });
  const scaling = {};
  for (const count of [1000, 2500, 5000, 10240]) {
    const sample = p.createTilemapRecord({ ...tilemap, layers: [{ ...tilemap.layers[0], cells: tilemap.layers.flatMap((l) => l.cells).slice(0, count) }] });
    const validation = time(() => p.validateTilemapRecord(sample, tileset));
    const index = time(() => { for (const cell of sample.layers[0].cells) p.getTilemapCell(sample, sample.layers[0].id, cell.x, cell.y); });
    const normalization = time(() => p.serializeTilemapLayers(sample));
    scaling[count] = { validationMs: validation.ms, indexWalkMs: index.ms, normalizationMs: normalization.ms, issues: validation.value.length };
  }
  const editMap = p.createTilemapRecord(tilemap); const layer = editMap.layers[0]; const paint = []; const erase = [];
  for (let i = 0; i < 1000; i++) { let t = performance.now(); p.setTilemapCell(editMap, layer.id, 200 + i, 200, `tile-${i % 28}`); paint.push(performance.now() - t); t = performance.now(); p.eraseTilemapCell(editMap, layer.id, 200 + i, 200); erase.push(performance.now() - t); }
  const terrainMap = p.createTilemapRecord(tilemap);
  const r8cells = p.terrainFootprintCells(0, 0, 'circle', 8); const terrainR8 = time(() => p.paintTerrainCells(terrainMap, terrainMap.layers[0].id, r8cells, tileset, 'meadow'));
  const autoLine = time(() => { for (let x = 300; x < 800; x++) p.paintAutoTileCell(terrainMap, terrainMap.layers[1].id, x, 300, tileset, 'roads'); });
  const terrainSeed = time(() => { tileset.terrainBrushes.find((b) => b.id === 'meadow').seed++; p.recomputeProjectTerrain({ levels: [{ objects: [terrainMap] }], tilesets: [tileset] }, 'meadow'); });
  const autoRule = time(() => { tileset.autoTileSets[0].rules[0].tileId = 'tile-1'; p.recomputeProjectAutoTiles({ levels: [{ objects: [terrainMap] }], tilesets: [tileset] }, 'roads'); });
  const mapping = Object.fromEntries(project.tilemapChunks[0].layers.map((l, i) => [l.id, tilemap.layers[i].id]));
  const plan = time(() => p.planTilemapChunkStamp(project.tilemapChunks[0], tilemap, tileset, { x: 500, y: 500 }, mapping, project.prefabs));
  const stampTarget = p.createTilemapRecord(tilemap); const stampPlan = p.planTilemapChunkStamp(project.tilemapChunks[0], stampTarget, tileset, { x: 500, y: 500 }, mapping, project.prefabs); const beforeStamp = clone(stampTarget); const commit = time(() => p.commitTilemapChunkStamp(stampTarget, stampPlan)); const undo = time(() => Object.assign(stampTarget, clone(beforeStamp)));
  const save = []; const load = []; const validate = [];
  for (let i = 0; i < 20; i++) { let t = performance.now(); const text = JSON.stringify(project); save.push(performance.now() - t); t = performance.now(); const loaded = JSON.parse(text); load.push(performance.now() - t); t = performance.now(); p.validateTilemapRecord(loaded.levels[0].objects[0], loaded.tilesets[0]); validate.push(performance.now() - t); }
  const bundleExport = []; const bundleImport = []; const bundleText = fs.readFileSync(path.join(ROOT, 'phase-040-10k.opus-tilemap.json'), 'utf8'); const verified = await format.verifyBundleText(bundleText);
  const freshProject = JSON.parse(fs.readFileSync(path.join(ROOT, 'phase-040-10k-project.json'), 'utf8')); const freshRoot = freshProject.levels[0].objects.find((o) => o.kind === 'tilemap');
  const bundleProject = { tilesets: freshProject.tilesets, spriteAssets: freshProject.spriteAssets, textures: freshProject.textures, prefabs: freshProject.prefabs, meshAssets: freshProject.assets, audio: freshProject.audio, spriteAnimations: freshProject.spriteAnimations, sortingLayers: freshProject.spriteSortingLayers, tilemapChunks: freshProject.tilemapChunks };
  for (let i = 0; i < 20; i++) { let t = performance.now(); const out = await format.createBundle({ rootKind: 'tilemap', root: freshRoot, project: bundleProject }); bundleExport.push(performance.now() - t); if (out.text !== bundleText) throw new Error('deterministic bundle mismatch'); if (i < 10) { t = performance.now(); format.materializeImport(format.planImport(verified, {}), {}); bundleImport.push(performance.now() - t); } }
  const memory = process.memoryUsage();
  const report = { phase: 40, environment: { platform: process.platform, arch: process.arch, node: process.version, cpu: require('os').cpus()[0].model, logicalCpus: require('os').cpus().length, totalMemory: require('os').totalmem() }, fixture: require(path.join(ROOT, 'phase-040-dogfood.json')), scaling, operations: { paint: stats(paint), erase: stats(erase), terrainCircleR8: { affectedCells: r8cells.length, totalMs: terrainR8.ms }, autoTileLine500: { totalMs: autoLine.ms }, terrainGlobalRecompute: { totalMs: terrainSeed.ms }, autoRuleGlobalRecompute: { totalMs: autoRule.ms }, chunkPlan: { totalMs: plan.ms, changedCells: plan.value.changedCells.length }, chunkCommit: { totalMs: commit.ms }, chunkUndo: { totalMs: undo.ms }, save: stats(save), loadParse: stats(load), validation: stats(validate), bundleExport: stats(bundleExport), bundleImportPlanCommit: stats(bundleImport), bundleBytes: Buffer.byteLength(bundleText) }, memory: { rss: memory.rss, heapUsed: memory.heapUsed }, status: 'PASS' };
  fs.writeFileSync(path.join(ROOT, 'phase-040-performance.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(QUAL, 'node-performance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Phase 040 Node performance: PASS; paint p95 ${report.operations.paint.p95Ms.toFixed(3)} ms; bundle export p95 ${report.operations.bundleExport.p95Ms.toFixed(1)} ms`);
}
main().catch((error) => { console.error(error); process.exit(1); });
