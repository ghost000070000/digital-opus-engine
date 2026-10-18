'use strict';
// Reusable content: asset default colliders, linked Material record fields and
// propagation, and live prefab propagation, against the actual editor source.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const context = { window: { addEventListener() {} }, document: { addEventListener() {} }, Float32Array, Uint16Array, Uint32Array, Uint8Array, DataView, ArrayBuffer, TextDecoder, Math, JSON, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/opus-engine.js'), 'utf8'), context);
context.Opus = context.window.Opus;
const source = fs.readFileSync(path.join(root, 'editor/src/01-editor.js'), 'utf8');
function link(...names) { for (const name of names) { const fn = source.match(new RegExp(`function ${name}\\([^]*?\\n}`)); assert(fn, `${name} must exist`); vm.runInContext(fn[0], context); } }
const O = context.Opus;
const plain = (v) => JSON.parse(JSON.stringify(v));

{
  link('meshFittedItemCollider', 'meshTrunkItemCollider', 'assetDefaultColliderPreset', 'applyAssetDefaultCollider');
  const assets = require('../tools/showcase-assets');
  const preset = (id) => context.assetDefaultColliderPreset({ id });
  assert.strictEqual(preset('showcase-tree-pine'), 'trunk');
  assert.strictEqual(preset('showcase-bush'), 'none');
  assert.strictEqual(preset('showcase-rock-2'), 'mesh');
  assert.strictEqual(preset('my-imported-model'), null, 'user imports stay non-solid unless declared');
  assert.strictEqual(context.assetDefaultColliderPreset({ id: 'my-imported-model', colliderPreset: 'mesh' }), 'mesh', 'explicit asset metadata wins');
  const make = (key, extra = {}) => ({ kind: 'cube', assetId: 'showcase-' + key, entity: { position: new O.Vec3(0, 0, 0), scale: new O.Vec3(1, 1, 1), quaternion: O.Quat.identity(), solid: false }, ...extra });
  const tree = make('tree-oak'), treeAsset = { ...assets.getMesh('tree-oak'), id: 'showcase-tree-oak' };
  assert(context.applyAssetDefaultCollider(tree, treeAsset) && tree.entity.solid, 'trees are solid on placement');
  const full = context.meshFittedItemCollider(tree, treeAsset);
  assert(tree.collider.size.x < full.size.x * 0.6, 'tree collider is the trunk, not the canopy');
  const bush = make('bush');
  assert(!context.applyAssetDefaultCollider(bush, { ...assets.getMesh('bush'), id: 'showcase-bush' }) && !bush.entity.solid, 'ground cover stays walk-through');
  const authored = make('rock-2', { collider: { shape: 'sphere', radius: 2, offset: { x: 0, y: 0, z: 0 } } });
  assert(!context.applyAssetDefaultCollider(authored, { ...assets.getMesh('rock-2'), id: 'showcase-rock-2' }) && authored.collider.shape === 'sphere', 'authored colliders are never overridden');
}
{
  // Linked Material: record fields mirror the serializer and propagation reaches other levels' records.
  link('materialRecordFields', 'propagateLinkedMaterial');
  const descriptor = O.Material.create({ color: [0.1, 0.2, 0.9], alpha: 0.5, unlit: true, textureAssetRef: null });
  const fields = plain(context.materialRecordFields(descriptor));
  assert.deepStrictEqual(fields, { color: [0.1, 0.2, 0.9], unlit: true, alpha: 0.5, textureDisabled: true });
  const applied = [];
  Object.assign(context, {
    placed: [{ materialRef: 'm1', entity: {} }, { materialRef: 'm2', entity: {} }],
    applyMaterialDescriptorToItem: (item) => { applied.push(item.materialRef); return true; },
    currentLevelIndex: 0,
    levels: [{ objects: [] }, { objects: [{ id: 'r1', materialRef: 'm1', color: [1, 1, 1] }, { id: 'r2', color: [1, 1, 1] }] }],
  });
  assert.strictEqual(context.propagateLinkedMaterial('m1', descriptor), 2, 'one live object and one stored record updated');
  assert.deepStrictEqual(plain(applied), ['m1']);
  assert.deepStrictEqual(plain(context.levels[1].objects[0].color), [0.1, 0.2, 0.9], 'other levels update in their records');
  assert.deepStrictEqual(plain(context.levels[1].objects[1].color), [1, 1, 1], 'unlinked records are untouched');
}
{
  // Live prefab propagation keeps per-instance data and scale overrides.
  link('propagatePrefabToInstances');
  const built = [];
  const entity = (x, s) => ({ position: new O.Vec3(x, 1, 0), scale: new O.Vec3(s, s, s), quaternion: O.Quat.fromEuler(0, 0.5, 0) });
  const src = { id: 'src', sourcePrefabName: 'Kit', entity: entity(0, 1.5) };
  const a = { id: 'a', name: 'A', tags: ['t'], sourcePrefabName: 'Kit', entity: entity(3, 1) };
  const b = { id: 'b', name: 'B', sourcePrefabName: 'Kit', prefabParams: { p: 1 }, entity: entity(6, 2) };
  const other = { id: 'o', sourcePrefabName: 'Other', entity: entity(9, 1) };
  const child = { id: 'c', parentId: 'a', sourcePrefabName: 'Kit', entity: entity(3, 1) };
  Object.assign(context, {
    placed: [src, a, b, other, child],
    itemPosition: (item) => item.entity.position,
    removeItemAndDescendants: (item) => { context.placed = context.placed.filter(p => p !== item && p.parentId !== item.id); },
    instantiateCubeRecord: (record, position) => { const it = { id: 'new' + built.length, entity: { position: position.clone(), scale: new O.Vec3(...record.scale), quaternion: O.Quat.identity(), color: record.color } }; built.push(it); return it; },
    addPlaced: (it) => context.placed.push(it),
    applyPrefabParameters() {}, renderSceneList() {}, updateHierarchyTransforms() {}, hierarchyTickToken: 0,
  });
  const prefab = { name: 'Kit', record: { kind: 'cube', scale: [1.5, 1.5, 1.5], color: [0, 1, 0] } };
  const previous = { name: 'Kit', record: { kind: 'cube', scale: [1, 1, 1], color: [1, 1, 0] } };
  assert.strictEqual(context.propagatePrefabToInstances(prefab, previous, src), 2, 'two other root instances rebuilt');
  const byName = Object.fromEntries(context.placed.filter(p => p.name).map(p => [p.name, p]));
  assert.strictEqual(byName.A.entity.scale.x, 1.5, 'unoverridden scale follows the new prefab');
  assert.strictEqual(byName.B.entity.scale.x, 2, 'overridden scale is kept');
  assert.strictEqual(byName.A.entity.position.x, 3, 'placement is kept');
  assert.deepStrictEqual(plain(byName.A.tags), ['t']);
  assert.deepStrictEqual(plain(byName.B.prefabParams), { p: 1 });
  assert(Math.abs(byName.A.entity.quaternion.y - O.Quat.fromEuler(0, 0.5, 0).y) < 1e-9, 'rotation is kept');
  assert(context.placed.includes(src) && context.placed.includes(other), 'source and other prefabs untouched');
}
console.log('Reusable content: asset default colliders, linked Materials, live prefab propagation PASS');
