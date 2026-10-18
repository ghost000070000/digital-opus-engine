'use strict';
// Qualification-only characterization. No Phase079 implementation API is
// inferred from the old palette label or the independently qualified 2D role.
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const Schema=require('../editor/src/00-authoring-schema'),Collider=require('../editor/src/00-collider-2d'),Moving=require('../editor/src/00-moving-platform-2d'),Body=require('../editor/src/00-body-2d');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0);const brace=source.indexOf('{',start);let depth=1,end=brace+1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(start,end);}
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new Vec3(this.x,this.y,this.z);}set(x,y,z){Object.assign(this,{x,y,z});return this;}}
const placed=[];let undoCount=0;
const c={placed,cubeMesh:{},Opus:{Vec3},pushUndo(){undoCount++;},selectItem(){},addPlaced:item=>placed.push(item),app:{addEntity:options=>({...options,position:options.position.clone(),scale:options.scale.clone(),visible:true})}};
c.findItemById=id=>placed.find(item=>item.id===id);vm.createContext(c);
const begin=source.indexOf("} else if (type === 'movingPlatform') {")+"} else if (type === 'movingPlatform') {".length,end=source.indexOf("} else if (type === 'projectilePreset')",begin);
assert(begin>0&&end>begin);
const action=source.slice(source.indexOf('  playAnimation: {'),source.indexOf('  setSpriteAnimationState: {'));
vm.runInContext('function emitLegacyMovingPlatform(point){'+source.slice(begin,end)+'};globalThis.ACTION_TYPES={'+action+'};'+['resolveTarget','easeValue','sampleAnimationTrack','updateAnimations'].map(extract).join('\n'),c);
c.emitLegacyMovingPlatform(new Vec3(10,99,3));const legacy=placed[0];
assert.equal(legacy.kind,'cube');assert.equal(legacy.entity.solid,true);assert.deepStrictEqual([legacy.entity.scale.x,legacy.entity.scale.y,legacy.entity.scale.z],[3,.4,3]);assert.equal(legacy.entity.position.y,.5);assert.equal(legacy.components,undefined,'Historical preset is legacy Solid/Animation, not modern Body/Collider');
assert.equal(legacy.behaviors[0].trigger,'start');assert.equal(legacy.behaviors[0].action,'playAnimation');assert.equal(legacy.animationClips[0].duration,2);assert.equal(legacy.animationClips[0].loop,'pingpong');assert.deepStrictEqual(Array.from(legacy.animationClips[0].tracks.position[1].value),[14,.5,3]);
c.ACTION_TYPES.playAnimation.exec({clipName:'Patrol'},legacy);c.updateAnimations(1);assert.equal(legacy.entity.position.x,12);c.updateAnimations(1);assert.equal(legacy.entity.position.x,14);c.updateAnimations(2);assert.equal(legacy.entity.position.x,10,'Canonical Property Animation owns legacy reversal');
console.log('PASS Actual legacy palette emission and canonical ping-pong Property Animation');
const sparse={kind:'sprite'};assert(Schema.addComponent(sparse,'moving-platform-2d').ok);assert.deepStrictEqual(Schema.registry.get('moving-platform-2d').ownedFields,['enabled']);const codes=Schema.validateComponent(sparse,'moving-platform-2d').map(issue=>issue.code);assert(codes.includes('moving-platform-2d-needs-body')&&codes.includes('moving-platform-2d-needs-box'));
console.log('PASS Modern role is discoverable support/carry, not motion/path authoring');
function object(id,x,y,velocity,platform=false,character=false){const components={'body-2d':{version:1,enabled:true,type:'kinematic',linearVelocity:velocity.slice()},'box-collider-2d':{version:1,enabled:true,offset:[0,0],size:platform?[4,.5]:[1,1]}};if(platform)components['moving-platform-2d']={version:1,enabled:true};if(character)components['character-collision-2d']={version:2,enabled:true,wallSlideEnabled:true,wallSlideMaxSpeed:3,slopeHandlingEnabled:true,maxSlopeAngle:50,stepHandlingEnabled:true,maxStepHeight:.5};return{id,kind:'sprite',components,entity:{position:{x,y,z:0}},worldMatrix:Collider.composeMatrix({position:[x,y,0]})};}
const p=object('platform',0,0,[2,0],true),r=object('rider',0,.75,[0,0],false,true);assert(Moving.eligible(p));Body.createBody2DManager().tick([r,p],.5);assert.equal(p.entity.position.x,1);assert.equal(r.entity.position.x,1);assert.deepStrictEqual(p.components['body-2d'].linearVelocity,[2,0],'Body owns requested motion; support role does not write velocity');
const stationary=object('stationary',0,0,[0,0],true);Body.createBody2DManager().tick([stationary],1);assert.equal(stationary.entity.position.x,0,'Adding support role alone does not invent a patrol');
console.log('PASS Actual Body2D translation carries Character; zero velocity produces no automatic path');
for(const mutate of [o=>o.components['body-2d'].type='static',o=>o.components['box-collider-2d'].enabled=false,o=>o.components['moving-platform-2d'].version=99]){const item=object('invalid',0,0,[2,0],true);mutate(item);assert.equal(Moving.eligible(item),false);}
const future={kind:'sprite',components:{'moving-platform-2d':{version:99,enabled:true,futureRoute:{points:[[1,2],[3,4]]}},'unknown-platform-policy':{version:8,opaque:['preserve']}}};const portable=Schema.serializeComponents(future);assert.deepStrictEqual(portable['moving-platform-2d'],future.components['moving-platform-2d']);assert.deepStrictEqual(portable['unknown-platform-policy'],future.components['unknown-platform-policy']);portable['moving-platform-2d'].futureRoute.points[0][0]=99;assert.equal(future.components['moving-platform-2d'].futureRoute.points[0][0],1,'Unknown/future records remain independent and preserved, not migrated');
console.log('PASS Dependency/future policy inertness and unknown record preservation');
console.log('Phase079 existing legacy/modern platform characterization PASS; not Phase079 READY');
