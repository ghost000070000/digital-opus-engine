'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
const json=value=>JSON.parse(JSON.stringify(value));
function fixture(){const c={cubeMesh:{},mineMesh:{},boostMesh:{},wedgeMesh:{},billboardMesh:{},nextId:0,generateGroupId:()=> 'new-group'};vm.createContext(c);
  vm.runInContext(fs.readFileSync(require.resolve('../engine/src/22-api'),'utf8').split('function validateTerrainOptions')[0]+'\n'+fs.readFileSync(require.resolve('../engine/src/01-vec3'),'utf8')+'\n'+
    ['00-collision-filter-2d','00-ai-brain','00-damage-policy','00-combat-volumes','00-authoring-schema'].map(name=>fs.readFileSync(require.resolve('../editor/src/'+name),'utf8')).join('\n')+'\n'+
    'this.Opus={Vec3,normalizeSpritePassRelation:v=>v||"behind-sprites"};this.app={addEntity:options=>({...options})};this.generateItemId=()=>"placed-"+(++nextId);\n'+
    ['cloneBehaviors','sanitizeAiStatesForSave','remapObjectIds','instantiateCubeRecord','instantiatePrefabAssembly'].map(extract).join('\n')+'\n'+
    'this.record={id:"source",kind:"cube",mesh:"cube",position:[2,.5,0],scale:[1,1,1],color:[1,1,1],rotationY:0,behaviors:[],ai:{type:"orbit",speed:3,radius:5,base:[2,.5,0],perception:{visionDistance:26,fovDegrees:63,requiresLOS:false,hearingRadius:7}}};record.components={"ai-brain":OpusAiBrain.captureLegacy(record.ai).record};',c);
  return {c,run:code=>vm.runInContext(code,c)};
}
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
function baseMatches(item,expected){assert.deepStrictEqual(json(item.entity.ai.base),{x:expected[0],y:expected[1],z:expected[2]});assert.deepStrictEqual(json(item.components['ai-brain'].config.base),expected);}
test('Actual single-object Prefab placement translates authored Brain base with its object',()=>{
  const f=fixture(),before=json(f.c.record),item=f.run('instantiateCubeRecord(record,new Vec3(9,.5,4))');baseMatches(item,[9,.5,4]);assert.deepStrictEqual(json(f.c.record),before);
});
test('Actual single-object placement preserves custom orbit-center offset instead of blindly resetting center',()=>{
  const f=fixture();f.run('record.ai.base=[3,1.5,-2];record.components["ai-brain"].config.base=[3,1.5,-2];record.components["ai-brain"].enabled=false;');
  const before=json(f.c.record),item=f.run('instantiateCubeRecord(record,new Vec3(9,2.5,4))');baseMatches(item,[10,3.5,2]);assert.equal(item.components['ai-brain'].enabled,false);assert.deepStrictEqual(json(f.c.record),before);
});
test('Actual assembly translates each AI base by the same root delta while remapping Target identities',()=>{
  const f=fixture();f.run('this.other=JSON.parse(JSON.stringify(record));other.id="other";other.position=[5,.5,2];other.ai.base=[6,.5,3];other.components["ai-brain"].config.base=[6,.5,3];record.ai.targetId="other";record.components["ai-brain"].config.targetId="other";this.prefab={rootId:"source",records:[record,other]};');
  const before=json(f.c.prefab),items=f.run('instantiatePrefabAssembly(prefab,new Vec3(12,3.5,4))');baseMatches(items[0],[12,3.5,4]);baseMatches(items[1],[16,3.5,7]);assert.deepStrictEqual(json(items[1].entity.position),{x:15,y:3.5,z:6});
  assert.equal(items[0].entity.ai.targetId,items[1].id);assert.equal(items[0].components['ai-brain'].config.targetId,items[1].id);assert.deepStrictEqual(json(f.c.prefab),before);
});
test('Actual Save/load at saved position keeps custom base unchanged and owns independent config',()=>{
  const f=fixture();f.run('record.ai.base=[3,1.5,-2];record.components["ai-brain"].config.base=[3,1.5,-2];');const item=f.run('instantiateCubeRecord(record,new Vec3(...record.position))');baseMatches(item,[3,1.5,-2]);item.entity.ai.perception.hearingRadius=1;assert.equal(f.c.record.ai.perception.hearingRadius,7);
});
test('Actual Prefab placement preserves unsupported Brain records exactly without guessing base migration',()=>{
  for(const raw of [null,false,{version:99,enabled:true,config:{type:'future',base:[99,88,77]},future:{keep:true}}]){const f=fixture();f.run('record.components={"ai-brain":'+JSON.stringify(raw)+'};');const item=f.run('instantiateCubeRecord(record,new Vec3(9,.5,4))');assert.deepStrictEqual(json(item.components['ai-brain']),raw);assert.deepStrictEqual(json(f.c.record.components['ai-brain']),raw);}
});
console.log(`Phase121 actual AI Brain Prefab placement: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
