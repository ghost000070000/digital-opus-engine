'use strict';

const assert = require('assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const authoring = require(path.join(ROOT, 'editor', 'src', '00-authoring-schema.js'));
const plumbing = require(path.join(ROOT, 'editor', 'src', '00-authoring-plumbing.js'));

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`ok ${passed} - ${name}`); }
  catch (error) { failed++; console.error(`not ok - ${name}\n${error.stack}`); }
}
function makeRegistry() {
  const registry = new authoring.AuthoringSchemaRegistry();
  registry.register({ id: 'reference-proof', displayName: 'Reference Proof', category: 'Test', version: 1, eligibility: ['any'], fields: [
    { key: 'asset', type: 'assetRef', required: true, nullable: false, allowedAssetTypes: ['texture'] },
    { key: 'object', type: 'objectRef', required: true, nullable: false, allowSelf: false, scope: 'current-level' },
    { key: 'level', type: 'levelRef', required: true }, { key: 'objective', type: 'objectiveRef', required: true, scope: 'current-level' },
    { key: 'prefab', type: 'prefabRef', required: true }, { key: 'optionalObject', type: 'objectRef', nullable: true },
  ], defaults: { asset: null, object: null, level: null, objective: null, prefab: null, optionalObject: null } });
  return registry;
}
function project(component) {
  return { levels: [{ id: 'level1', name: 'First', objectiveDefs: [{ id: 'objective1', title: 'Collect' }], objects: [
    { kind: 'cube', id: 'source', name: 'Source', components: { 'reference-proof': component } }, { kind: 'cube', id: 'target', name: 'Target' },
  ] }], prefabs: [{ name: 'Crate', record: { kind: 'cube', id: 'prefab-root' } }],
  spriteSortingLayers: [{ id: 'sprite-layer-default', name: 'Default', order: 0 }],
  itemDefs: [{ id: 'item-proof', name: 'Proof Item' }],
  parallaxLayers: [{ id: 'parallax-default-proof', name: 'Proof', factorX: 0.5, factorY: 0.5 }],
  assets: [{ id: 'mesh1', name: 'Mesh', type: 'mesh', positions: [], normals: [], indices: [] }],
  textures: [{ id: 'texture1', name: 'Texture', dataURL: 'data:image/png;base64,AA==' }], audio: [{ id: 'audio1', name: 'Audio', dataURL: 'data:audio/wav;base64,AA==' }] };
}
const validComponent = { version: 1, asset: 'texture1', object: 'target', level: 'level1', objective: 'objective1', prefab: 'Crate', optionalObject: null };

test('reference option service returns stable object labels and ids', () => assert.deepStrictEqual(plumbing.getReferenceOptions('object', { objects: [{ id: 'b', name: 'Beta' }, { id: 'a', name: 'Alpha' }] }).map((x) => x.value), ['a', 'b']));
test('reference option service returns levels, objectives and prefabs', () => { const p = project(validComponent); const c = { levels: p.levels, prefabs: p.prefabs }; assert.strictEqual(plumbing.getReferenceOptions('level', c)[0].value, 'level1'); assert.strictEqual(plumbing.getReferenceOptions('objective', c)[0].value, 'objective1'); assert.strictEqual(plumbing.getReferenceOptions('prefab', c)[0].value, 'Crate'); });
test('asset options combine existing libraries and filter allowed types', () => assert.deepStrictEqual(plumbing.getReferenceOptions('asset', project(validComponent), { allowedAssetTypes: ['texture'] }).map((x) => x.value), ['texture1']));
test('object descriptor can exclude self', () => assert.deepStrictEqual(plumbing.getReferenceOptions('object', { objects: [{ id: 'self' }, { id: 'other' }], currentObjectId: 'self' }, { allowSelf: false }).map((x) => x.value), ['other']));
test('current-level scope excludes objects from other levels', () => assert.deepStrictEqual(plumbing.getReferenceOptions('object', { levels: [{ id: 'a', objects: [{ id: 'one' }] }, { id: 'b', objects: [{ id: 'two' }] }], currentLevelId: 'a' }, { scope: 'current-level' }).map((x) => x.value), ['one']));
test('descriptors retain required, nullable, allowed type, self and scope metadata', () => { const f = makeRegistry().get('reference-proof').fields; assert(f.some((x) => x.required && x.nullable === false)); assert(f.some((x) => x.allowedAssetTypes)); assert(f.some((x) => x.allowSelf === false && x.scope === 'current-level')); });
test('reference index inventories every supported identity class', () => { const i = plumbing.buildReferenceIndex(project(validComponent), { schemaRegistry: makeRegistry(), inputActions: [{ id: 'jump', name: 'Jump' }] }); for (const type of plumbing.REFERENCE_TYPES) assert(i.maps[type].size > 0, type); });
test('reference index records structured component usage and focus location', () => { const i = plumbing.buildReferenceIndex(project(validComponent), { schemaRegistry: makeRegistry() }); const use = i.uses.find((x) => x.field === 'object'); assert.strictEqual(use.objectId, 'source'); assert.strictEqual(use.levelId, 'level1'); });
for (const [field, type] of [['object', 'object'], ['asset', 'asset'], ['level', 'level'], ['objective', 'objective'], ['prefab', 'prefab']]) test(`dangling ${type} reference is reported without clearing its value`, () => { const component = { ...validComponent, [field]: 'gone' }; const result = plumbing.collectProjectIssues(project(component), { schemaRegistry: makeRegistry() }); const found = result.issues.find((x) => x.code === 'dangling-reference' && x.referenceType === type); assert(found); assert.strictEqual(found.referenceValue, 'gone'); assert.strictEqual(component[field], 'gone'); });
test('nullable empty reference is accepted', () => assert(!plumbing.collectProjectIssues(project(validComponent), { schemaRegistry: makeRegistry() }).issues.some((x) => x.field === 'optionalObject')));
test('required empty reference is an error', () => assert(plumbing.collectProjectIssues(project({ ...validComponent, object: null }), { schemaRegistry: makeRegistry() }).issues.some((x) => x.code === 'required-reference-missing' && x.field === 'object')));
test('wrong asset class is reported', () => assert(plumbing.collectProjectIssues(project({ ...validComponent, asset: 'audio1' }), { schemaRegistry: makeRegistry() }).issues.some((x) => x.code === 'invalid-reference-type')));
test('newer component warning retains focus metadata', () => { const result = plumbing.collectProjectIssues(project({ ...validComponent, version: 9 }), { schemaRegistry: makeRegistry() }); const found = result.issues.find((x) => x.code === 'newer-version'); assert.strictEqual(found.severity, 'warning'); assert.strictEqual(found.objectId, 'source'); });
test('duplicate prohibited identity is reported', () => { const p = project(validComponent); p.levels[0].objects.push({ kind: 'cube', id: 'target' }); assert(plumbing.collectProjectIssues(p, { schemaRegistry: makeRegistry() }).issues.some((x) => x.code === 'duplicate-identity' && x.referenceType === 'object')); });
test('component issues aggregate into project issues', () => { const p = project(validComponent); p.levels[0].objects[0] = { kind: 'cube', id: 'source', components: { health: { version: 1, max: 0, current: 4 } } }; assert(plumbing.collectProjectIssues(p, { schemaRegistry: authoring.registry }).issues.some((x) => x.componentId === 'health' && x.objectId === 'source')); });
test('issue records use the bounded severity vocabulary', () => assert(plumbing.collectProjectIssues(project({ ...validComponent, object: 'gone' }), { schemaRegistry: makeRegistry() }).issues.every((x) => plumbing.SEVERITIES.includes(x.severity))));
test('structured rename propagation touches only declared owners', () => { const owner = { targetId: 'old' }; const uses = [{ referenceType: 'object', referenceValue: 'old', owner, key: 'targetId' }]; assert.strictEqual(plumbing.propagateStructuredRename(uses, 'object', 'old', 'new'), 1); assert.strictEqual(owner.targetId, 'new'); });
test('rename propagation never rewrites Custom Script or dialogue prose', () => { const data = { code: 'find("old")', dialogue: 'Ask old for help' }; plumbing.propagateStructuredRename([], 'object', 'old', 'new'); assert.deepStrictEqual(data, { code: 'find("old")', dialogue: 'Ask old for help' }); });
test('stable id reference survives display-label rename without propagation', () => { const p = project(validComponent); p.levels[0].objects[1].name = 'Renamed'; assert.strictEqual(p.levels[0].objects[0].components['reference-proof'].object, 'target'); });
test('dangling values and unknown safe data survive JSON round trip', () => { const p = project({ ...validComponent, object: 'missing', future: { safe: true } }); const restored = JSON.parse(JSON.stringify(p)); assert.strictEqual(restored.levels[0].objects[0].components['reference-proof'].object, 'missing'); assert(restored.levels[0].objects[0].components['reference-proof'].future.safe); });
test('asset registry retains existing types and adds derived authoring assets through the same registry', () => assert.deepStrictEqual(plumbing.assetTypes.listTypes().map((x) => x.id), ['mesh', 'texture', 'sprite', 'sprite-animation', 'tileset', 'tilemap-chunk', 'audio']));
test('asset registry rejects duplicate type ids', () => assert.throws(() => plumbing.assetTypes.register({ id: 'mesh', displayName: 'Again', category: 'Test' }), /already registered/));
test('MIME and extension normalization are case-insensitive', () => { assert.strictEqual(plumbing.normalizeMime('IMAGE/PNG; charset=x'), 'image/png'); assert.strictEqual(plumbing.normalizeExtension('PNG'), '.png'); });
test('file matching resolves Mesh, Texture and Audio adapters', () => { assert.strictEqual(plumbing.assetTypes.findForFile('model.GLB', '').id, 'mesh'); assert.strictEqual(plumbing.assetTypes.findForFile('image.PNG', '').id, 'texture'); assert.strictEqual(plumbing.assetTypes.findForFile('sound.WAV', '').id, 'audio'); });
test('skinnedMesh compatibility resolves to Mesh', () => assert.strictEqual(plumbing.assetTypes.resolveType({ type: 'skinnedMesh' }).id, 'mesh'));
test('existing Mesh, Texture and Audio metadata validate', () => { const p = project(validComponent); assert.deepStrictEqual(plumbing.assetTypes.validate(p.assets[0], 'mesh'), []); assert.deepStrictEqual(plumbing.assetTypes.validate(p.textures[0], 'texture'), []); assert.deepStrictEqual(plumbing.assetTypes.validate(p.audio[0], 'audio'), []); });
test('unknown asset type is a preservation warning', () => assert.strictEqual(plumbing.assetTypes.validate({ id: 'x' }, 'future')[0].code, 'unknown-asset-type'));
test('invalid registered asset metadata is reported', () => assert.strictEqual(plumbing.assetTypes.validate({ id: 'texture2', name: 'Broken' }, 'texture')[0].code, 'invalid-asset-metadata'));
test('asset types can be filtered for library presentation', () => assert.deepStrictEqual(plumbing.assetTypes.listTypes({ category: 'Audio' }).map((x) => x.id), ['audio']));
test('future derived asset declares a source and dependency', () => { const registry = new plumbing.AssetTypeRegistry(); registry.register({ id: 'sprite-proof', displayName: 'Sprite Proof', category: 'Images', sourceType: 'texture', dependencies: (asset) => [{ assetType: 'texture', id: asset.sourceTexture }] }); assert.strictEqual(registry.get('sprite-proof').sourceType, 'texture'); assert.deepStrictEqual(registry.getDependencies({ sourceTexture: 'texture1' }, 'sprite-proof'), [{ assetType: 'texture', id: 'texture1' }]); });
test('current adapters need no extra derived dependencies', () => assert.deepStrictEqual(plumbing.assetTypes.getDependencies(project(validComponent).textures[0], 'texture'), []));

console.log(`\nPhase 003 authoring plumbing: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
