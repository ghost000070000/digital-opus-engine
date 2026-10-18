'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),authoring=require('../editor/src/00-authoring-schema');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);let i=source.indexOf('(',start)+1,n=1;while(n){if(source[i]==='(')n++;if(source[i]===')')n--;i++;}const brace=source.indexOf('{',i);n=1;i=brace+1;while(n){if(source[i]==='{')n++;if(source[i]==='}')n--;i++;}return source.slice(start,i);}
function fixture(family='platformer2d'){
  const actor={id:'hero',kind:'sprite'};
  for(const id of ['body-2d','box-collider-2d','character-collision-2d',family==='topdown2d'?'topdown-controller-2d':'platformer-controller-2d'])authoring.addComponent(actor,id);
  actor.components['body-2d'].type='kinematic';
  if(family==='topdown2d')for(const key of ['wallSlideEnabled','slopeHandlingEnabled','stepHandlingEnabled'])actor.components['character-collision-2d'][key]=false;
  const history=[],noop=()=>{},c={playMode:false,showStatus:noop,renderPlayerSettingsPanel:noop,renderInputActionPanel:noop,renderInspector:noop,validateCurrentProject:noop,findInputAction:id=>['moveLeft','moveRight','moveForward','moveBack','jump','sprint'].includes(id)};
  vm.createContext(c);
  // Browser UMD modules and their authored records share one actual realm.
  for(const file of ['00-collision-filter-2d','00-ai-brain','00-damage-policy','00-combat-volumes','00-authoring-schema','00-controller-templates'])vm.runInContext(fs.readFileSync(require.resolve('../editor/src/'+file),'utf8'),c);
  const start=source.indexOf('const DEFAULT_PLAYER_SETTINGS ='),end=source.indexOf('\nfunction defaultPlayerSettings(',start);
  vm.runInContext(source.slice(start,end)+'\n'+extract('defaultPlayerSettings')+'\nlet controllerTemplates=[];'+['copyControllerTemplateLibrary','controllerTemplateTarget','captureControllerTemplate','importControllerTemplate','controllerTemplateCandidate','applyControllerTemplate','removeControllerTemplate'].map(extract).join('\n')+`\nthis.currentPlayerSettings={...defaultPlayerSettings(${JSON.stringify(family)}),maxHealth:137,inputContextId:'keep-context',visual:{assetId:'keep-art'},extension:{keep:true}};this.placed=${JSON.stringify([actor,{id:'other',kind:'sprite',components:actor.components}])};`,c);
  c.placed[0].entity={position:{x:0,y:2,z:0},nonportableMethod(){}};
  c.currentPlayerSettings[family==='topdown2d'?'topdownObjectRef':'platformerObjectRef']='hero';
  c.pushUndo=()=>history.push(JSON.parse(JSON.stringify({library:vm.runInContext('controllerTemplates',c),settings:c.currentPlayerSettings,placed:c.placed})));
  return {c,history,actor:()=>c.placed[0],library:()=>vm.runInContext('controllerTemplates',c)};
}
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}

test('Actual host binds unique primary Sprite and never captures Entity or another selected owner',()=>{
  const f=fixture(),before=JSON.stringify(f.c.placed);f.c.selectedItem=f.c.placed[1];assert(f.c.captureControllerTemplate('Primary').ok);
  assert.equal(f.library()[0].tuning.moveSpeed,5);assert.equal(JSON.stringify(f.c.placed),before);assert.equal(f.c.currentPlayerSettings.platformerObjectRef,'hero');
  f.c.placed.push({...f.actor()});assert(!f.c.controllerTemplateTarget().ok);assert(!f.c.captureControllerTemplate('Ambiguous').ok);assert.equal(f.history.length,1);
});
test('Actual primary identity ambiguity across different object kinds refuses capture',()=>{
  const f=fixture();f.c.placed.push({id:'hero',kind:'cube',components:{}});
  const before=JSON.stringify(f.c.placed),result=f.c.captureControllerTemplate('Ambiguous cross-kind');
  assert.equal(result.ok,false,'Runtime primary lookup rejects every duplicate ID, not just duplicate Sprites');
  assert.equal(f.history.length,0);assert.equal(JSON.stringify(f.c.placed),before);
});
test('Actual malformed dependencies disabled future and missing Action targets refuse without history',()=>{
  for(const mutate of [c=>delete c.placed[0].components['body-2d'],c=>c.placed[0].components['platformer-controller-2d'].enabled=false,c=>c.placed[0].components['platformer-controller-2d'].version=99,c=>c.placed[0].components['platformer-controller-2d'].moveLeftActionRef='missing',c=>c.currentPlayerSettings.platformerObjectRef='missing']){
    const f=fixture();mutate(f.c);const before=JSON.stringify(f.c.placed);assert(!f.c.captureControllerTemplate('Refused').ok);assert.equal(f.history.length,0);assert.equal(JSON.stringify(f.c.placed),before);
  }
});
test('Actual capture/apply use changed-only atomic history and preserve author references geometry and extensions',()=>{
  const f=fixture(),c=f.c;assert(c.captureControllerTemplate('Run').ok);assert.equal(f.history.length,1);const record=f.library()[0];
  assert(c.applyControllerTemplate(record).ok);assert.equal(f.history.length,1);record.tuning.moveSpeed=9;
  const before=JSON.stringify(c.currentPlayerSettings),body=JSON.stringify(f.actor().components['body-2d']),entity=f.actor().entity;
  assert(c.applyControllerTemplate(record).changed);assert.equal(f.history.length,2);assert.equal(f.history[1].placed[0].components['platformer-controller-2d'].moveSpeed,5);
  assert.equal(f.actor().components['platformer-controller-2d'].moveSpeed,9);assert.equal(f.actor().components['platformer-controller-2d'].jumpActionRef,'jump');
  assert.equal(JSON.stringify(c.currentPlayerSettings),before);assert.equal(JSON.stringify(f.actor().components['body-2d']),body);assert.strictEqual(f.actor().entity,entity);
  assert.equal(c.applyControllerTemplate(record).changed,false);assert.equal(f.history.length,2);
});
test('Actual names family mismatch and Play mutation refuse without consuming history',()=>{
  const f=fixture(),c=f.c;assert(!c.captureControllerTemplate('').ok);assert(c.captureControllerTemplate('Same').ok);assert(!c.captureControllerTemplate('Same').ok);
  const record=vm.runInContext('JSON.parse(JSON.stringify(controllerTemplates[0]))',c);record.family='topdown2d';record.tuning=vm.runInContext('({moveSpeed:9})',c);assert.match(c.applyControllerTemplate(record).reason,/current controller family/);
  c.playMode=true;assert(!c.captureControllerTemplate('Play').ok);assert(!c.applyControllerTemplate(f.library()[0]).ok);assert(!c.importControllerTemplate('{}').ok);assert.equal(c.removeControllerTemplate(0),false);assert.equal(f.history.length,1);
});
test('Actual retained future import stays inert duplicate import refuses and remove owns history',()=>{
  const f=fixture(),c=f.c,raw={kind:'ControllerSettingsTemplate',version:999,name:'Future',future:{keep:7}};
  assert(c.importControllerTemplate(JSON.stringify(raw)).ok);assert.equal(f.library()[0].future.keep,7);assert(!c.applyControllerTemplate(f.library()[0]).ok);
  assert(!c.importControllerTemplate(raw).ok);assert(!c.importControllerTemplate('{bad').ok);assert.equal(f.history.length,1);
  assert.equal(c.removeControllerTemplate(-1),false);assert.equal(c.removeControllerTemplate(.5),false);assert(c.removeControllerTemplate(0));assert.equal(f.history.length,2);assert.equal(f.history[1].library[0].future.keep,7);assert.equal(f.library().length,0);
});
test('Actual mounted library safely displays malformed retained JSON without coercion or losing recovery controls',()=>{
  const f=fixture(),c=f.c,nodes=new Map(),host={markup:'',set innerHTML(value){this.markup=value;},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{value:'',disabled:false,textContent:'',files:[],click(){}});return nodes.get(selector);}};
  const exported=[],downloads=[];c.Blob=class {constructor(parts){this.parts=parts;}};
  c.URL={createObjectURL:blob=>{exported.push(blob.parts.join(''));return 'blob:qualification-only';},revokeObjectURL(){}};c.setTimeout=fn=>fn();
  c.document={getElementById:id=>id==='controller-template-library'?host:null,createElement:()=>({click(){downloads.push({href:this.href,download:this.download});}})};
  vm.runInContext(extract('escapeHtml')+'\n'+extract('renderControllerTemplateLibrary'),c);
  const retained=[null,0,false,[],{version:999,name:null,family:null},{version:999,name:0,family:false},{version:999,name:[],family:[]},{version:999,name:{toString:'bad'},family:{toString:'bad'}}];
  for(const record of retained)assert(c.importControllerTemplate(JSON.stringify(record)).ok);
  const before=JSON.stringify(f.library()),count=f.history.length;
  assert.doesNotThrow(()=>c.renderControllerTemplateLibrary(),'Actual escapeHtml must never stringify invalid retained label objects');
  for(let index=0;index<retained.length;index++){
    assert(host.markup.includes(`<option value="${index}">`),'Every retained entry remains selectable');
    const select=nodes.get('#controller-template-select');select.value=String(index);assert.doesNotThrow(()=>select.onchange());
    assert.equal(nodes.get('#controller-template-apply').disabled,true,'Malformed data cannot apply');
    assert.equal(nodes.get('#controller-template-remove').disabled,false,'Malformed data remains removable');
    assert.equal(nodes.get('#controller-template-export').disabled,false,'Malformed data remains exportable');
    nodes.get('#controller-template-export').onclick();assert.equal(exported.length,index+1,'Selected false/null/scalar records still export');
    assert.deepStrictEqual(JSON.parse(exported[index]),retained[index]);
    assert.equal(downloads.length,index+1);assert.equal(downloads[index].href,'blob:qualification-only');assert.equal(downloads[index].download,'controller-template.json');
  }
  assert.equal(JSON.stringify(f.library()),before);assert.equal(f.history.length,count);
});
test('Actual existing ability tuning preserves named Action and absent template ability cannot remove it',()=>{
  const f=fixture(),c=f.c;vm.runInContext("placed[0].components['sprint-ability']={version:1,enabled:true,inputActionRef:'sprint',speedMultiplier:1.6};",c);
  const captured=c.captureControllerTemplate('Abilities');assert(captured.ok,captured.reason);const record=f.library()[0];record.abilities.sprint.speedMultiplier=2;assert(c.applyControllerTemplate(record).changed);
  assert.equal(f.actor().components['sprint-ability'].inputActionRef,'sprint');record.abilities=vm.runInContext('({})',c);record.tuning.moveSpeed=7;assert(c.applyControllerTemplate(record).changed);assert.equal(f.actor().components['sprint-ability'].speedMultiplier,2);
  delete f.actor().components['sprint-ability'];record.abilities.sprint=vm.runInContext('({enabled:true,speedMultiplier:3})',c);const before=JSON.stringify(f.actor());assert.match(c.applyControllerTemplate(record).reason,/existing sprint ability/);assert.equal(JSON.stringify(f.actor()),before);
});
test('Actual present malformed ability records refuse capture and apply atomically even without template ability patches',()=>{
  for(const id of ['jump-ability','sprint-ability'])for(const raw of [null,false,0,'corrupt',[],{version:999,enabled:true,inputActionRef:'jump',jumpSpeed:8,speedMultiplier:2},{version:1,enabled:'true',inputActionRef:'jump',jumpSpeed:8,speedMultiplier:2},
    {enabled:true,inputActionRef:'jump',jumpSpeed:8,speedMultiplier:2},{version:1,inputActionRef:'jump',jumpSpeed:8,speedMultiplier:2},
    {version:1,enabled:true,inputActionRef:'jump'},{version:1,enabled:true,jumpSpeed:8,speedMultiplier:2}]){
    const f=fixture(),c=f.c;assert(c.captureControllerTemplate('Valid before malformed ability').ok);const record=f.library()[0];record.tuning.moveSpeed=17;
    c.rawAbility=JSON.stringify(raw);vm.runInContext(`placed[0].components[${JSON.stringify(id)}]=JSON.parse(rawAbility);`,c);
    const before=JSON.stringify({placed:c.placed,settings:c.currentPlayerSettings}),count=f.history.length;
    assert.equal(c.captureControllerTemplate('Must refuse').ok,false,id+' '+JSON.stringify(raw)+' capture');
    assert.equal(c.applyControllerTemplate(record).ok,false,id+' '+JSON.stringify(raw)+' apply');
    assert.equal(f.history.length,count);assert.equal(JSON.stringify({placed:c.placed,settings:c.currentPlayerSettings}),before);
  }
  for(const raw of [null,false,0,'corrupt',[]]){
    const f=fixture(),c=f.c;assert(c.captureControllerTemplate('Before malformed component bag').ok);const record=f.library()[0];record.tuning.moveSpeed=17;
    c.rawBag=JSON.stringify(raw);vm.runInContext('placed[0].components=JSON.parse(rawBag);',c);
    const before=JSON.stringify({placed:c.placed,settings:c.currentPlayerSettings}),count=f.history.length;
    assert.equal(c.captureControllerTemplate('Must refuse').ok,false);assert.equal(c.applyControllerTemplate(record).ok,false);
    assert.equal(f.history.length,count);assert.equal(JSON.stringify({placed:c.placed,settings:c.currentPlayerSettings}),before);
  }
});
test('Actual shared snapshot UndoRedo restores library settings and component tuning together',()=>{
  const f=fixture(),c=f.c,noop=()=>{};
  Object.assign(c,{componentPresets:[],collisionLayers:[],prefabs:[],graphFunctions:[],levels:[{id:'level',playerSettings:c.currentPlayerSettings}],currentLevelIndex:0,activeTilesetId:null,signalRuntime:{clear:noop},OpusSignals:{copy:x=>JSON.parse(JSON.stringify(x))},OpusGraphSchema:require('../editor/src/00-graph-schema'),OpusCollisionFilter2D:require('../editor/src/00-collision-filter-2d'),captureLevelLogicSnapshot:()=>null,serializeTilesets:()=>[],serializeTilemapChunks:()=>[],serializeScene:()=>JSON.parse(JSON.stringify(c.placed)),loadScene:records=>{c.placed=JSON.parse(JSON.stringify(records));},savePrefabs:noop,renderItemDefList:noop,renderSignalManager:noop,renderCollisionLayerManager:noop,renderTilesetLibrary:noop,renderTilemapChunkLibrary:noop,updateUndoRedoButtons:noop});
  c.OpusInputActionAssets=require('../editor/src/00-input-action-assets');
  c.renderLootTableList=noop;vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-loot-tables.js'),'utf8')+'\nlootTables=[];\n'+extract('copyLootLibrary'),c);
  require('./inventory-template-fixture')(c);
  vm.runInContext('let undoStack=[],redoStack=[];const MAX_HISTORY=100;'+['copyInputActionAssets','copyComponentPresetLibrary','copyUiTemplateLibrary','copyCameraTemplateLibrary','captureEditorSnapshot','copyAiArchetypeLibrary','copyCombatEncounterLibrary','loadEditorSnapshot','pushUndo','undo','redo'].map(extract).join('\n'),c);
  assert(c.captureControllerTemplate('History').ok);f.library()[0].tuning.moveSpeed=11;assert(c.applyControllerTemplate(f.library()[0]).changed);
  assert.equal(f.actor().components['platformer-controller-2d'].moveSpeed,11);c.undo();assert.equal(f.actor().components['platformer-controller-2d'].moveSpeed,5);assert.equal(f.library().length,1);c.undo();assert.equal(f.library().length,0);
  c.redo();assert.equal(f.library().length,1);c.redo();assert.equal(f.actor().components['platformer-controller-2d'].moveSpeed,11);assert.equal(c.currentPlayerSettings.maxHealth,137);assert.equal(c.currentPlayerSettings.platformerObjectRef,'hero');
});
test('Actual serializer includes independent authoring library and omits it from runtime project records',()=>{
  const prior=fs.readFileSync(require.resolve('./phase-108-authored-session-journal.test'),'utf8').split('let passed=0,failed=0;')[0];
  const c=new Function('require',prior+';return fixture;')(require)(),f=fixture();assert(f.c.captureControllerTemplate('Portable').ok);
  vm.runInContext('let controllerTemplates=[];'+extract('copyControllerTemplateLibrary')+'\n'+extract('serializeProject'),c);
  c.savedTemplates=JSON.parse(JSON.stringify([...f.library(),{kind:'ControllerSettingsTemplate',version:999,name:'Future',future:{keep:7}}]));
  vm.runInContext('controllerTemplates=copyControllerTemplateLibrary(savedTemplates);',c);
  const author=c.serializeProject(),runtime=c.serializeProject({includeTilesets:false});assert.equal(author.controllerTemplates.length,2);assert.equal(runtime.controllerTemplates.length,0);
  author.controllerTemplates[1].future.keep=99;assert.equal(c.serializeProject().controllerTemplates[1].future.keep,7);assert.equal(c.copyControllerTemplateLibrary(JSON.parse(JSON.stringify(c.serializeProject())).controllerTemplates)[1].version,999);
});
console.log(`Phase120 actual Controller template host: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
