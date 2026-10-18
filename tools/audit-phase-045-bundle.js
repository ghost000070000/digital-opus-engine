'use strict';
const assert = require('assert');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const bundles = require('../editor/src/00-tilemap-bundle.js');
async function main() {
  const tileset = plumbing.createTileset({ id: 'ts', name: 'Tiles', tiles: [{ id: 'solid', name: 'Solid', collision: { mode: 'full-cell' } }] });
  const tilemap = plumbing.createTilemapRecord({ id: 'map', name: 'Map', tilesetRef: 'ts', layers: [
    { id: 'collision', name: 'Collision', collisionEnabled: true, cells: [{ x: 0, y: 0, tileId: 'solid' }] },
    { id: 'art', name: 'Art', collisionEnabled: false, cells: [{ x: 1, y: 0, tileId: 'solid' }] },
  ] });
  const root = { ...tilemap, position: [0, 0, 0], scale: [1, 1, 1], rotationY: 0 };
  const project = { tilesets: [tileset], spriteAssets: [], textures: [], prefabs: [], meshAssets: [], audio: [], spriteAnimations: [], sortingLayers: plumbing.defaultSpriteSortingLayers() };
  const created = await bundles.createBundle({ rootKind: 'tilemap', root, project });
  const verified = await bundles.verifyBundleText(created.text);
  assert.deepStrictEqual(verified.bundle.content.root.layers.map((layer) => layer.collisionEnabled), [true, false]);
  const normalized = plumbing.createTilemapRecord(verified.bundle.content.root);
  assert.deepStrictEqual(normalized.layers.map((layer) => layer.collisionEnabled), [true, false]);
  console.log(JSON.stringify({ bytes: Buffer.byteLength(created.text), checksum: created.sha256, layerFlags: normalized.layers.map((layer) => layer.collisionEnabled) }));
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
