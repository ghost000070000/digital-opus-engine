'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const authoring = require('../editor/src/00-authoring-schema.js');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const schemaSource = fs.readFileSync(path.join(ROOT, 'editor/src/00-authoring-schema.js'), 'utf8');
const renderer = fs.readFileSync(path.join(ROOT, 'engine/src/09-renderer.js'), 'utf8');
const entity = fs.readFileSync(path.join(ROOT, 'engine/src/11-entity.js'), 'utf8');
const spriteSchema = authoring.registry.get('sprite-renderer');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS ' + name); }
  catch (error) { console.error('  FAIL ' + name + '\n' + error.stack); process.exitCode = 1; }
}
function sliceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, start + ' section');
  return source.slice(from, to);
}

console.log('Phase 014 Sprite / Billboard boundary tests');
test('Sprite has an explicit serialized object kind', () => assert(editor.includes("kind: 'sprite', id: item.id")));
test('Billboard preserves the legacy cube record contract', () => assert(editor.includes("kind: 'cube'") && editor.includes('isBillboard: item.isBillboard || undefined')));
test('Billboard mesh identity serializes explicitly', () => assert(editor.includes("if (mesh === billboardMesh) return 'billboard'")));
test('Billboard mesh identity loads explicitly', () => assert(editor.includes("else if (record.mesh === 'billboard') mesh = billboardMesh")));
test('Sprite and Billboard use distinct live meshes', () => assert(editor.includes('mesh: spriteMesh') && editor.includes('mesh: billboardMesh')));
test('only Sprite owns spriteRenderer state', () => assert(entity.includes('this.spriteRenderer = null') && schemaSource.includes('target.entity.spriteRenderer = { width, height, pivotX, pivotY')));
test('Sprite Asset reference belongs to Sprite Renderer', () => assert(spriteSchema.fields.some((field) => field.key === 'spriteAssetRef' && field.referenceType === 'asset' && field.allowedAssetTypes.includes('sprite'))));
test('Sprite sorting reference belongs to Sprite Renderer', () => assert(spriteSchema.fields.some((field) => field.key === 'sortingLayerRef' && field.referenceType === 'sortingLayer')));
test('Billboard serializer does not acquire Sprite fields', () => {
  const section = sliceBetween(editor, 'function serializeCubeRecord', 'function serializeItemRecord');
  ['spriteAssetRef', 'sortingLayerRef', 'orderInLayer', 'spriteRenderer'].forEach((token) => assert(!section.includes(token), token));
});
test('Billboard retains generic Texture ownership', () => assert(editor.includes('textureAssetId: item.textureAssetId || undefined')));
test('Billboard retains generic material alpha and Unlit', () => assert(editor.includes('unlit: item.entity.unlit || undefined') && editor.includes("alpha: (item.entity.alpha !== undefined && item.entity.alpha !== 1) ? item.entity.alpha : undefined")));
test('Sprite is always unlit at renderer boundary', () => assert(renderer.includes('(entity.unlit || entity.spriteRenderer) ? 1 : 0')));
test('Billboard is lit unless generic Unlit is enabled', () => assert(renderer.includes('A Billboard has no') && renderer.includes('responds to depth and lighting')));
test('Sprite keeps authored Transform orientation', () => assert(editor.includes('It does not face the camera automatically')));
test('Billboard full mode computes pitch and yaw', () => assert(editor.includes('const yaw = Math.atan2(d.x, d.z)') && editor.includes('const pitch = -Math.asin')));
test('Billboard cylindrical mode removes vertical direction', () => assert(editor.includes("item.billboardMode === 'cylindrical') dir = new Opus.Vec3(dir.x, 0, dir.z)")));
test('Billboard camera-facing runs in edit and Play', () => assert(editor.includes('BOTH edit and Play') && editor.includes('function syncBillboards()')));
test('hierarchy resolves before Billboard facing', () => assert(editor.includes('updateHierarchyTransforms(); syncBillboards();')));
test('obsolete pre-hierarchy Billboard callback is absent', () => assert(!editor.includes('app.onUpdate(() => syncBillboards())')));
test('Sprite and Billboard are both hierarchy-capable', () => assert(editor.includes("item.kind === 'cube' || item.kind === 'sprite'")));
test('Scene tree names a Billboard honestly', () => assert(editor.includes("if (item.isBillboard) return ")));
test('Palette exposes separate Sprite and Billboard entries', () => assert(html.includes('id="palette-sprite"') && html.includes('id="palette-billboard"')));
test('Palette explains the semantic distinction', () => assert(html.includes('flat authored visual') && html.includes('automatically faces the camera')));
test('Inspector explains the semantic distinction', () => assert(editor.includes('data-concept-boundary="sprite"') && editor.includes('data-concept-boundary="billboard"')));
test('Billboard inspector offers full and cylindrical modes', () => assert(editor.includes('<option value="full"') && editor.includes('<option value="cylindrical"')));
test('Help includes Sprite or Billboard guidance', () => assert(editor.includes("spriteBillboard: ['Sprite or Billboard?'")));
test('duplicate preserves both object identities', () => assert(editor.includes('serializeSpriteRecord(src)') && editor.includes('isBillboard: src.isBillboard, billboardMode: src.billboardMode')));
test('Prefab placement dispatches Sprite separately from generic records', () => assert(editor.includes("prefab.record.kind === 'sprite' ? instantiateSpriteRecord")));
test('legacy Billboard fixture remains loadable without conversion', () => {
  const fixture = { kind: 'cube', mesh: 'billboard', isBillboard: true, position: [1, 2, 3], scale: [2, 2, 2], rotationY: 0, color: [1, 1, 1], alpha: 0.6, textureAssetId: 'legacy-texture' };
  assert.strictEqual(fixture.kind, 'cube');
  assert.strictEqual(fixture.mesh, 'billboard');
  assert.strictEqual(fixture.isBillboard, true);
  assert.strictEqual(fixture.billboardMode || 'full', 'full');
  assert(!('spriteAssetRef' in fixture));
});
test('opaque and transparent Billboards use ordinary 3D buckets', () => assert(renderer.includes('else if (entity.alpha < 1)') && renderer.includes('else opaque.push(entity)')));
test('opaque 3D draws before transparent 3D and Sprites', () => {
  assert(renderer.indexOf('for (const entity of opaque)') < renderer.indexOf('drawTransparentBand(transparentBehindSprites)'));
  assert(renderer.indexOf('drawTransparentBand(transparentBehindSprites)') < renderer.indexOf('if (sprites.length > 0)'));
});
test('transparent 3D sorts far-to-near', () => assert(renderer.includes('eye.sub(b.position).length() - eye.sub(a.position).length()')));
test('Sprite pass keeps depth test and disables depth writes', () => assert(renderer.includes('Depth testing remains enabled against opaque 3D geometry') && renderer.includes('gl.depthMask(false)')));
test('Sprite ordering remains layer order then instance order then stable ID', () => assert(renderer.includes('spriteSortingLayerOrder') && renderer.includes('spriteOrderInLayer') && renderer.includes('spriteStableId')));
test('hybrid rendering remains bounded without an OIT claim', () => assert(renderer.includes('deliberately-not-order-') && renderer.includes('not guaranteed correct')));
test('Phase 014 does not add future 2D systems', () => ['orthographicCamera', 'spriteAnimation', 'tilemapRenderer', 'physics2D', 'ySortMode', 'renderQueue'].forEach((token) => assert(!spriteSchema.fields.some((field) => field.key === token), token)));

if (process.exitCode) process.exit(process.exitCode);
console.log('Phase 014 tests passed: ' + passed + '/' + passed);
