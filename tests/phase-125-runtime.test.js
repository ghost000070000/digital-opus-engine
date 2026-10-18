'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
function fixture(){const c={window:{},simElapsed:0};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),c);c.Opus=c.window.Opus;
  vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-ai-brain'),'utf8')+'\n'+['targetEntity','itemColliderConfig','resolveItemColliderCollision','applyAiMovementStep','resolveAiSolidMovement','aiBrainCanRun','emitNoiseEvent','evaluateAiTransitionCondition','aiStateDef','enterAiState','tickAiStateMachine','distanceToPlayerXZ','hasLineOfSightToPosition','hasLineOfSightToPlayer','defaultAiPerception','aiCanSeePlayer'].map(extract).join('\n')+'\n'+
    'this.make=(id,x,y,z)=>({id,kind:"cube",entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(x,y,z)})});this.actor=make("actor",0,0,0);this.player=null;this.placed=[actor];this.findItemById=id=>placed.find(item=>item.id===id);actor.entity.ai={type:"investigate",speed:3,perception:{hearingRadius:30}};',c);
  return {c,run:code=>vm.runInContext(code,c),tick(dt){return c.applyAiMovementStep(c.actor,c.actor.entity.ai,c.actor.entity.position,dt,c.simElapsed);},state(dt,time){c.simElapsed=time;return c.tickAiStateMachine(c.actor,c.actor.entity.ai,c.actor.entity.position,dt,time);}};
}
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('Actual hearing clones latest noise with real timestamp and bounded XYZ emitter/listener radius',()=>{
  const f=fixture();f.run('this.noise=new Opus.Vec3(0,5,0);emitNoiseEvent(noise,4);');assert.equal(f.c.actor._lastHeardNoiseAt,undefined);f.run('simElapsed=2;emitNoiseEvent(noise,5);noise.y=100;');near(f.c.actor._lastHeardNoisePos.y,5);assert.equal(f.c.actor._lastHeardNoiseAt,2);f.run('simElapsed=3;emitNoiseEvent(new Opus.Vec3(4,0,0),30);');near(f.c.actor._lastHeardNoisePos.x,4);assert.equal(f.c.actor._lastHeardNoiseAt,3);
});
test('Actual Investigate absent noise is inert and arrival within half unit remains stationary',()=>{
  const f=fixture();f.tick(1);near(f.c.actor.entity.position.x,0);f.run('actor._lastHeardNoisePos=new Opus.Vec3(.5,99,0);');f.tick(1);near(f.c.actor.entity.position.x,0);f.run('actor._lastHeardNoisePos.x=.51;');f.tick(1);near(f.c.actor.entity.position.x,.51);near(f.c.actor.entity.position.y,0);near(f.c.actor.entity.rotationY,Math.PI/2);
});
test('Actual Investigate speed is seconds in XZ at 30/60/144 and does not mutate remembered noise',()=>{
  for(const hz of [30,60,144]){const f=fixture();f.run('actor._lastHeardNoisePos=new Opus.Vec3(10,100,0);actor._lastHeardNoiseAt=0;');for(let n=0;n<hz;n++)f.tick(1/hz);near(f.c.actor.entity.position.x,3);near(f.c.actor.entity.position.y,0);near(f.c.actor._lastHeardNoisePos.x,10);near(f.c.actor._lastHeardNoisePos.y,100);}
});
test('Actual Investigate owner opt-in uses existing swept wall collision, non-solid remains passable',()=>{
  const f=fixture();f.run('actor._lastHeardNoisePos=new Opus.Vec3(10,0,0);Object.assign(actor.entity.ai,{speed:20,collideWithSolids:true});this.wall=make("wall",2,1,0);wall.entity.scale.set(.2,4,4);wall.entity.solid=true;placed.push(wall);');f.tick(1);assert(f.c.actor.entity.position.x>0&&f.c.actor.entity.position.x<=1.551);f.run('actor.entity.position.set(0,0,0);wall.entity.solid=false;');f.tick(1);near(f.c.actor.entity.position.x,10);
});
test('Explicit zero hearing recency accepts same-time only, not historical three-second fallback',()=>{
  const f=fixture();f.run('actor._lastHeardNoiseAt=1;simElapsed=1;');assert(f.c.evaluateAiTransitionCondition({type:'heardNoiseRecently',value:0},f.c.actor,f.c.actor.entity.position));f.run('simElapsed=1.01;');assert.equal(f.c.evaluateAiTransitionCondition({type:'heardNoiseRecently',value:0},f.c.actor,f.c.actor.entity.position),false,'Explicit zero must not become default three seconds');
});
test('Historical omitted recency defaults three seconds, missing noise is false, explicit positive window is bounded',()=>{
  const f=fixture();assert.equal(f.c.evaluateAiTransitionCondition({type:'heardNoiseRecently'},f.c.actor,f.c.actor.entity.position),false);f.run('actor._lastHeardNoiseAt=0;simElapsed=3;');assert(f.c.evaluateAiTransitionCondition({type:'heardNoiseRecently'},f.c.actor,f.c.actor.entity.position));f.run('simElapsed=3.01;');assert.equal(f.c.evaluateAiTransitionCondition({type:'heardNoiseRecently'},f.c.actor,f.c.actor.entity.position),false);assert.equal(f.c.evaluateAiTransitionCondition({type:'heardNoiseRecently',value:1},f.c.actor,f.c.actor.entity.position),false);
});
test('Actual composed Listen Investigate Search Listen repeats for second noise and exposes existing retained Wander anchor',()=>{
  const f=fixture();f.run('Object.assign(actor.entity.ai,{mode:"stateMachine",startState:"Listen",states:[{name:"Listen",movement:{type:""},transitions:[{condition:{type:"heardNoiseRecently",value:1},to:"Investigate"}]},{name:"Investigate",movement:{type:"investigate",speed:3},transitions:[{condition:{type:"timeInStateAtLeast",value:1},to:"Search"}]},{name:"Search",movement:{type:"wander",speed:0,radius:2},transitions:[{condition:{type:"timeInStateAtLeast",value:1},to:"Listen"}]}]});');
  f.state(.1,0);assert.equal(f.c.actor.entity.ai._currentState,'Listen');f.run('simElapsed=.1;emitNoiseEvent(new Opus.Vec3(10,0,0),30);');f.state(.1,.1);assert.equal(f.c.actor.entity.ai._currentState,'Investigate');near(f.c.actor.entity.position.x,.3);
  f.state(.1,1.11);assert.equal(f.c.actor.entity.ai._currentState,'Search');const firstBase=f.c.actor.entity.ai.states[2].movement.base;near(firstBase.x,.3);f.state(.1,2.12);assert.equal(f.c.actor.entity.ai._currentState,'Listen');f.state(.1,2.2);assert.equal(f.c.actor.entity.ai._currentState,'Listen','Expired first noise must not immediately retrigger');
  f.run('simElapsed=3;emitNoiseEvent(new Opus.Vec3(-10,0,0),30);');f.state(.1,3);assert.equal(f.c.actor.entity.ai._currentState,'Investigate');near(f.c.actor.entity.position.x,0);f.state(.1,4.01);assert.equal(f.c.actor.entity.ai._currentState,'Search');assert.strictEqual(f.c.actor.entity.ai.states[2].movement.base,firstBase,'Characterization: existing entry retains prior Wander base');near(firstBase.x,.3);near(f.c.actor._lastHeardNoisePos.x,-10);
});
test('Actual disabled or malformed future Brain cannot receive hearing memory; absent legacy remains supported',()=>{
  for(const raw of [null,false,[],{version:99,enabled:true,config:{type:'investigate'}},{version:1,enabled:false,config:{type:'investigate',speed:3,perception:{hearingRadius:30}}}]){const f=fixture();f.run('actor.components={"ai-brain":'+JSON.stringify(raw)+'};emitNoiseEvent(new Opus.Vec3(1,0,0),30);');assert.equal(f.c.aiBrainCanRun(f.c.actor),false);assert.equal(f.c.actor._lastHeardNoiseAt,undefined);}
});
test('Opt-in Search reanchors and clears Wander target/timer on each actual state entry, without authored base mutation',()=>{
  const f=fixture();f.run('Object.assign(actor.entity.ai,{mode:"stateMachine",startState:"Listen",states:[{name:"Listen",movement:{type:""},transitions:[{condition:{type:"heardNoiseRecently",value:1},to:"Investigate"}]},{name:"Investigate",movement:{type:"investigate",speed:3},transitions:[{condition:{type:"timeInStateAtLeast",value:1},to:"Search"}]},{name:"Search",movement:{type:"wander",speed:1,radius:2,base:[50,0,50],restartOnEnter:true},transitions:[{condition:{type:"timeInStateAtLeast",value:1},to:"Listen"}]}]});');
  f.run('actor.entity.ai.states[2].movement.base=new Opus.Vec3(50,0,50);');const captured=f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai);assert(captured.ok);
  f.state(.1,0);f.run('simElapsed=.1;emitNoiseEvent(new Opus.Vec3(10,0,0),30);');f.state(.1,.1);f.state(0,1.11);
  let movement=f.c.actor.entity.ai.states[2].movement;near(movement._entryBase.x,.3);near(movement._entryBase.z,0);assert(Math.hypot(movement.wanderTarget.x-.3,movement.wanderTarget.z)<=2);assert.deepStrictEqual(JSON.parse(JSON.stringify(movement.base)),{x:50,y:0,z:50});
  f.state(0,2.12);f.run('simElapsed=3;emitNoiseEvent(new Opus.Vec3(-10,0,0),30);');f.state(.1,3);
  f.run('actor.entity.ai.states[2].movement.wanderTarget=new Opus.Vec3(999,0,999);actor.entity.ai.states[2].movement.wanderTimer=999;');
  f.c.simElapsed=4.01;f.c.enterAiState(f.c.actor,f.c.actor.entity.ai,'Search');movement=f.c.actor.entity.ai.states[2].movement;
  near(movement._entryBase.x,0);near(movement._entryBase.z,0);assert.equal(movement.wanderTarget,undefined);assert.equal(movement.wanderTimer,undefined);assert.notStrictEqual(movement._entryBase,f.c.actor.entity.position);
  f.state(0,4.01);assert(Math.hypot(movement.wanderTarget.x,movement.wanderTarget.z)<=2);assert(movement.wanderTimer>=1.5&&movement.wanderTimer<=3.5);
  const after=f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai);assert(after.ok);assert.deepStrictEqual(JSON.parse(JSON.stringify(after.record)),JSON.parse(JSON.stringify(captured.record)),'Entry base and Wander caches must never become authored data');
});
test('Search restart policy is strict boolean and transient entry base is excluded by actual Brain capture',()=>{
  const f=fixture();for(const invalid of [null,0,1,'true',[],{}]){f.run('actor.entity.ai={type:"wander",speed:1,radius:2,restartOnEnter:'+JSON.stringify(invalid)+'};');assert.equal(f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai).ok,false,'Malformed restart policy must not run as truthy intent');}
  for(const enabled of [false,true]){f.run('actor.entity.ai={type:"wander",speed:1,radius:2,restartOnEnter:'+enabled+',_entryBase:new Opus.Vec3(7,8,9)};');const saved=f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai);assert(saved.ok);assert.equal(saved.record.config.restartOnEnter,enabled);assert.equal(saved.record.config._entryBase,undefined);}
});
console.log(`Phase125 actual investigation runtime: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
