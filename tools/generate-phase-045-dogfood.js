'use strict';
// Deterministic generated qualification asset; never enters the public catalog.
const fs = require('fs');
const path = require('path');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const ROOT = path.resolve(__dirname, '..');
const output = path.join(ROOT, 'qualification', 'phase-045', 'phase-045-dogfood.json');
if (fs.existsSync(output) && !process.argv.includes('--force')) throw new Error(`Refusing to overwrite existing dogfood project: ${output}`);
const project = JSON.parse(JSON.stringify(require('../qualification/phase-045/phase-045-project.json')));
const objects = project.levels[0].objects;
const staticBox = (id, position, size) => ({ kind: 'cube', id, name: id, position, scale: [1, 1, 1], color: [.45, .55, .75], rotationY: 0, behaviors: [],
  components: { 'body-2d': { version: 1, enabled: true, type: 'static', linearVelocity: [0, 0] }, 'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size } } });
objects.push(staticBox('static-floor', [15, 0, 0], [10, 1]));
project.tilesets.push(plumbing.createTileset({ id: 'variants', name: 'Collision Variants', cellSize: { width: 1.5, height: .75 }, tiles: [
  { id: 'full', name: 'Full Cell', spriteAssetRef: 'char-sprite', collision: { mode: 'full-cell' } },
  { id: 'custom', name: 'Custom Rectangle', spriteAssetRef: 'char-sprite', collision: { mode: 'custom-rect', rect: { minX: .15, minY: .2, maxX: .85, maxY: .8 } } },
  { id: 'none', name: 'No Collision', spriteAssetRef: 'char-sprite', collision: { mode: 'none' } },
], autoTileSets: [{ id: 'future-auto', name: 'Auto', neighborMode: 'four-way', defaultTileId: 'full', rules: Array.from({ length: 16 }, (_, mask) => ({ mask, tileId: 'full' })) }],
  terrainBrushes: [{ id: 'future-terrain', name: 'Terrain', mode: 'weighted-tiles', seed: 42, variants: [{ tileId: 'full', weight: 1 }] }] }));
const cell = (x, y, tileId, extras) => ({ x, y, tileId, ...(extras || {}) });
objects.push({ kind: 'tilemap', version: 5, id: 'variant-map', name: 'Rotated scaled multilayer collision', position: [30, 0, 0], scale: [1.5, .8, 1],
  rotationY: 0, quaternion: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)], tilesetRef: 'variants', sortingLayerRef: 'sprite-layer-default', orderInLayer: 0, spawnMarkers: [],
  layers: [
    { id: 'base', name: 'Full', visible: true, locked: false, collisionEnabled: true, cells: [cell(-3, 0, 'full'), cell(-2, 0, 'full')] },
    { id: 'custom', name: 'Custom', visible: true, locked: false, collisionEnabled: true, cells: [cell(-1, 0, 'custom')] },
    { id: 'none', name: 'None', visible: true, locked: false, collisionEnabled: true, cells: [cell(0, 0, 'none')] },
    { id: 'disabled', name: 'Disabled', visible: true, locked: false, collisionEnabled: false, cells: [cell(1, 0, 'full')] },
    { id: 'hidden', name: 'Hidden collision', visible: false, locked: false, collisionEnabled: true, cells: [cell(2, 0, 'full')] },
    { id: 'locked', name: 'Locked collision', visible: true, locked: true, collisionEnabled: true, cells: [cell(3, 0, 'full')] },
    { id: 'terrain', name: 'Terrain resolved Tile', visible: true, locked: false, collisionEnabled: true, cells: [cell(4, 0, 'full', { terrainBrushId: 'future-terrain' })] },
    { id: 'auto', name: 'Auto-Tile resolved Tile', visible: true, locked: false, collisionEnabled: true, cells: [cell(5, 0, 'full', { autoTileSetId: 'future-auto' })] },
  ] });
const largeCells = Array.from({ length: 10240 }, (_, i) => cell(i % 128, Math.floor(i / 128), i < 128 ? 'full' : 'none'));
objects.push({ kind: 'tilemap', version: 5, id: 'scale-map', name: '10,240-cell sparse-query map', position: [100, 0, 0], scale: [1, 1, 1], rotationY: 0,
  tilesetRef: 'variants', sortingLayerRef: 'sprite-layer-default', orderInLayer: 0, spawnMarkers: [],
  layers: [{ id: 'scale', name: 'Scale', visible: true, locked: false, collisionEnabled: true, cells: largeCells }] });
project.prefabs.push({ name: 'Character Probe', record: { kind: 'cube', id: 'prefab-character-probe', name: 'Character Probe', position: [0, 4, 0], scale: [1, 1, 1], color: [.2, .8, .75], rotationY: 0, behaviors: [],
  components: JSON.parse(JSON.stringify(objects.find((item) => item.id === 'mover').components)) } });
fs.writeFileSync(output, JSON.stringify(project, null, 2) + '\n');
console.log(JSON.stringify({ output, bytes: fs.statSync(output).size, objects: objects.length, scaleCells: largeCells.length, publicCatalog: false }));
