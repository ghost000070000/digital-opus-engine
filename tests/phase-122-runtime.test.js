'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
function fixture(states,startState){const c={simElapsed:0,window:{},prefabs:[{name:'projectile',record:{kind:'cube',color:[1,1,1],scale:[1,1,1]}}],shots:[],triggerCharacterAttackAnim:()=>{},hasLineOfSightToPlayer:()=>true,ensureObjectHealthInit:()=>{}};vm.createContext(c);
  const actionAt=source.indexOf('const ACTION_TYPES = {');
  vm.runInContext(fs.readFileSync(require.resolve('../engine/src/22-api'),'utf8').split('function validateTerrainOptions')[0]+'\n'+fs.readFileSync(require.resolve('../engine/src/01-vec3'),'utf8')+'\n'+fs.readFileSync(require.resolve('../editor/src/00-ai-brain'),'utf8')+'\n'+source.slice(actionAt,source.indexOf('\n};',actionAt)+3)+'\n'+
    ['aiProjectilePrefabIssue','executeAction','aiStateDef','enterAiState','tickAiStateMachine','evaluateAiTransitionCondition','distanceToPlayerXZ','defaultAiPerception','aiCanSeePlayer','aiBrainCanRun','applyAiMovementStep','resolveAiSolidMovement','applyAiAttackStep'].map(extract).join('\n')+'\n'+
    'this.Opus={Vec3};this.player={entity:{position:new Vec3(0,100,10)}};this.item={kind:"cube",entity:{position:new Vec3(0,0,0),forward:new Vec3(0,0,1),scale:new Vec3(1,1,1),ai:{type:"follow",mode:"stateMachine",states:'+JSON.stringify(states)+',startState:'+JSON.stringify(startState===undefined?null:startState)+'}},health:{current:5}};this.fireProjectile=(...args)=>shots.push(args);',c);
  function tick(dt=1/60,time=c.simElapsed){c.simElapsed=time;return c.tickAiStateMachine(c.item,c.item.entity.ai,c.item.entity.position,dt,time);}
  return {c,tick,run:code=>vm.runInContext(code,c)};
}
let passed=0,failed=0;const json=value=>JSON.parse(JSON.stringify(value));function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
test('Actual first-match priority selects only first passing destination and moves in that new state immediately',()=>{
  const f=fixture([{name:'idle',transitions:[{condition:{type:'distanceToPlayerAtMost',value:20},to:'chase'},{condition:{type:'distanceToPlayerAtMost',value:20},to:'other'}]},{name:'chase',movement:{type:'follow',speed:6},entryActions:[{action:'setCounter',params:{counter:'winner',value:1}}]},{name:'other',entryActions:[{action:'setCounter',params:{counter:'winner',value:2}}]}],'idle');
  f.tick(.1);assert.equal(f.c.item.entity.ai._currentState,'chase');assert.equal(f.c.window.__gameState.winner,1);assert(Math.abs(f.c.item.entity.position.z-.6)<1e-12);assert.equal(f.c.item.entity.position.y,0,'Legacy AI movement is XZ, not XY');
});
test('Actual entry Actions fire once on initial entry and each transition, not each held state tick',()=>{
  const entry={action:'incrementCounter',params:{counter:'entries',amount:1}};
  const f=fixture([{name:'wait',entryActions:[entry],transitions:[{condition:{type:'timeInStateAtLeast',value:1},to:'run'}]},{name:'run',entryActions:[entry]}],'wait');
  f.tick(1/60,0);f.tick(1/60,.5);assert.equal(f.c.window.__gameState.entries,1);f.tick(1/60,1);assert.equal(f.c.window.__gameState.entries,2);f.tick(1/60,2);assert.equal(f.c.window.__gameState.entries,2);assert.equal(f.c.item._aiStateEnteredAt,1);
});
test('Actual matching same-state transition consumes priority without re-entering or evaluating later match',()=>{
  const f=fixture([{name:'wait',entryActions:[{action:'incrementCounter',params:{counter:'entries',amount:1}}],transitions:[{condition:{type:'timeInStateAtLeast',value:0},to:'wait'},{condition:{type:'timeInStateAtLeast',value:0},to:'other'}]},{name:'other'}],'wait');
  f.tick();f.tick();assert.equal(f.c.item.entity.ai._currentState,'wait');assert.equal(f.c.window.__gameState.entries,1);
});
test('Historical no start-state selects first row; empty state list remains no-op',()=>{
  const f=fixture([{name:'historical',movement:{type:''}},{name:'second'}]);f.tick();assert.equal(f.c.item.entity.ai._currentState,'historical');
  const empty=fixture([]);assert.equal(empty.tick(),null);assert.equal(empty.c.item.entity.ai._currentState,undefined);
});
test('Actual conditions preserve XZ distance, time, Health and unknown-condition semantics',()=>{
  const f=fixture([{name:'idle'}],'idle'),pos=f.c.item.entity.position;
  assert(f.c.evaluateAiTransitionCondition({type:'distanceToPlayerAtMost',value:10},f.c.item,pos));assert(f.c.evaluateAiTransitionCondition({type:'healthAtMost',value:5},f.c.item,pos));
  assert.equal(f.c.evaluateAiTransitionCondition({type:'unknown-future',value:10},f.c.item,pos),false);assert.equal(f.c.evaluateAiTransitionCondition(null,f.c.item,pos),false);
  f.c.item._lastHeardNoiseAt=0;f.c.simElapsed=4;assert.equal(f.c.evaluateAiTransitionCondition({type:'heardNoiseRecently',value:3},f.c.item,pos),false);
});
test('Actual per-state attack reuses canonical projectile dispatch and cooldown, without another state solver',()=>{
  const f=fixture([{name:'attack',movement:{type:''},attack:{attackEnabled:true,attackPrefab:'projectile',attackRadius:200,attackCooldown:1,attackDamage:7,attackSpeed:9}}],'attack');
  f.tick(1/60,0);f.tick(1/60,.5);f.tick(1/60,1);assert.equal(f.c.shots.length,2);assert.equal(f.c.shots[0][0],'projectile');assert.equal(f.c.shots[0][3],9);assert.equal(f.c.shots[0][4],7);
});
test('Actual per-state attack preserves explicitly authored zero Damage while omitted historical Damage stays ten',()=>{
  for(const [authoredDamage,expected]of [[0,0],[undefined,10]]){
    const attack={attackEnabled:true,attackPrefab:'projectile',attackRadius:200,attackCooldown:1};if(authoredDamage!==undefined)attack.attackDamage=authoredDamage;
    const f=fixture([{name:'attack',movement:{type:''},attack}],'attack');assert(f.c.OpusAiBrain.captureLegacy(f.c.item.entity.ai).ok,'Zero Damage is valid canonical authored data');
    f.tick();assert.equal(f.c.shots.length,1);assert.equal(f.c.shots[0][4],expected,'Actual projectile dispatch must not substitute ten for authored zero');
  }
});
test('Authored capture remains independent of runtime current state and state attack cooldown caches',()=>{
  const f=fixture([{name:'idle',movement:{type:''},attack:{attackEnabled:true,attackPrefab:'projectile',attackRadius:200,attackCooldown:1}}],'idle');
  const before=f.c.OpusAiBrain.captureLegacy(f.c.item.entity.ai);assert(before.ok);f.tick();const after=f.c.OpusAiBrain.captureLegacy(f.c.item.entity.ai);assert(after.ok);assert.deepStrictEqual(json(after.record),json(before.record));
  after.record.config.states[0].name='changed';assert.equal(f.c.item.entity.ai.states[0].name,'idle');assert.equal(before.record.config.states[0].name,'idle');
});
test('Malformed or future attached Brain stays inert at real runtime eligibility guard; absent legacy remains compatible',()=>{
  const f=fixture([{name:'idle'}],'idle');assert(f.c.aiBrainCanRun(f.c.item));
  for(const raw of [null,false,[],{}, {version:99,enabled:true,config:{type:'follow'}},{version:1,enabled:true,config:{type:'follow',states:[null]}}]){f.run('item.components={"ai-brain":'+JSON.stringify(raw)+'};');assert.equal(f.c.aiBrainCanRun(f.c.item),false);}
});
console.log(`Phase122 actual State Machine runtime: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
