'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0);const end=source.indexOf('\n}',at);assert(end>at);return source.slice(at,end+2);}
function fixture(raw,enabled=true){
  const c={history:0,hierarchyTickToken:0,showStatus:()=>{},updateHierarchyTransforms:()=>{},syncSelectionMarkers:()=>{},renderInspector:()=>{},renderSceneList:()=>{},generateGroupId:()=> 'duplicate-group'};vm.createContext(c);
  const modules=['00-collision-filter-2d','00-ai-brain','00-damage-policy','00-combat-volumes','00-authoring-schema'].map(name=>fs.readFileSync(require.resolve('../editor/src/'+name),'utf8')).join('\n');
  vm.runInContext(fs.readFileSync(require.resolve('../engine/src/22-api'),'utf8').split('function validateTerrainOptions')[0]+'\n'+fs.readFileSync(require.resolve('../engine/src/01-vec3'),'utf8')+'\n'+modules+'\n'+
    'this.Opus={Vec3,normalizeSpritePassRelation:v=>v||"behind-sprites"};this.app={addEntity:options=>({...options})};this.pushUndo=()=>{history++;};this.generateItemId=()=>"duplicate-id";this.placed=[];this.addPlaced=item=>{item.id=generateItemId();placed.push(item);};this.findItemById=id=>placed.find(item=>item.id===id);\n'+
    [extract('cloneBehaviors'),extract('duplicateSelected')].join('\n')+'\n'+
    'this.original={kind:"cube",id:"original",behaviors:[],entity:{mesh:{},position:new Vec3(4,2,6),scale:new Vec3(1,1,1),rotationY:0,color:[1,1,1],ai:{type:"orbit",speed:3,radius:5,base:new Vec3(4,2,6),perception:{visionDistance:26,fovDegrees:63,requiresLOS:false,hearingRadius:7}}}};this.selectedItems=new Set([original]);this.selectedItem=original;',c);
  if(raw!==undefined)vm.runInContext('original.components={"ai-brain":'+JSON.stringify(raw)+'};',c);
  else vm.runInContext('OpusAuthoring.ensureComponent(original,"ai-brain").enabled='+JSON.stringify(enabled)+';',c);
  return c;
}
const json=value=>JSON.parse(JSON.stringify(value));let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
test('Actual Cube duplicate preserves historical AI base rebasing after shared component copying',()=>{
  const c=fixture(),before=json(c.original);c.duplicateSelected();assert.equal(c.history,1);assert.equal(c.placed.length,1);const duplicate=c.placed[0];
  assert.deepStrictEqual(json(duplicate.entity.ai.base),json(duplicate.entity.position),'Actual duplicate must orbit/patrol its new location, not source location');
  assert.deepStrictEqual(json(duplicate.components['ai-brain'].config.base),[5.5,2,7.5],'Authored component must agree with rebased runtime owner');
  assert.deepStrictEqual(json(c.original),before,'Duplicate must not change original data');
  duplicate.entity.ai.perception.visionDistance=1;assert.equal(c.original.entity.ai.perception.visionDistance,26);
});
test('Actual disabled Brain duplicate retains disabled state while rebasing without authored aliasing',()=>{
  const c=fixture(undefined,false);c.duplicateSelected();const duplicate=c.placed[0];assert.equal(duplicate.components['ai-brain'].enabled,false);
  assert.deepStrictEqual(json(duplicate.entity.ai.base),json(duplicate.entity.position));assert.deepStrictEqual(json(duplicate.components['ai-brain'].config.base),[5.5,2,7.5]);
  duplicate.components['ai-brain'].config.perception.hearingRadius=1;assert.equal(c.original.components['ai-brain'].config.perception.hearingRadius,7);
});
test('Actual malformed/future Brain duplication retains raw records without adopting or repairing them',()=>{
  for(const raw of [null,false,0,[],{}, {version:99,enabled:false,config:{type:'orbit',base:[4,2,6]},future:{keep:true}}]){
    const c=fixture(raw),before=json(c.original);c.duplicateSelected();const duplicate=c.placed[0];assert.deepStrictEqual(json(duplicate.components['ai-brain']),raw);assert.deepStrictEqual(json(c.original),before);
    if(raw&&typeof raw==='object')assert.notStrictEqual(duplicate.components['ai-brain'],c.original.components['ai-brain']);
  }
});
console.log(`Phase121 actual AI Brain duplicate: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
