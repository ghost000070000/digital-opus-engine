'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const authoring = require('../editor/src/00-authoring-schema.js');
const plumbing = require('../editor/src/00-authoring-plumbing.js');

const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const renderer = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8');
const mesh = fs.readFileSync(path.join(ROOT, 'engine/src/08-mesh.js'), 'utf8');
const schema = authoring.registry.get('sprite-renderer');
const type = plumbing.assetTypes.get('sprite');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; } }
function spriteAsset(extra = {}) { return plumbing.createSpriteAsset({ id: 'sprite-a', name: 'Sprite A', sourceTexture: 'texture-shared', ...extra }); }
function spriteRecord(extra = {}) { return { kind: 'sprite', components: { 'sprite-renderer': { ...schema.defaults, ...extra } } }; }

console.log('Phase 017 Sprite Material tests');
test('Sprite Asset presentation metadata remains present in current version', () => assert.strictEqual(type.version, 4));
test('new Sprite Assets default to Smooth sampling', () => assert.strictEqual(spriteAsset().filtering, 'linear'));
test('Phase 012 records without filtering migrate to Smooth', () => assert.deepStrictEqual(spriteAsset({ version: 1 }).filtering, 'linear'));
test('Pixel sampling persists as a bounded stable value', () => { const asset = spriteAsset({ filtering: 'nearest' }); assert.strictEqual(asset.filtering, 'nearest'); assert.deepStrictEqual(type.validateMetadata(asset), []); });
test('unknown sampling values normalize to Smooth', () => assert.strictEqual(spriteAsset({ filtering: 'cubic' }).filtering, 'linear'));
test('invalid unnormalized metadata is reported', () => assert(type.validateMetadata({ ...spriteAsset(), filtering: 'cubic' }).some((issue) => issue.code === 'sprite-filtering-mode')));
test('duplicate retains filtering but owns independent metadata', () => { const source = spriteAsset({ filtering: 'nearest', pivot: [0.25, 0.75] }); const copy = plumbing.duplicateSpriteAsset(source, 'sprite-b'); copy.pivot[0] = 0.9; assert.strictEqual(copy.filtering, 'nearest'); assert.strictEqual(source.pivot[0], 0.25); });
test('same Texture can back Smooth and Pixel Sprite Assets without duplicating bytes', () => { const smooth = spriteAsset({ id: 'smooth', filtering: 'linear' }); const pixel = spriteAsset({ id: 'pixel', filtering: 'nearest' }); assert.strictEqual(smooth.sourceTexture, pixel.sourceTexture); for (const asset of [smooth, pixel]) { assert(!('dataURL' in asset)); assert(!('image' in asset)); } });
test('missing source preserves intended filtering for later repair', () => { const asset = spriteAsset({ sourceTexture: 'missing-texture', filtering: 'nearest' }); const project = { levels: [], prefabs: [], assets: [], textures: [], spriteAssets: [asset], audio: [] }; const result = plumbing.collectProjectIssues(project, { schemaRegistry: authoring.registry }); assert.strictEqual(asset.filtering, 'nearest'); assert(result.issues.some((issue) => issue.referenceValue === 'missing-texture')); });
test('filtering does not change PPU pivot or natural-size math', () => { const texture = { width: 320, height: 180 }; assert.deepStrictEqual(plumbing.spriteNaturalSize(spriteAsset({ filtering: 'linear', pixelsPerUnit: 100 }), texture), plumbing.spriteNaturalSize(spriteAsset({ filtering: 'nearest', pixelsPerUnit: 100 }), texture)); assert.deepStrictEqual(spriteAsset({ filtering: 'nearest', pivot: [0.2, 0.8] }).pivot, [0.2, 0.8]); });
test('dedicated pixel-art proof fixture is a generated local PNG', () => { const fixture = fs.readFileSync(path.join(ROOT, 'tests/fixtures/phase-017-pixel-art.png')); assert.deepStrictEqual([...fixture.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]); assert(fs.readFileSync(path.join(ROOT, 'tools/generate-phase-017-pixel-art.js'), 'utf8').includes("chunk('IDAT'")); });
test('Sprite Asset Inspector exposes only Smooth and Pixel / Nearest', () => assert(editor.includes("choices: ['linear', 'nearest']") && editor.includes("linear: 'Smooth'") && editor.includes("nearest: 'Pixel / Nearest'")));
test('sampling changes resync placed Sprites immediately', () => assert(editor.includes("field.key === 'filtering'") && editor.includes("if (item.kind === 'sprite') syncSpriteRenderer(item)")));
test('runtime sampling comes from the resolved Sprite Asset', () => assert(editor.includes("spriteAsset && spriteAsset.filtering === 'nearest' ? 'nearest' : 'linear'")));
test('legacy direct Texture Sprites fall back to Smooth', () => { const sync = editor.slice(editor.indexOf('function syncSpriteRenderer'), editor.indexOf('function syncSpriteRenderer') + 3200); assert(sync.includes("? 'nearest' : 'linear'")); });
test('renderer creates exactly two cached sampler objects', () => assert(renderer.includes('linear: gl.createSampler()') && renderer.includes('nearest: gl.createSampler()')));
test('Smooth preserves historical mipmapped linear sampling', () => assert(renderer.includes('gl.LINEAR_MIPMAP_LINEAR') && renderer.includes('this.textureSamplers.linear, gl.TEXTURE_MAG_FILTER, gl.LINEAR')));
test('Pixel uses nearest sampling for both minification and magnification', () => assert(renderer.includes('this.textureSamplers.nearest, gl.TEXTURE_MIN_FILTER, gl.NEAREST') && renderer.includes('this.textureSamplers.nearest, gl.TEXTURE_MAG_FILTER, gl.NEAREST')));
test('sampler selection occurs on the shared texture draw without texture recreation', () => { const draw = renderer.slice(renderer.indexOf('_drawEntity('), renderer.indexOf('_drawSkybox(')); assert(draw.includes('gl.bindTexture(gl.TEXTURE_2D, entity.texture)')); assert(draw.includes("entity.textureSampling === 'nearest'")); assert(!draw.includes('createTextureFromImage')); });
test('cached samplers are released with renderer resources', () => assert(renderer.includes('gl.deleteSampler(sampler)')));
test('Texture upload still owns one mipmapped source and unchanged orientation', () => assert(mesh.includes('gl.generateMipmap(gl.TEXTURE_2D)') && mesh.includes('gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)')));
test('Sprite Renderer exposes bounded opacity and defaults to one', () => { const field = schema.fields.find((entry) => entry.key === 'opacity'); assert(field); assert.strictEqual(field.min, 0); assert.strictEqual(field.max, 1); assert.strictEqual(schema.defaults.opacity, 1); });
test('old Sprite Renderer records migrate to fully opaque', () => { const target = { kind: 'sprite', entity: {} }; authoring.applyRecord({ components: { 'sprite-renderer': { version: 3, width: 2, height: 3 } } }, target); assert.strictEqual(target.components['sprite-renderer'].version, 9); assert.strictEqual(target.components['sprite-renderer'].opacity, 1); assert.strictEqual(target.entity.alpha, 1); });
test('opacity clamps at both inspector contract limits', () => { const low = { kind: 'sprite', entity: {} }; const high = { kind: 'sprite', entity: {} }; authoring.applyRecord(spriteRecord({ opacity: -2 }), low); authoring.applyRecord(spriteRecord({ opacity: 5 }), high); assert.strictEqual(low.components['sprite-renderer'].opacity, 0); assert.strictEqual(high.components['sprite-renderer'].opacity, 1); });
test('opacity serializes and round-trips through the shared component path', () => { const source = { kind: 'sprite', entity: {} }; authoring.applyRecord(spriteRecord({ opacity: 0.35 }), source); const saved = authoring.serializeComponents(source); const restored = { kind: 'sprite', entity: {} }; authoring.applyRecord({ components: saved }, restored); assert.strictEqual(restored.components['sprite-renderer'].opacity, 0.35); assert.strictEqual(restored.entity.alpha, 0.35); });
test('source alpha and opacity compose in the shader path', () => assert(renderer.includes('gl.uniform1f(this.uAlpha, entity.alpha') && renderer.includes('gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)')));
test('sorting and pivot contracts remain present beside material controls', () => ['sortingLayerRef', 'orderInLayer', 'pivotX', 'pivotY'].forEach((key) => assert(schema.fields.some((field) => field.key === key), key)));
test('no alpha-mode blend-mode or cutout zoo was introduced', () => ['blendMode', 'alphaMode', 'alphaCutoff', 'cutout'].forEach((key) => assert(!schema.fields.some((field) => field.key === key), key)));
test('Mesh and Billboard paths retain the Smooth fallback', () => assert(renderer.includes("entity.textureSampling === 'nearest' ? 'nearest' : 'linear'")));
test('Phase 017 suite is wired into the full runner', () => assert(fs.readFileSync(path.join(ROOT, 'tests/run-tests.js'), 'utf8').includes('phase-017-sprite-material.test.js')));

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 017 tests passed: ${passed}/${passed}`);
