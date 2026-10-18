'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const sprite = require('../editor/src/00-sprite-authoring.js');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const schema = fs.readFileSync(path.join(ROOT, 'editor/src/00-authoring-schema.js'), 'utf8');
const packagedSources = ['build/build-games.js', 'build/build-games-site.js', 'build/build-engine-site.js'].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS ' + name); }
  catch (error) { console.error('  FAIL ' + name + '\n' + error.stack); process.exitCode = 1; }
}

console.log('Phase 015 Sprite direct-authoring tests');
test('center pivot produces centered authored bounds', () => assert.deepStrictEqual(sprite.bounds({ width: 4, height: 2, pivotX: 0.5, pivotY: 0.5 }), { width: 4, height: 2, pivotX: 0.5, pivotY: 0.5, left: -2, right: 2, bottom: -1, top: 1 }));
test('corner pivot produces exact authored bounds', () => { const b = sprite.bounds({ width: 4, height: 2, pivotX: 0, pivotY: 1 }); assert.strictEqual(Math.abs(b.left), 0); assert.strictEqual(b.right, 4); assert.strictEqual(b.bottom, -2); assert.strictEqual(b.top, 0); });
test('invalid dimensions normalize safely', () => { const b = sprite.bounds({ width: 0, height: NaN, pivotX: 0.5, pivotY: 0.5 }); assert.strictEqual(b.width, 1); assert.strictEqual(b.height, 1); });
test('pivot values clamp to normalized range', () => { const b = sprite.bounds({ width: 1, height: 1, pivotX: -3, pivotY: 4 }); assert.strictEqual(b.pivotX, 0); assert.strictEqual(b.pivotY, 1); });
test('east handle edits Width', () => assert.deepStrictEqual(sprite.resize({ width: 2, height: 3, pivotX: 0.5, pivotY: 0.5 }, 'e', 1, 0, false, 0), { width: 4, height: 3 }));
test('west handle respects the current pivot', () => assert.deepStrictEqual(sprite.resize({ width: 2, height: 3, pivotX: 0.5, pivotY: 0.5 }, 'w', -1, 0, false, 0), { width: 4, height: 3 }));
test('north handle edits Height', () => assert.deepStrictEqual(sprite.resize({ width: 3, height: 2, pivotX: 0.5, pivotY: 0.5 }, 'n', 0, 1, false, 0), { width: 3, height: 4 }));
test('south handle edits Height', () => assert.deepStrictEqual(sprite.resize({ width: 3, height: 2, pivotX: 0.5, pivotY: 0.5 }, 's', 0, -1, false, 0), { width: 3, height: 4 }));
test('corner handle edits both dimensions', () => assert.deepStrictEqual(sprite.resize({ width: 2, height: 2, pivotX: 0.5, pivotY: 0.5 }, 'ne', 1, 0.5, false, 0), { width: 4, height: 3 }));
test('resize cannot collapse below minimum size', () => { const n = sprite.resize({ width: 1, height: 1, pivotX: 0.5, pivotY: 0.5 }, 'ne', -20, -20, false, 0); assert.strictEqual(n.width, sprite.MIN_SIZE); assert.strictEqual(n.height, sprite.MIN_SIZE); });
test('an origin-pinned edge cannot explode Width or Height', () => assert.deepStrictEqual(sprite.resize({ width: 2, height: 3, pivotX: 0, pivotY: 1 }, 'nw', -10, 10, false, 0), { width: 2, height: 3 }));
test('horizontal aspect lock uses gesture-start aspect', () => assert.deepStrictEqual(sprite.resize({ width: 4, height: 2, pivotX: 0.5, pivotY: 0.5 }, 'e', 1, 0, true, 0), { width: 6, height: 3 }));
test('vertical aspect lock uses gesture-start aspect', () => assert.deepStrictEqual(sprite.resize({ width: 4, height: 2, pivotX: 0.5, pivotY: 0.5 }, 'n', 0, 1, true, 0), { width: 8, height: 4 }));
test('resize reuses existing scale snap increment', () => assert.deepStrictEqual(sprite.resize({ width: 2, height: 2, pivotX: 0.5, pivotY: 0.5 }, 'e', 0.31, 0, false, 0.25), { width: 2.5, height: 2 }));
test('pivot drag derives normalized artwork coordinates', () => assert.deepStrictEqual(sprite.pivotFromLocalPoint({ width: 4, height: 2, pivotX: 0.5, pivotY: 0.5 }, 1, -0.5), { pivotX: 0.75, pivotY: 0.25 }));
test('pivot drag clamps outside points', () => assert.deepStrictEqual(sprite.pivotFromLocalPoint({ width: 2, height: 2, pivotX: 0.5, pivotY: 0.5 }, -5, 5), { pivotX: 0, pivotY: 1 }));
test('nine common pivot presets are present', () => assert.strictEqual(Object.keys(sprite.PIVOT_PRESETS).length, 9));
test('center preset is exact', () => assert.deepStrictEqual(sprite.pivotPreset('center'), { pivotX: 0.5, pivotY: 0.5 }));
test('bottom-left preset is exact', () => assert.deepStrictEqual(sprite.pivotPreset('bottom-left'), { pivotX: 0, pivotY: 0 }));
test('top-right preset is exact', () => assert.deepStrictEqual(sprite.pivotPreset('top-right'), { pivotX: 1, pivotY: 1 }));
test('unknown preset falls back to center', () => assert.deepStrictEqual(sprite.pivotPreset('unknown'), { pivotX: 0.5, pivotY: 0.5 }));
test('natural size is pixels divided by pixels-per-unit', () => assert.deepStrictEqual(sprite.naturalSize({ sourceWidth: 256, sourceHeight: 128, pixelsPerUnit: 64 }), { width: 4, height: 2 }));
test('natural size reports unavailable metadata', () => assert.strictEqual(sprite.naturalSize({ sourceWidth: 0, sourceHeight: 128, pixelsPerUnit: 64 }), null));
test('viewport contains the projected Sprite frame', () => assert(html.includes('id="sprite-direct-frame"') && html.includes('<polygon points="">')));
test('viewport exposes eight resize handles', () => assert.strictEqual((html.match(/<button class="sprite-direct-handle" data-sprite-resize=/g) || []).length, 8));
test('viewport exposes a pivot handle', () => assert(html.includes('id="sprite-pivot-handle"')));
test('frame applies resolved orientation and Transform Scale', () => assert(editor.includes('entity.right.scale(localX * entity.scale.x)') && editor.includes('entity.up.scale(localY * entity.scale.y)')));
test('drag conversion uses projected local axes under rotation', () => assert(editor.includes('const determinant = xAxis.x * yAxis.y - xAxis.y * yAxis.x') && editor.includes('Solve the two projected local axes')));
test('frame projects after hierarchy and Billboard resolution', () => assert(editor.includes('updateHierarchyTransforms(); syncBillboards();')));
test('direct manipulation is single-Sprite only', () => assert(editor.includes("selectedItems.size !== 1 || !selectedItem || selectedItem.kind !== 'sprite'")));
test('resize writes component Width and Height', () => assert(editor.includes('component.width = next.width; component.height = next.height;')));
test('pivot writes component Pivot fields', () => assert(editor.includes('component.pivotX = next.pivotX; component.pivotY = next.pivotY;')));
test('one Undo snapshot is taken on first gesture movement', () => assert(editor.includes('if (!state.moved) { pushUndo(); state.moved = true; }')));
test('Inspector values synchronize during viewport gestures', () => assert(editor.includes('syncSpriteInspectorGeometryFields(component);')));
test('aspect lock is optional editor-only state', () => assert(editor.includes('let spriteAspectLock = false')));
test('Inspector has Source Geometry Appearance Sorting groups', () => ['Source', 'Geometry', 'Appearance', 'Sorting'].forEach((name) => assert(editor.includes(`'${name}'`))));
test('Inspector names all nine presets exactly', () => ['Top Left', 'Top Center', 'Top Right', 'Left Center', 'Center', 'Right Center', 'Bottom Left', 'Bottom Center', 'Bottom Right'].forEach((label) => assert(editor.includes(`>${label}<`), label)));
test('Inspector offers Use Natural Size', () => assert(editor.includes('>Use Natural Size</button>')));
test('Sprite Renderer remains the geometry owner', () => { assert(schema.includes('ownedFields:')); ['width', 'height', 'pivotX', 'pivotY'].forEach((key) => assert(schema.includes(`key: '${key}'`) && schema.includes(`'${key}'`))); });
test('editor export embeds Sprite authoring module', () => assert(editor.includes('spriteAuthoringJS') && editor.includes('${spriteAuthoringJS}')));
test('all public packaging paths include Sprite authoring module', () => packagedSources.forEach((source) => assert(source.includes('00-sprite-authoring.js'))));

if (process.exitCode) process.exit(process.exitCode);
console.log('Phase 015 tests passed: ' + passed + '/' + passed);
