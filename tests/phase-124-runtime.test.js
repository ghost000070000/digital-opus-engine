'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
function fixture(){const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),c);c.Opus=c.window.Opus;
  vm.runInContext(['targetEntity','itemColliderConfig','resolveItemColliderCollision','applyAiMovementStep','resolveAiSolidMovement'].map(extract).join('\n')+'\n'+
    'this.make=(id,x,y,z)=>({id,kind:"cube",entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(x,y,z)})});this.actor=make("actor",0,0,0);this.player=make("player",20,100,0);this.placed=[actor];this.findItemById=id=>placed.find(item=>item.id===id);actor.entity.ai={type:"follow",speed:3,radius:10};',c);
  return {c,run:code=>vm.runInContext(code,c),tick(dt){return c.applyAiMovementStep(c.actor,c.actor.entity.ai,c.actor.entity.position,dt,0);}};
}
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('Actual Follow uses explicit Cube target or Player fallback, XZ speed seconds, and no radius detection gate',()=>{
  for(const hz of [30,60,144]){const f=fixture();f.run('this.target=make("target",10,-100,0);placed.push(target);actor.entity.ai.targetId="target";actor.entity.ai.radius=.01;');for(let n=0;n<hz;n++)f.tick(1/hz);near(f.c.actor.entity.position.x,3);near(f.c.actor.entity.position.y,0);}
  const f=fixture();f.run('actor.entity.ai.targetId="missing";');f.tick(1);near(f.c.actor.entity.position.x,0);f.run('delete actor.entity.ai.targetId;');f.tick(1);near(f.c.actor.entity.position.x,3);
});
test('Historical Basic Enemy Follow speed zero remains stationary through actual Brain capture and roundtrip',()=>{
  const f=fixture();f.run(fs.readFileSync(require.resolve('../editor/src/00-ai-brain'),'utf8'));
  f.run('actor.entity.ai.speed=0;this.captured=OpusAiBrain.captureLegacy(actor.entity.ai);');assert.equal(f.c.captured.ok,true,'Historical stationary Follow must remain capturable');assert.equal(f.c.captured.record.config.speed,0);
  f.run('this.restored=OpusAiBrain.toLegacy(JSON.parse(JSON.stringify(captured.record)));actor.entity.ai=restored.config;');assert.equal(f.c.restored.ok,true);assert.equal(f.c.actor.entity.ai.speed,0);
  const before=JSON.stringify(f.c.actor.entity.ai);for(const hz of [30,60,144])for(let n=0;n<hz;n++)f.tick(1/hz);
  near(f.c.actor.entity.position.x,0);near(f.c.actor.entity.position.y,0);near(f.c.actor.entity.position.z,0);assert.equal(JSON.stringify(f.c.actor.entity.ai),before);
});
test('Actual Flee is Player-only with strict radius cutoff, planar motion, and refresh partitions',()=>{
  for(const hz of [30,60,144]){const f=fixture();f.run('player.entity.position.set(-1,100,0);this.target=make("target",10,0,0);placed.push(target);Object.assign(actor.entity.ai,{type:"flee",targetId:"target",radius:10});');for(let n=0;n<hz;n++)f.tick(1/hz);near(f.c.actor.entity.position.x,3);near(f.c.actor.entity.position.y,0);}
  const f=fixture();f.run('Object.assign(actor.entity.ai,{type:"flee",radius:20});');f.tick(1);near(f.c.actor.entity.position.x,0);f.run('player=null;');f.tick(1);near(f.c.actor.entity.position.x,0);
});
test('Actual Wander existing transient target obeys speed seconds at 30/60/144 without resetting authored radius',()=>{
  for(const hz of [30,60,144]){const f=fixture();f.run('Object.assign(actor.entity.ai,{type:"wander",radius:7,wanderTarget:new Opus.Vec3(10,100,0),wanderTimer:10});');for(let n=0;n<hz;n++)f.tick(1/hz);near(f.c.actor.entity.position.x,3);near(f.c.actor.entity.position.y,0);assert.equal(f.c.actor.entity.ai.radius,7);near(f.c.actor.entity.ai.wanderTimer,9);}
});
test('Actual Wander lazily anchors at actor and generates bounded real random target and independent base',()=>{
  const f=fixture();f.run('actor.entity.position.set(4,2,7);Object.assign(actor.entity.ai,{type:"wander",radius:5,speed:0});');f.tick(.01);const ai=f.c.actor.entity.ai;near(ai.base.x,4);near(ai.base.y,2);near(ai.base.z,7);assert.notStrictEqual(ai.base,f.c.actor.entity.position);assert(Math.hypot(ai.wanderTarget.x-4,ai.wanderTarget.z-7)<=5);assert(ai.wanderTimer>=1.5&&ai.wanderTimer<=3.5);near(ai.wanderTarget.y,2);
});
test('Actual Patrol resolves authored names to first waypoint, ignores missing names, and moves with seconds',()=>{
  for(const hz of [30,60,144]){const f=fixture();f.run('this.first=make("first",10,100,0);first.isWaypoint=true;first.name="A";this.duplicate=make("duplicate",-10,0,0);duplicate.isWaypoint=true;duplicate.name="A";placed.push(first,duplicate);Object.assign(actor.entity.ai,{type:"patrolRoute",waypointNames:" missing, A ",loop:true,pingpong:false});');for(let n=0;n<hz;n++)f.tick(1/hz);near(f.c.actor.entity.position.x,3);assert.equal(JSON.stringify(f.c.actor.entity.ai.resolvedWaypointIds),'["first"]');near(f.c.actor.entity.position.y,0);assert.equal(f.c.actor.entity.ai.waypointNames,' missing, A ');}
});
test('Single-waypoint pingpong must remain at route index zero on repeated arrival ticks',()=>{
  const f=fixture();f.run('this.waypoint=make("point",0,0,0);waypoint.name="A";waypoint.isWaypoint=true;placed.push(waypoint);Object.assign(actor.entity.ai,{type:"patrolRoute",waypointNames:"A",pingpong:true});');for(let n=0;n<4;n++){f.tick(1/60);assert.equal(f.c.actor.entity.ai.currentWaypointIndex,0,'One waypoint has no valid negative or positive next index');}near(f.c.actor.entity.position.x,0);
});
test('Four actual movement modes use owner opt-in shared swept collision even for state movement slots',()=>{
  for(const mode of ['follow','flee','wander','patrolRoute']){const f=fixture();f.run('player.entity.position.set(-10,0,0);this.target=make("target",10,0,0);target.isWaypoint=true;target.name="A";this.wall=make("wall",2,1,0);wall.entity.scale.set(.2,4,4);wall.entity.solid=true;placed.push(target,wall);actor.entity.ai={collideWithSolids:true,collisionRadius:.35};this.slot={type:'+JSON.stringify(mode)+',speed:20,radius:100,targetId:"target",waypointNames:"A",wanderTarget:new Opus.Vec3(10,0,0),wanderTimer:10};');f.c.applyAiMovementStep(f.c.actor,f.c.slot,f.c.actor.entity.position,1,0);assert(f.c.actor.entity.position.x>0&&f.c.actor.entity.position.x<=1.551,mode+' must stop on entry side of real thin solid wall');near(f.c.actor.entity.position.y,0);assert.equal(f.c.actor.entity.ai.collideWithSolids,true);}
});
test('Historical collision absent remains translation; opt-in preserves non-solid pass-through and supporting floor',()=>{
  const f=fixture();f.run('this.wall=make("wall",2,1,0);wall.entity.scale.set(.2,4,4);wall.entity.solid=true;placed.push(wall);actor.entity.ai.speed=20;');f.tick(1);near(f.c.actor.entity.position.x,20);
  f.run('actor.entity.position.set(0,0,0);actor.entity.ai.collideWithSolids=true;wall.entity.solid=false;this.floor=make("floor",5,-.5,0);floor.entity.scale.set(100,1,100);floor.entity.solid=true;placed.push(floor);');f.tick(1);near(f.c.actor.entity.position.x,20);
});
console.log(`Phase124 actual movement runtime: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
