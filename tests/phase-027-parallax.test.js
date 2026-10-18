'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const authoring = require('../editor/src/00-authoring-schema.js');
const tests = []; let passed = 0;
function test(name, fn) { tests.push({ name, fn }); }
const editor = fs.readFileSync(path.join(__dirname, '../editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../editor/index.html'), 'utf8');
const entity = fs.readFileSync(path.join(__dirname, '../engine/src/11-entity.js'), 'utf8');
const runner = fs.readFileSync(path.join(__dirname, 'run-tests.js'), 'utf8');
const layers = [
  plumbing.createParallaxLayer('far', 'Far Sky', .1, .2),
  plumbing.createParallaxLayer('front', 'Foreground', 1.2, 1.1),
  plumbing.createParallaxLayer('lock-x', 'Screen Lock X', 0, 1),
  plumbing.createParallaxLayer('reverse', 'Reverse', -.5, -.25),
];
test('Sprite Renderer advances to version 9', () => assert.strictEqual(authoring.registry.get('sprite-renderer').version, 9));
test('historical Renderer migrates to null parallax', () => { const t={kind:'sprite',components:{'sprite-renderer':{version:8}}}; authoring.ensureComponent(t,'sprite-renderer'); assert.strictEqual(t.components['sprite-renderer'].parallaxLayerRef,null); });
test('new Renderer defaults to null parallax', () => assert.strictEqual(authoring.registry.get('sprite-renderer').defaults.parallaxLayerRef,null));
test('parallax reference is typed', () => assert.strictEqual(authoring.registry.get('sprite-renderer').fields.find(x=>x.key==='parallaxLayerRef').referenceType,'parallaxLayer'));
test('registry normalization preserves stable fields', () => assert.deepStrictEqual(plumbing.normalizeParallaxLayers(layers),layers));
test('registry rejects missing IDs', () => assert(plumbing.validateParallaxLayers([{name:'A',factorX:1,factorY:1}]).some(x=>x.code==='parallax-layer-id-required')));
test('registry rejects duplicate IDs', () => assert(plumbing.validateParallaxLayers([{id:'a',name:'A',factorX:1,factorY:1},{id:'a',name:'B',factorX:1,factorY:1}]).some(x=>x.code==='duplicate-parallax-layer-id')));
test('registry rejects duplicate names case-insensitively', () => assert(plumbing.validateParallaxLayers([{id:'a',name:'Layer',factorX:1,factorY:1},{id:'b',name:'layer',factorX:1,factorY:1}]).some(x=>x.code==='duplicate-parallax-layer-name')));
test('registry rejects nonfinite factors', () => assert(plumbing.validateParallaxLayers([{id:'a',name:'A',factorX:Infinity,factorY:1}]).some(x=>x.code==='parallax-layer-factor-finite')));
test('negative factors are supported', () => assert.deepStrictEqual(plumbing.resolveParallaxFactors('reverse',layers),{factorX:-.5,factorY:-.25,missing:false}));
test('above-one foreground factors are supported', () => assert.deepStrictEqual(plumbing.resolveParallaxFactors('front',layers),{factorX:1.2,factorY:1.1,missing:false}));
test('null ref is exact normal world behavior', () => assert.deepStrictEqual(plumbing.resolveParallaxFactors(null,layers),{factorX:1,factorY:1,missing:false}));
test('missing ref is safe normal fallback and flagged', () => assert.deepStrictEqual(plumbing.resolveParallaxFactors('gone',layers),{factorX:1,factorY:1,missing:true}));
test('formula handles X and Y independently', () => assert.deepStrictEqual(plumbing.spriteParallaxOffset({x:12,y:5},{x:2,y:1},{factorX:.25,factorY:.5}),{x:7.5,y:2,z:0}));
test('factor one has zero render offset', () => assert.deepStrictEqual(plumbing.spriteParallaxOffset({x:12,y:5},{x:2,y:1},{factorX:1,factorY:1}),{x:0,y:0,z:0}));
test('factor zero screen-locks against camera delta', () => assert.deepStrictEqual(plumbing.spriteParallaxOffset({x:12,y:5},{x:2,y:1},{factorX:0,factorY:0}),{x:10,y:4,z:0}));
test('foreground factor reverses offset', () => assert(Math.abs(plumbing.spriteParallaxOffset({x:12,y:5},{x:2,y:1},{factorX:1.2,factorY:1.5}).x+2)<1e-9));
test('negative factor amplifies offset', () => assert.deepStrictEqual(plumbing.spriteParallaxOffset({x:4,y:4},{x:0,y:0},{factorX:-.5,factorY:-.25}),{x:6,y:5,z:0}));
test('rotation is not a formula input', () => assert.deepStrictEqual(plumbing.spriteParallaxOffset({x:2,y:3,rotation:99},{x:0,y:0,rotation:-5},{factorX:.5,factorY:.5}),{x:1,y:1.5,z:0}));
test('Z always remains unchanged', () => assert.strictEqual(plumbing.spriteParallaxOffset({x:2,y:3,z:999},{x:0,y:0,z:-5},{factorX:0,factorY:0}).z,0));
test('bad numeric inputs remain finite', () => assert(Object.values(plumbing.spriteParallaxOffset({}, {}, {})).every(Number.isFinite)));
test('reference index contains parallax identities', () => { const p={levels:[],parallaxLayers:layers}; assert(plumbing.buildReferenceIndex(p,{schemaRegistry:authoring.registry}).maps.parallaxLayer.has('far')); });
test('dangling Sprite reference validates', () => { const p={parallaxLayers:[],levels:[{id:'l',objects:[{id:'s',kind:'sprite',components:{'sprite-renderer':{...authoring.registry.get('sprite-renderer').defaults,version:9,parallaxLayerRef:'gone'}}}]}]}; assert(plumbing.collectProjectIssues(p,{schemaRegistry:authoring.registry}).issues.some(x=>x.code==='dangling-reference'&&x.referenceType==='parallaxLayer')); });
test('null Sprite reference does not validate as dangling', () => { const p={parallaxLayers:[],levels:[{id:'l',objects:[{id:'s',kind:'sprite',components:{'sprite-renderer':{...authoring.registry.get('sprite-renderer').defaults,version:9}}}]}]}; assert(!plumbing.collectProjectIssues(p,{schemaRegistry:authoring.registry}).issues.some(x=>x.referenceType==='parallaxLayer')); });
test('save-load component preserves layer ID', () => { const a={kind:'sprite',components:{'sprite-renderer':{...authoring.registry.get('sprite-renderer').defaults,version:9,parallaxLayerRef:'far'}}}; const b={kind:'sprite'}; authoring.applyRecord({components:authoring.serializeComponents(a)},b); assert.strictEqual(b.components['sprite-renderer'].parallaxLayerRef,'far'); });
test('duplicate component deep-copies layer ID', () => { const a={kind:'sprite',components:{'sprite-renderer':{...authoring.registry.get('sprite-renderer').defaults,version:9,parallaxLayerRef:'far'}}}; const b={kind:'sprite'}; authoring.copyComponents(a,b); assert.strictEqual(b.components['sprite-renderer'].parallaxLayerRef,'far'); });
test('runtime offset is Sprite Entity render-only state', () => assert(entity.includes('this.spriteRenderOffset = new Vec3()')));
test('simple Sprite draw matrix applies offset', () => assert(entity.includes('base.m[12] += Number(renderOffset.x) || 0')));
test('nine-slice cell matrix applies same offset', () => assert(entity.indexOf('base.m[12] += Number(renderOffset.x) || 0',entity.indexOf('_spriteCellModelMatrix'))>0));
test('authored Transform position is never assigned from offset', () => assert(!editor.includes('entity.position = offset')&&!editor.includes('entity.position.set(offset.x')));
test('runtime only targets Sprite kind', () => assert(editor.includes("if (item.kind !== 'sprite' || !item.entity) continue")));
test('stable camera removes transient shake', () => assert(editor.includes('eye.x - (shake ? shake.x : 0)')));
test('fresh Play captures reference after player spawn', () => assert(editor.indexOf('captureParallaxReference();',editor.indexOf('function enterPlayMode'))>editor.indexOf('spawnPlayer(computeSpawnPoint());',editor.indexOf('function enterPlayMode'))));
test('active camera identity uses authored preset stable ID', () => assert(editor.includes("lastAppliedCameraItemId || 'session-default-camera'")));
test('level transition resets and recaptures', () => { const i=editor.indexOf('function switchToLevelDuringPlay('),end=editor.indexOf("document.getElementById('add-level-btn').addEventListener",i); assert(i>=0&&end>i); const block=editor.slice(i,end); assert(block.includes('resetParallaxRuntime()')&&block.includes('captureParallaxReference()')); assert(block.indexOf('resetParallaxRuntime()')<block.indexOf('captureParallaxReference()')); });
test('Stop clears runtime offsets', () => { const i=editor.indexOf('function exitPlayMode'),end=editor.indexOf("document.getElementById('play-btn').addEventListener",i); assert(i>=0&&end>i); assert(editor.slice(i,end).includes('resetParallaxRuntime()')); });
test('Project tab exposes layer manager', () => assert(html.includes('id="parallax-layer-list"')&&html.includes('id="parallax-layer-add-btn"')));
test('manager exposes rename and factor controls', () => assert(editor.includes('data-parallax-name')&&editor.includes('data-parallax-factor-x')&&editor.includes('data-parallax-factor-y')));
test('manager synchronizes names before blur for immediate save/export', () => assert(editor.includes('input.oninput = () => {')&&editor.includes('layer.name = name')));
test('manager synchronizes factors before blur for immediate save/export', () => assert(editor.includes("input.value !== '' && Number.isFinite(value)) layer[axis] = value")));
test('manager supports duplicate', () => assert(editor.includes('data-parallax-duplicate')));
test('delete preserves repairable references', () => assert(editor.includes('repairable Sprite reference')&&!editor.includes('component.parallaxLayerRef = null')));
test('Inspector exposes Parallax group', () => assert(editor.includes("parallaxLayerRef: 'Parallax'")&&editor.includes('parallaxFactorSummary')));
test('Inspector options include None through nullable reference', () => assert.strictEqual(authoring.registry.get('sprite-renderer').fields.find(x=>x.key==='parallaxLayerRef').nullable,true));
test('project serialization carries registry', () => assert(editor.includes('parallaxLayers: parallaxLayers.map')));
test('project normalization carries registry', () => assert(editor.includes('normalizeParallaxLayers(newParallaxLayers)')));
test('500 Sprite offset computation stays finite', () => { const out=Array.from({length:500},(_,i)=>plumbing.spriteParallaxOffset({x:i,y:-i},{x:0,y:0},plumbing.resolveParallaxFactors(layers[i%layers.length].id,layers))); assert(out.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y))); });
test('100-layer registry resolves stable IDs', () => { const many=Array.from({length:100},(_,i)=>plumbing.createParallaxLayer(`p${i}`,`Layer ${i}`,i/100,i/200)); assert.strictEqual(plumbing.resolveParallaxFactors('p99',many).factorX,.99); });
test('Billboard remains outside Sprite parallax', () => assert.deepStrictEqual(authoring.registry.get('sprite-renderer').eligibility,['sprite']));
test('camera shake does not edit registry or component', () => assert(!editor.slice(editor.indexOf('function tickCameraShake'),editor.indexOf('function applyWeaponRecoilKick')).includes('parallaxLayer')));
test('Phase 027 suite is wired after Phase 026', () => assert(runner.indexOf('phase-027-parallax.test.js')>runner.indexOf('phase-026-nine-slice-sprites.test.js')));
test('Phase 027 contracts and evidence artifacts exist', () => ['SPRITE-PARALLAX-LAYER-CONTRACT.md','SPRITE-PARALLAX-RUNTIME-CONTRACT.md','SPRITE-PARALLAX-AUTHORING-CONTRACT.md','PHASE-027-CHARACTERIZATION.md','PHASE-027-REPORT.md','phase-027-dogfood.json','phase-027-export-proof.json','tools/audit-phase-027.js'].forEach((file) => assert(fs.existsSync(path.join(__dirname,'..',file)),file)));
test('Sprites capability remains B', () => assert.strictEqual(require('../no-code-capabilities.json').capabilities.find(c=>c.id==='sprites-2d').grade,'B'));
test('Animation capability remains C', () => assert.strictEqual(require('../no-code-capabilities.json').capabilities.find(c=>c.id==='animation').grade,'C'));

console.log('Phase 027 Sprite Parallax tests');
for (const entry of tests) { try { entry.fn(); passed++; console.log(`  PASS ${entry.name}`); } catch (error) { console.error(`  FAIL ${entry.name}`); console.error(error.stack || error); process.exitCode=1; } }
if (!process.exitCode) console.log(`Phase 027 tests passed: ${passed}/${tests.length}`);
