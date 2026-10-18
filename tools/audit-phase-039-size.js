'use strict';
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ROOT = path.resolve(__dirname, '..');
const api = require(path.join(ROOT, 'editor/src/00-tilemap-bundle.js'));
const p = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XZR5WQAAAABJRU5ErkJggg==';

function input(cellCount) {
  const tileset = p.createTileset({ id: 'size-ts', name: 'Size Tiles', tiles: [{ id: 'tile', name: 'Tile', spriteAssetRef: 'sprite' }] });
  return { rootKind: 'tilemap', root: { kind: 'tilemap', name: `Size ${cellCount}`, tilesetRef: 'size-ts', layers: [{ id: 'ground', name: 'Ground', visible: true, locked: false, cells: Array.from({ length: cellCount }, (_, i) => ({ x: i % 100, y: Math.floor(i / 100), tileId: 'tile' })) }], spawnMarkers: [] }, project: { tilesets: [tileset], spriteAssets: [p.createSpriteAsset({ id: 'sprite', name: 'Sprite', sourceTexture: 'texture' })], textures: [{ id: 'texture', name: 'Texture', dataURL: PNG }], prefabs: [], meshAssets: [], audio: [], spriteAnimations: [], sortingLayers: [] } };
}
(async () => {
  const evidence = { phase: 39, kind: 'size-sanity', generated: new Date().toISOString(), cases: [] };
  for (const cells of [500, 2500, 5000]) {
    const startExport = performance.now(); const result = await api.createBundle(input(cells)); const exportMs = performance.now() - startExport;
    const startParse = performance.now(); JSON.parse(result.text); const parseMs = performance.now() - startParse;
    const startImport = performance.now(); const verified = await api.verifyBundleText(result.text); const verifyMs = performance.now() - startImport;
    const startPlan = performance.now(); api.planImport(verified, { tilesets: [{ id: 'size-ts' }] }); const planMs = performance.now() - startPlan;
    const blob = result.bundle.content.blobs[0]; const decodedBytes = api.strictBase64ToBytes(blob.base64).byteLength;
    evidence.cases.push({ cells, bytes: Buffer.byteLength(result.text), exportMs: Number(exportMs.toFixed(3)), parseMs: Number(parseMs.toFixed(3)), verifyMs: Number(verifyMs.toFixed(3)), planMs: Number(planMs.toFixed(3)), blob: { decodedBytes, base64Characters: blob.base64.length, expansionRatio: Number((blob.base64.length / decodedBytes).toFixed(3)) }, sha256: result.sha256 });
  }
  fs.mkdirSync(path.join(ROOT, 'qualification', 'phase-039'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'qualification', 'phase-039', 'size-sanity.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(evidence.cases.map((entry) => `${entry.cells}: ${entry.bytes} bytes, export ${entry.exportMs} ms, parse ${entry.parseMs} ms, verify ${entry.verifyMs} ms, plan ${entry.planMs} ms`).join('\n'));
})().catch((error) => { console.error(error); process.exit(1); });
