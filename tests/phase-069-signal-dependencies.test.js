'use strict';
const assert=require('assert'),Signals=require('../editor/src/00-signals');
assert.equal(typeof Signals.collectDependencies,'function','Canonical Signals needs export dependency validation');
const definitions=[{id:'begin',name:'Begin'},{id:'value',name:'Value',payloadType:'number'},{id:'local',name:'Local',scope:'level',levelId:'one'},{id:'own',name:'Own',scope:'prefab'}];
const send=(id,payload)=>({action:'sendSignal',params:{signalId:id,payload}});
const project={signals:definitions,levels:[{id:'one',name:'Workshop',objects:[{id:'actor',name:'Button',behaviors:[send('missing'),{trigger:'signal',eventRef:{signalId:'begin'},action:'graph',graph:{nodes:[{id:'call',type:'callGraphFunction',functionId:'fn'}],edges:[]}}]}],sequences:[{id:'seq',name:'Open gate',steps:[{kind:'action',actionType:'sendSignal',params:{signalId:'value',payload:'wrong'}}]}],objectiveDefs:[{id:'goal',title:'Reach exit',signals:{complete:'value'}}]}],graphFunctions:[{id:'fn',name:'Relay',graph:{nodes:[{id:'send',type:'sendSignal',signalId:'missing-in-function'}],edges:[]}}],prefabs:[{name:'Switch',objects:[{id:'source',behaviors:[send('missing-in-prefab')]}]}]};
const before=JSON.stringify(project),result=Signals.collectDependencies(project);
assert.equal(JSON.stringify(project),before,'Validation must not mutate authored records');
for(const code of ['signal-reference-unavailable','signal-payload-invalid','signal-notification-type'])assert(result.issues.some(i=>i.code===code),code);
assert(result.issues.some(i=>i.functionId==='fn'&&i.message.includes('Relay')));
assert(result.issues.some(i=>i.prefabName==='Switch'));
assert(result.issues.some(i=>i.sequenceId==='seq'));
assert(result.issues.some(i=>i.objectiveId==='goal'));
project.prefabs=[{name:'Assembly',records:[{id:'root',behaviors:[send('missing-assembly')]}]}];assert(Signals.collectDependencies(project).issues.some(i=>i.prefabName==='Assembly'));
assert.equal(Signals.collectDependencies({levels:[{objects:[]}]}).issues.length,0,'Historical projects without Signals are compatible');
const good={signals:definitions,levels:[{id:'one',objects:[{id:'a',signalPrefabInstanceId:'assembly',behaviors:[send('value',0),send('own'),send('local'),{trigger:'signal',eventRef:{signalId:'value'},action:'graph',graph:{nodes:[{id:'read',type:'readSignalValue',signalId:'value'},{id:'send',type:'sendSignal',signalId:'value'}],edges:[{kind:'value',from:'read',to:'send',toField:'payload'}]}}]}],sequences:[],objectiveDefs:[]}]};
assert.equal(Signals.collectDependencies(good).issues.filter(i=>i.severity==='error').length,0);
const boundGraph=good.levels[0].objects[0].behaviors.at(-1).graph;boundGraph.nodes[0]={id:'read',type:'valueText',value:'wrong'};
assert(Signals.collectDependencies(good,{graphValueType:node=>require('../editor/src/00-graph-values').VALUE_TYPES[node?.type]?.outputType}).issues.some(i=>i.code==='signal-bound-value-invalid'));
boundGraph.nodes[0]={id:'read',type:'readSignalValue',signalId:'value'};
good.levels[0].id='two';assert(Signals.collectDependencies(good).issues.some(i=>i.code==='signal-channel-unavailable'));
good.levels[0].objects[0].signalPrefabInstanceId=null;assert(Signals.collectDependencies(good).issues.some(i=>i.code==='signal-channel-unavailable'&&i.referenceValue==='own'));
const inactiveTemplate={signals:definitions,levels:[{id:'one',objects:[{id:'template',behaviors:[{trigger:'signal',eventRef:{signalId:'own'},action:'changeColor',params:{color:'#33ccff'}}]}]}]};
const templateBefore=JSON.stringify(inactiveTemplate),templateReview=Signals.collectDependencies(inactiveTemplate);
assert.equal(templateReview.issues.filter(i=>i.severity==='error').length,0,'An intentionally unowned template receiver must remain exportable; runtime skips it');
assert(templateReview.issues.some(i=>i.code==='signal-channel-unavailable'&&i.severity==='warning'));
assert.equal(JSON.stringify(inactiveTemplate),templateBefore);
inactiveTemplate.levels[0].objects[0].behaviors=[send('own')];
assert(Signals.collectDependencies(inactiveTemplate).issues.some(i=>i.code==='signal-channel-unavailable'&&i.severity==='error'),'An unowned sender cannot produce its intended occurrence');
const mismatch={signals:definitions,levels:[{id:'one',objects:[{id:'a',behaviors:[{trigger:'start',action:'graph',graph:{nodes:[{id:'call',type:'callGraphFunction',functionId:'fn'}],edges:[]}}]}]}],graphFunctions:[{id:'fn',name:'Reader',graph:{nodes:[{id:'read',type:'readSignalValue',signalId:'value'}],edges:[]}}]};
assert(Signals.collectDependencies(mismatch).issues.some(i=>i.code==='signal-occurrence-unavailable'));
const cyclic={signals:definitions,graphFunctions:[{id:'a',graph:{nodes:[{id:'call',type:'callGraphFunction',functionId:'a'}],edges:[]}}]};assert.doesNotThrow(()=>Signals.collectDependencies(cyclic));
assert.doesNotThrow(()=>Signals.collectDependencies({signals:[null,{id:'broken'}],levels:[null,{objects:[null,{behaviors:'invalid'}],sequences:[null],objectiveDefs:[null]}],graphFunctions:[null],prefabs:[null]}));
console.log('Phase069 actual canonical dependency/owner/type/channel/caller/non-mutation tests PASS');
// Execute the ACTUAL shared export builder: both tiers audit before fetch,
// serialize once, and embed that same validated portable snapshot.
const fs=require('fs'),vm=require('vm'),source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const portable={signals:[{id:'valid',name:'Valid'}],levels:[{id:'one',objects:[{id:'actor',behaviors:[send('valid')]}]}],spriteAssets:[{id:'sprite',sourceTexture:'texture'}],textures:[{id:'texture'}]};let serializations=[],fetches=0,composed;
// Actual export now validates canonical InputContexts as a prior-to-fetch gate.
// This historical Signal fixture has an absent library, not bypassed validation.
const ctx={OpusSignals:Signals,OpusGraphValues:require('../editor/src/00-graph-values'),GRAPH_NODE_TYPES:{},serializeProject:options=>{serializations.push(options);return portable;},fetch:async()=>{fetches++;return {text:async()=>''};},composeExportHTML:options=>{composed=options;return 'HTML';},projectMeta:{title:'Creator'},currentUiConfig:{startScreen:{}},renderProjectValidation:issues=>ctx.lastIssues=issues,activateTab:()=>{},document:{querySelector:()=>null}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function buildExportHTML('),source.indexOf('function checkExportSize(',source.indexOf('async function buildExportHTML('))),ctx);
vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-input-contexts.js'),'utf8'),ctx);
// Actual Loot preflight also audits this historical absent library; no validator stub.
vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-loot-tables.js'),'utf8'),ctx);
for(const name of ['validateImportedSceneRecords','lootPickupPrefab','inspectLootTable','collectLootTableIssues']){const at=source.indexOf('function '+name+'(');assert(at>=0,name);vm.runInContext(source.slice(at,source.indexOf('\n}',at)+2),ctx);}
ctx.lootTables=[];ctx.prefabs=[];ctx.currentItemDefs=[];
ctx.levels=portable.levels;
// Bare historical Sprite payload is a Signal/snapshot fixture, not schema acceptance.
//217 exercises the actual canonical/complete structured export gate separately.
ctx.collectStructuredProjectIssues=()=>({issues:[]});
// Preserve the actual optional-layout audit in this historical export fixture.
// Its absent layout passes normally; no replacement validator is substituted.
vm.runInContext(fs.readFileSync(require.resolve('../editor/src/00-touch-control-layout.js'),'utf8'),ctx);
vm.runInContext(source.slice(source.indexOf('function collectTouchLayoutIssues('),source.indexOf('function commitTouchLayout(',source.indexOf('function collectTouchLayoutIssues('))),ctx);
(async()=>{for(const playableOnly of [false,true]){serializations=[];fetches=0;assert.equal(await ctx.buildExportHTML(playableOnly),'HTML');assert.equal(serializations.length,1);assert.equal(serializations[0].includeTilesets,!playableOnly);assert.deepStrictEqual(JSON.parse(composed.embeddedProjectJSON),JSON.parse(JSON.stringify(portable)));assert.equal(composed.playableOnly,playableOnly);assert(fetches>0);}
const originalFetch=ctx.fetch;ctx.fetch=async()=>{portable.levels[0].objects[0].behaviors[0].params.signalId='changed-during-fetch';return {text:async()=>''};};await ctx.buildExportHTML(false);assert.equal(JSON.parse(composed.embeddedProjectJSON).levels[0].objects[0].behaviors[0].params.signalId,'valid','Async export must own the same snapshot it validated; later authoring cannot overwrite it');ctx.fetch=originalFetch;
portable.levels[0].objects[0].behaviors[0]=send('missing');for(const playableOnly of [false,true]){serializations=[];fetches=0;await assert.rejects(()=>ctx.buildExportHTML(playableOnly),/Signal dependency/);assert.equal(fetches,0);assert.equal(serializations.length,1);assert(ctx.lastIssues.some(i=>i.code==='signal-reference-unavailable'));}console.log('Phase069 ACTUAL export builder both-tier prefetch gate/independent validated snapshot/Sprite payload preservation PASS');})().catch(error=>{console.error(error);process.exitCode=1;});
