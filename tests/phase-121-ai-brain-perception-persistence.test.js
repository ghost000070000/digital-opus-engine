'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name+' actual source');const end=source.indexOf('\n}',start);assert(end>start);return source.slice(start,end+2);}
function fixture(){
  const nodes=new Map(),cubeMesh={},c={playMode:false,showAiPerception:false,cubeMesh,mineMesh:{},boostMesh:{},wedgeMesh:{},billboardMesh:{},simElapsed:4,
    OpusAuthoring:require('../editor/src/00-authoring-schema'),hasPitchOrRoll:()=>false,hasLineOfSightToPlayer:()=>true,
    historyCount:0,showStatus:()=>{},renderInspector:()=>{},syncAiPerceptionOverlay:()=>{},
    document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:'',checked:false,tagName:'INPUT',type:id==='f-ai-requires-los'?'checkbox':'number'});return nodes.get(id);}}};
  vm.createContext(c);
  vm.runInContext(['00-collision-filter-2d','00-ai-brain','00-damage-policy','00-combat-volumes','00-authoring-schema'].map(name=>fs.readFileSync(require.resolve('../editor/src/'+name),'utf8')).join('\n')+'\nthis.pushUndo=()=>{historyCount++;};',c);
  const guards=fs.readFileSync(require.resolve('../engine/src/22-api'),'utf8').split('function validateTerrainOptions')[0];
  vm.runInContext(guards+'\n'+fs.readFileSync(require.resolve('../engine/src/01-vec3'),'utf8')+'\nthis.Opus={Vec3,normalizeSpritePassRelation:value=>value||"behind-sprites"};this.app={addEntity:options=>({...options,forward:new Vec3(0,0,1)})};'+
    ['defaultAiPerception','aiBrainCanRun','changeAiBrain','wireAiBrainAuthoring','renderAiPerceptionFields','authoredHealthSerializationTarget','meshTag','cloneBehaviors','sanitizeAiStatesForSave','serializeCubeRecord','instantiateCubeRecord','aiCanSeePlayer','emitNoiseEvent'].map(extract).join('\n')+
    '\nthis.actor={id:"guard",kind:"cube",behaviors:[],entity:{mesh:cubeMesh,position:new Vec3(0,0,0),scale:new Vec3(1,1,1),color:[1,1,1],rotationY:0,forward:new Vec3(0,0,1),ai:{type:"follow",speed:3,radius:5,base:new Vec3(0,0,0),mode:"stateMachine",startState:"watch",states:[{name:"watch",movement:{type:""},transitions:[]}]}}};this.player={entity:{position:new Vec3(0,0,10)}};this.placed=[actor];',c);
  function reload(){const record=JSON.parse(JSON.stringify(c.serializeCubeRecord(c.actor)));return c.instantiateCubeRecord(record,vm.runInContext('new Vec3(0,0,0)',c));}
  return {c,nodes,reload};
}
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
test('Actual mounted Perception authoring survives the actual shared cube serializer independently',()=>{
  const {c,nodes}=fixture();c.renderAiPerceptionFields(c.actor);
  for(const [id,value]of [['f-ai-vision-distance','3'],['f-ai-fov','220'],['f-ai-hearing-radius','8']]){nodes.get(id).value=value;nodes.get(id).oninput();}
  nodes.get('f-ai-requires-los').checked=false;nodes.get('f-ai-requires-los').onchange();
  assert.equal(c.historyCount,4,'Actual changed authoring creates one history snapshot per change');
  nodes.get('f-ai-vision-distance').oninput();assert.equal(c.historyCount,4,'Unchanged value creates no redundant history');
  const expected=JSON.parse(JSON.stringify(c.actor.entity.ai.perception)),saved=c.serializeCubeRecord(c.actor);
  assert(saved.ai.perception,'Actual serializer lost creator-authored Perception');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(saved.ai.perception)),expected,'Serializer must retain the exact creator-authored senses');
  saved.ai.perception.visionDistance=99;assert.equal(c.actor.entity.ai.perception.visionDistance,3,'Save/Prefab record must not alias live AI');
});
test('Actual Save/reload cannot silently expand configured Vision Distance to historical default',()=>{
  const {c,reload}=fixture();vm.runInContext('actor.entity.ai.perception={visionDistance:3,fovDegrees:100,requiresLOS:true,hearingRadius:8};',c);
  const before=c.aiCanSeePlayer(c.actor,c.actor.entity.position);assert.equal(before,false,'Actual target at distance10 is beyond authored distance3');
  const restored=reload(),after=c.aiCanSeePlayer(restored,restored.entity.position);assert.equal(after,before,'Reload must not turn an out-of-range target visible');
});
test('Actual Save/reload retains Hearing Radius and runtime noise delivery without persisting noise state',()=>{
  const {c,reload}=fixture();vm.runInContext('actor.entity.ai.perception={visionDistance:3,fovDegrees:100,requiresLOS:true,hearingRadius:8};this.noise=new Vec3(0,0,5);',c);
  c.emitNoiseEvent(c.noise,10);assert.equal(c.actor._lastHeardNoiseAt,4);const saved=c.serializeCubeRecord(c.actor);
  assert.equal(saved._lastHeardNoiseAt,undefined);const restored=reload();c.placed=[restored];c.simElapsed=7;c.emitNoiseEvent(c.noise,10);
  assert.equal(restored._lastHeardNoiseAt,7,'Actual listener must continue hearing at distance5 after reload');assert.equal(restored._lastHeardNoisePos.z,5);
});
test('Historical omitted Perception stays absent and preserves existing runtime Vision defaults',()=>{
  const {c,reload}=fixture();assert.equal(Object.prototype.hasOwnProperty.call(c.actor.entity.ai,'perception'),false);
  assert.equal(c.aiCanSeePlayer(c.actor,c.actor.entity.position),true);const saved=c.serializeCubeRecord(c.actor);
  assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(JSON.stringify(saved.ai)),'perception'),false);
  const restored=reload();assert.equal(c.aiCanSeePlayer(restored,restored.entity.position),true);assert.equal(restored.entity.ai.perception,undefined);
});
test('Unknown future Perception data is retained exactly rather than normalized or silently discarded',()=>{
  const {c,reload}=fixture();vm.runInContext('actor.entity.ai.perception={version:99,visionDistance:3,fovDegrees:100,requiresLOS:false,hearingRadius:8,future:{policy:"retain",nested:[1,2,3]}};',c);
  const before=JSON.parse(JSON.stringify(c.actor.entity.ai.perception)),saved=c.serializeCubeRecord(c.actor);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(saved.ai.perception)),before);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(reload().entity.ai.perception)),before);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.actor.entity.ai.perception)),before);
});
console.log(`Phase121 actual AI Perception persistence: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
