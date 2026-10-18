'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const p = require(path.join(ROOT, 'editor/src/00-authoring-plumbing.js'));
const format = require(path.join(ROOT, 'editor/src/00-tilemap-bundle.js'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XZR5WQAAAABJRU5ErkJggg==';

function cellsForLayer(layerIndex) {
  const cells = [];
  for (let y = 0; cells.length < 2560; y++) for (let x = 0; x < 96 && cells.length < 2560; x++) {
    // A deterministic larger sparse field: corridors, courtyards and layer
    // offsets keep this from being four benchmark rectangles.
    if ((x + y * 3 + layerIndex * 7) % 11 === 0 || (x % 24 >= 18 && y % 14 >= 9)) continue;
    const global = layerIndex * 2560 + cells.length;
    const record = { x: x - 48 + layerIndex * 3, y: y - 18 + layerIndex * 2, tileId: `tile-${global % 28}` };
    if (global >= 3584 && global < 5632) { record.autoTileSetId = 'roads'; record.tileId = `tile-${global % 16}`; }
    else if (global >= 5632 && global < 8704) { record.terrainBrushId = 'meadow'; record.tileId = `tile-${2 + global % 6}`; }
    else if (global >= 8704) { record.terrainBrushId = 'connected-meadow'; record.autoTileSetId = 'roads'; record.tileId = `tile-${global % 16}`; }
    // A bounded contiguous Smooth-filtered detail region proves sampler
    // boundaries without turning alternating state into a pathological test.
    if (layerIndex === 0 && cells.length >= 2496) record.tileId = `tile-${28 + (cells.length % 4)}`;
    cells.push(record);
  }
  return cells;
}

async function main() {
  const tiles = Array.from({ length: 32 }, (_, i) => ({
    id: `tile-${i}`, name: `Tile ${i}`, spriteAssetRef: `sprite-${i}`,
    collision: i % 3 === 0 ? { mode: 'none' } : i % 3 === 1 ? { mode: 'full-cell' } : { mode: 'custom-rect', rect: { minX: 0.125, minY: 0.125, maxX: 0.875, maxY: 0.875 } },
  }));
  const rules = Array.from({ length: 16 }, (_, mask) => ({ mask, tileId: `tile-${mask}` }));
  const tileset = p.createTileset({ id: 'phase-040-tileset', name: 'Phase 040 Qualification Atlas', cellSize: { width: 1, height: 1 }, tiles,
    autoTileSets: [{ id: 'roads', name: 'Road Network', neighborMode: 'four-way', defaultTileId: 'tile-0', rules }],
    terrainBrushes: [{ id: 'meadow', name: 'Weighted Meadow', mode: 'weighted-tiles', seed: 40, variants: [{ tileId: 'tile-2', weight: 5 }, { tileId: 'tile-3', weight: 3 }, { tileId: 'tile-4', weight: 2 }] }, { id: 'connected-meadow', name: 'Connected Meadow', mode: 'auto-tile', seed: 0, autoTileSetId: 'roads', variants: [] }] });
  const layerNames = ['Ground', 'Ground Detail', 'Objects', 'Foreground'];
  const layers = layerNames.map((name, i) => ({ id: `layer-${i}`, name, visible: true, locked: false, cells: cellsForLayer(i) }));
  const prefabNames = ['Qualification Prop', 'Qualification Enemy', 'Qualification Portal'];
  const spawnMarkers = Array.from({ length: 100 }, (_, i) => ({ id: `spawn-${i}`, name: `Spawn ${i + 1}`, x: -46 + (i % 25) * 4, y: -16 + Math.floor(i / 25) * 11, prefabRef: i % 2 ? null : prefabNames[i % prefabNames.length] }));
  const root = { kind: 'tilemap', version: 4, id: 'phase-040-tilemap', name: 'Phase 040 10K Tilemap Qualification', position: [0, 0, 0], scale: [1, 1, 1], rotationY: 0, tilesetRef: tileset.id, sortingLayerRef: 'world', orderInLayer: 0, layers, spawnMarkers };
  const renderer = (spriteAssetRef) => ({ version: 9, spriteAssetRef, renderMode: 'simple', flipX: false, flipY: false, animationStates: [], initialAnimationStateRef: null, initialDirection: 'none', playOnStart: false, sourceTexture: null, width: 1, height: 1, pivotX: 0.5, pivotY: 0.5, tint: '#ffffff', opacity: 1, visible: true, sortingLayerRef: 'world', orderInLayer: 1, parallaxLayerRef: null });
  const prefabs = prefabNames.map((name, i) => ({ name, record: { kind: 'sprite', id: `prefab-source-${i}`, components: { 'sprite-renderer': renderer(`sprite-${i}`) } } }));
  const spriteAssets = tiles.map((tile, i) => p.createSpriteAsset({ id: `sprite-${i}`, name: `Atlas Tile ${i}`, sourceTexture: 'phase-040-atlas', sourceRect: null, pivot: [0.5, 0.5], pixelsPerUnit: 1, filtering: i < 28 ? 'nearest' : 'linear' }));
  const chunk = p.normalizeTilemapChunkSemantics({ id: 'phase-040-chunk', name: 'Phase 040 1K District', tilesetRef: tileset.id, width: 25, height: 10,
    layers: layers.map((layer, layerIndex) => ({ id: `chunk-layer-${layerIndex}`, name: layer.name, cells: Array.from({ length: 250 }, (_, i) => ({ ...layer.cells[i], x: i % 25, y: Math.floor(i / 25) })) })),
    spawnMarkers: spawnMarkers.slice(0, 8).map((marker, i) => ({ ...marker, id: `chunk-marker-${i}`, x: i * 3, y: i % 10 })) }, tileset);
  const projectClosure = { tilesets: [tileset], spriteAssets, textures: [{ id: 'phase-040-atlas', name: 'Phase 040 Atlas', dataURL: PNG }], prefabs, meshAssets: [], audio: [], spriteAnimations: [], sortingLayers: [{ id: 'world', name: 'World', order: 0 }], tilemapChunks: [chunk] };
  const ordinaryObjects = Array.from({ length: 75 }, (_, i) => ({ kind: 'sprite', id: `grid-object-${i}`, name: `Grid Prefab ${i + 1}`, sourcePrefabName: prefabNames[i % prefabNames.length], position: [-44 + (i % 25) * 4, -12 + Math.floor(i / 25) * 14, 0], scale: [1, 1, 1], rotationY: 0, components: { 'sprite-renderer': renderer(`sprite-${i % 3}`) } }));
  const project = { format: 'digital-opus-project', version: 7, levels: [{ id: 'level-phase-040', name: 'Qualification World', objects: [root, ...ordinaryObjects], environment: null, playerSettings: null, ui: null, description: 'Internal Phase 040 scale fixture', ambientAudio: null, sequences: [], objectiveDefs: [], scatterLayers: [] }], currentLevelIndex: 0, startLevelIndex: 0, levelTransition: { mode: 'instant', duration: 0.4 }, spriteSortingLayers: projectClosure.sortingLayers, parallaxLayers: [], prefabs, assets: [], textures: projectClosure.textures, spriteAssets, spriteAnimations: [], tilesets: [tileset], tilemapChunks: [chunk], audio: [], meta: { title: 'Phase 040 10K Tilemap Qualification', internalOnly: true }, inputActionMap: {}, itemDefs: [] };
  const bundle = await format.createBundle({ rootKind: 'tilemap', root, project: projectClosure });
  const chunkBundle = await format.createBundle({ rootKind: 'tilemap-chunk', root: chunk, project: projectClosure });
  const semantic = { manual: 0, autoTile: 0, weightedTerrain: 0, autoTerrain: 0 };
  for (const layer of layers) for (const cell of layer.cells) { if (cell.terrainBrushId && cell.autoTileSetId) semantic.autoTerrain++; else if (cell.terrainBrushId) semantic.weightedTerrain++; else if (cell.autoTileSetId) semantic.autoTile++; else semantic.manual++; }
  const evidence = { name: root.name, internalOnly: true, populatedCells: layers.reduce((n, layer) => n + layer.cells.length, 0), layers: layers.length, semantic, coordinateRange: { minX: Math.min(...layers.flatMap((l) => l.cells.map((c) => c.x))), maxX: Math.max(...layers.flatMap((l) => l.cells.map((c) => c.x))), minY: Math.min(...layers.flatMap((l) => l.cells.map((c) => c.y))), maxY: Math.max(...layers.flatMap((l) => l.cells.map((c) => c.y))) }, tiles: tiles.length, textures: 1, nearestTiles: 28, smoothTiles: 4, collision: { none: tiles.filter((t) => t.collision.mode === 'none').length, fullCell: tiles.filter((t) => t.collision.mode === 'full-cell').length, customRectangle: tiles.filter((t) => t.collision.mode === 'custom-rect').length }, spawnMarkers: spawnMarkers.length, ordinaryPrefabObjects: ordinaryObjects.length, chunkCells: p.tilemapChunkCellCount(chunk), bundle: { bytes: Buffer.byteLength(bundle.text), sha256: bundle.sha256 }, chunkBundle: { bytes: Buffer.byteLength(chunkBundle.text), sha256: chunkBundle.sha256 } };
  fs.writeFileSync(path.join(ROOT, 'phase-040-10k-project.json'), JSON.stringify(project, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'phase-040-10k.opus-tilemap.json'), bundle.text);
  fs.writeFileSync(path.join(ROOT, 'phase-040-1k.opus-chunk.json'), chunkBundle.text);
  fs.writeFileSync(path.join(ROOT, 'phase-040-dogfood.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`Phase 040 fixture: ${evidence.populatedCells} cells, ${evidence.layers} Layers, ${evidence.spawnMarkers} markers, ${evidence.ordinaryPrefabObjects} objects, ${evidence.chunkCells} Chunk cells`);
}
main().catch((error) => { console.error(error); process.exit(1); });
