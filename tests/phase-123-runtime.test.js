'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
function fixture(){const c={window:{},simElapsed:7};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),c);c.Opus=c.window.Opus;
  vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-ai-brain'),'utf8')+'\n'+['defaultAiPerception','aiBrainCanRun','itemColliderConfig','hasLineOfSightToPosition','hasLineOfSightToPlayer','aiCanSeePlayer','emitNoiseEvent'].map(extract).join('\n')+'\n'+
    'this.actor={kind:"cube",entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(0,0,0)})};actor.entity.ai={type:"follow",perception:{visionDistance:10,fovDegrees:90,requiresLOS:true,hearingRadius:8}};this.player={entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(0,0,5)})};this.placed=[actor];',c);
  return {c,run:code=>vm.runInContext(code,c),see:()=>c.aiCanSeePlayer(c.actor,c.actor.entity.position)};
}
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
test('Actual vision origin and range are actor world position projected XZ, independent of target elevation',()=>{
  const f=fixture();f.run('player.entity.position=new Opus.Vec3(0,100,10);actor.entity.ai.perception.requiresLOS=false;');assert(f.see());f.run('player.entity.position.z=10.01;');assert.equal(f.see(),false);
  f.run('actor.entity.position=new Opus.Vec3(20,0,30);player.entity.position=new Opus.Vec3(20,100,35);');assert(f.see());
});
test('Actual FOV uses actual Entity forward yaw: yaw zero +Z and positive quarter-turn +X',()=>{
  const f=fixture();assert(f.see());f.run('player.entity.position=new Opus.Vec3(5,0,0);');assert.equal(f.see(),false);f.run('actor.entity.rotationY=Math.PI/2;');assert(f.see());f.run('player.entity.position=new Opus.Vec3(-5,0,0);');assert.equal(f.see(),false);
});
test('Actual cone includes near-boundary points and full-circle FOV without changing authored settings',()=>{
  const f=fixture(),before=JSON.stringify(f.c.actor.entity.ai);f.run('player.entity.position=new Opus.Vec3(3.999,0,4);');assert(f.see());f.run('player.entity.position.x=4.001;');assert.equal(f.see(),false);assert.equal(JSON.stringify(f.c.actor.entity.ai),before);
  f.run('actor.entity.ai.perception.fovDegrees=360;player.entity.position=new Opus.Vec3(0,0,-5);');assert(f.see());
});
test('Actual LOS uses real oriented legacy solid box rays and excludes observer, invisible and non-solid objects',()=>{
  const f=fixture();f.run('actor.entity.solid=true;this.wall={kind:"cube",entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(0,0,2.5),scale:new Opus.Vec3(4,2,.2),rotationY:Math.PI/4})};wall.entity.solid=true;placed.push(wall);');assert.equal(f.see(),false);
  f.run('wall.entity.visible=false;');assert(f.see());f.run('wall.entity.visible=true;wall.entity.solid=false;');assert(f.see());f.run('wall.entity.solid=true;actor.entity.ai.perception.requiresLOS=false;');assert(f.see());
});
test('Actual LOS respects authored sphere offset and ignores blockers beyond player endpoint',()=>{
  const f=fixture();f.run('this.wall={kind:"cube",entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(3,0,2.5)}),collider:{shape:"sphere",radius:.5,offset:{x:-3,y:0,z:0}}};wall.entity.solid=true;placed.push(wall);');assert.equal(f.see(),false);
  f.run('wall.entity.position.z=7;');assert(f.see());f.run('wall.entity.position.z=2.5;wall.kind="sprite";');assert(f.see(),'Modern Sprite Collider is not part of legacy LOS enumeration');
});
test('Actual LOS casts in XYZ despite planar range/cone and zero planar distance short-circuits perception',()=>{
  const f=fixture();f.run('player.entity.position=new Opus.Vec3(0,10,5);this.wall={kind:"cube",entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(0,0,2.5),scale:new Opus.Vec3(2,1,.2)})};wall.entity.solid=true;placed.push(wall);');assert(f.see(),'Elevated target ray passes above low box');
  f.run('player.entity.position=new Opus.Vec3(0,10,0);actor.entity.ai.perception.visionDistance=0;');assert(f.see(),'Coincident planar target is visible before LOS/cone');f.run('player=null;');assert.equal(f.see(),false);
});
test('Actual hearing is an XYZ sphere bounded by both emitter and listener radius with independent noise position',()=>{
  const f=fixture();f.run('this.noise=new Opus.Vec3(0,0,5);emitNoiseEvent(noise,4);');assert.equal(f.c.actor._lastHeardNoiseAt,undefined);f.run('emitNoiseEvent(noise,5);');assert.equal(f.c.actor._lastHeardNoiseAt,7);f.run('noise.z=99;');assert.equal(f.c.actor._lastHeardNoisePos.z,5);
  f.run('delete actor._lastHeardNoiseAt;emitNoiseEvent(new Opus.Vec3(0,9,0),20);');assert.equal(f.c.actor._lastHeardNoiseAt,undefined);f.run('emitNoiseEvent(new Opus.Vec3(0,8,0),20);');assert.equal(f.c.actor._lastHeardNoiseAt,7);
});
test('Historical absent senses retain vision defaults but no hearing listener; disabled Brain receives no noise',()=>{
  const f=fixture();f.run('delete actor.entity.ai.perception;player.entity.position=new Opus.Vec3(0,0,14);');assert(f.see());f.run('emitNoiseEvent(new Opus.Vec3(0,0,1),20);');assert.equal(f.c.actor._lastHeardNoiseAt,undefined);
  f.run('actor.entity.ai.perception={visionDistance:10,fovDegrees:90,requiresLOS:true,hearingRadius:8};actor.components={"ai-brain":OpusAiBrain.captureLegacy(actor.entity.ai,{enabled:false}).record};emitNoiseEvent(new Opus.Vec3(0,0,1),20);');assert.equal(f.c.actor._lastHeardNoiseAt,undefined);
});
test('Actual explicit-position LOS and Player wrapper agree exactly while wrapper remains false without Player',()=>{
  const f=fixture();f.run('this.wall={kind:"cube",entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(0,0,2.5),scale:new Opus.Vec3(2,2,.2)})};wall.entity.solid=true;placed.push(wall);');
  assert.equal(f.c.hasLineOfSightToPosition(f.c.actor.entity.position,f.c.player.entity.position,f.c.actor),false);
  assert.equal(f.c.hasLineOfSightToPlayer(f.c.actor.entity.position,f.c.actor),false);
  f.run('player.entity.position.x=5;');assert.equal(f.c.hasLineOfSightToPlayer(f.c.actor.entity.position,f.c.actor),f.c.hasLineOfSightToPosition(f.c.actor.entity.position,f.c.player.entity.position,f.c.actor));
  f.run('this.probe=player.entity.position.clone();player=null;');assert.equal(f.c.hasLineOfSightToPlayer(f.c.actor.entity.position,f.c.actor),false);assert.equal(f.c.hasLineOfSightToPosition(f.c.actor.entity.position,f.c.probe,f.c.actor),true);
});
console.log(`Phase123 actual Perception runtime: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
