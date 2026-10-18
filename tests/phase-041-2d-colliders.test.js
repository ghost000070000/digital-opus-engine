'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const collider = require('../editor/src/00-collider-2d.js');
const authoring = require('../editor/src/00-authoring-schema.js');
const editor = fs.readFileSync(path.join(ROOT, 'editor/src/01-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'editor/index.html'), 'utf8');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  PASS ${name}`); } catch (error) { console.error(`  FAIL ${name}\n${error.stack}`); process.exitCode = 1; } }
function near(actual, expected, epsilon = 1e-6) { assert(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }
function object(matrix, components = {}) { return { kind: 'cube', worldMatrix: matrix, components }; }
function box(extra = {}) { return { version: 1, enabled: true, offset: [0, 0], size: [2, 2], ...extra }; }
function circle(extra = {}) { return { version: 1, enabled: true, offset: [0, 0], radius: 1, ...extra }; }
function shape(kind, component, matrix = collider.identityMatrix()) { return collider.resolveCollider2DWorldShape(object(matrix), component, kind); }
function componentTarget(kind = 'cube') { return kind === 'sprite' ? { kind, components: { 'sprite-renderer': { version: 9, width: 4, height: 2, pivotX: .25, pivotY: .75 } } } : { kind }; }

console.log('Phase 041 2D Collider component tests');

test('Box Collider 2D is a first-class v2 schema', () => { const s = authoring.registry.get(collider.BOX_ID); assert(s); assert.strictEqual(s.displayName, 'Box Collider 2D'); assert.strictEqual(s.version, 2); });
test('Circle Collider 2D is a first-class v2 schema', () => { const s = authoring.registry.get(collider.CIRCLE_ID); assert(s); assert.strictEqual(s.displayName, 'Circle Collider 2D'); assert.strictEqual(s.version, 2); });
test('schemas are addable singleton Physics / 2D components', () => [collider.BOX_ID, collider.CIRCLE_ID].forEach((id) => { const s = authoring.registry.get(id); assert.strictEqual(s.addable, true); assert.strictEqual(s.multiplicity, 'single'); assert.strictEqual(s.category, 'Physics / 2D'); }));
test('Box defaults are bounded', () => assert.deepStrictEqual(authoring.registry.get(collider.BOX_ID).defaults, { enabled: true, offset: [0, 0], size: [1, 1], collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'all', collisionMaskRefs: [] }));
test('Circle defaults are bounded', () => assert.deepStrictEqual(authoring.registry.get(collider.CIRCLE_ID).defaults, { enabled: true, offset: [0, 0], radius: .5, collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'all', collisionMaskRefs: [] }));
test('collider schemas contain no trigger field', () => [collider.BOX_ID, collider.CIRCLE_ID].forEach((id) => assert(!authoring.registry.get(id).fields.some((f) => /trigger|sensor|enter|stay|exit/i.test(f.key)))));
test('collider schemas contain no body field', () => [collider.BOX_ID, collider.CIRCLE_ID].forEach((id) => assert(!authoring.registry.get(id).fields.some((f) => /body|mass|velocity|gravity/i.test(f.key)))));
test('cube discovery retains both passive collider types', () => assert.deepStrictEqual(authoring.discoverComponents(componentTarget(), 'collider').map((e) => e.schema.id).filter((id) => id !== 'trigger-collider-2d'), [collider.BOX_ID, collider.CIRCLE_ID]));
test('Sprite discovery retains both passive collider types', () => assert.deepStrictEqual(authoring.discoverComponents(componentTarget('sprite'), 'collider').map((e) => e.schema.id).filter((id) => id !== 'trigger-collider-2d'), [collider.BOX_ID, collider.CIRCLE_ID]));
test('collider does not require a visual', () => { const target = componentTarget(); assert(authoring.addComponent(target, collider.BOX_ID).ok); assert(authoring.addComponent(target, collider.CIRCLE_ID).ok); });
test('same collider type cannot be added twice', () => { const target = componentTarget(); assert(authoring.addComponent(target, collider.BOX_ID).ok); assert.strictEqual(authoring.addComponent(target, collider.BOX_ID).code, 'already-added'); });
test('Box and Circle may coexist', () => { const target = componentTarget(); authoring.addComponent(target, collider.BOX_ID); authoring.addComponent(target, collider.CIRCLE_ID); assert(target.components[collider.BOX_ID]); assert(target.components[collider.CIRCLE_ID]); });
test('Sprite Add initializes Box from visual once', () => { const target = componentTarget('sprite'); authoring.addComponent(target, collider.BOX_ID); assert.deepStrictEqual(target.components[collider.BOX_ID].size, [4, 2]); assert.deepStrictEqual(target.components[collider.BOX_ID].offset, [1, -.5]); target.components['sprite-renderer'].width = 9; assert.deepStrictEqual(target.components[collider.BOX_ID].size, [4, 2]); });
test('Sprite Add initializes Circle using inscribed policy', () => { const target = componentTarget('sprite'); authoring.addComponent(target, collider.CIRCLE_ID); assert.strictEqual(target.components[collider.CIRCLE_ID].radius, 1); });
test('Box validation rejects nonpositive size', () => { const target = componentTarget(); authoring.addComponent(target, collider.BOX_ID); target.components[collider.BOX_ID].size = [0, 1]; assert(authoring.validateComponent(target, collider.BOX_ID).some((i) => i.code === 'box-collider-2d-size')); });
test('Circle validation rejects nonpositive radius', () => { const target = componentTarget(); authoring.addComponent(target, collider.CIRCLE_ID); target.components[collider.CIRCLE_ID].radius = 0; assert(authoring.validateComponent(target, collider.CIRCLE_ID).some((i) => i.code === 'circle-collider-2d-radius')); });
test('validation rejects nonfinite offsets', () => { const target = componentTarget(); authoring.addComponent(target, collider.BOX_ID); target.components[collider.BOX_ID].offset = [Infinity, 0]; assert(authoring.validateComponent(target, collider.BOX_ID).some((i) => i.field === 'offset')); });
test('Circle nonuniform scale is a warning', () => { const target = componentTarget(); target.entity = { scale: { x: 2, y: 1 } }; authoring.addComponent(target, collider.CIRCLE_ID); assert(authoring.validateComponent(target, collider.CIRCLE_ID).some((i) => i.code === 'circle-collider-2d-nonuniform-scale' && i.severity === 'warning')); });
test('degenerate scale is a warning', () => { const target = componentTarget(); target.entity = { scale: { x: 0, y: 1 } }; authoring.addComponent(target, collider.BOX_ID); assert(authoring.validateComponent(target, collider.BOX_ID).some((i) => i.code === 'collider-2d-degenerate-transform')); });

test('identity Box resolves stable BL BR TR TL order', () => assert.deepStrictEqual(shape('box', box()).points, [{x:-1,y:-1},{x:1,y:-1},{x:1,y:1},{x:-1,y:1}]));
test('Box local offset resolves', () => assert.deepStrictEqual(shape('box', box({ offset: [2, -1], size: [2, 4] })).points, [{x:1,y:-3},{x:3,y:-3},{x:3,y:1},{x:1,y:1}]));
test('Box translation resolves', () => assert.deepStrictEqual(shape('box', box(), collider.composeMatrix({ position:[3,4,0] })).points, [{x:2,y:3},{x:4,y:3},{x:4,y:5},{x:2,y:5}]));
test('Box rotation resolves as a quad', () => { const s = shape('box', box({ size:[2,4] }), collider.composeMatrix({ rotation:Math.PI/2 })); near(s.points[0].x,2); near(s.points[0].y,-1); near(s.points[2].x,-2); near(s.points[2].y,1); });
test('Box uniform scale resolves', () => { const s = shape('box', box(), collider.composeMatrix({ scale:[2,2,1] })); assert.deepStrictEqual(s.aabb,{minX:-2,minY:-2,maxX:2,maxY:2}); });
test('Box nonuniform scale resolves', () => { const s = shape('box', box(), collider.composeMatrix({ scale:[3,.5,1] })); assert.deepStrictEqual(s.aabb,{minX:-3,minY:-.5,maxX:3,maxY:.5}); });
test('Box mirrored scale preserves stable point identity', () => { const s = shape('box', box(), collider.composeMatrix({ scale:[-2,1,1] })); assert.deepStrictEqual(s.points,[{x:2,y:-1},{x:-2,y:-1},{x:-2,y:1},{x:2,y:1}]); });
test('Box parent matrix composition resolves', () => { const parent=collider.composeMatrix({position:[5,0,0],rotation:Math.PI/2,scale:[2,1,1]}); const child=collider.composeMatrix({position:[1,0,0],parentMatrix:parent}); const s=shape('box',box({size:[1,1]}),child); near(s.aabb.minY,1); near(s.aabb.maxY,3); });
test('Box AABB derives from rotated points', () => { const s=shape('box',box(),collider.composeMatrix({rotation:Math.PI/4})); near(s.aabb.minX,-Math.SQRT2); near(s.aabb.maxY,Math.SQRT2); });

test('identity Circle resolves center radius and historical filter', () => assert.deepStrictEqual(shape('circle', circle()), { kind:'circle', componentId:collider.CIRCLE_ID, filter: { collisionLayerRef: 'collision-layer-default', collisionMaskMode: 'all', collisionMaskRefs: [] }, center:{x:0,y:0}, radius:1, aabb:{minX:-1,minY:-1,maxX:1,maxY:1} }));
test('Circle offset and translation resolve', () => { const s=shape('circle',circle({offset:[1,-2]}),collider.composeMatrix({position:[4,5,0]})); assert.deepStrictEqual(s.center,{x:5,y:3}); });
test('Circle uniform scale multiplies radius', () => assert.strictEqual(shape('circle',circle({radius:2}),collider.composeMatrix({scale:[3,3,1]})).radius,6));
test('Circle nonuniform scale uses maximum basis', () => assert.strictEqual(shape('circle',circle({radius:2}),collider.composeMatrix({scale:[3,.5,1]})).radius,6));
test('Circle mirrored scale keeps positive radius', () => assert.strictEqual(shape('circle',circle(),collider.composeMatrix({scale:[-2,-3,1]})).radius,3));
test('Circle parent composition follows hierarchy', () => { const p=collider.composeMatrix({position:[2,3,0],rotation:Math.PI/2,scale:[2,2,1]}); const c=collider.composeMatrix({position:[1,0,0],parentMatrix:p}); const s=shape('circle',circle({offset:[.5,0]}),c); near(s.center.x,2); near(s.center.y,6); near(s.radius,2); });
test('disabled collider resolves to null', () => assert.strictEqual(shape('box',box({enabled:false})),null));
test('invalid collider resolves to null', () => assert.strictEqual(shape('circle',circle({radius:NaN})),null));
test('zero world scale resolves to null', () => assert.strictEqual(shape('box',box(),collider.composeMatrix({scale:[0,1,1]})),null));
test('enumeration returns both enabled shapes', () => { const o=object(collider.identityMatrix(),{[collider.BOX_ID]:box(),[collider.CIRCLE_ID]:circle()}); assert.deepStrictEqual(collider.enumerateCollider2DWorldShapes(o).map((s)=>s.kind),['box','circle']); });

test('Box/Box far apart is false',()=>assert.strictEqual(collider.overlaps(shape('box',box()),shape('box',box(),collider.composeMatrix({position:[4,0,0]}))),false));
test('Box/Box edge touching counts',()=>assert(collider.overlaps(shape('box',box()),shape('box',box(),collider.composeMatrix({position:[2,0,0]})))));
test('Box/Box corner touching counts',()=>assert(collider.overlaps(shape('box',box()),shape('box',box(),collider.composeMatrix({position:[2,2,0]})))));
test('Box/Box overlap counts',()=>assert(collider.overlaps(shape('box',box()),shape('box',box(),collider.composeMatrix({position:[1,0,0]})))));
test('rotated Box/Box overlap counts',()=>assert(collider.overlaps(shape('box',box()),shape('box',box(),collider.composeMatrix({position:[1.5,0,0],rotation:Math.PI/4})))));
test('rotated Box/Box non-overlap rejects',()=>assert(!collider.overlaps(shape('box',box()),shape('box',box(),collider.composeMatrix({position:[4,0,0],rotation:Math.PI/4})))));
test('Box containment counts',()=>assert(collider.overlaps(shape('box',box({size:[10,10]})),shape('box',box({size:[1,1]})))));
test('Circle/Circle far apart is false',()=>assert(!collider.overlaps(shape('circle',circle()),shape('circle',circle(),collider.composeMatrix({position:[3,0,0]})))));
test('Circle/Circle touching counts',()=>assert(collider.overlaps(shape('circle',circle()),shape('circle',circle(),collider.composeMatrix({position:[2,0,0]})))));
test('Circle/Circle containment and same-center count',()=>assert(collider.overlaps(shape('circle',circle({radius:4})),shape('circle',circle()))));
test('Box/Circle outside is false',()=>assert(!collider.overlaps(shape('box',box()),shape('circle',circle(),collider.composeMatrix({position:[4,0,0]})))));
test('Box/Circle edge touching counts',()=>assert(collider.overlaps(shape('box',box()),shape('circle',circle(),collider.composeMatrix({position:[2,0,0]})))));
test('Box/Circle corner touching counts',()=>assert(collider.overlaps(shape('box',box()),shape('circle',circle({radius:Math.SQRT2}),collider.composeMatrix({position:[2,2,0]})))));
test('Box/Circle center inside counts',()=>assert(collider.overlaps(shape('box',box()),shape('circle',circle({radius:.1})))));
test('Circle overlaps rotated Box accurately',()=>assert(collider.overlaps(shape('box',box({size:[4,1]}),collider.composeMatrix({rotation:Math.PI/4})),shape('circle',circle({radius:.2}),collider.composeMatrix({position:[1,1,0]})))));
test('large Circle contains Box',()=>assert(collider.overlaps(shape('circle',circle({radius:10})),shape('box',box()))));
test('all supported overlap pairs are symmetric',()=>{const shapes=[shape('box',box()),shape('box',box(),collider.composeMatrix({position:[1,0,0],rotation:.3})),shape('circle',circle()),shape('circle',circle(),collider.composeMatrix({position:[1.5,0,0]}))];for(const a of shapes)for(const b of shapes)assert.strictEqual(collider.overlaps(a,b),collider.overlaps(b,a));});
test('epsilon admits near touching',()=>assert(collider.overlaps(shape('circle',circle()),shape('circle',circle(),collider.composeMatrix({position:[2+collider.EPSILON/2,0,0]})))));
test('unknown or invalid shapes fail closed',()=>{assert.strictEqual(collider.overlaps({kind:'triangle'},shape('box',box())),false);assert.strictEqual(collider.overlaps(null,null),false);});

test('Fit Box uses Sprite local bounds',()=>assert.deepStrictEqual(collider.fitToVisual(componentTarget('sprite'),'box'),{offset:[1,-.5],size:[4,2],source:'sprite'}));
test('Fit Circle is explicitly inscribed',()=>assert.deepStrictEqual(collider.fitToVisual(componentTarget('sprite'),'circle'),{offset:[1,-.5],radius:1,source:'sprite',policy:'inscribed'}));
test('unsupported invisible visual has no fit',()=>assert.strictEqual(collider.fitToVisual({kind:'camera'},'box'),null));
test('Box center edit changes only offset',()=>assert.deepStrictEqual(collider.editBoxFromLocalHandle(box(),'center',{x:3,y:4}),{offset:[3,4],size:[2,2]}));
test('Box edge edit changes local size and center',()=>assert.deepStrictEqual(collider.editBoxFromLocalHandle(box(),'e',{x:3,y:0}),{offset:[1,0],size:[4,2]}));
test('Box crossover clamps positive',()=>assert(collider.editBoxFromLocalHandle(box(),'e',{x:-4,y:0}).size[0] >= collider.MIN_SIZE));
test('Circle center edit changes offset',()=>assert.deepStrictEqual(collider.editCircleFromLocalHandle(circle(),'center',{x:2,y:3}),{offset:[2,3],radius:1}));
test('Circle radius edit is local distance',()=>assert.strictEqual(collider.editCircleFromLocalHandle(circle(),'radius',{x:3,y:4}).radius,5));
test('world-to-local round trip works through parent matrix',()=>{const m=collider.composeMatrix({position:[3,-2,0],rotation:.7,scale:[-2,3,1]});const w=collider.transformPoint(m,{x:1.2,y:-.4});const l=collider.worldToLocal(m,w);near(l.x,1.2);near(l.y,-.4);});

test('Save/Load preserves both records exactly',()=>{const source=componentTarget();authoring.addComponent(source,collider.BOX_ID);authoring.addComponent(source,collider.CIRCLE_ID);source.components[collider.BOX_ID].offset=[2,-1];const record={components:authoring.serializeComponents(source)};const target=componentTarget();authoring.applyRecord(JSON.parse(JSON.stringify(record)),target);assert.deepStrictEqual(authoring.serializeComponents(target),record.components);});
test('object duplication deep-copies collider data',()=>{const source=componentTarget();authoring.addComponent(source,collider.BOX_ID);const target=componentTarget();authoring.copyComponents(source,target);assert.deepStrictEqual(target.components[collider.BOX_ID],source.components[collider.BOX_ID]);assert.notStrictEqual(target.components[collider.BOX_ID],source.components[collider.BOX_ID]);});
test('normal shared record path covers Prefab and Level duplication',()=>{const source=componentTarget();authoring.addComponent(source,collider.CIRCLE_ID);const saved=JSON.parse(JSON.stringify({kind:'cube',components:authoring.serializeComponents(source)}));const instance=componentTarget();authoring.applyRecord(saved,instance);assert.strictEqual(instance.components[collider.CIRCLE_ID].radius,.5);});
test('component presence creates no response state',()=>{const target=componentTarget();target.position=[1,2];authoring.addComponent(target,collider.BOX_ID);assert.deepStrictEqual(target.position,[1,2]);assert(!('velocity' in target));assert(!('bodyType' in target));});
test('component presence creates no trigger state',()=>{const target=componentTarget();authoring.addComponent(target,collider.BOX_ID);assert(!target.isTrigger);assert(!('onEnter' in target.components[collider.BOX_ID]));});
test('pure module owns no frame loop or global pair registry',()=>{const source=fs.readFileSync(path.join(ROOT,'editor/src/00-collider-2d.js'),'utf8');assert(!/requestAnimationFrame|onUpdate|setInterval/.test(source));assert(!/physicsWorld|colliderRegistry/.test(source));});
test('Add Component UI derives Collider results from registry',()=>assert(editor.includes('OpusAuthoring.discoverComponents(selectedItem, query)')));
test('Inspector exposes Fit and removal',()=>{assert(editor.includes('data-collider-fit'));assert(editor.includes('data-collider-remove'));});
test('selected-only Box and Circle gizmos exist',()=>{assert(html.includes('collider-2d-overlay'));assert(editor.includes('syncCollider2DOverlay'));assert(editor.includes("playMode || selectedItems.size !== 1"));});
test('gizmo provides Box resize/offset and Circle radius/offset handles',()=>{for(const token of ["center:[ox,oy]","w:[ox-width/2,oy]","'radius'","editBoxFromLocalHandle","editCircleFromLocalHandle"])assert(editor.includes(token),token);});
test('one direct drag creates one Undo boundary',()=>assert(editor.includes("if (!state.moved) { pushUndo(); state.moved = true; }")));
test('disabled gizmo uses non-color styling',()=>{assert(html.includes('.collider-shape.disabled'));assert(html.includes('stroke-dasharray'));assert(editor.includes("' · Disabled'"));});
test('Playable mode suppresses collider authoring furniture',()=>assert(editor.includes('playMode || selectedItems.size !== 1')));
test('all export pipelines embed collider module',()=>{for(const file of ['build/build-games.js','build/build-games-site.js','editor/src/01-editor.js'])assert(fs.readFileSync(path.join(ROOT,file),'utf8').includes('00-collision-filter-2d.js'),file);});
test('all export pipelines embed collider module',()=>{for(const file of ['build/build-games.js','build/build-games-site.js','editor/src/01-editor.js'])assert(fs.readFileSync(path.join(ROOT,file),'utf8').includes('00-collider-2d.js'),file);});
test('engine-site packages collider module',()=>assert(fs.readFileSync(path.join(ROOT,'build/build-engine-site.js'),'utf8').includes('00-collision-filter-2d.js')));
test('engine-site packages collider module',()=>assert(fs.readFileSync(path.join(ROOT,'build/build-engine-site.js'),'utf8').includes('00-collider-2d.js')));
test('Phase 041 passive colliders remain trigger-free after Phase 042',()=>[collider.BOX_ID,collider.CIRCLE_ID].forEach((id)=>assert(!authoring.registry.get(id).fields.some((field)=>field.key==='isTrigger'))));
test('Phase 041 collider schemas remain independent of the Phase 043 Body role',()=>{ for(const id of [collider.BOX_ID,collider.CIRCLE_ID]) assert(!authoring.registry.get(id).fields.some((field)=>/body|velocity/i.test(field.key))); });

if (process.exitCode) process.exit(process.exitCode);
console.log(`Phase 041 2D Colliders: ${passed}/${passed} tests passed`);
