'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const bundleApi = require(path.join(ROOT, 'editor/src/00-tilemap-bundle.js'));
const plumbing = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const buildGames = fs.readFileSync(path.join(ROOT, 'build/build-games.js'), 'utf8');
const tests = []; const test = (name, fn) => tests.push({ name, fn });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XZR5WQAAAABJRU5ErkJggg==';

function fixture() {
  const tiles = [];
  for (let i = 0; i < 8; i++) tiles.push({ id: `tile-${i}`, name: `Tile ${i}`, spriteAssetRef: `sprite-${i}`, collision: i % 2 ? { mode: 'solid' } : { mode: 'none' } });
  const tileset = plumbing.createTileset({ id: 'world-tiles', name: 'World Tiles', tiles, autoTileSets: [{ id: 'road', name: 'Road', neighborMode: 'four-way', defaultTileId: 'tile-0', rules: [{ mask: 0, tileId: 'tile-0' }] }], terrainBrushes: [{ id: 'grass', name: 'Grass', mode: 'weighted-tiles', seed: 9, variants: [{ tileId: 'tile-1', weight: 1 }] }] });
  const layers = ['Ground', 'Roads', 'Details', 'Canopy'].map((name, layerIndex) => ({ id: name.toLowerCase(), name, visible: true, locked: false, cells: Array.from({ length: 140 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20), tileId: `tile-${(i + layerIndex) % 8}`, ...(layerIndex === 1 ? { autoTileSetId: 'road' } : {}), ...(layerIndex === 2 ? { terrainBrushId: 'grass' } : {}) })) }));
  const markers = Array.from({ length: 6 }, (_, i) => ({ id: `marker-${i}`, name: `Enemy ${i}`, x: i * 2, y: i, prefabRef: i % 2 ? 'Enemy' : 'NestedEnemy' }));
  const root = { kind: 'tilemap', version: 4, id: 'scene-object-9', name: 'Portable World', position: [1, 2, 3], scale: [1, 1, 1], rotationY: 0, tilesetRef: 'world-tiles', sortingLayerRef: 'world', orderInLayer: 2, layers, spawnMarkers: markers };
  const spriteAssets = tiles.map((tile, i) => ({ id: `sprite-${i}`, type: 'sprite', version: 1, name: `Sprite ${i}`, sourceTexture: i < 4 ? 'shared-texture' : `texture-${i}`, pivot: [0.5, 0.5], pixelsPerUnit: 16, filtering: 'nearest' }));
  const textures = [{ id: 'shared-texture', name: 'Shared', dataURL: PNG }, ...Array.from({ length: 4 }, (_, i) => ({ id: `texture-${i + 4}`, name: `Texture ${i + 4}`, dataURL: PNG }))];
  const prefabs = [
    { name: 'Enemy', record: { kind: 'sprite', id: 'old-enemy', components: { 'sprite-renderer': { spriteAssetRef: 'sprite-0', sortingLayerRef: 'world' } } } },
    { name: 'NestedEnemy', record: { kind: 'cube', id: 'old-nested', sourcePrefabName: 'Enemy', behaviors: [{ action: 'spawn', params: { prefabName: 'Enemy' } }] } },
  ];
  return { root, project: { tilesets: [tileset], spriteAssets, textures, prefabs, meshAssets: [], audio: [], spriteAnimations: [], sortingLayers: [{ id: 'world', name: 'World', order: 2 }], tilemapChunks: [] } };
}
async function exported(rootKind = 'tilemap', override) { const f = fixture(); return bundleApi.createBundle({ rootKind, root: override || f.root, project: f.project }); }
function resigned(value) { return (async () => { const unsigned = { format: value.format, version: value.version, rootKind: value.rootKind, content: value.content }; value.integrity.sha256 = await bundleApi.sha256Hex(bundleApi.canonicalStringify(unsigned)); return bundleApi.canonicalStringify(value); })(); }

test('format identity is stable', () => assert.strictEqual(bundleApi.FORMAT, 'digital-opus-tilemap-bundle'));
test('format version is one', () => assert.strictEqual(bundleApi.VERSION, 1));
test('extensions are first party', () => assert.deepStrictEqual(bundleApi.EXTENSIONS, { tilemap: '.opus-tilemap.json', 'tilemap-chunk': '.opus-chunk.json' }));
test('canonical object keys are lexical', () => assert(bundleApi.canonicalStringify({ z: 1, a: 2 }).indexOf('"a"') < bundleApi.canonicalStringify({ z: 1, a: 2 }).indexOf('"z"')));
test('canonical JSON uses two spaces', () => assert(bundleApi.canonicalStringify({ a: { b: 1 } }).includes('    "b"')));
test('canonical JSON ends with one newline', () => assert(bundleApi.canonicalStringify({ a: 1 }).endsWith('}\n')));
test('negative zero normalizes', () => assert(bundleApi.canonicalStringify({ n: -0 }).includes('"n": 0')));
test('NaN is rejected', () => assert.throws(() => bundleApi.canonicalStringify({ n: NaN }), /Non-finite/));
test('Infinity is rejected', () => assert.throws(() => bundleApi.canonicalStringify({ n: Infinity }), /Non-finite/));
test('prototype-pollution key is rejected', () => assert.throws(() => bundleApi.canonicalStringify(JSON.parse('{"__proto__":1}')), /Unsafe key/));
test('SHA-256 matches Node crypto', async () => assert.strictEqual(await bundleApi.sha256Hex('portable'), crypto.createHash('sha256').update('portable').digest('hex')));
test('strict base64 accepts padding', () => assert.strictEqual(bundleApi.strictBase64ToBytes('YQ==')[0], 97));
test('strict base64 rejects garbage', () => assert.throws(() => bundleApi.strictBase64ToBytes('***='), /Invalid base64/));
test('data URL parser rejects remote URLs', () => assert.throws(() => bundleApi.parseDataURL('https://example.com/a.png'), /data URL/));
test('data URL parser rejects SVG', () => assert.throws(() => bundleApi.parseDataURL('data:image/svg+xml;base64,PHN2Zz4='), /Unsupported/));
test('tilemap export strips scene object identity', async () => assert.strictEqual((await exported()).bundle.content.root.id, undefined));
test('tilemap export preserves transform', async () => assert.deepStrictEqual((await exported()).bundle.content.root.position, [1, 2, 3]));
test('tilemap export rejects parented roots', async () => { const f = fixture(); f.root.parentId = 'parent'; await assert.rejects(() => exported('tilemap', f.root), /detached/); });
test('all four layers survive', async () => assert.strictEqual((await exported()).summary.layers, 4));
test('500+ cells survive', async () => assert.strictEqual((await exported()).summary.cells, 560));
test('six markers survive', async () => assert.strictEqual((await exported()).summary.markers, 6));
test('full Tileset survives', async () => assert.strictEqual((await exported()).summary.tiles, 8));
test('unused Tile records survive', async () => { const result = await exported(); assert(result.bundle.content.dependencies.tilesets[0].tiles.some((tile) => tile.id === 'tile-7')); });
test('collision metadata survives', async () => { const result = await exported(); assert.strictEqual(result.bundle.content.dependencies.tilesets[0].tiles[1].collision.mode, 'solid'); });
test('Auto-Tile definitions survive', async () => assert.strictEqual((await exported()).bundle.content.dependencies.tilesets[0].autoTileSets[0].id, 'road'));
test('Terrain definitions survive', async () => assert.strictEqual((await exported()).bundle.content.dependencies.tilesets[0].terrainBrushes[0].id, 'grass'));
test('Prefab closure is recursive', async () => assert.strictEqual((await exported()).summary.prefabs, 2));
test('ordinary scene objects are absent', async () => assert(!JSON.stringify((await exported()).bundle).includes('ordinary-scene-object')));
test('identical image bytes deduplicate', async () => assert.strictEqual((await exported()).summary.blobs, 1));
test('asset records reference blobs', async () => assert((await exported()).bundle.content.dependencies.textures.every((texture) => texture.blobRef)));
test('asset records contain no data URLs', async () => assert(!(await exported()).text.includes('data:image')));
test('blob id is content addressed', async () => assert(/^sha256-[0-9a-f]{64}$/.test((await exported()).bundle.content.blobs[0].id)));
test('bundle has no timestamp', async () => assert(!(await exported()).text.includes('timestamp')));
test('bundle has no random export id', async () => assert(!(await exported()).text.includes('exportId')));
test('same state exports byte-identically', async () => assert.strictEqual((await exported()).text, (await exported()).text));
test('export validates itself', async () => { const result = await exported(); assert.strictEqual((await bundleApi.verifyBundleText(result.text)).sha256, result.sha256); });
test('noncanonical whitespace is rejected', async () => { const result = await exported(); await assert.rejects(() => bundleApi.verifyBundleText(JSON.stringify(result.bundle)), /not canonical/); });
test('BOM is rejected', async () => { const result = await exported(); await assert.rejects(() => bundleApi.verifyBundleText('\uFEFF' + result.text), /BOM/); });
test('invalid JSON is rejected', async () => assert.rejects(() => bundleApi.verifyBundleText('{'), /Invalid JSON/));
test('wrong format is rejected', async () => { const r = await exported(); const b = JSON.parse(r.text); b.format = 'wrong'; const text = await resigned(b); await assert.rejects(() => bundleApi.verifyBundleText(text), /Unsupported format/); });
test('future version is rejected', async () => { const r = await exported(); const b = JSON.parse(r.text); b.version = 2; const text = await resigned(b); await assert.rejects(() => bundleApi.verifyBundleText(text), /Unsupported bundle version/); });
test('tampered content is rejected', async () => { const r = await exported(); const b = JSON.parse(r.text); b.content.root.name = 'Tampered'; await assert.rejects(() => bundleApi.verifyBundleText(bundleApi.canonicalStringify(b)), /integrity/); });
test('tampered blob is rejected after resigning envelope', async () => { const r = await exported(); const b = JSON.parse(r.text); b.content.blobs[0].base64 = 'YQ=='; const text = await resigned(b); await assert.rejects(() => bundleApi.verifyBundleText(text), /Blob integrity/); });
test('missing blob is rejected', async () => { const r = await exported(); const b = JSON.parse(r.text); b.content.blobs = []; const text = await resigned(b); await assert.rejects(() => bundleApi.verifyBundleText(text), /Missing blob/); });
test('duplicate blob IDs are rejected', async () => { const r = await exported(); const b = JSON.parse(r.text); b.content.blobs.push({ ...b.content.blobs[0] }); const text = await resigned(b); await assert.rejects(() => bundleApi.verifyBundleText(text), /Duplicate blob/); });
test('inline dependency data URL is rejected', async () => { const r = await exported(); const b = JSON.parse(r.text); b.content.dependencies.textures[0].dataURL = PNG; const text = await resigned(b); await assert.rejects(() => bundleApi.verifyBundleText(text), /inline asset URL/); });
test('preview planner does not mutate existing state', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const existing = fixture().project; const before = JSON.stringify(existing); bundleApi.planImport(v, existing); assert.strictEqual(JSON.stringify(existing), before); });
test('unused incoming IDs are preserved', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const p = bundleApi.planImport(v, {}); assert.strictEqual(p.dependencies.tilesets[0].id, 'world-tiles'); });
test('Tileset collisions remap', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const p = bundleApi.planImport(v, { tilesets: [{ id: 'world-tiles' }] }); assert.strictEqual(p.dependencies.tilesets[0].id, 'world-tiles-2'); assert.strictEqual(p.root.tilesetRef, 'world-tiles-2'); });
test('Sprite collisions remap structural Tile refs', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const p = bundleApi.planImport(v, { spriteAssets: [{ id: 'sprite-0' }] }); assert.strictEqual(p.dependencies.tilesets[0].tiles[0].spriteAssetRef, 'sprite-0-2'); });
test('Texture collisions remap Sprite refs', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const p = bundleApi.planImport(v, { textures: [{ id: 'shared-texture' }] }); assert.strictEqual(p.dependencies.spriteAssets[0].sourceTexture, 'shared-texture-2'); });
test('Prefab collisions remap marker refs', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const p = bundleApi.planImport(v, { prefabs: [{ name: 'Enemy' }] }); assert.strictEqual(p.root.spawnMarkers[1].prefabRef, 'Enemy-2'); });
test('Prefab collisions rewrite nested structural refs', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const p = bundleApi.planImport(v, { prefabs: [{ name: 'Enemy' }] }); const nested = p.dependencies.prefabs.find((entry) => entry.name === 'NestedEnemy'); assert.strictEqual(nested.record.sourcePrefabName, 'Enemy-2'); });
test('free-form strings are not rewritten', () => { const out = bundleApi.rewriteReferences({ text: 'Enemy', prefabRef: 'Enemy' }, { prefabs: { Enemy: 'Enemy-2' } }, 0); assert.strictEqual(out.text, 'Enemy'); assert.strictEqual(out.prefabRef, 'Enemy-2'); });
test('materialization returns independent state', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const p = bundleApi.planImport(v, {}); const current = { tilesets: [] }; const next = bundleApi.materializeImport(p, current); next.tilesets[0].name = 'Changed'; assert.strictEqual(current.tilesets.length, 0); });
test('injected failure leaves source state unchanged', async () => { const v = await bundleApi.verifyBundleText((await exported()).text); const p = bundleApi.planImport(v, {}); const current = { tilesets: [{ id: 'local' }] }; const before = JSON.stringify(current); assert.throws(() => bundleApi.materializeImport(p, current, { failAt: 2 }), /Injected/); assert.strictEqual(JSON.stringify(current), before); });
test('clean import re-export is byte-identical', async () => { const first = await exported(); const verified = await bundleApi.verifyBundleText(first.text); const plan = bundleApi.planImport(verified, {}); const state = bundleApi.materializeImport(plan, {}); const second = await bundleApi.createBundle({ rootKind: 'tilemap', root: state.tilemaps[0], project: state }); assert.strictEqual(first.text, second.text); });

test('Chunk root round-trips independently', async () => { const f = fixture(); const chunk = plumbing.normalizeTilemapChunk({ id: 'room', name: 'Room', tilesetRef: 'world-tiles', width: 20, height: 7, layers: f.root.layers.map((layer) => ({ id: layer.id, name: layer.name, cells: layer.cells })), spawnMarkers: f.root.spawnMarkers }); const result = await exported('tilemap-chunk', chunk); const verified = await bundleApi.verifyBundleText(result.text); assert.strictEqual(verified.bundle.content.root.id, 'room'); });
test('Chunk collision remaps root identity', async () => { const f = fixture(); const chunk = plumbing.normalizeTilemapChunk({ id: 'room', name: 'Room', tilesetRef: 'world-tiles', width: 1, height: 1, layers: [{ id: 'l', name: 'L', cells: [{ x: 0, y: 0, tileId: 'tile-0' }] }], spawnMarkers: [] }); const verified = await bundleApi.verifyBundleText((await exported('tilemap-chunk', chunk)).text); assert.strictEqual(bundleApi.planImport(verified, { tilemapChunks: [{ id: 'room', name: 'Room' }] }).root.id, 'room-2'); });

for (let seed = 1; seed <= 20; seed++) test(`fuzz canonicalization seed ${seed}`, async () => {
  let state = seed >>> 0; const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000;
  const cells = []; for (let i = 0; i < 5000; i++) cells.push({ x: Math.floor(random() * 200) - 100, y: Math.floor(random() * 200) - 100, tileId: `tile-${Math.floor(random() * 8)}` });
  const normalized = plumbing.canonicalizeTilemapCells(cells); const text = bundleApi.canonicalStringify(normalized); assert.strictEqual(text, bundleApi.canonicalStringify(JSON.parse(text)));
});
test('1000 serialization cycles are stable', async () => { const first = await exported(); let value = first.text; for (let i = 0; i < 1000; i++) value = bundleApi.canonicalStringify(JSON.parse(value)); assert.strictEqual(value, first.text); });
test('500-cell bundle size is sane', async () => assert((await exported()).text.length < 1024 * 1024));
test('editor exposes Tilemap export', () => assert(editor.includes('Export Portable Tilemap')));
test('editor exposes Chunk export', () => assert(editor.includes('Export Portable Chunk')));
test('editor exposes atomic import', () => assert(editor.includes('commitTilemapBundleImport')));
test('editor has cancel path', () => assert(editor.includes('tilemap-bundle-cancel')));
test('editor has drag-drop import', () => assert(editor.includes("window.addEventListener('drop'")));
test('editor marks imported prefab scripts untrusted', () => assert(editor.includes('if (addedPrefabs) scriptsTrusted = false')));
test('editor history uses one full snapshot', () => assert(editor.includes('_phase039FullProject')));
test('HTML loads authoring bundle module', () => assert(html.includes('00-tilemap-bundle.js')));
test('Playable build source list omits bundle parser', () => assert(!buildGames.includes('00-tilemap-bundle.js')));
test('runtime engine remains untouched by format string', () => { const source = fs.readFileSync(path.join(ROOT, 'dist/opus-engine.js'), 'utf8'); assert(!source.includes('digital-opus-tilemap-bundle')); });

(async () => {
  let passed = 0;
  for (const { name, fn } of tests) {
    try { await fn(); passed++; }
    catch (error) { console.error(`FAIL ${name}\n${error.stack || error}`); process.exitCode = 1; }
  }
  if (!process.exitCode) console.log(`Phase 039 tilemap bundle format: ${passed}/${tests.length} passed`);
})();
