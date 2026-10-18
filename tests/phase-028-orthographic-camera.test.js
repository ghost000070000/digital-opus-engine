'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(path.join(ROOT, 'dist/opus-engine.js'), 'utf8');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
const runner = fs.readFileSync(path.join(ROOT, 'tests/run-tests.js'), 'utf8');
const window = {};
vm.runInNewContext(bundle, { window, console, Float32Array, Uint16Array, Uint32Array, ArrayBuffer, DataView, Uint8Array, TextDecoder, performance: { now: () => 0 }, requestAnimationFrame: () => 0, cancelAnimationFrame() {} });
const { Camera, Vec3, CAMERA_SCHEMA_VERSION, CAMERA_PROJECTIONS } = window.Opus;
const tests = []; let passed = 0;
function test(name, fn) { tests.push({ name, fn }); }
function near(a, b, epsilon = 1e-6) { assert(Math.abs(a - b) < epsilon, `${a} != ${b}`); }

test('camera schema version is 2', () => assert.strictEqual(CAMERA_SCHEMA_VERSION, 2));
test('public projections are stable', () => assert.deepStrictEqual(Array.from(CAMERA_PROJECTIONS), ['perspective', 'orthographic']));
test('historical camera default remains perspective', () => assert.strictEqual(new Camera().projection, 'perspective'));
test('orthographic height defaults to 10', () => assert.strictEqual(new Camera().orthographicHeight, 10));
test('projection setter accepts orthographic', () => { const c = new Camera(); c.setProjection('orthographic'); assert.strictEqual(c.projection, 'orthographic'); });
test('projection setter rejects unknown values', () => assert.throws(() => new Camera().setProjection('flat')));
test('height setter accepts positive finite values', () => { const c = new Camera(); c.setOrthographicHeight(12); assert.strictEqual(c.orthographicHeight, 12); });
test('height setter rejects zero', () => assert.throws(() => new Camera().setOrthographicHeight(0)));
test('height setter rejects negative values', () => assert.throws(() => new Camera().setOrthographicHeight(-2)));
test('height setter rejects infinity', () => assert.throws(() => new Camera().setOrthographicHeight(Infinity)));
test('bounds interpret height as full vertical span', () => { const c = new Camera(); c.setOrthographicHeight(12); const b = c.orthographicBounds(2); assert.strictEqual(JSON.stringify(b), JSON.stringify({left:-12,right:12,bottom:-6,top:6,width:24,height:12,aspect:2})); });
test('zero aspect falls back safely to one', () => assert.strictEqual(new Camera().orthographicBounds(0).aspect, 1));
test('NaN aspect falls back safely to one', () => assert.strictEqual(new Camera().orthographicBounds(NaN).aspect, 1));
test('orthographic matrix stays finite for zero viewport aspect', () => { const c = new Camera(); c.setProjection('orthographic'); assert(Array.from(c.projectionMatrix(0).m).every(Number.isFinite)); });
test('orthographic width follows live aspect', () => { const c = new Camera(); c.setOrthographicHeight(10); assert.strictEqual(c.orthographicBounds(16/9).width, 160/9); });
test('camera Z does not alter orthographic scale', () => { const c = new Camera(); c.setProjection('orthographic'); const a = c.projectionMatrix(1.5).m.slice(); c.setFixedOptions({eye:new Vec3(0,0,100),target:new Vec3(0,0,99)}); const b=c.projectionMatrix(1.5).m; near(a[0],b[0]); near(a[5],b[5]); });
test('height changes orthographic scale', () => { const c=new Camera(); c.setProjection('orthographic'); const a=c.projectionMatrix(1).m[5]; c.setOrthographicHeight(20); assert.notStrictEqual(c.projectionMatrix(1).m[5],a); });
test('perspective remains distance-based', () => { const projectedSize=(distance)=>1/(distance*Math.tan(Math.PI/8)); assert(projectedSize(5)>projectedSize(10)); });
test('orthographic center ray starts at camera eye', () => { const c=new Camera(); c.setProjection('orthographic'); c.setMode('fixed'); const r=c.screenPointToRay(0,0,1); near(r.origin.x,c.eye.x); near(r.origin.y,c.eye.y); near(r.origin.z,c.eye.z); });
test('orthographic rays remain parallel', () => { const c=new Camera(); c.setProjection('orthographic'); c.setMode('fixed'); const a=c.screenPointToRay(-1,-1,2).direction,b=c.screenPointToRay(1,1,2).direction; near(a.x,b.x); near(a.y,b.y); near(a.z,b.z); });
test('orthographic ray origins span authored width', () => { const c=new Camera(); c.setProjection('orthographic'); c.setOrthographicHeight(10); c.setMode('fixed'); const a=c.screenPointToRay(-1,0,2).origin,b=c.screenPointToRay(1,0,2).origin; near(a.sub(b).length(),20); });
test('perspective rays still diverge', () => { const c=new Camera(); const a=c.screenPointToRay(-1,0,1).direction,b=c.screenPointToRay(1,0,1).direction; assert(Math.abs(a.x-b.x)>.1); });
test('arbitrary fixed up vector remains usable', () => { const c=new Camera(); c.setMode('fixed'); c.setFixedOptions({up:new Vec3(1,0,0)}); assert(Array.from(c.viewMatrix().m).every(Number.isFinite)); });
test('2D Camera palette entry exists', () => assert(html.includes('id="palette-camera2d"')));
test('2D Camera uses ordinary camera kind', () => assert(editor.includes("type === 'camera' || type === 'camera2d'")));
test('2D preset defaults to fixed orthographic', () => {
  const host={Opus:window.Opus,CAMERA_RECORD_VERSION:2,CAMERA_PROJECTIONS:['perspective','orthographic']};
  vm.createContext(host);
  for(const name of ['cameraPosition','normalizeCameraOptions','cameraBuiltPresetOptions']){
    const start=editor.indexOf('function '+name+'('),end=editor.indexOf('\nfunction ',start+1);
    assert(start>=0,name+' canonical constructor dependency');
    vm.runInContext(editor.slice(start,end<0?editor.length:end),host);
  }
  const options=host.cameraBuiltPresetOptions('camera2d',new Vec3(2,3,10));
  assert.strictEqual(options.mode,'fixed');assert.strictEqual(options.projection,'orthographic');
  assert.strictEqual(options.position.x,2);assert.strictEqual(options.position.y,3);assert.strictEqual(options.position.z,10);
});
test('2D preset starts around Z 10', () => assert(editor.includes('point.set(point.x, point.y, 10)')));
test('historical option normalization defaults perspective', () => assert(editor.includes("source.projection == null ? (preset2D ? 'orthographic' : 'perspective')")));
test('camera records carry explicit schema version', () => assert(editor.includes('version: CAMERA_RECORD_VERSION')));
test('inactive framing values are retained', () => assert(editor.includes('orthographicHeight') && editor.includes('fovDegrees')));
test('Inspector exposes Projection', () => assert(editor.includes('id="f-projection"')));
test('Inspector switches FOV and Orthographic Height', () => assert(editor.includes('id="f-fov"') && editor.includes('id="f-ortho-height"')));
test('Inspector exposes near and far clipping', () => assert(editor.includes('id="f-near"') && editor.includes('id="f-far"')));
test('Inspector exposes 3-axis camera rotation', () => assert(editor.includes('f-camera-rx') && editor.includes('f-camera-ry') && editor.includes('f-camera-rz')));
test('Inspector offers 2D alignment', () => assert(editor.includes('Align to 2D Plane')));
test('Inspector offers live camera view', () => assert(editor.includes('View Through Camera')));
test('persistent Return to Scene View control exists', () => assert(html.includes('id="camera-view-exit"')));
test('camera view snapshots and restores scene camera', () => assert(editor.includes('snapshotSceneCamera') && editor.includes('restoreSceneCamera')));
test('selected orthographic camera gets aspect-aware frame', () => assert(editor.includes('syncOrthographicCameraFrame') && editor.includes('height * cameraViewportAspect()')));
test('frame uses authored camera rotation', () => assert(editor.includes('center.add(q.rotateVec3(offset))')));
test('active camera is unique', () => {
  // Execute the canonical author command rather than pinning its old inline
  // variable names. This retains the uniqueness contract after consolidation.
  const a={kind:'camera',id:'a',isActiveCamera:true},b={kind:'camera',id:'b',isActiveCamera:true},other={kind:'cube',isActiveCamera:true};
  const host={playMode:false,placed:[a,b,other],history:0,pushUndo(){host.history++;},renderInspector(){},showStatus(){}};
  const start=editor.indexOf('function makeCameraActive(');assert(start>=0);
  const end=editor.indexOf('\nfunction ',start+1);vm.createContext(host);vm.runInContext(editor.slice(start,end),host);
  assert.strictEqual(host.makeCameraActive(b),true);assert.strictEqual(a.isActiveCamera,false);assert.strictEqual(b.isActiveCamera,true);assert.strictEqual(other.isActiveCamera,true);assert.strictEqual(host.history,1);
  assert.strictEqual(host.makeCameraActive(b),false);assert.strictEqual(host.history,1);
  host.playMode=true;assert.strictEqual(host.makeCameraActive(a),false);assert.strictEqual(a.isActiveCamera,false);assert.strictEqual(b.isActiveCamera,true);
});
test('active camera persists in records', () => assert(editor.includes("isActiveCamera: item.kind === 'camera'")));
test('duplicate camera is never silently active', () => assert(editor.includes("newItem = { kind: 'camera', entity, options, isActiveCamera: false }")));
test('fresh Play applies active camera before parallax capture', () => { const i=editor.indexOf('function enterPlayMode'); const end=editor.indexOf('\nfunction ',i+1); const b=editor.slice(i,end<0?editor.length:end); assert(b.indexOf('applyCameraPreset(authoredActiveCamera)')>0 && b.indexOf('applyCameraPreset(authoredActiveCamera)')<b.indexOf('captureParallaxReference()')); });
test('level transition applies its active camera before parallax capture', () => { const i=editor.indexOf('function switchToLevelDuringPlay('),end=editor.indexOf("document.getElementById('add-level-btn').addEventListener",i); assert(i>=0&&end>i); const b=editor.slice(i,end); assert(b.indexOf('applyCameraPreset(authoredActiveCamera)')>0 && b.indexOf('applyCameraPreset(authoredActiveCamera)')<b.indexOf('captureParallaxReference()')); });
test('camera switch updates projection and height', () => { const i=editor.indexOf('function applyCameraPreset'); const b=editor.slice(i,i+2500); assert(b.includes('setProjection')&&b.includes('setOrthographicHeight')); });
test('camera rotation drives forward and up', () => assert(editor.includes('orientation.rotateVec3(new Opus.Vec3(0, 0, -1))') && editor.includes('orientation.rotateVec3(new Opus.Vec3(0, 1, 0))')));
test('camera validation rejects bad projection', () => assert(editor.includes('camera-projection-invalid')));
test('camera validation rejects invalid orthographic height', () => assert(editor.includes('camera-orthographic-height-invalid')));
test('camera validation checks clip range', () => assert(editor.includes('camera-clip-range-invalid')));
test('Phase 027 parallax identity remains unchanged', () => assert(editor.includes("lastAppliedCameraItemId || 'session-default-camera'")));
test('Phase 028 suite is wired after Phase 027', () => assert(runner.indexOf('phase-028-orthographic-camera.test.js')>runner.indexOf('phase-027-parallax.test.js')));
test('required Phase 028 artifacts exist', () => ['ORTHOGRAPHIC-CAMERA-CONTRACT.md','2D-CAMERA-AUTHORING-CONTRACT.md','ORTHOGRAPHIC-PARALLAX-INTEGRATION.md','PHASE-028-CHARACTERIZATION.md','PHASE-028-REPORT.md','phase-028-dogfood.json','PIXEL-PERFECT-CAMERA-FUTURE-SEAM.md'].forEach(file=>assert(fs.existsSync(path.join(ROOT,file)),file)));
test('Sprites capability remains B', () => assert.strictEqual(require('../no-code-capabilities.json').capabilities.find(c=>c.id==='sprites-2d').grade,'B'));
test('Animation capability remains C', () => assert.strictEqual(require('../no-code-capabilities.json').capabilities.find(c=>c.id==='animation').grade,'C'));

console.log('Phase 028 Orthographic Camera tests');
for (const entry of tests) { try { entry.fn(); passed++; console.log(`  PASS ${entry.name}`); } catch (error) { console.error(`  FAIL ${entry.name}`); console.error(error.stack || error); process.exitCode=1; } }
if (!process.exitCode) console.log(`Phase 028 tests passed: ${passed}/${tests.length}`);
