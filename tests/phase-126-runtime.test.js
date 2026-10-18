'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
function fixture(){const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),c);c.Opus=c.window.Opus;
 vm.runInContext(['nearestWaypointTo','findWaypointPath','navigateToTargetTick','targetEntity','itemColliderConfig','resolveItemColliderCollision','applyAiMovementStep','resolveAiSolidMovement'].map(extract).join('\n')+'\n'+
 'this.make=(id,x,y,z,connections)=>({id,kind:"cube",isWaypoint:true,connections,entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(x,y,z)})});this.placed=[];this.findItemById=id=>placed.find(item=>item.id===id);this.actor=make("actor",0,0,0,[]);actor.isWaypoint=false;actor.entity.ai={type:"navigateToTarget",speed:3};this.target=make("target",10,0,0,[]);target.isWaypoint=false;this.player=target;',c);
 return {c,run:code=>vm.runInContext(code,c),tick(dt){return c.navigateToTargetTick(c.actor,c.actor.entity.ai,c.actor.entity.position,c.target.entity,dt);}};
}
const json=value=>JSON.parse(JSON.stringify(value)),near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
test('Actual A* preserves directed connections, ignores dangling IDs and chooses shortest connected route with cycles',()=>{
 const f=fixture();f.run('placed=[make("a",0,0,0,["missing","b","c"]),make("b",3,0,0,["a","d"]),make("c",0,0,10,["d"]),make("d",6,0,0,[])];');const before=JSON.stringify(f.c.placed.map(p=>p.connections));assert.deepStrictEqual(json(f.c.findWaypointPath('a','d')),['a','b','d']);assert.equal(f.c.findWaypointPath('d','a'),null);assert.equal(JSON.stringify(f.c.placed.map(p=>p.connections)),before);
});
test('Actual nearest and path cost use XYZ world position and ignore render scale',()=>{
 const f=fixture();f.run('placed=[make("high",0,100,0,[]),make("near",2,0,0,[])];placed[1].entity.scale.set(100,100,100);');assert.equal(f.c.nearestWaypointTo(f.c.actor.entity.position).id,'near');
});
test('Actual no graph or disconnected graph retains direct XZ steering without promising obstacle avoidance',()=>{
 for(const graph of [false,true]){const f=fixture();if(graph)f.run('placed=[make("a",0,0,0,[]),make("b",10,0,0,[])];');f.tick(1);near(f.c.actor.entity.position.x,3);near(f.c.actor.entity.position.y,0);assert.equal(f.c.actor.entity.ai.navPath,null);}
});
test('Actual live final target steering speed is seconds at 30/60/144 and finished-route recompute is suppressed',()=>{
 for(const hz of [30,60,144]){const f=fixture();f.run('actor.entity.ai.navPath=["gone"];actor.entity.ai.navPathIndex=1;actor.entity.ai.navRecomputeTimer=-10;');for(let n=0;n<hz;n++)f.tick(1/hz);near(f.c.actor.entity.position.x,3);assert.equal(f.c.actor.entity.ai.navRecomputeTimer,-10);f.run('target.entity.position.z=10;');f.tick(.1);assert(f.c.actor.entity.position.z>0);}
});
test('Actual on-route recompute starts from current aim waypoint and vanished waypoint invalidates route',()=>{
 const f=fixture();f.run('placed=[make("a",0,0,0,["b"]),make("b",5,0,0,["c"]),make("c",10,0,0,[])];actor.entity.position.x=2;Object.assign(actor.entity.ai,{navPath:["a","b","c"],navPathIndex:1,navRecomputeTimer:0});');f.tick(.1);assert.deepStrictEqual(json(f.c.actor.entity.ai.navPath),['b','c']);near(f.c.actor.entity.position.x,2.3);
 f.run('placed=placed.filter(p=>p.id!=="b");actor.entity.ai.navRecomputeTimer=10;');f.tick(.1);assert.equal(f.c.actor.entity.ai.navPath,null);
});
test('XZ navigation must advance an elevated waypoint once planar arrival is reached',()=>{
 for(const hz of [30,60,144]){const f=fixture();f.run('placed=[make("a",0,2,0,["b"]),make("b",10,2,0,[])];');f.tick(1/hz);assert.equal(f.c.actor.entity.ai.navPathIndex,1,'Initial planar arrival advances first elevated waypoint');for(let n=1;n<hz;n++)f.tick(1/hz);assert(f.c.actor.entity.position.x>2.8,'Planar controller must proceed toward elevated second waypoint');near(f.c.actor.entity.position.y,0);}
});
test('Actual graph refuses missing start equal goal, non-waypoint nodes and malformed connection arrays',()=>{
 const f=fixture();assert.equal(f.c.findWaypointPath('missing','missing'),null);f.run('placed=[make("a",0,0,0,["cube"]),make("cube",5,0,0,["b"]),make("b",10,0,0,[])];placed[1].isWaypoint=false;');assert.equal(f.c.findWaypointPath('a','b'),null);assert.equal(f.c.findWaypointPath('cube','cube'),null);
 for(const raw of [null,false,0,'b',{}, {0:'b',length:1}]){f.run('placed[0].connections='+JSON.stringify(raw)+';');assert.equal(f.c.findWaypointPath('a','b'),null);}
 f.run('placed[0].connections=["missing","b"];');assert.deepStrictEqual(json(f.c.findWaypointPath('a','b')),['a','b']);
});
test('Historical XYZ arrival expression replay demonstrates elevated-waypoint stall (not a pre-fix run)',()=>{
 const f=fixture(),actual=extract('navigateToTargetTick'),current='Math.hypot(pos.x-wp.entity.position.x,pos.z-wp.entity.position.z) < 0.4';assert(actual.includes(current));
 // Explicit historical expression replay only; production source is unchanged.
 f.run(actual.replace(current,'pos.sub(wp.entity.position).length() < 0.4'));f.run('placed=[make("a",0,2,0,["b"]),make("b",10,2,0,[])];');for(let n=0;n<60;n++)f.tick(1/60);near(f.c.actor.entity.position.x,0);assert.equal(f.c.actor.entity.ai.navPathIndex,0);
});
test('Navigation through actual shared movement dispatch honors owner swept solids and non-solid pass-through',()=>{
 const f=fixture();f.run('Object.assign(actor.entity.ai,{speed:20,collideWithSolids:true});this.wall=make("wall",2,1,0,[]);wall.isWaypoint=false;wall.entity.scale.set(.2,4,4);wall.entity.solid=true;placed=[wall];');f.c.applyAiMovementStep(f.c.actor,f.c.actor.entity.ai,f.c.actor.entity.position,1,0);assert(f.c.actor.entity.position.x>0&&f.c.actor.entity.position.x<=1.551);f.run('actor.entity.position.set(0,0,0);wall.entity.solid=false;');f.c.applyAiMovementStep(f.c.actor,f.c.actor.entity.ai,f.c.actor.entity.position,1,0);near(f.c.actor.entity.position.x,10);
});
console.log(`Phase126 actual waypoint runtime: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
