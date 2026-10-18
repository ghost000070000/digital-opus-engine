'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
function fixture(){const c={window:{},simElapsed:0,animations:0,ids:0};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../dist/opus-engine.js'),'utf8'),c);c.Opus=c.window.Opus;
 vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-ai-brain'),'utf8')+'\n'+(source.includes('function aiProjectilePrefabIssue(')?extract('aiProjectilePrefabIssue')+'\n':'')+['targetEntity','applyAiMovementStep','resolveAiSolidMovement','applyAiAttackStep','fireProjectile','aiStateDef','enterAiState','tickAiStateMachine','evaluateAiTransitionCondition','distanceToPlayerXZ'].map(extract).join('\n')+'\n'+
 'this.make=(id,x,y,z)=>({id,kind:"cube",entity:new Opus.Entity({mesh:Opus.Mesh.cube(),position:new Opus.Vec3(x,y,z)})});this.actor=make("actor",0,0,0);actor.tags=["enemy"];actor.entity.ai={type:"",attackEnabled:true,attackPrefab:"bolt",attackRadius:20,attackCooldown:1,attackDamage:7,attackSpeed:9};this.player=make("player",0,0,10);this.placed=[actor];this.prefabs=[{name:"bolt",record:{kind:"cube",mesh:"cube",position:[0,0,0],scale:[1,1,1],color:[1,1,1],rotationY:0,behaviors:[]}}];this.activeProjectiles=[];this.findItemById=id=>placed.find(item=>item.id===id);this.instantiateCubeRecord=(record,point)=>make("spawn",point.x,point.y,point.z);this.generateItemId=()=>"shot"+(++ids);this.addPlaced=item=>placed.push(item);this.wireItemTrigger=item=>item.fixtureWired=true;this.triggerCharacterAttackAnim=()=>animations++;',c);
 return {c,run:code=>vm.runInContext(code,c),attack(time=0,ai=c.actor.entity.ai,target=c.player.entity){c.simElapsed=time;return c.applyAiAttackStep(c.actor,ai,c.actor.entity.position,target,time);},tick(dt,time){c.simElapsed=time;return c.tickAiStateMachine(c.actor,c.actor.entity.ai,c.actor.entity.position,dt,time);}};
}
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`),json=v=>JSON.parse(JSON.stringify(v));let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
test('Actual AI attack dispatch creates canonical projectile with normalized XYZ velocity and independent origin',()=>{
 const f=fixture();f.run('player.entity.position.set(3,4,0);');f.attack();const p=f.c.activeProjectiles[0];assert(p);near(p.velocity.x,5.4);near(p.velocity.y,7.2);near(p.velocity.z,0);assert.equal(p.damage,7);assert.equal(p.ownerTag,'enemy');assert.equal(p.lifetime,3);assert.equal(p.radius,.3);assert.equal(p.item.runtimeSpawned,true);assert.equal(p.item.fixtureWired,true);assert.equal(f.c.animations,1);f.run('actor.entity.position.x=99;');near(p.item.entity.position.x,0);
});
test('Actual XYZ range, disabled attack and absent target suppress dispatch without advancing deadline',()=>{
 const f=fixture();f.run('player.entity.position.set(0,21,0);');f.attack();assert.equal(f.c.activeProjectiles.length,0);assert.equal(f.c.actor.entity.ai._attackCooldownUntil,undefined);f.run('player.entity.position.y=20;');f.attack();assert.equal(f.c.activeProjectiles.length,1);f.run('actor.entity.ai.attackEnabled=false;');f.attack(2);assert.equal(f.c.activeProjectiles.length,1);f.run('actor.entity.ai.attackEnabled=true;');f.attack(2,f.c.actor.entity.ai,null);assert.equal(f.c.activeProjectiles.length,1);
});
test('Actual elapsed cooldown dispatch count is stable over 30/60/144 tick partitions',()=>{
 for(const hz of [30,60,144]){const f=fixture();for(let n=0;n<3*hz;n++)f.attack(n/hz);assert.equal(f.c.activeProjectiles.length,3);near(f.c.actor.entity.ai._attackCooldownUntil,3);}
});
test('Historical defaults remain range8 cooldown1.5 speed12 damage10 while explicit Damage zero survives',()=>{
 for(const damage of [undefined,0]){const f=fixture();f.run('delete actor.entity.ai.attackRadius;delete actor.entity.ai.attackCooldown;delete actor.entity.ai.attackSpeed;delete actor.entity.ai.attackDamage;player.entity.position.z=8;');if(damage===0)f.run('actor.entity.ai.attackDamage=0;');f.attack();assert.equal(f.c.activeProjectiles.length,1);near(f.c.activeProjectiles[0].velocity.z,12);assert.equal(f.c.activeProjectiles[0].damage,damage===0?0:10);near(f.c.actor.entity.ai._attackCooldownUntil,1.5);}
});
test('Missing projectile Prefab is inert before deadline and animation; restored usable Prefab can immediately shoot',()=>{
 const f=fixture();f.run('this.savedPrefab=prefabs[0];prefabs=[];');f.attack();assert.equal(f.c.activeProjectiles.length,0);assert.equal(f.c.actor.entity.ai._attackCooldownUntil,undefined);assert.equal(f.c.animations,0);f.run('prefabs=[savedPrefab];');f.attack(.5);assert.equal(f.c.activeProjectiles.length,1);near(f.c.actor.entity.ai._attackCooldownUntil,1.5);
});
test('Ambiguous or malformed named projectile record must refuse atomically',()=>{
 for(const raw of [null,false,{}, {kind:'sprite',color:[1,1,1],scale:[1,1,1]}, {kind:'cube',color:[],scale:[1,1,1]}, {kind:'cube',color:[1,1,1],scale:[0,1,1]}]){const f=fixture();f.run('prefabs[0].record='+JSON.stringify(raw)+';');f.attack();assert.equal(f.c.activeProjectiles.length,0);assert.equal(f.c.actor.entity.ai._attackCooldownUntil,undefined);assert.equal(f.c.animations,0);}
 const f=fixture();f.run('prefabs.push(JSON.parse(JSON.stringify(prefabs[0])));');f.attack();assert.equal(f.c.activeProjectiles.length,0);assert.equal(f.c.actor.entity.ai._attackCooldownUntil,undefined);
});
test('AI attack with assembly-only Prefab must refuse unusable Cube record before cooldown or animation',()=>{
 const f=fixture();f.run('this.cubeMesh=Opus.Mesh.cube();prefabs=[{name:"bolt",rootId:"root",records:[{kind:"cube",id:"root",position:[0,0,0],scale:[1,1,1],color:[1,1,1]}]}];');
 // Actual instantiator is required here: the environment spawn hook in normal
 // valid-projectile tests would conceal this real record-shape incompatibility.
 f.run(extract('instantiateCubeRecord'));assert.doesNotThrow(()=>f.attack(),'Assembly Prefab has no single Cube record and must not crash gameplay');assert.equal(f.c.activeProjectiles.length,0);assert.equal(f.c.actor.entity.ai._attackCooldownUntil,undefined);assert.equal(f.c.animations,0);
});
test('Canonical direct Fire Projectile refuses assembly or malformed Cube records without gameplay exception',()=>{
 const malformed=[{name:'bolt',rootId:'root',records:[]},{name:'bolt',record:null},{name:'bolt',record:{kind:'cube',scale:[1,1,1]}}];
 for(const prefab of malformed){const f=fixture();f.run('this.cubeMesh=Opus.Mesh.cube();prefabs='+JSON.stringify([prefab])+';');f.run(extract('instantiateCubeRecord'));
  assert.doesNotThrow(()=>f.c.fireProjectile('bolt',f.c.actor.entity.position,new f.c.Opus.Vec3(0,0,1),9,7,'enemy',3,.3,0,''),'Canonical Action/weapon path must refuse same unusable projectile before instantiation');assert.equal(f.c.activeProjectiles.length,0);assert.equal(f.c.placed.length,1);
 }
});
test('Actual state attack slots have independent deadlines and retain cooldown across state reentry',()=>{
 const f=fixture();f.run('Object.assign(actor.entity.ai,{mode:"stateMachine",startState:"A",states:[{name:"A",movement:{type:""},attack:{attackEnabled:true,attackPrefab:"bolt",attackCooldown:1}},{name:"B",movement:{type:""},attack:{attackEnabled:true,attackPrefab:"bolt",attackCooldown:1}}]});player.entity.position.z=5;');f.tick(.1,0);assert.equal(f.c.activeProjectiles.length,1);f.c.simElapsed=.1;f.c.enterAiState(f.c.actor,f.c.actor.entity.ai,'B');f.tick(.1,.1);assert.equal(f.c.activeProjectiles.length,2);f.c.simElapsed=.2;f.c.enterAiState(f.c.actor,f.c.actor.entity.ai,'A');f.tick(.1,.2);assert.equal(f.c.activeProjectiles.length,2);f.tick(.1,1);assert.equal(f.c.activeProjectiles.length,3);
});
test('Actual movement target chooses explicit Cube for attack; missing explicit target does not fall back to Player',()=>{
 const f=fixture();f.run('this.target=make("target",5,0,0);placed.push(target);actor.entity.ai.targetId="target";');let target=f.c.applyAiMovementStep(f.c.actor,f.c.actor.entity.ai,f.c.actor.entity.position,.1,0);f.attack(0,f.c.actor.entity.ai,target);near(f.c.activeProjectiles[0].velocity.x,9);near(f.c.activeProjectiles[0].velocity.z,0);f.run('actor.entity.ai.targetId="missing";');target=f.c.applyAiMovementStep(f.c.actor,f.c.actor.entity.ai,f.c.actor.entity.position,.1,1);f.attack(1,f.c.actor.entity.ai,target);assert.equal(f.c.activeProjectiles.length,1);
});
test('Canonical capture roundtrip strips Simple and state cooldowns and independently restarts deadline',()=>{
 const f=fixture(),before=f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai);assert(before.ok);f.attack();const after=f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai);assert(after.ok);assert.deepStrictEqual(json(before.record),json(after.record));f.run('actor.entity.ai=OpusAiBrain.toLegacy(JSON.parse(JSON.stringify(OpusAiBrain.captureLegacy(actor.entity.ai).record))).config;');assert.equal(f.c.actor.entity.ai._attackCooldownUntil,undefined);f.attack(0);assert.equal(f.c.activeProjectiles.length,2);
 f.run('actor.entity.ai={type:"",mode:"stateMachine",startState:"A",states:[{name:"A",movement:{type:""},attack:{attackEnabled:true,attackPrefab:"bolt",_attackCooldownUntil:99}}]};');const saved=f.c.OpusAiBrain.captureLegacy(f.c.actor.entity.ai);assert(saved.ok);assert.equal(saved.record.config.states[0].attack._attackCooldownUntil,undefined);
});
console.log(`Phase127 actual combat runtime: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
