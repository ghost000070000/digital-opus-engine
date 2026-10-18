'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0);return source.slice(at,source.indexOf('\n}',at)+2);}
const actionAt=source.indexOf('const ACTION_TYPES = {');assert(actionAt>=0);
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-ai-brain'),'utf8')+'\n'+source.slice(actionAt,source.indexOf('\n};',actionAt)+3)+'\n'+['behaviorParams','visitAuthoredActions','collectEditorReferenceUses'].map(extract).join('\n'),context);
const project=ai=>({levels:[{id:'level-a',objects:[{id:'guard-a',kind:'cube',ai,behaviors:[]}]}]});
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
function assertUse(uses,owner,key,type,required){const found=uses.find(u=>u.owner===owner&&u.key===key);assert(found,'Actual collector must find '+key);assert.equal(found.referenceType,type);assert.equal(found.descriptor.required,required);assert.equal(found.levelId,'level-a');assert.equal(found.objectId,'guard-a');return found;}
test('Actual collector retains existing top-level AI target/path/attack Prefab descriptors',()=>{
  const ai={targetId:'target-a',pathId:'path-a',attackPrefab:'projectile'};const uses=context.collectEditorReferenceUses(project(ai));
  assertUse(uses,ai,'targetId','object',undefined);assertUse(uses,ai,'pathId','object',true);assertUse(uses,ai,'attackPrefab','prefab',true);assert.equal(uses.length,3);
});
test('Actual collector audits each state movement Target and Path in the same current-level scope',()=>{
  const movement={type:'navigateToTarget',targetId:'state-target',pathId:'state-path'},ai={states:[{name:'chase',movement}]};
  const uses=context.collectEditorReferenceUses(project(ai));assertUse(uses,movement,'targetId','object',undefined);assertUse(uses,movement,'pathId','object',true);
  assert.equal(uses.find(u=>u.owner===movement&&u.key==='targetId').descriptor.scope,'current-level');
});
test('Actual collector audits state ranged attack Prefab without changing its project scope',()=>{
  const attack={attackPrefab:'state-projectile'},ai={states:[{name:'attack',attack}]};assertUse(context.collectEditorReferenceUses(project(ai)),attack,'attackPrefab','prefab',true);
});
test('Actual collector uses actual canonical Action descriptors for state entry Action params',()=>{
  const params={targetId:'entry-target'},entry={action:'setPosition',params},ai={states:[{name:'watch',entryActions:[entry]}]};
  const uses=context.collectEditorReferenceUses(project(ai));assertUse(uses,params,'targetId','object',undefined);assert.equal(uses[0].descriptor.scope,'current-level');
});
test('Actual AI scan tolerates malformed states and entry Action arrays without inventing references',()=>{
  for(const states of [null,false,0,'bad',{},[null,false,0,[],{}, {movement:null,attack:false,entryActions:{}},{entryActions:[null,false,0,[],{}]}]]){
    const uses=context.collectEditorReferenceUses(project({states}));assert.equal(uses.length,0);
  }
});
test('Actual collector does not scan Custom Script free text, state names, conditions or waypoint labels',()=>{
  const ai={waypointNames:'target-a',states:[{name:'target-a',movement:{type:'patrolRoute',waypointNames:'target-a'},transitions:[{to:'target-a',condition:{type:'canSeePlayer'}}],entryActions:[{action:'customScript',params:{code:'target-a'}}]}]};
  assert.equal(context.collectEditorReferenceUses(project(ai)).length,0);
});
test('Actual collector audits valid attached-only disabled Brain refs on inactive levels without requiring legacy AI mirror',()=>{
  const movement={type:'navigateToTarget',targetId:'inactive-target',pathId:'inactive-path'},attack={attackPrefab:'inactive-projectile'},params={targetId:'entry-target'};
  const config={type:'follow',mode:'stateMachine',startState:'watch',states:[{name:'watch',movement,attack,entryActions:[{action:'setPosition',params}]}]};
  const owner={id:'inactive-guard',kind:'cube',components:{'ai-brain':{version:1,enabled:false,config}},behaviors:[]};
  const input=vm.runInContext('('+JSON.stringify({levels:[{id:'active-level',objects:[]},{id:'inactive-level',objects:[owner]}]})+')',context);
  const actualOwner=input.levels[1].objects[0],state=actualOwner.components['ai-brain'].config.states[0];
  assert(context.OpusAiBrain.inspect(actualOwner.components['ai-brain']).ok,'Actual same-realm component record is valid');
  const before=JSON.stringify(input),uses=context.collectEditorReferenceUses(input);
  for(const [refOwner,key,type]of [[state.movement,'targetId','object'],[state.movement,'pathId','object'],[state.attack,'attackPrefab','prefab'],[state.entryActions[0].params,'targetId','object']]){
    const found=uses.find(use=>use.owner===refOwner&&use.key===key);assert(found,'Attached-only Brain must expose '+key);assert.equal(found.referenceType,type);assert.equal(found.levelId,'inactive-level');assert.equal(found.objectId,'inactive-guard');
  }
  assert.equal(actualOwner.ai,undefined);assert.equal(JSON.stringify(input),before,'Reference review must not invent legacy AI data or mutate inactive authoring');
});
console.log(`Phase121 actual AI Brain references: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
