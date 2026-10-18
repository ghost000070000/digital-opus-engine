'use strict';
const assert = require('assert');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const bundles = require('../editor/src/00-tilemap-bundle.js');
async function main() {
  const tileset = plumbing.createTileset({ id: 'ts', name: 'One-Way Tiles', tiles: [
    { id: 'full', name: 'Full', collision: { mode: 'full-cell', oneWay: true } },
    { id: 'custom', name: 'Custom', collision: { mode: 'custom-rect', oneWay: true, rect: { minX: .1, minY: .2, maxX: .9, maxY: .6 } } },
  ] });
  const tilemap = plumbing.createTilemapRecord({ id: 'map', name: 'One-Way Map', tilesetRef: 'ts', layers: [
    { id: 'a', name: 'A', collisionEnabled: true, cells: [{ x: -2, y: 0, tileId: 'full' }, { x: 3, y: 1, tileId: 'custom' }] },
    { id: 'b', name: 'B', collisionEnabled: false, cells: [{ x: 0, y: 0, tileId: 'full' }] },
  ] });
  const root = { ...tilemap, position: [0, 0, 0], scale: [1, 1, 1], rotationY: 0 };
  const project = { tilesets: [tileset], spriteAssets: [], textures: [], prefabs: [], meshAssets: [], audio: [], spriteAnimations: [], sortingLayers: plumbing.defaultSpriteSortingLayers() };
  const first = await bundles.createBundle({ rootKind: 'tilemap', root, project });
  const verified = await bundles.verifyBundleText(first.text);
  assert.deepStrictEqual(verified.bundle.content.root.layers.map((layer) => layer.collisionEnabled), [true, false]);
  const carried = verified.bundle.content.dependencies.tilesets?.[0];
  assert(carried, 'bundle Tileset closure missing');
  assert.deepStrictEqual(carried.tiles.map((tile) => tile.collision.oneWay), [true, true]);
  const second = await bundles.createBundle({ rootKind: 'tilemap', root: verified.bundle.content.root, project: { ...project, tilesets: [carried] } });
  assert.strictEqual(second.text, first.text, 'canonical bundle bytes changed on round-trip');
  console.log(JSON.stringify({ status: 'PASS', bytes: Buffer.byteLength(first.text), sha256: first.sha256, layerFlags: [true, false], oneWayTiles: 2 }));
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
