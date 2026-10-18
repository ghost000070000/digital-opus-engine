'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const p = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const tests = []; const test = (name, fn) => tests.push({ name, fn });
const tileset = p.createTileset({ id: 'ts', name: 'World', cellSize: { width: 1, height: 1 }, tiles: [
  { id: 'grass-a', name: 'Grass A', spriteAssetRef: 's1' }, { id: 'grass-b', name: 'Grass B', spriteAssetRef: 's2' }, { id: 'road', name: 'Road', spriteAssetRef: 's3' }, { id: 'wall', name: 'Wall', spriteAssetRef: 's4' },
], autoTileSets: [{ id: 'road-set', name: 'Road Set', neighborMode: 'four-way', defaultTileId: 'road', rules: [{ mask: 0, tileId: 'road' }, { mask: 2, tileId: 'wall' }, { mask: 8, tileId: 'wall' }, { mask: 10, tileId: 'grass-a' }] }], terrainBrushes: [{ id: 'grass', name: 'Grass', mode: 'weighted-tiles', seed: 7, variants: [{ tileId: 'grass-a', weight: 1 }, { tileId: 'grass-b', weight: 1 }] }, { id: 'connected', name: 'Connected', mode: 'auto-tile', seed: 0, autoTileSetId: 'road-set', variants: [] }] });
function sourceMap() { return p.createTilemapRecord({ id: 'source', name: 'Source', tilesetRef: 'ts', layers: [
  { id: 'ground', name: 'Ground', cells: [{ x: -2, y: 3, tileId: 'grass-a' }, { x: -1, y: 3, tileId: 'grass-b', terrainBrushId: 'grass' }, { x: 0, y: 3, tileId: 'road', autoTileSetId: 'road-set' }] },
  { id: 'details', name: 'Details', visible: false, locked: true, cells: [{ x: -2, y: 4, tileId: 'road', terrainBrushId: 'connected', autoTileSetId: 'road-set' }] },
], spawnMarkers: [{ id: 'enemy', name: 'Enemy Spawn', x: -1, y: 4, prefabRef: 'Enemy' }] }); }
function chunk() { return p.captureTilemapChunk(sourceMap(), { id: 'room', name: 'Room', from: { x: 0, y: 5 }, to: { x: -2, y: 3 }, layerIds: ['ground', 'details'], includeSpawnMarkers: true, tileset }); }
function target(extra = {}) { return p.createTilemapRecord({ id: 'target', name: 'Target', tilesetRef: 'ts', layers: [{ id: 'terrain', name: 'Terrain', cells: [] }, { id: 'details-target', name: 'Details Target', cells: [] }], ...extra }); }
const mapping = { 'chunk-ground': 'terrain', 'chunk-details': 'details-target' };

test('registered Asset type exists', () => assert.strictEqual(p.assetTypes.get('tilemap-chunk').displayName, 'Tilemap Chunk'));
test('Asset type is World Building', () => assert.strictEqual(p.assetTypes.get('tilemap-chunk').category, 'World Building'));
test('schema version is one', () => assert.strictEqual(p.TILEMAP_CHUNK_VERSION, 1));
test('capture creates stable Asset type', () => assert.strictEqual(chunk().type, 'tilemap-chunk'));
test('capture retains stable Asset ID', () => assert.strictEqual(chunk().id, 'room'));
test('capture retains Tileset ID', () => assert.strictEqual(chunk().tilesetRef, 'ts'));
test('reversed drag normalizes width', () => assert.strictEqual(chunk().width, 3));
test('reversed drag normalizes height', () => assert.strictEqual(chunk().height, 3));
test('negative source coordinate becomes zero', () => assert(chunk().layers[0].cells.some(c => c.x === 0 && c.y === 0)));
test('positive relative coordinate is retained', () => assert(chunk().layers[1].cells.some(c => c.x === 0 && c.y === 1)));
test('capture retains selected hidden Layer', () => assert.strictEqual(chunk().layers[1].name, 'Details'));
test('capture strips visibility state', () => assert.strictEqual(chunk().layers[1].visible, undefined));
test('capture strips lock state', () => assert.strictEqual(chunk().layers[1].locked, undefined));
test('Chunk Layer IDs are local', () => assert(chunk().layers.every(l => l.id.startsWith('chunk-'))));
test('Chunk Layer order stays bottom to top', () => assert.deepStrictEqual(chunk().layers.map(l => l.name), ['Ground', 'Details']));
test('manual semantics survive capture', () => assert.strictEqual(chunk().layers[0].cells[0].terrainBrushId, undefined));
test('weighted Terrain identity survives capture', () => assert(chunk().layers[0].cells.some(c => c.terrainBrushId === 'grass')));
test('direct Auto-Tile identity survives capture', () => assert(chunk().layers[0].cells.some(c => c.autoTileSetId === 'road-set')));
test('Auto-Terrain identity survives capture', () => assert(chunk().layers[1].cells.some(c => c.terrainBrushId === 'connected' && c.autoTileSetId === 'road-set')));
test('marker capture is optional and defaults off', () => assert.strictEqual(p.captureTilemapChunk(sourceMap(), { from: { x: -2, y: 3 }, to: { x: 0, y: 5 }, layerIds: ['ground'] }).spawnMarkers.length, 0));
test('marker capture makes relative coordinates', () => assert.deepStrictEqual([chunk().spawnMarkers[0].x, chunk().spawnMarkers[0].y], [1, 1]));
test('marker template retains Prefab reference', () => assert.strictEqual(chunk().spawnMarkers[0].prefabRef, 'Enemy'));
test('empty capture is rejected', () => assert.strictEqual(p.captureTilemapChunk(sourceMap(), { from: { x: 100, y: 100 }, to: { x: 101, y: 101 }, layerIds: ['ground'] }), null));
test('marker-only capture is accepted', () => assert(p.captureTilemapChunk(sourceMap(), { from: { x: -1, y: 4 }, to: { x: -1, y: 4 }, layerIds: [], includeSpawnMarkers: true })));
test('holes are represented by sparse absence', () => assert(p.tilemapChunkCellCount(chunk()) < chunk().width * chunk().height * chunk().layers.length));
test('canonical cells sort Y then X', () => { const c = chunk().layers[0].cells; assert(c.every((v, i) => !i || c[i - 1].y < v.y || (c[i - 1].y === v.y && c[i - 1].x <= v.x))); });
test('capture direction is deterministic', () => { const a = chunk(); const b = p.captureTilemapChunk(sourceMap(), { id: 'room', name: 'Room', from: { x: -2, y: 3 }, to: { x: 0, y: 5 }, layerIds: ['ground', 'details'], includeSpawnMarkers: true, tileset }); assert.deepStrictEqual(a, b); });
test('duplicate is deep independent', () => { const a = chunk(); const b = p.duplicateTilemapChunk(a, 'copy', 'Copy'); b.layers[0].cells[0].tileId = 'wall'; assert.notStrictEqual(a.layers[0].cells[0].tileId, b.layers[0].cells[0].tileId); });
test('duplicate receives new top identity', () => assert.strictEqual(p.duplicateTilemapChunk(chunk(), 'copy', 'Copy').id, 'copy'));
test('unique Asset IDs are collision safe', () => assert.strictEqual(p.uniqueTilemapChunkId([{ id: 'room' }], 'room'), 'room-2'));
test('unique names are collision safe', () => assert.strictEqual(p.uniqueTilemapChunkName([{ id: 'a', name: 'Room' }], 'Room'), 'Room 2'));
test('validation accepts a valid Chunk', () => assert.deepStrictEqual(p.validateTilemapChunk(chunk(), tileset, [{ name: 'Enemy' }]), []));
test('validation rejects unsupported version', () => assert(p.validateTilemapChunk({ ...chunk(), version: 2 }, tileset, [{ name: 'Enemy' }]).some(x => x.code === 'tilemap-chunk-version-unsupported')));
test('validation rejects zero width', () => assert(p.validateTilemapChunk({ ...chunk(), width: 0 }, tileset, [{ name: 'Enemy' }]).some(x => x.code === 'tilemap-chunk-bounds-invalid')));
test('validation rejects out of bounds cells', () => { const c = chunk(); c.layers[0].cells[0].x = 99; assert(p.validateTilemapChunk(c, tileset, [{ name: 'Enemy' }]).some(x => x.code === 'tilemap-chunk-cell-out-of-bounds')); });
test('validation rejects duplicate Layer IDs', () => { const c = chunk(); c.layers[1].id = c.layers[0].id; assert(p.validateTilemapChunk(c, tileset, [{ name: 'Enemy' }]).some(x => x.code === 'duplicate-tilemap-chunk-layer-id')); });
test('validation rejects missing Tile', () => { const c = chunk(); c.layers[0].cells[0].tileId = 'gone'; assert(p.validateTilemapChunk(c, tileset, [{ name: 'Enemy' }]).some(x => x.code === 'tilemap-chunk-missing-tile')); });
test('validation rejects missing Auto Set', () => { const c = chunk(); c.layers[0].cells[0].autoTileSetId = 'gone'; assert(p.validateTilemapChunk(c, tileset, [{ name: 'Enemy' }]).some(x => x.code === 'tilemap-chunk-missing-auto-tile-set')); });
test('validation rejects missing Terrain Brush', () => { const c = chunk(); c.layers[0].cells[0].terrainBrushId = 'gone'; assert(p.validateTilemapChunk(c, tileset, [{ name: 'Enemy' }]).some(x => x.code === 'tilemap-chunk-missing-terrain-brush')); });
test('validation rejects missing marker Prefab', () => assert(p.validateTilemapChunk(chunk(), tileset, []).some(x => x.code === 'tilemap-chunk-missing-prefab')));
test('dependencies include Tileset', () => assert(p.tilemapChunkDependencies(chunk()).some(x => x.assetType === 'tileset' && x.id === 'ts')));
test('dependencies include marker Prefab', () => assert(p.tilemapChunkDependencies(chunk()).some(x => x.assetType === 'prefab' && x.id === 'Enemy')));
test('single Layer suggestion uses active target Layer', () => { const c = chunk(); c.layers = [c.layers[0]]; assert.strictEqual(p.suggestTilemapChunkLayerMapping(c, target(), 'details-target')[c.layers[0].id], 'details-target'); });
test('exact-name mapping is suggestion', () => { const c = chunk(); const t = target({ layers: [{ id: 'g', name: 'Ground', cells: [] }] }); assert.strictEqual(p.suggestTilemapChunkLayerMapping(c, t)[c.layers[0].id], 'g'); });
test('ambiguous names do not map', () => { const c = chunk(); c.layers = [c.layers[0]]; const t = target({ layers: [{ id: 'a', name: 'Ground', cells: [] }, { id: 'b', name: 'Ground', cells: [] }] }); assert.strictEqual(p.suggestTilemapChunkLayerMapping(c, t)[c.layers[0].id], null); });
test('duplicate target mapping is prohibited', () => assert(p.validateTilemapChunkLayerMapping(chunk(), target(), { 'chunk-ground': 'terrain', 'chunk-details': 'terrain' }).some(x => x.code === 'tilemap-chunk-layer-mapping-duplicate')));
test('locked target Layer is prohibited', () => { const t = target(); t.layers[0].locked = true; assert(p.validateTilemapChunkLayerMapping(chunk(), t, mapping).some(x => x.code === 'tilemap-chunk-target-layer-locked')); });
test('hidden target Layer is prohibited', () => { const t = target(); t.layers[0].visible = false; assert(p.validateTilemapChunkLayerMapping(chunk(), t, mapping).some(x => x.code === 'tilemap-chunk-target-layer-hidden')); });
test('cross-Tileset stamp is blocked', () => { const t = target(); t.tilesetRef = 'other'; assert(!p.planTilemapChunkStamp(chunk(), t, tileset, { x: 0, y: 0 }, mapping, [{ name: 'Enemy' }]).valid); });
test('dry run does not mutate target', () => { const t = target(); const before = JSON.stringify(t); p.planTilemapChunkStamp(chunk(), t, tileset, { x: 10, y: -4 }, mapping, [{ name: 'Enemy' }]); assert.strictEqual(JSON.stringify(t), before); });
test('dry run reports bounds from bottom-left anchor', () => { const plan = p.planTilemapChunkStamp(chunk(), target(), tileset, { x: 10, y: -4 }, mapping, [{ name: 'Enemy' }]); assert.deepStrictEqual(plan.bounds, { minX: 10, minY: -4, maxX: 12, maxY: -2, width: 3, height: 3 }); });
test('dry run reports additions', () => assert.strictEqual(p.planTilemapChunkStamp(chunk(), target(), tileset, { x: 10, y: 0 }, mapping, [{ name: 'Enemy' }]).cellsAdded, 4));
test('dry run reports overwrites', () => { const t = target(); p.setTilemapCell(t, 'terrain', 10, 0, 'wall'); assert.strictEqual(p.planTilemapChunkStamp(chunk(), t, tileset, { x: 10, y: 0 }, mapping, [{ name: 'Enemy' }]).cellsOverwritten, 1); });
test('manual Cells materialize', () => { const t = target(); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 10, y: 0 }, mapping, [{ name: 'Enemy' }]); p.commitTilemapChunkStamp(t, plan); assert(p.getTilemapCell(t, 'terrain', 10, 0)); });
test('weighted Terrain resolves with destination Layer and coordinates', () => { const t = target(); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 10, y: 0 }, mapping, [{ name: 'Enemy' }]); p.commitTilemapChunkStamp(t, plan); const cell = p.getTilemapCell(t, 'terrain', 11, 0); assert.strictEqual(cell.tileId, p.resolveTerrainWeightedTile(tileset, p.getTerrainBrushById(tileset, 'grass'), 'terrain', 11, 0)); });
test('direct Auto-Tile resolves at destination', () => { const t = target(); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 10, y: 0 }, mapping, [{ name: 'Enemy' }]); p.commitTilemapChunkStamp(t, plan); assert.strictEqual(p.getTilemapCell(t, 'terrain', 12, 0).autoTileSetId, 'road-set'); });
test('Auto-Terrain retains both semantics', () => { const t = target(); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 10, y: 0 }, mapping, [{ name: 'Enemy' }]); p.commitTilemapChunkStamp(t, plan); const cell = p.getTilemapCell(t, 'details-target', 10, 1); assert.strictEqual(cell.terrainBrushId, 'connected'); assert.strictEqual(cell.autoTileSetId, 'road-set'); });
test('holes do not erase destination', () => { const t = target(); p.setTilemapCell(t, 'terrain', 11, 1, 'wall'); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 10, y: 0 }, mapping, [{ name: 'Enemy' }]); p.commitTilemapChunkStamp(t, plan); assert.strictEqual(p.getTilemapCell(t, 'terrain', 11, 1).tileId, 'wall'); });
test('stored Cells overwrite destination', () => { const t = target(); p.setTilemapCell(t, 'terrain', 10, 0, 'wall', { terrainBrushId: 'grass' }); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 10, y: 0 }, mapping, [{ name: 'Enemy' }]); p.commitTilemapChunkStamp(t, plan); assert.strictEqual(p.getTilemapCell(t, 'terrain', 10, 0).terrainBrushId, undefined); });
test('Create New Layer plan preserves name', () => { const t = target(); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 0, y: 0 }, { 'chunk-ground': 'terrain', 'chunk-details': { create: true, name: 'Foreground' } }, [{ name: 'Enemy' }]); assert.strictEqual(plan.newLayers[0].name, 'Foreground'); });
test('new Layer is visible and unlocked', () => { const t = target(); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 0, y: 0 }, { 'chunk-ground': 'terrain', 'chunk-details': { create: true, name: 'Foreground' } }, [{ name: 'Enemy' }]); p.commitTilemapChunkStamp(t, plan); const layer = t.layers.find(x => x.name === 'Foreground'); assert(layer.visible && !layer.locked); });
test('marker stamp creates destination coordinates', () => { const plan = p.planTilemapChunkStamp(chunk(), target(), tileset, { x: 10, y: -4 }, mapping, [{ name: 'Enemy' }]); assert.deepStrictEqual([plan.markersCreated[0].x, plan.markersCreated[0].y], [11, -3]); });
test('marker stamp creates a fresh ID', () => assert.notStrictEqual(p.planTilemapChunkStamp(chunk(), target(), tileset, { x: 0, y: 0 }, mapping, [{ name: 'Enemy' }]).markersCreated[0].id, chunk().spawnMarkers[0].id));
test('marker stamp stays fresh when template ID matches the natural target slug', () => { const c = chunk(); c.spawnMarkers[0].id = 'enemy-spawn'; assert.notStrictEqual(p.planTilemapChunkStamp(c, target(), tileset, { x: 0, y: 0 }, mapping, [{ name: 'Enemy' }]).markersCreated[0].id, c.spawnMarkers[0].id); });
test('marker stamp preserves Prefab ref', () => assert.strictEqual(p.planTilemapChunkStamp(chunk(), target(), tileset, { x: 0, y: 0 }, mapping, [{ name: 'Enemy' }]).markersCreated[0].prefabRef, 'Enemy'));
test('repeated marker stamp uses collision-safe name', () => { const t = target({ spawnMarkers: [{ id: 'enemy-spawn', name: 'Enemy Spawn', x: 9, y: 9 }] }); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: 0, y: 0 }, mapping, [{ name: 'Enemy' }]); assert.strictEqual(plan.markersCreated[0].name, 'Enemy Spawn 2'); });
test('preview commit parity is exact', () => { const t = target(); const plan = p.planTilemapChunkStamp(chunk(), t, tileset, { x: -8, y: 12 }, mapping, [{ name: 'Enemy' }]); p.commitTilemapChunkStamp(t, plan); assert.deepStrictEqual({ layers: p.serializeTilemapLayers(t), spawnMarkers: p.canonicalizeSpawnMarkers(t.spawnMarkers) }, plan.result); });
test('stamp leaves no Chunk reference', () => { const t = target(); p.commitTilemapChunkStamp(t, p.planTilemapChunkStamp(chunk(), t, tileset, { x: 0, y: 0 }, mapping, [{ name: 'Enemy' }])); assert(!JSON.stringify(t).includes('room')); });
test('Chunk delete cannot affect a materialized target', () => { const t = target(); const c = chunk(); p.commitTilemapChunkStamp(t, p.planTilemapChunkStamp(c, t, tileset, { x: 0, y: 0 }, mapping, [{ name: 'Enemy' }])); const saved = JSON.stringify(t); c.layers.length = 0; assert.strictEqual(JSON.stringify(t), saved); });
test('Chunk edit cannot affect a materialized target', () => { const t = target(); const c = chunk(); p.commitTilemapChunkStamp(t, p.planTilemapChunkStamp(c, t, tileset, { x: 0, y: 0 }, mapping, [{ name: 'Enemy' }])); const saved = JSON.stringify(t); c.layers[0].cells[0].tileId = 'wall'; assert.strictEqual(JSON.stringify(t), saved); });
test('source Tilemap is not stored on Chunk', () => assert(!Object.prototype.hasOwnProperty.call(chunk(), 'sourceTilemapId')));
test('repair replaces missing Tile ref', () => { const c = chunk(); c.layers[0].cells[0].tileId = 'gone'; assert.strictEqual(p.repairTilemapChunkDependency(c, 'tile', 'gone', 'wall', tileset), 1); });
test('repair replaces marker Prefab ref', () => { const c = chunk(); assert.strictEqual(p.repairTilemapChunkDependency(c, 'prefab', 'Enemy', 'Enemy2'), 1); assert.strictEqual(c.spawnMarkers[0].prefabRef, 'Enemy2'); });
test('usage finds Tiles in Chunks', () => assert(p.tilemapChunkTileUsage([chunk()], 'ts', 'grass-a').length));
test('usage finds Auto Sets in Chunks', () => assert(p.tilemapChunkAutoTileUsage([chunk()], 'ts', 'road-set').length));
test('usage finds Terrain in Chunks', () => assert(p.tilemapChunkTerrainUsage([chunk()], 'ts', 'grass').length));
test('usage finds marker Prefabs in Chunks', () => assert(p.tilemapChunkPrefabUsage([chunk()], 'Enemy').length));
test('editor persists Chunk Assets in Editable; unknown graph exports retain recoverable authoring content', () => assert(editor.includes('tilemapChunks: includeTilesetAuthoring || deps.preserveUnknownGraphs ? serializeTilemapChunks() : []')));
test('Playable strips semantic Tile fields', () => assert(editor.includes("cells: (layer.cells || []).map((cell) => ({ x: cell.x, y: cell.y, tileId: cell.tileId }))")));
test('editor history includes Chunks', () => assert(editor.includes('tilemapChunks: serializeTilemapChunks()')));
test('Capture Chunk tool is discoverable', () => assert(html.includes('tilemap-capture-chunk-tool')));
test('Stamp Chunk tool is discoverable', () => assert(html.includes('tilemap-stamp-chunk-tool')));
test('Asset Library has Chunk search and filter section', () => assert(html.includes('data-asset-kind="tilemap-chunk"') && html.includes('tilemap-chunk-library-search')));
test('ordinary object exclusion is disclosed', () => assert(editor.includes('Ordinary scene objects are not included in Tilemap Chunks')));
test('marker include default is explicit', () => assert(editor.includes('Default is No')));
test('stamp confirmation explains holes', () => assert(editor.includes('Empty Chunk holes do not erase target cells')));
test('one stamp captures one Undo snapshot', () => assert(/tilemapTool === 'stamp-chunk'[\s\S]*?pushUndo\(\); OpusAuthoringPlumbing\.commitTilemapChunkStamp/.test(editor)));
test('no runtime Chunk API exists', () => assert(!editor.includes('Opus.stampChunk')));
test('TMX remains outside Phase 038', () => assert(!editor.includes('importTMX')));

let passed = 0;
for (const entry of tests) { try { entry.fn(); passed++; console.log(`  PASS ${entry.name}`); } catch (error) { console.error(`  FAIL ${entry.name}`); console.error(error.stack || error); process.exit(1); } }
console.log(`Phase 038 Tilemap Chunks: ${passed}/${tests.length} tests passed`);
