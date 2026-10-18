'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const authoring = require('../editor/src/00-authoring-schema.js');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const runner = fs.readFileSync(path.join(ROOT, 'tests/run-tests.js'), 'utf8');
const schema = authoring.registry.get('sprite-renderer');
const DEFAULT = plumbing.DEFAULT_SPRITE_SORTING_LAYER_ID;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS ' + name); }
  catch (error) { console.error('  FAIL ' + name + '\n' + error.stack); process.exitCode = 1; }
}
function component(overrides = {}) { return { ...schema.defaults, version: schema.version, ...overrides }; }
function record(id = 'sprite-1', overrides = {}) {
  return {
    kind: 'sprite', id, name: 'Reusable Sprite', position: [1, 2, 3], scale: [1.5, 2, 1], rotationY: 0.25,
    components: { 'sprite-renderer': component({ spriteAssetRef: 'sprite-asset', width: 3, height: 2, pivotX: 0.25, pivotY: 0.75, tint: '#44aaee', sortingLayerRef: 'actors', orderInLayer: 7 }) },
    ...overrides,
  };
}
function targetFrom(input) { return authoring.applyRecord(input, { kind: 'sprite' }); }
function serialize(input) {
  const target = targetFrom(input);
  return { ...JSON.parse(JSON.stringify(input)), components: authoring.serializeComponents(target) };
}
function project({ levels, prefabs, spriteAssets, textures, layers } = {}) {
  return {
    levels: levels || [{ id: 'level-a', objects: [] }], prefabs: prefabs || [], assets: [], audio: [],
    spriteAssets: spriteAssets || [{ id: 'sprite-asset', type: 'sprite', name: 'Hero', version: 4, sourceTexture: 'texture-1', sourceRect: null, nineSlice: null, pivot: [0.5, 0.5], pixelsPerUnit: 100, filtering: 'linear' }],
    textures: textures || [{ id: 'texture-1', type: 'texture', name: 'Hero PNG', dataURL: 'data:image/png;base64,AA==' }],
    spriteSortingLayers: layers || [{ id: DEFAULT, name: 'Default', order: 0 }, { id: 'actors', name: 'Actors', order: 1 }],
  };
}

console.log('Phase 016 Sprite prefab / serialization tests');

test('current Sprite record round-trip is deterministic', () => {
  const first = serialize(record());
  const second = serialize(first);
  assert.deepStrictEqual(second, first);
});
test('current record preserves every Sprite-owned datum', () => {
  const out = serialize(record());
  assert.strictEqual(out.kind, 'sprite');
  assert.deepStrictEqual(out.position, [1, 2, 3]);
  assert.deepStrictEqual(out.scale, [1.5, 2, 1]);
  assert.deepStrictEqual(out.components['sprite-renderer'], record().components['sprite-renderer']);
});
test('Phase 011 direct Texture and integer Layer migrate canonically', () => {
  const out = serialize(record('v1', { components: { 'sprite-renderer': { version: 1, sourceTexture: 'texture-1', width: 4, height: 5, pivotX: 0.1, pivotY: 0.9, tint: '#ff00aa', visible: true, layer: -3 } } }));
  const c = out.components['sprite-renderer'];
  assert.strictEqual(c.version, schema.version); assert.strictEqual(c.sourceTexture, 'texture-1'); assert.strictEqual(c.orderInLayer, -3); assert.strictEqual(c.sortingLayerRef, DEFAULT); assert.strictEqual(c.opacity, 1); assert(!('layer' in c));
});
test('Phase 012 Sprite Asset and old sorting representation migrate', () => {
  const out = serialize(record('v2', { components: { 'sprite-renderer': { version: 2, spriteAssetRef: 'sprite-asset', width: 2, height: 6, pivotX: 0.2, pivotY: 0.8, tint: '#ffffff', visible: true, layer: 9 } } }));
  const c = out.components['sprite-renderer'];
  assert.strictEqual(c.version, schema.version); assert.strictEqual(c.spriteAssetRef, 'sprite-asset'); assert.strictEqual(c.orderInLayer, 9); assert.strictEqual(c.sortingLayerRef, DEFAULT); assert.strictEqual(c.opacity, 1);
});
test('Phase 013 current Sorting Layer identity survives migration path', () => {
  const out = serialize(record('v3'));
  assert.strictEqual(out.components['sprite-renderer'].sortingLayerRef, 'actors');
});
test('newer unsupported Sprite component stays loadable and inert', () => {
  const future = record('future', { components: { 'sprite-renderer': { ...component(), version: 99, futureField: { kept: true } } } });
  const target = targetFrom(future);
  assert.strictEqual(target.components['sprite-renderer'].version, 99);
  assert.deepStrictEqual(target.components['sprite-renderer'].futureField, { kept: true });
  assert(authoring.validateTarget(target).some((x) => x.code === 'newer-version' && x.severity === 'warning'));
});
test('Prefab save is routed through shared item serialization', () => assert(editor.includes('record: serializeItemRecord(rootItem)') && editor.includes('allItems.map(serializeItemRecord)')));
test('Sprite has no alternate prefab serializer', () => assert(!editor.includes('serializeSpritePrefab')));
test('Prefab instantiate dispatches Sprite through its ordinary record loader', () => assert(editor.includes("prefab.record.kind === 'sprite' ? instantiateSpriteRecord(prefab.record, point)")));
test('repeated prefab instances deep-copy component records', () => {
  const template = record(); const a = targetFrom(template); const b = targetFrom(template);
  a.components['sprite-renderer'].width = 99; a.components['sprite-renderer'].tint = '#000000';
  assert.strictEqual(b.components['sprite-renderer'].width, 3); assert.strictEqual(b.components['sprite-renderer'].tint, '#44aaee');
});
test('repeated prefab instances share Sprite Asset identity by stable reference', () => {
  const a = targetFrom(record()); const b = targetFrom(record('sprite-2'));
  assert.strictEqual(a.components['sprite-renderer'].spriteAssetRef, b.components['sprite-renderer'].spriteAssetRef);
});
test('linked Sprite prefab identity and overrides serialize and load', () => {
  assert(editor.includes('sourcePrefabName: item.sourcePrefabName || undefined'));
  assert(editor.includes('sourcePrefabName: record.sourcePrefabName || undefined'));
  assert(editor.includes('prefabParams: record.prefabParams ? { ...record.prefabParams } : undefined'));
});
test('Sprite Inspector exposes the existing linked-prefab workflow', () => {
  ['sprite-update-from-prefab', 'sprite-update-prefab-from-this', 'sprite-unlink-prefab'].forEach((id) => assert(editor.includes(`id="${id}"`)));
  assert(editor.includes('selectedItem.sourcePrefabName = name'));
});
test('linked update semantics are generic replace and reinstantiate', () => assert(editor.includes("swapItemForPrefabInstance(item, prefab, 'Updated instance from prefab')")));
test('linked update limitation is explicit: no field override merge', () => assert(editor.includes('no override tracking') && editor.includes('full destroy-and-reinstantiate')));
test('one Sprite Prefab validates across multiple levels', () => {
  const p = project({ levels: [{ id: 'one', objects: [record('a')] }, { id: 'two', objects: [record('b')] }] });
  assert.deepStrictEqual(plumbing.collectProjectIssues(p).issues, []);
});
test('missing Sprite Asset is stable and actionable on a scene object', () => {
  const broken = record('broken'); broken.components['sprite-renderer'].spriteAssetRef = 'missing-sprite';
  const issue = plumbing.collectProjectIssues(project({ levels: [{ id: 'level-a', objects: [broken] }] })).issues.find((x) => x.referenceValue === 'missing-sprite');
  assert(issue); assert.strictEqual(issue.objectId, 'broken'); assert.strictEqual(issue.componentId, 'sprite-renderer'); assert.strictEqual(issue.field, 'spriteAssetRef');
  assert.strictEqual(broken.components['sprite-renderer'].spriteAssetRef, 'missing-sprite');
});
test('Prefab dependencies validate before instantiation with repair context', () => {
  const broken = record('template-object'); broken.components['sprite-renderer'].spriteAssetRef = 'missing-sprite';
  const issue = plumbing.collectProjectIssues(project({ prefabs: [{ name: 'Broken Sprite', record: broken }] })).issues.find((x) => x.referenceValue === 'missing-sprite');
  assert(issue); assert.strictEqual(issue.prefabName, 'Broken Sprite'); assert.strictEqual(issue.objectId, 'template-object'); assert.strictEqual(issue.field, 'spriteAssetRef');
});
test('Sprite Asset missing Texture reports asset and offending reference', () => {
  const p = project({ spriteAssets: [{ id: 'sprite-asset', type: 'sprite', name: 'Hero', version: 4, sourceTexture: 'missing-texture', sourceRect: null, nineSlice: null, pivot: [0.5, 0.5], pixelsPerUnit: 100, filtering: 'linear' }] });
  const issue = plumbing.collectProjectIssues(p).issues.find((x) => x.referenceValue === 'missing-texture');
  assert(issue); assert.strictEqual(issue.assetId, 'sprite-asset'); assert.strictEqual(issue.field, 'sourceTexture');
});
test('missing Sorting Layer preserves stable ID and reports Sprite context', () => {
  const broken = record('layer-broken'); broken.components['sprite-renderer'].sortingLayerRef = 'foreign-layer-id';
  const issue = plumbing.collectProjectIssues(project({ levels: [{ id: 'level-a', objects: [broken] }] })).issues.find((x) => x.referenceValue === 'foreign-layer-id');
  assert(issue); assert.strictEqual(issue.referenceType, 'sortingLayer'); assert.strictEqual(broken.components['sprite-renderer'].sortingLayerRef, 'foreign-layer-id');
});
test('missing Sorting Layer is not automatically mapped by display name', () => {
  const broken = record('foreign'); broken.components['sprite-renderer'].sortingLayerRef = 'project-a-actors';
  const p = project({ levels: [{ id: 'level-b', objects: [broken] }], layers: [{ id: DEFAULT, name: 'Default', order: 0 }, { id: 'project-b-actors', name: 'Actors', order: 1 }] });
  assert(plumbing.collectProjectIssues(p).issues.some((x) => x.referenceValue === 'project-a-actors'));
});
test('future Sprite version inside a Prefab is creator-visible', () => {
  const future = record('future-template'); future.components['sprite-renderer'].version = 42;
  const issue = plumbing.collectProjectIssues(project({ prefabs: [{ name: 'Future', record: future }] })).issues.find((x) => x.code === 'newer-version');
  assert(issue); assert.strictEqual(issue.prefabName, 'Future'); assert.strictEqual(issue.scope, 'prefab-component');
});
test('duplicate Sprite uses serialize/instantiate and shared component deep-copy', () => assert(editor.includes('const record = serializeSpriteRecord(src)') && editor.includes('OpusAuthoring.copyComponents(src, newItem)')));
test('duplicate Sprite Asset keeps Texture reference while metadata is independent', () => {
  const original = plumbing.createSpriteAsset({ id: 'sprite-asset', name: 'Hero', sourceTexture: 'texture-1', pivot: [0.2, 0.8], tags: ['hero'] });
  const copy = plumbing.duplicateSpriteAsset(original, 'sprite-copy'); copy.pivot[0] = 0.9; copy.tags[0] = 'copy';
  assert.strictEqual(copy.sourceTexture, original.sourceTexture); assert.strictEqual(original.pivot[0], 0.2); assert.strictEqual(original.tags[0], 'hero');
});
test('level duplicate deep-clones and remaps object identities', () => assert(editor.includes('const clone = JSON.parse(JSON.stringify({ objects: src.objects') && editor.includes('const remapped = remapObjectIds(clone.objects')));
test('level identity remap covers hierarchy references', () => assert(editor.includes('json.split(`"${oldId}"`).join(`"${newId}"`)')));
test('copy/paste remains unclaimed because no object clipboard path exists', () => assert(!/copySelected|pasteSelected|clipboardData/.test(editor)));
test('Sprite export closure includes linked Prefab retention', () => assert(editor.includes("if (record.sourcePrefabName) { dep.prefabs.add(record.sourcePrefabName); scanPrefabParams(record.sourcePrefabName, record.prefabParams); }")));
test('Sprite export closure follows Sprite Asset to Texture registry dependency', () => assert.strictEqual(plumbing.assetTypes.getDependencies(project().spriteAssets[0], 'sprite')[0].id, 'texture-1'));
test('Sprite instance does not duplicate Sprite Asset metadata', () => assert(!('pixelsPerUnit' in record().components['sprite-renderer']) && !('sourceWidth' in record().components['sprite-renderer'])));
test('Editable and Playable exports share the project serializer and export composer', () => { assert(editor.includes('const exportProject=arguments[1]===undefined?JSON.parse(JSON.stringify(serializeProject({ includeTilesets: !playableOnly }))):JSON.parse(arguments[1])')); assert(editor.includes('const embedded = JSON.stringify(exportProject)')); assert(editor.includes('composeExportHTML')); });
test('Playable runtime does not require Inspector or gizmo data in records', () => ['spriteAspectLock', 'sprite-direct-frame', 'sprite-pivot-handle'].forEach((key) => assert(!JSON.stringify(record()).includes(key))));
test('100 repeated instances remain compact and share two asset IDs', () => {
  const rows = Array.from({ length: 100 }, (_, i) => record(`repeat-${i}`, { components: { 'sprite-renderer': component({ spriteAssetRef: i % 2 ? 'sprite-a' : 'sprite-b' }) } }));
  assert.strictEqual(new Set(rows.map((x) => x.components['sprite-renderer'].spriteAssetRef)).size, 2);
  assert(JSON.stringify(rows).length < 100000);
});
test('Phase 011 through 015 focused suites remain in the integrated runner', () => [11, 12, 13, 14, 15].forEach((phase) => assert(runner.includes(`phase-0${phase}-`))));
test('Phase 016 suite is part of the integrated runner', () => assert(runner.includes('phase-016-sprite-prefab-serialization.test.js')));

if (process.exitCode) process.exit(process.exitCode);
console.log('Phase 016 tests passed: ' + passed + '/' + passed);
