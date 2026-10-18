'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const authoring = require('../editor/src/00-authoring-schema.js');
const plumbing = require('../editor/src/00-authoring-plumbing.js');

let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; } }
function sprite(extra = {}) { return { kind: 'sprite', ...extra }; }
const schema = authoring.registry.get('sprite-renderer');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8');
const entity = fs.readFileSync(path.join(ROOT, 'engine/src/11-entity.js'), 'utf8');

console.log('Phase 011 Sprite tests');
test('Sprite has explicit scene identity and palette entry', () => assert(editor.includes("kind: 'sprite'") && html.includes('id="palette-sprite"')));
test('Sprite Renderer has stable schema identity', () => assert.strictEqual(schema.id, 'sprite-renderer'));
test('Sprite Renderer is automatic rather than creator-attachable', () => assert.strictEqual(schema.addable, false));
test('Sprite Renderer retains Phase 011 appearance fields and legacy layer migration', () => { ['sourceTexture', 'width', 'height', 'pivotX', 'pivotY', 'tint', 'visible'].forEach((key) => assert(schema.fields.some((field) => field.key === key), key)); assert(schema.runtimeFields.includes('layer')); });
test('Texture remains a typed Texture Asset compatibility reference', () => { const f = schema.fields.find((field) => field.key === 'sourceTexture'); assert.strictEqual(f.type, 'assetRef'); assert.deepStrictEqual(f.allowedAssetTypes, ['texture']); });
test('creation defaults remain one unit, centered, white, opaque, visible, unflipped, directionless, Default order zero', () => { const target = sprite(); authoring.ensureComponent(target, 'sprite-renderer'); assert.deepStrictEqual(target.components['sprite-renderer'], { version: 9, spriteAssetRef: null, renderMode: 'simple', animationStates: [], initialAnimationStateRef: null, initialDirection: 'none', playOnStart: false, sourceTexture: null, width: 1, height: 1, pivotX: 0.5, pivotY: 0.5, tint: '#ffffff', opacity: 1, visible: true, flipX: false, flipY: false, sortingLayerRef: 'sprite-layer-default', orderInLayer: 0, parallaxLayerRef: null }); });
test('width and height reject non-positive values', () => { const target = sprite({ components: { 'sprite-renderer': { ...schema.defaults, version: 1, width: 0, height: -2 } } }); const codes = authoring.validateComponent(target, 'sprite-renderer').map((x) => x.code); assert(codes.includes('below-minimum')); assert(codes.includes('sprite-width-positive')); assert(codes.includes('sprite-height-positive')); });
test('pivot fields normalize and validate to zero-to-one', () => { const target = sprite(); authoring.applyRecord({ components: { 'sprite-renderer': { ...schema.defaults, pivotX: -1, pivotY: 2 } } }, target); assert.strictEqual(target.components['sprite-renderer'].pivotX, 0); assert.strictEqual(target.components['sprite-renderer'].pivotY, 1); });
test('tint uses shared color normalization', () => { const target = sprite({ components: { 'sprite-renderer': { ...schema.defaults, tint: '#A1B2C3' } } }); assert.strictEqual(authoring.serializeComponents(target)['sprite-renderer'].tint, '#a1b2c3'); });
test('visible applies to the live entity', () => { const target = sprite({ entity: {}, components: { 'sprite-renderer': { ...schema.defaults, visible: false } } }); authoring.ensureComponent(target, 'sprite-renderer'); assert.strictEqual(target.entity.visible, false); });
test('legacy layer rounds into deterministic Order in Layer', () => { const target = sprite({ entity: {}, components: { 'sprite-renderer': { version: 1, layer: 2.7 } } }); authoring.ensureComponent(target, 'sprite-renderer'); assert.strictEqual(target.components['sprite-renderer'].orderInLayer, 3); assert.strictEqual(target.entity.spriteOrderInLayer, 3); });
test('component round trip is stable', () => { const source = sprite({ components: { 'sprite-renderer': { ...schema.defaults, version: 1, sourceTexture: 'texture1', width: 3, height: 2, pivotX: 0.25, tint: '#44aaee', layer: -1 } } }); const first = authoring.serializeComponents(source); const restored = sprite(); authoring.applyRecord({ components: first }, restored); assert.deepStrictEqual(authoring.serializeComponents(restored), first); });
test('duplicate path deep-copies Sprite Renderer data', () => { const source = sprite({ components: { 'sprite-renderer': { ...schema.defaults, version: 1, width: 4 } } }); const copy = sprite(); authoring.copyComponents(source, copy); copy.components['sprite-renderer'].width = 9; assert.strictEqual(source.components['sprite-renderer'].width, 4); });
test('undo snapshots are independent serialized values', () => { const target = sprite(); authoring.ensureComponent(target, 'sprite-renderer'); const before = authoring.serializeComponents(target); target.components['sprite-renderer'].width = 8; authoring.applyRecord({ components: before }, target); assert.strictEqual(target.components['sprite-renderer'].width, 1); });
test('missing Texture remains preserved and is a Project Validation error', () => { const record = { kind: 'sprite', id: 'obj1', components: { 'sprite-renderer': { ...schema.defaults, version: 1, sourceTexture: 'missing-texture' } } }; const result = plumbing.collectProjectIssues({ levels: [{ id: 'level1', objects: [record] }], textures: [], assets: [], audio: [], prefabs: [] }, { schemaRegistry: authoring.registry }); assert.strictEqual(record.components['sprite-renderer'].sourceTexture, 'missing-texture'); assert(result.issues.some((x) => x.code === 'dangling-reference' && x.objectId === 'obj1')); });
test('Texture picker filters out non-Texture assets', () => { const project = { assets: [{ id: 'mesh1', name: 'Mesh' }], textures: [{ id: 'texture1', name: 'Texture' }], spriteAssets: [{ id: 'spriteAsset1', name: 'Sprite' }], audio: [{ id: 'audio1', name: 'Audio' }] }; const field = schema.fields.find((entry) => entry.key === 'sourceTexture'); assert.deepStrictEqual(plumbing.getReferenceOptions('asset', project, field).map((x) => x.value), ['texture1']); });
test('renderer has a separate Sprite pass with named order and stable-ID tie break', () => assert(renderer.includes('const sprites = []') && renderer.includes('(a.spriteSortingLayerOrder || 0) - (b.spriteSortingLayerOrder || 0)') && renderer.includes("a.spriteStableId || ''")));
test('Sprite path remains depth tested and disables only depth writes', () => assert(renderer.includes('sprites.length > 0') && renderer.includes('gl.depthMask(false)')));
test('Sprite rendering is flat and supplies a missing-texture placeholder', () => assert(renderer.includes('entity.unlit || entity.spriteRenderer') && renderer.includes('entity.spriteMissingTexture')));
test('pivot changes geometry around the Transform origin', () => assert(entity.includes('(0.5 - pivotX) * width') && entity.includes('(0.5 - pivotY) * height')));
test('viewport selection uses pivot-aware oriented bounds', () => assert(editor.includes('x >= -sprite.pivotX * sprite.width') && editor.includes('hit.dot(entity.right)')));
test('Move Rotate Scale gizmos include Sprite', () => assert(editor.includes("return selectedItem.kind === 'cube' || selectedItem.kind === 'sprite'")));
test('save load prefab level and export share ordinary record paths', () => ['serializeSpriteRecord', 'instantiateSpriteRecord', 'serializeItemRecord(rootItem)', "record.kind === 'sprite'"].forEach((token) => assert(editor.includes(token), token)));
test('dependency collection includes Sprite source Texture', () => assert(editor.includes("renderer.sourceTexture) dep.textureAssets.add(renderer.sourceTexture)")));
test('Billboard remains its own camera-facing cube compatibility path', () => assert(editor.includes("isBillboard: true, billboardMode: 'full'") && editor.includes('syncBillboards')));
test('future rendering systems remain absent from Sprite Renderer schema', () => ['atlas', 'animation', 'pixelsPerUnit', 'collider'].forEach((key) => assert(!schema.fields.some((field) => field.key === key), key)));

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 011 tests passed: ${passed}/${passed}`);
