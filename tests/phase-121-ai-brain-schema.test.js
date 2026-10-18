'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const api=require('../editor/src/00-authoring-schema'),brain=require('../editor/src/00-ai-brain');
const vectorHost={};vm.createContext(vectorHost);
vm.runInContext(fs.readFileSync(require.resolve('../engine/src/22-api'),'utf8').split('function validateTerrainOptions')[0]+'\n'+fs.readFileSync(require.resolve('../engine/src/01-vec3'),'utf8')+'\nthis.Vec3=Vec3;',vectorHost);
const Vec3=vectorHost.Vec3,copy=value=>JSON.parse(JSON.stringify(value));
function target(ai){return {kind:'cube',entity:{position:new Vec3(4,5,6),...(ai===undefined?{}:{ai})}};}
function config(){return {type:'follow',speed:3,radius:5,base:new Vec3(1,2,3),perception:{visionDistance:26,fovDegrees:63,requiresLOS:false,hearingRadius:7}};}
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
test('AI Brain is discoverable only on Cube scene objects and Add initializes current XYZ base',()=>{
  const item=target();assert(api.getComponentAddability(item,'ai-brain').addable);assert(!api.getComponentAddability({kind:'sprite'},'ai-brain').addable);
  assert(api.addComponent(item,'ai-brain').ok);assert.deepStrictEqual(item.components['ai-brain'].config.base,[4,5,6]);assert(item.entity.ai.base instanceof Vec3);
  assert.equal(api.validateComponent(item,'ai-brain').length,0);
});
test('Valid legacy AI captures exact perception and excludes actual live caches',()=>{
  const item=target(config());item.entity.ai.wanderTarget=new Vec3(9,0,9);item.entity.ai.navPath=[new Vec3()];
  const record=api.ensureComponent(item,'ai-brain');assert(brain.inspect(record).ok);assert.deepStrictEqual(record.config.perception,config().perception);
  assert.equal(record.config.wanderTarget,undefined);assert.equal(record.config.navPath,undefined);assert.deepStrictEqual(record.config.base,[1,2,3]);
});
test('Repeated Inspector ensure does not replace unchanged live AI or reset navigation caches',()=>{
  const item=target(config());api.ensureComponent(item,'ai-brain');const live=item.entity.ai;live.navPath=[new Vec3()];live._currentState='watch';
  api.ensureComponent(item,'ai-brain');assert.strictEqual(item.entity.ai,live);assert.equal(live.navPath.length,1);assert.equal(live._currentState,'watch');
});
test('Disabled settings retain configuration while changed settings hydrate actual Vec3 without alias',()=>{
  const item=target(config());const record=copy(api.ensureComponent(item,'ai-brain'));record.enabled=false;record.config.speed=8;
  assert(api.applyComponentSettings(item,'ai-brain',record).ok);assert.equal(item.components['ai-brain'].enabled,false);assert.equal(item.entity.ai.speed,8);assert(item.entity.ai.base instanceof Vec3);
  record.config.speed=99;assert.equal(item.entity.ai.speed,8);item.entity.ai.perception.visionDistance=9;assert.equal(item.components['ai-brain'].config.perception.visionDistance,26);
  assert.equal(api.ensureComponent(item,'ai-brain').enabled,false);
});
test('Shared serialize/copy paths retain enabled/perception/base and exclude runtime state',()=>{
  const item=target(config());api.ensureComponent(item,'ai-brain').enabled=false;item.entity.ai.wanderTimer=23;
  const saved=api.serializeComponents(item);assert.equal(saved['ai-brain'].enabled,false);assert.equal(saved['ai-brain'].config.wanderTimer,undefined);
  const restored=target();api.applyRecord({components:saved},restored);assert.equal(restored.components['ai-brain'].enabled,false);assert.deepStrictEqual(copy(restored.entity.ai.base),{x:1,y:2,z:3});
  assert.deepStrictEqual(restored.entity.ai.perception,config().perception);restored.entity.ai.perception.hearingRadius=2;assert.equal(saved['ai-brain'].config.perception.hearingRadius,7);
  const duplicated=target();api.copyComponents(item,duplicated);assert.equal(duplicated.components['ai-brain'].enabled,false);
});
test('Present malformed/future AI Brain stays exact, inert and validated across ensure/load/save',()=>{
  const malformed=[null,false,0,'bad',[],{}, {enabled:true,config:{type:'follow'}},{version:99,enabled:true,config:{type:'follow'},future:{x:1}}];
  for(const raw of malformed){const item=target(config()),live=item.entity.ai;item.components={'ai-brain':copy(raw)};
    api.ensureComponent(item,'ai-brain');assert.deepStrictEqual(item.components['ai-brain'],raw);assert.strictEqual(item.entity.ai,live);assert(api.validateComponent(item,'ai-brain').length);
    let history=0;assert(!api.applyComponentSettings(item,'ai-brain',brain.create([4,5,6]),{onBeforeChange(){history++;}}).ok);assert.equal(history,0);assert.deepStrictEqual(item.components['ai-brain'],raw);
    assert.deepStrictEqual(api.serializeComponents(item)['ai-brain'],raw);
    const restored=target(config()),original=restored.entity.ai;api.applyRecord({components:{'ai-brain':raw},ai:config()},restored);
    assert.deepStrictEqual(restored.components['ai-brain'],raw);assert.strictEqual(restored.entity.ai,original);
  }
});
test('Invalid historical AI is not silently adopted or destroyed by Inspector or serialization',()=>{
  const item=target({type:'future-custom',speed:3}),live=item.entity.ai;assert.equal(api.ensureComponent(item,'ai-brain'),null);assert.strictEqual(item.entity.ai,live);
  assert.equal(api.serializeComponents(item),undefined);assert(!api.getComponentAddability(item,'ai-brain').addable);
});
test('Remove clears existing AI, and authored records are independent snapshot data',()=>{
  const item=target(config());api.ensureComponent(item,'ai-brain');const before=copy(api.serializeComponents(item));assert(api.removeComponent(item,'ai-brain').ok);assert.equal(item.entity.ai,null);
  api.applyRecord({components:before},item);assert.equal(item.entity.ai.speed,3);assert.deepStrictEqual(item.entity.ai.perception,config().perception);assert.deepStrictEqual(api.serializeComponents(item),before);
});
console.log(`Phase121 AI Brain schema: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
