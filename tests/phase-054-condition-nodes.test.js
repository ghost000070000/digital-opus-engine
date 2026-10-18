'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),language=require('../editor/src/00-authoring-language');
const source=fs.readFileSync(path.join(__dirname,'../editor/src/01-editor.js'),'utf8');
function actualHelper(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);const line=source.slice(at,source.indexOf('\n',at));return /\}\s*$/.test(line)?line:source.slice(at,source.indexOf('\n}',at)+2);}
const owner={id:'owner',kind:'cube',variables:{enabled:true,amount:4,label:'yes'},entity:{visible:true},health:{current:8}};
const context={ACTION_TYPES:{},OpusAuthoringLanguage:language,window:{__gameState:{score:5,health:8},__gameTimers:{clock:{finished:true,elapsed:4}},__gameFlags:{ready:true},__gameInventory:{key:2},__gameObjectives:{goal:'active'}},playerEquipment:{hand:{itemName:'key'}},heldObjectItem:owner,findItemById:id=>id==='owner'?owner:null,ensureHealthInit:()=>{},ensureObjectHealthInit:()=>{}};
context.OpusGraphValues=require('../editor/src/00-graph-values');
context.OpusGraphVariables=require('../editor/src/00-graph-variables');
context.OpusGraphFunctions=require('../editor/src/00-graph-functions');
// The actual input-helper slice registers the browser resize listener. This
// evaluator fixture has no viewport; retain the hook without firing it.
context.window.addEventListener=()=>{};
// Phase091 adds canonical Input Conditions. Exercise actual binding helpers,
// with ordinary built-in input observation; keep registry exhaustiveness strict.
Object.assign(context,{inputDeviceRuntime:null,inputActionAssets:[],inputActionMap:{interact:'KeyF'},effectiveInputMap:{interact:'KeyF'},playMode:true,app:{input:{wasPressed:code=>code==='KeyF',isDown:code=>code==='KeyF'}}});
Object.assign(context,{inputContexts:undefined,inputContextRuntime:null,currentPlayerSettings:{}});
// Historical unrestricted authoring, using actual canonical context policy.
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../editor/src/00-input-contexts.js'),'utf8'),context);
// Additive named Item and Door conditions use their real policy helpers; keep
// registry exhaustiveness and all historical targets/counts unchanged.
Object.assign(context,{currentItemDefs:[{id:'key',name:'Visible Key'}],placed:[owner],doorGateState:new Map(),OpusCollider2D:require('../editor/src/00-collider-2d'),OpusBody2D:require('../editor/src/00-body-2d')});
owner.components={'door-gate':{version:1,enabled:true,startsOpen:false,persistState:false}};
vm.runInContext(['namedInventoryItemSelection','resolveTarget','validDoorGate'].map(actualHelper).join('\n'),context);
const begin=source.indexOf('function evaluateConditionNode('),end=source.indexOf('// A graph action node',begin);vm.runInContext(source.slice(begin,end),context);
vm.runInContext(source.match(/const INPUT_ACTION_LABELS = [^\r\n]+/)[0],context);const inputStart=source.indexOf('function findInputAction('),inputEnd=source.indexOf('function createInputActionAsset(',inputStart);vm.runInContext(source.slice(inputStart,inputEnd),context);
const resolverStart=source.indexOf('function resolveGraphNodeValues('),resolverEnd=source.indexOf('function runGraphActionNode(',resolverStart);vm.runInContext(source.slice(resolverStart,resolverEnd),context);
// Actual evaluator: a self-dependent NOT must fail closed, not overflow or invert
// an invalid dependency into a true gate. No synthetic replacement solver.
const cycle={nodes:[{id:'cycle',type:'not'}],edges:[{from:'cycle',to:'cycle',kind:'cond'}]};
assert.equal(context.evaluateConditionNode(cycle.nodes[0],cycle,owner),false);
console.log('Phase054 actual Condition cycle guard PASS');
const projectionStart=source.indexOf('const GRAPH_NODE_TYPES = {}'),projectionEnd=source.indexOf('// (from-port, to-port)',projectionStart);
vm.runInContext(source.slice(projectionStart,projectionEnd)+'\nglobalThis.registry=CONDITION_TYPES;globalThis.graphTypes=GRAPH_NODE_TYPES;',context);
const cases={counterReaches:[{counter:'score',target:5},true],counterAtMost:[{counter:'score',target:4},false],healthAtLeast:[{target:8},true],healthAtMost:[{target:7},false],objectHealthAtLeast:[{targetId:'owner',target:8},true],objectHealthAtMost:[{targetId:'owner',target:7},false],timerFinished:[{timer:'clock'},true],timerAtLeast:[{timer:'clock',target:4},true],timerAtMost:[{timer:'clock',target:3},false],counterEquals:[{counter:'score',target:5},true],counterLessThan:[{counter:'score',target:5},false],counterGreaterThan:[{counter:'score',target:4},true],objectVisible:[{targetId:'owner'},true],isFlagTrue:[{name:'ready'},true],isFlagFalse:[{name:'ready'},false],hasItem:[{name:'key',count:2},true],objectiveIsComplete:[{objectiveId:'goal'},false],objectiveIsActive:[{objectiveId:'goal'},true],slotHasItem:[{slot:'hand',name:'key'},true],objectIsHeld:[{targetId:'owner'},true],objectVariableEquals:[{name:'label',value:'yes'},true],numberAtLeast:[{name:'amount',value:4},true],numberAtMost:[{name:'amount',value:3},false],booleanIs:[{name:'enabled',value:'true'},true]};
cases.compareValues=[{valueType:'number',operator:'gte',left:7,right:5},true];
cases.inputActionPressed=[{inputActionId:'interact'},true];cases.inputActionHeld=[{inputActionId:'interact'},true];
cases.hasNamedItem=[{itemId:'key',count:2},true];cases.doorIsClosed=[{targetId:'owner'},true];
const leaf={id:'leaf',type:'isFlagTrue',name:'ready'},empty={nodes:[],edges:[]};
for(const [type,definition] of Object.entries(context.registry)){
 assert.equal(definition.kind,'condition');assert.strictEqual(context.graphTypes[type].fields,definition.fields);assert(!['delay','script'].includes(type));assert(definition.fields.every(f=>f.label),'Every canonical Condition field has a creator label');
 if(['and','or','not'].includes(type)){const node={id:'operator',type},graph={nodes:[leaf,node],edges:[{from:'leaf',to:'operator',kind:'cond'}]};assert.equal(context.evaluateConditionNode(node,graph,owner),type!=='not');continue;}
 assert(cases[type],'Missing actual evaluator case '+type);const [params,expected]=cases[type];assert.equal(context.evaluateConditionNode({type,...params},empty,owner),expected,type);
}
assert.equal(Object.keys(cases).length+3,Object.keys(context.registry).length);
assert.equal(context.evaluateConditionNode({type:'not',id:'empty'},empty,owner),true,'Historical NOT unwired behavior stays true');
assert.equal(context.evaluateConditionNode({type:'objectVisible'},empty,owner),false,'Historical missing explicit target stays false');
assert.equal(context.evaluateConditionNode({type:'booleanIs',name:'enabled',value:'true'},empty,null),false,'Missing Self remains false');
assert.equal(context.evaluateConditionNode({type:'unknown'},empty,owner),false);
const a={id:'a',type:'not'},b={id:'b',type:'or'},indirect={nodes:[a,b,leaf],edges:[{from:'b',to:'a',kind:'cond'},{from:'a',to:'b',kind:'cond'},{from:'leaf',to:'b',kind:'cond'}]};assert.equal(context.evaluateConditionNode(a,indirect,owner),false,'NOT/OR cannot turn evaluated invalid cycle true');
const deep={nodes:[],edges:[]};for(let i=0;i<205;i++){deep.nodes.push({id:'d'+i,type:'not'});if(i)deep.edges.push({from:'d'+i,to:'d'+(i-1),kind:'cond'});}assert.equal(context.evaluateConditionNode(deep.nodes[0],deep,owner),false,'Bounded evaluation budget');
// Shared leaf adapter still converts Dialogue names/thresholds into same evaluator.
const dialogueStart=source.indexOf('function evaluateDialogueCondition('),dialogueEnd=source.indexOf('function runDialogueEntry(',dialogueStart);vm.runInContext(source.slice(dialogueStart,dialogueEnd),context);assert.equal(context.evaluateDialogueCondition({type:'counterReaches',name:'score',value:5}),true);assert.equal(context.evaluateDialogueCondition({type:'isFlagFalse',name:'ready'}),false);
assert.equal(language.logicEntries({}, {surface:'graph',graphTypes:context.graphTypes}).find(e=>e.id==='delay').label,'Delay / Wait','Graph-only Flow primitive label preserved');
console.log('Phase054 actual registry/evaluator '+Object.keys(context.registry).length+' Conditions, Self/explicit target, Dialogue adapter, cycles/budget PASS');
Object.assign(context,{OpusAuthoringPlumbing:require('../editor/src/00-authoring-plumbing'),placed:[owner],levels:[{id:'level',objects:[owner]}],currentLevelIndex:0,selectedItem:owner,currentObjectiveDefs:[],prefabs:[],assets:[],textureAssets:[],spriteAssets:[],spriteAnimationClips:[],audioAssets:[],escapeHtml:String});
const renderStart=source.indexOf('function renderActionFieldInput('),renderEnd=source.indexOf('function runAction(',renderStart);vm.runInContext(source.slice(renderStart,renderEnd),context);
const targetHtml=context.renderActionFieldInput(context.registry.objectVisible.fields[0],'owner','field',{},owner);
assert(targetHtml.includes('Choose Object'));assert(targetHtml.includes('value="owner"'),'Explicit named owner is valid even when empty is not implicit Self');
console.log('Phase054 actual shared explicit-target picker includes named owner PASS');
assert(context.renderActionFieldInput(context.registry.objectIsHeld.fields[0],'','held',{},owner).includes('Any held object'));
// Execute the real Duplicate command, not a model of its copying behavior.
// A Self-variable Condition must retain its authored input on a reusable copy.
class Vec3 { constructor(x,y,z){Object.assign(this,{x,y,z});} clone(){return new Vec3(this.x,this.y,this.z);} }
const original={id:'original',kind:'cube',variables:{enabled:true,amount:4},_authoredVariables:{enabled:false},behaviors:[{graph:{nodes:[{id:'self',type:'booleanIs',name:'enabled',value:'true'}],edges:[]}}],entity:{mesh:{},color:[1,1,1],position:new Vec3(0,0,0),scale:new Vec3(1,1,1)}};
const duplicates=[];
const duplicationContext={selectedItems:new Set([original]),pushUndo:()=>{},generateGroupId:()=> 'new-group',Opus:{Vec3,normalizeSpritePassRelation:()=> 'behind-sprites'},app:{addEntity:options=>options},cloneBehaviors:value=>JSON.parse(JSON.stringify(value)),OpusAuthoring:{copyComponents:()=>{}},addPlaced:item=>{item.id='copy';duplicates.push(item);},findItemById:()=>null,hierarchyTickToken:0,updateHierarchyTransforms:()=>{},syncSelectionMarkers:()=>{},renderInspector:()=>{},renderSceneList:()=>{}};
vm.createContext(duplicationContext);
const duplicateStart=source.indexOf('function duplicateSelected()'),duplicateEnd=source.indexOf('const inspectorBody =',duplicateStart);
vm.runInContext(source.slice(duplicateStart,duplicateEnd),duplicationContext);
duplicationContext.duplicateSelected();
const duplicate=duplicates[0];
assert(duplicate.variables&&duplicate.variables.enabled===true,'Duplicate retains current authored Self variables');
assert(duplicate._authoredVariables&&duplicate._authoredVariables.enabled===true,'Fresh Play baseline agrees with the duplicated authored record');
assert.notStrictEqual(duplicate.variables,original.variables);assert.notStrictEqual(duplicate._authoredVariables,duplicate.variables);
duplicate.variables.enabled=false;assert.equal(original.variables.enabled,true);assert.equal(duplicate._authoredVariables.enabled,true);
assert.equal(context.evaluateConditionNode(duplicate.behaviors[0].graph.nodes[0],duplicate.behaviors[0].graph,{...duplicate,variables:duplicate._authoredVariables}),true);
console.log('Phase054 actual Duplicate command retains independent Self variables and fresh-Play baseline PASS');
