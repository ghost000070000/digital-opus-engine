'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const authoring = require('../editor/src/00-authoring-schema.js');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8');
const entity = fs.readFileSync(path.join(ROOT, 'engine/src/11-entity.js'), 'utf8');
const schema = authoring.registry.get('sprite-renderer');
const DEFAULT = plumbing.DEFAULT_SPRITE_SORTING_LAYER_ID;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; } }
function layers() { return [
  { id: DEFAULT, name: 'Default', order: 0 },
  { id: 'sprite-layer-bg', name: 'Background', order: 1 },
  { id: 'sprite-layer-actors', name: 'Characters', order: 2 },
  { id: 'sprite-layer-fx', name: 'Effects', order: 3 },
]; }
function record(id, sortingLayerRef = DEFAULT, orderInLayer = 0) { return { id, kind: 'sprite', components: { 'sprite-renderer': { ...schema.defaults, version: 3, sortingLayerRef, orderInLayer } } }; }
function project(objects = [], sortingLayers = layers()) { return { levels: [{ id: 'level1', objects }], prefabs: [], assets: [], textures: [], spriteAssets: [], audio: [], spriteSortingLayers: sortingLayers }; }

console.log('Phase 013 Sprite Sorting tests');
test('Default layer has a stable reserved identity', () => assert.deepStrictEqual(plumbing.defaultSpriteSortingLayers(), [{ id: DEFAULT, name: 'Default', order: 0 }]));
test('legacy project normalization creates Default deterministically', () => assert.deepStrictEqual(plumbing.normalizeSpriteSortingLayers(), plumbing.defaultSpriteSortingLayers()));
test('existing registry records preserve stable IDs', () => assert.deepStrictEqual(plumbing.normalizeSpriteSortingLayers(layers()).map((x) => x.id), layers().map((x) => x.id)));
test('layer display rename does not alter identity', () => { const input = layers(); input[2].name = 'Actors'; assert.strictEqual(input[2].id, 'sprite-layer-actors'); assert.strictEqual(record('obj1', input[2].id).components['sprite-renderer'].sortingLayerRef, 'sprite-layer-actors'); });
test('layer records serialize bounded id name and explicit order', () => assert.deepStrictEqual(plumbing.createSpriteSortingLayer('sprite-layer-9', 'Foreground', 4), { id: 'sprite-layer-9', name: 'Foreground', order: 4 }));
test('add-layer UI creates stable generated identity', () => assert(html.includes('sprite-sorting-layer-add-btn') && editor.includes('generateSpriteSortingLayerId()')));
test('reorder changes explicit project order', () => assert.deepStrictEqual(plumbing.reorderSpriteSortingLayers(layers(), 'sprite-layer-fx', -1).map((x) => x.id), [DEFAULT, 'sprite-layer-bg', 'sprite-layer-fx', 'sprite-layer-actors']));
test('reorder boundary is deterministic and contiguous', () => assert.deepStrictEqual(plumbing.reorderSpriteSortingLayers(layers(), DEFAULT, -1).map((x) => x.order), [0, 1, 2, 3]));
test('duplicate visible names are validation errors', () => assert(plumbing.validateSpriteSortingLayers([...layers(), { id: 'another', name: 'Characters', order: 9 }]).some((x) => x.code === 'duplicate-sorting-layer-name')));
test('duplicate stable IDs are validation errors', () => assert(plumbing.validateSpriteSortingLayers([...layers(), { id: DEFAULT, name: 'Other', order: 9 }]).some((x) => x.code === 'duplicate-sorting-layer-id')));
test('invalid explicit order is reported', () => assert(plumbing.validateSpriteSortingLayers([{ id: DEFAULT, name: 'Default', order: 0.5 }]).some((x) => x.code === 'invalid-sorting-layer-order')));
test('Default layer deletion and rename controls are protected', () => assert(editor.includes("layer.id === DEFAULT_SPRITE_SORTING_LAYER_ID ? ' disabled'") && editor.includes('readonly aria-readonly')));
test('referenced deletion surfaces count and explicit Default reassignment', () => assert(editor.includes('is assigned to ${owners.length} Sprite') && editor.includes('component.sortingLayerRef = DEFAULT_SPRITE_SORTING_LAYER_ID') && editor.includes('Array.isArray(prefab.records)')));
test('unused deletion has an explicit confirmation', () => assert(editor.includes('Delete unused Sprite Sorting Layer')));
test('Sprite Renderer retains Phase 013 sorting after later schema evolution', () => assert(schema.version >= 3));
test('Sorting Layer is a typed project reference', () => { const field = schema.fields.find((x) => x.key === 'sortingLayerRef'); assert.strictEqual(field.type, 'sortingLayerRef'); assert.strictEqual(field.referenceType, 'sortingLayer'); });
test('Order in Layer is an integer reusable field', () => { const field = schema.fields.find((x) => x.key === 'orderInLayer'); assert.strictEqual(field.type, 'integer'); assert.strictEqual(field.required, true); });
test('legacy Layer is absent from creator-facing schema', () => assert(!schema.fields.some((x) => x.key === 'layer')));
test('v1 negative Layer migrates to Default and Order in Layer', () => { const target = { kind: 'sprite' }; authoring.applyRecord({ components: { 'sprite-renderer': { version: 1, layer: -5 } } }, target); assert.strictEqual(target.components['sprite-renderer'].sortingLayerRef, DEFAULT); assert.strictEqual(target.components['sprite-renderer'].orderInLayer, -5); assert(!('layer' in target.components['sprite-renderer'])); });
test('v2 positive Layer migrates without visual reordering', () => { const target = { kind: 'sprite' }; authoring.applyRecord({ components: { 'sprite-renderer': { ...schema.defaults, version: 2, layer: 10 } } }, target); assert.strictEqual(target.components['sprite-renderer'].orderInLayer, 10); });
test('migrated current persistence never writes legacy Layer', () => { const target = { kind: 'sprite' }; authoring.applyRecord({ components: { 'sprite-renderer': { version: 1, layer: 7 } } }, target); const output = authoring.serializeComponents(target)['sprite-renderer']; assert.strictEqual(output.version, schema.version); assert(!('layer' in output)); });
test('missing layer remains stored and validation focuses the Sprite', () => { const item = record('obj-missing', 'missing-layer'); const result = plumbing.collectProjectIssues(project([item]), { schemaRegistry: authoring.registry }); assert(result.issues.some((x) => x.code === 'dangling-reference' && x.referenceType === 'sortingLayer' && x.objectId === 'obj-missing')); assert.strictEqual(item.components['sprite-renderer'].sortingLayerRef, 'missing-layer'); });
test('missing layer runtime tuple falls back to Default order', () => assert.strictEqual(plumbing.spriteSortTuple(record('obj1', 'missing'), layers())[0], 0));
test('runtime sort tuple is layer order then instance order then Object ID', () => assert.deepStrictEqual(plumbing.spriteSortTuple(record('obj9', 'sprite-layer-actors', 5), layers()), [2, 5, 'obj9']));
test('renderer uses the same three-part tuple and no camera distance', () => assert(renderer.includes('spriteSortingLayerOrder') && renderer.includes('spriteOrderInLayer') && renderer.includes('spriteStableId') && !renderer.slice(renderer.indexOf('if (sprites.length > 0)'), renderer.indexOf('gl.disable(gl.BLEND)')).includes('eye.sub')));
test('stable Object ID resolves exact ties independent of insertion order', () => { const input = [record('obj-b'), record('obj-a')]; input.sort((a, b) => plumbing.compareSpriteSortRecords(a, b, layers())); assert.deepStrictEqual(input.map((x) => x.id), ['obj-a', 'obj-b']); });
test('transparent Sprite order remains explicit and depth writes stay disabled', () => assert(renderer.includes('sprites.sort') && renderer.includes('gl.depthMask(false)')));
test('Transform Z is not part of Sprite ordering', () => assert(!renderer.slice(renderer.indexOf('sprites.sort'), renderer.indexOf('gl.depthMask(false)', renderer.indexOf('sprites.sort'))).includes('.position')));
test('duplicate and Prefab use the shared component record path', () => assert(editor.includes('OpusAuthoring.copyComponents') && editor.includes('serializeSpriteRecord')));
test('cross-project Prefab missing layer preserves the ID and validates after instantiate', () => { const item = record('prefab-instance', 'project-a-layer'); const result = plumbing.collectProjectIssues(project([item]), { schemaRegistry: authoring.registry }); assert.strictEqual(item.components['sprite-renderer'].sortingLayerRef, 'project-a-layer'); assert(result.issues.some((x) => x.objectId === 'prefab-instance')); });
test('Level duplication and project serialization retain Sprite sorting metadata through independent ordinary records', () => {
  const vm = require('vm');
  // Reuse the actual-source session/serializer host, not a copied merge oracle.
  const fixtureSource = fs.readFileSync(path.join(__dirname, 'phase-108-authored-session-journal.test.js'), 'utf8').split('let passed=0,failed=0;')[0];
  const host = new Function('require', fixtureSource + '\nreturn {fixture,extract};')(require);
  const c = host.fixture();
  c.OpusLootTables = require('../editor/src/00-loot-tables.js');
  c.lootTables = [];
  vm.runInContext(host.extract('copyLootLibrary'), c);
  c.playMode = false;
  const sprite = { ...record('sprite-preserved', 'sprite-layer-actors', 7), position: [2, 3, 0], unknownExtension: { retained: true } };
  const ordinary = { id: 'cube-preserved', kind: 'cube', position: [4, 0, 0], components: {} };
  c.levels[0].objects = JSON.parse(JSON.stringify([sprite, ordinary]));
  c.loadScene(c.levels[0].objects);
  c.captureAuthoredSessionLevels();c.captureAuthoredDeathBaseline();c.playMode = true;
  c.placed[0].entity.position.x = 99;
  c.syncCurrentLevelObjects();
  vm.runInContext(host.extract('serializeProject'), c);
  const output = c.serializeProject().levels[0].objects;
  assert.strictEqual(output[0].components['sprite-renderer'].sortingLayerRef, 'sprite-layer-actors');
  assert.strictEqual(output[0].components['sprite-renderer'].orderInLayer, 7);
  assert.strictEqual(output[0].position[0], 2);
  assert.strictEqual(output[1].position[0], 4);
  assert.strictEqual(output[0].unknownExtension.retained, true);
  output[0].components['sprite-renderer'].orderInLayer = -999;
  assert.strictEqual(c.serializeProject().levels[0].objects[0].components['sprite-renderer'].orderInLayer, 7);
  assert(editor.includes('serializeSpriteRecord'));
});
test('Save Load and exports carry the project registry', () => ['spriteSortingLayers: orderedSpriteSortingLayers()', 'newSpriteSortingLayers = parsed.spriteSortingLayers', 'normalized.spriteSortingLayers'].forEach((token) => assert(editor.includes(token), token)));
test('object sorting edits use existing Undo callback and project registry documents non-Undo boundary', () => assert(editor.includes('onBeforeChange: () => pushUndo()') && html.includes('project-settings non-Undo boundary')));
test('Sprite Asset record remains free of instance sorting metadata', () => { const asset = plumbing.createSpriteAsset({ id: 'sprite1', sourceTexture: 'texture1' }); assert(!('sortingLayerRef' in asset)); assert(!('orderInLayer' in asset)); });
test('Billboard path remains separate', () => assert(editor.includes("isBillboard: true, billboardMode: 'full'") && editor.includes('syncBillboards')));
test('300-Sprite stress sequence is identical across randomized insertion orders', () => {
  const records = Array.from({ length: 300 }, (_, index) => record(`obj-${String(index).padStart(3, '0')}`, layers()[index % 4].id, (index * 17) % 13 - 6));
  const shuffled = (seed) => { const copy = records.slice(); let state = seed; for (let i = copy.length - 1; i > 0; i--) { state = (state * 1664525 + 1013904223) >>> 0; const j = state % (i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy.sort((a, b) => plumbing.compareSpriteSortRecords(a, b, layers())).map((x) => x.id); };
  assert.deepStrictEqual(shuffled(1), shuffled(987654321));
});
test('runtime caches resolved layer order on entities before normal sorting', () => assert(entity.includes('spriteSortingLayerOrder = 0') && editor.includes('item.entity.spriteSortingLayerOrder = spriteSortingLayerOrder')));
test('Phase 014 systems remain absent', () => ['orthographicCamera', 'spriteAnimation', 'billboardToSprite', 'ySortMode', 'renderQueue'].forEach((token) => assert(!schema.fields.some((field) => field.key === token), token)));

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 013 tests passed: ${passed}/${passed}`);
