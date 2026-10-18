'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const templates=require('../editor/src/00-graph-templates.js');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const start=source.indexOf('function graphItemPatternContext('),end=source.indexOf('\nfunction renderGraphTemplates(',start);
assert(start>=0&&end>start,'Actual template preflight helper must exist');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
function fixture(){
 const actor={id:'actor',name:'Console'},door={id:'door',name:'North gate',valid:true};
 const state={item:actor,itemPatternChoices:{'named-key-door':{itemId:'stable-key',quantity:'2',targetId:'door'},'quest-item-turn-in':{itemId:'stable-key',quantity:1,objectiveId:'quest'}}};
 const context={playMode:false,graphEditorState:state,placed:[actor,door],currentItemDefs:[{id:'stable-key',name:'Copper Key'}],currentObjectiveDefs:[{id:'quest',title:'Return the relic'}],validDoorGate:item=>!!item?.valid};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return {context,state,actor,door,recipe:id=>templates.recipes.find(r=>r.id===id),read(id='named-key-door'){return context.graphItemPatternContext(state,this.recipe(id));}};
}
test('Actual context writes stable named keys and current targets without mutating draft or library',()=>{const f=fixture(),before=JSON.stringify(f.state),items=JSON.stringify(f.context.currentItemDefs);assert.deepEqual(JSON.parse(JSON.stringify(f.read())),{itemId:'stable-key',quantity:2,targetId:'door'});assert.equal(JSON.stringify(f.state),before);assert.equal(JSON.stringify(f.context.currentItemDefs),items);});
test('Actual context refuses Play, stale editor and removed owner',()=>{for(const mutate of [f=>f.context.playMode=true,f=>f.context.graphEditorState={},f=>f.context.placed=[f.door]]){const f=fixture();mutate(f);assert.equal(f.read(),null);}});
test('Actual context refuses duplicate/missing/reserved Items and invalid targets',()=>{for(const mutate of [f=>f.context.currentItemDefs.push({id:'stable-key'}),f=>f.context.currentItemDefs=[],f=>f.state.itemPatternChoices['named-key-door'].itemId='__proto__',f=>f.door.valid=false,f=>f.context.placed.push({...f.door})]){const f=fixture();mutate(f);assert.equal(f.read(),null);}});
test('Actual quantity preflight rejects invalid raw values rather than coercing booleans',()=>{for(const value of ['', ' ',0,-1,1.5,NaN,Infinity,true,false,null,[],{},'nope']){const f=fixture();f.state.itemPatternChoices['named-key-door'].quantity=value;assert.equal(f.read(),null,'Invalid raw quantity '+String(value));}});
test('Actual quest context requires unique current Objective and self Door remains explicit',()=>{const f=fixture();assert.equal(f.read('quest-item-turn-in').objectiveId,'quest');f.context.currentObjectiveDefs.push({id:'quest'});assert.equal(f.read('quest-item-turn-in'),null);f.actor.valid=true;f.state.itemPatternChoices['named-key-door'].targetId='__self__';assert.equal(f.read().targetId,'');});
test('Canonical recipe uses independent local eligibility and gates both effect and last consumption',()=>{const context={itemId:'stable-key',quantity:2,targetId:'door'},first=templates.instantiate('consumed-key-door',undefined,context),second=templates.instantiate('consumed-key-door',undefined,context);assert.equal(first.variables[0].scope,'local');assert.equal(first.variables[0].initial,false);const effect=first.nodes.find(n=>n.type==='openDoor'),consume=first.nodes.find(n=>n.type==='removeNamedItem');assert(first.edges.some(e=>e.kind==='next'&&e.from===effect.id&&e.to===consume.id));for(const node of [effect,consume])assert(first.edges.some(e=>e.kind==='gate'&&e.to===node.id));first.variables[0].initial=true;first.nodes[0].itemId='changed';assert.equal(second.variables[0].initial,false);assert.equal(second.nodes[0].itemId,'stable-key');});
test('Actual typed Item scanner covers condition Graph, reusable Function and saved Prefab owners',()=>{
 const c={ACTION_TYPES:{}};vm.createContext(c);
 const conditionStart=source.indexOf('const CONDITION_TYPES = {'),conditionEnd=source.indexOf('\n};',conditionStart)+3;
 assert(conditionStart>=0&&conditionEnd>conditionStart);vm.runInContext(source.slice(conditionStart,conditionEnd)+'\nthis.CONDITION_TYPES=CONDITION_TYPES;',c);
 for(const [name,next]of [['behaviorParams','visitAuthoredActions'],['visitAuthoredActions','collectControllerStateEventIssues'],['collectEditorReferenceUses','collectSpriteAnimationStateActionIssues']]){
  const from=source.indexOf('function '+name+'('),to=name==='visitAuthoredActions'?source.indexOf('\nfunction ',from+10):source.indexOf('\nfunction '+next+'(',from);
  assert(from>=0&&to>from,'Actual function '+name);vm.runInContext(source.slice(from,to),c);
 }
 const node=()=>({id:'has',type:'hasNamedItem',itemId:'missing-key',count:1});
 const direct=node(),reusable=node(),prefab=node(),graph=n=>({nodes:[n],edges:[]});
 const project={levels:[{id:'level',objects:[{id:'actor',behaviors:[{action:'graph',graph:graph(direct)}]}]}],graphFunctions:[{id:'function',graph:graph(reusable)}],prefabs:[{name:'Console',record:{id:'saved',behaviors:[{action:'graph',graph:graph(prefab)}]}}]};
 const before=JSON.stringify(project),uses=c.collectEditorReferenceUses(project).filter(use=>use.referenceType==='item');
 assert.equal(uses.length,3);for(const owner of [direct,reusable,prefab]){const use=uses.find(value=>value.owner===owner);assert(use,'Actual saved node identity indexed');assert.equal(use.key,'itemId');assert.equal(use.referenceValue,'missing-key');assert.equal(use.descriptor.required,true);}assert.equal(JSON.stringify(project),before);
});
function saveFixture(functionOwner=false){
 const graph={graphVersion:1,nodes:[{id:'effect',type:'message',text:'hello'}],edges:[{from:'start',to:'effect',kind:'next'}]},behavior={trigger:'interact',action:'graph',graph:JSON.parse(JSON.stringify(graph))},item={id:'actor',behaviors:[behavior]},definition={id:'function',name:'Reusable',graph:JSON.parse(JSON.stringify(graph))},history=[],messages=[];let save;
 const state={item,existingBehavior:behavior,trigger:'interact',graph,...(functionOwner?{functionDefinition:definition}:{})};
 const c={playMode:false,graphEditorState:state,placed:[item],graphFunctions:[definition],OpusGraphFunctions:require('../editor/src/00-graph-functions.js'),readBehaviorEventSource:()=>undefined,controllerStateEventAuthoringIssue:()=>null,showStatus:value=>messages.push(value),closeGraphEditor:()=>{c.graphEditorState=null;},renderBehaviorList:()=>{},document:{getElementById:id=>id==='graph-save-btn'?{addEventListener:(name,fn)=>{assert.equal(name,'click');save=fn;}}:{}},pushUndo:()=>history.push(JSON.parse(JSON.stringify({behaviors:item.behaviors,graphFunctions:c.graphFunctions})))};
 vm.createContext(c);const from=source.indexOf("document.getElementById('graph-save-btn').addEventListener('click', () => {"),to=source.indexOf('\nlet playTriggers',from);assert(from>=0&&to>from);vm.runInContext(source.slice(from,to),c);return {c,state,item,behavior,definition,history,messages,save};
}
test('Actual mounted ordinary Graph Save identical content adds no Undo',()=>{const f=saveFixture();f.save();assert.equal(f.history.length,0);assert.equal(f.c.graphEditorState,null);});
test('Actual mounted reusable Function Save identical content adds no Undo',()=>{const f=saveFixture(true);f.save();assert.equal(f.history.length,0);assert.equal(f.c.graphEditorState,null);});
test('Actual mounted Graph Save refuses Play without changing ordinary or Function owner',()=>{for(const isFunction of [false,true]){const f=saveFixture(isFunction);f.c.playMode=true;f.state.graph.nodes[0].text='changed';const before=JSON.stringify({behavior:f.behavior,definition:f.definition});f.save();assert.equal(f.history.length,0);assert.equal(JSON.stringify({behavior:f.behavior,definition:f.definition}),before);}});
test('Actual mounted ordinary Graph Save refuses removed owner and detached behavior',()=>{for(const detach of [f=>f.c.placed=[],f=>f.item.behaviors=[]]){const f=saveFixture();detach(f);f.state.graph.nodes[0].text='changed';const before=JSON.stringify(f.behavior);f.save();assert.equal(f.history.length,0);assert.equal(JSON.stringify(f.behavior),before);}});
test('Actual mounted changed ordinary and Function Save produce one independent pre-change Undo',()=>{for(const isFunction of [false,true]){const f=saveFixture(isFunction);f.state.graph.nodes[0].text='changed';f.save();assert.equal(f.history.length,1);assert.equal((isFunction?f.definition:f.behavior).graph.nodes[0].text,'changed');assert.equal((isFunction?f.history[0].graphFunctions[0]:f.history[0].behaviors[0]).graph.nodes[0].text,'hello');}});
console.log(`Phase147 template authoring: ${passed} PASS, ${failed} FAIL`);
if(failed)process.exitCode=1;
