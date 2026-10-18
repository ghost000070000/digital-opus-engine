'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../editor/src/01-editor.js'),'utf8');
const schema=require('../editor/src/00-authoring-schema'),plumbing=require('../editor/src/00-authoring-plumbing'),actions=require('../editor/src/00-input-action-assets');
const custom={kind:'InputAction',version:1,id:'input-action-1',name:'Private jump',description:''};
const project=require('../editor/src/00-sprite-starters').instantiate('platformer-sky-steps').project;
const controller=project.levels[0].objects.find(x=>x.components?.['platformer-controller-2d']).components['platformer-controller-2d'];
controller.jumpActionRef=custom.id;project.inputActionAssets=[custom];
let fetches=0,composed;
const c={OpusAuthoring:schema,OpusAuthoringPlumbing:plumbing,OpusInputActionAssets:actions,INPUT_ACTION_LABELS:{jump:'Jump'},inputActionAssets:[],playMode:false,inputDeviceRuntime:null,collectEditorReferenceUses:()=>[],serializeProject:()=>project,collectLootTableIssues:()=>[],collectTouchLayoutIssues:()=>[],OpusInputContexts:{collectIssues:()=>[]},OpusSignals:{collectDependencies:()=>({issues:[]})},OpusGraphValues:{},GRAPH_NODE_TYPES:{},levels:project.levels,projectMeta:{title:'Private'},currentUiConfig:{startScreen:{}},window:{},document:{querySelector:()=>null},renderProjectValidation:issues=>c.issues=issues,activateTab:()=>{},fetch:async()=>{fetches++;return{ok:true,text:async()=>''};},composeExportHTML:options=>{composed=options;return'HTML';}};
vm.createContext(c);
c.JSON=JSON; // The mounted browser modules and their JSON snapshots share one realm.
vm.runInContext(source.match(/const INPUT_ACTION_LABELS = .*;/)[0],c);
for(const name of ['inputActionLabels','collectCanonicalProjectIssues'])vm.runInContext(source.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))[0],c);
c.collectStructuredProjectIssues=project=>c.collectCanonicalProjectIssues(project); // Other aggregate families separately tested.
vm.runInContext(source.match(/async function buildExportHTML\(playableOnly\) \{[\s\S]*?\n\}/)[0],c);
const dangling=()=>c.collectCanonicalProjectIssues(project).issues.filter(x=>x.code==='dangling-reference'&&x.referenceType==='inputAction');
(async()=>{
 const before=JSON.stringify(project);
 const actualCollector=source.match(/function collectCanonicalProjectIssues\(project\) \{[\s\S]*?\n\}/)[0];
 vm.runInContext(actualCollector.replace('inputActions: Object.entries(labels)','inputActions: Object.entries(inputActionLabels())'),c);
 assert.equal(dangling().length,1,'Historical live-label resolution reproduces RED on this same otherwise valid starter snapshot');
 vm.runInContext(actualCollector,c);
 assert.equal(dangling().length,0,'A valid snapshot-owned Action must not depend on missing live Action assets');
 for(const tier of [false,true]){assert.equal(await c.buildExportHTML(tier),'HTML');assert.equal(composed.embeddedProjectJSON,before);}
 c.inputActionAssets=[custom];project.inputActionAssets=[];
 assert.equal(dangling().length,1,'A live-only Action must not hide a missing reference in the portable snapshot');
 for(const tier of [false,true]){fetches=0;await assert.rejects(()=>c.buildExportHTML(tier),/Export preflight/);assert.equal(fetches,0);}
 c.playMode=true;c.inputDeviceRuntime={labels:{jump:'Jump',[custom.id]:'Live-only runtime Action'}};
 assert.equal(dangling().length,1,'Play runtime labels cannot rescue a missing snapshot Action');
 project.inputActionAssets=[{...custom,version:99}];assert.equal(dangling().length,1,'Unsupported snapshot Action remains unavailable without rewriting retained data');
 project.inputActionAssets=[custom,{...custom,name:'Duplicate'}];assert.equal(dangling().length,1,'Ambiguous snapshot IDs are not rescued by a valid live asset');
 project.inputActionAssets=[custom];assert.equal(dangling().length,0);
 controller.jumpActionRef='jump';project.inputActionAssets=[];c.inputDeviceRuntime={labels:{}};
 assert.equal(dangling().length,0,'Canonical built-in vocabulary remains valid independently of live runtime labels');
 controller.jumpActionRef=custom.id;project.inputActionAssets=[custom];assert.equal(JSON.stringify(project),before);
 console.log('Phase217 actual canonical Input Action snapshot ownership: portable-only acceptance, live-only/Play/future/ambiguous refusal, builtin compatibility, both-tier prefetch and exact bytes PASS');
})().catch(error=>{console.error(error);console.error(JSON.stringify(c.issues));process.exitCode=1;});
