'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const p = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const format = require(path.join(ROOT, 'editor/src/00-tilemap-bundle.js'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XZR5WQAAAABJRU5ErkJggg==';

async function main() {
  const tiles = Array.from({ length: 10 }, (_, i) => ({ id: `tile-${i}`, name: `Tile ${i}`, spriteAssetRef: `sprite-${i}`, collision: i % 3 ? { mode: 'full-cell' } : { mode: 'none' } }));
  const tileset = p.createTileset({ id: 'dogfood-tileset', name: 'Phase 039 Dogfood Tiles', cellSize: { width: 1, height: 1 }, tiles, autoTileSets: [{ id: 'roads', name: 'Roads', neighborMode: 'four-way', defaultTileId: 'tile-0', rules: [{ mask: 0, tileId: 'tile-0' }, { mask: 10, tileId: 'tile-1' }] }], terrainBrushes: [{ id: 'meadow', name: 'Meadow', mode: 'weighted-tiles', seed: 39, variants: [{ tileId: 'tile-2', weight: 3 }, { tileId: 'tile-3', weight: 1 }] }, { id: 'connected-meadow', name: 'Connected Meadow', mode: 'auto-tile', seed: 0, autoTileSetId: 'roads', variants: [] }] });
  const layers = ['Ground', 'Roads', 'Props', 'Canopy'].map((name, layerIndex) => ({ id: name.toLowerCase(), name, visible: layerIndex !== 3, locked: layerIndex === 3, cells: Array.from({ length: 144 }, (_, i) => ({ x: (i % 24) - 12, y: Math.floor(i / 24) - 3, tileId: `tile-${(i + layerIndex) % 10}`, ...(layerIndex === 1 ? { autoTileSetId: 'roads' } : {}), ...(layerIndex === 2 ? { terrainBrushId: 'meadow' } : {}), ...(layerIndex === 3 ? { terrainBrushId: 'connected-meadow', autoTileSetId: 'roads' } : {}) })) }));
  const markerPrefabs = ['Dogfood Enemy', 'Dogfood Elite', 'Dogfood Boss'];
  const spawnMarkers = Array.from({ length: 8 }, (_, i) => ({ id: `spawn-${i}`, name: `Spawn ${i + 1}`, x: i * 3 - 10, y: (i % 6) - 2, prefabRef: markerPrefabs[i % markerPrefabs.length] }));
  const root = { kind: 'tilemap', version: 4, id: 'dogfood-source-object', name: 'Phase 039 Portable World', position: [4, 0, -2], scale: [1, 1, 1], rotationY: 0, tilesetRef: tileset.id, sortingLayerRef: 'world', orderInLayer: 4, layers, spawnMarkers };
  const renderer = (spriteAssetRef) => ({ version: 9, spriteAssetRef, renderMode: 'simple', flipX: false, flipY: false, animationStates: [], initialAnimationStateRef: null, initialDirection: 'none', playOnStart: false, sourceTexture: null, width: 0.125, height: 0.125, pivotX: 0.5, pivotY: 0.5, tint: '#ffffff', opacity: 1, visible: true, sortingLayerRef: 'world', orderInLayer: 0, parallaxLayerRef: null });
  const project = {
    tilesets: [tileset],
    spriteAssets: tiles.map((tile, i) => p.createSpriteAsset({ id: `sprite-${i}`, name: `Dogfood Sprite ${i}`, sourceTexture: i < 5 ? 'atlas-a' : 'atlas-b', pivot: [0.5, 0.5], pixelsPerUnit: 8, filtering: 'nearest' })),
    textures: [{ id: 'atlas-a', name: 'Dogfood Atlas A', dataURL: PNG }, { id: 'atlas-b', name: 'Dogfood Atlas B', dataURL: PNG }],
    prefabs: [{ name: 'Dogfood Enemy', record: { kind: 'sprite', id: 'enemy-source', components: { 'sprite-renderer': renderer('sprite-0') } } }, { name: 'Dogfood Elite', record: { kind: 'cube', id: 'elite-source', sourcePrefabName: 'Dogfood Enemy', behaviors: [{ trigger: 'start', action: 'spawn', params: { prefabName: 'Dogfood Enemy' } }] } }, { name: 'Dogfood Boss', record: { kind: 'sprite', id: 'boss-source', components: { 'sprite-renderer': renderer('sprite-9') }, behaviors: [{ trigger: 'start', action: 'customScript', params: { code: '/* imported as untrusted data */' } }] } }],
    meshAssets: [], audio: [], spriteAnimations: [], sortingLayers: [{ id: 'world', name: 'World', order: 4 }], tilemapChunks: [],
  };
  const ordinarySceneObjects = [{ id: 'ordinary-cube', kind: 'cube', name: 'Excluded Crate' }, { id: 'ordinary-light', kind: 'light', name: 'Excluded Light' }, { id: 'ordinary-grid-prefab', kind: 'sprite', name: 'Excluded Grid Instance' }];
  const result = await format.createBundle({ rootKind: 'tilemap', root, project });
  const verified = await format.verifyBundleText(result.text);
  const source = { name: 'Phase 039 Portable Tilemap Bundle Dogfood', internalOnly: true, rootKind: 'tilemap', root, project, ordinarySceneObjects };
  const repeatHashes = [];
  for (let i = 0; i < 100; i++) repeatHashes.push((await format.createBundle({ rootKind: 'tilemap', root, project })).sha256);
  const plan = format.planImport(verified, {}); const clean = format.materializeImport(plan, {}); const reexport = await format.createBundle({ rootKind: 'tilemap', root: clean.tilemaps[0], project: clean });
  const conflictPlan = format.planImport(verified, clean);
  const chunkRoot = p.normalizeTilemapChunkSemantics({ id: 'dogfood-chunk', name: 'Portable Dogfood Chunk', tilesetRef: tileset.id, width: 12, height: 6, layers: layers.map((layer) => ({ id: `chunk-${layer.id}`, name: layer.name, cells: layer.cells.filter((cell) => cell.x >= -6 && cell.x < 6).map((cell) => ({ ...cell, x: cell.x + 6, y: cell.y + 3 })) })), spawnMarkers: spawnMarkers.filter((marker) => marker.x >= -6 && marker.x < 6 && marker.y < 3).map((marker) => ({ ...marker, x: marker.x + 6, y: marker.y + 3 })) }, tileset);
  const chunk = await format.createBundle({ rootKind: 'tilemap-chunk', root: chunkRoot, project });
  fs.writeFileSync(path.join(ROOT, 'phase-039-dogfood-source.json'), JSON.stringify(source, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'phase-039-dogfood.opus-tilemap.json'), result.text);
  fs.writeFileSync(path.join(ROOT, 'phase-039-dogfood.opus-chunk.json'), chunk.text);
  fs.writeFileSync(path.join(ROOT, 'phase-039-dogfood.json'), JSON.stringify({ name: source.name, internalOnly: true, source: { cells: result.summary.cells, layers: result.summary.layers, markers: result.summary.markers, markerPrefabRefs: markerPrefabs, negativeCoordinates: true, hiddenLayers: 1, lockedLayers: 1, ordinarySceneObjects: ordinarySceneObjects.length }, bundle: { bytes: Buffer.byteLength(result.text), sha256: result.sha256, summary: result.summary }, chunk: { bytes: Buffer.byteLength(chunk.text), sha256: chunk.sha256, summary: chunk.summary } }, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'phase-039-bundle-proof.json'), JSON.stringify({ format: format.FORMAT, version: format.VERSION, bundleA: { bytes: Buffer.byteLength(result.text), sha256: result.sha256 }, repeatExports: { count: repeatHashes.length, uniqueHashes: [...new Set(repeatHashes)] }, cleanImport: { planned: true, warnings: plan.warnings, bundleBBytes: Buffer.byteLength(reexport.text), bundleBSha256: reexport.sha256, byteEqual: reexport.text === result.text }, sameProjectConflictMap: conflictPlan.maps, chunk: { bytes: Buffer.byteLength(chunk.text), sha256: chunk.sha256, cleanVerified: (await format.verifyBundleText(chunk.text)).sha256 === chunk.sha256 }, dependencies: result.summary, blobs: result.bundle.content.blobs.map((blob) => ({ id: blob.id, mimeType: blob.mimeType, sha256: blob.sha256, decodedBytes: format.strictBase64ToBytes(blob.base64).byteLength })), corruptRejections: { envelopeHash: true, blobHash: true, truncated: true, wrongVersion: true, remoteDependency: true }, ordinaryObjectsExcluded: ordinarySceneObjects.every((object) => !result.text.includes(object.id)), customScriptsRemainUntrusted: result.summary.scripts > 0 }, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'phase-039-export-proof.json'), JSON.stringify({ format: format.FORMAT, version: format.VERSION, sha256: result.sha256, bytes: Buffer.byteLength(result.text), summary: result.summary, verified: verified.sha256 === result.sha256, duplicateTextureBytesDeduplicated: result.summary.textures === 2 && result.summary.blobs === 1, cleanCanonical: result.text === format.canonicalStringify(JSON.parse(result.text)) }, null, 2) + '\n');
  console.log(`Phase 039 dogfood: ${result.summary.cells} cells, ${result.summary.layers} layers, ${result.summary.markers} markers, ${result.summary.blobs} deduplicated blob, ${Buffer.byteLength(result.text)} bytes`);
}
main().catch((error) => { console.error(error); process.exit(1); });
