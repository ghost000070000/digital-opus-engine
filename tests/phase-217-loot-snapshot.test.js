'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
function extract(name){const at=source.indexOf('function '+name+'(');assert(at>=0,name);return source.slice(at,source.indexOf('\n}',at)+2);}
const c={};vm.createContext(c);
vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-loot-tables.js'),'utf8')+'\n'+['validateImportedSceneRecords','lootPickupPrefab','inspectLootTable','collectLootTableIssues'].map(extract).join('\n')+`;
 snapshot={levels:[],itemDefs:[{id:'coin',maxStack:99}],prefabs:[{name:'Coin',record:{id:'root',kind:'cube',position:[0,0,0],scale:[1,1,1],color:[1,1,1],components:{pickup:{version:1,enabled:true,quantity:1,itemRef:'coin',removeOnCollect:true},interactable:{version:1,enabled:true,range:2}},behaviors:[{trigger:'interact',action:'collectPickup',params:{targetId:'root'}}]}}],lootTables:[{version:1,id:'loot',name:'Coins',seed:0,entries:[{kind:'prefab',prefabName:'Coin',weight:1}]}]};
 prefabs=[];currentItemDefs=[];levels=[];undoStack=[{keep:'undo'}];redoStack=[{keep:'redo'}];
 `,c);
const clone=value=>vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(value))+')',c);
const good=clone(c.snapshot);let portable,fetches=0,composed;
Object.assign(c,{serializeProject:()=>portable,collectTouchLayoutIssues:()=>[],collectStructuredProjectIssues:()=>({issues:[]}),OpusInputContexts:{collectIssues:()=>[]},OpusSignals:{collectDependencies:()=>({issues:[]})},OpusGraphValues:{},GRAPH_NODE_TYPES:{},projectMeta:{title:'Private'},currentUiConfig:{startScreen:{}},window:{},document:{querySelector:()=>null},activateTab:()=>{},renderProjectValidation:issues=>c.report=issues,fetch:async()=>{fetches++;return{ok:true,text:async()=>''};},composeExportHTML:options=>{composed=options;return 'HTML';}});
vm.runInContext(source.match(/async function buildExportHTML\(playableOnly\) \{[\s\S]*?\n\}/)[0],c);
(async()=>{
 // RED before repair: valid portable data is wrongly rejected solely because
 // unrelated current editor libraries do not contain its retained dependencies.
 assert.equal(c.collectLootTableIssues(c.snapshot).length,0,'Detached valid Loot must use snapshot Prefab/item definitions, not absent live libraries');
 const cases=[['missing live Prefabs',()=>{c.prefabs=[];c.currentItemDefs=clone(good.itemDefs);},good,true],['missing live Items',()=>{c.prefabs=clone(good.prefabs);c.currentItemDefs=[];},good,true],['missing snapshot Prefabs',()=>{c.prefabs=clone(good.prefabs);c.currentItemDefs=clone(good.itemDefs);},{...good,prefabs:[]},false],['missing snapshot Items',()=>{c.prefabs=clone(good.prefabs);c.currentItemDefs=clone(good.itemDefs);},{...good,itemDefs:[]},false]];
 for(const [name,setup,data,allowed]of cases){setup();portable=clone(data);const before=JSON.stringify({portable,prefabs:c.prefabs,items:c.currentItemDefs,undo:c.undoStack,redo:c.redoStack}),undoOwner=c.undoStack,redoOwner=c.redoStack;
  assert.equal(c.collectLootTableIssues(portable).some(issue=>issue.severity==='error'),!allowed,name);
  for(const tier of [false,true]){fetches=0;if(allowed){assert.equal(await c.buildExportHTML(tier),'HTML',name);assert(fetches>0);assert.equal(composed.embeddedProjectJSON,JSON.stringify(portable));assert.equal(composed.playableOnly,tier);}else{await assert.rejects(()=>c.buildExportHTML(tier),/Loot Table validation/,name);assert.equal(fetches,0);assert(c.report.some(issue=>issue.code==='loot-table-invalid'));}assert.equal(JSON.stringify({portable,prefabs:c.prefabs,items:c.currentItemDefs,undo:c.undoStack,redo:c.redoStack}),before);assert.strictEqual(c.undoStack,undoOwner);assert.strictEqual(c.redoStack,redoOwner);}
 }
 // Omitted dependencies retain existing live authoring/runtime semantics.
 c.prefabs=clone(good.prefabs);c.currentItemDefs=clone(good.itemDefs);assert.equal(c.lootPickupPrefab('Coin').ok,true);assert.equal(c.inspectLootTable(good.lootTables[0]).ok,true);c.currentItemDefs=[];assert.equal(c.lootPickupPrefab('Coin').ok,false);assert.equal(c.inspectLootTable(good.lootTables[0]).ok,false);
 console.log('Phase217 actual Loot snapshot: detached vs live Prefab/Item disagreement both directions, both-tier prefetch refusal/acceptance, exact bytes/history nonmutation and unchanged runtime defaults PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
