'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const authoring = require('../editor/src/00-authoring-schema.js');

const tests = []; let passed = 0;
function test(name, fn) { tests.push({ name, fn }); }
const texture = { id: 'tex', type: 'texture', name: 'Atlas', width: 128, height: 128, dataURL: 'data:image/png;base64,eA==' };
function asset(extra = {}) { return plumbing.createSpriteAsset({ id: 'panel', name: 'Panel', sourceTexture: 'tex', sourceRect: { x: 32, y: 16, width: 64, height: 48 }, pixelsPerUnit: 100, filtering: 'nearest', nineSlice: { left: 4, right: 12, top: 5, bottom: 11 }, ...extra }); }
function cells(extra = {}, source = asset()) { return plumbing.spriteNineSliceCells(source, texture, { width: 4, height: 3, pivotX: 0.5, pivotY: 0.5, ...extra }); }
function renderer(extra = {}) { return { ...authoring.registry.get('sprite-renderer').defaults, version: 8, spriteAssetRef: 'panel', renderMode: 'nine-slice', ...extra }; }
const editor = fs.readFileSync(path.join(__dirname, '../editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../editor/index.html'), 'utf8');
const rendererSource = fs.readFileSync(path.join(__dirname, '../engine/src/09-renderer.js'), 'utf8');
const entitySource = fs.readFileSync(path.join(__dirname, '../engine/src/11-entity.js'), 'utf8');
const runner = fs.readFileSync(path.join(__dirname, 'run-tests.js'), 'utf8');

test('Sprite Asset advances to version 4', () => assert.strictEqual(plumbing.assetTypes.get('sprite').version, 4));
test('historical Sprite Asset migrates with null guides', () => assert.strictEqual(plumbing.createSpriteAsset({ id: 'old', version: 3 }).nineSlice, null));
test('new Sprite Asset defaults to null guides', () => assert.strictEqual(plumbing.createSpriteAsset({ id: 'new' }).nineSlice, null));
test('guide record preserves source-pixel values', () => assert.deepStrictEqual(asset().nineSlice, { left: 4, right: 12, top: 5, bottom: 11 }));
test('negative guide validates', () => assert(plumbing.validateSpriteNineSlice(asset({ nineSlice: { left: -1, right: 0, top: 0, bottom: 0 } }), texture).some((x) => x.code === 'sprite-nine-slice-negative')));
test('nonfinite guide validates', () => assert(plumbing.validateSpriteNineSlice(asset({ nineSlice: { left: Infinity, right: 0, top: 0, bottom: 0 } }), texture).some((x) => x.code === 'sprite-nine-slice-nonfinite')));
test('horizontal sum validates against sourceRect width', () => assert(plumbing.validateSpriteNineSlice(asset({ nineSlice: { left: 40, right: 25, top: 0, bottom: 0 } }), texture).some((x) => x.code === 'sprite-nine-slice-horizontal-bounds')));
test('vertical sum validates against sourceRect height', () => assert(plumbing.validateSpriteNineSlice(asset({ nineSlice: { left: 0, right: 0, top: 30, bottom: 19 } }), texture).some((x) => x.code === 'sprite-nine-slice-vertical-bounds')));
test('missing full-image dimensions preserve guides with warning', () => assert(plumbing.validateSpriteNineSlice(asset({ sourceRect: null }), null).some((x) => x.code === 'sprite-nine-slice-source-unavailable')));
test('full-image region uses Texture dimensions', () => assert.deepStrictEqual(plumbing.spriteRegionPixels(asset({ sourceRect: null }), texture), { x: 0, y: 0, width: 128, height: 128 }));
test('atlas region owns guide coordinate space', () => assert.deepStrictEqual(plumbing.spriteRegionPixels(asset(), texture), { x: 32, y: 16, width: 64, height: 48 }));
test('3x3 source splitting emits nine cells', () => assert.strictEqual(cells().length, 9));
test('WebGL top-left conversion keeps top above bottom', () => { const c = cells(); assert(c[6].uvOffset[1] > c[0].uvOffset[1]); });
test('source splitting stays inside atlas region', () => { const c = cells(); const values = c.flatMap((x) => [x.uvOffset[0], x.uvOffset[0] + x.uvScale[0], x.uvOffset[1], x.uvOffset[1] + x.uvScale[1]]); assert(values.every(Number.isFinite)); assert(Math.min(...values.filter((_,i)=>i%4<2)) >= 32/128); });
test('Sprite Renderer preserves Phase 026 data through current version', () => assert(authoring.registry.get('sprite-renderer').version >= 8));
test('historical Renderer migrates to Simple', () => { const t={kind:'sprite',components:{'sprite-renderer':{version:7}}}; authoring.ensureComponent(t,'sprite-renderer'); assert.strictEqual(t.components['sprite-renderer'].renderMode,'simple'); });
test('new Renderer defaults to Simple', () => assert.strictEqual(authoring.registry.get('sprite-renderer').defaults.renderMode, 'simple'));
test('Render Mode is bounded', () => assert.deepStrictEqual(authoring.registry.get('sprite-renderer').fields.find((x)=>x.key==='renderMode').choices, ['simple','nine-slice']));
test('nine-slice without guides safely returns Simple fallback', () => assert.strictEqual(plumbing.spriteNineSliceCells(asset({ nineSlice: null }), texture, { width: 1, height: 1 }), null));
test('natural left border world size uses PPU', () => assert(Math.abs(cells()[0].width - 0.04) < 1e-9));
test('natural right border world size uses PPU', () => assert(Math.abs(cells()[2].width - 0.12) < 1e-9));
test('natural bottom border world size uses PPU', () => assert(Math.abs(cells()[0].height - 0.11) < 1e-9));
test('natural top border world size uses PPU', () => assert(Math.abs(cells()[6].height - 0.05) < 1e-9));
test('horizontal edge stretches horizontally', () => assert(cells()[7].width > cells()[6].width));
test('vertical edge stretches vertically', () => assert(cells()[3].height > cells()[0].height));
test('center stretches both axes', () => { const c=cells()[4]; assert(c.width>3 && c.height>2); });
test('corners remain fixed when space permits', () => assert.deepStrictEqual([cells()[0].width,cells()[0].height],[.04,.11]));
test('tiny width proportionally compresses borders', () => { const c=cells({width:.08}); const widths=[...new Set(c.map(x=>x.width))].sort(); assert(widths.every(x=>x>=0)); assert(Math.abs(c[0].width-.02)<1e-9); });
test('tiny height proportionally compresses borders', () => { const c=cells({height:.08}); assert(c.every(x=>x.height>=0)); assert(Math.abs(c[0].height-.055)<1e-9); });
test('tiny both axes has no negative or NaN geometry', () => assert(cells({width:.01,height:.01}).every((x)=>x.width>=0&&x.height>=0&&Number.isFinite(x.x)&&Number.isFinite(x.y))));
test('tiny size does not change requested outer bounds', () => { const c=cells({width:.08}); const min=Math.min(...c.map(x=>x.x-x.width/2)); const max=Math.max(...c.map(x=>x.x+x.width/2)); assert(Math.abs(max-min-.08)<1e-9); });
test('zero borders skip degenerate cells', () => { const a=asset({nineSlice:{left:0,right:0,top:8,bottom:8}}); assert.strictEqual(cells({},a).length,3); });
test('all-zero guides reduce safely to one center cell', () => { const a=asset({nineSlice:{left:0,right:0,top:0,bottom:0}}); assert.strictEqual(cells({},a).length,1); });
test('zero source center skips center column', () => { const a=asset({nineSlice:{left:32,right:32,top:5,bottom:5}}); assert(cells({},a).every((x)=>x.column!==1)); });
test('extreme wide geometry is finite', () => assert(cells({width:20,height:.5}).every((x)=>Object.values(x).flat().every((v)=>typeof v!=='number'||Number.isFinite(v)))));
test('extreme tall geometry is finite', () => assert(cells({width:.5,height:20}).every((x)=>Object.values(x).flat().every((v)=>typeof v!=='number'||Number.isFinite(v)))));
test('pivot positions the whole outer rectangle', () => { const c=cells({pivotX:0,pivotY:0}); assert(Math.abs(Math.min(...c.map(x=>x.x-x.width/2)))<1e-9); assert(Math.abs(Math.min(...c.map(x=>x.y-x.height/2)))<1e-9); });
test('Transform composition remains on Entity', () => assert(entitySource.includes('Mat4.compose(this.position, this._quat, this.scale)') && entitySource.includes('_spriteCellModelMatrix')));
test('one sortable Entity draws all cells contiguously', () => assert(rendererSource.includes('for (const cell of cells)') && rendererSource.indexOf('for (const cell of cells)') > rendererSource.indexOf('_drawEntity(entity)')));
test('nine cells share tint and opacity uniforms', () => assert(rendererSource.indexOf('uBaseColor') < rendererSource.indexOf('for (const cell of cells)') && rendererSource.indexOf('uAlpha') < rendererSource.indexOf('for (const cell of cells)')));
test('visibility remains entity-level with authored component fallback', () => {
  // Phase181 adds transient property-pose ownership; the actual bridge and
  // fallback behavior are exercised in phase-181-animation-preview.test.js.
  assert(/item\.entity\.visible\s*=/.test(editor));
  assert(editor.includes('component.visible !== false'));
});
test('depth pass remains one Sprite pass with writes disabled', () => assert(rendererSource.includes('gl.depthMask(false)') && rendererSource.includes('for (const entity of sprites) this._drawEntity(entity)')));
test('Smooth atlas outer edges retain half-texel protection', () => { const a=asset({filtering:'linear'}); const c=cells({},a); assert(Math.min(...c.map(x=>Math.min(x.uvOffset[0],x.uvOffset[0]+x.uvScale[0])))>=32.5/128-1e-9); });
test('Pixel atlas uses exact outer edge', () => { const c=cells(); assert.strictEqual(Math.min(...c.map(x=>Math.min(x.uvOffset[0],x.uvOffset[0]+x.uvScale[0]))),32/128); });
test('internal cells share exact UV boundaries', () => { const c=cells(); assert.strictEqual(c[0].uvOffset[0]+c[0].uvScale[0],c[1].uvOffset[0]); });
test('Flip X symmetric mirrors UVs', () => { const a=asset({nineSlice:{left:8,right:8,top:8,bottom:8}}); assert(cells({flipX:true},a)[0].uvScale[0]<0); });
test('Flip X swaps asymmetric geometry', () => { const c=cells({flipX:true}); assert(Math.abs(c[0].width-.12)<1e-9); assert(Math.abs(c[2].width-.04)<1e-9); });
test('Flip Y swaps asymmetric geometry', () => { const c=cells({flipY:true}); assert(Math.abs(c[0].height-.05)<1e-9); assert(Math.abs(c[6].height-.11)<1e-9); });
test('Flip XY reverses both UV axes', () => { const c=cells({flipX:true,flipY:true}); assert(c.every((x)=>x.uvScale[0]<0&&x.uvScale[1]<0)); });
test('directional mirror feeds final effective Flip', () => assert.deepStrictEqual(plumbing.spriteEffectiveFlip({flipX:true,flipY:false},{directionMirrorX:true,directionMirrorY:true}),{flipX:false,flipY:true}));
test('animation runtime resolves current frame Sprite Asset before cells', () => assert(editor.indexOf('const spriteAsset = frame ?') < editor.indexOf('spriteNineSliceCells(spriteAsset')));
test('animated frame without guides falls back safely', () => assert.strictEqual(plumbing.spriteNineSliceCells(asset({nineSlice:null}),texture,{width:2,height:2}),null));
test('Animation Events remain independent of presentation', () => { const clip=plumbing.createSpriteAnimationClip({id:'c',playbackMode:'once',frames:[{spriteAsset:'panel',durationMs:100,events:[{id:'e',name:'Event'}]}]}); const p=plumbing.createSpriteAnimationPlayback(); const seen=[]; plumbing.playSpriteAnimation(p,clip,false,{onEvent:(e)=>seen.push(e.eventId)}); assert.deepStrictEqual(seen,['e']); });
test('direct resize produces new cells without changing guides', () => { const a=asset(); const before=JSON.stringify(a.nineSlice); assert.notDeepStrictEqual(cells({width:1}).map(x=>x.width),cells({width:5}).map(x=>x.width)); assert.strictEqual(JSON.stringify(a.nineSlice),before); });
test('Use Natural Size remains region over PPU', () => assert.deepStrictEqual(plumbing.spriteNaturalSize(asset(),texture),{width:.64,height:.48}));
test('Save Load persists Render Mode', () => { const a={kind:'sprite',components:{'sprite-renderer':renderer()}}; const b={kind:'sprite'}; authoring.applyRecord({components:authoring.serializeComponents(a)},b); assert.strictEqual(b.components['sprite-renderer'].renderMode,'nine-slice'); });
test('Sprite Asset duplicate deep-copies guides', () => { const a=asset(); const b=plumbing.duplicateSpriteAsset(a,'copy'); b.nineSlice.left=20; assert.strictEqual(a.nineSlice.left,4); assert.strictEqual(b.sourceTexture,a.sourceTexture); });
test('Sprite duplicate preserves mode independently', () => { const a={kind:'sprite',components:{'sprite-renderer':renderer()}}; const b={kind:'sprite'}; authoring.copyComponents(a,b); b.components['sprite-renderer'].renderMode='simple'; assert.strictEqual(a.components['sprite-renderer'].renderMode,'nine-slice'); });
test('Prefab record uses ordinary component serialization', () => { const a={kind:'sprite',components:{'sprite-renderer':renderer({width:5})}}; assert.strictEqual(authoring.serializeComponents(a)['sprite-renderer'].width,5); });
test('Prefab update seam remains shared', () => assert(editor.includes('serializeSpriteRecord(item)')));
test('Level duplication retains component record', () => assert(editor.includes("if (item.kind === 'sprite') return serializeSpriteRecord(item)")));
test('dependency closure stays Sprite Asset to one Texture', () => assert.deepStrictEqual(plumbing.assetTypes.get('sprite').dependencies(asset()),[{assetType:'texture',id:'tex'}]));
test('guide metadata creates no dependency', () => assert(!JSON.stringify(plumbing.assetTypes.get('sprite').dependencies(asset())).includes('nineSlice')));
test('pruning continues through used Sprite Asset IDs', () => assert(editor.includes('function serializeSpriteAssets(usedIds)') && editor.includes('collectProjectDependencies().spriteAssets')));
test('Editable and Playable exports share editor runtime', () => assert(editor.includes("editable-game.html")&&editor.includes("playable-game.html")));
test('Simple mode keeps existing one-quad path', () => assert(rendererSource.includes('entity.modelMatrix.m') && rendererSource.includes('entity.uvScale || [1, 1]')));
test('animated Simple Sprite path remains frame-authoritative', () => assert(editor.includes('const frame = clip && clip.frames && clip.frames[playback.currentFrameIndex]')));
test('directional presentation still uses XOR effective Flip', () => assert(editor.includes('spriteEffectiveFlip(component, playback)')));
test('Billboard has no Sprite Renderer eligibility', () => assert.deepStrictEqual(authoring.registry.get('sprite-renderer').eligibility,['sprite']));
test('100 nine-slice Sprites reuse one asset and produce no scene objects per cell', () => { const a=asset(); const all=Array.from({length:100},()=>plumbing.spriteNineSliceCells(a,texture,{width:4,height:3})); assert(all.every((x)=>x.length===9)); assert.strictEqual(a.sourceTexture,'tex'); });
test('Asset Inspector exposes guide controls and visualization', () => assert(editor.includes('data-nine-slice-guide')&&editor.includes('nine-slice-guide vertical')));
test('guide creation defaults all values to zero', () => assert(editor.includes("asset.nineSlice = { left: 0, right: 0, top: 0, bottom: 0 }")));
test('Renderer Inspector exposes Render Mode status', () => assert(editor.includes('Nine-Slice source:')));
test('numeric guide editing is documented instead of ambiguous drag', () => assert(editor.includes('Numeric editing is used instead of draggable lines')));
test('selection and picking remain outer Sprite bounds', () => assert(!editor.includes('pickNineSliceCell')));
test('no UI Canvas or parallax system leaked in', () => assert(!editor.includes('nineSliceCanvas')&&!editor.includes('nineSliceParallax')));
test('Phase 026 fixture generator and artifacts exist', () => { for(const f of ['tools/generate-phase-026-nine-slice.js','NINE-SLICE-SPRITE-ASSET-CONTRACT.md','NINE-SLICE-RENDERING-CONTRACT.md','NINE-SLICE-AUTHORING-CONTRACT.md','PHASE-026-CHARACTERIZATION.md','PHASE-026-REPORT.md','phase-026-dogfood.json']) assert(fs.existsSync(path.join(__dirname,'..',f)),f); });
test('Phase 026 suite is wired after Phase 025', () => assert(runner.indexOf('phase-026-nine-slice-sprites.test.js')>runner.indexOf('phase-025-sprite-directional-variants.test.js')));
test('Sprites capability remains B', () => assert.strictEqual(require('../no-code-capabilities.json').capabilities.find((c)=>c.id==='sprites-2d').grade,'B'));
test('Animation capability remains C', () => assert.strictEqual(require('../no-code-capabilities.json').capabilities.find((c)=>c.id==='animation').grade,'C'));

console.log('Phase 026 Nine-Slice Sprite tests');
for (const entry of tests) { try { entry.fn(); passed++; console.log(`  PASS ${entry.name}`); } catch (error) { console.error(`  FAIL ${entry.name}`); console.error(error.stack || error); process.exitCode=1; } }
if (!process.exitCode) console.log(`Phase 026 tests passed: ${passed}/${tests.length}`);
