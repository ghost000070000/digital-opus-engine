'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const api = require(path.join(ROOT, 'editor/src/00-tilemap-bundle.js'));
const p = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XZR5WQAAAABJRU5ErkJggg==';
function rng(seed) { let state = seed >>> 0; return () => (state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000; }
(async () => {
  const evidence = { phase: 39, kind: 'determinism-fuzz', seeds: 20, operations: 0, cleanRoundTrips: 0, collisionPlans: 0, corruptionRejections: 0, atomicFailureChecks: 0, mismatches: 0, started: new Date().toISOString(), status: 'FAIL' };
  for (let seed = 1; seed <= 20; seed++) {
    const random = rng(seed); const tiles = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, name: `Tile ${i}`, spriteAssetRef: 'sprite', collision: i % 2 ? { mode: 'solid' } : { mode: 'none' } }));
    const tileset = p.createTileset({ id: 'ts', name: 'Fuzz Tiles', tiles, autoTileSets: [{ id: 'auto', name: 'Auto', neighborMode: 'four-way', defaultTileId: 't0', rules: [{ mask: 0, tileId: 't0' }] }], terrainBrushes: [{ id: 'terrain', name: 'Terrain', mode: 'weighted-tiles', seed, variants: [{ tileId: 't1', weight: 2 }, { tileId: 't2', weight: 1 }] }, { id: 'auto-terrain', name: 'Auto Terrain', mode: 'auto-tile', seed: 0, autoTileSetId: 'auto', variants: [] }] });
    const layers = Array.from({ length: 4 }, (_, layerIndex) => ({ id: `layer-${layerIndex}`, name: `Layer ${layerIndex}`, visible: layerIndex !== 3, locked: layerIndex === 3, cells: [] }));
    for (let i = 0; i < 5000; i++) { const layer = layers[Math.floor(random() * layers.length)]; const mode = Math.floor(random() * 4); layer.cells.push({ x: Math.floor(random() * 400) - 200, y: Math.floor(random() * 400) - 200, tileId: `t${Math.floor(random() * 8)}`, ...(mode === 1 ? { autoTileSetId: 'auto' } : {}), ...(mode === 2 ? { terrainBrushId: 'terrain' } : {}), ...(mode === 3 ? { terrainBrushId: 'auto-terrain', autoTileSetId: 'auto' } : {}) }); evidence.operations++; }
    const root = { kind: 'tilemap', name: `Fuzz ${seed}`, tilesetRef: 'ts', layers, spawnMarkers: [{ id: 'm', name: 'Spawn', x: -1, y: 2, prefabRef: 'Enemy' }] };
    const project = { tilesets: [tileset], spriteAssets: [p.createSpriteAsset({ id: 'sprite', name: 'Sprite', sourceTexture: 'texture' })], textures: [{ id: 'texture', name: 'Texture', dataURL: PNG }], prefabs: [{ name: 'Enemy', record: { kind: 'sprite', id: 'enemy', components: { 'sprite-renderer': { spriteAssetRef: 'sprite' } } } }], meshAssets: [], audio: [], spriteAnimations: [], sortingLayers: [] };
    const first = await api.createBundle({ rootKind: 'tilemap', root, project }); const verified = await api.verifyBundleText(first.text); const plan = api.planImport(verified, {}); const imported = api.materializeImport(plan, {}); const second = await api.createBundle({ rootKind: 'tilemap', root: imported.tilemaps[0], project: imported });
    if (first.text !== second.text) { evidence.mismatches++; throw new Error(`clean mismatch seed ${seed}`); } evidence.cleanRoundTrips++;
    const collisions = api.planImport(verified, { tilesets: [{ id: 'ts' }], spriteAssets: [{ id: 'sprite' }], textures: [{ id: 'texture' }], prefabs: [{ name: 'Enemy' }] });
    if (collisions.root.tilesetRef === 'ts' || collisions.root.spawnMarkers[0].prefabRef === 'Enemy') throw new Error(`collision rewrite failed seed ${seed}`); evidence.collisionPlans++;
    const before = JSON.stringify({ tilesets: [{ id: 'local' }] }); try { api.materializeImport(plan, JSON.parse(before), { failAt: seed % 8 }); } catch (error) { if (!/Injected/.test(error.message)) throw error; evidence.atomicFailureChecks++; }
    const corrupt = JSON.parse(first.text); corrupt.content.root.name += '!'; try { await api.verifyBundleText(api.canonicalStringify(corrupt)); throw new Error('corrupt envelope accepted'); } catch (error) { if (/accepted/.test(error.message)) throw error; evidence.corruptionRejections++; }
  }
  evidence.ended = new Date().toISOString(); evidence.status = 'PASS';
  fs.mkdirSync(path.join(ROOT, 'qualification', 'phase-039'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'qualification', 'phase-039', 'bundle-fuzz.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`Phase 039 fuzz: ${evidence.status}, ${evidence.operations} operations, ${evidence.seeds} seeds, ${evidence.mismatches} mismatches`);
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
