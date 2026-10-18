'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const authoring = require('../editor/src/00-authoring-schema.js');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const mesh = fs.readFileSync(path.join(ROOT, 'engine/src/08-mesh.js'), 'utf8');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; } }
function sprite(extra = {}) { return plumbing.createSpriteAsset({ id: 'sprite-a', name: 'Cell', sourceTexture: 'atlas', filtering: 'nearest', pixelsPerUnit: 16, ...extra }); }
const texture = { id: 'atlas', name: 'Atlas', width: 128, height: 128, dataURL: 'data:image/png;base64,AA==' };

console.log('Phase 018 Sprite Atlas tests');
test('Sprite Asset schema retains atlas support in current version', () => assert.strictEqual(plumbing.assetTypes.get('sprite').version, 4));
test('older full-image assets migrate without an explicit rectangle', () => { const a = sprite({ version: 2 }); assert.strictEqual(a.version, 4); assert.strictEqual(a.sourceRect, null); });
test('full-image compatibility preserves historical UVs', () => assert.deepStrictEqual(plumbing.spriteSourceUV(sprite(), texture), { scale: [1, 1], offset: [0, 0], fullImage: true }));
test('source rectangle is deep-copied into canonical metadata', () => { const input = { x: 1, y: 2, width: 3, height: 4 }; const a = sprite({ sourceRect: input }); input.x = 99; assert.deepStrictEqual(a.sourceRect, { x: 1, y: 2, width: 3, height: 4 }); });
test('rect validation accepts an in-bounds region', () => assert.deepStrictEqual(plumbing.validateSpriteSourceRect(sprite({ sourceRect: { x: 96, y: 96, width: 32, height: 32 } }), texture), []));
test('rect validation rejects negative origins', () => assert.strictEqual(plumbing.validateSpriteSourceRect(sprite({ sourceRect: { x: -1, y: 0, width: 32, height: 32 } }), texture)[0].code, 'sprite-source-rect-invalid'));
test('rect validation rejects non-positive dimensions', () => assert.strictEqual(plumbing.validateSpriteSourceRect(sprite({ sourceRect: { x: 0, y: 0, width: 0, height: 32 } }), texture)[0].code, 'sprite-source-rect-invalid'));
test('rect validation rejects right and bottom overflow', () => assert.strictEqual(plumbing.validateSpriteSourceRect(sprite({ sourceRect: { x: 97, y: 96, width: 32, height: 33 } }), texture)[0].code, 'sprite-source-rect-bounds'));
test('missing source is reported separately without destroying region metadata', () => { const a = sprite({ sourceRect: { x: 4, y: 5, width: 6, height: 7 } }); assert.strictEqual(plumbing.validateSpriteSourceRect(a, null)[0].code, 'sprite-source-unavailable'); assert.deepStrictEqual(a.sourceRect, { x: 4, y: 5, width: 6, height: 7 }); });
test('top-left origin maps top-left cell correctly', () => assert.deepStrictEqual(plumbing.spriteSourceUV(sprite({ sourceRect: { x: 0, y: 0, width: 32, height: 32 } }), texture), { scale: [0.25, 0.25], offset: [0, 0.75], fullImage: false }));
test('top-right cell UV is correct', () => assert.deepStrictEqual(plumbing.spriteSourceUV(sprite({ sourceRect: { x: 96, y: 0, width: 32, height: 32 } }), texture).offset, [0.75, 0.75]));
test('bottom-left cell UV is correct', () => assert.deepStrictEqual(plumbing.spriteSourceUV(sprite({ sourceRect: { x: 0, y: 96, width: 32, height: 32 } }), texture).offset, [0, 0]));
test('bottom-right cell UV is correct', () => assert.deepStrictEqual(plumbing.spriteSourceUV(sprite({ sourceRect: { x: 96, y: 96, width: 32, height: 32 } }), texture).offset, [0.75, 0]));
test('center region UV is correct', () => assert.deepStrictEqual(plumbing.spriteSourceUV(sprite({ sourceRect: { x: 32, y: 32, width: 64, height: 64 } }), texture), { scale: [0.5, 0.5], offset: [0.25, 0.25], fullImage: false }));
test('Smooth uses central half-texel inset while Nearest is exact', () => { const rect = { x: 32, y: 32, width: 32, height: 32 }; const near = plumbing.spriteSourceUV(sprite({ sourceRect: rect }), texture); const smooth = plumbing.spriteSourceUV(sprite({ sourceRect: rect, filtering: 'linear' }), texture); assert.deepStrictEqual(near.scale, [0.25, 0.25]); assert.deepStrictEqual(smooth.scale, [31 / 128, 31 / 128]); assert.deepStrictEqual(smooth.offset, [32.5 / 128, 64.5 / 128]); });
test('natural size uses region dimensions', () => assert.deepStrictEqual(plumbing.spriteNaturalSize(sprite({ sourceRect: { x: 10, y: 20, width: 32, height: 48 }, pixelsPerUnit: 16 }), texture), { width: 2, height: 3 }));
test('pivot stays normalized metadata relative to its region', () => assert.deepStrictEqual(sprite({ sourceRect: { x: 10, y: 20, width: 32, height: 48 }, pivot: [0.5, 0] }).pivot, [0.5, 0]));
test('regular 4x4 slicing produces 16 ordered top-origin cells', () => { const rects = plumbing.sliceSpriteGrid(128, 128, { cellWidth: 32, cellHeight: 32 }); assert.strictEqual(rects.length, 16); assert.deepStrictEqual(rects[0], { x: 0, y: 0, width: 32, height: 32 }); assert.deepStrictEqual(rects[15], { x: 96, y: 96, width: 32, height: 32 }); });
test('grid slicing supports bounded margin and spacing', () => assert.deepStrictEqual(plumbing.sliceSpriteGrid(70, 38, { cellWidth: 16, cellHeight: 16, marginX: 2, marginY: 2, spacingX: 2, spacingY: 2 }).slice(0, 2), [{ x: 2, y: 2, width: 16, height: 16 }, { x: 20, y: 2, width: 16, height: 16 }]));
test('bulk names are deterministic and avoid collisions', () => assert.deepStrictEqual(plumbing.spriteGridNames('hero', 3, ['hero_001']), ['hero_001 (2)', 'hero_002', 'hero_003']));
test('bulk assets can share one Texture with unique stable IDs', () => { const rects = plumbing.sliceSpriteGrid(64, 32, { cellWidth: 32, cellHeight: 32 }); const assets = rects.map((sourceRect, i) => sprite({ id: `sprite-${i}`, sourceRect })); assert.strictEqual(new Set(assets.map((a) => a.id)).size, 2); assert.strictEqual(new Set(assets.map((a) => a.sourceTexture)).size, 1); assets.forEach((a) => assert(!('dataURL' in a))); });
test('duplicate owns independent source rectangle and pivot', () => { const a = sprite({ sourceRect: { x: 0, y: 0, width: 32, height: 32 }, pivot: [0.25, 0.75] }); const b = plumbing.duplicateSpriteAsset(a, 'sprite-b'); b.sourceRect.x = 32; b.pivot[0] = 1; assert.strictEqual(a.sourceRect.x, 0); assert.strictEqual(a.pivot[0], 0.25); });
test('project validation reports out-of-bounds atlas metadata', () => { const result = plumbing.collectProjectIssues({ levels: [], prefabs: [], assets: [], textures: [texture], spriteAssets: [sprite({ sourceRect: { x: 120, y: 0, width: 32, height: 32 } })], audio: [] }, { schemaRegistry: authoring.registry }); assert(result.issues.some((i) => i.code === 'sprite-source-rect-bounds')); });
test('serialized Sprite Asset round-trip has no region drift', () => { const a = sprite({ sourceRect: { x: 3, y: 7, width: 29, height: 31 }, pivot: [0.2, 0.8], filtering: 'linear' }); assert.deepStrictEqual(plumbing.createSpriteAsset(JSON.parse(JSON.stringify(a))), a); });
test('dependency closure remains Sprite Asset to one source Texture', () => assert.deepStrictEqual(plumbing.assetTypes.getDependencies(sprite({ sourceRect: { x: 0, y: 0, width: 32, height: 32 } }), 'sprite'), [{ assetType: 'texture', id: 'atlas' }]));
test('runtime bridge uses the one authoritative UV helper', () => { const sync = editor.slice(editor.indexOf('function syncSpriteRenderer'), editor.indexOf('function decodeTextureImage')); assert(sync.includes('OpusAuthoringPlumbing.spriteSourceUV(spriteAsset, texture)')); });
test('scene and Prefab records do not embed sourceRect', () => { const serialize = editor.slice(editor.indexOf('function serializeSpriteRecord'), editor.indexOf('function instantiateSpriteRecord')); assert(!serialize.includes('sourceRect')); });
test('Inspector exposes pixel Source Region, full image, preview, drag and resize', () => ['Source Region', 'data-use-full-image', 'data-region-selection', 'data-region-handle', 'regionNaturalSize'].forEach((text) => assert(editor.includes(text), text)));
test('grid slicer bulk creation is exposed without animation', () => { assert(editor.includes('Slice as Grid')); assert(editor.includes('Created ${created.length} Sprite Assets')); assert(!editor.slice(editor.indexOf('function wireSpriteGridSlicer'), editor.indexOf('function renderSpriteLibrary')).includes('animationClip')); });
test('library cards call the region-only preview path', () => assert(editor.includes('spriteRegionPreviewHtml(asset, texture)')));
test('Texture upload orientation remains explicitly flipped once', () => assert(mesh.includes('gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)')));
test('deterministic 4x4 local atlas fixture exists', () => { const png = fs.readFileSync(path.join(ROOT, 'tests/fixtures/phase-018-atlas.png')); assert.deepStrictEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]); assert(html.includes('.sprite-grid-cell-preview')); });
test('Phase 018 suite is wired into the full runner', () => assert(fs.readFileSync(path.join(ROOT, 'tests/run-tests.js'), 'utf8').includes('phase-018-sprite-atlas.test.js')));

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 018 tests passed: ${passed}/${passed}`);
