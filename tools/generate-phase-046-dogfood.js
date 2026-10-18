'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'qualification', 'phase-046');
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function cube(id, name, x, y, width, options = {}) {
  return { kind: 'cube', id, name, position: [x, y, 0], scale: [1, 1, 1], color: [0.3, 0.82, 0.65], ...(options.invisible ? { alpha: 0 } : {}), rotationY: 0,
    ...(options.rotated ? { quaternion: [0, 0, Math.sin(.15), Math.cos(.15)] } : {}), behaviors: [], components: {
      'body-2d': { version: 1, enabled: true, type: 'static', linearVelocity: [0, 0] },
      'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [width, 1] },
      'one-way-platform-2d': { version: 1, enabled: true },
    } };
}
function elevate(source, extended) {
  const project = clone(source);
  project.levels[0].id = 'phase-046-level'; project.levels[0].name = 'Phase 046 One-Way Platform Lab'; project.currentLevelId = 'phase-046-level';
  project.meta.title = 'Phase 046 One-Way Platform Lab'; project.meta.internalOnly = true;
  project.world.description = 'Internal Character-only one-way support qualification; movement is supplied by the test harness.';
  const objects = project.levels[0].objects;
  objects.push(cube('one-way-scene', 'Scene one-way ledge', 0, 0, 4), cube('one-way-invisible', 'Invisible one-way ledge', -10, 0, 4, { invisible: true }), cube('one-way-rotated', 'Rotated solid fallback', 20, 0, 4, { rotated: true }));
  const tileset = project.tilesets.find((set) => set.id === 'char-tiles'); tileset.version = 5;
  tileset.tiles.push({ id: 'one-way-full', name: 'One-Way Full', spriteAssetRef: 'char-sprite', collision: { mode: 'full-cell', oneWay: true } },
    { id: 'one-way-custom', name: 'One-Way Custom', spriteAssetRef: 'char-sprite', collision: { mode: 'custom-rect', oneWay: true, rect: { minX: .1, minY: .2, maxX: .9, maxY: .6 } } });
  const map = objects.find((item) => item.id === 'char-map');
  map.layers[0].cells.push({ x: 8, y: 0, tileId: 'one-way-full' }, { x: 12, y: 0, tileId: 'one-way-custom' }, { x: -12, y: 0, tileId: 'one-way-full' });
  map.layers[1].cells.push({ x: 16, y: 0, tileId: 'one-way-full' });
  project.prefabs.push({ name: 'One-Way Ledge', record: clone(objects.find((item) => item.id === 'one-way-scene')) });
  if (extended) {
    const variants = project.tilesets.find((set) => set.id === 'variants'); variants.version = 5;
    variants.tiles.push({ id: 'one-way-scale', name: 'One-Way Scale', spriteAssetRef: 'char-sprite', collision: { mode: 'full-cell', oneWay: true } });
    const scaleMap = objects.find((item) => item.id === 'scale-map');
    for (let i = 0; i < scaleMap.layers[0].cells.length; i += 5) scaleMap.layers[0].cells[i].tileId = 'one-way-scale';
  }
  return project;
}
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [source, filename, extended] of [
    ['phase-045-project.json', 'phase-046-project.json', false],
    ['phase-045-dogfood.json', 'phase-046-dogfood.json', true],
  ]) {
    const target = path.join(OUT, filename);
    if (fs.existsSync(target) && !process.argv.includes('--force')) throw Error(`Refusing to overwrite ${target}; pass --force only for this generated fixture.`);
    const input = JSON.parse(fs.readFileSync(path.join(ROOT, 'qualification', 'phase-045', source), 'utf8'));
    const output = elevate(input, extended);
    fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`${filename}: ${output.levels[0].objects.length} objects, ${output.tilesets.length} Tilesets`);
  }
}
main();
