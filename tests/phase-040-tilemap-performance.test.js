'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ROOT = path.resolve(__dirname, '..');
const p = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const bundle = require(path.join(ROOT, 'editor/src/00-tilemap-bundle.js'));
const project = require(path.join(ROOT, 'phase-040-10k-project.json'));
const proof = require(path.join(ROOT, 'phase-040-dogfood.json'));
const tilemap = project.levels[0].objects.find((o) => o.kind === 'tilemap');
const tileset = project.tilesets[0];
let passed = 0; let failed = 0; const tasks = [];
function test(name, fn) { tasks.push(Promise.resolve().then(fn).then(() => { passed++; console.log(`  PASS ${name}`); }, (error) => { failed++; console.error(`  FAIL ${name}: ${error.stack || error}`); })); }
function allCells() { return tilemap.layers.flatMap((l) => l.cells); }

test('canonical fixture has 10,240 simultaneous populated Cells', () => assert.strictEqual(allCells().length, 10240));
test('canonical fixture uses four real Layers', () => assert.strictEqual(tilemap.layers.length, 4));
test('every Layer has a stable identity and populated sparse records', () => assert(tilemap.layers.every((l) => l.id && l.cells.length === 2560)));
test('semantic mix contains Manual Cells', () => assert.strictEqual(proof.semantic.manual, 3584));
test('semantic mix contains direct Auto-Tile Cells', () => assert.strictEqual(proof.semantic.autoTile, 2048));
test('semantic mix contains weighted Terrain Cells', () => assert.strictEqual(proof.semantic.weightedTerrain, 3072));
test('semantic mix contains Auto-Terrain Cells', () => assert.strictEqual(proof.semantic.autoTerrain, 1536));
test('world crosses negative X and Y', () => assert(proof.coordinateRange.minX < 0 && proof.coordinateRange.minY < 0));
test('Tileset has 32 distinct Tiles', () => assert.strictEqual(new Set(tileset.tiles.map((t) => t.id)).size, 32));
test('filtering includes Nearest and Smooth', () => assert(proof.nearestTiles && proof.smoothTiles));
test('collision metadata includes all three qualified modes', () => assert(Object.values(proof.collision).every((n) => n > 0)));
test('100 Spawn Markers coexist', () => assert.strictEqual(tilemap.spawnMarkers.length, 100));
test('75 ordinary Prefab objects coexist outside Tilemap records', () => assert.strictEqual(project.levels[0].objects.filter((o) => o.sourcePrefabName).length, 75));
test('Chunk fixture contains exactly 1,000 Cells', () => assert.strictEqual(p.tilemapChunkCellCount(project.tilemapChunks[0]), 1000));
test('Tilemap validates cleanly', () => assert.deepStrictEqual(p.validateTilemapRecord(tilemap, tileset), []));
test('Chunk validates cleanly', () => assert.deepStrictEqual(p.validateTilemapChunk(project.tilemapChunks[0], tileset, project.prefabs), []));
test('O(1) index returns known Cell', () => { const c = tilemap.layers[0].cells[1234]; assert.strictEqual(p.getTilemapCell(tilemap, tilemap.layers[0].id, c.x, c.y).tileId, c.tileId); });
test('single Cell set and erase preserve the 10k index', () => { const copy = p.createTilemapRecord(tilemap); const layer = copy.layers[0]; const before = layer.cells.length; assert(p.setTilemapCell(copy, layer.id, 500, 500, 'tile-1').changed); assert(p.eraseTilemapCell(copy, layer.id, 500, 500).changed); assert.strictEqual(layer.cells.length, before); });
test('Save/load JSON round-trip preserves Cell count and semantics', () => { const copy = JSON.parse(JSON.stringify(project)); const map = copy.levels[0].objects.find((o) => o.kind === 'tilemap'); assert.strictEqual(map.layers.flatMap((l) => l.cells).length, 10240); assert.strictEqual(map.spawnMarkers.length, 100); });
test('renderer source uses transient batch caches', () => { const source = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8'); assert(source.includes('_tilemapBatchCaches')); assert(source.includes('_buildTilemapBatchCache')); });
test('steady Tilemap renderer no longer loops one draw per Cell', () => { const source = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8'); const start = source.lastIndexOf('_drawTilemapEntity(entity)'); const body = source.slice(start, source.indexOf('renderTerrain(', start)); assert(body.includes('for (const batch of cache.batches)')); assert(!body.includes('for (const cell of cells)')); });
test('cache invalidates by renderer revision and disposes old buffers', () => { const source = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8'); assert(source.includes('cache.renderer !== renderer')); assert(source.includes('_destroyTilemapBatchCache(cache)')); });
test('deleted Tilemaps are swept from GPU cache', () => { const source = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8'); assert(source.includes('liveTilemaps')); assert(source.includes('this._tilemapBatchCaches.delete(entity)')); });
test('batch geometry keeps entity Transform in one model uniform', () => { const source = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8'); assert(source.includes('entity.modelMatrix.m')); });
test('batch size respects Uint16 vertex limit', () => { const source = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8'); assert(source.includes('end - start < 16383')); });
test('Playable export still strips authoring semantics', () => { const source = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8'); assert(source.includes("{ x: cell.x, y: cell.y, tileId: cell.tileId }")); });
test('portable 10k Bundle verifies and imports atomically', async () => { const text = fs.readFileSync(path.join(ROOT, 'phase-040-10k.opus-tilemap.json'), 'utf8'); const verified = await bundle.verifyBundleText(text); const state = bundle.materializeImport(bundle.planImport(verified, {}), {}); assert.strictEqual(state.tilemaps[0].layers.flatMap((l) => l.cells).length, 10240); });
test('portable 10k Bundle clean re-export is byte-identical', async () => { const text = fs.readFileSync(path.join(ROOT, 'phase-040-10k.opus-tilemap.json'), 'utf8'); const verified = await bundle.verifyBundleText(text); const state = bundle.materializeImport(bundle.planImport(verified, {}), {}); const out = await bundle.createBundle({ rootKind: 'tilemap', root: state.tilemaps[0], project: state }); assert.strictEqual(out.text, text); });
test('10k validation remains bounded on this host', () => { const start = performance.now(); p.validateTilemapRecord(tilemap, tileset); assert(performance.now() - start < 2000); });
test('Phase 041 collider components are absent', () => { const source = fs.readFileSync(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'), 'utf8'); assert(!source.includes("'2d-collider'")); });

Promise.all(tasks).then(() => { console.log(`Phase 040 Tilemap performance: ${passed}/${passed + failed} passed`); if (failed) process.exitCode = 1; });
